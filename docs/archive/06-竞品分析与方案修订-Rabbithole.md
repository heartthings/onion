# 竞品分析：Rabbithole 与方案修订

> 研究日期 2026-10-30 ｜ 对象：https://www.rabbithole.chat/
> 方法：首页/定价页渲染 + Next.js 生产 bundle 逆向（含 `/rabbithole/[id]` 探索页 chunk）
> **版本 v1.2** ｜ 修正 v1.1 的核心误判：Rabbithole 的主交互是**无限画布节点流**，不是分支问卷

---

## 1. 研究结论（v1.2 修正）

**v1.1 的误判**：我最初以为 Rabbithole 的核心是「分支式引导问卷」（基于 `branching` / `responseValues` 数据结构）。那只是它的**旧版/隐藏机制**，不是用户实际感知到的东西。

**v1.2 的正确结论**：Rabbithole 的核心是**一张无限画布上的「节点卡片流」**。

用户的真实体验是：
1. 提问 → 画布上出现第一张卡片
2. 卡片下方长出「追问节点」，点它弹出一个自动聚焦的输入气泡
3. 追问后**新的卡片节点从旁边生长出来**，用 ELK 自动布局排位
4. 悬停任一节点 → **它到根节点的整条祖先路径连线高亮成橙色**
5. 画布可以无限滚轮平移，右下角有 Minimap

**「丝滑」不是动画效果，是信息架构** —— 内容、关系、探索入口全部在同一张平面上，没有一次页面跳转，没有二级弹窗层级。

而「知识洋葱」的核心资产是**跨时间累积的知识资产 + 掌握度追踪**。两者应该叠加：我们要用他的画布交互，保留我们的知识管理。


---

## 1.5 Rabbithole 探索页的真实技术实现（逆向所得，可直接参照）

> 这一节是 v1.2 新增的**实现级细节**，Code Agent 应据此调整洋葱的画布层设计。

### 1.5.1 技术栈

| 项 | 事实 |
|---|---|
| 框架 | Next.js App Router + React 18 + TypeScript |
| 画布 | **React Flow（@xyflow/react）** —— 不是自研 SVG |
| 自动布局 | **ELK（Eclipse Layout Kernel）** 的 `layered` 算法 —— 不是 d3 |
| 数据持久化 | Dexie/IndexedDB（`R.db`，表名 `conversations`） |
| 分析 | PostHog（`/s/` 端点） |
| 支付 | Stripe |
| 部署 | Vercel + PostHog Edge Function |

### 1.5.2 画布配置（关键参数，直接抄）

```ts
<ReactFlow
  nodes={nodes}
  edges={edges.map(e => ({
    ...e,
    style: e.data?.isHighlighted ? HIGHLIGHTED_EDGE : DEFAULT_EDGE,
  }))}
  panOnScroll={true}                    // ★ 滚轮 = 平移，不是缩放
  panOnScrollMode={PanOnScrollMode.Free}
  onConnect={onConnect}                 // 支持手动连线
  nodeTypes={{ cardNode: CardNode, followUpNode: FollowUpNode }}
  onNodeClick={...}                      // 点击节点 → 展开详情/追问
  onNodeMouseEnter={highlightPath}       // ★ 悬停 → 高亮祖先路径
  onNodeMouseLeave={clearHighlight}
  defaultEdgeOptions={{ style: DEFAULT_EDGE }}
  colorMode="dark"
  fitView={true}
  fitViewOptions={{ padding: 0.2, maxZoom: 0.8 }}
  defaultViewport={{ x: 0, y: 0, zoom: 0.4 }}
  minZoom={0.1}
  nodesDraggable={false}                 // ★ 节点不可拖动
>
  <Background />
  <MiniMap pannable zoomable nodeClassName="minimap-node" />
</ReactFlow>
```

**四个"丝滑"决策，逐条解释其价值：**

| 决策 | 为什么丝滑 |
|---|---|
| `panOnScroll={true}` + `Free` 模式 | 触控板双指滑动 = 画布平移，这是**思维导图类产品的标准手势**。用户不需要学习"滚轮缩放"这种会与页面滚动冲突的操作 |
| `nodesDraggable={false}` | 节点位置**由 ELK 布局算法决定**，用户不能拖乱。避免了"我拖了一下结构就乱了"的心理负担 —— 这是很多画布产品让人觉得"不听话"的根源 |
| `fitView` + `maxZoom: 0.8` + `padding: 0.2` | 首次渲染自动把整棵树**完整放进视野且留出 20% 边距**，永远不会是"打开一看挤成一团" |
| `defaultViewport.zoom = 0.4` | 默认缩小到能看见全局，用户主动放大看细节 |

### 1.5.3 节点数据结构

```ts
class RabbitholeNode {
  id: string;                      // crypto.randomUUID()
  images: string[];                // 关联图片（重叠瀑布流展示）
  contextualQuery: string;         // 生成该节点时用的上下文问题
  concept: string | null;          // 概念名（显示为 CONCEPT 徽标）
  question: string;                // 原始问题
  content: string;                 // AI 回答正文
  sources: Source[];               // 引用来源（带 favicon）
  parent: RabbitholeNode | null;
  children: RabbitholeNode[];
  followUpQuestions: FollowUpQuestion[];
  position: { x: number; y: number } | undefined;
  isLoading: boolean;
  failed: boolean;
}

class FollowUpQuestion {
  id: string;
  question: string;
  concept: string | null;
  referenceNode: RabbitholeNode;   // 指向被追问的节点
}
```

**关键点**：`followUpQuestions` 是**挂在节点上的追问**，不是全局聊天记录。每个卡片自带它的追问分支。

### 1.5.4 卡片节点的视觉规格

```tsx
// 卡片容器
<div className="relative shadow-md group card mx-auto bg-[#262626] max-w-[600px] rounded-[35px]"
     style={{ minWidth: '600px' }}>

  {/* 顶部：图片（重叠瀑布流，最多4张，重叠40px）+ 标题 */}
  <div className="px-[30px] pt-[30px]">
    {images?.length > 0 && <ImageStack maxHeight={150} overlap={40} maxImages={4} />}
    <h2 className="text-[20px] text-white font-medium mb-2 font-inter flex items-center gap-3">
      {concept || question}
      {concept && (
        <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-medium text-white/70">
          CONCEPT
        </span>
      )}
    </h2>
  </div>

  {/* 底部：正文 + 来源 + 追问按钮 */}
  <AskFollowUpButton />   {/* hover 才出现：opacity-0 group-hover:opacity-100 transition-opacity duration-300 */}
</div>
```

**视觉要点**：
- 圆角 **35px**（超大圆角，接近"药丸"感）—— 这是它视觉上"柔和"的关键
- 卡片底色 `#262626`，深于页面底色，浮起感靠 `shadow-md` 而非描边
- `CONCEPT` 徽标是 `bg-white/10` 的半透明小胶囊，标识"这是一个概念节点"
- **追问按钮 hover 才浮现**（`opacity-0 group-hover:opacity-100`）—— 保持画面干净，但可发现性仍在
- 来源用**域名 favicon 堆叠**（`flex -space-x-2`）+ "From N sources"，比数字列表更有说服力

### 1.5.5 追问输入气泡（丝滑的另一半）

```tsx
<div className="relative shadow-md rounded-[35px] p-[30px] bg-[#1a1a1a] border border-[#333]"
     style={{ minWidth: '450px' }}>
  <textarea
    ref={textareaRef}
    className="w-full bg-[#2a2a2a] text-[#bcbcb3] rounded-2xl p-4 min-h-[130px] resize-none
               border border-[#333] focus:outline-none focus:ring-1 focus:ring-accent/100
               focus:border-transparent overflow-hidden"
    placeholder="Type your follow-up question..."
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === 'Escape') onCancel();
    }}
  />
  <div className="grid grid-cols-2 gap-3 mt-4">
    <button className="... bg-[#2a2a2a] text-[#bcbcb3] hover:bg-[#333] border border-[#333]
                       transition-colors duration-200">Cancel</button>
    <button className="... bg-accent text-white hover:bg-accent/90 disabled:opacity-50
                       transition-colors duration-500 ease-in-out" disabled={!value.trim()}>Ask</button>
  </div>
</div>
```

**三个丝滑细节**：
1. **挂载即聚焦** —— `useEffect(() => ref.current?.focus(), [])`，打开就能打字，不用点一下
2. **高度自适应** —— `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'`，输入框随内容长高，永不出现内部滚动条
3. **Enter 提交 / Esc 取消** —— 键盘用户全程不用鼠标

### 1.5.6 路径高亮算法（最优雅的一处）

```ts
// 返回从 root 到该节点的所有祖先边 id
function getAncestorEdgeIds(nodeId: string): Set<string> {
  const ids = new Set<string>();
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return ids;

  let cur = nodeId;
  // 若该节点是追问节点，起点改为它引用的原节点
  if (node.type === 'followUpNode') {
    const edge = edges.find(e => e.target === nodeId);
    if (edge) cur = edge.source;
  }
  // 沿 edges 反向回溯，收集所有祖先边
  while (cur) {
    const edge = edges.find(e => e.target === cur);
    if (!edge) break;
    ids.add(edge.id);
    cur = edge.source;
  }
  return ids;
}

// 边的两态样式
const DEFAULT_EDGE   = { stroke: '#374151', strokeWidth: 2, transition: 'stroke 0.2s ease' };
const HIGHLIGHT_EDGE = { stroke: 'hsl(var(--accent))', strokeWidth: 2, transition: 'stroke 0.2s ease' };

// 悬停时：把祖先边标为高亮，其余保持默认
onNodeMouseEnter: (_, node) => {
  const ancestorIds = getAncestorEdgeIds(node.id);
  setEdges(edges.map(e => ({
    ...e,
    data: { ...e.data, isHighlighted: ancestorIds.has(e.id) },
  })));
}
onNodeMouseLeave: () => {
  setEdges(edges.map(e => ({ ...e, data: { ...e.data, isHighlighted: false } })));
}
```

**为什么这个设计好**：用户在一棵几十个节点的树里迷失时，**悬停任意节点，立刻看清"它是从哪条路来的"**。零学习成本，纯视觉反馈。而且 `transition: stroke 0.2s ease` 让高亮是"亮起来"而不是"跳变"，这才是丝滑的关键 —— **状态切换必须有过渡**。

### 1.5.7 节点生长动画

新节点出现时 React Flow 的 `animated: true` 属性让边做**流动虚线动画**（不是新节点本身动，而是边在"流动"，暗示数据正在传输）。

```ts
// 每条边都有 animated 标记，悬停时保留
edges.map(e => ({ ...e, animated: e.animated, data: { ...e.data, isHighlighted } }))
```

### 1.5.8 首页 → 探索页的转场

```tsx
// 首页卡片轮播的固定定位层
<div className="fixed inset-0 z-20 flex items-center justify-center
                b ? '' : 'hidden'
                g ? 'opacity-100 scale-100 blur-none'
                  : 'opacity-0 scale-75 blur-xl pointer-events-none'
                transition-all duration-700">
  {imageData.map((img, i) => (
    <div className="absolute w-[20vw] h-[...]" style={{ transform: `rotate(${rotationAngles[i]}deg)` }}>
      <img src={img.src} />
    </div>
  ))}
</div>

// 输入区
<div className={cn("relative ask-view flex justify-center items-center h-full",
                   g ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0",
                   "transition-all duration-700 ease-out")}>
```

**转场设计**：
1. 提交后，图片卡片**放大到中心并模糊**（`scale-100 blur-none`），输入框**下移淡出**（`translate-y-10 opacity-0`）
2. 时长 **700ms**，缓动 `ease-out` —— 慢到有仪式感，快到不拖沓
3. 图片带**随机旋转角度**（`rotationAngles`），像散落一桌的照片

这个"图片飞入 + 模糊转场"是它视觉记忆点之一，洋葱不需要照搬（我们没有图片轮播），但**转场的时长与缓动曲线值得直接采用**。

### 1.5.9 数据流

```
提问 → 生成 root 节点（concept + content + sources）
     → 画布渲染，自动 fitView
     → 卡片 hover 出现 "Ask Follow Up" 按钮
     → 点击 → 弹出自动聚焦的输入气泡
     → 提交 → 调用模型 → 生成新节点 + followUpQuestion 节点
     → ELK 重算布局 → 新节点从旁边生长出来
     → 2 秒后自动保存到 IndexedDB（debounced）
```

**关键**：`useEffect(() => { const t = setTimeout(save, 2000); return () => clearTimeout(t); }, [nodes])` —— 2 秒防抖自动保存，用户完全不用管持久化。

---

## 1.6 对洋葱的最终定位（v1.2）

| | Rabbithole | 知识洋葱 v1.2 |
|---|---|---|
| **主画布** | React Flow 无限画布 + ELK 布局 | **同样用 React Flow + ELK**（放弃自研径向布局） |
| **节点内容** | 卡片：概念 + 正文 + 来源 | 卡片：**概念 + 一句话本质 + 掌握度徽标** |
| **探索入口** | 卡片 hover 出现追问按钮 | **同样**：hover 出现「展开下一层」+「追问」 |
| **路径高亮** | 悬停高亮祖先边 | **同样**（这是丝滑的核心，必须抄） |
| **手势** | 滚轮平移、节点不可拖 | **同样** |
| **视角切换** | 无 | **我们的差异化：七视角** |
| **掌握度** | 无 | **我们的差异化：SM-2 + 缺口检测** |
| **模型** | 平台托管 | **我们的差异化：10 家自配 + 本地** |
| **数据** | 云端 + Public 分享 | **我们的差异化：纯本地** |

### 最终结论

**画布层直接对标 Rabbithole（用 React Flow + ELK + 路径高亮 + 悬停追问），知识管理层保持我们的差异化（七视角 + 掌握度 + 复习 + 缺口 + 本地 + 自配模型）。**

六层语义骨架从"画布布局"降级为"**节点的分类维度**"：
- 节点仍是卡片，但卡片带一个层级徽标（L1 构成 / L2 机理 / L3 边界…）
- 展开下一层 = 在当前节点旁生长出 L(n+1) 的子节点
- 同一层的节点用**层色**着色（靛蓝/青/琥珀/紫/品红），颜色恒定不变
- 这样既有了 Rabbithole 的自由探索感，又保留了我们"结构不跑偏"的骨架

**这是比 v1.1 更好的方案。** v1.1 我加了一个引导串面板 —— 那是在 Rabbithole 没做的方向上自己发明，风险高。v1.2 直接采用它已被验证的画布交互，把我们的差异化叠在上面。


## 2. Rabbithole 的真实产品机制（逆向所得）

### 2.1 界面与品牌

| 项 | 事实 |
|---|---|
| 主色 | 纯黑 `#000` / 深灰 `#1c1c1c`，文字白，描边 `var(--c-grayA3)` |
| 首页结构 | 居中单输入框（"Start your rabbithole"）+ 50px 兔子图标 + 底部图片卡轮播 |
| 提问框占位符 | 轮播的预设问题（如 "What is the Golden Record?"） |
| 卡片轮播 | 首页底部图片卡（loa / lunar / macintosh / renaissance / ww2 / golden_record），提交时以 20vw 尺寸缩放飞入 |
| 侧栏 | 汉堡按钮唤出，标题 "History"，含搜索框 "Search history..." |
| 历史项 | 每项含 `question` + `images` + `lastUpdated` |
| 登录 | Google 登录；免费 3 次/天，Pro $60/年 |
| 配额提示 | 顶栏胶囊按钮 hover 变形：默认显示 "N searches left"，hover 变绿显示 "Upgrade now" |
| 可见性 | Save / Public / Private 三选 |

### 2.2 核心机制：分支式引导问卷（关键发现）

这是 Rabbithole 真正的护城河。从 bundle 中还原出的完整模型：

```ts
// 交互元素类型
enum ElementType {
  Open = "open",                    // 开放式文本回答
  MultipleChoice = "multiple_choice",
  SingleChoice = "single_choice",
  Rating = "rating",                // NPS 0-10：detractors / passives / promoters
  Link = "link",
}

// 分支规则类型
enum BranchType {
  NextQuestion = "next_question",     // 顺次推进（索引 +1）
  End = "end",                        // 终止探索
  ResponseBased = "response_based",   // 按用户所选答案跳转
  SpecificQuestion = "specific_question", // 跳到指定题号
}

// 每个问题携带的分支配置
interface Branching {
  type: BranchType;
  index?: number;                              // specific_question 用
  responseValues?: Record<number, number>;    // response_based 用：选项索引 → 目标题号
}

interface Question {
  id: string;
  type: ElementType;
  text: string;
  choices?: string[];
  scale?: 3 | 5 | 7 | 10;
  branching?: Branching;
}

// 跳转决策函数（bundle 中的原逻辑）
function nextQuestionIndex(quiz, currentIndex, userResponse) {
  const q = quiz.questions[currentIndex];
  const fallback = currentIndex === quiz.questions.length - 1 ? End : currentIndex + 1;
  if (!q.branching?.type) return fallback;

  switch (q.branching.type) {
    case End: return End;
    case SpecificQuestion:
      return Number.isInteger(q.branching.index) ? q.branching.index : fallback;
    case ResponseBased:
      if (q.type === SingleChoice) {
        const choiceIdx = q.choices.indexOf(String(userResponse));
        const target = q.branching.responseValues?.[choiceIdx];
        return Number.isInteger(target) ? target : (target === End ? End : fallback);
      }
      if (q.type === Rating) {
        // 0-10 NPS 分档：0-6 detractors / 7-8 passives / 9-10 promoters
        const bucket = userResponse <= 6 ? 'detractors'
                     : userResponse <= 8 ? 'passives' : 'promoters';
        const target = q.branching.responseValues?.[bucket];
        return Number.isInteger(target) ? target : (target === End ? End : fallback);
      }
      return fallback;
    default: return fallback;
  }
}
```

**这意味着**：
1. 一次探索 = AI 预生成的一个**有向图**，不是聊天记录
2. 用户的**回答内容**决定路径 —— 选"技术原理"跳问题 2，选"历史影响"跳问题 4
3. 探索可以在任意节点 `End` 终止，也可由 `specific_question` 回跳补问
4. 支持**评分型问题**做满意度/理解度采集，并按分档跳转到不同后续

### 2.3 客观评价

| 优点 | 局限 |
|---|---|
| 交互有引导感，用户不会"问着问着不知道问啥" | 预生成整串 → 首次响应慢、token 消耗大 |
| 分支让内容与用户意图强相关 | 路径是**临时的**，关掉就没了，无法沉淀为长期知识资产 |
| 单选/评分让回答成本极低 | 只有"选哪个"，没有"我到底懂了没"的验证 |
| 视觉极简，聚焦内容 | 无掌握度、无复习、无缺口检测 |
| | 强依赖平台托管模型（Gemini / Sonar），用户无法自配 |
| | 需 Google 登录，数据在云端 |

---

## 3. 修订决策

### 3.1 吸收进来的（提升核心体验）

#### ✅ 决策 1：新增「引导串」模式 —— 洋葱的第四种呈现

**保留 Rabbithole 的分支问题串机制**，但让它的产物**落进洋葱树**。

```
用户输入一个宽泛问题（如"工业革命"）
  ↓
AI 生成一条 8-12 问的引导串，带 branching 规则
  ↓
用户逐题回答，回答决定跳转
  ↓
每个问题同时生成一个洋葱节点（含 essence + 七视角）
  ↓
最终得到一棵**有真实交互历史**的知识树
```

**这解决了洋葱原方案的最大短板**：原方案是"点开才生成"，用户面对空白画布不知道该点什么。引导串给了**第一条明确的路径**。

**数据契约**（新增 `src/domain/guided.ts`）：
```ts
export interface GuidedStep {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'rating' | 'open';
  choices?: string[];
  scale?: 3 | 5 | 7 | 10;
  /** 用户所选答案原文（open 时为文本） */
  response?: string;
  branching?: Branching;
  /** 本步骤生成的洋葱节点 */
  nodeId?: string;
  answeredAt?: number;
}
export interface GuidedSession {
  id: string;
  treeId: string;
  steps: GuidedStep[];
  cursor: number;          // 当前所在步骤索引
  status: 'active' | 'completed' | 'abandoned';
  startedAt: number;
}
```

**UI**：画布右侧（或独立 Tab）显示引导串面板，每步一张卡片，当前步高亮，已答步骤折叠为一行摘要。点击已答步骤可回看，也可**手动改答并重算后续路径**。

#### ✅ 决策 2：回答不只决定跳转，还决定掌握度

Rabbithole 的 `response_based` 分支本质上是"用户自述兴趣"。我们把这个信号**同时**喂给掌握度模型：

| 用户行为 | 掌握度影响 | 说明 |
|---|---|---|
| 选择某个选项 | 该选项关联节点 `score += 8` | 选中的分支 = 用户关心的部分 |
| 选择"我不了解 / 想跳过" | 该选项关联节点 `needsExpand = true` | 显式暴露知识缺口 |
| 评分题给出低分 | 当前节点 `score -= 15` | 自我评估不可靠，需外部验证 |
| 开放回答（非空） | 当前节点 `score += 5`，答案存为笔记卡 | 主动输出 = 强化记忆 |
| 走到 `End` | 未走到的分支标记 `needsExpand` | **没走的路 = 没学的东西** |

最后一条是 Rabbithole 没有的、但对我们极其有价值的能力：**一次探索的"未走路径"天然就是一张待学清单**。

#### ✅ 决策 3：借鉴其"选择即路径"的低成本交互

在洋葱的七视角之外，增加一种特殊视角：**「自测」**（已在原方案中，此处强化为分支式）。

#### ✅ 决策 4：借鉴其极简的首页输入

原方案的首页是三 Tab（播种/树列表/复习队列）。改为 Rabbithole 式的**单一输入框居中**，输入框下方一行三个建议词。树列表与复习队列收进侧栏。这降低了首次使用门槛。

#### ✅ 决策 5：借鉴其配额提示的视觉技巧

顶栏胶囊按钮 hover 变形（显示剩余次数 → hover 变为升级入口）。我们对应实现为：**今日剩余展开次数**，hover 显示预估 token 消耗。

### 3.2 坚决不吸收的

| Rabbithole 的做法 | 不吸收的原因 |
|---|---|
| 预生成整条问题串 | 成本高、首响应慢、且违背洋葱"按需生成"的核心。我们改为**逐步生成**：答完一题才生成下一题（滑动窗口，一次只多生成 2 问备选） |
| Google 账号登录 | 洋葱坚持本地优先，零登录。历史靠本地 IndexedDB + 导出文件 |
| 平台托管模型 | 洋葱的核心差异化就是用户自配 Key（含本地 Ollama），这是我们对抗云端产品的护城河 |
| Public 分享 | 保留但降级为可选功能，且默认 Private，分享时强制提示"将包含你的笔记" |
| 数据在云端 | 洋葱全部本地。分享走导出文件，不经过我们的服务器 |
| 只有"选了哪个"没有"懂了没" | 这是洋葱必须补上的：掌握度 + SM-2 复习 + 缺口检测，这是我们超越它的地方 |

---

## 4. 修订后的产品结构

```
洋葱（主产品）
├─ 探索模式【新增 · Rabbithole 核心】
│   └─ 引导串：AI 生成分支问题串，答完落成知识树
│      ├─ 逐步生成（滑动窗口，不预生成全串）
│      ├─ 回答决定路径 + 掌握度双效
│      └─ 未走分支 → 待补全清单
│
├─ 洋葱模式【原有 · 我们的核心】
│   └─ 六层同心环 + 七视角 + 钻取
│
├─ 知识管理【原有 · 我们的护城河】
│   ├─ 掌握度三态 + 分数
│   ├─ SM-2 间隔重复 + 今日复习
│   ├─ 缺口检测（结构缺陷 + 显式暴露 + 未走路径）
│   ├─ 跨树关联 / 桥接节点
│   └─ 导出 Markdown / Anki / JSON
│
└─ 模型配置【原有 · 对抗云端的关键】
    └─ 10 家厂商 + 本地 Ollama，Key 加密存本机
```

### 两个模式如何共存

**共享同一棵树**。这是关键设计：

- 探索模式生成的每个步骤 → 落为一个节点（通常在 L0/L1）
- 用户在引导串里可以随时「钻入洋葱」查看该节点的完整七视角
- 也可以在洋葱里点开任意节点，进入「追问」视角，答案可固化回引导串
- 引导串本身也作为一棵树节点挂在根节点下（层 L4「关联」）

这样 Rabbithole 的"会话"变成了我们的"树的生成路径"，而不是两套东西。

---

## 5. 新增功能清单

| # | 功能 | 优先级 | 说明 |
|---|---|---|---|
| N1 | **引导串生成** | P0 | 给定宽泛问题，AI 生成分支问题串（带 branching 规则），逐步生成 |
| N2 | **分支答案渲染** | P0 | 单选/多选/评分/开放四种交互，评分支持 3/5/7/10 量表 |
| N3 | **路径决策引擎** | P0 | 按 branching 规则计算下一跳，含 responseValues 与 NPS 分档 |
| N4 | **回答 → 掌握度映射** | P0 | 见 §3.1 决策 2 的映射表 |
| N5 | **未走路径 → 待补全** | P0 | 会话结束时，未到达的分支节点标记 needsExpand |
| N6 | **引导串面板 UI** | P0 | 画布右侧可折叠面板，当前步高亮，已答折叠，可回看改答 |
| N7 | **单输入框首页** | P0 | 借鉴 Rabbithole 的极简首页 |
| N8 | **建议词轮播** | P1 | 输入框占位符轮播预设问题 |
| N9 | **改答重算路径** | P1 | 修改历史答案后，重新计算后续路径并更新待补全 |
| N10 | **探索导入为树** | P1 | 把一次外部探索（粘贴的问答串）解析为洋葱节点 |
| N11 | **剩余额度提示** | P1 | 顶栏显示今日剩余展开次数，hover 显示预估 token |
| N12 | **探索摘要卡片** | P2 | 会话结束生成"你这次学到了什么"的可分享卡片 |

---

## 6. 对既有文档的影响

| 文档 | 需要修改 |
|---|---|
| `00-产品方案与架构总纲.md` | 新增 §3.5「探索模式」；功能清单加 N1–N12；闭环图增加"探索"入口 |
| `01-AI引擎与多模型适配规范.md` | 新增 `prompts/guided.ts` 引导串 Prompt；新增 `parseGuidedQuiz` JSON 契约 |
| `02-UI设计规范.md` | 新增引导串面板规格；首页改单输入框；新增四种答案组件规格 |
| `04-落地交接文档-HANDOFF.md` | PR-3 后插入 PR-3.5「引导串」；E2E 增加引导串路径测试 |
| `05-数据模型与接口契约.md` | 新增 `GuidedStep` / `GuidedSession` / `Branching` 类型；Dexie 新增 `guided` 表 |
| `prototype/index.html` | 增加引导串面板与分支演示（可作为 PR-3.5 的视觉参考） |

---

## 7. 修订后的 Prompt 契约

### 7.1 引导串生成 Prompt

```ts
// src/engine/prompts/guided.ts
export function buildGuidedPrompt(topic: string, depth: 'shallow'|'deep' = 'shallow'): ChatMessage[] {
  return [
    { role: 'system', content: `你是一个知识探索向导。你的任务是设计一条**有分支的引导问题串**，通过用户的回答逐步收敛到他们真正关心的方向。

严格输出 JSON：
{
  "title": "本次探索的主题",
  "steps": [
    {
      "question": "问题文本",
      "type": "single_choice",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "branching": {
        "type": "response_based",
        "responseValues": { "0": 2, "1": 5, "2": 3, "3": 7 }
      },
      "createsNode": { "title": "本步骤要生成的知识点名", "essence": "一句话本质" }
    }
  ],
  "tail": { "question": "收尾问题", "type": "open", "branching": { "type": "end" } }
}

规则：
1. steps 数量为 5-9，最后一步必须是 open 类型且 branching.type 为 "end"。
2. 每个步骤的 branching 必须是 next_question / response_based / specific_question 之一。
3. response_based 的 responseValues 必须把每个选项索引映射到一个合法的步骤索引，且不能指向自己。
4. 必须存在至少 2 个 response_based 步骤，保证路径真的分叉。
5. 每个步骤的 createsNode.title 不得重复。
6. 问题要用简体中文，具体、可回答，避免"你想了解什么"这类空问题。
7. branching 指向的索引必须在 steps 范围内。

只输出 JSON。` },
    { role: 'user', content: `探索主题：${topic}\n深度：${depth === 'shallow' ? '广度优先，给出 5-7 个方向性分支' : '深度优先，给出 8-9 个递进式问题'}` },
  ];
}
```

### 7.2 引导串 JSON 解析容错

复用 `parseLooseJSON`，但**额外做语义校验**（这是新增的硬要求，因为分支索引错乱会导致死循环）：

```ts
export function validateGuidedQuiz(quiz: unknown): GuidedQuiz | null {
  const q = quiz as GuidedQuiz;
  if (!q?.steps?.length) return null;

  // 1. 索引越界检查
  for (const s of q.steps) {
    const b = s.branching;
    if (!b) continue;
    if (b.type === 'specific_question' && (!Number.isInteger(b.index) || b.index < 0 || b.index >= q.steps.length)) {
      b.type = 'next_question';           // 降级
    }
    if (b.type === 'response_based' && b.responseValues) {
      for (const k of Object.keys(b.responseValues)) {
        const v = b.responseValues[k];
        if (!Number.isInteger(v) || v < 0 || v >= q.steps.length || v === q.steps.indexOf(s)) {
          delete b.responseValues[k];      // 删掉非法映射
        }
      }
      if (Object.keys(b.responseValues).length === 0) b.type = 'next_question';
    }
  }

  // 2. 环检测：沿路径走一遍，最多 steps.length * 2 步，超出即有环
  // 3. 可达性检查：从 step 0 出发走不到所有 step → 补一条兜底 next_question 边
  // 4. 最后一步必须能终止
  return q;
}
```

**死循环是分支问卷最大的线上风险**，这条校验必须实现。

---

## 8. 修订后的时间表

原计划 15 天，插入 PR-3.5（引导串，3 天）→ **18 天**。

| PR | 内容 | 增量 |
|---|---|---|
| PR-3.5 | **引导串生成 + 分支引擎 + 面板 UI** | **+3 天** |
| PR-6.5 | 回答→掌握度映射 + 未走路径清单 | +1 天 |

**总计 19 天**（3 周半）。PR-3.5 与 PR-4 可并行，仍可压到 3 周。

---

## 9. 一句话总结这次修订

> Rabbithole 告诉我们**引导比结构更重要** —— 用户不知道该问什么，是因为没人给他一条路。
> 洋葱的六层骨架保证了结构不跑偏，但**"第一步往哪走"始终是空的**。
> 补上引导串，洋葱从"一棵等着被点开的树"变成"一个会带着你走的向导"。
> 而 Rabbithole 缺的那一半 —— 掌握度、复习、缺口、长期沉淀 —— 正是洋葱已有的。

---

*修订版本 v1.1 ｜ 基于 2026-10-30 对 rabbithole.chat 的生产环境逆向分析*
