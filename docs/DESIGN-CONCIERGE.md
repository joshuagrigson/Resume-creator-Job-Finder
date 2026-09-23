# Launchpad Concierge — design direction

Mock: https://claude.ai/artifact/L7NKppuy2TsZAKs8mnJvez (private; desktop + phone frames, five colorways). Ground stays ivory
`#f5efe1`, cards `#fffdf8`, warm-grey type ramp (see `src/styles/tokens.css`). The résumé sheet stays
true white.

## The flow the interface is built around

1. **Tell us about you** — four plain questions or a dropped PDF; live sheet forms alongside.
2. **Résumé written** — the sheet is the page; one readiness score, three checks, three one-tap edits.
3. **We read it back** — level, target titles, skills, ZIP as editable chips; drives the first search.
4. **Jobs near home** — ZIP + radius slider (5–100 mi), remote as a toggle, distance on every card.
5. **Qualified · Reach** — two lanes; every Reach card names the gap and why to apply anyway.
6. **Apply for me** — multi-select → queue; states are *Submitted · Running · Needs you · Opens for you*.

## Ten interface changes, in the order they'd be felt

| Change | Today | Proposed | Cost |
| --- | --- | --- | --- |
| Guided intake replaces the blank editor | Sample / Blank / Import, then a ten-tab form | Four questions, live sheet beside them, import next to question one | Ready |
| Sheet-first résumé page | Split editor/preview, ATS in a side panel | Sheet is the page; quiet rail with score, checks, suggestions | Ready |
| Résumé-derived profile, not a keyword box | Search starts empty | Chips for level/titles/skills/ZIP drive the first search | Ready |
| ZIP + radius + remote toggle | `matchesLocation` substring test | Home ZIP, radius slider, distance per card | Geocoding table |
| Qualified and Reach lanes | One ranked list | Two lanes; Reach explains the gap | Ready |
| Multi-select → queue | One job at a time; tailor/letter are separate pages | Checkboxes, one button, unattended queue | Ready |
| Honest application states | Manual status columns | Submitted / Running / Needs you / Opens for you | Per-board |
| Two style choices, not six | Template, accent, font, size, density, page size | Template + colorway; rest under "More" | Ready |
| Nightly digest | — | One evening summary on the Queue tab (email optional) | Ready |
| Phone layout | Desktop reflowed | Bottom tab bar (Start · Résumé · Jobs · Queue · You), sticky primary button | Ready |

"Ready" = the endpoint or store exists; this is a screen over it.

## What the two new capabilities actually need

**ZIP radius.** Ship a ZIP-centroid table (~42k rows, public domain) with the app. Resolve job
`location` strings (city/state) against a city-centroid table; unresolved locations fall back to the
current substring match. Distance is a haversine computed in the browser (`shared/geo.ts`), so nothing
about the user's home leaves the device. Reach/Qualified is a rule over `MatchResult.score` plus a
seniority read of the job title against the résumé's derived level.

**Auto-apply.** No keyless board in `server/jobs/sources` lets a third party submit an application.
Where a posting exposes an apply endpoint or an application email, the queue can submit. Everywhere
else the honest ceiling is **Opens for you**: posting opens with the tailored PDF and letter attached and
fields pre-filled (browser extension for autofill). The UI must never show "Submitted" for anything
that was not submitted.

## Five colorways (same ivory, one accent, one metal)

Accent carries buttons, active tab, the applicant's name on the sheet. Metal is a hairline colour for the
score ring, badges and the Reach lane; it never fills a button.

| Name | Accent | Metal | Accent tint | Note |
| --- | --- | --- | --- | --- |
| Ink & Brass (recommended) | `#22334a` | `#a8894f` | `#e9ecf1` | Closest to the current slate; token swap only |
| Bordeaux | `#6e2f3c` | `#b08d6e` | `#f3e6e6` | Keep the danger red to icons/text |
| Hunter | `#2e4a3d` | `#9c8a5a` | `#e6ece7` | Best in dark mode; match-score green moves to the metal |
| Graphite & Gold | `#2c2c30` | `#b3945b` | `#ebe9e5` | Most restrained; accent inverts to bone in dark mode |
| Verdigris | `#2f5f66` | `#a26b4a` | `#e5eeef` | Only cool-leaning accent; copper keeps it warm |

Dark-ground counterparts for each are in the mock's `<style>` (`--acc-d`, `--met-d`, …).
