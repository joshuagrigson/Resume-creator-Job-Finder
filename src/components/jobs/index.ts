/**
 * Job finder UI — search bar, filters, result cards, detail panel and the match hook.
 *
 *   import { JobList, JobDetail, useJobMatches } from '@/components/jobs';
 */

export { SearchBar, type SearchBarProps } from './SearchBar';
export { FiltersBar, type FiltersBarProps, type SortMode } from './FiltersBar';
export { JobCard, type JobCardProps } from './JobCard';
export { JobList, type JobListProps } from './JobList';
export { JobDetail, type JobDetailProps } from './JobDetail';
export { MatchBadge, type MatchBadgeProps } from './MatchBadge';
export { SourceStatusStrip, type SourceStatusStripProps } from './SourceStatusStrip';
export { SavedSearches, type SavedSearchesProps } from './SavedSearches';
export { Pagination, type PaginationProps } from './Pagination';

export { useJobMatches, useResumeProfile } from './useJobMatches';
export { sanitizeJobHtml, textParagraphs } from './sanitize';
export {
  EMPLOYMENT_TYPE_LABELS,
  abbreviateAmount,
  absoluteDate,
  companyInitial,
  describeQuery,
  formatDuration,
  formatSalary,
  jobPermalink,
  locationLabel,
  pageCount,
  rangeLabel,
  relativeTime,
  sourceLabel,
  sourceStatusMeta,
} from './format';
