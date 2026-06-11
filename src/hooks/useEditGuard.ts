import { useRef, useState } from "react";

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
  // `dirty` is a ref, not state: nothing renders from it, and `requestCancel`
  // runs inside a `useInput` handler that must observe an edit made earlier in
  // the same tick. A state value would still read `false` until React re-renders,
  // so a fast type-then-esc could skip the guard and discard the edit — exactly
  // the data loss this hook exists to prevent. `guarding` stays state (it flips
  // what renders). This mirrors `ShellSourceSubForm`'s `activeRef` trick.
  const dirtyRef = useRef(false);
  const [guarding, setGuarding] = useState(false);
  const markDirty = (): void => {
    dirtyRef.current = true;
  };
  return {
    guarding,
    track:
      <T>(set: (value: T) => void) =>
      (value: T) => {
        markDirty();
        set(value);
      },
    markDirty,
    requestCancel: (onCancel: () => void) => {
      if (dirtyRef.current) setGuarding(true);
      else onCancel();
    },
    keepEditing: () => setGuarding(false),
  };
}
