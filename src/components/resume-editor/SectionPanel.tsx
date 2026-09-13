/** One collapsible editor section: drag handle, hide toggle, up/down, and the section form. */
import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, Eye, EyeOff, GripVertical, MoveDown, MoveUp } from 'lucide-react';
import { IconButton } from '@/components/ui';

export interface SectionPanelProps {
  /** Stable sortable id (the SectionKey). */
  id: string;
  title: string;
  /** Small right-aligned hint in the header, e.g. "3 roles". */
  summary?: string;
  open: boolean;
  onToggleOpen: () => void;
  hidden?: boolean;
  onToggleHidden?: () => void;
  index: number;
  count: number;
  onMove?: (direction: 'up' | 'down') => void;
  /** Extra header controls (e.g. rename/delete for custom sections). */
  headerExtra?: ReactNode;
  /** When false the panel is fixed in place (used by the always-first Contact panel). */
  sortable?: boolean;
  children: ReactNode;
}

export function SectionPanel(props: SectionPanelProps) {
  if (props.sortable === false) return <StaticPanel {...props} />;
  return <SortablePanel {...props} />;
}

function SortablePanel(props: SectionPanelProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });

  return (
    <PanelShell
      {...props}
      rootRef={setNodeRef}
      dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="re-panel__grip"
          aria-label={`Reorder ${props.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
      }
    />
  );
}

function StaticPanel(props: SectionPanelProps) {
  return <PanelShell {...props} />;
}

interface PanelShellProps extends SectionPanelProps {
  rootRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
  handle?: ReactNode;
}

function PanelShell({
  id,
  title,
  summary,
  open,
  onToggleOpen,
  hidden = false,
  onToggleHidden,
  index,
  count,
  onMove,
  headerExtra,
  children,
  rootRef,
  style,
  dragging = false,
  handle,
}: PanelShellProps) {
  const bodyId = `re-panel-body-${cssId(id)}`;
  const headingId = `re-panel-heading-${cssId(id)}`;

  return (
    <section
      ref={rootRef}
      style={style}
      className={['re-panel', dragging && 're-panel--dragging', hidden && 're-panel--hidden'].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      <div className="re-panel__head">
        {handle ?? <span className="re-panel__grip re-panel__grip--static" aria-hidden="true" />}

        <h3 className="re-panel__title" id={headingId}>
          <button type="button" className="re-panel__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggleOpen}>
            <ChevronDown size={15} className="re-panel__chev" aria-hidden="true" />
            <span className="re-panel__name">{title}</span>
            {summary ? <span className="re-panel__summary">{summary}</span> : null}
            {hidden ? <span className="re-panel__badge">Hidden</span> : null}
          </button>
        </h3>

        <div className="re-panel__actions">
          {headerExtra}
          {onMove ? (
            <>
              <IconButton
                size="sm"
                label={`Move ${title} up`}
                icon={<MoveUp size={15} />}
                disabled={index === 0}
                onClick={() => onMove('up')}
              />
              <IconButton
                size="sm"
                label={`Move ${title} down`}
                icon={<MoveDown size={15} />}
                disabled={index >= count - 1}
                onClick={() => onMove('down')}
              />
            </>
          ) : null}
          {onToggleHidden ? (
            <IconButton
              size="sm"
              active={hidden}
              label={hidden ? `Show ${title} on the resume` : `Hide ${title} from the resume`}
              icon={hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              onClick={onToggleHidden}
            />
          ) : null}
        </div>
      </div>

      <div className="re-panel__body" id={bodyId} hidden={!open}>
        {open ? children : null}
      </div>
    </section>
  );
}

function cssId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
