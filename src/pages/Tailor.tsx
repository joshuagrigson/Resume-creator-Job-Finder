import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Gauge, KeyRound, PenLine, Sparkles } from 'lucide-react';
import type { Job } from '@shared/types';
import { matchLabel, scoreJobMatch, type MatchableJob } from '@shared/match';
import { resumeProfile } from '@/lib/resume/profile';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  EmptyState,
  MatchTone,
  PageHeader,
  Select,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@/components/ui';
import {
  AiTailorPanel,
  AtsVsJob,
  CoverLetterPanel,
  JdPreview,
  JobPicker,
  KeywordGap,
  jobTextOf,
  type PasteState,
} from '@/components/tailor';
import '@/components/tailor/tailor.css';
import { useActiveResume, useResumeList, useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';

const EMPTY_PASTE: PasteState = { text: '', title: '', company: '' };

export default function TailorPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const resume = useActiveResume();
  const resumes = useResumeList();
  const setActiveResume = useResumeStore((s) => s.setActiveResume);
  const createResume = useResumeStore((s) => s.createResume);

  const tracked = useJobStore((s) => s.tracked);
  const jobsById = useJobStore((s) => s.jobsById);

  const [job, setJob] = useState<Job | null>(null);
  const [mode, setMode] = useState<'job' | 'paste'>('job');
  const [paste, setPaste] = useState<PasteState>(EMPTY_PASTE);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  // Route-driven preselect: tracked snapshot → last search results → server.
  useEffect(() => {
    if (!jobId) return;
    const local = tracked[jobId]?.job ?? jobsById[jobId] ?? null;
    if (local) {
      setJob(local);
      setMode('job');
      setJobError(null);
      return;
    }
    let cancelled = false;
    setLoadingJob(true);
    setJobError(null);
    api
      .getJob(jobId)
      .then((fetched) => {
        if (cancelled) return;
        setJob(fetched);
        setMode('job');
      })
      .catch(() => {
        if (cancelled) return;
        setJobError('That posting is no longer in the server cache. Pick another job or paste the description.');
      })
      .finally(() => {
        if (!cancelled) setLoadingJob(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the route changes; the stores are read as a snapshot on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const selectJob = useCallback(
    (next: Job) => {
      setJob(next);
      setMode('job');
      setJobError(null);
      if (next.id !== jobId) navigate(`/tailor/${encodeURIComponent(next.id)}`, { replace: true });
    },
    [jobId, navigate],
  );

  const usePaste = useCallback(() => {
    setMode('paste');
    setJobError(null);
  }, []);

  const activeJob = mode === 'job' ? job : null;
  const jobText = mode === 'job' ? jobTextOf(activeJob) : paste.text;
  const jobTitle = mode === 'job' ? activeJob?.title ?? '' : paste.title;
  const company = mode === 'job' ? activeJob?.company ?? '' : paste.company;

  const jobLike: MatchableJob = useMemo(
    () => ({
      title: jobTitle,
      descriptionText: jobText,
      tags: activeJob?.tags ?? [],
      category: activeJob?.category,
    }),
    [jobTitle, jobText, activeJob?.tags, activeJob?.category],
  );

  const match = useMemo(() => {
    if (!resume) return null;
    if (!jobText.trim() && !jobTitle.trim()) return null;
    return scoreJobMatch(resumeProfile(resume), jobLike);
  }, [resume, jobLike, jobText, jobTitle]);

  const hasJobText = jobText.trim().length > 0;

  if (!resume) {
    return (
      <div className="tl-page">
        <PageHeader title="Tailor" eyebrow="Match" description="Line a resume up against one specific job." />
        <EmptyState
          art="pen"
          title="You need a resume first"
          description="Tailoring compares a resume against a posting — keyword gap, ATS score and match all need one."
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  createResume({ fromSample: true });
                  navigate('/resume');
                }}
              >
                Start from the sample
              </Button>
              <Link className="tl-linkbtn" to="/resume">
                Open the resume builder
              </Link>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="tl-page">
      <PageHeader
        title="Tailor"
        eyebrow="Match"
        description="Line your resume up against one specific job — keywords, ATS score, AI rewrites and a cover letter."
        badge={
          jobTitle ? (
            <Badge tone="accent" variant="soft">
              {jobTitle}
              {company ? ` · ${company}` : ''}
            </Badge>
          ) : undefined
        }
      />

      <div className="tl-layout">
        <div className="tl-left stack-4">
          {loadingJob ? (
            <SkeletonText lines={4} label="Loading the job posting" />
          ) : (
            <>
              {jobError && (
                <p className="tl-warn" role="status">
                  {jobError}
                </p>
              )}
              <JobPicker
                mode={mode}
                selectedJobId={activeJob?.id ?? null}
                paste={paste}
                onSelectJob={selectJob}
                onPasteChange={(patch) => setPaste((p) => ({ ...p, ...patch }))}
                onUsePaste={usePaste}
              />
              <JdPreview job={activeJob} text={jobText} />
            </>
          )}
        </div>

        <div className="tl-right">
          <div className="tl-sticky">
            <div className="tl-resume-pick">
              <label className="visually-hidden" htmlFor="tl-resume">
                Resume to tailor
              </label>
              <Select
                id="tl-resume"
                uiSize="sm"
                value={resume.id}
                options={resumes.map((r) => ({ value: r.id, label: r.name }))}
                onChange={(e) => setActiveResume(e.target.value)}
              />
            </div>
            {match ? (
              <MatchTone score={match.score} label={matchLabel(match.score).label} tone={matchLabel(match.score).tone} showScore />
            ) : (
              <span className="small subtle">Pick a job to see your match</span>
            )}
          </div>

          {!hasJobText ? (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="Choose a job to tailor against"
              description="Pick a tracked application, one from your last search, or paste a description on the left."
            />
          ) : (
            <Tabs defaultValue="gap">
              <TabList aria-label="Tailoring tools" variant="underline">
                <Tab value="gap" icon={<KeyRound size={14} />}>
                  Keyword gap
                </Tab>
                <Tab value="ats" icon={<Gauge size={14} />}>
                  ATS vs this job
                </Tab>
                <Tab value="ai" icon={<Sparkles size={14} />}>
                  AI tailor
                </Tab>
                <Tab value="letter" icon={<PenLine size={14} />}>
                  Cover letter
                </Tab>
              </TabList>

              <TabPanel value="gap">
                <KeywordGap resume={resume} jobText={jobText} job={activeJob} />
              </TabPanel>
              <TabPanel value="ats">
                <AtsVsJob resume={resume} jobText={jobText} />
              </TabPanel>
              <TabPanel value="ai">
                <AiTailorPanel
                  resume={resume}
                  jobText={jobText}
                  jobTitle={jobTitle}
                  company={company}
                  jobId={activeJob?.id ?? null}
                />
              </TabPanel>
              <TabPanel value="letter">
                <CoverLetterPanel resume={resume} jobText={jobText} jobTitle={jobTitle} company={company} />
              </TabPanel>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
