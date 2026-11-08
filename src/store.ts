import { create } from 'zustand';
import { ensureReview, gradeCard, nodeReview, type Grade } from './srs';
import type { ChildDraft, Highlight, KMap, KNode, Mastery, ReviewCard, Sense, Settings } from './types';

/** UUID v4. `randomUUID` only exists on https and localhost, so plain http falls back to `getRandomValues`. */
function uid() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === 'function') webCrypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const DEFAULT_SETTINGS: Settings = {
  providerId: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  childCount: 5,
  theme: 'light',
};

export interface FocusRequest {
  mapId: string;
  ids: string[];
  at: number;
}

interface State {
  maps: Record<string, KMap>;
  currentId: string | null;
  selectedId: string | null;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settings: Settings;
  highlights: Highlight[];
  reviews: ReviewCard[];
  reviewOpen: boolean;
  comparePick: string | null;
  comparePair: { mapId: string; a: string; b: string } | null;
  focus: FocusRequest | null;
  streamingId: string | null;
  helpOpen: boolean;
  /** 快捷键 N：让详情面板打开「自己写一个节点」 */
  addRequest: { mapId: string; nodeId: string; at: number } | null;

  createMap: (topic: string, scope?: { sense?: Sense; alternatives?: Sense[] }) => { mapId: string; rootId: string };
  openMap: (id: string | null) => void;
  openAt: (mapId: string, nodeId: string) => void;
  deleteMap: (id: string) => void;
  renameMap: (id: string, title: string) => void;

  selectNode: (id: string | null) => void;
  updateNode: (mapId: string, id: string, patch: Partial<KNode>) => void;
  addChildren: (mapId: string, parentId: string, drafts: ChildDraft[], replace?: boolean) => string[];
  addUserChild: (mapId: string, parentId: string, draft: { title: string; summary: string }) => string | null;
  revealNext: (mapId: string, parentId: string, count: number) => string[];
  revealNode: (mapId: string, id: string) => void;
  deleteNode: (mapId: string, id: string) => void;
  toggleCollapse: (mapId: string, id: string) => void;
  toggleFavorite: (mapId: string, id: string) => void;
  setCollapseAll: (mapId: string, collapsed: boolean) => void;

  addHighlight: (mapId: string, nodeId: string, quote: string) => void;
  removeHighlight: (id: string) => void;
  setMastery: (mapId: string, id: string, mastery: Mastery) => void;
  gradeReview: (id: string, grade: Grade) => void;
  setReviewOpen: (open: boolean) => void;
  startCompare: (nodeId: string) => void;
  cancelCompare: () => void;
  finishCompare: (nodeId: string) => void;

  requestFocus: (mapId: string, ids: string[]) => void;
  setStreaming: (id: string | null) => void;
  setHelpOpen: (open: boolean) => void;
  askAddChild: (mapId: string, nodeId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

function newNode(partial: Partial<KNode> & Pick<KNode, 'title' | 'parentId' | 'depth' | 'color'>): KNode {
  return {
    id: uid(),
    summary: '',
    childIds: [],
    expanded: false,
    collapsed: false,
    status: 'idle',
    favorite: false,
    createdAt: Date.now(),
    ...partial,
  };
}

function collectSubtree(map: KMap, id: string, out: string[] = []): string[] {
  const n = map.nodes[id];
  if (!n) return out;
  out.push(id);
  n.childIds.forEach((c) => collectSubtree(map, c, out));
  return out;
}

function patchMap(state: State, mapId: string, fn: (map: KMap) => KMap): Partial<State> {
  const map = state.maps[mapId];
  if (!map) return {};
  return { maps: { ...state.maps, [mapId]: { ...fn(map), updatedAt: Date.now() } } };
}

function withoutReviews(cards: ReviewCard[], nodeIds: string[]): ReviewCard[] {
  const gone = new Set(nodeIds);
  return cards.filter((card) => !gone.has(card.nodeId));
}

function withoutHighlights(highlights: Highlight[], nodeIds: string[]): Highlight[] {
  if (!nodeIds.length) return highlights;
  const drop = new Set(nodeIds);
  const next = highlights.filter((h) => !drop.has(h.nodeId));
  return next.length === highlights.length ? highlights : next;
}

export const useStore = create<State>()((set, get) => ({
  maps: {},
  currentId: null,
  selectedId: null,
  sidebarOpen: true,
  settingsOpen: false,
  focus: null,
  streamingId: null,
  helpOpen: false,
  addRequest: null,
  highlights: [],
  reviews: [],
  reviewOpen: false,
  comparePick: null,
  comparePair: null,
  settings: DEFAULT_SETTINGS,

  createMap: (topic, scope) => {
    const title = topic.trim();
    const root = newNode({ title, parentId: null, depth: 0, color: -1 });
    const map: KMap = {
      id: uid(),
      title,
      rootId: root.id,
      nodes: { [root.id]: root },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(scope?.sense ? { sense: scope.sense } : {}),
      ...(scope?.alternatives?.length ? { alternatives: scope.alternatives } : {}),
    };
    set((s) => ({ maps: { ...s.maps, [map.id]: map }, currentId: map.id, selectedId: null }));
    return { mapId: map.id, rootId: root.id };
  },

  openMap: (id) => set({ currentId: id, selectedId: null }),

  openAt: (mapId, nodeId) => set({ currentId: mapId, selectedId: nodeId, focus: { mapId, ids: [nodeId], at: Date.now() } }),

  deleteMap: (id) =>
    set((s) => {
      const maps = { ...s.maps };
      delete maps[id];
      return {
        maps,
        highlights: s.highlights.filter((h) => h.mapId !== id),
        reviews: s.reviews.filter((card) => card.mapId !== id),
        currentId: s.currentId === id ? null : s.currentId,
        selectedId: null,
      };
    }),

  renameMap: (id, title) =>
    set((s) =>
      patchMap(s, id, (m) => ({
        ...m,
        title,
        nodes: { ...m.nodes, [m.rootId]: { ...m.nodes[m.rootId], title } },
      })),
    ),

  selectNode: (id) => set({ selectedId: id }),

  updateNode: (mapId, id, patch) =>
    set((s) =>
      patchMap(s, mapId, (m) => {
        if (!m.nodes[id]) return m;
        const nodes = { ...m.nodes, [id]: { ...m.nodes[id], ...patch } };
        const title = id === m.rootId && patch.title ? patch.title : m.title;
        return { ...m, title, nodes };
      }),
    ),

  addChildren: (mapId, parentId, drafts, replace = false) => {
    const created: string[] = [];
    let removed: string[] = [];
    set((s) => {
      const map = s.maps[mapId];
      const parent = map?.nodes[parentId];
      if (!map || !parent) return {};
      const nodes = { ...map.nodes };
      let keep = parent.childIds;
      if (replace) {
        removed = parent.childIds.flatMap((c) => collectSubtree(map, c));
        removed.forEach((x) => delete nodes[x]);
        keep = [];
      }
      const isRoot = parent.parentId === null;
      const siblings = keep.map((c) => nodes[c]).filter(Boolean);
      let right = siblings.filter((c) => c.side === 'right').length;
      let left = siblings.filter((c) => c.side === 'left').length;
      const total = siblings.length + drafts.length;

      drafts.forEach((d, i) => {
        const index = siblings.length + i;
        let side: KNode['side'];
        if (isRoot) {
          if (siblings.length === 0) side = index < Math.ceil(total / 2) ? 'right' : 'left';
          else side = right <= left ? 'right' : 'left';
          if (side === 'right') right++;
          else left++;
        }
        const child = newNode({
          title: d.title,
          summary: d.summary,
          parentId,
          depth: parent.depth + 1,
          color: isRoot ? index : parent.color,
          side,
          origin: d.origin ?? 'ai',
          hidden: d.hidden ?? false,
          value: d.value,
        });
        nodes[child.id] = child;
        created.push(child.id);
      });

      nodes[parentId] = { ...parent, childIds: [...keep, ...created], expanded: true, collapsed: false };
      return {
        maps: { ...s.maps, [mapId]: { ...map, nodes, updatedAt: Date.now() } },
        highlights: withoutHighlights(s.highlights, removed),
        reviews: withoutReviews(s.reviews, removed),
      };
    });
    return created;
  },

  addUserChild: (mapId, parentId, draft) => {
    const title = draft.title.trim();
    if (!title) return null;
    const ids = get().addChildren(mapId, parentId, [{ title, summary: draft.summary.trim(), origin: 'user', hidden: false }]);
    return ids[0] ?? null;
  },

  revealNext: (mapId, parentId, count) => {
    const parent = get().maps[mapId]?.nodes[parentId];
    if (!parent) return [];
    const ids = parent.childIds.filter((id) => get().maps[mapId].nodes[id]?.hidden).slice(0, count);
    if (!ids.length) return [];
    set((s) => {
      const map = s.maps[mapId];
      if (!map) return {};
      const nodes = { ...map.nodes };
      ids.forEach((id) => {
        if (nodes[id]) nodes[id] = { ...nodes[id], hidden: false };
      });
      return { maps: { ...s.maps, [mapId]: { ...map, nodes, updatedAt: Date.now() } } };
    });
    return ids;
  },

  revealNode: (mapId, id) =>
    set((s) => {
      const map = s.maps[mapId];
      const node = map?.nodes[id];
      if (!map || !node) return {};
      return {
        maps: {
          ...s.maps,
          [mapId]: { ...map, updatedAt: Date.now(), nodes: { ...map.nodes, [id]: { ...node, hidden: false } } },
        },
      };
    }),

  deleteNode: (mapId, id) =>
    set((s) => {
      const m = s.maps[mapId];
      const node = m?.nodes[id];
      if (!m || !node || node.parentId === null) return {};
      const removed = collectSubtree(m, id);
      return {
        ...patchMap(s, mapId, (map) => {
          const nodes = { ...map.nodes };
          removed.forEach((x) => delete nodes[x]);
          const parent = nodes[node.parentId!];
          nodes[parent.id] = { ...parent, childIds: parent.childIds.filter((c) => c !== id) };
          return { ...map, nodes };
        }),
        highlights: withoutHighlights(s.highlights, removed),
        reviews: withoutReviews(s.reviews, removed),
        selectedId: removed.includes(s.selectedId ?? '') ? node.parentId : s.selectedId,
      };
    }),

  toggleCollapse: (mapId, id) =>
    set((s) =>
      patchMap(s, mapId, (m) => ({
        ...m,
        nodes: { ...m.nodes, [id]: { ...m.nodes[id], collapsed: !m.nodes[id].collapsed } },
      })),
    ),

  toggleFavorite: (mapId, id) =>
    set((s) => {
      const map = s.maps[mapId];
      const node = map?.nodes[id];
      if (!map || !node) return {};
      const favorite = !node.favorite;
      const patched = patchMap(s, mapId, (m) => ({
        ...m,
        nodes: { ...m.nodes, [id]: { ...m.nodes[id], favorite } },
      }));
      const key = `node:${id}`;
      let reviews = s.reviews;
      if (favorite) reviews = ensureReview(reviews, nodeReview(map, node));
      else reviews = reviews.filter((card) => card.id !== key || card.reps > 0);
      return { ...patched, reviews };
    }),

  setMastery: (mapId, id, mastery) =>
    set((s) => {
      const map = s.maps[mapId];
      const node = map?.nodes[id];
      if (!map || !node) return {};
      const needsReview = mastery === 'lost';
      const patched = patchMap(s, mapId, (m) => ({
        ...m,
        nodes: { ...m.nodes, [id]: { ...m.nodes[id], mastery, needsReview } },
      }));
      let reviews = s.reviews;
      if (needsReview) {
        reviews = ensureReview(reviews, nodeReview(map, node)).map((card) =>
          card.id === `node:${id}` ? { ...card, dueAt: Date.now() } : card,
        );
      } else if (mastery === 'got' && !node.favorite) {
        // 懂了：之前因为「不会」或答错留下的复习卡不再需要，收藏的除外
        reviews = reviews.filter((card) => card.id !== `node:${id}`);
      } else if (mastery === 'fuzzy') {
        // 模糊：明天再看一次，不立刻打断
        reviews = ensureReview(reviews, nodeReview(map, node)).map((card) =>
          card.id === `node:${id}` ? { ...card, dueAt: Date.now() + 86_400_000 } : card,
        );
      }
      return { ...patched, reviews };
    }),

  gradeReview: (id, grade) =>
    set((s) => ({ reviews: s.reviews.map((card) => (card.id === id ? gradeCard(card, grade) : card)) })),

  setReviewOpen: (open) => set({ reviewOpen: open }),
  startCompare: (nodeId) => set({ comparePick: nodeId, comparePair: null }),
  cancelCompare: () => set({ comparePick: null, comparePair: null }),
  finishCompare: (nodeId) => {
    const pick = get().comparePick;
    const mapId = get().currentId;
    if (!pick || !mapId || pick === nodeId) return;
    set({ comparePick: null, comparePair: { mapId, a: pick, b: nodeId } });
  },

  setCollapseAll: (mapId, collapsed) =>
    set((s) =>
      patchMap(s, mapId, (m) => {
        const nodes: Record<string, KNode> = {};
        for (const [k, n] of Object.entries(m.nodes)) {
          nodes[k] = n.parentId === null || n.childIds.length === 0 ? n : { ...n, collapsed };
        }
        return { ...m, nodes };
      }),
    ),

  addHighlight: (mapId, nodeId, quote) => {
    const text = quote.trim();
    if (text.length < 2) return;
    const exists = get().highlights.some((h) => h.mapId === mapId && h.nodeId === nodeId && h.quote === text);
    if (exists) return;
    const item: Highlight = { id: uid(), mapId, nodeId, quote: text.slice(0, 400), createdAt: Date.now() };
    set((s) => {
      const map = s.maps[mapId];
      const node = map?.nodes[nodeId];
      const reviews =
        map && node
          ? ensureReview(s.reviews, {
              id: `hl:${item.id}`,
              kind: 'highlight',
              sourceId: item.id,
              mapId,
              nodeId,
              front: item.quote,
              back: [node.title, node.summary].filter(Boolean).join('\n') || node.title,
            })
          : s.reviews;
      return { highlights: [item, ...s.highlights], reviews };
    });
  },

  removeHighlight: (id) =>
    set((s) => ({
      highlights: s.highlights.filter((h) => h.id !== id),
      reviews: s.reviews.filter((card) => card.id !== `hl:${id}` || card.reps > 0),
    })),

  requestFocus: (mapId, ids) => set({ focus: { mapId, ids, at: Date.now() } }),
  setStreaming: (id) => set({ streamingId: id }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  askAddChild: (mapId, nodeId) => set({ addRequest: { mapId, nodeId, at: Date.now() } }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
}));

export function getPath(map: KMap, id: string): KNode[] {
  const path: KNode[] = [];
  let cur: KNode | undefined = map.nodes[id];
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? map.nodes[cur.parentId] : undefined;
  }
  return path;
}

export function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('onion-theme', theme);
  } catch {
    // 隐私模式写不进 localStorage 时，主题仍在本次会话生效
  }
}
