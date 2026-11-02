import { useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Highlighter, X } from 'lucide-react';

interface Menu {
  quote: string;
  x: number;
  y: number;
}

function paintMarks(root: HTMLElement, quotes: string[]) {
  root.querySelectorAll('mark.hl').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  });
  root.normalize();
  const sorted = quotes.filter((q) => q.length >= 2).sort((a, b) => b.length - a.length);
  if (!sorted.length) return;

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);

  for (const textNode of nodes) {
    const value = textNode.nodeValue ?? '';
    const hits: { at: number; len: number }[] = [];
    for (const quote of sorted) {
      let from = 0;
      while (from < value.length) {
        const at = value.indexOf(quote, from);
        if (at === -1) break;
        const overlaps = hits.some((h) => at < h.at + h.len && at + quote.length > h.at);
        if (!overlaps) hits.push({ at, len: quote.length });
        from = at + quote.length;
      }
    }
    hits.sort((a, b) => b.at - a.at);
    for (const hit of hits) {
      const range = document.createRange();
      range.setStart(textNode, hit.at);
      range.setEnd(textNode, hit.at + hit.len);
      const mark = document.createElement('mark');
      mark.className = 'hl';
      try {
        range.surroundContents(mark);
      } catch {
        // 选区跨过了标签边界时跳过，原文仍保留在下方列表里
      }
    }
  }
}

export function MarkedProse({
  text,
  quotes,
  onHighlight,
  onRemove,
}: {
  text: string;
  quotes: { id: string; quote: string }[];
  onHighlight: (quote: string) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const quoteTexts = quotes.map((q) => q.quote);

  useLayoutEffect(() => {
    if (ref.current) paintMarks(ref.current, quoteTexts);
  }, [text, quoteTexts.join('\u0001')]);

  const onMouseUp = () => {
    const sel = window.getSelection();
    const root = ref.current;
    if (!sel || sel.isCollapsed || !root || !root.contains(sel.anchorNode)) {
      setMenu(null);
      return;
    }
    const quote = sel.toString().replace(/\s+/g, ' ').trim();
    if (quote.length < 2 || quote.length > 400) {
      setMenu(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setMenu({ quote, x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <div onMouseUp={onMouseUp}>
      <div
        ref={ref}
        className="prose prose-sm prose-slate prose-onion max-w-none text-[13.5px] leading-[1.8] prose-li:my-0.5 prose-table:text-[12.5px] prose-code:rounded prose-code:bg-ink/5 prose-code:px-1 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>

      {menu && (
        <button
          type="button"
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 flex -translate-x-1/2 -translate-y-[120%] items-center gap-1.5 rounded-full bg-inverse px-3 py-1.5 text-[12px] font-medium text-on-inverse shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onHighlight(menu.quote);
            setMenu(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <Highlighter className="size-3.5" /> 划线
        </button>
      )}

      {quotes.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11.5px] font-medium tracking-wide text-faint">我的划线</div>
          <ul className="space-y-1.5">
            {quotes.map((q) => (
              <li key={q.id} className="group flex items-start gap-2 rounded-xl bg-onion/10 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-onion" />
                <span className="min-w-0 flex-1">{q.quote}</span>
                <button type="button" title="取消划线" onClick={() => onRemove(q.id)} className="text-faint opacity-0 transition group-hover:opacity-100 hover:text-rose-500">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
