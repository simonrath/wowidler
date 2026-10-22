'use client';
import { useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
export interface IconSlotProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string; icon?: string; selected?: boolean; pressed?: boolean; highlighted?: boolean;
  cooldown?: number; cooldownLabel?: string; count?: string | number; hotkey?: string;
}
export function IconSlot({ label, icon, selected, pressed, highlighted, cooldown = 0, cooldownLabel, count, hotkey, className = '', ...props }: IconSlotProps) {
  const [failed, setFailed] = useState<string>();
  const missing = !icon || failed === icon;
  const progress = Number.isFinite(cooldown) ? Math.min(1, Math.max(0, cooldown)) : 0;
  return <button type="button" {...props} className={`wow-icon-slot ${className}`} aria-label={`${label}${progress > 0 && cooldownLabel ? ` – ${cooldownLabel}` : ''}`} aria-pressed={selected ?? pressed} data-selected={selected || undefined} data-pressed={pressed || undefined} data-highlighted={highlighted || undefined} title={label}>
    {missing ? <img src="/assets/authored/missing-icon.svg" alt="" data-fallback /> : <img src={icon} alt="" onError={() => setFailed(icon)} />}
    {progress > 0 && <span aria-hidden="true" data-cooldown className="wow-cooldown" style={{ '--cooldown': `${progress * 360}deg` } as CSSProperties} />}
    {hotkey && <span className="wow-hotkey" aria-hidden="true">{hotkey}</span>}{count !== undefined && <span className="wow-count" aria-hidden="true">{count}</span>}
  </button>;
}
