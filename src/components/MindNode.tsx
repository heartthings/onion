import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import type { KNode, Side } from '../types';
import { paintOf } from '../theme';
import { NODE_W, ROOT_W } from '../layout';

export type MindNodeData = {
  node: KNode;
  side: Side | 'root';
  selected: boolean;
  onPath: boolean;
  hiddenCount: number;
  onToggle: (id: string) => void;
  onPeek: (id: string) => void;
  onExpand: (id: string) => void;
};

export type MindFlowNode = Node<MindNodeData, 'mind'>;

function MasteryDot({ node }: { node: KNode }) {
  if (node.needsReview || node.mastery === 'lost') {
    return <span className="ml-1 inline-block size-2 translate-y-[-1px] rounded-full bg-rose-500" title="还要再看" />;
  }
  if (node.mastery === 'fuzzy') {
    return <span className="ml-1 inline-block size-2 translate-y-[-1px] rounded-full bg-amber-500" title="模糊" />;
  }
  if (node.mastery === 'got') {
    return <span className="ml-1 inline-block size-2 translate-y-[-1px] rounded-full bg-emerald-500" title="懂了" />;
  }
  return null;
}

function Handles() {
  return (
    <>
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="l" type="source" position={Position.Left} />
      <Handle id="tl" type="target" position={Position.Left} />
      <Handle id="tr" type="target" position={Position.Right} />
    </>
  );
}

function CardCopy({ summary, detail, light }: { summary?: string; detail?: string; light?: boolean }) {
  if (!summary?.trim() && !detail?.trim()) return null;
  const tone = light ? 'text-white/75 [&_strong]:text-white' : 'text-muted [&_strong]:text-ink';
  return (
    <div className={clsx('mt-2 space-y-2 text-[13px] leading-relaxed', tone)}>
      {summary?.trim() && <p className="whitespace-pre-wrap">{summary}</p>}
      {detail?.trim() && (
        <div
          className={clsx(
            'space-y-1.5 border-t pt-2 text-[12.5px] [&_h2]:mt-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_ul]:my-1',
            light ? 'border-white/15 [&_h2]:text-white' : 'border-line [&_h2]:text-ink',
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function weakRing(node: KNode): string | undefined {
  if (node.needsReview || node.mastery === 'lost') return '#e11d48';
  if (node.mastery === 'fuzzy') return '#d97706';
  return undefined;
}

function RootCard({ node, selected, hiddenCount, onPeek, onExpand }: MindNodeData) {
  const loading = node.status === 'loading';
  const ring = weakRing(node);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={{ width: ROOT_W, ...(ring ? { outline: `3px solid ${ring}`, outlineOffset: 3 } : {}) }}
      className={clsx(
        'root-card relative overflow-hidden rounded-[26px] px-6 py-5 shadow-[0_18px_40px_-18px_rgba(28,31,38,0.55)] transition-shadow',
        selected && 'ring-4 ring-onion/35',
        loading && 'shimmer shimmer-dark',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-onion/25 blur-2xl" />
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-onion">
        <span className="size-1.5 rounded-full bg-onion" />
        核心知识
      </div>
      <div className="font-serif text-[21px] leading-snug font-semibold">
        {node.title}
        <MasteryDot node={node} />
      </div>
      <CardCopy summary={node.summary} detail={node.detail} light />
      {loading && (
        <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-white/60">
          <Loader2 className="size-3.5 animate-spin" />
          AI 正在拆解这个知识点…
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPeek(node.id);
          }}
          className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/80 hover:bg-white/15"
        >
          还有 {hiddenCount} 个
        </button>
      )}
      {!loading && !node.expanded && (
        <button
          type="button"
          title="散开这个知识点"
          onClick={(e) => {
            e.stopPropagation();
            onExpand(node.id);
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/25"
        >
          <Plus className="size-3.5" />
          {node.status === 'error' ? '再试一次' : '散开'}
        </button>
      )}
      <Handles />
    </motion.div>
  );
}

function ChildCard({ node, side, selected, onPath, hiddenCount, onToggle, onPeek, onExpand }: MindNodeData) {
  const c = paintOf(node);
  const ring = weakRing(node);
  const mine = node.origin === 'user';
  const loading = node.status === 'loading';
  const failed = node.status === 'error';
  const count = node.childIds.length;
  const outer = side === 'left' ? 'left' : 'right';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={{
        width: NODE_W,
        ...(selected ? { borderColor: c.stroke, boxShadow: `0 0 0 3px ${c.stroke}22, 0 12px 28px -14px ${c.stroke}66` } : {}),
        ...(ring ? { outline: `2px solid ${ring}`, outlineOffset: 2 } : {}),
      }}
      className={clsx(
        'group relative rounded-2xl border bg-card/95 px-4 py-3 transition-[box-shadow,border-color,transform] duration-200',
        'shadow-[0_1px_2px_rgba(28,31,38,0.04),0_8px_20px_-14px_rgba(28,31,38,0.25)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_rgba(28,31,38,0.35)]',
        onPath && !selected ? 'border-transparent' : 'border-line',
        mine && 'border-dashed',
      )}
    >
      {loading && <div className="shimmer pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" />}

      <div
        className={clsx('absolute top-3 bottom-3 w-[3px] rounded-full', outer === 'right' ? 'left-0' : 'right-0')}
        style={{ background: c.stroke, opacity: node.depth === 1 ? 1 : 0.55 }}
      />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {mine && (
            <div className="mb-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide" style={{ background: c.soft, color: c.text }}>
              我写的
            </div>
          )}
          <div className="pr-4 text-[14.5px] leading-snug font-semibold text-ink">
            {node.title}
            {node.favorite && <span className="ml-1 inline-block size-1.5 translate-y-[-1px] rounded-full bg-onion" title="已收藏" />}
            <MasteryDot node={node} />
          </div>
          <CardCopy summary={node.summary} detail={node.detail} />
        </div>
      </div>

      {loading ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: c.text }}>
          <Loader2 className="size-3 animate-spin" /> 正在散开…
        </div>
      ) : failed ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-rose-600">
          <AlertCircle className="size-3" /> 散开失败，点击重试
        </div>
      ) : !node.expanded ? (
        <div
          className="mt-2 flex h-0 items-center gap-1 overflow-hidden text-[11.5px] font-medium opacity-0 transition-all duration-200 group-hover:h-4 group-hover:opacity-100"
          style={{ color: c.text }}
        >
          <Sparkles className="size-3" /> 点加号继续散开
        </div>
      ) : null}

      {hiddenCount > 0 && (
        <button
          type="button"
          title="这些是按价值排在后面的，点开查看"
          onClick={(e) => {
            e.stopPropagation();
            onPeek(node.id);
          }}
          className="mt-2 inline-flex items-center rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink"
        >
          还有 {hiddenCount} 个
        </button>
      )}

      {count > 0 && (
        <button
          type="button"
          title={node.collapsed ? '展开分支' : '收起分支'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className={clsx(
            'absolute top-1/2 z-10 flex h-[22px] min-w-[22px] -translate-y-1/2 items-center justify-center rounded-full border-2 px-1 text-[11px] font-semibold transition-transform hover:scale-110',
            outer === 'right' ? '-right-[11px]' : '-left-[11px]',
          )}
          style={
            node.collapsed
              ? { background: c.stroke, borderColor: c.stroke, color: '#fff' }
              : { background: 'var(--color-card)', borderColor: c.stroke, color: c.text }
          }
        >
          {node.collapsed ? count : <span className="block h-[2px] w-2 rounded bg-current" />}
        </button>
      )}

      {!node.expanded && !loading && (
        <button
          type="button"
          title={failed ? '散开失败，再试一次' : '散开这个知识点'}
          onClick={(e) => {
            e.stopPropagation();
            onExpand(node.id);
          }}
          className={clsx(
            'absolute top-1/2 z-10 flex size-[22px] -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm transition hover:scale-110',
            outer === 'right' ? '-right-[11px]' : '-left-[11px]',
          )}
          style={{ borderColor: c.stroke, color: c.stroke }}
        >
          <Plus className="size-3" />
        </button>
      )}

      <Handles />
    </motion.div>
  );
}

export const MindNodeView = memo(function MindNodeView({ data }: NodeProps<MindFlowNode>) {
  return data.side === 'root' ? <RootCard {...data} /> : <ChildCard {...data} />;
});
