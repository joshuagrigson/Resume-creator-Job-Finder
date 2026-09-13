/**
 * Template + typography controls. Rendered inside a popover on desktop and a bottom sheet on
 * mobile, so it is a plain content component with no chrome of its own.
 */
import { useId, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { Density, FontChoice, PageSize, ResumeId, ResumeStyle, TemplateId } from '@shared/types';
import { TEMPLATE_IDS } from '@shared/types';
import { Field, Input, Select } from '@/components/ui';
import { useResumeSlice, useResumeUpdate } from './store-hooks';
import './editor.css';

export const TEMPLATE_META: Record<TemplateId, { name: string; description: string }> = {
  classic: { name: 'Classic', description: 'Serif type, centered header, ruled sections.' },
  modern: { name: 'Modern', description: 'Bold sans with an accent bar. A safe default.' },
  minimal: { name: 'Minimal', description: 'Thin type and generous whitespace.' },
  executive: { name: 'Executive', description: 'Two-line header, small-caps section titles.' },
  sidebar: { name: 'Sidebar', description: 'Accent column for contact and skills.' },
};

export const ACCENT_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#1f5eff', name: 'Launchpad blue' },
  { hex: '#0d8ec4', name: 'Teal' },
  { hex: '#12a150', name: 'Green' },
  { hex: '#7a4ddb', name: 'Violet' },
  { hex: '#c8860d', name: 'Amber' },
  { hex: '#d93a40', name: 'Red' },
  { hex: '#2a3140', name: 'Graphite' },
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface StylePanelProps {
  resumeId: ResumeId;
}

export function StylePanel({ resumeId }: StylePanelProps) {
  const style = useResumeSlice(resumeId, (r) => r.style);
  const update = useResumeUpdate(resumeId);
  const sizeId = useId();
  const hexId = useId();

  if (!style) return null;

  const set = (changes: Partial<ResumeStyle>) => update((r) => ({ ...r, style: { ...r.style, ...changes } }));
  const hexInvalid = !HEX_RE.test(style.accentColor);

  return (
    <div className="re-style stack-4">
      <fieldset className="re-style__group">
        <legend className="re-style__legend">Template</legend>
        <ul className="re-style__templates">
          {TEMPLATE_IDS.map((id) => {
            const meta = TEMPLATE_META[id];
            const selected = style.template === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`re-tpl${selected ? ' re-tpl--on' : ''}`}
                  aria-pressed={selected}
                  onClick={() => set({ template: id })}
                >
                  <span className={`re-tpl__thumb re-tpl__thumb--${id}`} aria-hidden="true">
                    <span className="re-tpl__bar" />
                    <span className="re-tpl__line" />
                    <span className="re-tpl__line re-tpl__line--short" />
                    <span className="re-tpl__line" />
                  </span>
                  <span className="re-tpl__text">
                    <span className="re-tpl__name">
                      {meta.name}
                      {selected ? <Check size={13} aria-hidden="true" /> : null}
                    </span>
                    <span className="re-tpl__desc">{meta.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="re-style__group">
        <legend className="re-style__legend">Accent colour</legend>
        <ul className="re-style__swatches">
          {ACCENT_SWATCHES.map((swatch) => {
            const selected = style.accentColor.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <li key={swatch.hex}>
                <button
                  type="button"
                  className={`re-swatch${selected ? ' re-swatch--on' : ''}`}
                  style={{ '--re-swatch': swatch.hex } as CSSProperties}
                  aria-pressed={selected}
                  aria-label={swatch.name}
                  title={swatch.name}
                  onClick={() => set({ accentColor: swatch.hex })}
                >
                  {selected ? <Check size={13} aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Field
          label="Custom hex"
          htmlFor={hexId}
          error={hexInvalid ? 'Use a hex colour such as #1f5eff.' : undefined}
          className="re-style__hex"
        >
          <Input
            id={hexId}
            uiSize="sm"
            value={style.accentColor}
            spellCheck={false}
            autoComplete="off"
            placeholder="#1f5eff"
            onChange={(e) => set({ accentColor: e.target.value })}
          />
        </Field>
      </fieldset>

      <div className="re-style__row">
        <Field label="Font">
          <Select
            value={style.font}
            onChange={(e) => set({ font: e.target.value as FontChoice })}
            options={[
              { value: 'sans', label: 'Sans-serif' },
              { value: 'serif', label: 'Serif' },
              { value: 'mixed', label: 'Serif headings, sans body' },
            ]}
          />
        </Field>

        <Field label="Density" hint="Line spacing and margins.">
          <Select
            value={style.density}
            onChange={(e) => set({ density: e.target.value as Density })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'relaxed', label: 'Relaxed' },
            ]}
          />
        </Field>

        <Field label="Page size">
          <Select
            value={style.pageSize}
            onChange={(e) => set({ pageSize: e.target.value as PageSize })}
            options={[
              { value: 'letter', label: 'US Letter (8.5 × 11 in)' },
              { value: 'a4', label: 'A4 (210 × 297 mm)' },
            ]}
          />
        </Field>
      </div>

      <div className="re-style__slider">
        <label className="re-style__sliderLabel" htmlFor={sizeId}>
          Font size
          <output htmlFor={sizeId}>{style.fontSize.toFixed(1)} pt</output>
        </label>
        <input
          id={sizeId}
          type="range"
          min={9}
          max={12}
          step={0.5}
          value={style.fontSize}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
        />
        <p className="subtle small">9 pt fits more on a page; 12 pt is easiest to read.</p>
      </div>
    </div>
  );
}
