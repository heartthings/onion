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

const EXPAND_SYSTEM = `你在画一张知识地图。用户点开一个知识点，你要散开的是围绕它的相关信息，按价值排序，让人看清这个知识点的边界在哪里。

只输出 JSON，不要任何额外文字。格式：
{"summary":"一句话：它是什么，以及它到哪里就不再是它","children":[{"title":"一条相关信息的名字","summary":"它和当前节点是什么关系，边界画在哪里","value":85}]}

规则：
1. 每个 child 是一条独立的相关信息：一个相邻概念、一个前提、一个后果、一个成立条件、一个易混对象、一个它到此为止的限制，或一块紧挨着的领域。title 用这个信息自己的名字，2-18 个字，名词或判断，不带序号。
2. 不要把同一个知识点拆成课文栏目。禁止用这些当 title：核心定义、基本含义、关键要素、关键组成、具体例子、举个例子、常见误区、内在机制、运作原理、关键要点、一句话理解、进一步探索、实践方法、历史与起源、典型应用。例子、要素、误区如果值得说，必须写成具体的那条信息，而不是栏目名。
3. summary 25-70 字。写清这条信息和当前节点的关系：它划出了哪一段边界，或者它为什么紧挨着。
4. 子节点互不重叠。结合整条知识路径理解语境，不要跳回去重复上级节点。
5. value 是 0 到 100 的整数，表示这条信息对看清边界有多关键。
   - 80 以上：不看它，就会把边界画错。最近的邻居、它成立的条件、它明确不是什么。
   - 50–79：能把版图补完整的相关事实、后果、相邻领域。
   - 50 以下：更远、但仍相关的信息。
6. children 按 value 从高到低。尽量把划边界所需要的相关信息列全，上限 12 条。不够 12 条就少给。不要换个说法重复，不要为了凑数编造。
7. 使用简体中文，专有名词可保留原文。`;

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
    `请给出最多 ${POOL_SIZE} 条相关信息，按 value 从高到低排列。每条都要能帮人看清「${node.title}」的边界，不要输出课文栏目。`,
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
        if (!title || seen.has(title) || OUTLINE_TITLE.test(title)) continue;
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

const EXPLAIN_SYSTEM = `你在讲解思维导图上的一个知识点。目标不是把它拆成「定义、要素、例子、误区」几个栏目，而是讲清它是什么，以及它的边界画在哪里。请输出 Markdown，不要使用一级标题，结构固定为：

## 它是什么
用两三句话写它实际主张的内容。
## 边界在哪里
写它包含到哪里、从哪里开始就不再是它。点出紧挨着、但不是它的信息。
## 相关信息
3-6 条列表。每一条是一条独立的相关信息，用它自己的名字开头，不要用「例子」「要素」「误区」当条目标题。
## 继续追问
3 条列表。每条是一个可以再散开的具体问题或相邻知识点，不要写成「举个例子」「有哪些误区」。

要求：结合知识路径理解语境；不确定就直说；可以用公式（行内代码）和对比。全文 400-800 字，简体中文。`;

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

const OUTLINE_TITLE = /^(核心定义|基本含义|基本概念|关键要素|关键组成|关键要点|具体例子|举个例子|常见误区|内在机制|运作原理|一句话理解|核心讲解|进一步探索|实践方法|历史与起源|典型应用|相关概念|前沿进展)$/;

function demoRelated(name: string): string[] {
  const short = name.length > 8 ? `${name.slice(0, 8)}…` : name;
  return [
    `${short}成立的条件`,
    `${short}到此为止的地方`,
    `紧挨着${short}、但不是它`,
    `${short}依赖的前提`,
    `${short}带来的后果`,
    `常被当成${short}的东西`,
    `${short}走不通的情况`,
    `${short}旁边的另一条路`,
  ];
}

async function demoChildren(path: KNode[], existing: string[], count: number, hint?: string): Promise<ExpandResult> {
  await sleep(650 + Math.random() * 500);
  const node = path[path.length - 1];
  const pool = demoRelated(node.title);
  const children: ChildDraft[] = [];
  let value = 92;
  for (const title of pool) {
    if (existing.includes(title)) continue;
    children.push({
      title: hint ? `${title}（${hint}）` : title,
      summary: `演示数据：这是围着「${node.title}」的一条相关信息，用来标出它的边界。配置模型后会换成真实内容。`,
      value,
    });
    value -= 7;
  }
  return {
    summary: node.summary ? undefined : '演示模式。配置模型后，这里会写清它是什么，以及它到哪里就不再是它。',
    children: children.map((child, index) => ({ ...child, hidden: index >= count })),
  };
}

async function* demoExplain(path: KNode[]): AsyncGenerator<string> {
  const node = path[path.length - 1];
  const text = `## 它是什么\n\n这是**演示模式**下「${node.title}」的占位说明。配置模型后，这里会写它实际主张的内容。\n\n## 边界在哪里\n\n它的边界要由旁边那些相关信息来画，而不是再拆成定义、要素和例子。路径：${path.map((n) => n.title).join(' → ')}。\n\n## 相关信息\n\n- 它成立时依赖什么\n- 从哪里开始就不再是它\n- 哪条信息紧挨着它、但属于另一件事\n\n## 继续追问\n\n- ${node.title}成立还需要哪一个前提？\n- 哪一块知识和它挨着、却已经越界？\n- 它往外走一步，首先碰到什么？\n`;
  for (let i = 0; i < text.length; i += 6) {
    await sleep(16);
    yield text.slice(i, i + 6);
  }
}
