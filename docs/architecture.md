# 架构（现行）

## 栈

- React 19 + Vite 8 + TypeScript（strict）
- Tailwind CSS v4
- `@xyflow/react` 画布，`d3-hierarchy` 布局（`src/layout.ts`）
- Zustand 状态（`src/store.ts`）
- Dexie / IndexedDB（`src/db.ts`、`src/persistence.ts`）
- 浏览器直连 OpenAI 兼容 Chat API（`src/ai.ts`）
- 静态托管：Cloudflare Pages 项目名 `onion`，域名 https://onion.gripe

## 目录

```
onion/
├─ src/
│  ├─ ai.ts            # 模型、义项判别、散开/讲解/出题 Prompt
│  ├─ store.ts         # 地图、掌握度、划线、复习
│  ├─ srs.ts           # 简化 SM-2
│  ├─ layout.ts        # 树布局与卡片高度估计
│  ├─ exportMarkdown.ts
│  ├─ components/      # Home / MindCanvas / MindNode / Sidebar / DetailPanel …
│  └─ types.ts
├─ docs/               # 现行文档（本目录）
├─ package.json
└─ vite.config.ts      # 开发端口 5188
```

## 本地命令

```bash
npm install
npm run dev        # http://localhost:5188
npm run build      # 产出 dist/
npx tsc --noEmit
```

## 部署面

- 源码：GitHub `heartthings/onion`，分支 `main`
- 生产：`npx wrangler pages deploy dist --project-name onion --branch main …`
- Pages 的 git 集成**不会**自动跟上每一次 push；发生产以 wrangler 部署为准
- 工作副本：`/home/hello/application/green/onion`

详见 [publish.md](./publish.md)。
