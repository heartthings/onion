import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, PanelLeftOpen, RefreshCw, TriangleAlert } from 'lucide-react';
import { useStore } from '../store';
import { expandNode } from '../actions';
import { isConfigured } from '../ai';
import { BRANCH_COLORS } from '../theme';
import { loadTopics, topicsFetchedAt } from '../topics';
import type { Topic } from '../types';
import { GITHUB_URL, GithubLink, GithubMark, IconButton, Logo, ThemeButton } from './ui';
import { LearnGuide } from './LearnGuide';

const FALLBACK: Topic[] = ['Transformer 注意力机制', '通货膨胀', '光合作用', '纳什均衡', '量子纠缠', '贝叶斯定理'].map(
  (title) => ({ title, blurb: '', kind: 'featured' as const }),
);

const KIND_COLOR = { featured: '#e0913f', history: '#6366f1', reading: '#0d9488' };
const KIND_LABEL = { featured: '今日精选', history: '历史上的今天', reading: '正在被阅读' };

function TopicRail({ onPick }: { onPick: (title: string) => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const pull = (force = false) => {
    setSpinning(true);
    loadTopics(force)
      .then((items) => {
        setTopics(items);
        if (force) setCursor(0);
      })
      .finally(() => {
        topicsFetchedAt().then(setFetchedAt);
        setSpinning(false);
      });
  };

  useEffect(() => {
    pull(false);
    const timer = window.setInterval(() => pull(true), 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const source = topics.length ? topics : FALLBACK;
  useEffect(() => {
    if (source.length <= 4) return;
    const timer = window.setInterval(() => setCursor((c) => (c + 1) % source.length), 4200);
    return () => window.clearInterval(timer);
  }, [source.length, topics.length]);

  const shown = Array.from({ length: Math.min(4, source.length) }, (_, i) => source[(cursor + i) % source.length]);
  const stamp = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center justify-center gap-2 text-[12px] text-faint">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative size-1.5 rounded-full bg-emerald-500" />
        </span>
        大家正在了解{stamp ? ` · ${stamp} 更新` : ''}
        <button type="button" title="重新获取" onClick={() => pull(true)} className="rounded-md p-1 hover:bg-ink/5 hover:text-ink">
          <RefreshCw className={spinning ? 'size-3 animate-spin' : 'size-3'} />
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <AnimatePresence mode="popLayout">
          {shown.map((topic) => (
            <motion.button
              layout
              key={topic.title}
              type="button"
              title={topic.blurb || undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              onClick={() => onPick(topic.title)}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card/80 px-3.5 py-1.5 text-[12.5px] text-muted backdrop-blur transition hover:-translate-y-px hover:bg-card hover:text-ink hover:shadow-sm"
            >
              <span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[topic.kind] }} />
              <span className="text-[10px] tracking-wide text-faint">{KIND_LABEL[topic.kind]}</span>
              {topic.title}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Home() {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const createMap = useStore((s) => s.createMap);
  const settings = useStore((s) => s.settings);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  useEffect(() => ref.current?.focus(), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const start = (topic: string) => {
    const t = topic.trim();
    if (!t) return;
    const { mapId, rootId } = createMap(t);
    void expandNode(mapId, rootId);
  };

  return (
    <div className="paper-grid relative flex h-full justify-center overflow-y-auto px-6">
      <div className="home-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      {!sidebarOpen && (
        <IconButton title="打开侧栏" onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 border border-line bg-card/80">
          <PanelLeftOpen className="size-4" />
        </IconButton>
      )}
      {!sidebarOpen && (
        <div className="absolute top-4 right-4 flex items-center gap-1 rounded-xl border border-line bg-card/80 p-1">
          <GithubLink />
          <ThemeButton />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto w-full max-w-[720px] py-16"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Hero />
          <h1 className="mt-6 font-serif text-[38px] leading-tight font-semibold tracking-tight text-ink">
            把一个知识点，散开成一张地图
          </h1>
          <p className="mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-muted">
            输入任何你想弄懂的概念，AI 会把它拆成若干子知识点。点卡片只是打开它，点旁边的加号，它才继续向下散开。
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition hover:text-ink"
          >
            <GithubMark className="size-4" />
            GitHub · heartthings
          </a>
        </div>

        <div className="rounded-[28px] border border-line bg-card p-2 shadow-[0_24px_60px_-30px_rgba(28,31,38,0.35)] transition focus-within:border-onion/50 focus-within:shadow-[0_24px_60px_-28px_rgba(224,145,63,0.45)]">
          <div className="flex items-end gap-2 pl-4">
            <textarea
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  start(value);
                }
              }}
              placeholder="想弄懂什么？例如：区块链、凯恩斯主义、CRISPR…"
              className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent py-3.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-faint"
            />
            <button
              type="button"
              disabled={!value.trim()}
              onClick={() => start(value)}
              className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-inverse text-on-inverse transition hover:opacity-90 disabled:opacity-40"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
        </div>

        <TopicRail onPick={start} />
        <LearnGuide />

        {!isConfigured(settings) && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="demo-banner mx-auto mt-8 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-[12.5px] text-amber-800 transition hover:bg-amber-50"
          >
            <TriangleAlert className="size-4" />
            当前是演示模式，生成的是占位内容。配置一个模型 Key 即可获得真实解析 →
          </button>
        )}
      </motion.div>
    </div>
  );
}

/** 首页的小插图：一个核心向两侧散开的思维导图 */
function Hero() {
  const left = [-38, -13, 13, 38];
  return (
    <div className="relative flex items-center">
      <svg width="260" height="96" viewBox="0 0 260 96" className="absolute left-1/2 -translate-x-1/2" fill="none">
        {left.map((dy, i) => (
          <g key={i}>
            <motion.path
              d={`M150 48 C 185 48, 185 ${48 + dy}, 220 ${48 + dy}`}
              stroke={BRANCH_COLORS[i].stroke}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ delay: 0.25 + i * 0.08, duration: 0.6 }}
            />
            <motion.path
              d={`M110 48 C 75 48, 75 ${48 - dy}, 40 ${48 - dy}`}
              stroke={BRANCH_COLORS[i + 4].stroke}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
            />
            <motion.circle
              cx="226"
              cy={48 + dy}
              r="5"
              fill={BRANCH_COLORS[i].stroke}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7 + i * 0.08, type: 'spring' }}
            />
            <motion.circle
              cx="34"
              cy={48 - dy}
              r="5"
              fill={BRANCH_COLORS[i + 4].stroke}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.75 + i * 0.08, type: 'spring' }}
            />
          </g>
        ))}
      </svg>
      <div className="relative rounded-[18px] bg-card p-2 shadow-[0_10px_30px_-12px_rgba(28,31,38,0.35)]">
        <Logo size={40} />
      </div>
    </div>
  );
}
