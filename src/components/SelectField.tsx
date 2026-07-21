import { Box, Text, useInput } from "ink";

// Generic over the option literal `T` so a caller passing a domain enum
// (`RUNNERS`, `NETWORK_EGRESS`, …) gets an `onChange` typed to that enum rather
// than bare `string` — a wrong literal handed back to the writer fails to
// compile. Callers with a plain `readonly string[]` (SectionForm) infer `string`
// and behave exactly as before.
interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  isActive: boolean;
  onChange: (next: T) => void;
  /** True when the current value differs from its last-saved baseline. */
  modified?: boolean;
}

// A left/right-arrow option cycler (not a dropdown): renders every option inline
// with the active one in brackets, wrapping past the ends.
export function SelectField<T extends string>({
  label,
  value,
  options,
  isActive,
  onChange,
  modified = false,
}: Props<T>) {
  useInput(
    (_input, key) => {
      if (options.length === 0) return; // nothing to cycle; avoids `% 0` → NaN
      const index = Math.max(0, options.indexOf(value));
      if (key.rightArrow)
        onChange(options[(index + 1) % options.length] ?? value);
      if (key.leftArrow)
        onChange(
          options[(index - 1 + options.length) % options.length] ?? value,
        );
    },
    { isActive },
  );

  return (
    <Box>
      <Text color={isActive ? "cyan" : undefined}>
        {isActive ? "› " : "  "}
        {label}{" "}
      </Text>
      <Text>
        {options
          .map((opt) => (opt === value ? `[${opt}]` : ` ${opt} `))
          .join(" ")}
      </Text>
      {modified ? <Text color="yellow"> ●</Text> : null}
    </Box>
  );
}
