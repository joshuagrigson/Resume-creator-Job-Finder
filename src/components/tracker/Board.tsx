import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { Column } from './Column';
import { TrackedCard } from './TrackedCard';
import { groupByStatus } from './utils';

export interface BoardProps {
  entries: TrackedJob[];
  /** jobId → 0–100 match score against the active resume. Missing = no resume yet. */
  scores: Record<string, number>;
  hasResume: boolean;
  onOpen: (jobId: string) => void;
  onStatusChange: (jobId: string, status: ApplicationStatus) => void;
}

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Kanban board over `APPLICATION_STATUSES`. Cards are draggable by their grip (pointer sensor
 * with an 8px threshold so clicks still work, plus the keyboard sensor); every card also carries
 * a status select so dragging is never the only way to move an application.
 */
export function Board({ entries, scores, hasResume, onOpen, onStatusChange }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ archived: true });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const groups = useMemo(() => groupByStatus(entries), [entries]);
  const activeEntry = activeId ? entries.find((e) => e.job.id === activeId) ?? null : null;

  const toggleCollapsed = useCallback((status: ApplicationStatus) => {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const overId = event.over?.id;
      if (!isStatus(overId)) return;
      const jobId = String(event.active.id);
      const current = entries.find((e) => e.job.id === jobId);
      if (!current || current.status === overId) return;
      onStatusChange(jobId, overId);
    },
    [entries, onStatusChange],
  );

  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active }) => {
        const entry = entries.find((e) => e.job.id === String(active.id));
        return entry ? `Picked up ${entry.job.title}. Use the arrow keys to choose a column.` : 'Picked up application.';
      },
      onDragOver: ({ over }) => {
        const target = over?.id;
        return isStatus(target) ? `Over the ${APPLICATION_STATUS_LABELS[target]} column.` : 'Not over a column.';
      },
      onDragEnd: ({ active, over }) => {
        const entry = entries.find((e) => e.job.id === String(active.id));
        const name = entry ? entry.job.title : 'Application';
        const target = over?.id;
        return isStatus(target) ? `${name} moved to ${APPLICATION_STATUS_LABELS[target]}.` : `${name} left where it was.`;
      },
      onDragCancel: () => 'Move cancelled.',
    }),
    [entries],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="tr-board" role="list" aria-label="Application pipeline">
        {APPLICATION_STATUSES.map((status) => {
          const items = groups[status];
          return (
            <div className="tr-board-col" role="listitem" key={status}>
              <Column
                status={status}
                count={items.length}
                collapsed={Boolean(collapsed[status])}
                onToggleCollapsed={toggleCollapsed}
                dragging={activeId !== null}
              >
                {items.map((entry) => (
                  <TrackedCard
                    key={entry.job.id}
                    entry={entry}
                    matchScore={hasResume ? scores[entry.job.id] ?? 0 : null}
                    onOpen={onOpen}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </Column>
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeEntry ? (
          <TrackedCard
            overlay
            entry={activeEntry}
            matchScore={hasResume ? scores[activeEntry.job.id] ?? 0 : null}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
