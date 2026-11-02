import type { KMap, KNode, ReviewCard } from './types';

const DAY = 86_400_000;
const TEN_MIN = 600_000;

export type Grade = 'again' | 'hard' | 'good';

export function dueReviews(cards: ReviewCard[], now = Date.now()): ReviewCard[] {
  return cards.filter((card) => card.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}

export function gradeCard(card: ReviewCard, grade: Grade, now = Date.now()): ReviewCard {
  let { ease, interval, reps, lapses } = card;
  if (grade === 'again') {
    return {
      ...card,
      ease: Math.max(1.3, ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: lapses + 1,
      dueAt: now + TEN_MIN,
    };
  }
  if (grade === 'hard') {
    interval = Math.max(1, Math.round((interval || 1) * 1.2));
    return {
      ...card,
      ease: Math.max(1.3, ease - 0.15),
      interval,
      reps: reps + 1,
      dueAt: now + interval * DAY,
    };
  }
  ease = Math.min(2.8, ease + 0.1);
  if (reps <= 0) interval = 1;
  else if (reps === 1) interval = 6;
  else interval = Math.max(1, Math.round((interval || 1) * ease));
  return { ...card, ease, interval, reps: reps + 1, dueAt: now + interval * DAY };
}

function fresh(partial: Pick<ReviewCard, 'id' | 'kind' | 'sourceId' | 'mapId' | 'nodeId' | 'front' | 'back'>): ReviewCard {
  return { ease: 2.5, interval: 0, dueAt: Date.now(), reps: 0, lapses: 0, ...partial };
}

export function ensureReview(cards: ReviewCard[], card: Pick<ReviewCard, 'id' | 'kind' | 'sourceId' | 'mapId' | 'nodeId' | 'front' | 'back'>): ReviewCard[] {
  const found = cards.find((item) => item.id === card.id);
  if (found) return cards.map((item) => (item.id === card.id ? { ...item, front: card.front, back: card.back } : item));
  return [fresh(card), ...cards];
}

export function nodeReview(map: KMap, node: KNode): Pick<ReviewCard, 'id' | 'kind' | 'sourceId' | 'mapId' | 'nodeId' | 'front' | 'back'> {
  const bits = [node.summary, node.note].filter((text) => text?.trim());
  return {
    id: `node:${node.id}`,
    kind: 'node',
    sourceId: node.id,
    mapId: map.id,
    nodeId: node.id,
    front: node.title,
    back: bits.join('\n') || '先用自己的话讲一遍这个知识点。',
  };
}

export function subtreeHealth(map: KMap, id: string): 'lost' | 'fuzzy' | null {
  const node = map.nodes[id];
  if (!node) return null;
  let health: 'lost' | 'fuzzy' | null = node.needsReview || node.mastery === 'lost' ? 'lost' : node.mastery === 'fuzzy' ? 'fuzzy' : null;
  for (const childId of node.childIds) {
    const sub = subtreeHealth(map, childId);
    if (sub === 'lost') return 'lost';
    if (sub === 'fuzzy' && health !== 'lost') health = 'fuzzy';
  }
  return health;
}

export function splitFollowUps(markdown: string): { body: string; questions: string[] } {
  const match = markdown.match(/(?:^|\n)##\s*继续追问\s*\n/);
  if (!match || match.index === undefined) return { body: markdown, questions: [] };
  const body = markdown.slice(0, match.index).trim();
  const rest = markdown.slice(match.index + match[0].length);
  const questions = rest
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+[.、]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#'));
  return { body, questions };
}
