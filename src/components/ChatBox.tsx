import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Send, Sparkles, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../store';
import { askFollowUp, stopAsk } from '../actions';

/** 深度解读之后继续追问 AI：多轮对话，回答里可以用 Markdown，整个对话跟着这个节点一起保存。 */
export function ChatBox({ mapId, nodeId }: { mapId: string; nodeId: string }) {
  const node = useStore((s) => s.maps[mapId]?.nodes[nodeId]);
  const chatStreamingId = useStore((s) => s.chatStreamingId);
  const chat = node?.chat ?? [];
  const streaming = chatStreamingId === nodeId;
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, chat[chat.length - 1]?.content]);

  const send = () => {
    const question = draft.trim();
    if (!question || streaming) return;
    setDraft('');
    void askFollowUp(mapId, nodeId, question);
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-faint">
        <Sparkles className="size-3.5" /> 还没懂？接着问
      </div>

      {chat.length > 0 && (
        <div className="mb-3 space-y-2.5">
          {chat.map((turn, index) => {
            const isUser = turn.role === 'user';
            const isThinking = !isUser && !turn.content && streaming && index === chat.length - 1;
            return (
              <div key={index} className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
                {isUser ? (
                  <div className="max-w-[86%] rounded-2xl rounded-br-md bg-onion/12 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
                    {turn.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-paper/50 px-3 py-2 text-[13px] leading-relaxed text-ink">
                    {isThinking ? (
                      <span className="flex items-center gap-1.5 text-faint">
                        <Loader2 className="size-3.5 animate-spin" /> 正在想…
                      </span>
                    ) : (
                      <div className="prose prose-sm prose-slate prose-onion max-w-none prose-li:my-0.5 prose-code:rounded prose-code:bg-ink/5 prose-code:px-1 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="哪里没讲透？举个例子、追问一句都行"
          className="thin-scroll max-h-32 min-h-[38px] flex-1 resize-none rounded-xl border border-line bg-paper/50 px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-onion/60 focus:bg-card"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stopAsk}
            className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-inverse text-on-inverse transition hover:opacity-85"
            title="停止"
          >
            <Square className="size-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-inverse text-on-inverse transition hover:opacity-85 disabled:opacity-30"
            title="发送"
          >
            <Send className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}
