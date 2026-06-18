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

## Web app (implemented — streaming rebuild)

- **Engine:** DiabloWeb (DevilutionX WASM) **built from source** (`d07RiV/diabloweb`), not the prebuilt gh-pages bundle. The committed `.wasm` engine binaries are reused as-is (no Emscripten/C++ compile needed); only the JS frontend is rebuilt. The build is vendored into the repo root and served from `/Diablo/`.
- **Why we rebuild now:** the old prebuilt bundle loaded the whole MPQ into one in-memory buffer, which (a) doubled peak memory during assembly and (b) required a single ~517 MB `ArrayBuffer`. On phones/tablets that allocation simply fails (`Array buffer allocation failed`, then `NotReadableError` from the engine's `FileReader`). No amount of loader tweaking fixes it — the fix is to **never hold the whole file at once**.
- **Build notes (Node 22):**
  - `node-sass` → swapped for `sass` (dart-sass, pure JS) via `implementation: require('sass')` in `config/webpack.config.js`. Only one SCSS file (`App.scss`).
  - `peerjs` pinned to `1.3.2` (newer 1.5.x uses private class fields webpack 4 can't parse).
  - Build with `NODE_OPTIONS=--openssl-legacy-provider CI=false npm run build`.
  - `homepage` set to `https://knightdx91-alt.github.io/Diablo` so `PUBLIC_URL=/Diablo`.
- **Streaming (`RemoteFile` in `src/api/game.worker.js`):** streams the MPQ by fetching small **pre-split chunk files whole** (plain GET, no Range), keeping only a bounded **LRU window** resident (`MaxCachedChunks = 64` × 2 MB ≈ 128 MB ceiling). The engine's `DApi` file interface (`get_file_size` + `subarray`) is byte-range based, so it reads on demand — never the full 517 MB.
  - **Why whole-chunk GET, NOT HTTP Range (important):** GitHub Pages (Fastly) gzip-compresses *every* response, and browsers always send `Accept-Encoding: gzip` (a forbidden header we cannot unset). When `Range` + gzip are combined, Fastly applies the range to the **compressed** byte stream and returns 206 with `content-encoding: gzip` — so a ranged read yields gzip bytes, not file data, and the MPQ reads as corrupt (`archive.cpp:52`, hash-table read). A full GET of a whole file is decompressed correctly by the browser. Hence we split at rest and never use Range. (Confirmed: `curl -H "Accept-Encoding: gzip" -H "Range: bytes=0-7"` returns `1f 8b 08…`, the gzip magic.)
  - **Data layout:** `DIABDAT.MPQ` is committed pre-split into **247 fixed-size 2 MB chunk files** `c000`–`c246` (last 1,601,850 B) under `cdn.pvpgn.pro/diablo1/diabdat/`. `RemoteFile` is constructed with the chunk-URL list, `chunkSize = 2 MB`, and `total = 517501242` (no `HEAD` needed — and HEAD content-length is unreliable here since it reports the gzip-compressed size). The old 6 `DIABDAT.MPQ.part0X` parts were removed.
- **Retail entry point:** `App.start(null, true)` triggers remote retail (no local file). `init_game` with no `mpq` builds the part-URL list and uses `RemoteFile`. UI has a **"Play Diablo (Retail)"** button (streams), plus the original Select-MPQ and Play-Shareware paths. Shareware streams single-file `spawn.mpq`.
- **Service worker:** disabled at source (`src/index.js` calls `serviceWorker.unregister()`), and `service-worker.js`/`precache-manifest*` are not deployed. This avoids the stale-cache traps we hit repeatedly. Source maps also not deployed.
- **Deploy:** `.github/workflows/pages.yml` deploys the whole repo to GitHub Pages on every push to `main` (`actions/configure-pages@v5`, `enablement: true`).
- **Live URL:** https://knightdx91-alt.github.io/Diablo/

## Notes / caveats

- Memory is now bounded (~192 MB worst case), so retail works on phones/tablets. No upfront 517 MB allocation.
- Requires the host to serve HTTP Range requests. GitHub Pages (Fastly) returns `206`; if a host ignores Range and returns `200`, `RemoteFile` falls back to slicing the full part (correct but bandwidth-heavy).
- First access to each region of the MPQ incurs a network fetch (synchronous XHR in the worker); subsequent reads hit the chunk cache. Slight hitches possible on first entry to a new area.
- The original `DIABDAT.MPQ` is git-ignored. The 6 part files are committed under `cdn.pvpgn.pro/diablo1/` (the duplicate root-level `DIABDAT.MPQ.part0X` copies were removed; streaming uses the `cdn.pvpgn.pro` copies).
