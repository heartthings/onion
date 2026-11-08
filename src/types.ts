export type NodeStatus = 'idle' | 'loading' | 'error';
export type Side = 'left' | 'right';
export type NodeOrigin = 'ai' | 'user';
export type Mastery = 'got' | 'fuzzy' | 'lost';

export interface KNode {
  id: string;
  parentId: string | null;
  title: string;
  summary: string;
  childIds: string[];
  /** 已经让 AI 散开过（即便结果为 0 个子节点） */
  expanded: boolean;
  collapsed: boolean;
  status: NodeStatus;
  error?: string;
  /** 深度讲解（Markdown） */
  detail?: string;
  note?: string;
  /** 收藏，方便回看 */
  favorite?: boolean;
  /** ai：模型生成；user：自己写的 */
  origin?: NodeOrigin;
  /** 按价值排到展示数量之外，先不画在图上 */
  hidden?: boolean;
  /** 学习价值 0–100，越高越先展示 */
  value?: number;
  /** 懂了 / 模糊 / 不会 */
  mastery?: Mastery;
  /** 测验答错，或自己标成还要再看 */
  needsReview?: boolean;
  /** 分支色序号，根节点为 -1 */
  color: number;
  /** 只对根的直接子节点有意义，决定它在左侧还是右侧 */
  side?: Side;
  depth: number;
  createdAt: number;
}

/** 一句话所指的那一个对象。同名的另一部电影、另一个概念是另一条。 */
export interface Sense {
  kind: string;
  gloss: string;
}

export interface KMap {
  id: string;
  title: string;
  rootId: string;
  nodes: Record<string, KNode>;
  createdAt: number;
  updatedAt: number;
  /** 这张图锁定的所指 */
  sense?: Sense;
  /** 同一句话的其他所指。换过去会另开一张图。 */
  alternatives?: Sense[];
}

export type ThemeName = 'light' | 'dark';

export interface Settings {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  childCount: number;
  theme: ThemeName;
}

/** 在讲解或摘要里划下的一段原文 */
export interface Highlight {
  id: string;
  mapId: string;
  nodeId: string;
  quote: string;
  createdAt: number;
}

/** 划线和收藏收成的复习卡，按简化 SM-2 排期 */
export interface ReviewCard {
  id: string;
  kind: 'highlight' | 'node';
  sourceId: string;
  mapId: string;
  nodeId: string;
  front: string;
  back: string;
  ease: number;
  interval: number;
  dueAt: number;
  reps: number;
  lapses: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  why: string;
}

export interface Topic {
  title: string;
  blurb: string;
  kind: 'featured' | 'history' | 'reading';
}

export interface ChildDraft {
  title: string;
  summary: string;
  value?: number;
  hidden?: boolean;
  origin?: NodeOrigin;
}
