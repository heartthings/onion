import type { ButtonHTMLAttributes } from 'react';
import { Moon, Sun } from 'lucide-react';

export const GITHUB_URL = 'https://github.com/heartthings';

export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.4-5.25 5.69.42.36.79 1.08.79 2.18 0 1.57-.01 2.84-.01 3.23 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export function GithubLink() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      title="有心之物的 GitHub"
      className="flex size-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink/5 hover:text-ink"
    >
      <GithubMark className="size-4" />
    </a>
  );
}
import clsx from 'clsx';
import { useStore } from '../store';

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx(
        'flex size-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  const dark = useStore((s) => s.settings.theme === 'dark');
  return (
    <img
      src={dark ? '/brand/logo-mark.svg' : '/brand/logo-on-light.svg'}
      width={size}
      height={size}
      alt="洋葱"
      className="rounded-[8px]"
    />
  );
}

export function ThemeButton() {
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const dark = theme === 'dark';
  return (
    <IconButton title={dark ? '切换到浅色' : '切换到深色'} onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  );
}
