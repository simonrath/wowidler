'use client';
import type { ButtonHTMLAttributes } from 'react';
export type WowButtonState = 'normal' | 'pressed' | 'highlighted' | 'disabled' | 'selected';
export interface WowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { state?: WowButtonState }
export function WowButton({ state = 'normal', disabled = false, className = '', children, ...props }: WowButtonProps) {
  const current = disabled ? 'disabled' : state;
  return <button type="button" {...props} disabled={current === 'disabled'} aria-pressed={props['aria-pressed'] ?? (current === 'pressed' || current === 'selected' ? true : undefined)} data-state={current} className={`wow-button ${className}`}><span>{children}</span></button>;
}
