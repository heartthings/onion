import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Highlighter, PanelLeftClose, Plus, Search, Settings2, Star, Trash2 } from 'lucide-react';
import { dueReviews } from '../srs';
import { useStore } from '../store';
import { isConfigured, PROVIDERS } from '../ai';
import { isNarrow, useNarrow } from '../viewport';
import { GithubLink, IconButton, Logo, ThemeButton } from './ui';
import { MapThumb } from './MapThumb';

function formatUpdated(t: number) {
  const d = new Date(t);
  const now = new Date();
  const time = d.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

export function Sidebar() {
  const open = useStore((s) => s.sidebarOpen);
  const maps = useStore((s) => s.maps);
  const currentId = useStore((s) => s.currentId);
  const settings = useStore((s) => s.settings);
  const openMap = useStore((s) => s.openMap);
  const deleteMap = useStore((s) => s.deleteMap);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const highlights = useStore((s) => s.highlights);
  const dueCount = useStore((s) => dueReviews(s.reviews).length);
  const setReviewOpen = useStore((s) => s.setReviewOpen);
  const openAt = useStore((s) => s.openAt);
  const [query, setQuery] = useState('');

  const list = useMemo(
    () =>
      Object.values(maps)
        .filter((m) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return [m.title, m.sense?.kind, m.sense?.gloss].some((text) => text?.toLowerCase().includes(q));
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [maps, query],
  );

  const saved = useMemo(() => {
    const items: { mapId: string; nodeId: string; title: string }[] = [];
    for (const map of Object.values(maps)) {
      for (const node of Object.values(map.nodes)) {
        if (node.favorite) items.push({ mapId: map.id, nodeId: node.id, title: node.title });
      }
    }
    return items.slice(0, 6);
  }, [maps]);

  const configured = isConfigured(settings);
  const provider = PROVIDERS.find((p) => p.id === settings.providerId);
  const narrow = useNarrow();

  useEffect(() => {
    if (narrow) setSidebarOpen(false);
  }, [narrow, setSidebarOpen]);

  const openAndClose = (run: () => void) => {
    run();
    if (isNarrow()) setSidebarOpen(false);
  };

  return (
    <AnimatePresence initial={false}>
      {open && narrow && (
        <motion.button
          type="button"
          aria-label="关闭侧栏"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {open && (
        <motion.aside
          initial={narrow ? { x: -28, opacity: 0 } : { width: 0, opacity: 0 }}
          animate={narrow ? { x: 0, opacity: 1 } : { width: 300, opacity: 1 }}
          exit={narrow ? { x: -28, opacity: 0 } : { width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          className={clsx(
            'z-40 h-full shrink-0 overflow-hidden border-r border-line bg-sunken',
            narrow ? 'fixed inset-y-0 left-0 w-[min(88vw,320px)] pb-[env(safe-area-inset-bottom)]' : 'relative',
          )}
        >
          <div className={clsx('flex h-full flex-col', narrow ? 'w-full' : 'w-[300px]')}>
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
              <Logo size={30} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-serif text-[16px] font-semibold tracking-wide">洋葱 Onion</div>
                <div className="text-[11px] text-faint">让每个知识点散开</div>
              </div>
              <GithubLink />
              <ThemeButton />
              <IconButton title="收起侧栏" onClick={() => setSidebarOpen(false)}>
                <PanelLeftClose className="size-4" />
              </IconButton>
            </div>

            <div className="px-3">
              <button
                type="button"
                onClick={() => openAndClose(() => openMap(null))}
                className="flex h-10 w-full items-center gap-2 rounded-xl bg-inverse px-3.5 text-[13px] font-medium text-on-inverse shadow-[0_8px_20px_-12px_rgba(28,31,38,0.6)] transition hover:opacity-90"
              >
                <Plus className="size-4" /> 探索新知识
              </button>

              <div className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-onion/50">
                <Search className="size-3.5 text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索知识地图"
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
                />
              </div>
            </div>

            {!query && (
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                className="mx-3 mt-4 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-2xl border border-line bg-card px-3 py-2.5 text-left transition hover:border-onion/40"
              >
                <span className="text-[13px] font-medium text-ink">今天要复习</span>
                <span className="rounded-full bg-inverse px-2 py-0.5 text-[11px] font-medium text-on-inverse">{dueCount}</span>
              </button>
            )}

            {(saved.length > 0 || highlights.length > 0) && !query && (
              <div className="mt-4 space-y-2 px-3">
                {saved.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-medium tracking-wider text-faint">
                      <Star className="size-3 fill-onion text-onion" /> 收藏
                    </div>
                    {saved.map((item) => (
                      <button
                        key={item.nodeId}
                        type="button"
                        onClick={() => openAndClose(() => openAt(item.mapId, item.nodeId))}
                        className="block w-full truncate rounded-lg px-2 py-1 text-left text-[12.5px] text-muted hover:bg-ink/5 hover:text-ink"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
                {highlights.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-medium tracking-wider text-faint">
                      <Highlighter className="size-3" /> 划线
                    </div>
                    {highlights.slice(0, 4).map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => openAndClose(() => openAt(h.mapId, h.nodeId))}
                        className="block w-full truncate rounded-lg px-2 py-1 text-left text-[12.5px] text-muted hover:bg-ink/5 hover:text-ink"
                      >
                        {h.quote}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 px-4 text-[11px] font-medium tracking-wider text-faint">历史</div>
            <div className="thin-scroll mt-1.5 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {list.length === 0 && (
                <div className="px-2 py-8 text-center text-[12px] leading-relaxed whitespace-pre-line text-faint">
                  {query ? '没有匹配的地图' : '还没有知识地图\n回到首页输入一个知识点开始'}
                </div>
              )}
              {list.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openAndClose(() => openMap(m.id))}
                  onKeyDown={(e) => e.key === 'Enter' && openAndClose(() => openMap(m.id))}
                  className={clsx(
                    'group relative cursor-pointer rounded-2xl border p-2 transition',
                    m.id === currentId ? 'border-onion/50 bg-card shadow-[0_8px_24px_-18px_rgba(28,31,38,0.45)]' : 'border-transparent bg-card/60 hover:bg-card',
                  )}
                >
                  <div className="overflow-hidden rounded-xl bg-paper">
                    <MapThumb map={m} />
                  </div>
                  <div className="mt-2 line-clamp-2 pr-6 text-[13px] leading-snug font-medium text-ink">{m.title}</div>
                  {m.sense && <div className="mt-0.5 text-[11px] text-onion-deep">{m.sense.kind}</div>}
                  <div className="mt-0.5 text-[11px] text-faint">{formatUpdated(m.updatedAt)}</div>
                  <button
                    type="button"
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除知识地图「${m.title}」？此操作不可撤销。`)) deleteMap(m.id);
                    }}
                    className="absolute right-2 bottom-2 rounded-md p-1 text-faint hover:bg-rose-50 hover:text-rose-600 md:hidden md:group-hover:block"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-ink/5"
              >
                <span className={clsx('size-2 rounded-full', configured ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]' : 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.2)]')} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[12.5px] font-medium text-ink">{configured ? provider?.name ?? '自定义模型' : '演示模式'}</div>
                  <div className="truncate text-[11px] text-faint">{configured ? settings.model : '未配置模型，点此设置'}</div>
                </div>
                <Settings2 className="size-4 text-faint" />
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
