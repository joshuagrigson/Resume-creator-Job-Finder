import { describe, expect, it } from 'vitest';
import { STOPWORDS, collapseWhitespace, decodeEntities, normalizeText, stripHtml, tokenize, tokenizeAll } from '@shared/text';

describe('stripHtml', () => {
  it('removes tags and decodes the entities job boards actually send', () => {
    const html = '<p>R&amp;D at <b>Acme</b>&nbsp;&mdash; 5&#43;&nbsp;years, &lt;script&gt; safe, &quot;quoted&quot;, &#39;apos&#39;</p>';
    expect(stripHtml(html)).toBe('R&D at Acme — 5+ years, <script> safe, "quoted", \'apos\'');
  });

  it('turns block tags, <br> and list items into line breaks', () => {
    const html = '<div>Responsibilities</div><ul><li>Own the roadmap</li><li>Ship weekly</li></ul>Line one<br>Line two';
    expect(stripHtml(html).split('\n').filter(Boolean)).toEqual([
      'Responsibilities',
      'Own the roadmap',
      'Ship weekly',
      'Line one',
      'Line two',
    ]);
  });

  it('drops script and style content entirely', () => {
    const html = '<style>.a{color:red}</style><p>Visible</p><script>alert("x")</script>';
    expect(stripHtml(html)).toBe('Visible');
  });

  it('does not resurrect tags hidden behind entities', () => {
    expect(stripHtml('&lt;img src=x onerror=alert(1)&gt; hello')).toBe('<img src=x onerror=alert(1)> hello');
  });

  it('handles empty, tagless and malformed input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml('just text')).toBe('just text');
    expect(stripHtml('<p>unclosed')).toBe('unclosed');
    expect(stripHtml('a < b and c > d')).toBe('a d');
  });

  it('caps blank runs and trims each line', () => {
    expect(collapseWhitespace('  a  \n\n\n\n   b   \n\n')).toBe('a\n\nb');
  });

  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&notarealentity; &amp;')).toBe('&notarealentity; &');
  });
});

describe('normalizeText', () => {
  it('lowercases, folds accents and normalizes quotes', () => {
    expect(normalizeText('Résumé — “You’ll” Ship')).toBe('resume - "you\'ll" ship');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('tokenize', () => {
  it('keeps technology tokens intact', () => {
    const tokens = tokenize('C++, C#, .NET, Node.js, React.js, CI/CD, A/B testing, 3D, K8s');
    expect(tokens).toEqual(['c++', 'c#', '.net', 'node.js', 'react.js', 'ci/cd', 'a/b', 'testing', '3d', 'k8s']);
  });

  it('splits on ordinary punctuation and drops trailing periods', () => {
    expect(tokenize('Own the roadmap; ship weekly. Repeat!')).toEqual(['own', 'the', 'roadmap', 'ship', 'weekly', 'repeat']);
  });

  it('drops single-character tokens but keeps them in tokenizeAll', () => {
    expect(tokenize('R and C are languages')).toEqual(['and', 'are', 'languages']);
    expect(tokenizeAll('R and C are languages')).toEqual(['r', 'and', 'c', 'are', 'languages']);
  });

  it('is empty for blank input', () => {
    expect(tokenize('   \n  ')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('STOPWORDS', () => {
  it('contains common function words but not skill words', () => {
    for (const word of ['the', 'and', 'with', 'you', 'our']) expect(STOPWORDS.has(word)).toBe(true);
    for (const word of ['python', 'hubspot', 'nursing', 'forklift']) expect(STOPWORDS.has(word)).toBe(false);
  });
});
