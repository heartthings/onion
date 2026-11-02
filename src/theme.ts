export interface BranchColor {
  stroke: string;
  soft: string;
  text: string;
}

export const BRANCH_COLORS: BranchColor[] = [
  { stroke: '#6366f1', soft: '#eef0ff', text: '#4338ca' },
  { stroke: '#0d9488', soft: '#e8f8f5', text: '#0f766e' },
  { stroke: '#d97706', soft: '#fdf4e3', text: '#a85b06' },
  { stroke: '#e11d48', soft: '#fdecef', text: '#be123c' },
  { stroke: '#7c3aed', soft: '#f3eefe', text: '#6d28d9' },
  { stroke: '#0284c7', soft: '#e8f4fc', text: '#0369a1' },
  { stroke: '#16a34a', soft: '#eaf7ee', text: '#15803d' },
  { stroke: '#db5a1e', soft: '#fdefe6', text: '#b4471a' },
];

const ROOT_COLOR: BranchColor = { stroke: '#1c1f26', soft: '#f1efe9', text: '#1c1f26' };

/** 自己添加的节点用这一支固定的蓝色，不跟分支色走 */
export const USER_COLOR: BranchColor = { stroke: '#1d4ed8', soft: '#dbeafe', text: '#1e40af' };

export function branchColor(index: number): BranchColor {
  if (index < 0) return ROOT_COLOR;
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

export function paintOf(node: { color: number; origin?: string }): BranchColor {
  return node.origin === 'user' ? USER_COLOR : branchColor(node.color);
}
