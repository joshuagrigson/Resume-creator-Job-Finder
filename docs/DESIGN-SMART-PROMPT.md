# Smart prompt — "Polish"

Who it's for: someone who writes the way they talk. Slang, fragments, no punctuation, bad
spelling. He types "i ran the grill and trained the new guys" and the résumé should end up with
clean, professional lines. The builder then improves the *clean* version, not his first draft.

## Decisions (Joshua, 2026-09-23 — second round supersedes the first)

| Question | Pick | What shipped |
| --- | --- | --- |
| When the prompt appears | **Both** (pause and leaving the box) — was "On leaving the box" | On a pause while he is in the box (1.2 s after a finished sentence, 2.5 s mid-thought, and only if 12+ characters changed since the last request) and always on `onBlur`. The card is a sibling of the field, so the field is never rebuilt and a phone keyboard never resets. Typing again hides a card whose suggestion is for older words. |
| Fields he ignored when he hits Next | **Auto-clean + review screen** | *Not built yet.* The editor has no "Next". This arrives with the guided four-step intake (see below). |
| Rule for rewrites | **Reword only, never add facts** | Prompt forbids new facts and placeholders. The server also checks: a rewrite with a number (or `[X]`) that isn't in his text or answers is thrown away and his words come back unchanged. |
| Follow-up questions | **Ask, max one per job** — was "Ask every time" | The model asks for the single most valuable missing fact (how many, how often, how big, what result). A job's bullets share a `QuestionGate`: the first bullet to ask keeps that job's one question. The summary and project description get at most one each. His answer is the only new fact a re-polish may use. |
| What runs where | **Browser for spelling, Claude for sentences** | `spellFix` fixes misspellings as he types, with no network. `POST /api/ai/polish` handles the wording. |
| What it calls itself | **Polish** | The card is labelled "Polish". The buttons are "Use" and "Keep mine". |
| Talk instead of type | **Add a mic button** | Uses the browser's own speech recognition (Chrome, Edge, Safari). It's hidden where the browser can't listen (Firefox). Dictated words are added to the end of the field. |
| Keep his original words | **Keep, on device only** | When he taps "Use", his words are saved in `localStorage` (`launchpad.polish.originals.v1`), keyed by the polished text, up to 200 entries. "Undo polish" works after a reload. His words are never sent anywhere except in the Polish request itself. |

## Where it runs

- Summary (`kind: 'summary'`)
- Every bullet: experience, education, projects and custom sections (`kind: 'bullet'`, with the role as context)
- Project one-line description (`kind: 'description'`)

Short fields like titles, names and dates get spelling fixes only.

## Flow

1. He types. The browser fixes spelling on each word boundary.
2. He stops typing (1.2 s after a sentence ends, 2.5 s mid-sentence), or leaves the box. If the text is at least 8 characters, AI is on, and the text is new, Polish is requested.
3. A "Polishing…" line shows under the field. Then the card appears with the rewrite, a one-line reason, and any questions.
4. **Use** swaps in the rewrite, saves his words on the device, and shows a toast with Undo.
   **Keep mine** dismisses the card.
5. Answering a question and tapping **Add** re-polishes the same words with that fact.
6. If he goes back and types more while a request is in flight, the stale suggestion is dropped.
7. On a phone, the field he just left may have scrolled away. If the card lands off-screen, a toast says "Polish ready" and has a **Show** button.

## Known tensions

- **Pause-triggering costs calls.** Without guards it would be roughly 2–3× the on-blur-only count. Two guards cut that: a pause only counts after 12+ changed characters, and a mid-sentence pause must last 2.5 s. If it still feels busy, raise `POLISH_PAUSE_MIDTHOUGHT_MS` before dropping the pause.
- **A card can appear mid-sentence.** Less likely with the 2.5 s mid-thought pause. Typing again hides the card, so the cost is some flicker, never a wrong edit.
- **The no-new-facts check covers numbers only.** Tools, employers and titles rely on the prompt. A made-up tool name would get through the code check. The prompt is explicit, and he sees every rewrite before it lands, because nothing is applied without **Use**.
- **Latency.** Polish uses `effort: 'low'` and a 45-second client timeout.

## Next: the review screen at "Next"

This belongs to the guided intake from DESIGN-CONCIERGE.md (four steps: about you, work, school, skills). When he taps Next on a step:

1. Every prose field he never polished is sent to `/api/ai/polish`, reusing the same endpoint.
2. A review screen lists **his words → Polish** side by side. Each row has Use / Keep mine, plus a "Use all" button.
3. Questions from every field are gathered into one short list on that screen.

The endpoint, the no-new-facts check and on-device originals are already in place, so this is UI work.
