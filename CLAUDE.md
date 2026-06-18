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

## Web app (implemented)

- **Engine:** Prebuilt DiabloWeb (DevilutionX WASM) vendored from `d07RiV/diabloweb` `gh-pages`. Asset base path rebased from `/diabloweb/` to `/Diablo/` (project-site path). Source maps + service worker stripped to avoid stale caching. `node-sass` won't build on Node 22, so building from source is not viable — we patch the prebuilt bundle instead.
- **Chunk loader:** `autoload.js` shows an overlay with a "Play Diablo (Retail)" button. On click it fetches the 6 `DIABDAT.MPQ.part*` chunks from `/Diablo/cdn.pvpgn.pro/diablo1/`, reassembles them into one `Uint8Array` in memory, wraps it in a `File('DIABDAT.MPQ')`, and dispatches a synthetic `drop` event. The engine's existing `App.onDrop` (a plain `document` listener, not a React synthetic event) picks it up and launches retail. A "Play Shareware" fallback uses the bundled `spawn.mpq`.
- **Deploy:** `.github/workflows/pages.yml` deploys the whole repo to GitHub Pages on every push to `main`, using `actions/configure-pages@v5` with `enablement: true` so Pages turns on automatically (no manual Settings toggle).
- **Live URL (after first successful workflow run):** https://knightdx91-alt.github.io/Diablo/

## Notes / caveats

- Reassembling ~517 MB lives in a single tab's memory (~1 GB peak during assembly). Fine on desktop; may be heavy on phones/tablets.
- First load downloads the full ~517 MB; the engine caches game files in IndexedDB afterward.
