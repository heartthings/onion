import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import {
  BookOpenText,
  ChevronRight,
  CornerDownLeft,
  Loader2,
  NotebookPen,
  RefreshCw,
  PenLine,
  Sparkles,
  Square,
  Star,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { getPath, useStore } from '../store';
import { expandNode, explain, openNext, sproutQuestion, stopExplain } from '../actions';
import { splitFollowUps } from '../srs';
import { paintOf } from '../theme';
import { IconButton } from './ui';
import { MarkedProse } from './MarkedProse';
import { QuizBox } from './QuizBox';

type Tab = 'explain' | 'note';

export function DetailPanel({ mapId }: { mapId: string }) {
  const map = useStore((s) => s.maps[mapId]);
  const selectedId = useStore((s) => s.selectedId);
  const node = selectedId ? map.nodes[selectedId] : undefined;

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key="detail"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="absolute top-[78px] right-4 bottom-4 z-20 flex w-[min(420px,calc(100%-2rem))] flex-col overflow-hidden rounded-[28px] border border-line bg-card/92 shadow-[0_30px_60px_-30px_rgba(28,31,38,0.45)] backdrop-blur-2xl"
        >
          <PanelBody mapId={mapId} nodeId={node.id} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelBody({ mapId, nodeId }: { mapId: string; nodeId: string }) {
  const map = useStore((s) => s.maps[mapId]);
  const node = map.nodes[nodeId];
  const streamingId = useStore((s) => s.streamingId);
  const selectNode = useStore((s) => s.selectNode);
  const requestFocus = useStore((s) => s.requestFocus);
  const updateNode = useStore((s) => s.updateNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const setMastery = useStore((s) => s.setMastery);
  const startCompare = useStore((s) => s.startCompare);
  const comparePick = useStore((s) => s.comparePick);
  const addHighlight = useStore((s) => s.addHighlight);
  const removeHighlight = useStore((s) => s.removeHighlight);
  const highlights = useStore((s) => s.highlights);
  const quotes = highlights.filter((h) => h.nodeId === nodeId);
  const addUserChild = useStore((s) => s.addUserChild);
  const revealNode = useStore((s) => s.revealNode);
  const addRequest = useStore((s) => s.addRequest);
  const childCount = useStore((s) => s.settings.childCount);
  const [tab, setTab] = useState<Tab>('explain');
  const [hint, setHint] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHint('');
    setAdding(false);
    setDraftTitle('');
    setDraftSummary('');
  }, [nodeId]);

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setSummary(node.summary);
  }, [nodeId, node?.title, node?.summary]);

  useEffect(() => {
    if (!addRequest || addRequest.nodeId !== nodeId) return;
    setAdding(true);
    const t = window.setTimeout(() => draftRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [addRequest, nodeId]);

  if (!node) return null;
  const path = getPath(map, nodeId);
  const c = paintOf(node);
  const isRoot = node.parentId === null;
  const mine = node.origin === 'user';
  const loading = node.status === 'loading';
  const streaming = streamingId === nodeId;
  const allChildren = node.childIds.map((id) => map.nodes[id]).filter(Boolean);
  const children = allChildren.filter((child) => !child.hidden);
  const hidden = allChildren.filter((child) => child.hidden);

  const commitText = () => {
    const nextTitle = title.trim();
    if (nextTitle && nextTitle !== node.title) updateNode(mapId, nodeId, { title: nextTitle });
    else setTitle(node.title);
    if (summary.trim() !== node.summary) updateNode(mapId, nodeId, { summary: summary.trim() });
  };

  const submitOwn = () => {
    const created = addUserChild(mapId, nodeId, { title: draftTitle, summary: draftSummary });
    if (!created) return;
    setDraftTitle('');
    setDraftSummary('');
    setAdding(false);
    selectNode(created);
    requestFocus(mapId, [created]);
  };

  const goto = (id: string) => {
    selectNode(id);
    requestFocus(mapId, [id]);
  };

  const submitHint = () => {
    const h = hint.trim();
    if (!h || loading) return;
    setHint('');
    void expandNode(mapId, nodeId, { hint: h });
  };

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="thin-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-[12px] whitespace-nowrap text-faint">
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="flex items-center gap-0.5">
              <button type="button" onClick={() => goto(p.id)} className="max-w-[120px] truncate rounded-md px-1 py-0.5 hover:bg-ink/5 hover:text-ink">
                {p.title}
              </button>
              <ChevronRight className="size-3 shrink-0" />
            </span>
          ))}
          <span className="truncate px-1 font-medium text-muted">{node.title}</span>
        </div>
        <IconButton title={node.favorite ? '取消收藏' : '收藏这个知识点'} onClick={() => toggleFavorite(mapId, nodeId)}>
          <Star className={node.favorite ? 'size-4 fill-onion text-onion' : 'size-4'} />
        </IconButton>
        <IconButton title="关闭" onClick={() => selectNode(null)}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-6 pt-3 pb-6">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: c.soft, color: c.text }}
          >
            {mine ? '我写的' : isRoot ? '核心知识' : `第 ${node.depth} 级`}
          </span>
          {children.length > 0 && <span className="text-[11.5px] text-faint">{children.length} 个子知识点</span>}
          {hidden.length > 0 && <span className="text-[11.5px] text-faint">还有 {hidden.length} 个收起</span>}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitText}
          className="w-full bg-transparent font-serif text-[25px] leading-tight font-semibold text-ink outline-none"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={commitText}
          rows={2}
          placeholder="补一句你自己的理解，或改掉 AI 写的概括"
          className="mt-2 w-full resize-none bg-transparent text-[14px] leading-relaxed text-muted outline-none placeholder:text-faint"
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(
            [
              ['got', '懂了'],
              ['fuzzy', '模糊'],
              ['lost', '不会'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMastery(mapId, nodeId, key)}
              className={clsx(
                'h-8 rounded-full border px-3 text-[12.5px] transition',
                node.mastery === key ? 'border-ink bg-inverse text-on-inverse' : 'border-line text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => startCompare(nodeId)}
            className="h-8 rounded-full border border-line px-3 text-[12.5px] text-muted hover:text-ink"
          >
            {comparePick === nodeId ? '再点一个节点' : '和另一个对比'}
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => (hidden.length ? openNext(mapId, nodeId) : void expandNode(mapId, nodeId, node.expanded ? { more: true } : {}))}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-inverse text-[13px] font-medium text-on-inverse transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? '正在散开…' : hidden.length ? `打开下一批（${Math.min(hidden.length, childCount)}）` : node.expanded ? '让 AI 再找一批' : '散开子知识点'}
          </button>
          {node.expanded && (
            <button
              type="button"
              disabled={loading}
              title="删除现有子节点并重新生成"
              onClick={() => {
                if (allChildren.length === 0 || confirm('重新生成会删除现有的子知识点（含收起的和其下所有分支），继续吗？')) {
                  void expandNode(mapId, nodeId, { replace: true });
                }
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] text-muted transition hover:bg-ink/5 disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" /> 重新生成
            </button>
          )}
          {!isRoot && (
            <IconButton
              title="删除这个分支"
              className="size-9 border border-line hover:!bg-rose-50 hover:!text-rose-600"
              onClick={() => {
                if (confirm(`删除「${node.title}」及其下所有分支？`)) deleteNode(mapId, nodeId);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-paper/60 py-1 pr-1 pl-3 focus-within:border-onion/60 focus-within:bg-card">
          <Wand2 className="size-3.5 shrink-0 text-faint" />
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submitHint()}
            placeholder="按你关心的方向散开，如「历史背景」「数学推导」"
            className="h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          <IconButton title="按此方向散开" disabled={!hint.trim() || loading} onClick={submitHint} className="size-7">
            <CornerDownLeft className="size-3.5" />
          </IconButton>
        </div>

        <div className="mt-3">
          {adding ? (
            <div className="rounded-2xl border border-dashed p-3" style={{ borderColor: '#1d4ed8' }}>
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-[#1d4ed8]">我写的节点 · 蓝色</div>
              <input
                ref={draftRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitOwn();
                  if (e.key === 'Escape') setAdding(false);
                }}
                placeholder="节点名称"
                className="h-9 w-full rounded-xl border border-line bg-paper/60 px-3 text-[13.5px] outline-none focus:border-[#1d4ed8]"
              />
              <textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                placeholder="一句说明，可以空着"
                rows={2}
                className="mt-2 w-full resize-none rounded-xl border border-line bg-paper/60 px-3 py-2 text-[13px] outline-none focus:border-[#1d4ed8]"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAdding(false)} className="h-8 rounded-lg px-3 text-[12.5px] text-muted hover:bg-ink/5">
                  取消
                </button>
                <button
                  type="button"
                  disabled={!draftTitle.trim()}
                  onClick={submitOwn}
                  className="h-8 rounded-lg bg-[#1d4ed8] px-3 text-[12.5px] font-medium text-white disabled:opacity-40"
                >
                  加到图上
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1d4ed8] hover:underline"
            >
              <PenLine className="size-3.5" /> 我来写一个
            </button>
          )}
        </div>

        {hidden.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted">按价值排在后面，先不铺开</span>
              <button type="button" onClick={() => openNext(mapId, nodeId)} className="text-[12px] font-medium text-ink hover:underline">
                打开下一批
              </button>
            </div>
            <ul className="space-y-1">
              {hidden.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => {
                      revealNode(mapId, child.id);
                      selectNode(child.id);
                      requestFocus(mapId, [child.id]);
                    }}
                    className="flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-ink/5"
                  >
                    <span className="w-7 shrink-0 font-mono text-[11px] text-faint">{child.value ?? '—'}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink">{child.title}</span>
                      {child.summary && <span className="line-clamp-1 text-[11.5px] text-faint">{child.summary}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={loading}
              onClick={() => void expandNode(mapId, nodeId, { more: true })}
              className="mt-2 text-[12px] text-faint hover:text-ink disabled:opacity-50"
            >
              这些不够，让 AI 再找一批
            </button>
          </div>
        )}

        {children.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[11.5px] font-medium tracking-wide text-faint">子知识点</div>
            <div className="flex flex-wrap gap-1.5">
              {children.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => goto(ch.id)}
                  className="rounded-lg border border-line bg-card px-2.5 py-1 text-[12.5px] text-muted transition hover:-translate-y-px hover:shadow-sm"
                  style={{ borderLeft: `3px solid ${paintOf(ch).stroke}` }}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-1 border-b border-line">
          {(
            [
              ['explain', '深度讲解', BookOpenText],
              ['note', '我的笔记', NotebookPen],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] transition',
                tab === key ? 'border-onion font-medium text-ink' : 'border-transparent text-faint hover:text-muted',
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {key === 'note' && node.note?.trim() && <span className="size-1.5 rounded-full bg-onion" />}
            </button>
          ))}
        </div>

        {tab === 'explain' ? (
          <div className="pt-4">
            {node.detail ? (
              <>
                <MarkedProse
                  text={streaming ? node.detail : splitFollowUps(node.detail).body}
                  quotes={quotes}
                  onHighlight={(quote) => addHighlight(mapId, nodeId, quote)}
                  onRemove={removeHighlight}
                />
                {!streaming && splitFollowUps(node.detail).questions.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[12px] font-medium text-faint">继续追问 · 点一下就在旁边散开</div>
                    <div className="space-y-1.5">
                      {splitFollowUps(node.detail).questions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => void sproutQuestion(mapId, nodeId, question)}
                          className="block w-full rounded-xl border border-line bg-paper/50 px-3 py-2 text-left text-[13px] text-ink transition hover:border-onion/50"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <QuizBox mapId={mapId} nodeId={nodeId} />
                <div className="mt-4 flex justify-end">
                  {streaming ? (
                    <button type="button" onClick={stopExplain} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] text-muted hover:bg-ink/5">
                      <Square className="size-3" /> 停止
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void explain(mapId, nodeId)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] text-muted hover:bg-ink/5"
                    >
                      <RefreshCw className="size-3" /> 重新讲解
                    </button>
                  )}
                </div>
              </>
            ) : streaming ? (
              <div className="flex items-center gap-2 py-6 text-[13px] text-faint">
                <Loader2 className="size-4 animate-spin" /> 正在组织讲解…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void explain(mapId, nodeId)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-left transition hover:border-onion/60 hover:bg-onion/[0.04]"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-onion/10 text-onion-deep transition group-hover:scale-105">
                  <BookOpenText className="size-5" />
                </div>
                <div>
                  <div className="text-[13.5px] font-medium text-ink">生成深度讲解</div>
                  <div className="text-[12px] text-faint">核心解释、要点、例子、误区与继续追问</div>
                </div>
              </button>
            )}
          </div>
        ) : (
          <textarea
            value={node.note ?? ''}
            onChange={(e) => updateNode(mapId, nodeId, { note: e.target.value })}
            placeholder="写下你的理解、疑问或联想……自动保存在本机"
            className="mt-4 min-h-[220px] w-full resize-y rounded-2xl border border-line bg-paper/50 p-4 text-[13.5px] leading-relaxed outline-none placeholder:text-faint focus:border-onion/60 focus:bg-card"
          />
        )}
      </div>

      <div className="border-t border-line px-6 py-2.5 text-[11px] text-faint">AI 生成内容仅供参考，重要结论请核实来源</div>
    </>
  );
}
