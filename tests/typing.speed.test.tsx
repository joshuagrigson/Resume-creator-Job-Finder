// @vitest-environment jsdom
/**
 * Fast typing on phones: digits-only month entry and as-you-type spelling correction.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  formatMonthDigits,
  monthDigitsFrom,
  monthDigitsToValue,
  nextMonthDigits,
  normalizeMonthDigits,
} from '@/lib/resume/monthMask';
import { autocorrectAll, autocorrectAt, correctWord } from '@/lib/text/autocorrect';
import { DateInput } from '@/components/resume-editor';
import { Textarea } from '@/components/ui';

afterEach(cleanup);

describe('month mask', () => {
  it.each([
    ['062022', '06 / 2022', '2022-06'],
    ['122019', '12 / 2019', '2019-12'],
    ['3', '03 / ', null], // 3 can only be March
    ['32022', '03 / 2022', '2022-03'],
    ['1', '1', null], // could still be 10, 11 or 12
    ['10', '10 / ', null],
  ])('%s shows as %j', (typed, shown, stored) => {
    const d = normalizeMonthDigits(typed);
    expect(formatMonthDigits(d)).toBe(shown);
    expect(monthDigitsToValue(d)).toBe(stored);
  });

  it('drops digits that would make an impossible date instead of accepting them', () => {
    expect(normalizeMonthDigits('13')).toBe('1'); // no month 13
    expect(normalizeMonthDigits('00')).toBe('0');
    expect(normalizeMonthDigits('0630')).toBe('06'); // no year starting 3
    expect(normalizeMonthDigits('061822')).toBe('061'); // 18xx isn't a résumé year
    expect(normalizeMonthDigits('0620221')).toBe('062022'); // stops at six
  });

  it('ignores anything that is not a digit, so dashes, dots and slashes never matter', () => {
    expect(normalizeMonthDigits('06/2022')).toBe('062022');
    expect(normalizeMonthDigits('06-2022')).toBe('062022');
    expect(normalizeMonthDigits('06.2022')).toBe('062022');
  });

  it('reads stored values and pasted text', () => {
    expect(monthDigitsFrom('2021-03')).toBe('032021');
    expect(monthDigitsFrom('3/2021')).toBe('032021');
    expect(monthDigitsFrom('March 2021')).toBe('032021');
    expect(monthDigitsFrom('Sep 2019')).toBe('092019');
    expect(monthDigitsFrom('')).toBe('');
  });

  it('backspace over the drawn separator removes a digit instead of doing nothing', () => {
    // "06 / " → backspace deletes the trailing space; the digits are unchanged.
    expect(nextMonthDigits('06', '06 / ', '06 /')).toBe('0');
    expect(nextMonthDigits('0620', '06 / 20', '06 / 2')).toBe('062');
  });
});

describe('DateInput', () => {
  function Harness({ initial = '', onValue }: { initial?: string; onValue?: (v: string) => void }) {
    const [value, setValue] = useState(initial);
    return (
      <form>
        <DateInput
          label="Start"
          value={value}
          onChange={(v) => {
            setValue(v);
            onValue?.(v);
          }}
        />
        <input aria-label="Next field" />
      </form>
    );
  }

  it('opens the number pad and never needs a separator typed', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('enterkeyhint')).toBe('next');
  });

  it('stores YYYY-MM once six digits are in, and jumps to the next field', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '0620' } });
    expect(input.value).toBe('06 / 20');
    expect(onValue).not.toHaveBeenCalledWith('2022-06');
    fireEvent.change(input, { target: { value: '06 / 2022' } });
    expect(input.value).toBe('06 / 2022');
    expect(onValue).toHaveBeenLastCalledWith('2022-06');
    expect(document.activeElement).toBe(screen.getByLabelText('Next field'));
  });

  it('keeps a half-typed date on screen while the stored value is empty', () => {
    render(<Harness initial="2021-03" />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.value).toBe('03 / 2021');
    fireEvent.change(input, { target: { value: '03 / 202' } });
    expect(input.value).toBe('03 / 202');
  });

  it('Enter moves on without submitting anything', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Start');
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Next field'));
  });

  it('asks to finish an incomplete date only after leaving the field', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Start');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '062' } });
    expect(screen.queryByText(/Finish the date/)).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByText(/Finish the date/)).toBeTruthy();
  });
});

describe('autocorrect', () => {
  it('fixes a misspelling when the word is finished', () => {
    expect(autocorrectAt('I recieve ', 10)).toMatchObject({ text: 'I receive ', caret: 10, from: 'recieve', to: 'receive' });
    expect(autocorrectAt('stock shelvs,', 13)?.text).toBe('stock shelves,');
    expect(autocorrectAt('i ', 2)?.text).toBe('I ');
  });

  it('waits until the word is finished', () => {
    expect(autocorrectAt('I recieve', 9)).toBeNull();
  });

  it('keeps the capitalisation that was typed', () => {
    expect(correctWord('Recieved')).toBe('Received');
    expect(correctWord('MANAGMENT')).toBe('MANAGEMENT');
    expect(correctWord('dont')).toBe("don't");
  });

  it('corrects mid-sentence and moves the caret with the longer word', () => {
    const text = 'alot of custmers came in';
    const fix = autocorrectAt(text, 5)!;
    expect(fix.text).toBe('a lot of custmers came in');
    expect(fix.caret).toBe(6);
  });

  it('leaves real words, emails and URLs alone', () => {
    expect(correctWord('manger')).toBeNull(); // a real word
    expect(correctWord('costumer')).toBeNull();
    expect(autocorrectAt('me@teh.com ', 11)).toBeNull();
    expect(autocorrectAt('site.com/teh ', 13)).toBeNull();
  });

  it('corrects a pasted block', () => {
    expect(autocorrectAll('i did inventroy and managment. alot')).toBe('I did inventory and management. a lot');
  });

  it('corrects inside a Textarea as the person types, and only when asked to', () => {
    function Box({ fix }: { fix: boolean }) {
      const [v, setV] = useState('');
      return <Textarea aria-label={fix ? 'fixed' : 'plain'} spellFix={fix} value={v} onChange={(e) => setV(e.target.value)} />;
    }
    render(
      <>
        <Box fix />
        <Box fix={false} />
      </>,
    );
    for (const label of ['fixed', 'plain']) {
      const el = screen.getByLabelText(label) as HTMLTextAreaElement;
      fireEvent.input(el, { target: { value: 'teh ' }, inputType: 'insertText', data: ' ' });
    }
    expect((screen.getByLabelText('fixed') as HTMLTextAreaElement).value).toBe('the ');
    expect((screen.getByLabelText('plain') as HTMLTextAreaElement).value).toBe('teh ');
  });
});
