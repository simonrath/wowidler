import { IconSlot, type IconSlotProps } from './IconSlot';
export interface ActionBarProps { items: (IconSlotProps & { id: string })[]; label?: string }
export function ActionBar({ items, label = 'Aktionsleiste' }: ActionBarProps) {
  return <div className="wow-actionbar" role="group" aria-label={label}>
    <img className="wow-actionbar-cap wow-actionbar-cap--left" src="/assets/native/Interface/MainMenuBar/UI-MainMenuBar-EndCap-Human.png" alt="" />
    <div className="wow-actionbar-slots">{items.map(({ id, ...props }) => <IconSlot key={id} {...props} />)}</div>
    <img className="wow-actionbar-cap wow-actionbar-cap--right" src="/assets/native/Interface/MainMenuBar/UI-MainMenuBar-EndCap-Human.png" alt="" />
  </div>;
}
