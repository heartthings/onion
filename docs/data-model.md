# 数据模型（与代码对齐）

权威定义在 `src/types.ts`。下面是摘要，改字段先改代码再改本文。

## KNode

| 字段 | 含义 |
| --- | --- |
| `title` / `summary` | 卡片主文案 |
| `detail` | 深度解读 Markdown |
| `chat` | 解读后的多轮追问 |
| `note` | 用户笔记 |
| `favorite` | 收藏 |
| `origin` | `ai` \| `user` |
| `value` / `hidden` | 价值排序与是否先藏起 |
| `mastery` | `got` \| `fuzzy` \| `lost` |
| `needsReview` | 答错或标成还要再看 |
| `expanded` / `collapsed` / `status` | 散开状态 |
| `color` / `side` / `depth` | 视觉与布局 |

## Sense / KMap

- `Sense = { kind, gloss }`：这句话此刻指的那个对象。  
- `KMap.sense`：本图锁定的所指。  
- `KMap.alternatives`：可切换的其他所指。

## Highlight / ReviewCard

- 划线：`Highlight`，复习卡 id 形如 `hl:<id>`。  
- 节点复习卡 id 形如 `node:<nodeId>`。  
- 排期逻辑在 `src/srs.ts`；掌握度对复习卡的影响在 `src/store.ts` 的 `setMastery` / `toggleFavorite` / `removeHighlight`。

## Settings

`providerId`、`baseUrl`、`apiKey`、`model`、`childCount`、`theme`。存在 IndexedDB `meta.settings`。

## 持久化

- Dexie 库名 `onion`：`maps`、`highlights`、`meta`  
- 无服务端同步；清站点数据即清空
