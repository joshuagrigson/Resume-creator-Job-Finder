import { describe, expect, it } from 'vitest';
import { decodeEntities, sanitizeHtml, stripHtml, toDescriptionText } from '../server/jobs/sanitize';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('R&amp;D &lt;tag&gt; &quot;quoted&quot;')).toBe('R&D <tag> "quoted"');
    expect(decodeEntities('caf&#233; &#x2013; open')).toBe('café – open');
    expect(decodeEntities('a&nbsp;b')).toBe('a b');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&notarealentity; stays')).toBe('&notarealentity; stays');
  });
});

describe('stripHtml', () => {
  it('turns markup into readable text', () => {
    const html = '<h2>About</h2><p>We build <b>things</b>.</p><ul><li>One</li><li>Two</li></ul>';
    expect(stripHtml(html)).toBe('About\n\nWe build things.\n\nOne\n\nTwo');
  });

  it('drops script and style content entirely', () => {
    const html = '<p>Visible</p><script>alert("x")</script><style>.a{color:red}</style>';
    const text = stripHtml(html);
    expect(text).toContain('Visible');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  it('is total for non-string input', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(42)).toBe('');
  });

  it('collapses runaway whitespace', () => {
    expect(stripHtml('<p>a</p>\n\n\n\n<p>b</p>   <p>c</p>')).toBe('a\n\nb\n\nc');
  });
});

describe('toDescriptionText', () => {
  it('caps long descriptions on a word boundary', () => {
    const html = `<p>${'word '.repeat(500)}</p>`;
    const text = toDescriptionText(html, 100);
    expect(text.length).toBeLessThanOrEqual(101);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('sanitizeHtml', () => {
  it('removes script blocks and their contents', () => {
    const out = sanitizeHtml('<p>ok</p><script>steal(document.cookie)</script>');
    expect(out).toBe('<p>ok</p>');
  });

  it('removes style, iframe, object and embed blocks', () => {
    const out = sanitizeHtml(
      '<style>.x{}</style><iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y"><p>keep</p>',
    );
    expect(out).not.toMatch(/iframe|object|embed|style/i);
    expect(out).toContain('<p>keep</p>');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeHtml('<div onclick="steal()" ONMOUSEOVER=\'x()\'><b>hi</b></div>');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('onmouseover');
    expect(out).toContain('<b>hi</b>');
  });

  it('neutralises javascript:, vbscript: and data:text/html URLs', () => {
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">a</a><a href="VBSCRIPT:x">b</a><a href="data:text/html,<b>">c</a>',
    );
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('vbscript:');
    expect(out.toLowerCase()).not.toContain('data:text/html');
    expect(out).toContain('href="#"');
  });

  it('sees through entity- and control-character obfuscated javascript: URLs', () => {
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a><a href="&#106;avascript:alert(1)">y</a>');
    expect(out).not.toMatch(/javascript/i);
    expect(out.match(/href="#"/g)).toHaveLength(2);
  });

  it('keeps ordinary links and images intact', () => {
    const html = '<p>See <a href="https://example.com/apply">apply</a> <img src="https://cdn.test/a.png"></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('caps oversized descriptions without leaving a half-written tag', () => {
    const html = `<p>${'x'.repeat(70_000)}</p><a href="https://example.com">link</a>`;
    const out = sanitizeHtml(html);
    expect(out.length).toBeLessThanOrEqual(60_000);
    expect(out.endsWith('<')).toBe(false);
    expect(/<[^>]*$/.test(out)).toBe(false);
  });

  it('is total for non-string input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml({ a: 1 })).toBe('');
  });
});
