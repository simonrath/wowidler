import { ProgressBar, type ProgressBarProps } from './ProgressBar';
export interface UnitFrameProps { name: string; level?: string; portrait?: string; variant?: 'player' | 'target'; health: ProgressBarProps; resource?: ProgressBarProps; onClick?: () => void; selected?: boolean }
export function UnitFrame({ name, level, portrait = '/assets/crops/human-portrait.svg', variant = 'player', health, resource, onClick, selected }: UnitFrameProps) {
  return <div className={`wow-unit wow-unit--${variant}`} data-variant={variant}>
    <div className="wow-unit-portrait" style={{ backgroundImage: `url("${portrait}")` }} />
    <div className="wow-unit-bars"><ProgressBar {...health} compact />{resource && <ProgressBar tone="mana" {...resource} compact />}</div>
    <img className="wow-unit-art" src={`/assets/crops/${variant}-frame.svg`} alt="" />
    <button type="button" className="wow-unit-name" title={name} aria-label={name} aria-pressed={selected} onClick={onClick}>{name}</button>
    {level && <span className="wow-unit-level" aria-label={`Stufe ${level}`}>{level}</span>}
  </div>;
}
