/**
 * Resume builder — editor on the left, live page preview on the right.
 *
 * Under 900px the two panes become tabs. Everything is saved as you type (zustand + localStorage),
 * so the only "save" affordance is the freshness indicator in the header.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, FileUp, Palette, Sparkles, Upload } from 'lucide-react';
import { AtsPanel } from '@/components/resume-editor/AtsPanel';
import { ExportMenu } from '@/components/resume-editor/ExportMenu';
import { ImportDialog } from '@/components/resume-editor/ImportDialog';
import { PreviewFrame } from '@/components/resume-editor/PreviewFrame';
import { ResumeEditor } from '@/components/resume-editor/ResumeEditor';
import { ResumeSwitcher } from '@/components/resume-editor/ResumeSwitcher';
import { StylePanel } from '@/components/resume-editor/StylePanel';
import '@/components/resume-editor/editor.css';
import { ArtImage } from '@/components/ui/ArtImage';
import {
  Button,
  Card,
  Drawer,
  PageHeader,
  Popover,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  scoreTone,
} from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { analyzeResume, atsScoreLabel } from '@/lib/resume/ats';
import { useActiveResume, useResumeStore } from '@/stores/resumeStore';

/** Below this width the editor and the preview become tabs instead of two panes. */
const PANE_STACK_MAX = 899;

export default function ResumeBuilderPage() {
  const { resumeId: routeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();

  const activeId = useResumeStore((s) => s.activeResumeId);
  const routeExists = useResumeStore((s) => (routeId ? Boolean(s.resumes[routeId]) : false));
  const setActiveResume = useResumeStore((s) => s.setActiveResume);
  const createResume = useResumeStore((s) => s.createResume);
  const resume = useActiveResume();

  // The dashboard's "Import a resume" CTA links to /resume?import=1 — open on arrival,
  // then strip the param so Back or a refresh does not reopen the dialog.
  const [params, setParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(() => params.get('import') === '1');
  useEffect(() => {
    if (params.get('import') !== '1') return;
    setImportOpen(true);
    const next = new URLSearchParams(params);
    next.delete('import');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const [atsOpen, setAtsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  const narrow = useMediaQuery(`(max-width: ${PANE_STACK_MAX}px)`);

  // Deep link: /resume/:resumeId selects that resume when it exists.
  useEffect(() => {
    if (!routeId) return;
    if (!routeExists) navigate('/resume', { replace: true });
    else if (routeId !== activeId) setActiveResume(routeId);
  }, [routeId, routeExists, activeId, setActiveResume, navigate]);

  const goTo = (id: string) => {
    setActiveResume(id);
    navigate(`/resume/${id}`);
  };

  const debounced = useDebounce(resume, 400);
  const report = useMemo(() => (debounced ? analyzeResume(debounced) : null), [debounced]);

  if (!resume) {
    return (
      <WelcomeCard
        onSample={() => goTo(createResume({ fromSample: true }))}
        onBlank={() => goTo(createResume({ name: 'Untitled resume' }))}
        onImport={() => setImportOpen(true)}
        importOpen={importOpen}
        onCloseImport={() => setImportOpen(false)}
        onImported={goTo}
      />
    );
  }

  const stylePanel = <StylePanel resumeId={resume.id} />;

  const toolbar = (
    <div className="re-toolbar">
      <ResumeSwitcher activeId={resume.id} onSelect={goTo} />

      <button
        type="button"
        className={`re-atschip re-atschip--${report ? scoreTone(report.score) : 'info'}`}
        onClick={() => setAtsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={atsOpen}
      >
        <span className="re-atschip__num">{report ? Math.round(report.score) : '—'}</span>
        <span className="re-atschip__text">
          Score
          <span className="re-atschip__label">{report ? atsScoreLabel(report.score) : 'Checking'}</span>
        </span>
      </button>

      {narrow ? (
        <Button variant="secondary" leftIcon={<Palette size={15} />} onClick={() => setStyleOpen(true)}>
          Style
        </Button>
      ) : (
        <Popover
          open={styleOpen}
          onOpenChange={setStyleOpen}
          align="end"
          label="Template and style"
          className="re-stylepop"
          trigger={
            <Button variant="secondary" leftIcon={<Palette size={15} />}>
              Style
            </Button>
          }
        >
          {stylePanel}
        </Popover>
      )}

      <Button variant="secondary" leftIcon={<Upload size={15} />} onClick={() => setImportOpen(true)}>
        Import
      </Button>

      <ExportMenu resume={resume} />
    </div>
  );

  const editorPane = <ResumeEditor resumeId={resume.id} />;
  const previewPane = <PreviewFrame resume={resume} />;

  return (
    <div className="re-page">
      <PageHeader
        className="no-print"
        eyebrow="Resume"
        title={resume.name}
        description="Edit on the left; the sheet on the right is exactly what prints."
        badge={<SavedIndicator updatedAt={resume.updatedAt} />}
        actions={toolbar}
      />

      {narrow ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'edit' | 'preview')}>
          <TabList aria-label="Resume builder panes" variant="pills" className="no-print">
            <Tab value="edit">Edit</Tab>
            <Tab value="preview">Preview</Tab>
          </TabList>
          <TabPanel value="edit" className="no-print">{editorPane}</TabPanel>
          {/*
            keepMounted: below 900px the panes are tabs, and an unmounted preview meant
            a browser print from the Edit tab produced a blank page. The hidden panel
            costs one extra render; PreviewFrame falls back to scale 1 while its width
            measures 0 and the ResizeObserver corrects it when the tab becomes visible.
          */}
          <TabPanel value="preview" keepMounted>{previewPane}</TabPanel>
        </Tabs>
      ) : (
        <div className="re-split">
          <div className="re-split__editor no-print">{editorPane}</div>
          <aside className="re-split__preview" aria-label="Live resume preview">
            {previewPane}
          </aside>
        </div>
      )}

      <Drawer open={atsOpen} onClose={() => setAtsOpen(false)} side="right" size={440} title="ATS check">
        {report ? <AtsPanel report={report} /> : null}
      </Drawer>

      {narrow ? (
        <Drawer open={styleOpen} onClose={() => setStyleOpen(false)} side="bottom" title="Template and style">
          {stylePanel}
        </Drawer>
      ) : null}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={goTo} />
    </div>
  );
}

interface WelcomeCardProps {
  onSample: () => void;
  onBlank: () => void;
  onImport: () => void;
  importOpen: boolean;
  onCloseImport: () => void;
  onImported: (id: string) => void;
}

function WelcomeCard({ onSample, onBlank, onImport, importOpen, onCloseImport, onImported }: WelcomeCardProps) {
  return (
    <div className="re-page">
      <PageHeader
        eyebrow="Resume"
        title="Build your resume"
        description="Everything stays in this browser. Start from a filled-in example, a blank page, or import what you already have."
      />

      <Card className="re-welcome" padding="lg">
        <ArtImage
          className="re-welcome__art"
          name="pen"
          widths={[360, 720]}
          sizes="(min-width: 900px) 260px, 60vw"
          alt="A brass fountain pen resting on a blank cream page"
        />
        <ul className="re-welcome__grid">
          <li>
            <button type="button" className="re-welcome__card" onClick={onSample}>
              <Sparkles size={20} aria-hidden="true" />
              <span className="re-welcome__title">Start from a sample</span>
              <span className="re-welcome__desc">
                A complete marketing-operations resume you can edit into your own. Best way to see how it works.
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="re-welcome__card" onClick={onBlank}>
              <Check size={20} aria-hidden="true" />
              <span className="re-welcome__title">Start blank</span>
              <span className="re-welcome__desc">An empty resume with one role ready to fill in.</span>
            </button>
          </li>
          <li>
            <button type="button" className="re-welcome__card" onClick={onImport}>
              <FileUp size={20} aria-hidden="true" />
              <span className="re-welcome__title">Import</span>
              <span className="re-welcome__desc">Paste the text of your current resume, or upload a JSON export.</span>
            </button>
          </li>
        </ul>
      </Card>

      <ImportDialog open={importOpen} onClose={onCloseImport} onImported={onImported} />
    </div>
  );
}

function SavedIndicator({ updatedAt }: { updatedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="re-saved" role="status">
      <Check size={13} aria-hidden="true" />
      Saved · {relativeTime(updatedAt)}
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'just now';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
