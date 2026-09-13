import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ApplicationStatus } from '@shared/types';
import { APPLICATION_STATUS_LABELS } from '@shared/types';
import { cx } from '@/components/ui';
import { STATUS_TONE } from './utils';

export interface ColumnProps {
  status: ApplicationStatus;
  count: number;
  /** Collapsed columns keep their header (and stay a drop target) but hide their cards. */
  collapsed: boolean;
  onToggleCollapsed: (status: ApplicationStatus) => void;
  /** True while a card is being dragged anywhere on the board. */
  dragging: boolean;
  children: ReactNode;
}

/** A pipeline stage: droppable region, header with a live count, dashed hint when empty. */
export function Column({ status, count, collapsed, onToggleCollapsed, dragging, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const label = APPLICATION_STATUS_LABELS[status];
  const panelId = `tr-col-${status}`;

  return (
    <section
      ref={setNodeRef}
      className={cx('tr-column', `tr-column-${STATUS_TONE[status]}`, isOver && 'tr-column-over', collapsed && 'tr-column-collapsed')}
      aria-label={`${label} — ${count} ${count === 1 ? 'application' : 'applications'}`}
    >
      <header className="tr-column-head">
        <button
          type="button"
          className="tr-column-toggle"
          onClick={() => onToggleCollapsed(status)}
          aria-expanded={!collapsed}
          aria-controls={panelId}
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          <span className="tr-column-name">{label}</span>
        </button>
        <span className="tr-column-count" aria-hidden="true">
          {count}
        </span>
      </header>

      <div id={panelId} className="tr-column-body" hidden={collapsed}>
        {count === 0 ? (
          <p className={cx('tr-drop-hint', isOver && 'tr-drop-hint-active')}>
            {dragging ? `Drop here to mark ${label.toLowerCase()}` : 'Nothing here yet'}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
