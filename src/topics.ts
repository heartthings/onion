import { db, readMeta, writeMeta, type TopicCache } from './db';
import type { Topic } from './types';

const TTL = 30 * 60 * 1000;

const SKIP_TITLE = /^(特殊|Special|Wikipedia|维基百科|文件|File|分类|Category|Portal|Help|Template|MediaWiki):|^首页$|^Main_Page$/;
const SKIP_DESC = /演员|歌手|艺人|偶像|主播|球员|政治人物|立法委员|模特|导演|编剧|主持人/;
const YEAR_ONLY = /^\d{3,4}年$/;

interface FeedPage {
  titles?: { normalized?: string };
  description?: string;
  extract?: string;
}

function pageTopic(page: FeedPage | undefined, kind: Topic['kind']): Topic | null {
  const title = page?.titles?.normalized?.trim();
  if (!title || SKIP_TITLE.test(title) || YEAR_ONLY.test(title)) return null;
  if (page?.description && SKIP_DESC.test(page.description)) return null;
  const blurb = (page?.extract || page?.description || '').replace(/\s+/g, ' ').trim();
  return { title, blurb: blurb.slice(0, 80), kind };
}

function pushUnique(out: Topic[], topic: Topic | null) {
  if (!topic) return;
  if (out.some((t) => t.title === topic.title)) return;
  out.push(topic);
}

/** 维基百科「每日精选 + 历史上的今天 + 过滤后的正在阅读」，浏览器可直连。 */
export async function fetchTopics(): Promise<Topic[]> {
  const d = new Date();
  const url = `https://zh.wikipedia.org/api/rest_v1/feed/featured/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const data = (await res.json()) as {
    tfa?: FeedPage;
    mostread?: { articles?: FeedPage[] };
    onthisday?: { pages?: FeedPage[] }[];
  };

  const out: Topic[] = [];
  pushUnique(out, pageTopic(data.tfa, 'featured'));
  for (const event of data.onthisday ?? []) {
    const pages = [...(event.pages ?? [])].sort((a, b) => (b.extract?.length ?? 0) - (a.extract?.length ?? 0));
    pushUnique(out, pageTopic(pages[0], 'history'));
  }
  for (const article of data.mostread?.articles ?? []) {
    pushUnique(out, pageTopic(article, 'reading'));
    if (out.length >= 16) break;
  }
  if (!out.length) throw new Error('empty feed');
  return out;
}

export async function loadTopics(force = false): Promise<Topic[]> {
  const cached = await readMeta<TopicCache>('topics');
  if (!force && cached && Date.now() - cached.fetchedAt < TTL && cached.items.length) return cached.items;
  try {
    const items = await fetchTopics();
    await writeMeta('topics', { items, fetchedAt: Date.now() } satisfies TopicCache);
    return items;
  } catch {
    return cached?.items ?? [];
  }
}

export async function topicsFetchedAt(): Promise<number | null> {
  const cached = await readMeta<TopicCache>('topics');
  return cached?.fetchedAt ?? null;
}
