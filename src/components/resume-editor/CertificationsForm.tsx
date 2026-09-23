/** Licences and certifications: name, issuer, date, credential link. */
import { Plus } from 'lucide-react';
import type { CertificationItem, ResumeId } from '@shared/types';
import { Button, EmptyState, Field, Input, useToast } from '@/components/ui';
import { createCertificationItem } from '@/lib/resume/defaults';
import { uid } from '@/lib/id';
import { DateInput } from './DateInput';
import { ItemToolbar } from './ItemToolbar';
import { moveItem } from './sections';
import { useResumeSlice, useResumeUpdate } from './store-hooks';

export interface CertificationsFormProps {
  resumeId: ResumeId;
}

export function CertificationsForm({ resumeId }: CertificationsFormProps) {
  const certifications = useResumeSlice(resumeId, (r) => r.certifications);
  const update = useResumeUpdate(resumeId);
  const toast = useToast();

  if (!certifications) return null;

  const setItems = (next: CertificationItem[]) => update((r) => ({ ...r, certifications: next }));
  const patch = (id: string, changes: Partial<CertificationItem>) =>
    setItems(certifications.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => setItems([...certifications, createCertificationItem()]);

  const remove = (index: number) => {
    const removed = certifications[index];
    if (!removed) return;
    setItems(certifications.filter((_, i) => i !== index));
    toast.push({
      title: `Removed ${removed.name.trim() || 'certification'}`,
      tone: 'info',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () =>
          update((r) => {
            const next = [...r.certifications];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...r, certifications: next };
          }),
      },
    });
  };

  return (
    <div className="stack-4">
      {certifications.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          title="No certifications"
          description="Licences, safety cards and platform certifications all count."
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={add}>
              Add a certification
            </Button>
          }
        />
      ) : null}

      {certifications.map((item, index) => (
        <article className="re-item" key={item.id}>
          <header className="re-item__head">
            <h4 className="re-item__title">{item.name.trim() || 'Untitled certification'}</h4>
            <ItemToolbar
              itemLabel={item.name.trim() || 'certification'}
              index={index}
              count={certifications.length}
              onMove={(dir) => setItems(moveItem(certifications, index, dir === 'up' ? index - 1 : index + 1))}
              onDuplicate={() => {
                const next = [...certifications];
                next.splice(index + 1, 0, { ...item, id: uid('crt') });
                setItems(next);
              }}
              onDelete={() => remove(index)}
            />
          </header>

          <div className="re-grid">
            <Field label="Certification">
              <Input spellFix
                value={item.name}
                placeholder="HubSpot Marketing Software"
                onChange={(e) => patch(item.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Issuer">
              <Input
                value={item.issuer}
                placeholder="HubSpot Academy"
                onChange={(e) => patch(item.id, { issuer: e.target.value })}
              />
            </Field>
            <DateInput label="Earned" value={item.date} onChange={(v) => patch(item.id, { date: v })} />
            <Field label="Credential link" hint="Optional.">
              <Input
                value={item.url}
                inputMode="url"
                placeholder="verify.example.com/abc123"
                onChange={(e) => patch(item.id, { url: e.target.value })}
              />
            </Field>
          </div>
        </article>
      ))}

      {certifications.length > 0 ? (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={add}>
          Add a certification
        </Button>
      ) : null}
    </div>
  );
}
