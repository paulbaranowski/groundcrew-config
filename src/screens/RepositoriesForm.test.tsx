import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { RepositoriesForm } from "./RepositoriesForm.tsx";

const draft = {
  workspace: {
    projectDir: "~/dev/groundcrew",
    knownRepositories: ["a/b", "a/b"],
  },
} as never;

test("renders the repo list and flags the duplicate", () => {
  const { lastFrame } = render(
    <RepositoriesForm draft={draft} onChange={() => {}} onBack={() => {}} />,
  );
  expect(lastFrame()).toContain("Repositories");
  expect(lastFrame()).toContain("a/b");
  expect(lastFrame()).toContain("duplicate");
  expect(lastFrame()).toContain("+ add");
});
