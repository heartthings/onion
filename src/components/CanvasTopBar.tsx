import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useReactFlow } from '@xyflow/react';
import { ChevronsDownUp, ChevronsUpDown, Download, Keyboard, Maximize, PanelLeftOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { downloadText, mapToMarkdown, studyToAnki, studyToMarkdown } from '../exportMarkdown';
import { GithubLink, IconButton, ThemeButton } from './ui';

export function CanvasTopBar({ mapId }: { mapId: string }) {
  const map = useStore((s) => s.maps[mapId]);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const renameMap = useStore((s) => s.renameMap);
  const setCollapseAll = useStore((s) => s.setCollapseAll);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const highlights = useStore((s) => s.highlights);
  const rf = useReactFlow();
  const [title, setTitle] = useState(map.title);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => setTitle(map.title), [map.title]);

  const nodes = Object.values(map.nodes);
  const depth = Math.max(...nodes.map((n) => n.depth));

  const commit = () => {
    const t = title.trim();
    if (t && t !== map.title) renameMap(mapId, t);
    else setTitle(map.title);
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:inset-x-4 sm:top-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-card/85 py-1.5 pr-3 pl-1.5 shadow-[0_8px_24px_-16px_rgba(28,31,38,0.3)] backdrop-blur-xl sm:pr-4">
        {!sidebarOpen && (
          <IconButton title="打开侧栏" onClick={() => setSidebarOpen(true)}>
            <PanelLeftOpen className="size-4" />
          </IconButton>
        )}
        <div className={clsx('min-w-0 flex-1', sidebarOpen && 'pl-2.5')}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full bg-transparent font-serif text-[16px] font-semibold text-ink outline-none sm:w-[min(36vw,360px)]"
          />
          <div className="text-[11.5px] text-faint">
            {map.sense ? `${map.sense.kind} · ` : ''}
            {nodes.length} 个知识点 · {depth} 级深度
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex max-w-full items-center gap-1 self-end overflow-x-auto rounded-2xl border border-line bg-card/85 p-1.5 shadow-[0_8px_24px_-16px_rgba(28,31,38,0.3)] backdrop-blur-xl sm:self-auto">
        <IconButton title="全部收起到一级" onClick={() => setCollapseAll(mapId, true)}>
          <ChevronsDownUp className="size-4" />
        </IconButton>
        <IconButton title="全部展开" onClick={() => setCollapseAll(mapId, false)}>
          <ChevronsUpDown className="size-4" />
        </IconButton>
        <IconButton title="适应视图" onClick={() => rf.fitView({ padding: { top: '96px', bottom: '72px', left: '48px', right: '48px' }, duration: 600, maxZoom: 1 })}>
          <Maximize className="size-4" />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-line" />
        <GithubLink />
        <ThemeButton />
        <IconButton title="快捷键（?）" onClick={() => setHelpOpen(true)}>
          <Keyboard className="size-4" />
        </IconButton>
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((open) => !open)}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-inverse px-3 text-[12.5px] font-medium text-on-inverse transition hover:opacity-90"
          >
            <Download className="size-3.5" />
            导出
          </button>
          {exportOpen && (
            <div className="absolute top-10 right-0 w-44 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-xl">
              {(
                [
                  ['整张地图', `${map.title}.md`, mapToMarkdown(map)],
                  ['划线和笔记', `${map.title}-复习.md`, studyToMarkdown([map], highlights.filter((item) => item.mapId === mapId))],
                  ['Anki 卡片', `${map.title}-anki.txt`, studyToAnki([map], highlights.filter((item) => item.mapId === mapId))],
                ] as const
              ).map(([label, filename, text]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const hasCards = text.split('\n').some((line) => line.startsWith('- 「') || line.startsWith('#### ') || (line.includes('\t') && !line.startsWith('#')));
                    if (label !== '整张地图' && !hasCards) {
                      toast.message('这张图还没有划线、笔记或收藏');
                      setExportOpen(false);
                      return;
                    }
                    downloadText(filename, text);
                    setExportOpen(false);
                    toast.success(`已导出${label}`);
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-ink/5"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
