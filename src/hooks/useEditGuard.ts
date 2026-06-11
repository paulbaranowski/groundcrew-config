import { useState } from "react";

export interface EditGuard {
  /** True while the SaveGuard popup is showing. Gate the editor's own `useInput` on `!guarding`. */
  guarding: boolean;
  /** Wrap a field setter so any edit through it marks the buffer dirty. */
  track: <T>(set: (value: T) => void) => (value: T) => void;
  /** Mark the buffer dirty directly — for edits not made through a plain setter (e.g. a nested sub-editor commit). */
  markDirty: () => void;
  /** Call on esc: pops the guard when the buffer is dirty, else cancels immediately. */
  requestCancel: (onCancel: () => void) => void;
  /** Dismiss the guard and resume editing. */
  keepEditing: () => void;
}

/**
 * Dirty-tracking for a buffered sub-editor (Enter commits, esc discards). Pairs
 * with `SaveGuard`: wrap field setters with `track` (or call `markDirty`), gate
 * the editor's `useInput` on `!guarding`, route esc through `requestCancel`, and
 * render `<SaveGuard>` while `guarding`. An untouched editor stays un-dirty, so
 * esc exits it on the first press — no popup for a no-op edit.
 */
export function useEditGuard(): EditGuard {
  const [dirty, setDirty] = useState(false);
  const [guarding, setGuarding] = useState(false);
  return {
    guarding,
    track:
      <T>(set: (value: T) => void) =>
      (value: T) => {
        setDirty(true);
        set(value);
      },
    markDirty: () => setDirty(true),
    requestCancel: (onCancel: () => void) => {
      if (dirty) setGuarding(true);
      else onCancel();
    },
    keepEditing: () => setGuarding(false),
  };
}
