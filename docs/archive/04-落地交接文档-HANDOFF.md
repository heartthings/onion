# 开发落地交接文档（HANDOFF）

> 写给 Code Agent ｜ 目标：从空目录到可运行产品，一次交付完成
> 版本 v1.2 ｜ **架构级变更**：画布改用 React Flow + ELK（对标 Rabbithole 已验证方案），引导串降级为 P2
> 前置阅读补充：`06-竞品分析与方案修订-Rabbithole.md` §1.5（探索页实现细节，**画布层必读**）
> 前置阅读：`00-产品方案与架构总纲.md` → `01-AI引擎与多模型适配规范.md` → `02-UI设计规范.md` → `03-Logo与品牌规范.md` → `05-数据模型与接口契约.md` → `06-竞品分析与方案修订-Rabbithole.md`

---

## 0. 三条铁律

1. **不要重新设计。** 本方案包里的原型、令牌、Prompt、算法都已定稿，实现即可。有疑问先查文档，不要自行发挥。
2. **不要引入方案外的依赖。** 技术栈已锁定（见 §2）。加依赖前必须说明理由并获得确认。
3. **不要留下 TODO。** 交付时 `grep -rn "TODO\|FIXME\|not implemented" src/` 必须为空（类型定义里的 TODO 除外）。

---

## 1. 施工顺序（严格按序）

```
PR-1  脚手架 + 设计令牌 + 三栏布局骨架
  ↓
PR-2  Dexie 数据层 + 类型定义 + 种子数据
  ↓
PR-3  Provider 抽象 + 10 家厂商 + 设置页 + 连通性测试
  ↓
PR-3.5 引导串：分支问题串 + 路径引擎 + 面板 UI   ← v1.1 新增
  ↓
PR-4  径向布局算法 + SVG 画布渲染 + 缩放平移
  ↓
PR-5  展开引擎 + 六层 Prompt + 流式渲染 + 剥开动效
  ↓
PR-6  详情面板 + 七视角 + 追问
  ↓
PR-7  出题判分 + 掌握度 + SM-2 + 错题回灌
  ↓
PR-8  缺口检测 + 导出 + 搜索 + 命令面板
  ↓
PR-9  PWA + Logo 接入 + 打磨 + 文档
```

**每个 PR 必须独立可运行、可演示**。不允许出现"等后面 PR 一起补"。

---

## 2. 技术栈锁定

```jsonc
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5",
    "dexie": "^4.0.10",
    "marked": "^14.1.2",
    "dompurify": "^3.2.3",
    "katex": "^0.16.11",
    "date-fns": "^4.1.0",
    "clsx": "^2.1.1",
    "@xyflow/react": "^12.3.6",
    "elkjs": "^0.9.3"
  },
  "devDependencies": {
    "vite": "^5.4.11",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "tailwindcss": "^3.4.15",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.8",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^25.0.1",
    "@playwright/test": "^1.49.1",
    "vite-plugin-pwa": "^0.21.1"
  }
}
```

**明确不使用**：d3-hierarchy（用 elkjs）、zustand-persist（用 Dexie）、任何 UI 组件库（组件自己写，样式已定）、任何 LLM SDK（Provider 自己写，浏览器直连）。

> ⚠️ **v1.2 变更**：画布层**改用 `@xyflow/react` + `elkjs`**（Rabbithole 同款，已验证）。**不再自研径向布局**。原 §7.1「径向布局算法」的移植要求作废，改为移植 §7.1' 的 ELK 封装。

---

## 3. 初始化命令

```bash
npm create vite@latest onion -- --template react-ts
cd onion
npm i zustand dexie marked dompurify katex date-fns clsx
npm i -D tailwindcss@3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test vite-plugin-pwa
npx tailwindcss init -p
```

`tailwind.config.js`：
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: { extend: { colors: { /* 见 §4 令牌映射 */ } } },
  corePlugins: { preflight: false },
}
```
> `preflight: false` 保留浏览器默认样式，避免与设计令牌冲突（原型即此做法）。

---

## 4. 设计令牌落地

把 `02-UI设计规范.md` §2 的 CSS 变量**原样**放进 `src/styles/tokens.css`：

```css
:root[data-theme="dark"] { /* §2.1 全部变量 */ }
:root[data-theme="light"] { /* §2.2 全部变量 */ }
```

Tailwind 映射（`tailwind.config.js`）：
```js
colors: {
  bg: { canvas:'var(--bg-canvas)', panel:'var(--bg-panel)', elevated:'var(--bg-elevated)',
         overlay:'var(--bg-overlay)', hover:'var(--bg-hover)' },
  txt: { primary:'var(--text-primary)', secondary:'var(--text-secondary)', tertiary:'var(--text-tertiary)' },
  border: { subtle:'var(--border-subtle)', DEFAULT:'var(--border-default)', strong:'var(--border-strong)' },
  brand: { DEFAULT:'var(--brand)', hover:'var(--brand-hover)', soft:'var(--brand-soft)' },
  layer: { 0:'var(--layer-0)', 1:'var(--layer-1)', 2:'var(--layer-2)',
           3:'var(--layer-3)', 4:'var(--layer-4)', 5:'var(--layer-5)' },
  status: { mastered:'var(--mastered)', fuzzy:'var(--fuzzy)', unknown:'var(--unknown)',
            expanding:'var(--status-expanding)', needs:'var(--status-needs)' },
}
```

**层语义色的用法**：`layer-N` 是**全局固定**的——不管哪个节点、哪棵树，L2 永远是青色。用户靠颜色就能判断"这是一层机理"。

---

## 5. 目录结构（照此创建）

```
src/
├─ domain/          纯逻辑，零 UI 零 IO，必须有单测
│  ├─ types.ts
│  ├─ layers.ts
│  ├─ facets.ts
│  ├─ tree.ts
│  ├─ mastery.ts
│  ├─ srs.ts
│  ├─ gapDetection.ts
│  └─ layout.ts
├─ engine/
│  ├─ providers/    types.ts base.ts openai.ts anthropic.ts qwen.ts zhipu.ts
│  │                deepseek.ts kimi.ts doubao.ts ollama.ts openrouter.ts registry.ts
│  ├─ prompts/      expand.ts facets.ts quiz.ts bridge.ts gap.ts
│  ├─ expandEngine.ts
│  ├─ quizEngine.ts
│  └─ json.ts       parseLooseJSON
├─ db/              schema.ts  repository.ts
├─ store/           useTreeStore.ts  useUIStore.ts  useSettingsStore.ts
├─ components/      canvas/ detail/ sidebar/ settings/ common/
├─ pages/           HomePage.tsx  CanvasPage.tsx  GraphPage.tsx
├─ lib/             crypto.ts  storage.ts  download.ts  clipboard.ts  markdown.ts
└─ styles/          tokens.css  global.css
```

---

## 6. 任务卡（Issue 粒度，可直接建 issue）

### PR-1 脚手架
| # | 任务 | 验收 |
|---|---|---|
| 1.1 | Vite+TS+Tailwind 打通，tokens.css 落地 | 亮/暗主题切换，背景与文字色随主题变化 |
| 1.2 | 三栏布局骨架（侧栏 264 / 画布 flex / 详情 384） | `dev` 下三栏宽度符合令牌，窗口缩放不塌 |
| 1.3 | Logo 接入顶栏 | 使用 `brand/logo-mark.svg`，深色主题下清晰 |
| 1.4 | 顶栏 6 个组件（品牌/树选择/搜索/复习/模型/设置） | 全部有 hover 态与真实数据绑定位 |

### PR-2 数据层
| # | 任务 | 验收 |
|---|---|---|
| 2.1 | `types.ts` 全量类型定义 | 与 `05-数据模型与接口契约.md` 一致 |
| 2.2 | Dexie schema + 6 张表 + 索引 | 刷新页面数据不丢 |
| 2.3 | 仓库层 CRUD + 种子数据（3 棵树） | 首次启动自动写入种子数据 |
| 2.4 | `tree.ts` 单测：增删改查、路径计算、移动、环检测 | 覆盖率 >80%，禁止把节点挂到自己的子孙下 |

### PR-3 Provider 层
| # | 任务 | 验收 |
|---|---|---|
| 3.1 | `types.ts` + `base.ts`（OpenAI 兼容基类） | 基类可被 8 家复用 |
| 3.2 | `anthropic.ts` 独立适配器 | system 独立字段、content 数组拼接、`x-api-key`、浏览器直连头全对 |
| 3.3 | `registry.ts` 10 家配置 | 端点/模型列表与文档一致 |
| 3.4 | 设置页：厂商下拉分组、Key 输入、模型下拉+手动输入、Base URL | 表单校验齐全 |
| 3.5 | 连通性测试 | 显示真实延迟，错误文案映射正确 |
| 3.6 | Key 加密存储（WebCrypto AES-GCM + PBKDF2） | 不勾选"记住"则刷新即失效 |
| 3.7 | SSE 流式解析器 | Anthropic 与 OpenAI 两种事件格式都能解析 |

### PR-3.5 引导串（探索模式）★ v1.1 新增
| # | 任务 | 验收 |
|---|---|---|
| 3.5.1 | `types.ts` 增 GuidedStep / GuidedSession / Branching | 与 `05-数据模型与接口契约.md` 一致 |
| 3.5.2 | Dexie 增 `guided` 表 | 刷新后探索会话不丢 |
| 3.5.3 | `prompts/guided.ts` 引导串 Prompt | 输出含 branching 与 createsNode |
| 3.5.4 | **`validateGuidedQuiz` 语义校验** | 环检测、索引越界、可达性、终止兜底 —— **死循环是最大线上风险，必须覆盖** |
| 3.5.5 | `nextStepIndex` 路径决策引擎 | 四种分支类型 + NPS 分档 + 多选取首个命中 |
| 3.5.6 | 四种回答控件（单选/多选/评分/开放） | 视觉符合 `02-UI设计规范.md` §14.3 |
| 3.5.7 | 引导串面板 UI（当前步高亮 / 已答折叠 / 未达灰显） | 可展开、可回看 |
| 3.5.8 | **逐步生成**（滑动窗口，一次只多备 2 问） | 禁止预生成整串；上下文截断到 1500 token |
| 3.5.9 | 回答 → 掌握度映射 | 评分低分扣分、开放回答加分并存为笔记卡 |
| 3.5.10 | **未走路径 → 待补全** | 会话结束时未到达步骤的节点亮橙色角标 |
| 3.5.11 | 探索结束总结卡 | 列出走过路径 + 未探索项（可点击直达） |
| 3.5.12 | 首页极简化改造 | 单输入框居中 + 建议词轮播 + 三个计数入口 |

### PR-4 画布
| # | 任务 | 验收 |
|---|---|---|
| 4.1 | `layout.ts` 径向布局（**照搬原型 `computeLayout()`**） | 单测验证：父子角度区间不重叠 |
| 4.2 | SVG 渲染：环带、连线、节点、标签 | 与原型视觉一致（可截图对比） |
| 4.3 | 缩放（0.3–2.5，以光标为锚点）+ 拖拽平移 | 滚轮缩放手感自然 |
| 4.4 | 节点交互：单击选中、双击钻入、悬停光圈 | 面包屑同步更新 |
| 4.5 | `fitToView()` 自适应 | 任意规模子树完整可见 |
| 4.6 | 侧栏树与画布双向联动 | 点击树节点画布定位并居中 |

### PR-5 展开引擎（**核心**）
| # | 任务 | 验收 |
|---|---|---|
| 5.1 | 六层 Prompt 模板 + 层语义校验 | 每层的 prompt 与文档 §6.1 一致 |
| 5.2 | `expandEngine.ts` 编排（含去重、兄弟上下文、路径上下文） | 一次调用只生成一层 |
| 5.3 | `parseLooseJSON` 三级容错 | 故意注入脏数据仍能解析 |
| 5.4 | 流式渲染：节点占位→逐字上屏→节点长出 | 动画符合 §4.5 时间线 |
| 5.5 | 剥开动效（620ms，stagger 60ms） | 观感与原型一致 |
| 5.6 | 失败降级：重试 2 次 → 手动添加子节点入口 | 绝不静默失败 |
| 5.7 | 响应缓存（prompt hash，TTL 24h） | 重复展开不发网络请求 |

### PR-6 详情面板
| # | 任务 | 验收 |
|---|---|---|
| 6.1 | 头部：标题 + 掌握度下拉 + 层标签 | 三态可循环切换 |
| 6.2 | 七视角 Tab + 未生成标记点 | 切换流畅，内容正确 |
| 6.3 | `MarkdownView`（marked + DOMPurify + KaTeX） | XSS 测试通过，公式渲染正常 |
| 6.4 | 追问面板 + 历史持久化 | 答案可"固化为新节点" |
| 6.5 | 底部动作区 4 按钮 | 全部有真实行为 |

### PR-7 闭环（**核心**）
| # | 任务 | 验收 |
|---|---|---|
| 7.1 | `mastery.ts` 掌握度计算 | 答对+12 / 答错-18 / 三态覆盖，符合文档 §6.2 |
| 7.2 | `quizEngine.ts` 出题 + 判分（简答用关键词比对） | 4 题，难度分布 1/2/1 |
| 7.3 | 测验面板 UI + 结果页 | 判分即时更新掌握度 |
| 7.4 | `srs.ts` SM-2 调度 | 答对后下次复习日期正确推算 |
| 7.5 | **回灌链路 1**：答错 → 节点 `needsExpand` → 橙色角标 | 必现 |
| 7.6 | **回灌链路 2**：连续复习失败 ≥2 次 → 节点重开 | 必现 |
| 7.7 | 今日复习队列 | 侧栏计数准确 |

### PR-6.5 回答映射回灌（v1.1 新增）
| # | 任务 | 验收 |
|---|---|---|
| 6.5.1 | 引导串面板与详情面板的联动切换 | 打开引导串时详情收起，反之亦然 |
| 6.5.2 | 改答后重算后续路径 | 修改历史答案 → 提示 → 重算 → 待补全同步更新 |
| 6.5.3 | 引导串节点与洋葱节点双向定位 | 从引导串点「钻入」→ 画布定位该节点 |

### PR-8 增强
| # | 任务 | 验收 |
|---|---|---|
| 8.1 | `gapDetection.ts` 五条规则 R1–R5 | 人工用例 100% 命中 |
| 8.2 | 待补全清单 + 点击直达并展开 | 可用 |
| 8.3 | 导出：单节点 / 整树 / 全库 Markdown + JSON 全量备份 | JSON 导入导出 100% 无损 |
| 8.4 | 搜索：节点标题 + 内容 | 模糊匹配，⌘K 唤起 |
| 8.5 | 命令面板 | 文档 §11 全部命令可用 |
| 8.6 | 节点操作：重命名 / 重新生成 / 删除 / 移动到其他树 | 危险操作二次确认 |

### PR-9 交付
| # | 任务 | 验收 |
|---|---|---|
| 9.1 | PWA（manifest + SW + 图标） | 可安装，离线可打开 |
| 9.2 | 品牌资产接入（图标、启动画面、空状态线稿） | 全部到位 |
| 9.3 | 空状态、错误态、加载态全清单覆盖 | 逐条对照 `02-UI设计规范.md` §14 |
| 9.4 | README | 新人 10 分钟内跑起来 |
| 9.5 | 生产构建 | `npm run build` 通过，无警告阻塞 |

---

## 7. 关键实现要点（Code Agent 必读）

### 7.1 画布层：React Flow + ELK（v1.2 改）

**不要自研径向布局。** 直接采用 Rabbithole 已验证的方案：

```ts
// ① ELK 自动布局
import ELK from 'elkjs/lib/elk.bundled.js';
const elk = new ELK();
const layout = await elk.layout({
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '48',
    'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  },
  children: nodes.map(n => ({ id: n.id, width: 600, height: 180 })),
  edges: edges.map(e => ({ id: e.id, sources: [e.fromId], targets: [e.toId] })),
});
```

```ts
// ② 祖先路径高亮（丝滑的核心，必须实现）
export function getAncestorEdgeIds(nodeId, nodeMap, edges): Set<string> {
  const ids = new Set<string>();
  let cur = nodeId;
  const node = nodeMap.get(cur);
  if (node?.type === 'followUpNode') {
    const e = edges.find(x => x.target === cur);
    if (e) cur = e.source;
  }
  while (cur) {
    const e = edges.find(x => x.target === cur);
    if (!e) break;
    ids.add(e.id);
    cur = e.source;
  }
  return ids;
}

// ③ 边样式（transition 不可省，这是"亮起来"而非"跳变"的关键）
export const EDGE_DEFAULT   = { stroke: '#374151', strokeWidth: 2, transition: 'stroke 0.2s ease' };
export const EDGE_HIGHLIGHT = { stroke: 'hsl(var(--brand))', strokeWidth: 2, transition: 'stroke 0.2s ease' };
```

**画布 props（照抄已验证参数）**：
- `panOnScroll` + `panOnScrollMode={Free}` —— 滚轮 = 平移，不是缩放
- `nodesDraggable={false}` —— 位置由 ELK 决定，用户拖不乱结构
- `fitView` + `fitViewOptions={{ padding: 0.2, maxZoom: 0.8 }}`
- `defaultViewport={{ x: 0, y: 0, zoom: 0.4 }}` + `minZoom={0.1}`
- `<Background />` + `<MiniMap pannable zoomable />`

### 7.1' 卡片节点规格（照抄 Rabbithole 视觉）

| 项 | 值 |
|---|---|
| 卡片宽度 | `max-w-[600px]`，`minWidth: 600px` |
| 圆角 | **`rounded-[35px]`** —— 超大圆角是它"柔和"观感的关键 |
| 底色 | `bg-[#262626]`（暗色）/ `--bg-elevated`（亮色） |
| 内边距 | `p-[30px]` |
| 标题 | `text-[20px] font-medium` |
| 层徽标 | `px-2 py-0.5 bg-white/10 rounded-full text-xs` —— 我们显示 "L2 机理" 而非 "CONCEPT" |
| 追问按钮 | **`opacity-0 group-hover:opacity-100 transition-opacity duration-300`** —— hover 才浮现 |
| 追问气泡 | `rounded-[35px] p-[30px] bg-[#1a1a1a] border border-[#333]`，`minWidth: 450px` |
| 文本域 | 挂载即 `focus()`；高度自适应 `el.style.height = scrollHeight + 'px'`；Enter 提交 / Esc 取消 |

### 7.1'' 六层语义的新表达（v1.2）

六层不再是同心环，而是**节点属性**：

| 层 | 徽标文案 | 节点描边色 |
|---|---|---|
| L0 本质 | `核心` | `--layer-0` |
| L1 构成 | `L1 构成` | `--layer-1` 靛蓝 |
| L2 机理 | `L2 机理` | `--layer-2` 青 |
| L3 边界 | `L3 边界` | `--layer-3` 琥珀 |
| L4 关联 | `L4 关联` | `--layer-4` 紫 |
| L5 延伸 | `L5 延伸` | `--layer-5` 品红 |

**展开下一层** = 在当前节点旁用 ELK 生长出 L(n+1) 的子节点（颜色自动继承层色）。

### 7.2 剥开动画
参考原型 `.pop` 动画 + `02-UI设计规范.md` §4.5 时间线。React 实现时用 CSS animation + `animation-delay: index * 60ms`。

### 7.3 Provider 抽象
**严格遵守 `01-AI引擎与多模型适配规范.md` §4**。两个最容易错的点：
1. Anthropic 的 `system` 是**顶层字段**，不在 messages 数组里
2. Anthropic 的 `max_tokens` **必填**

浏览器直连 Anthropic 必须带 `anthropic-dangerous-direct-browser-access: true`，否则 CORS 拦截。

### 7.4 六层语义不能改
`layers.ts` 中的六层定义是产品的骨架，**不是提示词建议**。展开子节点时必须按当前层的目标生成，不得混层。这是"知识树不长歪"的唯一保证。

### 7.5 一次只生成一层
`expandEngine` 禁止在一次调用中生成多层。多层生成会导致幻觉和结构失控，且成本不可控。

### 7.6 Key 安全
- 默认不持久化
- 勾选"记住"才落盘，且用 AES-GCM 加密
- **任何日志、错误信息、导出文件中不得出现 Key**——在 `ProviderError` 构造处主动脱敏
- 设置页必须展示隐私声明原文

### 7.7 XSS 防护
所有 AI 输出渲染前必须过 `DOMPurify.sanitize()`。这不是可选项。

---

## 8. 测试策略

| 层级 | 工具 | 覆盖内容 | 门槛 |
|---|---|---|---|
| 单元 | Vitest | `domain/` 全部纯逻辑：布局、掌握度、SM-2、缺口检测、树操作、JSON 解析 | 行覆盖 >70%，`domain/` >85% |
| 组件 | RTL | Provider 表单、测验面板、详情面板、树列表 | 关键交互路径 |
| E2E | Playwright | ① 配置模型并测试连接 ② 播种知识点 ③ 展开到 L5 ④ 切换七个视角 ⑤ 出题答错→验证橙色角标出现 ⑥ 刷新后数据不丢 | 6 条主流程全绿 |

**E2E 关键断言（第 5 条是闭环的核心验收）**：
```ts
await page.getByRole('button', { name: /出题/ }).click();
// 故意答错
await page.locator('.opt').nth(0).click();
await page.getByRole('button', { name: '确认答案' }).click();
await expect(page.locator('.node-c .needs-dot')).toBeVisible();  // 橙色角标
```

---

## 9. 验收脚本（交付前逐条打勾）

```bash
npm run build                                    # 构建通过
grep -rn "TODO\|FIXME" src/ | grep -v "\.d\.ts"  # 必须无输出
npm run test -- --coverage                        # 门槛达标
npx playwright test                               # 6 条主流程全绿
npm run dev                                      # 手工走查下方清单
```

**手工走查清单**
- [ ] 亮/暗主题切换，10 个关键页面无对比度问题
- [ ] 10 家厂商各测一次连通性（至少 5 家真实调用成功）
- [ ] 展开动画在 50+ 节点时仍流畅（60fps）
- [ ] 答错题 → 橙色角标出现 → 点击可展开 → 角标消失
- [ ] 刷新页面数据完整保留
- [ ] 导出 JSON → 清空 → 导入 → 数据完全一致
- [ ] 全程抓包确认：无任何请求发往洋葱自有域名
- [ ] DevTools 检查 Key 未出现在任何日志中
- [ ] `document.querySelectorAll('[onclick]')` 无内联事件（可维护性）

---

## 10. 常见坑清单（都是本次方案中已踩过的）

| 坑 | 后果 | 规避 |
|---|---|---|
| 用 d3-hierarchy 做布局 | 强制图布局，洋葱结构被破坏 | 自己写 `layout.ts` |
| Anthropic 沿用 OpenAI 的消息格式 | system 提示丢失，输出质量下降 | 独立适配器 |
| Anthropic 忘记 `max_tokens` | 400 报错 | 适配器里强制默认 2048 |
| 忘记浏览器直连头 | Anthropic 全部请求 CORS 失败 | `extraHeaders` 里写死 |
| 千问 `qwen3.5+` 默认开思考 | token 费用翻倍 | `enable_thinking: false` |
| 智谱 baseUrl 末尾斜杠 | 部分 SDK 报 404 | `replace(/\/+$/, '')` |
| DeepSeek Reasoner 传 temperature | 400 | 该模型自动剔除参数 |
| 展开时一次生成多层 | 结构失控、成本高 | 强制一层一次调用 |
| 已展开节点重复生成 | 出现重复子节点 | 生成前检查已有子节点 |
| 未过 DOMPurify | XSS | 所有 AI 输出必须消毒 |
| 引导串分支成环 | 用户永远点不完 | `validateGuidedQuiz` 必做环检测 + 可达性检查 |
| 引导串预生成整串 | 首响应慢、token 贵 | 滑动窗口逐步生成 |
| Key 写进 console.log | 泄露 | 统一走脱敏工具函数 |

---

## 11. 交付物清单

| 交付物 | 位置 |
|---|---|
| 源码 | `src/` |
| 品牌资产 | `public/brand/*.svg`（从本方案包 `brand/` 复制） |
| 单元测试 | `src/**/*.test.ts` |
| E2E 测试 | `tests/e2e/*.spec.ts` |
| README | `README.md`（运行方式、功能列表、截图） |
| 设计令牌 | `src/styles/tokens.css` |

---

## 12. 里程碑时间表

| PR | 内容 | 预估 | 累计 |
|---|---|---|---|
| PR-1 | 脚手架 + 令牌 + 布局 | 0.5 天 | 0.5 |
| PR-2 | 数据层 | 1 天 | 1.5 |
| PR-3 | Provider + 设置 | 2 天 | 3.5 |
| **PR-3.5** | **引导串 + 路径引擎 + 面板** | **3 天** | **6.5** |
| PR-4 | 画布 + 布局算法 | 2.5 天 | 9 |
| PR-5 | 展开引擎 + 动效 | 2.5 天 | 11.5 |
| PR-6 | 详情面板 + 视角 | 1.5 天 | 13 |
| PR-6.5 | 引导串联动 + 改答重算 | 1 天 | 14 |
| PR-7 | 闭环（测验 + SRS + 回灌） | 2 天 | 16 |
| PR-8 | 缺口 + 导出 + 搜索 | 1.5 天 | 17.5 |
| PR-9 | PWA + 打磨 + 文档 | 1.5 天 | **19 天** |

> 全职投入约 3.5 周。PR-3.5 与 PR-4 可并行（不同人/不同上下文），仍可压到 3 周。

---

*文档版本 v1.0 ｜ 建议 Code Agent 每完成一个 PR 更新本文件的勾选状态*
