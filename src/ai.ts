import type { ChildDraft, KNode, QuizQuestion, Settings } from './types';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  noKey?: boolean;
  hint?: string;
}

export const PROVIDERS: ProviderPreset[] = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2-turbo-preview' },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5' },
  { id: 'doubao', name: '豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', hint: '模型处填写推理接入点 ID（ep- 开头）' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'ollama', name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:8b', noKey: true, hint: '需先 ollama pull 对应模型' },
  { id: 'custom', name: '自定义', baseUrl: '', model: '', hint: '任意 OpenAI 兼容接口' },
];

export function isConfigured(s: Settings): boolean {
  const preset = PROVIDERS.find((p) => p.id === s.providerId);
  return Boolean(s.baseUrl.trim() && s.model.trim() && (s.apiKey.trim() || preset?.noKey));
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function endpoint(s: Settings) {
  return `${s.baseUrl.trim().replace(/\/+$/, '')}/chat/completions`;
}

function requestBody(s: Settings, messages: Message[], extra: Record<string, unknown>) {
  const body: Record<string, unknown> = { model: s.model.trim(), messages, ...extra };
  if (s.providerId === 'qwen') body.enable_thinking = false;
  return body;
}

async function describeError(res: Response): Promise<string> {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message ?? j?.message ?? JSON.stringify(j);
  } catch {
    detail = res.statusText;
  }
  if (res.status === 401 || res.status === 403) return `API Key 无效或无权限（${res.status}）`;
  if (res.status === 429) return '请求太频繁或额度不足（429），稍后再试或换个模型';
  if (res.status === 404) return `接口或模型不存在（404）：${detail}`;
  return `请求失败（${res.status}）：${detail}`;
}

async function post(s: Settings, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(endpoint(s), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s.apiKey.trim() ? { Authorization: `Bearer ${s.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('网络请求失败：请检查 Base URL，或该厂商不允许浏览器直连（CORS）');
  }
  if (!res.ok) throw new Error(await describeError(res));
  return res;
}

async function chat(s: Settings, messages: Message[], signal?: AbortSignal): Promise<string> {
  const res = await post(s, requestBody(s, messages, { temperature: 0.6, stream: false }), signal);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? '';
}

async function* chatStream(s: Settings, messages: Message[], signal?: AbortSignal): AsyncGenerator<string> {
  const res = await post(s, requestBody(s, messages, { temperature: 0.7, stream: true }), signal);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 半包或心跳行，忽略
      }
    }
  }
}

function parseLooseJSON(raw: string): unknown {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const slice = text.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        return null;
      }
    }
  }
}

/** 一次拆解最多收下的子节点。界面只先画出其中价值最高的若干个。 */
export const POOL_SIZE = 12;

const EXPAND_SYSTEM = `你是一位擅长构建知识地图的导师。用户正在用思维导图学习，你要把指定节点拆成下一级子知识点，并按学习价值排序。

只输出 JSON，不要任何额外文字。格式：
{"summary":"对当前节点的一句话概括","children":[{"title":"子知识点名称","summary":"一句话说明","value":85}]}

规则：
1. title 简洁，2-14 个字，名词性短语，不带序号和标点。
2. summary 20-50 字，能独立读懂，说清它是什么、为什么对理解当前节点重要。
3. 子知识点互不重叠，只拆当前节点，不要跳回上级话题。结合整条知识路径理解语境。
4. value 是 0 到 100 的整数，表示「不先弄懂它，就很难真正理解当前节点」的程度。
   - 80 以上：定义、组成、核心机制这类必经之路。
   - 50–79：能明显加深理解的例子、边界、易混概念、典型应用。
   - 50 以下：有价值但可以后学的延伸、花絮、冷僻分支。
5. children 必须按 value 从高到低排列。最该先学的放第一个。
6. 尽量把有学习价值的方向列全，上限 12 个。方向确实不多时可以少给。不要为了凑数编造，不要把同一个概念换个说法再写一遍。
7. 你列不完世界上所有相关知识。目标是：一个认真的初学者沿着前几个节点走，就能抓住这个知识点；其余是值得之后再看的。
8. 使用简体中文，专有名词可保留原文。`;

export interface ExpandResult {
  summary?: string;
  children: ChildDraft[];
}

export async function generateChildren(
  s: Settings,
  opts: { path: KNode[]; existing: string[]; count: number; hint?: string },
  signal?: AbortSignal,
): Promise<ExpandResult> {
  const { path, existing, count, hint } = opts;
  if (!isConfigured(s)) return demoChildren(path, existing, count, hint);

  const node = path[path.length - 1];
  const user = [
    `根主题：${path[0].title}`,
    `知识路径：${path.map((n) => n.title).join(' → ')}`,
    `当前要拆解的节点：${node.title}${node.summary ? `（${node.summary}）` : ''}`,
    existing.length ? `它已有这些子节点，不要重复：${existing.join('、')}` : '',
    hint ? `用户希望这次重点覆盖的方向：${hint}。仍然要按价值排序，并保留这个方向之外、同样重要的节点。` : '',
    `请给出最多 ${POOL_SIZE} 个子知识点，按 value 从高到低排列。`,
    `界面只会先展示价值最高的 ${count} 个，其余收进「更多」，所以不要只写 ${count} 个。`,
  ]
    .filter(Boolean)
    .join('\n');

  const messages: Message[] = [
    { role: 'system', content: EXPAND_SYSTEM },
    { role: 'user', content: user },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chat(s, messages, signal);
    const parsed = parseLooseJSON(raw) as { summary?: unknown; children?: unknown } | unknown[] | null;
    const list = Array.isArray(parsed) ? parsed : (parsed as { children?: unknown })?.children;
    if (Array.isArray(list)) {
      const seen = new Set(existing.map((t) => t.trim()));
      const children: ChildDraft[] = [];
      for (const item of list as Array<Record<string, unknown>>) {
        const title = String(item?.title ?? '').trim().replace(/^[\d.、\s]+/, '');
        if (!title || seen.has(title)) continue;
        seen.add(title);
        const rawValue = Number(item?.value);
        const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, Math.round(rawValue))) : 0;
        children.push({ title, summary: String(item?.summary ?? '').trim(), value });
      }
      if (children.length) {
        children.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        const ranked = children.slice(0, POOL_SIZE).map((child, index) => ({ ...child, hidden: index >= count }));
        const summary = Array.isArray(parsed) ? undefined : (parsed as { summary?: unknown })?.summary;
        return { summary: typeof summary === 'string' ? summary.trim() : undefined, children: ranked };
      }
    }
  }
  throw new Error('模型返回的内容无法解析，请重试或换一个模型');
}

const EXPLAIN_SYSTEM = `你是一位耐心、严谨的导师，正在帮助学生理解思维导图中的一个知识点。请输出 Markdown，结构如下（不要使用一级标题）：

## 一句话理解
## 核心讲解
## 关键要点
（3-5 条列表）
## 举个例子
## 常见误区
## 继续追问
（给出 3 个值得继续深入的问题，用列表）

要求：结合知识路径理解语境；表述准确，不确定的地方明确说明；可以用公式（行内代码表示）和对比表格；全文 500-900 字，简体中文。`;

export async function* explainNode(s: Settings, path: KNode[], signal?: AbortSignal): AsyncGenerator<string> {
  if (!isConfigured(s)) {
    yield* demoExplain(path);
    return;
  }
  const node = path[path.length - 1];
  const user = [
    `根主题：${path[0].title}`,
    `知识路径：${path.map((n) => n.title).join(' → ')}`,
    `请讲解：${node.title}${node.summary ? `（${node.summary}）` : ''}`,
  ].join('\n');
  yield* chatStream(
    s,
    [
      { role: 'system', content: EXPLAIN_SYSTEM },
      { role: 'user', content: user },
    ],
    signal,
  );
}

export async function testConnection(s: Settings): Promise<{ ok: boolean; message: string }> {
  const started = performance.now();
  try {
    const res = await post(s, requestBody(s, [{ role: 'user', content: '只回复两个字母：OK' }], { max_tokens: 8, stream: false }));
    await res.json();
    return { ok: true, message: `连接成功 · ${Math.round(performance.now() - started)} ms` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

const QUIZ_SYSTEM = `你是命题老师。只输出 JSON，不要其他文字。
格式：{"questions":[{"question":"题干","options":["A","B","C","D"],"answer":0,"why":"一句话解析"}]}
规则：正好 3 题；每题 4 个选项；answer 是正确选项的下标（0-3）；题目只考给定知识点，不要跑题；简体中文。`;

export async function generateQuiz(s: Settings, path: KNode[]): Promise<QuizQuestion[]> {
  const node = path[path.length - 1];
  if (!isConfigured(s)) {
    await sleep(400);
    return demoQuiz(node.title);
  }
  const raw = await chat(s, [
    { role: 'system', content: QUIZ_SYSTEM },
    {
      role: 'user',
      content: `知识路径：${path.map((item) => item.title).join(' → ')}\n知识点：${node.title}\n${node.summary ? `概括：${node.summary}` : ''}`,
    },
  ]);
  const parsed = parseLooseJSON(raw) as { questions?: QuizQuestion[] } | null;
  const list = parsed?.questions?.filter((item) => item?.question && item.options?.length === 4 && item.answer >= 0 && item.answer < 4);
  if (!list?.length) throw new Error('题目解析失败，请重试');
  return list.slice(0, 3);
}

const COMPARE_SYSTEM = `你在帮一个学习者对比两个知识点。只输出 Markdown，结构固定为：

## 相同点
## 不同点
## 建议先学哪个

各用 2-4 条列表。不要空话，简体中文。`;

export async function generateCompare(s: Settings, a: KNode, b: KNode): Promise<string> {
  if (!isConfigured(s)) {
    await sleep(400);
    return `## 相同点\n\n- 演示模式：两者都会在配置模型后得到真实对比\n\n## 不同点\n\n- 「${a.title}」和「${b.title}」是两个不同的节点\n\n## 建议先学哪个\n\n- 先学你更模糊的那一个`;
  }
  return chat(s, [
    { role: 'system', content: COMPARE_SYSTEM },
    { role: 'user', content: `A：${a.title}。${a.summary}\nB：${b.title}。${b.summary}` },
  ]);
}

function demoQuiz(title: string): QuizQuestion[] {
  return [
    {
      question: `「${title}」在这张图里首先是什么？`,
      options: ['一个可以继续拆开的知识点', '一段必须背下来的聊天记录', '一个和主题无关的标签', '一张已经学完的证书'],
      answer: 0,
      why: '演示题。配置模型后，题目会针对这个知识点本身来出。',
    },
    {
      question: '答错之后，这个节点应该怎么处理？',
      options: ['标成还要再看，并进入复习', '直接删掉', '当成已经掌握', '不再显示'],
      answer: 0,
      why: '答错会把节点标成还要再看。',
    },
    {
      question: '下面哪种用法更接近这个工具？',
      options: ['点开一个点，再往下散开', '一次生成一整本教材', '只保留最后一条回答', '把所有节点合成一段话'],
      answer: 0,
      why: '学习发生在你选择继续拆开的那个节点上。',
    },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEMO_ROOT = ['核心定义', '历史与起源', '关键组成', '运作原理', '典型应用', '局限与争议', '相关概念', '前沿进展'];
const DEMO_DEEP = ['基本含义', '关键要素', '具体例子', '内在机制', '常见误区', '与其他概念的联系', '进一步探索', '实践方法'];

async function demoChildren(path: KNode[], existing: string[], count: number, hint?: string): Promise<ExpandResult> {
  await sleep(650 + Math.random() * 500);
  const node = path[path.length - 1];
  const pool = node.parentId === null ? DEMO_ROOT : DEMO_DEEP;
  const name = node.title.length > 8 ? node.title.slice(0, 8) + '…' : node.title;
  const children: ChildDraft[] = [];
  let value = 92;
  for (const t of pool) {
    const title = node.parentId === null ? t : `${name}的${t}`;
    if (existing.includes(title)) continue;
    children.push({
      title: hint ? `${title}（${hint}）` : title,
      summary: `演示数据：配置模型后，这里会是 AI 对「${node.title}」这一方面的真实解析。`,
      value,
    });
    value -= 7;
  }
  return {
    summary: node.summary ? undefined : '演示模式下的根知识点。配置模型后会得到真实概括。',
    children: children.map((child, index) => ({ ...child, hidden: index >= count })),
  };
}

async function* demoExplain(path: KNode[]): AsyncGenerator<string> {
  const node = path[path.length - 1];
  const text = `## 一句话理解\n\n这是**演示模式**下「${node.title}」的占位讲解。\n\n## 核心讲解\n\n在左下角或侧栏底部打开「模型设置」，填入任意 OpenAI 兼容接口的 Key（例如 DeepSeek、通义千问、Kimi），这里就会流式生成真实的深度讲解。\n\n## 关键要点\n\n- 知识路径：${path.map((n) => n.title).join(' → ')}\n- 讲解会结合整条路径理解语境\n- 生成后自动保存在本机\n\n## 继续追问\n\n- 它和相邻概念的区别是什么？\n- 它在什么情况下不成立？\n- 有哪些经典例子？\n`;
  for (let i = 0; i < text.length; i += 6) {
    await sleep(16);
    yield text.slice(i, i + 6);
  }
}
