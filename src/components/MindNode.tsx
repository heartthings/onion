import { memo, useEffect, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { AlertCircle, BookOpenText, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { isRealSense } from '../ai';
import { expandNode } from '../actions';
import { useStore } from '../store';
import type { KMap, KNode, Sense, Side } from '../types';
import { paintOf } from '../theme';
import { NODE_W, ROOT_W } from '../layout';

export type MindNodeData = {
  node: KNode;
  side: Side | 'root';
  selected: boolean;
  onPath: boolean;
  hiddenCount: number;
  mapId: string;
  onToggle: (id: string) => void;
  onPeek: (id: string) => void;
  onExpand: (id: string) => void;
};

export type MindFlowNode = Node<MindNodeData, 'mind'>;

const MASTERY: { key: 'got' | 'fuzzy' | 'lost'; label: string; on: string; dot: string }[] = [
  { key: 'got', label: '懂了', on: 'border-transparent bg-emerald-500 text-white shadow-[0_6px_14px_-8px_rgba(16,185,129,0.9)]', dot: 'bg-emerald-500' },
  { key: 'fuzzy', label: '模糊', on: 'border-transparent bg-amber-500 text-white shadow-[0_6px_14px_-8px_rgba(245,158,11,0.9)]', dot: 'bg-amber-500' },
  { key: 'lost', label: '不会', on: 'border-transparent bg-rose-500 text-white shadow-[0_6px_14px_-8px_rgba(244,63,94,0.9)]', dot: 'bg-rose-500' },
];

function MasteryRail({ node, mapId, light }: { node: KNode; mapId: string; light?: boolean }) {
  const setMastery = useStore((s) => s.setMastery);
  const idle = light
    ? 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
    : 'border-line bg-paper text-muted hover:border-transparent hover:text-ink';
  return (
    <div
      className="nodrag nopan flex shrink-0 flex-col gap-1"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {MASTERY.map((item) => {
        const selected = node.mastery === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setMastery(mapId, node.id, item.key)}
            className={clsx(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium tracking-wide transition',
              selected ? item.on : idle,
            )}
          >
            <span className={clsx('size-1.5 rounded-full', selected ? 'bg-white' : item.dot)} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
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

function CardCopy({ summary, light }: { summary?: string; light?: boolean }) {
  if (!summary?.trim()) return null;
  const tone = light ? 'text-white/75 [&_strong]:text-white' : 'text-muted [&_strong]:text-ink';
  return (
    <div className={clsx('mt-2 text-[13px] leading-relaxed', tone)}>
      <p className="whitespace-pre-wrap">{summary}</p>
    </div>
  );
}

function ExplainedMark({ node, light }: { node: KNode; light?: boolean }) {
  const streaming = useStore((s) => s.streamingId === node.id);
  const ready = Boolean(node.detail?.trim());
  if (!streaming && !ready) return null;
  return (
    <div
      className={clsx(
        'mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        light ? 'border-white/25 bg-white/10 text-white/90' : 'border-onion/30 bg-onion/10 text-onion-deep',
      )}
    >
      {streaming ? <Loader2 className="size-3 animate-spin" /> : <BookOpenText className="size-3" />}
      {streaming ? '正在解读' : '已解读'}
    </div>
  );
}

function NodeTools({ node, mapId, hiddenCount, onPeek, onExpand, light }: Pick<MindNodeData, 'node' | 'mapId' | 'hiddenCount' | 'onPeek' | 'onExpand'> & { light?: boolean }) {
  const addRequest = useStore((s) => s.addRequest);
  const addUserChild = useStore((s) => s.addUserChild);
  const deleteNode = useStore((s) => s.deleteNode);
  const startCompare = useStore((s) => s.startCompare);
  const comparePick = useStore((s) => s.comparePick);
  const requestFocus = useStore((s) => s.requestFocus);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const loading = node.status === 'loading';
  const isRoot = node.parentId === null;

  useEffect(() => {
    if (addRequest?.mapId === mapId && addRequest.nodeId === node.id) setComposing(true);
  }, [addRequest, mapId, node.id]);

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const chip = light
    ? 'border-white/20 bg-white/10 text-white/85 hover:bg-white/20'
    : 'border-line bg-paper text-muted hover:text-ink';

  return (
    <div className="nodrag nopan mt-3" onClick={stop} onDoubleClick={stop}>
      <div className="flex flex-wrap gap-1">
        {!loading && !node.expanded && (
          <button type="button" onClick={() => onExpand(node.id)} className={clsx('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px]', chip)}>
            <Plus className="size-3" /> {node.status === 'error' ? '再试一次' : '散开'}
          </button>
        )}
        {hiddenCount > 0 && (
          <button type="button" onClick={() => onPeek(node.id)} className={clsx('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px]', chip)}>
            下一批 {hiddenCount}
          </button>
        )}
        {node.expanded && !loading && (
          <button type="button" onClick={() => void expandNode(mapId, node.id, { more: true })} className={clsx('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px]', chip)}>
            再找一批
          </button>
        )}
        {node.expanded && !loading && (
          <button
            type="button"
            onClick={() => {
              if (node.childIds.length === 0 || confirm('重新生成会换掉现在这些相关信息，继续吗？')) {
                void expandNode(mapId, node.id, { replace: true });
              }
            }}
            className={clsx('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px]', chip)}
          >
            <RefreshCw className="size-3" /> 重来
          </button>
        )}
        <button type="button" onClick={() => setComposing((open) => !open)} className={clsx('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px]', chip)}>
          我写
        </button>
        <button
          type="button"
          onClick={() => startCompare(node.id)}
          className={clsx('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px]', chip, comparePick === node.id && 'border-onion')}
        >
          {comparePick === node.id ? '再点一个' : '对比'}
        </button>
        {!isRoot && (
          <button
            type="button"
            title="删除这个分支"
            onClick={() => {
              if (confirm(`删除「${node.title}」和它下面的分支？`)) deleteNode(mapId, node.id);
            }}
            className={clsx('inline-flex h-7 items-center rounded-full border px-2 text-[12px]', chip)}
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {composing && (
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const title = draft.trim();
            if (!title) return;
            const created = addUserChild(mapId, node.id, { title, summary: '' });
            setDraft('');
            setComposing(false);
            if (created) requestFocus(mapId, [created]);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setComposing(false);
            }}
            placeholder="写一条你自己的相关信息"
            className={clsx(
              'h-8 min-w-0 flex-1 rounded-lg border px-2 text-[12.5px] outline-none',
              light ? 'border-white/20 bg-white/10 text-white placeholder:text-white/40' : 'border-[#1d4ed8] bg-card text-ink',
            )}
          />
        </form>
      )}
    </div>
  );
}

function forkSense(map: KMap, next: Sense) {
  const pool = [map.sense, ...(map.alternatives ?? [])].filter((item): item is Sense => Boolean(item));
  const alternatives = pool.filter((item) => item.kind !== next.kind || item.gloss !== next.gloss);
  const { mapId, rootId } = useStore.getState().createMap(map.title, {
    sense: next,
    ...(alternatives.length ? { alternatives } : {}),
  });
  void expandNode(mapId, rootId);
}

function SenseBar({ mapId }: { mapId: string }) {
  const map = useStore((s) => s.maps[mapId]);
  const sense = map?.sense && isRealSense(map.sense) ? map.sense : undefined;
  const others = (map?.alternatives ?? []).filter(isRealSense);
  if (!sense && !others.length) return null;
  return (
    <div className="nodrag nopan mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      {sense && (
        <span title={sense.kind} className="max-w-full truncate rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[12px] text-white/90">
          {sense.gloss}
        </span>
      )}
      {others.map((alt) => (
        <button
          key={`${alt.kind}-${alt.gloss}`}
          type="button"
          title={alt.gloss}
          onClick={() => forkSense(map, alt)}
          className="max-w-full truncate text-[12px] text-white/70 underline-offset-2 hover:text-white hover:underline"
        >
          {`换成：${alt.gloss}`}
        </button>
      ))}
    </div>
  );
}

function weakRing(node: KNode): string | undefined {
  if (node.needsReview || node.mastery === 'lost') return '#e11d48';
  if (node.mastery === 'fuzzy') return '#d97706';
  return undefined;
}

function RootCard({ node, selected, hiddenCount, mapId, onPeek, onExpand }: MindNodeData) {
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
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-onion">
            <span className="size-1.5 rounded-full bg-onion" />
            核心知识
          </div>
          <div className="font-serif text-[21px] leading-snug font-semibold">{node.title}</div>
          <SenseBar mapId={mapId} />
          <CardCopy summary={node.summary} light />
          <ExplainedMark node={node} light />
          {loading && (
            <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-white/60">
              <Loader2 className="size-3.5 animate-spin" />
              AI 正在拆解这个知识点…
            </div>
          )}
          <NodeTools node={node} mapId={mapId} hiddenCount={hiddenCount} onPeek={onPeek} onExpand={onExpand} light />
        </div>
        <MasteryRail node={node} mapId={mapId} light />
      </div>
      <Handles />
    </motion.div>
  );
}

function ChildCard({ node, side, selected, onPath, hiddenCount, mapId, onToggle, onPeek, onExpand }: MindNodeData) {
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

      <div className="flex items-start gap-2.5">
        {side === 'left' && <MasteryRail node={node} mapId={mapId} />}
        <div className="min-w-0 flex-1">
          {mine && (
            <div className="mb-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide" style={{ background: c.soft, color: c.text }}>
              我写的
            </div>
          )}
          <div className="text-[14.5px] leading-snug font-semibold text-ink">
            {node.title}
            {node.favorite && <span className="ml-1 inline-block size-1.5 translate-y-[-1px] rounded-full bg-onion" title="已收藏" />}
          </div>
          <CardCopy summary={node.summary} />
          <ExplainedMark node={node} />
        </div>
        {side === 'right' && <MasteryRail node={node} mapId={mapId} />}
      </div>

      {loading ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: c.text }}>
          <Loader2 className="size-3 animate-spin" /> 正在散开…
        </div>
      ) : failed ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-rose-600">
          <AlertCircle className="size-3" /> 散开失败，点「再试一次」
        </div>
      ) : null}

      <NodeTools node={node} mapId={mapId} hiddenCount={hiddenCount} onPeek={onPeek} onExpand={onExpand} />

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

      <Handles />
    </motion.div>
  );
}

export const MindNodeView = memo(function MindNodeView({ data }: NodeProps<MindFlowNode>) {
  return data.side === 'root' ? <RootCard {...data} /> : <ChildCard {...data} />;
});
