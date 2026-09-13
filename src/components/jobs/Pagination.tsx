import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import { pageCount } from './format';
import './jobs.css';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}

/** Build a compact page window: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set<number>([1, last, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('gap');
    out.push(p);
    previous = p;
  }
  return out;
}

/** Page controls for the results list. Hidden when everything fits on one page. */
export function Pagination({ page, pageSize, total, disabled = false, onChange }: PaginationProps) {
  const last = pageCount(total, pageSize);
  if (last <= 1) return null;
  const current = Math.min(Math.max(1, page), last);

  return (
    <nav className="jf-pagination" aria-label="Results pages">
      <IconButton
        label="Previous page"
        icon={<ChevronLeft size={16} />}
        disabled={disabled || current <= 1}
        onClick={() => onChange(current - 1)}
      />
      <div className="jf-pagination__pages">
        {pageWindow(current, last).map((entry, i) =>
          entry === 'gap' ? (
            <span key={`gap-${i}`} className="jf-pagination__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={entry}
              size="sm"
              variant={entry === current ? 'primary' : 'ghost'}
              aria-current={entry === current ? 'page' : undefined}
              aria-label={`Page ${entry}`}
              disabled={disabled}
              onClick={() => onChange(entry)}
            >
              {entry}
            </Button>
          ),
        )}
      </div>
      <IconButton
        label="Next page"
        icon={<ChevronRight size={16} />}
        disabled={disabled || current >= last}
        onClick={() => onChange(current + 1)}
      />
    </nav>
  );
}
