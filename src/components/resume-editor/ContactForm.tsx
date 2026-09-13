/** Name, headline and the contact lines that print in the resume header. */
import { AtSign, Github, Globe, Linkedin, MapPin, Phone } from 'lucide-react';
import type { ContactInfo, ResumeId } from '@shared/types';
import { Field, Input } from '@/components/ui';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ContactFormProps {
  resumeId: ResumeId;
}

export function ContactForm({ resumeId }: ContactFormProps) {
  const contact = useResumeSlice(resumeId, (r) => r.contact);
  const update = useResumeUpdate(resumeId);

  if (!contact) return null;

  const set = (key: keyof ContactInfo, value: string) =>
    update((r) => ({ ...r, contact: { ...r.contact, [key]: value } }));

  const emailInvalid = contact.email.trim().length > 0 && !EMAIL_RE.test(contact.email.trim());

  return (
    <div className="re-grid">
      <Field label="Full name" required className="re-grid__wide">
        <Input
          value={contact.fullName}
          autoComplete="name"
          placeholder="Jordan Rivera"
          onChange={(e) => set('fullName', e.target.value)}
        />
      </Field>

      <Field
        label="Headline"
        hint="The role you are targeting — this prints under your name."
        className="re-grid__wide"
      >
        <Input
          value={contact.headline}
          placeholder="Marketing Operations Manager"
          onChange={(e) => set('headline', e.target.value)}
        />
      </Field>

      <Field label="Email" error={emailInvalid ? 'That does not look like an email address.' : undefined}>
        <Input
          type="email"
          value={contact.email}
          autoComplete="email"
          leftIcon={<AtSign size={14} />}
          placeholder="you@example.com"
          onChange={(e) => set('email', e.target.value)}
        />
      </Field>

      <Field label="Phone">
        <Input
          type="tel"
          value={contact.phone}
          autoComplete="tel"
          leftIcon={<Phone size={14} />}
          placeholder="(555) 555-0142"
          onChange={(e) => set('phone', e.target.value)}
        />
      </Field>

      <Field label="Location" hint="City and state, or “Remote (US)”.">
        <Input
          value={contact.location}
          autoComplete="address-level2"
          leftIcon={<MapPin size={14} />}
          placeholder="Austin, TX"
          onChange={(e) => set('location', e.target.value)}
        />
      </Field>

      <Field label="Website">
        <Input
          value={contact.website}
          leftIcon={<Globe size={14} />}
          placeholder="yourname.dev"
          onChange={(e) => set('website', e.target.value)}
        />
      </Field>

      <Field label="LinkedIn">
        <Input
          value={contact.linkedin}
          leftIcon={<Linkedin size={14} />}
          placeholder="linkedin.com/in/yourname"
          onChange={(e) => set('linkedin', e.target.value)}
        />
      </Field>

      <Field label="GitHub">
        <Input
          value={contact.github}
          leftIcon={<Github size={14} />}
          placeholder="github.com/yourname"
          onChange={(e) => set('github', e.target.value)}
        />
      </Field>
    </div>
  );
}
