import { db } from './db';
import { ensureReview, nodeReview } from './srs';
import { applyTheme, DEFAULT_SETTINGS, useStore } from './store';
import type { Highlight, KMap, KNode, ReviewCard, Settings } from './types';

interface LegacyPersist {
  state?: {
    maps?: Record<string, KMap>;
    currentId?: string | null;
    sidebarOpen?: boolean;
    settings?: Partial<Settings>;
  };
}

function normalizeMap(map: KMap): KMap {
  const nodes: Record<string, KNode> = {};
  for (const [id, node] of Object.entries(map.nodes)) {
    nodes[id] = node.status === 'loading' ? { ...node, status: 'idle' } : node;
  }
  return { ...map, nodes };
}

/** 从 IndexedDB 恢复；若是旧版本写在 localStorage 里的数据，搬过来后删掉。 */
export async function hydrate(): Promise<void> {
  let maps = (await db.maps.toArray()).map(normalizeMap);
  let highlights = await db.highlights.toArray();
  const settingsRow = await db.meta.get('settings');
  const uiRow = await db.meta.get('ui');

  if (maps.length === 0) {
    const migrated = await migrateLocalStorage();
    if (migrated) {
      maps = migrated.maps;
      await db.maps.bulkPut(maps);
      await db.meta.put({ key: 'settings', value: migrated.settings });
      await db.meta.put({ key: 'ui', value: { currentId: migrated.currentId, sidebarOpen: migrated.sidebarOpen } });
    }
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, ...((settingsRow?.value as Partial<Settings>) ?? {}) };
  const ui = (uiRow?.value ?? {}) as { currentId?: string | null; sidebarOpen?: boolean };
  const storedReviews = await db.meta.get('reviews');
  highlights = highlights.sort((a, b) => b.createdAt - a.createdAt);

  const currentId = ui.currentId && maps.some((m) => m.id === ui.currentId) ? ui.currentId : null;
  const mapRecord = Object.fromEntries(maps.map((m) => [m.id, m]));
  useStore.setState({
    maps: mapRecord,
    highlights,
    reviews: backfillReviews(mapRecord, highlights, Array.isArray(storedReviews?.value) ? (storedReviews.value as ReviewCard[]) : []),
    settings,
    currentId,
    sidebarOpen: ui.sidebarOpen ?? true,
  });
  applyTheme(settings.theme);
}

function backfillReviews(maps: Record<string, KMap>, highlights: Highlight[], reviews: ReviewCard[]): ReviewCard[] {
  let next = reviews;
  for (const highlight of highlights) {
    const node = maps[highlight.mapId]?.nodes[highlight.nodeId];
    if (!node) continue;
    next = ensureReview(next, {
      id: `hl:${highlight.id}`,
      kind: 'highlight',
      sourceId: highlight.id,
      mapId: highlight.mapId,
      nodeId: highlight.nodeId,
      front: highlight.quote,
      back: [node.title, node.summary].filter(Boolean).join('\n') || node.title,
    });
  }
  for (const map of Object.values(maps)) {
    for (const node of Object.values(map.nodes)) {
      if (node.favorite) next = ensureReview(next, nodeReview(map, node));
    }
  }
  return next;
}

async function migrateLocalStorage(): Promise<{
  maps: KMap[];
  settings: Settings;
  currentId: string | null;
  sidebarOpen: boolean;
} | null> {
  const raw = localStorage.getItem('onion-app');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegacyPersist;
    const state = parsed.state;
    if (!state?.maps) return null;
    const maps = Object.values(state.maps).map(normalizeMap);
    localStorage.removeItem('onion-app');
    return {
      maps,
      settings: { ...DEFAULT_SETTINGS, ...state.settings },
      currentId: state.currentId ?? null,
      sidebarOpen: state.sidebarOpen ?? true,
    };
  } catch {
    return null;
  }
}

/** 把内存里的变化防抖写回 IndexedDB。必须在 hydrate 之后调用。 */
export function bindPersistence() {
  let maps = useStore.getState().maps;
  let highlights = useStore.getState().highlights;
  let reviews = useStore.getState().reviews;
  let settings = useStore.getState().settings;
  let currentId = useStore.getState().currentId;
  let sidebarOpen = useStore.getState().sidebarOpen;
  const dirty = new Set<string>();
  let timer = 0;

  const flush = () => {
    const latest = useStore.getState().maps;
    const jobs: Promise<unknown>[] = [];
    for (const id of dirty) {
      const map = latest[id];
      jobs.push(map ? db.maps.put(map) : db.maps.delete(id));
    }
    dirty.clear();
    void Promise.all(jobs);
  };

  useStore.subscribe((state) => {
    if (state.maps !== maps) {
      for (const id of new Set([...Object.keys(maps), ...Object.keys(state.maps)])) {
        if (maps[id] !== state.maps[id]) dirty.add(id);
      }
      maps = state.maps;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 350);
    }

    if (state.highlights !== highlights) {
      const prev = highlights;
      highlights = state.highlights;
      void syncHighlights(highlights, prev);
    }

    if (state.reviews !== reviews) {
      reviews = state.reviews;
      void db.meta.put({ key: 'reviews', value: reviews });
    }

    if (state.settings !== settings) {
      settings = state.settings;
      applyTheme(settings.theme);
      void db.meta.put({ key: 'settings', value: settings });
    }

    if (state.currentId !== currentId || state.sidebarOpen !== sidebarOpen) {
      currentId = state.currentId;
      sidebarOpen = state.sidebarOpen;
      void db.meta.put({ key: 'ui', value: { currentId, sidebarOpen } });
    }
  });
}

async function syncHighlights(next: Highlight[], prev: Highlight[]) {
  const prevById = new Map(prev.map((h) => [h.id, h]));
  const nextIds = new Set(next.map((h) => h.id));
  await Promise.all([
    ...next.filter((h) => prevById.get(h.id) !== h).map((h) => db.highlights.put(h)),
    ...prev.filter((h) => !nextIds.has(h.id)).map((h) => db.highlights.delete(h.id)),
  ]);
}
