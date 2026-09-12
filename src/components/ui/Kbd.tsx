import { cx } from './utils';
import './controls.css';

export interface KbdProps {
  /** A single key ("Enter") or a chord (["⌘", "K"]). */
  keys: string | string[];
  className?: string;
}

/** Renders keyboard keys, e.g. `<Kbd keys={['Ctrl', 'K']} />`. */
export function Kbd({ keys, className }: KbdProps) {
  const list = Array.isArray(keys) ? keys : [keys];
  return (
    <span className={cx('ui-kbd', className)}>
      {list.map((k, i) => (
        <kbd className="ui-kbd__key" key={`${k}-${i}`}>
          {k}
        </kbd>
      ))}
    </span>
  );
}
