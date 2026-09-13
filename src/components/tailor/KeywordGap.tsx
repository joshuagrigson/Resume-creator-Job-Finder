import { useMemo } from 'react';
import { BookmarkPlus, Check, Plus } from 'lucide-react';
import type { Job, Resume } from '@shared/types';
import { extractRequirements } from '@shared/keywords';
import { Badge, Button, Card, EmptyState, useToast } from '@/components/ui';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { resumeSkillSet, withSkillsAdded } from './helpers';

export interface KeywordGapProps {
  resume: Resume;
  jobText: string;
  /** Present when a real posting is selected — enables "Track this job". */
  job: Job | null;
}

interface Split {
  matched: string[];
  missing: string[];
}

function split(skills: readonly string[], have: Set<string>): Split {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of skills) {
    if (have.has(skill.toLowerCase())) matched.push(skill);
    else missing.push(skill);
  }
  return { matched, missing };
}

/**
 * What the posting asks for versus what the resume already says, split into required and
 * nice-to-have. Missing chips add themselves to the resume's first skill group in one click.
 */
export function KeywordGap({ resume, jobText, job }: KeywordGapProps) {
  const updateResume = useResumeStore((s) => s.updateResume);
  const trackJob = useJobStore((s) => s.trackJob);
  const tracked = useJobStore((s) => s.tracked);
  const toast = useToast();

  const requirements = useMemo(() => extractRequirements(jobText), [jobText]);
  const have = useMemo(() => resumeSkillSet(resume), [resume]);

  const required = useMemo(() => split(requirements.required, have), [requirements.required, have]);
  const nice = useMemo(() => split(requirements.niceToHave, have), [requirements.niceToHave, have]);

  const allMissing = useMemo(() => [...required.missing, ...nice.missing], [required.missing, nice.missing]);
  const totalFound = requirements.required.length + requirements.niceToHave.length;
  const coverage = totalFound === 0 ? 0 : Math.round(((required.matched.length + nice.matched.length) / totalFound) * 100);

  const add = (skills: string[]) => {
    if (skills.length === 0) return;
    const next = withSkillsAdded(resume, skills);
    if (next === resume) return;
    updateResume(resume.id, next);
    toast.push({
      title: skills.length === 1 ? `Added "${skills[0]}" to your skills` : `Added ${skills.length} skills`,
      description: 'Check the wording in the resume builder — keep it honest.',
      tone: 'success',
    });
  };

  const isTracked = job ? Boolean(tracked[job.id]) : true;

  if (totalFound === 0) {
    return (
      <EmptyState
        icon={<Check size={18} />}
        title="No recognizable skills in this description"
        description="Paste a longer posting — the requirements section is where the keyword matcher earns its keep."
      />
    );
  }

  return (
    <div className="tl-gap stack-4">
      <div className="tl-gap-summary">
        <Badge tone={coverage >= 70 ? 'success' : coverage >= 40 ? 'warning' : 'danger'} variant="soft" dot>
          {coverage}% keyword coverage
        </Badge>
        <span className="small muted">
          {required.matched.length + nice.matched.length} of {totalFound} skills in this posting already appear on your resume.
        </span>
        {job && !isTracked && (
          <Button size="sm" variant="secondary" leftIcon={<BookmarkPlus size={14} />} onClick={() => trackJob(job, 'saved')}>
            Track this job
          </Button>
        )}
      </div>

      <Card title="Required" subtitle={`${required.matched.length} matched · ${required.missing.length} missing`} padding="sm">
        {requirements.required.length === 0 ? (
          <p className="small muted">This posting never says what is required outright.</p>
        ) : (
          <div className="stack-2">
            <ChipRow label="Matched" tone="matched" skills={required.matched} />
            <ChipRow label="Missing" tone="missing" skills={required.missing} onAdd={(s) => add([s])} />
          </div>
        )}
      </Card>

      <Card title="Nice to have" subtitle={`${nice.matched.length} matched · ${nice.missing.length} missing`} padding="sm">
        {requirements.niceToHave.length === 0 ? (
          <p className="small muted">Nothing was flagged as merely preferred.</p>
        ) : (
          <div className="stack-2">
            <ChipRow label="Matched" tone="matched" skills={nice.matched} />
            <ChipRow label="Missing" tone="missing" skills={nice.missing} onAdd={(s) => add([s])} />
          </div>
        )}
      </Card>

      {allMissing.length > 0 && (
        <div className="tl-gap-bulk">
          <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={() => add(allMissing)}>
            Add all {allMissing.length} missing
          </Button>
          <p className="small muted">
            Add all missing that I <strong>actually have</strong> — a keyword you cannot defend in an interview costs you more than
            the ATS points it wins.
          </p>
        </div>
      )}
    </div>
  );
}

function ChipRow({
  label,
  tone,
  skills,
  onAdd,
}: {
  label: string;
  tone: 'matched' | 'missing';
  skills: string[];
  onAdd?: (skill: string) => void;
}) {
  return (
    <div className="tl-chiprow">
      <span className="tl-chiprow-label">{label}</span>
      {skills.length === 0 ? (
        <span className="small subtle">None</span>
      ) : (
        <ul className="tl-chips">
          {skills.map((skill) => (
            <li key={skill}>
              {onAdd ? (
                <button
                  type="button"
                  className="tl-chip tl-chip-missing"
                  aria-label={`Add ${skill} to skills`}
                  onClick={() => onAdd(skill)}
                >
                  <Plus size={12} aria-hidden="true" />
                  <span>{skill}</span>
                </button>
              ) : (
                <span className={`tl-chip tl-chip-${tone}`}>
                  <Check size={12} aria-hidden="true" />
                  {skill}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
