import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dueReviews, type Grade } from '../srs';
import { useStore } from '../store';

const GRADES: { id: Grade; label: string; hint: string }[] = [
  { id: 'again', label: '忘了', hint: '10 分钟后再见' },
  { id: 'hard', label: '模糊', hint: '明天再看' },
  { id: 'good', label: '记住了', hint: '按遗忘曲线往后排' },
];

export function ReviewDeck() {
  const open = useStore((s) => s.reviewOpen);
  const reviews = useStore((s) => s.reviews);
  const gradeReview = useStore((s) => s.gradeReview);
  const setReviewOpen = useStore((s) => s.setReviewOpen);
  const openAt = useStore((s) => s.openAt);
  const [showBack, setShowBack] = useState(false);
  const due = dueReviews(reviews);
  useEffect(() => {
    if (open) setShowBack(false);
  }, [open]);
  const card = due[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="关闭复习" onClick={() => setReviewOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="relative max-h-[min(88dvh,720px)] w-full max-w-[460px] overflow-y-auto rounded-[28px] border border-line bg-card p-5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)] sm:p-6"
          >
            <div className="flex items-baseline justify-between">
              <div className="font-serif text-[22px] font-semibold text-ink">今天要复习</div>
              <div className="text-[12px] text-faint">{due.length ? `还剩 ${due.length} 张` : '清完了'}</div>
            </div>
            {!card ? (
              <p className="mt-6 text-[14px] leading-relaxed text-muted">划线、收藏，或者测验答错，都会变成卡片排到这里。现在没有到期的。</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowBack(true)}
                  className="mt-5 min-h-[180px] w-full rounded-2xl bg-paper px-5 py-6 text-left"
                >
                  <div className="text-[11px] tracking-wide text-faint">{card.kind === 'highlight' ? '划线' : '收藏的知识点'}</div>
                  <div className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed font-medium text-ink">{showBack ? card.back : card.front}</div>
                  {!showBack && <div className="mt-6 text-[12px] text-faint">点一下看答案</div>}
                </button>
                {showBack && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {GRADES.map((grade) => (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => {
                          gradeReview(card.id, grade.id);
                          setShowBack(false);
                        }}
                        className="rounded-xl border border-line px-2 py-2 text-center transition hover:bg-ink/5"
                      >
                        <div className="text-[13px] font-medium text-ink">{grade.label}</div>
                        <div className="mt-0.5 text-[10.5px] text-faint">{grade.hint}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReviewOpen(false);
                    openAt(card.mapId, card.nodeId);
                  }}
                  className="mt-3 text-[12px] text-faint hover:text-ink"
                >
                  回到这张图上看看
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
