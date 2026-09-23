# Smart prompt — "Polish"

Who it's for: someone who writes the way they talk. Slang, fragments, no punctuation, bad
spelling. He types "i ran the grill and trained the new guys" and the résumé should end up with
clean, professional lines. The builder then improves the *clean* version, not his first draft.

## Decisions (Joshua, 2026-09-23)

| Question | Pick | What shipped |
| --- | --- | --- |
| When the prompt appears | **On leaving the box** | `onBlur` on the field. Nothing moves while he types, so a phone keyboard never resets. |
| Fields he ignored when he hits Next | **Auto-clean + review screen** | *Not built yet.* The editor has no "Next". This arrives with the guided four-step intake (see below). |
| Rule for rewrites | **Reword only, never add facts** | Prompt forbids new facts and placeholders. The server also checks: a rewrite with a number (or `[X]`) that isn't in his text or answers is thrown away and his words come back unchanged. |
| Follow-up questions | **Ask every time** | Every Polish that's missing a fact (how many, how often, how big, what result) shows up to two plain-English questions. His answer is the only new fact a re-polish may use. |
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
2. He leaves the box. If the text is at least 8 characters, AI is on, and the text is new, Polish is requested.
3. A "Polishing…" line shows under the field. Then the card appears with the rewrite, a one-line reason, and any questions.
4. **Use** swaps in the rewrite, saves his words on the device, and shows a toast with Undo.
   **Keep mine** dismisses the card.
5. Answering a question and tapping **Add** re-polishes the same words with that fact.
6. If he goes back and types more while a request is in flight, the stale suggestion is dropped.
7. On a phone, the field he just left may have scrolled away. If the card lands off-screen, a toast says "Polish ready" and has a **Show** button.

## Known tensions

- **"Ask every time" can nag.** Someone with rough wording will be missing a number in almost every bullet, so he'll see a question under almost every line. The cap is two questions per field, and the card never blocks typing. If it feels like nagging in real use, the fallback is at most one question per job.
- **The no-new-facts check covers numbers only.** Tools, employers and titles rely on the prompt. A made-up tool name would get through the code check. The prompt is explicit, and he sees every rewrite before it lands, because nothing is applied without **Use**.
- **Latency.** Polish uses `effort: 'low'` and a 45-second client timeout. The card appears after he has moved on, which is the point of on-blur.

## Next: the review screen at "Next"

This belongs to the guided intake from DESIGN-CONCIERGE.md (four steps: about you, work, school, skills). When he taps Next on a step:

1. Every prose field he never polished is sent to `/api/ai/polish`, reusing the same endpoint.
2. A review screen lists **his words → Polish** side by side. Each row has Use / Keep mine, plus a "Use all" button.
3. Questions from every field are gathered into one short list on that screen.

The endpoint, the no-new-facts check and on-device originals are already in place, so this is UI work.
