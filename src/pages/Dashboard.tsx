/**
 * Dashboard — the landing page. Either a first-run welcome (no resume yet) or a grid of
 * cards that each answer one question: how good is my resume, what should I search for,
 * where are my applications, what is due, and what should I apply to next.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings2 } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { TopBarActions } from '@/components/layout';
import {
  ActiveResumeCard,
  BestMatchesCard,
  FollowUpsCard,
  PipelineCard,
  QuickSearchCard,
  TipsCard,
  WelcomeHero,
} from '@/components/dashboard';
import '@/components/dashboard/dashboard.css';
import { useActiveResume, useResumeList, useResumeStore } from '@/stores/resumeStore';
import { useTrackedJobs } from '@/stores/jobStore';

function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const resumes = useResumeList();
  const activeResume = useActiveResume();
  const createResume = useResumeStore((s) => s.createResume);
  const tracked = useTrackedJobs();

  const startSample = useCallback(() => {
    createResume({ fromSample: true });
    navigate('/resume');
  }, [createResume, navigate]);

  const startBlank = useCallback(() => {
    createResume({ name: 'My resume' });
    navigate('/resume');
  }, [createResume, navigate]);

  const startImport = useCallback(() => {
    navigate('/resume?import=1');
  }, [navigate]);

  if (resumes.length === 0) {
    return (
      <div className="db-page">
        <WelcomeHero onStartSample={startSample} onStartBlank={startBlank} onImport={startImport} />

        <div className="db-grid">
          <QuickSearchCard className="db-card" />
          <TipsCard className="db-card" />
        </div>
      </div>
    );
  }

  const firstName = activeResume?.contact.fullName.trim().split(/\s+/)[0] ?? '';
  const otherCount = Math.max(0, resumes.length - 1);
  const resume = activeResume ?? resumes[0];

  return (
    <div className="db-page">
      <TopBarActions>
        <Button size="sm" leftIcon={<Search size={15} />} onClick={() => navigate('/jobs')}>
          Find jobs
        </Button>
        <Button size="sm" variant="ghost" leftIcon={<Settings2 size={15} />} onClick={() => navigate('/settings')}>
          Settings
        </Button>
      </TopBarActions>

      <PageHeader
        eyebrow="Dashboard"
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Your resume, your pipeline and the roles worth applying to next — all in one view."
      />

      <div className="db-grid">
        {resume ? <ActiveResumeCard className="db-card db-grid__wide" resume={resume} otherCount={otherCount} /> : null}
        <QuickSearchCard className="db-card" />
        <BestMatchesCard className="db-card db-grid__wide" resume={resume} />
        <PipelineCard className="db-card" tracked={tracked} />
        <FollowUpsCard className="db-card" tracked={tracked} />
        <TipsCard className="db-card" />
      </div>
    </div>
  );
}
