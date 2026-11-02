import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { expandNode, openNext } from '../actions';
import { neighbor } from '../nav';
import { useStore } from '../store';

const KEYS: { key: string; label: string }[] = [
  { key: '↑ ↓', label: '在同一级节点之间移动' },
  { key: '← →', label: '走向父节点，或走向第一个子节点' },
  { key: 'Enter', label: '散开当前节点；已经散开过就打开下一批。点卡片本身不会散开' },
  { key: 'Esc', label: '关闭详情、设置或这个说明' },
  { key: 'N', label: '在当前节点下写一个自己的节点' },
  { key: 'F', label: '收藏或取消收藏' },
  { key: 'R', label: '打开今天要复习' },
  { key: '?', label: '打开或关闭快捷键说明' },
];

function typingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
}

export function ShortcutLayer() {
  const helpOpen = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (e.key === 'Escape') {
        if (st.helpOpen) {
          st.setHelpOpen(false);
          e.preventDefault();
          return;
        }
        if (st.reviewOpen) {
          st.setReviewOpen(false);
          e.preventDefault();
          return;
        }
        if (st.comparePick || st.comparePair) {
          st.cancelCompare();
          e.preventDefault();
          return;
        }
        if (st.settingsOpen) {
          st.setSettingsOpen(false);
          e.preventDefault();
          return;
        }
        if (typingTarget(e.target)) return;
        if (st.selectedId) {
          st.selectNode(null);
          e.preventDefault();
        }
        return;
      }
      if (e.key === '?' && !typingTarget(e.target)) {
        e.preventDefault();
        st.setHelpOpen(!st.helpOpen);
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && !typingTarget(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        st.setReviewOpen(!st.reviewOpen);
        return;
      }
      if (typingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || st.helpOpen || st.settingsOpen || st.reviewOpen || st.comparePick || st.comparePair) return;

      const mapId = st.currentId;
      const map = mapId ? st.maps[mapId] : undefined;
      if (!mapId || !map) return;
      const selected = st.selectedId && map.nodes[st.selectedId] ? st.selectedId : map.rootId;

      const arrows = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const;
      if (e.key in arrows) {
        const next = neighbor(map, selected, arrows[e.key as keyof typeof arrows]);
        if (next) {
          e.preventDefault();
          st.selectNode(next);
          st.requestFocus(mapId, [next]);
        }
        return;
      }

      if (e.key === 'Enter') {
        const node = map.nodes[selected];
        if (!node || node.status === 'loading') return;
        e.preventDefault();
        if (!node.expanded || node.status === 'error') void expandNode(mapId, selected);
        else if (node.childIds.some((id) => map.nodes[id]?.hidden)) openNext(mapId, selected);
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        st.askAddChild(mapId, selected);
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && st.selectedId) {
        e.preventDefault();
        st.toggleFavorite(mapId, st.selectedId);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <AnimatePresence>
      {helpOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="关闭" onClick={() => setHelpOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="relative w-full max-w-[420px] rounded-[28px] border border-line bg-card p-6 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]"
          >
            <div className="font-serif text-[22px] font-semibold text-ink">快捷键</div>
            <p className="mt-1 text-[12.5px] text-faint">在输入框里打字时不会触发</p>
            <ul className="mt-4 space-y-2">
              {KEYS.map((item) => (
                <li key={item.key} className="flex items-center gap-3">
                  <kbd className="w-[72px] shrink-0 rounded-lg border border-line bg-paper px-2 py-1 text-center font-mono text-[12px] text-ink">
                    {item.key}
                  </kbd>
                  <span className="text-[13px] text-muted">{item.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
