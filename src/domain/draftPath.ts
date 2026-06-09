function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getByPath(draft: unknown, path: string): unknown {
  let current: unknown = draft;
  for (const key of path.split(".")) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function setByPath<T extends Record<string, unknown>>(
  draft: T,
  path: string,
  value: unknown,
): T {
  const keys = path.split(".");
  const [head, ...rest] = keys;
  if (head === undefined) return draft;
  const clone: Record<string, unknown> = { ...draft };
  if (rest.length === 0) {
    if (value === undefined) delete clone[head];
    else clone[head] = value;
  } else {
    const child = isObject(clone[head])
      ? (clone[head] as Record<string, unknown>)
      : {};
    clone[head] = setByPath(child, rest.join("."), value);
  }
  return clone as T;
}
