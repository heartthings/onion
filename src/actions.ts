import { toast } from 'sonner';
import { explainNode, generateChildren } from './ai';
import { getPath, useStore } from './store';

/** 把已经排好序、但收起来的节点再放出一批。 */
export function openNext(mapId: string, nodeId: string): boolean {
  const st = useStore.getState();
  const opened = st.revealNext(mapId, nodeId, st.settings.childCount);
  if (opened.length) st.requestFocus(mapId, [nodeId, ...opened]);
  return opened.length > 0;
}

export async function expandNode(
  mapId: string,
  nodeId: string,
  opts: { replace?: boolean; hint?: string; more?: boolean } = {},
): Promise<void> {
  const st = useStore.getState();
  const map = st.maps[mapId];
  const node = map?.nodes[nodeId];
  if (!map || !node || node.status === 'loading') return;

  const hidden = node.childIds.some((id) => map.nodes[id]?.hidden);
  if (!opts.replace && !opts.more && !opts.hint && hidden) {
    openNext(mapId, nodeId);
    return;
  }

  st.updateNode(mapId, nodeId, { status: 'loading', error: undefined, collapsed: false });
  try {
    const existing = opts.replace ? [] : node.childIds.map((c) => map.nodes[c]?.title).filter(Boolean);
    const result = await generateChildren(st.settings, {
      path: getPath(map, nodeId),
      existing,
      count: st.settings.childCount,
      hint: opts.hint,
      sense: map.sense,
    });
    const s = useStore.getState();
    if (!s.maps[mapId]?.nodes[nodeId]) return;
    const created = s.addChildren(mapId, nodeId, result.children, opts.replace);
    s.updateNode(mapId, nodeId, {
      status: 'idle',
      ...(result.summary && !node.summary ? { summary: result.summary } : {}),
    });
    const visible = created.filter((id) => !s.maps[mapId]?.nodes[id]?.hidden);
    s.requestFocus(mapId, [nodeId, ...visible]);
  } catch (e) {
    const message = (e as Error).message;
    useStore.getState().updateNode(mapId, nodeId, { status: 'error', error: message });
    toast.error('散开失败', { description: message });
  }
}

let explainAbort: AbortController | null = null;

export async function explain(mapId: string, nodeId: string): Promise<void> {
  explainAbort?.abort();
  const controller = new AbortController();
  explainAbort = controller;

  const st = useStore.getState();
  const map = st.maps[mapId];
  if (!map?.nodes[nodeId]) return;

  st.setStreaming(nodeId);
  st.updateNode(mapId, nodeId, { detail: '' });
  let text = '';
  try {
    for await (const chunk of explainNode(st.settings, getPath(map, nodeId), controller.signal, map.sense)) {
      text += chunk;
      useStore.getState().updateNode(mapId, nodeId, { detail: text });
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      toast.error('讲解生成失败', { description: (e as Error).message });
    }
  } finally {
    if (explainAbort === controller) {
      explainAbort = null;
      useStore.getState().setStreaming(null);
    }
  }
}

export function stopExplain() {
  explainAbort?.abort();
}

/** 把讲解末尾的追问变成旁边的一个新节点，并立刻散开。 */
export async function sproutQuestion(mapId: string, parentId: string, question: string): Promise<void> {
  const st = useStore.getState();
  const parent = st.maps[mapId]?.nodes[parentId];
  if (!parent || parent.status === 'loading') return;
  const title = question.replace(/[？?]\s*$/, '').slice(0, 36);
  const existing = parent.childIds
    .map((id) => st.maps[mapId].nodes[id])
    .find((node) => node && (node.title === title || node.summary === question));
  if (existing) {
    if (existing.hidden) st.revealNode(mapId, existing.id);
    st.selectNode(existing.id);
    st.requestFocus(mapId, [existing.id]);
    if (!existing.expanded && existing.status !== 'loading') await expandNode(mapId, existing.id);
    return;
  }
  const [id] = st.addChildren(mapId, parentId, [{ title, summary: question, origin: 'ai', hidden: false }]);
  if (!id) return;
  st.selectNode(id);
  st.requestFocus(mapId, [id]);
  await expandNode(mapId, id);
}
