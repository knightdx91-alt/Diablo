# Project Notes

## Workflow conventions

- **Publishing:** We only publish on `main`. That is the only branch we publish from.
- **No PRs:** We don't do pull requests at all. Everything gets pushed directly to `main`.
- **Agents:** We do not run any agents at all. Run everything yourself — do not delegate work to sub-agents.

## Project goal

Play **Diablo 1** in the browser using the user's own game files, hosted on this GitHub repo.

## Architecture decisions

- **Engine:** Use **DiabloWeb** (DevilutionX compiled to WebAssembly). The engine is tiny (~3 MB of `.wasm`) and will be hosted on **GitHub Pages**.
- **Game data hosting:** The retail `DIABDAT.MPQ` is ~517 MB.
  - GitHub repos block any single file > 100 MB, so the MPQ cannot be committed whole.
  - GitHub **Releases** were ruled out: release assets are served without `Access-Control-Allow-Origin`, so the browser game cannot `fetch()` them (CORS-blocked).
  - **Chosen approach:** split the MPQ into < 100 MB chunks committed to the repo and served by **GitHub Pages same-origin** (no CORS issue). The web app fetches the chunks, reassembles the MPQ in memory, and launches the game.
- **Trade-off accepted:** committing chunks to the public repo makes the game data world-downloadable. (User opted to proceed; revisit if they want it private / external-hosted instead.)

## Current status

- `DIABDAT.MPQ` split with `split -b 95m -d` into 6 parts and pushed to `main` (commit `ca95b7a`).
- Chunks live at `cdn.pvpgn.pro/diablo1/DIABDAT.MPQ.part00` … `part05`.
  - `part00`–`part04`: 99,614,720 bytes each; `part05`: 19,427,642 bytes; total **517,501,242 bytes**.
  - Reassembly order: `part00` → `part05`.
- The original `DIABDAT.MPQ` is git-ignored (too big to commit).

## TODO (next steps)

1. Add the DiabloWeb static app (prebuilt engine from `d07RiV/diabloweb` gh-pages, with asset paths rebased from `/diabloweb/` to `/Diablo/`).
2. Modify the app to fetch the `DIABDAT.MPQ.part*` chunks, concatenate them, and feed the result to the engine instead of using the local file picker.
3. Enable GitHub Pages on `main` and verify the game boots end-to-end.
