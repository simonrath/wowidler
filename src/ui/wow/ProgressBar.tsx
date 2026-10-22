import type { CSSProperties } from 'react';
export interface ProgressBarProps { value: number; max: number; label: string; text?: string; tone?: 'health' | 'mana' | 'experience' | 'rage'; compact?: boolean }
export function ProgressBar({ value, max, label, text, tone = 'health', compact }: ProgressBarProps) {
  const validRange = Number.isFinite(max) && max > 0;
  const limit = validRange ? max : 1;
  const current = validRange && Number.isFinite(value) ? Math.max(0, Math.min(limit, value)) : 0;
  return <div className={`wow-progress wow-progress--${tone}${compact ? ' wow-progress--compact' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={current} aria-valuetext={text}>
    <span className="wow-progress-fill" style={{ width: `${current / limit * 100}%` } as CSSProperties} />
    {text && <span className="wow-progress-text">{text}</span>}
  </div>;
}
