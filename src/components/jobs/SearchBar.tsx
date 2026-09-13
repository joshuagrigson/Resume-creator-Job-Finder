import { type FormEvent } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import './jobs.css';

export interface SearchBarProps {
  keywords: string;
  location: string;
  loading?: boolean;
  onKeywordsChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  /** Called on submit (button click or Enter in either field). */
  onSubmit: () => void;
}

/** Keywords + location + Search. Submitting the form is the only way to start a search. */
export function SearchBar({ keywords, location, loading, onKeywordsChange, onLocationChange, onSubmit }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="jf-searchbar" role="search" aria-label="Search jobs" onSubmit={handleSubmit}>
      <div className="jf-searchbar__field">
        <label className="visually-hidden" htmlFor="jf-keywords">
          Job title, skill or company
        </label>
        <Input
          id="jf-keywords"
          name="keywords"
          type="search"
          value={keywords}
          placeholder="Job title, skill or company"
          leftIcon={<Search size={15} />}
          autoComplete="off"
          onChange={(e) => onKeywordsChange(e.target.value)}
        />
      </div>

      <div className="jf-searchbar__field">
        <label className="visually-hidden" htmlFor="jf-location">
          City, state or country
        </label>
        <Input
          id="jf-location"
          name="location"
          type="search"
          value={location}
          placeholder="City, state or country"
          leftIcon={<MapPin size={15} />}
          autoComplete="off"
          onChange={(e) => onLocationChange(e.target.value)}
        />
      </div>

      <Button type="submit" variant="primary" className="jf-searchbar__submit" loading={loading} leftIcon={<Search size={15} />}>
        Search
      </Button>
    </form>
  );
}
