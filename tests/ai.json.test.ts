import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { JsonParseError, parseJsonAs, parseJsonLoose, repairJson, stripCodeFences } from '../server/ai/json';

describe('stripCodeFences', () => {
  it('unwraps a closed ```json fence', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```').trim()).toBe('{"a":1}');
  });

  it('unwraps an unterminated fence', () => {
    expect(stripCodeFences('```json\n{"a":1}').trim()).toBe('{"a":1}');
  });

  it('leaves plain JSON alone', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('parseJsonLoose', () => {
  it('parses clean JSON', () => {
    expect(parseJsonLoose('{"summary":"Hi"}')).toEqual({ summary: 'Hi' });
  });

  it('parses JSON inside code fences', () => {
    expect(parseJsonLoose('```json\n{"suggestions":["a","b"]}\n```')).toEqual({ suggestions: ['a', 'b'] });
  });

  it('ignores prose before and after the object', () => {
    const raw = 'Sure — here is the result:\n{"note":"ok"}\nLet me know if you want changes.';
    expect(parseJsonLoose(raw)).toEqual({ note: 'ok' });
  });

  it('removes trailing commas', () => {
    expect(parseJsonLoose('{"a":[1,2,],"b":"c",}')).toEqual({ a: [1, 2], b: 'c' });
  });

  it('strips line and block comments', () => {
    const raw = '{\n  // the summary\n  "a": 1, /* inline */ "b": 2\n}';
    expect(parseJsonLoose(raw)).toEqual({ a: 1, b: 2 });
  });

  it('keeps // inside string values', () => {
    expect(parseJsonLoose('{"url":"https://example.com/x"}')).toEqual({ url: 'https://example.com/x' });
  });

  it('closes output truncated mid-string', () => {
    expect(parseJsonLoose('{"suggestions":["one","tw')).toEqual({ suggestions: ['one', 'tw'] });
  });

  it('closes output truncated after a comma', () => {
    expect(parseJsonLoose('{"a":1,')).toEqual({ a: 1 });
  });

  it('closes output truncated after a key', () => {
    expect(parseJsonLoose('{"a":1,"b":')).toEqual({ a: 1, b: null });
  });

  it('handles a fenced, comma-damaged, prose-wrapped payload at once', () => {
    const raw = 'Here you go!\n```json\n{\n  "keywordsToAdd": ["HubSpot", "Twilio",],\n}\n```\nHope this helps.';
    expect(parseJsonLoose(raw)).toEqual({ keywordsToAdd: ['HubSpot', 'Twilio'] });
  });

  it('throws on empty input', () => {
    expect(() => parseJsonLoose('   ')).toThrow(JsonParseError);
  });

  it('throws when there is no JSON at all', () => {
    expect(() => parseJsonLoose('I cannot help with that.')).toThrow(JsonParseError);
  });
});

describe('repairJson', () => {
  it('is a no-op for already valid JSON', () => {
    expect(repairJson('{"a":1}')).toBe('{"a":1}');
  });

  it('drops an extra closing bracket', () => {
    expect(JSON.parse(repairJson('{"a":1}}'))).toEqual({ a: 1 });
  });
});

describe('parseJsonAs', () => {
  const schema = z.object({ suggestions: z.array(z.string()) });

  it('returns typed data', () => {
    expect(parseJsonAs('```\n{"suggestions":["a"]}\n```', schema)).toEqual({ suggestions: ['a'] });
  });

  it('throws when the shape does not match', () => {
    expect(() => parseJsonAs('{"suggestions":"nope"}', schema)).toThrow(JsonParseError);
  });
});
