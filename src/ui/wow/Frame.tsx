import type { HTMLAttributes, ReactNode } from 'react';
export interface WowFrameProps extends HTMLAttributes<HTMLElement> { title?: string; children: ReactNode; variant?: 'dialog' | 'tooltip' }
/** Blizzard's eight-piece edge atlas: corners stay fixed, edges tile, interior repeats. */
export function WowFrame({ title, children, variant = 'dialog', className = '', ...props }: WowFrameProps) {
  return <section {...props} className={`wow-frame wow-frame--${variant} ${className}`}>
    <div className="wow-frame-pieces" aria-hidden="true">{['left','right','top','bottom','top-left','top-right','bottom-left','bottom-right'].map(part => <i key={part} className={`wow-edge wow-edge--${part}`} style={{ backgroundImage: `url(/assets/crops/${variant}-${part}.svg)` }} />)}</div>
    {title && <h2 className="wow-frame-title" title={title}>{title}</h2>}
    <div className="wow-frame-content">{children}</div>
  </section>;
}
