/**
 * The answer to "What are your pay expectations?" — filled in from the posting itself.
 *
 * Joshua's pick: pre-fill from the job. The rule on top of it: when the posting gives a range,
 * answer the TOP of it. Answering the bottom prices him at the floor before anyone has talked to
 * him; the top is still a number the employer published, so it never reads as greedy. He sees the
 * answer (and why) on the review screen before anything goes out, and can change it.
 */
import type { JobSalary } from './types';

export type PayBasis = 'top-of-range' | 'posted' | 'starting-figure';

export interface PayAnswer {
  amount: number;
  currency: string;
  period: NonNullable<JobSalary['period']>;
  basis: PayBasis;
  /** Ready to paste into an application field, e.g. "$65,000 per year". */
  text: string;
  /** One plain line for the review screen on where the number came from. */
  why: string;
}

const PERIOD_WORDS: Record<NonNullable<JobSalary['period']>, string> = {
  year: ' per year',
  month: ' per month',
  hour: ' per hour',
  unknown: '',
};

function money(amount: number, currency: string): string {
  const cents = !Number.isInteger(amount) && amount < 1000;
  const number = amount.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (currency === 'USD') return `$${number}`;
  if (currency === 'GBP') return `£${number}`;
  if (currency === 'EUR') return `€${number}`;
  return `${number} ${currency}`;
}

function finite(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** `null` when the posting gives no usable number — then the field is left for him to fill. */
export function payAnswerFor(salary: JobSalary | undefined): PayAnswer | null {
  if (!salary) return null;
  const min = finite(salary.min);
  const max = finite(salary.max);
  const currency = (salary.currency ?? 'USD').trim().toUpperCase() || 'USD';
  const period = salary.period ?? 'unknown';
  const build = (amount: number, basis: PayBasis, why: string): PayAnswer => ({
    amount,
    currency,
    period,
    basis,
    text: `${money(amount, currency)}${PERIOD_WORDS[period]}`,
    why,
  });

  if (min !== undefined && max !== undefined && max > min) {
    return build(
      max,
      'top-of-range',
      `Top of the posted ${money(min, currency)}–${money(max, currency)} range. The bottom would price you at their floor.`,
    );
  }
  if (max !== undefined) return build(max, 'posted', 'The pay the posting lists.');
  if (min !== undefined) {
    return build(min, 'starting-figure', 'The posting only gives a starting figure. You can ask for more once you talk.');
  }
  return null;
}
