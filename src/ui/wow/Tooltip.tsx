'use client';
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import { WowFrame } from './Frame';
export interface WowTooltipProps { children: ReactElement<{ 'aria-describedby'?: string }>; content: ReactNode; open?: boolean }
export function WowTooltip({ children, content, open }: WowTooltipProps) {
  const id = useId(); const [dismissed, setDismissed] = useState(false);
  return <span className="wow-tooltip-anchor" onMouseEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)} onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }} data-open={open || undefined} data-dismissed={dismissed || undefined}>
    {cloneElement(children, { 'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' ') })}
    <span role="tooltip" id={id} className="wow-tooltip"><WowFrame variant="tooltip">{content}</WowFrame></span>
  </span>;
}
