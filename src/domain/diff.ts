import { isObject } from "./guards.ts";

/**
 * Recursive deep equality used as the spine of unsaved-edit detection. Object
 * comparison is key-order-insensitive; arrays compare by index and length;
 * primitives compare with ===. A missing key is treated as `undefined`, so
 * `{ a: 1 }` and `{ a: 1, b: undefined }` are equal — `setByPath` deletes blank
 * fields, and a revert must read as no-diff.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!valuesEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Dotted leaf paths where `a` and `b` differ. Arrays use numeric index segments
 * (`sources.0.enabled`). When the two sides differ in type at a node — object
 * vs primitive, or differing array length — the node's path is emitted and
 * traversal does not descend further: at that point the children are
 * incomparable and listing every deep difference would be misleading.
 */
export function changedPaths(a: unknown, b: unknown): string[] {
  const paths: string[] = [];
  walk(a, b, "", paths);
  return paths;
}

function walk(a: unknown, b: unknown, prefix: string, out: string[]): void {
  if (valuesEqual(a, b)) return;
  // A missing/undefined side against a container is treated as that container's
  // empty: descend into the present side so the leaf paths get reported
  // (an added or removed subtree should list its leaves, not just the root).
  const aArray = Array.isArray(a);
  const bArray = Array.isArray(b);
  const aObject = isObject(a);
  const bObject = isObject(b);
  if (
    (aArray || bArray) &&
    (aArray || a === undefined) &&
    (bArray || b === undefined)
  ) {
    const aa = aArray ? a : [];
    const bb = bArray ? b : [];
    if (aa.length !== bb.length) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < aa.length; i++) {
      walk(aa[i], bb[i], join(prefix, String(i)), out);
    }
    return;
  }
  if (
    (aObject || bObject) &&
    (aObject || a === undefined) &&
    (bObject || b === undefined)
  ) {
    const aa: Record<string, unknown> = aObject ? a : {};
    const bb: Record<string, unknown> = bObject ? b : {};
    const keys = new Set<string>([...Object.keys(aa), ...Object.keys(bb)]);
    for (const key of keys) {
      walk(aa[key], bb[key], join(prefix, key), out);
    }
    return;
  }
  // Leaf, type mismatch (object vs primitive, array vs object), or primitive
  // diff — emit the path. An empty prefix means the diff is at the root; emit
  // "" so callers see exactly one entry rather than zero.
  out.push(prefix);
}

function join(prefix: string, segment: string): string {
  return prefix.length === 0 ? segment : `${prefix}.${segment}`;
}
