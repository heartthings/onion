import { useState } from 'react';
import clsx from 'clsx';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateQuiz } from '../ai';
import { getPath, useStore } from '../store';
import type { QuizQuestion } from '../types';

export function QuizBox({ mapId, nodeId }: { mapId: string; nodeId: string }) {
  const settings = useStore((s) => s.settings);
  const setMastery = useStore((s) => s.setMastery);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState(0);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const map = useStore.getState().maps[mapId];
    if (!map?.nodes[nodeId]) return;
    setBusy(true);
    try {
      const next = await generateQuiz(settings, getPath(map, nodeId));
      setQuestions(next);
      setIndex(0);
      setPicked(null);
      setWrong(0);
    } catch (error) {
      toast.error('出题失败', { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!questions) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="flex w-full items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-left text-[13px] text-muted transition hover:border-onion/50 hover:text-ink disabled:opacity-60"
      >
        <span>就地出几道选择题</span>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <span className="text-[12px] text-faint">答错会标成还要再看</span>}
      </button>
    );
  }

  const current = questions[index];
  const revealed = picked !== null;

  const choose = (option: number) => {
    if (revealed) return;
    setPicked(option);
    if (option !== current.answer) {
      setWrong((count) => count + 1);
      setMastery(mapId, nodeId, 'lost');
    }
  };

  const advance = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    if (wrong === 0) setMastery(mapId, nodeId, 'got');
    toast.success(wrong === 0 ? '这几题都对了' : '答错的已经放进今天要复习');
    setQuestions(null);
  };

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper/60 p-4">
      <div className="mb-2 text-[11.5px] text-faint">
        第 {index + 1} / {questions.length} 题
      </div>
      <div className="text-[14.5px] leading-relaxed font-medium text-ink">{current.question}</div>
      <div className="mt-3 space-y-2">
        {current.options.map((option, optionIndex) => {
          const correct = optionIndex === current.answer;
          const chosen = optionIndex === picked;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(optionIndex)}
              className={clsx(
                'flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition',
                !revealed && 'border-line bg-card hover:border-ink/20',
                revealed && correct && 'border-emerald-500/40 bg-emerald-500/10 text-ink',
                revealed && chosen && !correct && 'border-rose-500/40 bg-rose-500/10 text-ink',
                revealed && !chosen && !correct && 'border-line text-faint',
              )}
            >
              {revealed && correct && <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />}
              {revealed && chosen && !correct && <X className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-3">
          <p className="text-[12.5px] leading-relaxed text-muted">{current.why}</p>
          <button type="button" onClick={advance} className="mt-3 h-8 rounded-lg bg-inverse px-3 text-[12.5px] font-medium text-on-inverse">
            {index + 1 < questions.length ? '下一题' : '看完了'}
          </button>
        </div>
      )}
    </div>
  );
}
