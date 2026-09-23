// @vitest-environment jsdom
/**
 * Polish — the smart prompt: reword only, never add facts, ask for what's missing,
 * keep his own words on the device, and let him talk instead of type.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AiClient } from '../server/ai/client';
import { addsFacts, numbersIn, polish } from '../server/ai/handlers/polish';
import { polishPrompt } from '../server/ai/prompts';
import { PolishRequestSchema, validateRequest, REQUEST_CAPS } from '../server/ai/schemas';
import { AiError } from '../server/ai/errors';
import { ToastProvider } from '@/components/ui';
import {
  changedChars,
  createQuestionGate,
  pauseFor,
  POLISH_PAUSE_MIDTHOUGHT_MS,
  POLISH_PAUSE_MS,
  usePolish,
  type QuestionGate,
} from '@/components/resume-editor/Polish';
import { payAnswerFor } from '@shared/pay';
import { api } from '@/lib/api';
import { forgetOriginal, keepOriginal, originalFor, resetOriginalsCache } from '@/lib/text/originals';
import { appendDictation } from '@/lib/text/speech';
import { useSettingsStore } from '@/stores/settingsStore';

function reply(json: unknown): AiClient & { calls: Anthropic.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'test',
          content: [{ type: 'text', text: JSON.stringify(json), citations: null }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        } as unknown as Anthropic.Message;
      },
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('no new facts', () => {
  it('reads numbers as digits, words included', () => {
    expect([...numbersIn('ran 5 grills, like twelve people, $1,200 a night')].sort()).toEqual(['12', '1200', '5']);
  });

  it('flags a rewrite that invents a number or a placeholder', () => {
    expect(addsFacts('i ran the grill', 'Operated the grill line serving 200 guests nightly')).toBe(true);
    expect(addsFacts('i ran the grill', 'Operated the grill, cutting waste [X]%')).toBe(true);
    expect(addsFacts('ran grill for like five guys', 'Led a 5-person grill crew')).toBe(false);
    expect(addsFacts('i ran the grill', 'Operated the grill line')).toBe(false);
    expect(addsFacts('i was the grill guy', 'Served as one of the grill leads')).toBe(false);
  });

  it('throws away a rewrite that adds a number and returns his words, keeping the question', async () => {
    const client = reply({
      polished: 'Operated the grill line serving 200 guests nightly',
      why: 'Started with a verb.',
      questions: ['About how many people did you cook for on a busy night?'],
    });
    const out = await polish({ text: 'i ran the grill', kind: 'bullet' }, client);
    expect(out).toEqual({
      polished: 'i ran the grill',
      changed: false,
      why: '',
      questions: ['About how many people did you cook for on a busy night?'],
    });
  });

  it('keeps a clean rewrite and lets his answers supply the number', async () => {
    const client = reply({
      polished: '• Operated the grill line for 200 guests a night',
      why: 'Started with a verb and added your number.',
      questions: [],
    });
    const out = await polish(
      {
        text: 'i ran the grill',
        kind: 'bullet',
        answers: [{ question: 'How many people a night?', answer: 'bout 200' }],
      },
      client,
    );
    expect(out.changed).toBe(true);
    expect(out.polished).toBe('Operated the grill line for 200 guests a night');
    expect(client.calls[0]?.messages[0]?.content).toContain('THEIR ANSWERS');
  });

  it('says unchanged when the text is already clean', async () => {
    const out = await polish(
      { text: 'Operated the grill line', kind: 'bullet' },
      reply({ polished: 'Operated the grill line', why: 'Nothing to change.', questions: [] }),
    );
    expect(out.changed).toBe(false);
  });
});

describe('prompt and request', () => {
  it('tells the model to reword only and to ask instead of guessing', () => {
    const { system } = polishPrompt({ text: 'x', kind: 'bullet' });
    expect(system).toMatch(/Reword only/);
    expect(system).toMatch(/Do not write bracketed placeholders/);
    expect(system).toMatch(/At most one question/);
  });

  it('rejects an empty text and an oversized one', () => {
    expect(() => validateRequest(PolishRequestSchema, REQUEST_CAPS.polish, { text: ' ', kind: 'bullet' })).toThrow(AiError);
    expect(() =>
      validateRequest(PolishRequestSchema, REQUEST_CAPS.polish, { text: 'x'.repeat(5000), kind: 'summary' }),
    ).toThrow(AiError);
  });
});

describe('his own words, on this device', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetOriginalsCache();
  });

  it('keeps the words he typed across two polishes and a reload', () => {
    keepOriginal('Operated the grill line', 'i ran the grill');
    keepOriginal('Operated the grill line for 200 guests', 'Operated the grill line');
    resetOriginalsCache(); // a reload
    expect(originalFor('Operated the grill line for 200 guests')).toBe('i ran the grill');
    forgetOriginal('Operated the grill line for 200 guests');
    expect(originalFor('Operated the grill line for 200 guests')).toBeNull();
  });
});

describe('talk instead of type', () => {
  it('adds dictated words with spacing and capitals', () => {
    expect(appendDictation('', 'ran the grill')).toBe('Ran the grill');
    expect(appendDictation('Ran the grill', 'and the fryer')).toBe('Ran the grill and the fryer');
    expect(appendDictation('Ran the grill.', 'trained new cooks')).toBe('Ran the grill. Trained new cooks');
  });
});

function Harness({ initial, gate, id = '0' }: { initial: string; gate?: QuestionGate; id?: string }) {
  const [value, setValue] = useState(initial);
  const polishState = usePolish({
    value,
    kind: 'bullet',
    label: `Bullet ${id}`,
    onApply: setValue,
    questionGate: gate,
    gateId: id,
  });
  return (
    <div>
      <textarea
        aria-label={`bullet ${id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={polishState.onFocus}
        onBlur={polishState.onBlur}
      />
      {polishState.card}
    </div>
  );
}

describe('pause timing', () => {
  it('waits longer mid-sentence than after a finished one', () => {
    expect(pauseFor('i ran the grill.')).toBe(POLISH_PAUSE_MS);
    expect(pauseFor('i ran the grill!" ')).toBe(POLISH_PAUSE_MS);
    expect(pauseFor('i ran the grill\n')).toBe(POLISH_PAUSE_MS);
    expect(pauseFor('i ran the grill and')).toBe(POLISH_PAUSE_MIDTHOUGHT_MS);
  });

  it('counts only the characters that changed', () => {
    expect(changedChars('i ran the grill', 'i ran the grill.')).toBe(1);
    expect(changedChars('i ran the grill', 'i ran the big grill')).toBe(4);
    expect(changedChars('abc', 'xyz')).toBe(3);
  });

  it('skips a pause after a tiny edit but not leaving the box', async () => {
    useSettingsStore.setState({ ai: { enabled: true, model: 'test' } });
    const spy = vi.spyOn(api.ai, 'polish').mockResolvedValue({ polished: 'x', changed: false, why: '', questions: [] });
    render(
      <ToastProvider>
        <Harness initial="i ran the grill." />
      </ToastProvider>,
    );
    const box = screen.getByLabelText('bullet 0');
    fireEvent.blur(box);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'i ran the grills.' } });
    await new Promise((r) => setTimeout(r, POLISH_PAUSE_MS + 300));
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.blur(box);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});

describe('pay answer', () => {
  it('answers the top of a posted range and says why', () => {
    const a = payAnswerFor({ min: 52000, max: 65000, currency: 'USD', period: 'year' })!;
    expect(a.amount).toBe(65000);
    expect(a.basis).toBe('top-of-range');
    expect(a.text).toBe('$65,000 per year');
    expect(a.why).toContain('$52,000–$65,000');
  });

  it('handles hourly pay, a single figure, a floor, and nothing', () => {
    expect(payAnswerFor({ min: 18.5, max: 22.75, period: 'hour' })!.text).toBe('$22.75 per hour');
    expect(payAnswerFor({ max: 70000, period: 'year' })!.basis).toBe('posted');
    expect(payAnswerFor({ min: 40000, period: 'year' })!.basis).toBe('starting-figure');
    expect(payAnswerFor({ display: 'Competitive' })).toBeNull();
    expect(payAnswerFor(undefined)).toBeNull();
  });
});

describe('the Polish card', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetOriginalsCache();
    useSettingsStore.setState({ ai: { enabled: true, model: 'test' } });
  });

  it('shows up when he pauses in the box', async () => {
    const spy = vi.spyOn(api.ai, 'polish').mockResolvedValue({
      polished: 'Operated the grill line',
      changed: true,
      why: '',
      questions: [],
    });
    render(
      <ToastProvider>
        <Harness initial="" />
      </ToastProvider>,
    );
    const box = screen.getByLabelText('bullet 0');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'i ran the grill.' } });
    expect(spy).not.toHaveBeenCalled();
    await screen.findByText('Operated the grill line', undefined, { timeout: POLISH_PAUSE_MS + 1500 });
    expect(spy).toHaveBeenCalledTimes(1);
    // Typing again hides the now-stale card; the field itself is untouched.
    fireEvent.change(box, { target: { value: 'i ran the grill and fryer' } });
    expect(screen.queryByText('Operated the grill line')).toBeNull();
    expect((box as HTMLTextAreaElement).value).toBe('i ran the grill and fryer');
  });

  it('asks one question per job across its bullets', async () => {
    vi.spyOn(api.ai, 'polish').mockResolvedValue({
      polished: 'Operated the grill line',
      changed: true,
      why: '',
      questions: ['About how many people a night?'],
    });
    const gate = createQuestionGate();
    render(
      <ToastProvider>
        <Harness initial="i ran the grill" gate={gate} id="0" />
        <Harness initial="i ran the grill" gate={gate} id="1" />
      </ToastProvider>,
    );
    fireEvent.blur(screen.getByLabelText('bullet 0'));
    fireEvent.blur(screen.getByLabelText('bullet 1'));
    await waitFor(() => expect(screen.getAllByText('Operated the grill line')).toHaveLength(2));
    expect(screen.getAllByText('About how many people a night?')).toHaveLength(1);
  });

  it('shows up when he leaves the box, not while he types', async () => {
    const spy = vi.spyOn(api.ai, 'polish').mockResolvedValue({
      polished: 'Operated the grill line',
      changed: true,
      why: 'Started with a verb.',
      questions: [],
    });
    render(
      <ToastProvider>
        <Harness initial="" />
      </ToastProvider>,
    );
    const box = screen.getByLabelText('bullet 0');
    fireEvent.change(box, { target: { value: 'i ran the grill' } });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(spy).toHaveBeenCalledWith({ text: 'i ran the grill', kind: 'bullet', role: undefined, answers: undefined });
    await screen.findByText('Operated the grill line');
    // Blurring again on the same words does not ask again.
    fireEvent.blur(box);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Use swaps in the polish and Undo puts his words back', async () => {
    vi.spyOn(api.ai, 'polish').mockResolvedValue({
      polished: 'Operated the grill line',
      changed: true,
      why: '',
      questions: [],
    });
    render(
      <ToastProvider>
        <Harness initial="i ran the grill" />
      </ToastProvider>,
    );
    const box = screen.getByLabelText('bullet 0') as HTMLTextAreaElement;
    fireEvent.blur(box);
    fireEvent.click(await screen.findByRole('button', { name: 'Use' }));
    expect(box.value).toBe('Operated the grill line');
    expect(originalFor('Operated the grill line')).toBe('i ran the grill');
    fireEvent.click(screen.getByRole('button', { name: 'Undo polish' }));
    expect(box.value).toBe('i ran the grill');
  });

  it('asks the follow-up and re-polishes with his answer', async () => {
    const spy = vi
      .spyOn(api.ai, 'polish')
      .mockResolvedValueOnce({
        polished: 'Operated the grill line',
        changed: true,
        why: '',
        questions: ['About how many people a night?'],
      })
      .mockResolvedValueOnce({ polished: 'Operated the grill line for 200 guests a night', changed: true, why: '', questions: [] });
    render(
      <ToastProvider>
        <Harness initial="i ran the grill" />
      </ToastProvider>,
    );
    fireEvent.blur(screen.getByLabelText('bullet 0'));
    const answer = await screen.findByLabelText('About how many people a night?');
    fireEvent.change(answer, { target: { value: 'bout 200' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    await screen.findByText('Operated the grill line for 200 guests a night');
    expect(spy).toHaveBeenLastCalledWith({
      text: 'i ran the grill',
      kind: 'bullet',
      role: undefined,
      answers: [{ question: 'About how many people a night?', answer: 'bout 200' }],
    });
  });

  it('drops a suggestion if he went back and kept typing', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof api.ai.polish>>) => void;
    vi.spyOn(api.ai, 'polish').mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <ToastProvider>
        <Harness initial="i ran the grill" />
      </ToastProvider>,
    );
    const box = screen.getByLabelText('bullet 0');
    fireEvent.blur(box);
    fireEvent.change(box, { target: { value: 'i ran the grill and fryer' } });
    await act(async () => {
      resolve({ polished: 'Operated the grill line', changed: true, why: '', questions: [] });
    });
    await waitFor(() => expect(screen.queryByText('Operated the grill line')).toBeNull());
  });

  it('stays quiet when AI is off', () => {
    useSettingsStore.setState({ ai: { enabled: false } });
    const spy = vi.spyOn(api.ai, 'polish');
    render(
      <ToastProvider>
        <Harness initial="i ran the grill" />
      </ToastProvider>,
    );
    fireEvent.blur(screen.getByLabelText('bullet 0'));
    expect(spy).not.toHaveBeenCalled();
  });
});
