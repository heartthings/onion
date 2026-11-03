import { hierarchy, tree } from 'd3-hierarchy';
import type { KMap, KNode, Side } from './types';

export const NODE_W = 320;
export const ROOT_W = 360;
const COLUMN = NODE_W + 108;
const GAP = 36;

export interface Placed {
  x: number;
  y: number;
  side: Side | 'root';
}

type Item = { id: string; node?: KNode };

function visibleChildren(map: KMap, n: KNode): KNode[] {
  if (n.collapsed) return [];
  return n.childIds.map((c) => map.nodes[c]).filter((child) => child && !child.hidden);
}

function countLines(text: string, width: number, font: number) {
  const perLine = Math.max(6, Math.floor(width / (font * 0.95)));
  let lines = 0;
  for (const raw of text.split('\n')) {
    const len = Array.from(raw.replace(/\s+/g, ' ').trim()).length;
    lines += Math.max(1, Math.ceil((len || 1) / perLine));
  }
  return lines;
}

/** 按标题和概括估卡片高度。深度解读不铺在卡片上，只留一枚标记的高度。 */
export function cardHeight(node: KNode, root = false): number {
  const inner = (root ? ROOT_W : NODE_W) - (root ? 48 : 36);
  let height = root ? 52 : 36;
  height += countLines(node.title || ' ', inner, root ? 21 : 15) * (root ? 28 : 22);
  if (node.origin === 'user') height += 22;
  if (node.summary?.trim()) height += 8 + countLines(node.summary, inner, 13) * 21;
  if (node.detail?.trim()) height += 26;
  if (!node.expanded) height += 28;
  return height + 78;
}

/** 根居中，一级子节点分列左右两侧，各侧向外水平展开（XMind 式思维导图）。坐标为节点中心点。 */
export function layoutMap(map: KMap): Record<string, Placed> {
  const root = map.nodes[map.rootId];
  const out: Record<string, Placed> = { [root.id]: { x: 0, y: 0, side: 'root' } };
  const kids = visibleChildren(map, root);

  const right = kids.filter((k) => k.side !== 'left');
  // 顺时针阅读：左侧从下往上排
  const left = kids.filter((k) => k.side === 'left').reverse();

  const place = (group: KNode[], dir: 1 | -1, side: Side) => {
    if (!group.length) return;
    const pseudo: Item = { id: '__root__' };
    const h = hierarchy<Item>(pseudo, (d) =>
      d.id === '__root__' ? group.map((n) => ({ id: n.id, node: n })) : visibleChildren(map, d.node!).map((n) => ({ id: n.id, node: n })),
    );
    const laid = tree<Item>()
      .nodeSize([1, COLUMN])
      .separation((a, b) => {
        const left = a.data.node ? cardHeight(a.data.node) : 80;
        const right = b.data.node ? cardHeight(b.data.node) : 80;
        return (left + right) / 2 + GAP;
      })(h);
    const offset = (ROOT_W - NODE_W) / 2;
    laid.each((d) => {
      if (d.data.id === '__root__') return;
      out[d.data.id] = { x: dir * (d.y + offset), y: d.x, side };
    });
  };

  place(right, 1, 'right');
  place(left, -1, 'left');
  return out;
}

/** 结构变了，或者卡片上的文字变长了，都要重排，避免更高的卡片叠在一起。 */
export function structureSignature(map: KMap): string {
  const parts: string[] = [];
  const walk = (id: string) => {
    const n = map.nodes[id];
    if (!n) return;
    if (n.hidden) return;
    parts.push(`${id}:${n.side ?? ''}:${n.collapsed ? 1 : 0}:${n.summary.length}:${n.detail?.trim() ? 1 : 0}`);
    if (!n.collapsed) n.childIds.forEach(walk);
    parts.push(')');
  };
  walk(map.rootId);
  return parts.join(',');
}
