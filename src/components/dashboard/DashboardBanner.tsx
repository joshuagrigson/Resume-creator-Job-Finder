import type { TrackedJob } from '@shared/types';
import { ArtImage } from '@/components/ui/ArtImage';
import { todayIsoDate } from '@/components/tracker/utils';
import './dashboard.css';

export interface DashboardBannerProps {
  greeting: string;
  firstName: string;
  tracked: TrackedJob[];
  now?: Date;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One line that says where the search stands, in words rather than widgets. */
export function pipelineLine(tracked: TrackedJob[], now: Date = new Date()): string {
  if (tracked.length === 0) return 'Nothing tracked yet. Save a job you like and it will be waiting here.';
  const today = todayIsoDate(now);
  const saved = tracked.filter((t) => t.status === 'saved').length;
  const applied = tracked.filter((t) => t.status === 'applied').length;
  const interviewing = tracked.filter((t) => t.status === 'interviewing').length;
  const due = tracked.filter(
    (t) => t.followUpOn && t.followUpOn <= today && !['rejected', 'archived', 'offer'].includes(t.status),
  ).length;
  const parts = [
    saved ? plural(saved, 'job saved', 'jobs saved') : '',
    applied ? `${applied} applied` : '',
    interviewing ? `${interviewing} interviewing` : '',
    due ? plural(due, 'follow-up due', 'follow-ups due') : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')}.` : 'Everything tracked is settled.';
}

/** Returning-user header: the date, a greeting in the display face, and the desk in morning light. */
export function DashboardBanner({ greeting, firstName, tracked, now = new Date() }: DashboardBannerProps) {
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <section className="db-banner" aria-labelledby="db-banner-title">
      <div className="db-banner__copy">
        <p className="db-banner__date">{date}</p>
        <h1 className="db-banner__title" id="db-banner-title">
          {firstName ? (
            <>
              {greeting}, <em>{firstName}</em>
            </>
          ) : (
            greeting
          )}
        </h1>
        <p className="db-banner__line">{pipelineLine(tracked, now)}</p>
      </div>
      <div className="db-banner__art" aria-hidden="true">
        <ArtImage name="desk" widths={[960, 1600]} sizes="(min-width: 1100px) 720px, 100vw" alt="" priority />
      </div>
    </section>
  );
}
