import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { BookOpenText, ChevronRight, ListChecks, Loader2, NotebookPen, RefreshCw, Square, Star, X } from 'lucide-react';
import { getPath, useStore } from '../store';
import { explain, sproutQuestion, stopExplain } from '../actions';
import { splitFollowUps } from '../srs';
import { IconButton } from './ui';
import { MarkedProse } from './MarkedProse';
import { QuizBox } from './QuizBox';
import { ChatBox } from './ChatBox';

type Tab = 'explain' | 'note' | 'quiz';

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
          className="absolute top-[78px] right-4 bottom-4 z-20 flex w-[min(420px,calc(100%-2rem))] flex-col overflow-hidden rounded-[28px] border border-line bg-card/92 shadow-[0_30px_60px_-30px_rgba(28,31,38,0.45)] backdrop-blur-2xl max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:right-0 max-md:bottom-0 max-md:h-[min(78dvh,760px)] max-md:w-full max-md:rounded-b-none max-md:pb-[env(safe-area-inset-bottom)]"
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
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const addHighlight = useStore((s) => s.addHighlight);
  const removeHighlight = useStore((s) => s.removeHighlight);
  const highlights = useStore((s) => s.highlights);
  const quotes = highlights.filter((item) => item.nodeId === nodeId);
  const [tab, setTab] = useState<Tab>('explain');

  if (!node) return null;
  const path = getPath(map, nodeId);
  const streaming = streamingId === nodeId;
  const follow = node.detail && !streaming ? splitFollowUps(node.detail) : { body: node.detail ?? '', questions: [] as string[] };

  const goto = (id: string) => {
    selectNode(id);
    requestFocus(mapId, [id]);
  };

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="thin-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-[12px] whitespace-nowrap text-faint">
          {path.slice(0, -1).map((item) => (
            <span key={item.id} className="flex items-center gap-0.5">
              <button type="button" onClick={() => goto(item.id)} className="max-w-[120px] truncate rounded-md px-1 py-0.5 hover:bg-ink/5 hover:text-ink">
                {item.title}
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

      <div className="px-4 pt-3 sm:px-6">
        <h2 className="font-serif text-[20px] leading-tight font-semibold text-ink sm:text-[24px]">{node.title}</h2>
        <div className="mt-4 flex items-center gap-1 border-b border-line">
          {(
            [
              ['explain', '深度解读', BookOpenText],
              ['note', '笔记', NotebookPen],
              ['quiz', '答题', ListChecks],
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
              {key === 'explain' && node.detail?.trim() && <span className="size-1.5 rounded-full bg-onion" title="已有深度解读" />}
              {key === 'note' && node.note?.trim() && <span className="size-1.5 rounded-full bg-onion" />}
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-4 pt-4 pb-6 sm:px-6">
        {tab === 'explain' && (
          <div>
            {node.detail ? (
              <>
                <MarkedProse
                  text={follow.body}
                  quotes={quotes}
                  onHighlight={(quote) => addHighlight(mapId, nodeId, quote)}
                  onRemove={removeHighlight}
                />
                {!streaming && follow.questions.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[12px] font-medium text-faint">继续追问 · 点一下就在旁边散开</div>
                    <div className="space-y-1.5">
                      {follow.questions.map((question) => (
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
                <div className="mt-4 flex justify-end">
                  {streaming ? (
                    <button type="button" onClick={stopExplain} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] text-muted hover:bg-ink/5">
                      <Square className="size-3" /> 停止
                    </button>
                  ) : (
                    <button type="button" onClick={() => void explain(mapId, nodeId)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] text-muted hover:bg-ink/5">
                      <RefreshCw className="size-3" /> 重新解读
                    </button>
                  )}
                </div>
                <ChatBox mapId={mapId} nodeId={nodeId} />
              </>
            ) : streaming ? (
              <div className="flex items-center gap-2 py-6 text-[13px] text-faint">
                <Loader2 className="size-4 animate-spin" /> 正在组织解读…
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
                  <div className="text-[13.5px] font-medium text-ink">和 AI 把这个点讲透</div>
                  <div className="text-[12px] text-faint">它是什么，边界在哪里，还可以继续追问</div>
                </div>
              </button>
            )}
          </div>
        )}

        {tab === 'note' && (
          <textarea
            value={node.note ?? ''}
            onChange={(event) => updateNode(mapId, nodeId, { note: event.target.value })}
            placeholder="写下你的理解、疑问或联想。只存在这台设备上。"
            className="min-h-[280px] w-full resize-y rounded-2xl border border-line bg-paper/50 p-4 text-[13.5px] leading-relaxed outline-none placeholder:text-faint focus:border-onion/60 focus:bg-card"
          />
        )}

        {tab === 'quiz' && <QuizBox mapId={mapId} nodeId={nodeId} />}
      </div>

      <div className="border-t border-line px-4 py-2.5 text-[11px] text-faint sm:px-6">AI 生成内容仅供参考，重要结论请核实来源</div>
    </>
  );
}
