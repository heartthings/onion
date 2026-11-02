import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ChevronDown, Compass, PenLine, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';

const BENEFITS = [
  { icon: Compass, title: '一次只看下一层', text: '长文会把人淹没。这里每次只拆开你点中的那一个点。' },
  { icon: Sparkles, title: '先学最值得学的', text: '模型按学习价值排序。你设置的数量先出现，其余收在「更多」里。' },
  { icon: PenLine, title: '你的理解能写回去', text: '划线、收藏会变成复习卡。懂了、模糊、不会会标在图上，薄弱的那一支会变色。' },
];

const STEPS = [
  { n: '1', title: '从一个卡住的概念开始', text: '输入「注意力机制」，不要输入「把机器学习全部学会」。范围越小，拆出来的图越有用。' },
  { n: '2', title: '先走排在前面的节点', text: '点卡片只打开它。想继续拆，点卡片外侧的加号。越靠前越是理解这个知识点的必经之路。' },
  { n: '3', title: '读完再决定往哪钻', text: '打开深度讲解，把关键句划下来。讲解末尾的追问点一下就会散成新节点。答错的题会自动标成还要再看。' },
  { n: '4', title: '方向不对就改口', text: '在节点里写「只看数学推导」或「举一个生活里的例子」，它会按这个方向再拆。' },
  { n: '5', title: '把自己知道的补上', text: '按 N 或点「我来写一个」。你写的节点是固定的蓝色，标着「我写的」，和 AI 生成的分开。' },
];

export function LearnGuide() {
  const [open, setOpen] = useState(false);
  const setHelpOpen = useStore((s) => s.setHelpOpen);

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-[28px] border border-line bg-card/90 p-4 text-left shadow-[0_16px_40px_-28px_rgba(28,31,38,0.35)] transition hover:border-onion/40"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-onion/15 text-onion-deep">
            <BookOpen className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium tracking-[0.14em] text-onion-deep">使用手册</div>
            <div className="font-serif text-[17px] font-semibold text-ink">这样学有什么好处，以及怎么用满它</div>
          </div>
          <ChevronDown className={clsx('size-4 text-faint transition', open && 'rotate-180')} />
        </div>
        {!open && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {BENEFITS.map((item) => (
              <div key={item.title} className="rounded-2xl bg-paper px-3 py-2.5">
                <div className="text-[12.5px] font-medium text-ink">{item.title}</div>
                <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-faint">{item.text}</div>
              </div>
            ))}
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[28px] border border-line bg-card px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {BENEFITS.map((item) => (
                  <div key={item.title} className="rounded-2xl bg-paper px-3.5 py-3">
                    <item.icon className="size-4 text-onion-deep" />
                    <div className="mt-2 text-[13px] font-medium text-ink">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{item.text}</p>
                  </div>
                ))}
              </div>

              <ol className="mt-5 space-y-3">
                {STEPS.map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-inverse font-mono text-[11px] text-on-inverse">
                      {step.n}
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium text-ink">{step.title}</div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="mt-4 text-[12.5px] font-medium text-onion-deep hover:underline"
              >
                查看键盘快捷键
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
