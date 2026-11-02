import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, X, XCircle, Zap } from 'lucide-react';
import { useStore } from '../store';
import { PROVIDERS, testConnection } from '../ai';
import { IconButton } from './ui';

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative max-h-[min(92dvh,900px)] w-full max-w-[560px] overflow-y-auto rounded-[28px] bg-card shadow-[0_40px_80px_-30px_rgba(28,31,38,0.5)]"
          >
            <SettingsForm onClose={() => setOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  'h-10 w-full rounded-xl border border-line bg-paper/50 px-3.5 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-onion/60 focus:bg-card';

function SettingsForm({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const preset = PROVIDERS.find((p) => p.id === settings.providerId);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    setResult(await testConnection(settings));
    setTesting(false);
  };

  return (
    <>
      <div className="flex items-start justify-between px-4 pt-5 sm:px-7 sm:pt-6">
        <div>
          <h3 className="font-serif text-[20px] font-semibold text-ink">模型设置</h3>
          <p className="mt-1 text-[12.5px] text-muted">支持任意 OpenAI 兼容接口，选择厂商后自动填入地址与默认模型</p>
        </div>
        <IconButton onClick={onClose} title="关闭">
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="space-y-4 px-4 pt-5 pb-6 sm:px-7">
        <div className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setResult(null);
                update({ providerId: p.id, baseUrl: p.baseUrl, model: p.model });
              }}
              className={clsx(
                'h-auto min-h-9 rounded-xl border px-1 py-1.5 text-[12px] leading-tight transition',
                p.id === settings.providerId
                  ? 'border-transparent bg-inverse font-medium text-on-inverse'
                  : 'border-line text-muted hover:border-line hover:bg-ink/5',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>

        <Field label="Base URL">
          <input className={inputCls} value={settings.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} placeholder="https://…/v1" />
        </Field>

        <Field label="API Key" hint={preset?.noKey ? '本地模型可留空' : undefined}>
          <div className="relative">
            <input
              className={clsx(inputCls, 'pr-10 font-mono')}
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="sk-…"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-faint hover:text-ink"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field label="模型" hint={preset?.hint}>
          <input className={inputCls} value={settings.model} onChange={(e) => update({ model: e.target.value })} placeholder="模型名称" />
        </Field>

        <Field label="先展示的节点数量" hint={`${settings.childCount} 个，其余按价值收起`}>
          <input
            type="range"
            min={3}
            max={8}
            value={settings.childCount}
            onChange={(e) => update({ childCount: Number(e.target.value) })}
            className="w-full accent-[#e0913f]"
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={testing || !settings.baseUrl || !settings.model}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[12.5px] font-medium text-muted transition hover:bg-ink/5 disabled:opacity-50"
          >
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            测试连接
          </button>
          {result && (
            <span className={clsx('flex min-w-0 items-center gap-1.5 text-[12px]', result.ok ? 'text-emerald-600' : 'text-rose-600')}>
              {result.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
              <span className="line-clamp-2">{result.message}</span>
            </span>
          )}
        </div>

        <div className="flex gap-2.5 rounded-2xl bg-emerald-50/70 p-3.5 text-[12px] leading-relaxed text-emerald-900/80">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          模型 Key、知识地图和划线都存在这个浏览器的本地数据库（IndexedDB）里，不上传。请求由浏览器直接发往你选择的模型厂商。
        </div>
      </div>

      <div className="flex justify-end border-t border-line bg-paper/40 px-4 py-3.5 sm:px-7">
        <button type="button" onClick={onClose} className="h-9 rounded-xl bg-inverse px-5 text-[13px] font-medium text-on-inverse transition hover:opacity-90">
          完成
        </button>
      </div>
    </>
  );
}
