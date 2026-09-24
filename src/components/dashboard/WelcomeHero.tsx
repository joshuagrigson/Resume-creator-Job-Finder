import { FilePlus, FileUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { ArtImage } from '@/components/ui/ArtImage';
import './dashboard.css';

export interface WelcomeHeroProps {
  /** Create a filled-in example resume and open the editor. */
  onStartSample: () => void;
  /** Create an empty resume and open the editor. */
  onStartBlank: () => void;
  /** Open the editor with the import panel. */
  onImport: () => void;
}

const FACTS = [
  { value: '9', label: 'job boards, one search' },
  { value: '5', label: 'resume templates' },
  { value: '0', label: 'accounts to create' },
];

const PILLARS = [
  {
    n: '01',
    title: 'Written for you',
    body: 'Say it the way you would to a friend. Polish rewrites it clean, and never adds a fact you didn’t give.',
  },
  {
    n: '02',
    title: 'Found near home',
    body: 'Nine job boards searched around your ZIP code, with the distance on every posting.',
  },
  {
    n: '03',
    title: 'Tracked to the offer',
    body: 'Every application, follow-up and resume version kept in one place, on your device.',
  },
];

/** First-run screen: an editorial welcome and three ways to get a resume into the app. */
export function WelcomeHero({ onStartSample, onStartBlank, onImport }: WelcomeHeroProps) {
  return (
    <>
      <section className="db-hero" aria-labelledby="db-hero-title">
        <div className="db-hero__copy">
          <p className="db-hero__eyebrow">Welcome to Launchpad</p>
          <h1 className="db-hero__title" id="db-hero-title">
            Write it once. <em>We’ll find where it belongs.</em>
          </h1>
          <p className="db-hero__lede">
            Tell us what you’ve done, in your own words. Launchpad turns it into a polished resume, then finds jobs near
            home you already qualify for — and a few worth reaching for.
          </p>

          <div className="db-hero__ctas">
            <Button variant="primary" size="lg" leftIcon={<FilePlus size={17} />} onClick={onStartBlank}>
              Build my resume
            </Button>
            <Button size="lg" leftIcon={<Sparkles size={17} />} onClick={onStartSample}>
              See a finished example
            </Button>
            <Button variant="ghost" size="lg" leftIcon={<FileUp size={17} />} onClick={onImport}>
              Import a resume
            </Button>
          </div>

          <dl className="db-hero__facts">
            {FACTS.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.value}</dt>
                <dd>{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="db-hero__art">
          <ArtImage
            name="desk"
            widths={[960, 1600]}
            sizes="(min-width: 1100px) 560px, 100vw"
            alt="A cream sheet of paper, a brass fountain pen and compass, and a navy notebook on an ivory desk in morning light"
            priority
          />
        </figure>
      </section>

      <ol className="db-pillars" aria-label="How Launchpad works">
        {PILLARS.map((pillar) => (
          <li key={pillar.n}>
            <span className="db-pillars__n" aria-hidden="true">
              {pillar.n}
            </span>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </li>
        ))}
      </ol>

      <p className="db-hero__note">Everything stays in this browser. No account, no upload — clear it any time from Settings.</p>
    </>
  );
}

export default WelcomeHero;
