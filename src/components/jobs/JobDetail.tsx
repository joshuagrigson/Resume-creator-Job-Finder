import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Link2,
  MapPin,
  Plus,
  Wand2,
} from 'lucide-react';
import type { ApplicationStatus, Job, MatchResult } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { payAnswerFor } from '@shared/pay';
import { Badge, Button, Chip, IconButton, Select, useToast } from '@/components/ui';
import { useJobStore } from '@/stores/jobStore';
import { useActiveResume, useResumeStore } from '@/stores/resumeStore';
import { createSkillGroup } from '@/lib/resume/defaults';
import { MatchBadge } from './MatchBadge';
import { sanitizeJobHtml, textParagraphs } from './sanitize';
import {
  absoluteDate,
  companyInitial,
  EMPLOYMENT_TYPE_LABELS,
  formatDistance,
  formatSalary,
  jobPermalink,
  locationLabel,
  relativeTime,
  sourceLabel,
} from './format';
import './jobs.css';

export interface JobDetailProps {
  job: Job;
  match?: MatchResult;
  /** Shows a back button above the header (mobile sheet). */
  onBack?: () => void;
  /** Drop the panel chrome when the sheet already provides it. */
  bare?: boolean;
}

const NOT_TRACKED = 'none';

/** Full posting: header, match explanation, sanitized description and the actions. */
export function JobDetail({ job, match, onBack, bare = false }: JobDetailProps) {
  const toast = useToast();
  const navigate = useNavigate();

  const tracked = useJobStore((s) => s.tracked[job.id]);
  const trackJob = useJobStore((s) => s.trackJob);
  const untrackJob = useJobStore((s) => s.untrackJob);
  const setStatus = useJobStore((s) => s.setStatus);

  const resume = useActiveResume();
  const updateResume = useResumeStore((s) => s.updateResume);
  const [addedSkills, setAddedSkills] = useState<string[]>([]);

  const html = useMemo(() => sanitizeJobHtml(job.descriptionHtml), [job.descriptionHtml]);
  const paragraphs = useMemo(() => (html ? [] : textParagraphs(job.descriptionText)), [html, job.descriptionText]);
  const salary = formatSalary(job.salary);
  const payAnswer = payAnswerFor(job.salary);
  const posted = relativeTime(job.postedAt);
  const status = tracked?.status ?? NOT_TRACKED;
  const saved = Boolean(tracked);

  function handleStatus(next: string) {
    if (next === NOT_TRACKED) {
      untrackJob(job.id);
      toast.push({ title: 'Removed from tracker', tone: 'info' });
      return;
    }
    const value = next as ApplicationStatus;
    if (tracked) setStatus(job.id, value);
    else trackJob(job, value, resume?.id);
    toast.push({ title: `Marked ${APPLICATION_STATUS_LABELS[value].toLowerCase()}`, tone: 'success' });
  }

  function toggleSave() {
    if (tracked) {
      untrackJob(job.id);
      toast.push({ title: 'Removed from saved jobs', tone: 'info' });
      return;
    }
    trackJob(job, 'saved', resume?.id);
    toast.push({ title: 'Saved to your tracker', tone: 'success' });
  }

  async function copyLink() {
    const url = jobPermalink(job.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.push({ title: 'Link copied', description: url, tone: 'success' });
    } catch {
      toast.push({ title: 'Could not copy the link', description: url, tone: 'error' });
    }
  }

  function addSkill(skill: string) {
    if (!resume) return;
    updateResume(resume.id, (current) => {
      const groups = current.skillGroups ?? [];
      const first = groups[0];
      if (!first) {
        return { ...current, skillGroups: [createSkillGroup({ name: 'Skills', skills: [skill] })] };
      }
      if (first.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return current;
      const next = [...groups];
      next[0] = { ...first, skills: [...first.skills, skill] };
      return { ...current, skillGroups: next };
    });
    setAddedSkills((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
    toast.push({ title: `Added “${skill}” to ${resume.skillGroups[0]?.name || 'Skills'}`, tone: 'success' });
  }

  return (
    <section className={bare ? 'jf-detail jf-detail--bare' : 'jf-detail'} aria-label={`${job.title} at ${job.company}`}>
      {onBack ? (
        <div>
          <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={15} />} onClick={onBack}>
            Back to results
          </Button>
        </div>
      ) : null}

      <div className="jf-detail__head">
        <span className="jf-logo jf-logo--lg" aria-hidden="true">
          {companyInitial(job.company)}
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <h2 className="jf-detail__title">{job.title}</h2>
          <div className="jf-detail__company">
            <Building2 className="jf-fact__icon" size={13} aria-hidden="true" /> {job.company || 'Company not listed'}
          </div>
        </div>
        <MatchBadge match={match} variant="ring" size={64} />
      </div>

      <div className="jf-card__facts">
        <span className="jf-fact">
          <MapPin className="jf-fact__icon" size={13} aria-hidden="true" />
          {locationLabel(job)}
          {formatDistance(job.distanceMiles) ? (
            <span className="jf-card__distance" title="Straight-line distance from your ZIP">
              · {formatDistance(job.distanceMiles)}
            </span>
          ) : null}
        </span>
        {job.remote ? (
          <Badge tone="accent" variant="soft">
            Remote
          </Badge>
        ) : null}
        {posted ? (
          <span className="jf-fact" title={absoluteDate(job.postedAt)}>
            <Clock className="jf-fact__icon" size={13} aria-hidden="true" />
            Posted {posted}
          </span>
        ) : null}
        {salary ? <span className="jf-fact jf-card__salary">{salary}</span> : null}
        {job.employmentType ? <Badge tone="neutral">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge> : null}
        <Badge tone="neutral" variant="outline">
          {sourceLabel(job.source)}
        </Badge>
      </div>

      {payAnswer ? (
        <p className="jf-detail__pay small" data-testid="pay-answer">
          <strong>If they ask your pay expectation:</strong> {payAnswer.text}. <span className="subtle">{payAnswer.why}</span>
        </p>
      ) : null}

      <div className="jf-detail__actions">
        {job.url ? (
          <a className="ui-btn ui-btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
            <span className="ui-btn__icon" aria-hidden="true">
              <ExternalLink size={15} />
            </span>
            <span className="ui-btn__label">{`Apply on ${sourceLabel(job.source)}`}</span>
          </a>
        ) : (
          <Button variant="primary" disabled>
            Apply link unavailable
          </Button>
        )}
        <Button
          leftIcon={saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          aria-pressed={saved}
          onClick={toggleSave}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          leftIcon={<Wand2 size={15} />}
          onClick={() => navigate(`/tailor/${encodeURIComponent(job.id)}`)}
        >
          Tailor resume
        </Button>
        <IconButton label="Copy link to this job" icon={<Link2 size={16} />} onClick={() => void copyLink()} />
        <div className="jf-detail__track">
          <label className="jf-filters__label" htmlFor={`jf-status-${job.id}`}>
            Status
          </label>
          <Select
            id={`jf-status-${job.id}`}
            uiSize="sm"
            value={status}
            onChange={(e) => handleStatus(e.target.value)}
          >
            <option value={NOT_TRACKED}>Not tracked</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {resume ? null : (
        <div className="jf-banner">
          <span className="jf-banner__text">Create a resume to see how well you match this job.</span>
          <Link className="ui-btn ui-btn--primary ui-btn--sm" to="/resume">
            Build a resume
          </Link>
        </div>
      )}

      {match ? (
        <div className="jf-section">
          <h3 className="jf-section__title">Why this match</h3>
          <ul className="jf-reasons">
            {match.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          {match.matchedSkills.length > 0 ? (
            <>
              <h3 className="jf-section__title">Skills you already have</h3>
              <div className="jf-chips">
                {match.matchedSkills.map((skill) => (
                  <Chip key={skill} tone="success" leftIcon={<Check size={12} />}>
                    {skill}
                  </Chip>
                ))}
              </div>
            </>
          ) : null}

          {match.missingSkills.length > 0 ? (
            <>
              <h3 className="jf-section__title">Missing from your resume</h3>
              <div className="jf-chips">
                {match.missingSkills.map((skill) => {
                  const added = addedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      className="jf-addskill"
                      disabled={added}
                      aria-label={added ? `${skill} added to your skills` : `Add ${skill} to your skills`}
                      onClick={() => addSkill(skill)}
                    >
                      {added ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                      {skill}
                    </button>
                  );
                })}
              </div>
              <p className="jf-detail__footnote">
                Only add a skill you can actually back up in an interview — it goes straight onto your resume.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="jf-section">
        <h3 className="jf-section__title">Job description</h3>
        {html ? (
          <div className="jf-description" data-testid="job-description" dangerouslySetInnerHTML={{ __html: html }} />
        ) : paragraphs.length > 0 ? (
          <div className="jf-description" data-testid="job-description">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="muted">
            This board did not include a description. Open the posting on {sourceLabel(job.source)} for the full details.
          </p>
        )}
      </div>

      <p className="jf-detail__footnote">
        Listed on {sourceLabel(job.source)}
        {absoluteDate(job.postedAt) ? ` · Posted ${absoluteDate(job.postedAt)}` : ''}
      </p>
    </section>
  );
}
