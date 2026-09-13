import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import type { JobSearchQuery } from '@shared/types';
import { Button, Card, Chip, Field, Input } from '@/components/ui';
import { useJobStore } from '@/stores/jobStore';
import type { SavedSearch } from '@/stores/jobStore';
import './dashboard.css';

export interface QuickSearchCardProps {
  className?: string;
}

/** Keyword + location straight into the job finder, plus one-tap saved searches. */
export function QuickSearchCard({ className }: QuickSearchCardProps) {
  const navigate = useNavigate();
  const query = useJobStore((s) => s.query);
  const setQuery = useJobStore((s) => s.setQuery);
  const search = useJobStore((s) => s.search);
  const savedSearches = useJobStore((s) => s.savedSearches);

  const [keywords, setKeywords] = useState(query.q ?? '');
  const [location, setLocation] = useState(query.location ?? '');

  function run(patch: Partial<JobSearchQuery>) {
    setQuery({ ...patch, page: 1 });
    void search({ ...patch, page: 1 });
    navigate('/jobs');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run({ q: keywords.trim(), location: location.trim() });
  }

  function runSaved(saved: SavedSearch) {
    setKeywords(saved.query.q ?? '');
    setLocation(saved.query.location ?? '');
    run({ ...saved.query });
  }

  return (
    <Card
      className={className}
      title="Find jobs"
      subtitle="Searches eight boards at once and scores each result against your resume."
    >
      <form className="db-search" onSubmit={onSubmit}>
        <div className="db-search__row">
          <Field label="Keywords" hint="Job title, skill or company">
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Marketing operations"
              leftIcon={<Search size={15} aria-hidden="true" />}
              autoComplete="off"
              name="keywords"
            />
          </Field>
          <Field label="Location" hint='City, country, or "remote"'>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote"
              leftIcon={<MapPin size={15} aria-hidden="true" />}
              autoComplete="off"
              name="location"
            />
          </Field>
        </div>

        <div className="row row-end">
          <Button type="submit" variant="primary" leftIcon={<Search size={15} />}>
            Search jobs
          </Button>
        </div>

        {savedSearches.length > 0 ? (
          <div className="db-search__saved">
            <span className="db-search__saved-label" id="db-saved-label">
              Saved
            </span>
            <span className="row row-wrap" role="group" aria-labelledby="db-saved-label">
              {savedSearches.slice(0, 3).map((saved) => (
                <Chip key={saved.id} onToggle={() => runSaved(saved)}>
                  {saved.name}
                </Chip>
              ))}
            </span>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

export default QuickSearchCard;
