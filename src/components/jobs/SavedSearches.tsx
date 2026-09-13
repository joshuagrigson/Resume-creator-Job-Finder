import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import type { JobSearchQuery } from '@shared/types';
import { Button, Chip, Field, IconButton, Input, Modal } from '@/components/ui';
import type { SavedSearch } from '@/stores/jobStore';
import { describeQuery } from './format';
import './jobs.css';

export interface SavedSearchesProps {
  searches: readonly SavedSearch[];
  /** The query the "Save this search" button would store. */
  currentQuery: JobSearchQuery;
  onRun: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onSave: (name: string, query: JobSearchQuery) => void;
}

/** Saved-search chips plus the "Save this search" prompt. */
export function SavedSearches({ searches, currentQuery, onRun, onDelete, onSave }: SavedSearchesProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestion = describeQuery(currentQuery.q, currentQuery.location, currentQuery.remoteOnly);

  useEffect(() => {
    if (open) setName(suggestion);
  }, [open, suggestion]);

  function submit() {
    const trimmed = name.trim() || suggestion;
    onSave(trimmed, currentQuery);
    setOpen(false);
  }

  return (
    <div className="jf-saved">
      <span className="jf-saved__label">Saved searches</span>

      {searches.length === 0 ? (
        <span className="small subtle">None yet — save a search to run it again in one click.</span>
      ) : (
        searches.map((search) => (
          <span key={search.id} className="jf-saved__chip">
            <Chip
              tone="accent"
              leftIcon={<Star size={12} />}
              onToggle={() => onRun(search)}
              title={`Run "${search.name}"`}
            >
              {search.name}
            </Chip>
            <IconButton
              size="sm"
              label={`Delete saved search ${search.name}`}
              icon={<X size={13} />}
              onClick={() => onDelete(search.id)}
            />
          </span>
        ))
      )}

      <Button size="sm" variant="ghost" leftIcon={<Star size={14} />} onClick={() => setOpen(true)}>
        Save this search
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Save this search"
        description="Saved searches sit above the results so you can re-run them in one click."
        size="sm"
        initialFocusRef={inputRef}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit}>
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Name" hint="Keywords, location, remote and board filters are stored with it.">
            <Input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestion} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
