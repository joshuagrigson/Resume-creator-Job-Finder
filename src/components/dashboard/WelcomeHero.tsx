import { FileUp, FilePlus, Rocket, Search, Sparkles, Target, Kanban } from 'lucide-react';
import { Button } from '@/components/ui';
import './dashboard.css';

export interface WelcomeHeroProps {
  /** Create a filled-in example resume and open the editor. */
  onStartSample: () => void;
  /** Create an empty resume and open the editor. */
  onStartBlank: () => void;
  /** Open the editor with the import panel. */
  onImport: () => void;
}

const HIGHLIGHTS = [
  {
    icon: <Sparkles size={16} aria-hidden="true" />,
    title: 'ATS-ready resumes',
    body: 'Five templates, a live preview and a score that tells you what to fix.',
  },
  {
    icon: <Search size={16} aria-hidden="true" />,
    title: 'Eight job boards, one search',
    body: 'Results are de-duplicated and ranked, not scattered across tabs.',
  },
  {
    icon: <Target size={16} aria-hidden="true" />,
    title: 'A match score for every job',
    body: 'Scored against your resume in your browser — nothing is uploaded.',
  },
  {
    icon: <Kanban size={16} aria-hidden="true" />,
    title: 'Applications you can track',
    body: 'A kanban board with notes, follow-up dates and the resume you sent.',
  },
];

/** First-run screen: three ways to get a resume into the app. */
export function WelcomeHero({ onStartSample, onStartBlank, onImport }: WelcomeHeroProps) {
  return (
    <section className="db-hero" aria-labelledby="db-hero-title">
      <div>
        <p className="db-hero__eyebrow">
          <Rocket size={14} aria-hidden="true" />
          Welcome to Launchpad
        </p>
        <h1 className="db-hero__title" id="db-hero-title">
          Build the resume first. The job search gets easier from there.
        </h1>
        <p className="db-hero__lede">
          Launchpad keeps your resume and your job hunt in one place: write it, score it against the roles you actually
          want, and track every application. Start with the example if you want to see the whole thing working in ten
          seconds.
        </p>

        <div className="db-hero__ctas">
          <Button variant="primary" size="lg" leftIcon={<Sparkles size={16} />} onClick={onStartSample}>
            Start from sample
          </Button>
          <Button size="lg" leftIcon={<FilePlus size={16} />} onClick={onStartBlank}>
            Start blank
          </Button>
          <Button variant="ghost" size="lg" leftIcon={<FileUp size={16} />} onClick={onImport}>
            Import a resume
          </Button>
        </div>

        <p className="db-hero__note">
          Everything stays in this browser. No account, no upload — clear it any time from Settings.
        </p>
      </div>

      <div className="db-hero__aside">
        <h2>What you get</h2>
        <ul className="db-hero__list">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title}>
              {item.icon}
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default WelcomeHero;
