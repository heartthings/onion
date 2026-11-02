import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { generateCompare } from '../ai';
import { useStore } from '../store';

export function CompareDialog() {
  const pair = useStore((s) => s.comparePair);
  const cancelCompare = useStore((s) => s.cancelCompare);
  const settings = useStore((s) => s.settings);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pair) return;
    const map = useStore.getState().maps[pair.mapId];
    const left = map?.nodes[pair.a];
    const right = map?.nodes[pair.b];
    if (!left || !right) return;
    let cancelled = false;
    setBusy(true);
    setText('');
    generateCompare(settings, left, right)
      .then((markdown) => {
        if (!cancelled) setText(markdown);
      })
      .catch((error) => {
        if (!cancelled) toast.error('对比失败', { description: (error as Error).message });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pair, settings]);

  const map = pair ? useStore.getState().maps[pair.mapId] : undefined;
  const left = pair && map ? map.nodes[pair.a] : undefined;
  const right = pair && map ? map.nodes[pair.b] : undefined;

  return (
    <AnimatePresence>
      {pair && left && right && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="关闭对比" onClick={cancelCompare} />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="relative flex max-h-[min(720px,88vh)] w-full max-w-[680px] flex-col overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]"
          >
            <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <div className="text-[11px] text-faint">A</div>
                <div className="mt-1 font-serif text-[15px] leading-snug font-semibold break-words text-ink sm:text-[18px]">{left.title}</div>
              </div>
              <div>
                <div className="text-[11px] text-faint">B</div>
                <div className="mt-1 font-serif text-[15px] leading-snug font-semibold break-words text-ink sm:text-[18px]">{right.title}</div>
              </div>
            </div>
            <div className="thin-scroll prose prose-sm max-w-none overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {busy && !text ? (
                <div className="flex items-center gap-2 text-[13px] text-faint">
                  <Loader2 className="size-4 animate-spin" /> 正在并排对比…
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
