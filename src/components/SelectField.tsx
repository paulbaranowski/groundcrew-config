import { Box, Text, useInput } from "ink";

interface Props {
  label: string;
  value: string;
  options: readonly string[];
  isActive: boolean;
  onChange: (next: string) => void;
}

// A left/right-arrow option cycler (not a dropdown): renders every option inline
// with the active one in brackets, wrapping past the ends.
export function SelectField({
  label,
  value,
  options,
  isActive,
  onChange,
}: Props) {
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
    </Box>
  );
}
