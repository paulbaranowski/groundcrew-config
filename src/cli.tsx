import { render } from "ink";
import { App } from "./app.tsx";
import { loadDraft } from "./io/load.ts";
import { locate } from "./io/locate.ts";

const { target, path: configPath } = locate(process.argv.slice(2), process.cwd());
const initialDraft = await loadDraft(configPath);
render(<App initialDraft={initialDraft} target={target} />);
