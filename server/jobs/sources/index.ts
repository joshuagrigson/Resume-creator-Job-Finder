/**
 * The adapter registry. Order here is the order reports come back in.
 */
import type { JobSource } from '../../../shared/types';
import type { JobSourceAdapter } from '../types';
import { adzunaSource } from './adzuna';
import { arbeitnowSource } from './arbeitnow';
import { himalayasSource } from './himalayas';
import { jobicySource } from './jobicy';
import { jsearchSource } from './jsearch';
import { remoteOkSource } from './remoteok';
import { remotiveSource } from './remotive';
import { theMuseSource } from './themuse';
import { usaJobsSource } from './usajobs';

export const ALL_SOURCES: readonly JobSourceAdapter[] = [
  remotiveSource,
  remoteOkSource,
  arbeitnowSource,
  theMuseSource,
  jobicySource,
  himalayasSource,
  adzunaSource,
  usaJobsSource,
  jsearchSource,
] as const;

const BY_NAME = new Map<JobSource, JobSourceAdapter>(ALL_SOURCES.map((adapter) => [adapter.source, adapter]));

export function getSourceAdapter(source: JobSource): JobSourceAdapter | undefined {
  return BY_NAME.get(source);
}

export {
  adzunaSource,
  arbeitnowSource,
  himalayasSource,
  jobicySource,
  jsearchSource,
  remoteOkSource,
  remotiveSource,
  theMuseSource,
  usaJobsSource,
};
