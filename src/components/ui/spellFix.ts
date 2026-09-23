/**
 * Opt-in spelling autocorrect for text controls. Runs inside the control's own change
 * handler, before the caller sees the event, so the caller simply receives corrected
 * text. The DOM node is edited in place (never re-created), so a phone keyboard keeps
 * its layout and the caret stays where the person is typing.
 */
import type { ChangeEvent } from 'react';
import { autocorrectAt } from '@/lib/text/autocorrect';

export function applySpellFix(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
  const el = event.target;
  const inputType = (event.nativeEvent as InputEvent | undefined)?.inputType ?? '';
  // Only while typing forwards; never fight a backspace, a paste or an undo.
  if (inputType !== 'insertText' && inputType !== 'insertLineBreak') return;
  const caret = el.selectionStart ?? el.value.length;
  const fix = autocorrectAt(el.value, caret);
  if (!fix) return;
  el.value = fix.text;
  try {
    el.setSelectionRange(fix.caret, fix.caret);
  } catch {
    // Some input types don't support selection; the value is still corrected.
  }
}
