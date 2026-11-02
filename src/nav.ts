import type { KMap, KNode, Side } from './types';

function shown(map: KMap, ids: string[]): KNode[] {
  return ids.map((id) => map.nodes[id]).filter((node) => node && !node.hidden);
}

/** 这个节点长在根的左侧还是右侧。根本身返回 root。 */
function trunk(map: KMap, id: string): Side | 'root' {
  let node = map.nodes[id];
  if (!node?.parentId) return 'root';
  while (node.parentId && map.nodes[node.parentId]?.parentId) node = map.nodes[node.parentId];
  return node.side === 'left' ? 'left' : 'right';
}

/** 和布局一致的上下顺序：右侧按保存顺序自上而下，根的左侧是反过来的。 */
function visualSiblings(map: KMap, node: KNode): KNode[] {
  if (!node.parentId) return [];
  const parent = map.nodes[node.parentId];
  if (!parent) return [];
  const list = shown(map, parent.childIds);
  if (!parent.parentId && node.side === 'left') return [...list].reverse();
  return list;
}

function firstChild(map: KMap, node: KNode, side?: Side): KNode | undefined {
  if (node.collapsed) return undefined;
  const kids = shown(map, node.childIds);
  if (!node.parentId) {
    const group = kids.filter((child) => (side === 'left' ? child.side === 'left' : child.side !== 'left'));
    if (side === 'left') return [...group].reverse()[0];
    return group[0];
  }
  return kids[0];
}

export type Arrow = 'up' | 'down' | 'left' | 'right';

/** 方向键在思维导图上的下一站。向外是子节点，向内是父节点，上下是同级。 */
export function neighbor(map: KMap, id: string, arrow: Arrow): string | null {
  const node = map.nodes[id];
  if (!node) return null;
  const side = trunk(map, id);

  if (arrow === 'up' || arrow === 'down') {
    if (!node.parentId) return null;
    const list = visualSiblings(map, node);
    const index = list.findIndex((item) => item.id === id);
    const next = list[index + (arrow === 'down' ? 1 : -1)];
    return next?.id ?? null;
  }

  const outward = (side === 'left' && arrow === 'left') || (side !== 'left' && arrow === 'right');
  if (side === 'root') {
    const child = firstChild(map, node, arrow === 'left' ? 'left' : 'right');
    return child?.id ?? null;
  }
  if (outward) return firstChild(map, node)?.id ?? null;
  return node.parentId;
}
