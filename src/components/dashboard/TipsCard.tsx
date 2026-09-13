import { useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { Card, IconButton } from '@/components/ui';
import './dashboard.css';

export interface Tip {
  title: string;
  body: string;
}

/** Practical, non-generic advice. Three show at a time and rotate. */
export const TIPS: Tip[] = [
  {
    title: 'Lead every bullet with a verb',
    body: 'Rebuilt, negotiated, cut, shipped. "Responsible for" tells a recruiter nothing about what changed.',
  },
  {
    title: 'Put a number in half your bullets',
    body: 'Percent, dollars, headcount, volume, time saved. If you cannot measure it, describe the scale instead.',
  },
  {
    title: 'Mirror the words in the posting',
    body: 'Screeners match strings, not synonyms. If the ad says "lifecycle marketing", do not write "CRM campaigns".',
  },
  {
    title: 'One page per decade of work',
    body: 'Under ten years, keep it to a page. Cut the oldest roles down to a single line each.',
  },
  {
    title: 'Skip the skills you would not defend',
    body: 'Everything on the resume is fair game in the interview. Drop the tool you touched once in 2019.',
  },
  {
    title: 'Name the outcome, not the task',
    body: '"Ran weekly reports" is a task. "Cut reporting time from 6 hours to 40 minutes" is an outcome.',
  },
  {
    title: 'Tailor the top third',
    body: 'Headline, summary and the first two bullets carry the screen. Rewrite those per job, leave the rest.',
  },
  {
    title: 'Apply within the first 72 hours',
    body: 'Postings fill from the earliest applicants. Sort the finder by date and set follow-ups when you apply.',
  },
  {
    title: 'Follow up once, seven days out',
    body: 'A short note that adds one new detail beats a reminder that only asks for a status.',
  },
  {
    title: 'Keep a plain-text copy',
    body: 'Some portals strip formatting on upload. Export JSON here and keep a text version for those forms.',
  },
  {
    title: 'Write dates as month and year',
    body: 'Parsers handle "Mar 2023 – Present" reliably. Seasons and bare years create gaps that are not there.',
  },
  {
    title: 'Say where you can work',
    body: '"Remote (US)" or "Austin, TX — hybrid" in the header answers the first filter a recruiter applies.',
  },
];

const PER_PAGE = 3;

function initialOffset(): number {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return (dayOfYear * PER_PAGE) % TIPS.length;
}

export interface TipsCardProps {
  className?: string;
}

/** Three rotating tips, refreshable so it never feels like static filler. */
export function TipsCard({ className }: TipsCardProps) {
  const [offset, setOffset] = useState(initialOffset);

  const shown = Array.from({ length: PER_PAGE }, (_, i) => TIPS[(offset + i) % TIPS.length]).filter(
    (tip): tip is Tip => Boolean(tip),
  );

  return (
    <Card
      className={className}
      title="Tips that actually move the needle"
      subtitle="Three at a time, from the ATS rules this app checks"
      actions={
        <IconButton
          label="Show different tips"
          icon={<RefreshCw size={15} />}
          onClick={() => setOffset((o) => (o + PER_PAGE) % TIPS.length)}
        />
      }
    >
      <ul className="db-tips">
        {shown.map((tip) => (
          <li className="db-tip" key={tip.title}>
            <span className="db-tip__icon" aria-hidden="true">
              <Lightbulb size={14} />
            </span>
            <span className="db-tip__text">
              <strong>{tip.title}</strong>
              <span>{tip.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default TipsCard;
