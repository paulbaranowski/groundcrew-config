# Releasing

Releases are driven by the version in `package.json`. The
[`release` workflow](.github/workflows/release.yml) runs on every push to `main`
and only acts when that version is one it hasn't tagged yet.

## Cutting a release

1. In your PR, bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Merge the PR.
3. On merge, the workflow:
   - tags `v<version>` and publishes a GitHub release with generated notes,
   - downloads the source tarball and computes its `sha256`,
   - rewrites `url` + `sha256` in `Formula/crew-config.rb` of
     [`paulbaranowski/homebrew-tap`](https://github.com/paulbaranowski/homebrew-tap)
     and pushes the bump.

`brew upgrade crew-config` then picks up the new version.

PRs that don't change the version (docs, refactors, chores) cut no release — the
workflow sees the tag already exists and no-ops.

## One-time setup: `HOMEBREW_TAP_TOKEN`

The default `GITHUB_TOKEN` cannot push to the separate tap repo, so the workflow
needs a token that can:

1. Create a **fine-grained personal access token**
   (GitHub → Settings → Developer settings → Fine-grained tokens).
   - Resource owner: `paulbaranowski`
   - Repository access: only `paulbaranowski/homebrew-tap`
   - Permissions: **Contents → Read and write**
2. Add it to this repo as a secret named `HOMEBREW_TAP_TOKEN`
   (Settings → Secrets and variables → Actions → New repository secret),
   or via CLI:

   ```bash
   gh secret set HOMEBREW_TAP_TOKEN --repo paulbaranowski/groundcrew-config
   ```

Until this secret exists, the formula-update step fails fast with a clear error
(the tag and GitHub release are still created).
