/** Move up / move down / duplicate / delete controls for a repeatable editor row. */
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui';

export interface ItemToolbarProps {
  /** What the row represents, used in accessible names: "Move Acme up". */
  itemLabel: string;
  index: number;
  count: number;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}

export function ItemToolbar({
  itemLabel,
  index,
  count,
  onMove,
  onDuplicate,
  onDelete,
  deleteLabel,
}: ItemToolbarProps) {
  return (
    <div className="re-itembar" role="group" aria-label={`${itemLabel} actions`}>
      <IconButton
        size="sm"
        label={`Move ${itemLabel} up`}
        icon={<ArrowUp size={15} />}
        disabled={index === 0}
        onClick={() => onMove('up')}
      />
      <IconButton
        size="sm"
        label={`Move ${itemLabel} down`}
        icon={<ArrowDown size={15} />}
        disabled={index >= count - 1}
        onClick={() => onMove('down')}
      />
      {onDuplicate ? (
        <IconButton size="sm" label={`Duplicate ${itemLabel}`} icon={<Copy size={15} />} onClick={onDuplicate} />
      ) : null}
      <IconButton
        size="sm"
        variant="danger"
        label={deleteLabel ?? `Delete ${itemLabel}`}
        icon={<Trash2 size={15} />}
        onClick={onDelete}
      />
    </div>
  );
}
