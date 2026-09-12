# Launchpad UI kit

Everything lives under `src/components/ui` (components) and `src/components/layout` (app shell).
Plain CSS + design tokens, no runtime styling library.

```tsx
import { Button, Card, Field, Input, Badge, useToast } from '@/components/ui';
import { TopBarActions } from '@/components/layout';
import { useTheme, useMediaQuery, useDebounce } from '@/hooks';
```

CSS is imported by the components themselves — never import `src/components/ui/*.css` yourself.
`src/styles/global.css` (imported once from `main.tsx`) pulls in `tokens.css` and `print.css`.

---

## Design tokens (`src/styles/tokens.css`)

Use these variables instead of hard-coded values.

| Group | Tokens |
| --- | --- |
| Surfaces | `--color-bg`, `--color-bg-elevated`, `--color-surface`, `--color-surface-2`, `--color-surface-3`, `--color-surface-hover`, `--color-overlay` |
| Lines | `--color-border`, `--color-border-strong`, `--color-border-subtle` |
| Text | `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-text-inverse` |
| Accent | `--color-accent`, `--color-accent-hover`, `--color-accent-text`, `--color-accent-soft`, `--color-on-accent`, palette `--accent-50…900` (`--accent-500 = #1f5eff`) |
| Status | `--color-success`/`-text`/`-soft`, same for `warning`, `danger`, `info` |
| Neutrals | `--neutral-0 … --neutral-950` |
| Spacing (4px base) | `--space-1 … --space-20` (1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px …) |
| Radius | `--radius-xs|sm|md|lg|xl|2xl|pill` |
| Shadow | `--shadow-xs|sm|md|lg|xl`, `--shadow-focus` |
| Type | `--font-sans|serif|mono`, `--text-2xs … --text-3xl`, `--weight-regular|medium|semibold|bold`, `--leading-tight|snug|normal|relaxed`, `--tracking-tight|wide|caps` |
| Z-index | `--z-sticky|nav|drawer|modal|popover|toast|tooltip` |
| Motion | `--dur-instant|fast|base|slow`, `--ease`, `--ease-out`, `--ease-in` (all collapse to ~0 under `prefers-reduced-motion`) |
| Layout | `--sidebar-width`, `--sidebar-width-collapsed`, `--topbar-height`, `--mobilenav-height`, `--content-max` |

Theming: `<html data-theme="light|dark">`, applied by `useTheme()`. With no attribute the OS
preference decides, so first paint is already correct.

### Utility classes (`global.css`)

`.stack` (+`.stack-1|2|4|6`), `.row` (+`.row-4`, `.row-wrap`, `.row-between`, `.row-end`, `.row-top`),
`.grow`, `.center`, `.muted`, `.subtle`, `.small`, `.strong`, `.truncate`, `.clamp-2`, `.clamp-3`,
`.visually-hidden`, `.divider`, `.scroll-y`, `.no-print`.

---

## Components

Every component forwards `className` and (where it wraps a DOM element) the remaining native props.

### Button

```tsx
<Button variant="primary" size="md" leftIcon={<Plus size={15} />} loading={saving} onClick={save}>
  Save
</Button>
```

| Prop | Type | Default |
| --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `loading` | `boolean` — spinner, disables the button, sets `aria-busy` | `false` |
| `leftIcon` / `rightIcon` | `ReactNode` (decorative, `aria-hidden`) | — |
| `fullWidth` | `boolean` | `false` |

Plus all `<button>` props. `type` defaults to `"button"` (no accidental form submits).

### IconButton

```tsx
<IconButton label="Delete resume" icon={<Trash2 size={16} />} variant="danger" onClick={remove} />
```

`label` (required) becomes both `aria-label` and the default `title`.
`variant`: `'ghost' | 'secondary' | 'primary' | 'danger'`; `size`: `'sm' | 'md' | 'lg'`;
`loading`; `active` (renders the "on" state and sets `aria-pressed`).

### Field + Input / Textarea / Select

`Field` owns the label, hint, error and the generated id — controls inside inherit `id`,
`aria-describedby` and `aria-invalid` automatically.

```tsx
<Field label="Email" hint="Used on the resume header" error={errors.email} required>
  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
</Field>
```

- `Field`: `label`, `hint`, `error`, `required`, `horizontal`, `htmlFor`, `className`.
- `Input`: `uiSize` (`'sm'|'md'|'lg'`, the native `size` attribute is not used), `invalid`,
  `leftIcon`, `rightSlot`, plus all `<input>` props.
- `Textarea`: `uiSize`, `invalid`, `autoResize`, `maxHeight` (default 420), plus `<textarea>` props.
- `Select`: `uiSize`, `invalid`, `options?: {value,label,disabled?}[]`, `placeholder`, or plain
  `<option>` children.

### Checkbox / Switch

```tsx
<Checkbox label="Remote only" description="Hide on-site roles" checked={remote} onChange={(e) => set(e.target.checked)} />
<Switch checked={on} onCheckedChange={setOn} label="Show archived" />
```

`Checkbox` takes `label`, `description`, `indeterminate`, plus `<input type="checkbox">` props.
`Switch` is a `role="switch"` button: `checked` (controlled) or `defaultChecked`, `onCheckedChange`,
`label`; give it an `aria-label` when there is no visible label.

### Card

```tsx
<Card title="Active resume" subtitle="Updated 2 hours ago" actions={<IconButton … />} footer={<Button>Open</Button>}>
  …
</Card>
```

`title`, `subtitle`, `actions`, `footer`, `padding` (`'none'|'sm'|'md'|'lg'`),
`elevation` (`'flat'|'default'|'raised'`), `interactive`, `selected`, `bare` (skip the body padding wrapper).

### Badge / Chip

```tsx
<Badge tone="success" variant="soft" dot>Applied</Badge>
<Chip selected={picked} onToggle={setPicked}>Remote</Chip>
<Chip onRemove={() => drop(skill)}>{skill}</Chip>
```

- `Badge`: `tone` (`'neutral'|'accent'|'success'|'warning'|'danger'|'info'`),
  `variant` (`'soft'|'solid'|'outline'`), `size` (`'sm'|'lg'`), `dot`, `leftIcon`.
- `Chip`: `tone`, `selected` + `onToggle` (renders a toggle button with `aria-pressed`),
  `onRemove` + `removeLabel`, `leftIcon`. Without `onToggle` it renders a static `<span>`.

### PageHeader

```tsx
<PageHeader title="Job finder" eyebrow="Search" description="Aggregated from 8 boards."
            badge={<Badge tone="accent">124 results</Badge>} actions={<Button variant="primary">Save search</Button>} />
```

`title`, `eyebrow`, `description`, `badge`, `actions`, `as` (`'h1' | 'h2'`, default `h1`).

### EmptyState / Skeleton

```tsx
<EmptyState icon={<Search size={20} />} title="No jobs yet" description="Try a broader search."
            actions={<Button variant="primary">Search jobs</Button>} />
<SkeletonText lines={3} />
<Skeleton width={120} height={16} />
```

`EmptyState`: `title`, `description`, `icon`, `actions`, `size` (`'sm'|'md'`), `plain`.
`Skeleton`: `width`, `height`, `variant` (`'block'|'text'|'circle'`), `radius`.
`SkeletonText`: `lines`, `label` (announced politely while loading).

### ProgressRing / ScoreRing / MatchTone

```tsx
<ScoreRing name="ATS score" value={report.score} size={72} label="ATS" />
<MatchTone score={match.score} />                       {/* "82% · Strong" */}
<MatchTone score={m.score} label={matchLabel(m.score).label} tone={matchLabel(m.score).tone} />
```

- `ProgressRing`: `value` (0–100, clamped), `size` (px, default 56), `thickness` (default 6),
  `label`, `tone` (`'success'|'info'|'warning'|'danger'|'accent'`, auto from the value otherwise),
  `hideValue`, `children` (custom center), `ariaLabel`.
- `ScoreRing`: same, plus `name` used in the accessible name (`"ATS score: 82 out of 100 — Strong"`).
- `MatchTone`: `score`, optional `label`/`tone` overrides (pass `matchLabel()` results from
  `shared/match`), `showScore`, `size`.
- Helpers: `scoreTone(n)` → tone, `scoreLabel(n)` → `'Excellent'|'Strong'|'Good'|'Fair'|'Low'`.

### Tabs

```tsx
<Tabs defaultValue="editor" onValueChange={setTab}>
  <TabList aria-label="Resume builder" variant="pills">
    <Tab value="editor">Editor</Tab>
    <Tab value="preview" count={2}>Preview</Tab>
  </TabList>
  <TabPanel value="editor">…</TabPanel>
  <TabPanel value="preview" keepMounted>…</TabPanel>
</Tabs>
```

`Tabs`: `value` (controlled) / `defaultValue` / `onValueChange`.
`TabList`: `aria-label` (required), `variant` (`'underline'|'pills'`); handles ←/→/Home/End.
`Tab`: `value`, `icon`, `count`, `disabled`. `TabPanel`: `value`, `keepMounted`.

### Modal / ConfirmDialog

```tsx
<Modal open={open} onClose={close} title="Import resume" description="Paste text or upload JSON."
       size="lg" footer={<><Button onClick={close}>Cancel</Button><Button variant="primary">Import</Button></>}>
  …
</Modal>

<ConfirmDialog open={confirming} onCancel={…} onConfirm={…} destructive
               title="Delete this resume?" description="This cannot be undone." confirmLabel="Delete" />
```

`Modal`: `open`, `onClose`, `title`, `description`, `footer`, `size` (`'sm'|'md'|'lg'|'xl'`),
`closeOnOverlayClick`, `closeOnEscape`, `hideCloseButton`, `initialFocusRef`, `ariaLabel`.
Focus is trapped, Escape closes, background scrolling is locked, and focus returns to the trigger.

### Drawer

```tsx
<Drawer open={open} onClose={close} side="bottom" title="Job details">…</Drawer>
```

`side` (`'right'|'left'|'bottom'`), `size` (number px or CSS length), `title`, `footer`,
plus the same dismissal props as `Modal`. Use `side="bottom"` for mobile sheets.

### Tooltip

```tsx
<Tooltip content="Copy to clipboard" side="top"><IconButton label="Copy" icon={<Copy size={15} />} /></Tooltip>
```

`content`, `side` (`'top'|'bottom'|'left'|'right'`), `delayMs` (hover only; focus shows instantly).
Supplementary text only — icon-only controls still need their own accessible name.

### Popover / Menu

```tsx
<Popover trigger={<Button rightIcon={<ChevronDown size={14} />}>Style</Button>} align="end" label="Resume style">
  {(close) => <StyleForm onDone={close} />}
</Popover>

<Menu trigger={<IconButton label="Resume actions" icon={<MoreHorizontal size={16} />} />} label="Resume actions" align="end">
  <MenuGroupLabel>Export</MenuGroupLabel>
  <MenuItem icon={<FileDown size={15} />} onSelect={exportPdf} shortcut={<Kbd keys={['⌘', 'P']} />}>PDF</MenuItem>
  <MenuSeparator />
  <MenuItem danger onSelect={remove}>Delete</MenuItem>
</Menu>
```

Both clone the `trigger` element to add `aria-expanded`/`aria-haspopup` and the click handler, close
on outside click and Escape, and are controllable (`open` / `defaultOpen` / `onOpenChange`).
`Menu` adds the arrow-key/Home/End roving focus pattern; `MenuItem` (`onSelect`, `icon`, `shortcut`,
`checked`, `danger`) closes the menu after selection.

### Toast

`AppShell` already mounts `<ToastProvider>`, so pages just use the hook:

```tsx
const toast = useToast();
toast.push({ title: 'Resume saved', tone: 'success' });
toast.push({ title: 'Search failed', description: err.message, tone: 'error', durationMs: 0 });
```

`push({ title, description?, tone?: 'success'|'error'|'info', durationMs?, action?: { label, onClick } })`
returns the toast id; `dismiss(id)` and `clear()` are also available. Defaults: 4.5s, 8s for errors,
`0` keeps it until dismissed. Errors announce assertively, everything else politely.

### Kbd

```tsx
<Kbd keys={['Ctrl', 'K']} />
```

---

## App shell (`src/components/layout`)

`AppShell` wraps the routes in `App.tsx` — pages do not render it. It provides:

- desktop sidebar (`Dashboard / Resume / Jobs / Tracker / Tailor / Settings`), icon-only between
  768–1099px or when the user collapses it;
- bottom tab bar under 768px;
- sticky top bar with the section title and a **page actions slot**;
- `ToastProvider`, `useTheme()`, the skip link, and one `refreshHealth()` call on mount.

### Page actions

```tsx
import { TopBarActions } from '@/components/layout';

<TopBarActions>
  <Button variant="primary" leftIcon={<Download size={15} />}>Export</Button>
</TopBarActions>
```

Render it anywhere inside a page; it portals into the top bar and unmounts with the page.

Also exported: `Sidebar`, `AiStatus`, `TopBar`, `MobileNav`, `ThemeToggle`, `NAV_ITEMS`, `navTitleFor`.

---

## Hooks (`src/hooks`)

| Hook | Signature |
| --- | --- |
| `useTheme()` | `{ mode, resolved, setMode, cycle, toggle }` — writes `<html data-theme>`, follows the OS while `mode === 'system'` |
| `useMediaQuery(query)` | `boolean`; `BREAKPOINTS.mobile \| compact \| desktop`, plus `useIsMobile()` and `usePrefersReducedMotion()` |
| `useDebounce(value, ms)` | debounced value |
| `useDebouncedCallback(fn, ms)` | stable debounced fn with `.cancel()` / `.flush()` |
| `useLocalStorage(key, initial)` | `[value, setValue]`, cross-tab synced, safe when storage is blocked |

## Conventions

- Colour never carries meaning alone — pair tones with text or a `dot`.
- Icon-only controls always get a `label` (use `IconButton`).
- Show an empty, loading and error state wherever data loads (`EmptyState`, `SkeletonText`).
- Anything that should not print gets `.no-print`.
