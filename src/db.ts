import Dexie, { type Table } from 'dexie';
import type { Highlight, KMap, Settings, Topic } from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * 本地库。地图、模型 Key、划线都放在 IndexedDB，容量远大于 localStorage，
 * 刷新不丢，也不经过任何服务器。
 */
export class OnionDB extends Dexie {
  maps!: Table<KMap, string>;
  meta!: Table<MetaRow, string>;
  highlights!: Table<Highlight, string>;

  constructor() {
    super('onion');
    this.version(1).stores({
      maps: 'id, updatedAt',
      meta: 'key',
      highlights: 'id, mapId, nodeId, createdAt',
    });
  }
}

export const db = new OnionDB();

export interface TopicCache {
  items: Topic[];
  fetchedAt: number;
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
