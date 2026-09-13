/**
 * Building blocks shared by every resume template.
 *
 * Templates own the *header* and the *section-title chrome*; the section bodies below are
 * common so that content, ordering and ATS-friendliness never drift between templates.
 * Everything renders as real semantic text — headings, paragraphs and `<ul><li>` bullets —
 * so an applicant tracking system can parse the PDF.
 */

import type { ReactNode } from 'react';
import type { Resume } from '@shared/types';
import { cx } from '@/components/ui';
import {
  certificationDate,
  certificationLine,
  cleanList,
  contactEntries,
  displayUrl,
  educationDates,
  educationDegreeLine,
  educationMeta,
  experienceDates,
  linkHref,
  projectMeta,
  sectionItems,
  type ResumeSection,
} from '@/lib/export/format';
import type {
  CertificationItem,
  CustomSectionItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SkillGroup,
} from '@shared/types';

/** How a template wants item headers laid out. */
export interface SectionVariant {
  /** `'inline'` prints "Title, Company" on one line; `'stacked'` gives the company its own line. */
  itemHeader?: 'inline' | 'stacked';
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cx('rp-section-title', className)}>
      <span className="rp-section-title-text">{children}</span>
    </h2>
  );
}

export function DateRange({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <span className={cx('rp-dates', className)}>{children}</span>;
}

/**
 * The contact line. Links render as their display text (no protocol, no icons) which keeps
 * the printed page ATS-parsable while staying clickable in the PDF.
 */
export function ContactLine({
  resume,
  className,
  separator = '·',
  layout = 'row',
}: {
  resume: Resume;
  className?: string;
  separator?: string;
  layout?: 'row' | 'stack';
}) {
  const entries = contactEntries(resume.contact);
  if (entries.length === 0) return null;
  return (
    <ul className={cx('rp-contact', `rp-contact--${layout}`, className)}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="rp-contact-item">
          {layout === 'row' && index > 0 ? (
            <span className="rp-contact-sep" aria-hidden="true">
              {separator}
            </span>
          ) : null}
          {entry.href ? (
            <a className="rp-link" href={entry.href} rel="noopener noreferrer">
              {entry.text}
            </a>
          ) : (
            <span>{entry.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function BulletList({ items, className }: { items: readonly string[]; className?: string }) {
  const bullets = cleanList(items);
  if (bullets.length === 0) return null;
  return (
    <ul className={cx('rp-bullets', className)}>
      {bullets.map((bullet, index) => (
        <li key={index} className="rp-bullet">
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function ItemHead({
  title,
  org,
  orgHref,
  dates,
  meta,
  variant,
}: {
  title: string;
  org?: string;
  orgHref?: string;
  dates?: string;
  meta?: string;
  variant: SectionVariant;
}) {
  const inline = (variant.itemHeader ?? 'stacked') === 'inline';
  const orgNode = org ? (
    orgHref ? (
      <a className="rp-link rp-item-org" href={orgHref} rel="noopener noreferrer">
        {org}
      </a>
    ) : (
      <span className="rp-item-org">{org}</span>
    )
  ) : null;

  return (
    <div className="rp-item-head">
      <div className="rp-item-headline">
        {inline ? (
          <h3 className="rp-item-title">
            {title}
            {title && org ? <span className="rp-item-title-sep">, </span> : null}
            {orgNode}
          </h3>
        ) : (
          <>
            {title ? <h3 className="rp-item-title">{title}</h3> : null}
            {orgNode}
          </>
        )}
      </div>
      {dates || meta ? (
        <div className="rp-item-meta">
          <DateRange>{dates}</DateRange>
          {meta ? <span className="rp-item-loc">{meta}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section bodies
// ---------------------------------------------------------------------------

function ExperienceBody({ items, variant }: { items: ExperienceItem[]; variant: SectionVariant }) {
  return (
    <div className="rp-items">
      {items.map((item) => (
        <article className="rp-item rp-item--experience" key={item.id}>
          <ItemHead
            title={(item.title ?? '').trim()}
            org={(item.company ?? '').trim()}
            dates={experienceDates(item)}
            meta={(item.location ?? '').trim()}
            variant={variant}
          />
          <BulletList items={item.bullets ?? []} />
        </article>
      ))}
    </div>
  );
}

function EducationBody({ items, variant }: { items: EducationItem[]; variant: SectionVariant }) {
  return (
    <div className="rp-items">
      {items.map((item) => (
        <article className="rp-item rp-item--education" key={item.id}>
          <ItemHead
            title={(item.school ?? '').trim()}
            org={educationDegreeLine(item)}
            dates={educationDates(item)}
            meta={educationMeta(item)}
            variant={variant}
          />
          <BulletList items={item.details ?? []} />
        </article>
      ))}
    </div>
  );
}

function SkillsBody({ items }: { items: SkillGroup[] }) {
  return (
    <ul className="rp-skills">
      {items.map((group) => {
        const name = (group.name ?? '').trim();
        const values = cleanList(group.skills).join(', ');
        return (
          <li className={cx('rp-skill-group', !name && 'rp-skill-group--unlabelled')} key={group.id}>
            {name ? <span className="rp-skill-label">{name}</span> : null}
            <span className="rp-skill-values">{values}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ProjectsBody({ items, variant }: { items: ProjectItem[]; variant: SectionVariant }) {
  return (
    <div className="rp-items">
      {items.map((item) => {
        const tech = projectMeta(item);
        const description = (item.description ?? '').trim();
        const url = displayUrl(item.url);
        return (
          <article className="rp-item rp-item--project" key={item.id}>
            <ItemHead title={(item.name ?? '').trim()} variant={variant} />
            {url ? (
              <p className="rp-item-linkline">
                <a className="rp-link" href={linkHref(item.url)} rel="noopener noreferrer">
                  {url}
                </a>
              </p>
            ) : null}
            {description ? <p className="rp-item-desc">{description}</p> : null}
            <BulletList items={item.bullets ?? []} />
            {tech ? (
              <p className="rp-item-tech">
                <span className="rp-item-tech-label">Tech:</span> {tech}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CertificationsBody({ items }: { items: CertificationItem[] }) {
  return (
    <ul className="rp-certs">
      {items.map((item) => {
        const label = certificationLine(item);
        const date = certificationDate(item);
        return (
          <li className="rp-cert" key={item.id}>
            <span className="rp-cert-name">
              {item.url ? (
                <a className="rp-link" href={linkHref(item.url)} rel="noopener noreferrer">
                  {label}
                </a>
              ) : (
                label
              )}
            </span>
            <DateRange>{date}</DateRange>
          </li>
        );
      })}
    </ul>
  );
}

function CustomBody({ items, variant }: { items: CustomSectionItem[]; variant: SectionVariant }) {
  return (
    <div className="rp-items">
      {items.map((item) => (
        <article className="rp-item rp-item--custom" key={item.id}>
          <ItemHead
            title={(item.heading ?? '').trim()}
            org={(item.subheading ?? '').trim()}
            dates={(item.date ?? '').trim()}
            variant={variant}
          />
          <BulletList items={item.bullets ?? []} />
        </article>
      ))}
    </div>
  );
}

/** Renders the body of any section — the dispatcher every template uses. */
export function SectionBody({
  resume,
  section,
  variant = {},
}: {
  resume: Resume;
  section: ResumeSection;
  variant?: SectionVariant;
}) {
  switch (section.kind) {
    case 'summary':
      return <p className="rp-summary">{(resume.summary ?? '').trim()}</p>;
    case 'experience':
      return <ExperienceBody items={sectionItems(resume, section) as ExperienceItem[]} variant={variant} />;
    case 'education':
      return <EducationBody items={sectionItems(resume, section) as EducationItem[]} variant={variant} />;
    case 'skills':
      return <SkillsBody items={sectionItems(resume, section) as SkillGroup[]} />;
    case 'projects':
      return <ProjectsBody items={sectionItems(resume, section) as ProjectItem[]} variant={variant} />;
    case 'certifications':
      return <CertificationsBody items={sectionItems(resume, section) as CertificationItem[]} />;
    case 'custom':
      return <CustomBody items={sectionItems(resume, section) as CustomSectionItem[]} variant={variant} />;
    default:
      return null;
  }
}

/** A titled section block — the shape every template repeats down the page. */
export function SectionBlock({
  resume,
  section,
  variant,
  titleClassName,
}: {
  resume: Resume;
  section: ResumeSection;
  variant?: SectionVariant;
  titleClassName?: string;
}) {
  return (
    <section className={cx('rp-section', `rp-section--${section.kind}`)} data-section={section.key}>
      <SectionTitle className={titleClassName}>{section.title}</SectionTitle>
      <SectionBody resume={resume} section={section} variant={variant} />
    </section>
  );
}

/** "Jordan Rivera" + headline, used by the templates that share a plain text header. */
export function NameBlock({
  resume,
  className,
  nameClassName,
}: {
  resume: Resume;
  className?: string;
  nameClassName?: string;
}) {
  const name = (resume.contact?.fullName ?? '').trim();
  const headline = (resume.contact?.headline ?? '').trim();
  if (!name && !headline) return null;
  return (
    <div className={cx('rp-nameblock', className)}>
      {name ? <h1 className={cx('rp-name', nameClassName)}>{name}</h1> : null}
      {headline ? <p className="rp-headline">{headline}</p> : null}
    </div>
  );
}
