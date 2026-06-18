/*
 * Diablo chunk loader.
 *
 * The retail DIABDAT.MPQ (~517 MB) is too large to host as a single file on
 * GitHub (100 MB/file limit), so it is committed split into < 100 MB parts
 * under cdn.pvpgn.pro/diablo1/. This script fetches those parts from the same
 * origin (GitHub Pages -> no CORS issue), reassembles them into the full MPQ in
 * memory, then hands the result to the DiabloWeb engine by dispatching the same
 * "drop" event the engine already listens for (see App.onDrop / App.start).
 */
(function () {
  var PART_BASE = '/Diablo/cdn.pvpgn.pro/diablo1/DIABDAT.MPQ.part';
  var PART_COUNT = 6;

  function pad2(n) { return ('0' + n).slice(-2); }

  // ---- Overlay UI -----------------------------------------------------------
  var overlay = document.createElement('div');
  overlay.id = 'gh-loader';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'background:#000', 'color:#c9a227',
    'font-family:"Times New Roman",serif', 'text-align:center', 'padding:24px'
  ].join(';');
  overlay.innerHTML =
    '<h1 style="font-size:42px;letter-spacing:4px;margin:0 0 8px;color:#b71c1c;text-shadow:0 0 12px #b71c1c">DIABLO</h1>' +
    '<p style="max-width:520px;opacity:.8;margin:0 0 24px">Loads your retail game data straight from this GitHub repository. ' +
    'The full ~517&nbsp;MB is downloaded and assembled in your browser the first time you play.</p>' +
    '<button id="gh-play" style="font:bold 20px \'Times New Roman\',serif;color:#000;background:#c9a227;border:none;padding:14px 40px;cursor:pointer;border-radius:4px">▶ Play Diablo (Retail)</button>' +
    '<button id="gh-shareware" style="margin-top:12px;font:14px \'Times New Roman\',serif;color:#c9a227;background:none;border:1px solid #c9a227;padding:8px 20px;cursor:pointer;border-radius:4px">Play Shareware instead</button>' +
    '<div id="gh-status" style="margin-top:24px;min-height:20px;opacity:.85"></div>' +
    '<div style="width:420px;max-width:80vw;height:14px;background:#222;border:1px solid #555;border-radius:7px;margin-top:10px;overflow:hidden">' +
      '<div id="gh-bar" style="height:100%;width:0;background:#b71c1c;transition:width .2s"></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var statusEl = overlay.querySelector('#gh-status');
  var barEl = overlay.querySelector('#gh-bar');
  var playBtn = overlay.querySelector('#gh-play');
  var swBtn = overlay.querySelector('#gh-shareware');

  function setStatus(t) { statusEl.textContent = t; }
  function setProgress(frac) { barEl.style.width = (frac * 100).toFixed(1) + '%'; }

  // ---- Inject a File into the engine via its existing drop handler ----------
  function injectMpq(bytes) {
    var file = new File([bytes], 'DIABDAT.MPQ', { type: 'application/octet-stream' });
    var dt = new DataTransfer();
    dt.items.add(file);
    var ev = new Event('drop', { bubbles: true, cancelable: true });
    // App.onDrop reads e.dataTransfer; a plain property works since it is a real
    // addEventListener handler, not a React synthetic event.
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    document.dispatchEvent(ev);
  }

  // ---- Fetch + reassemble the parts -----------------------------------------
  function loadRetail() {
    playBtn.disabled = true;
    swBtn.disabled = true;
    playBtn.style.opacity = '.5';

    var buffers = new Array(PART_COUNT);
    var loadedBytes = 0;
    // We don't know the grand total up front; estimate from part count for the bar.
    var done = 0;

    function fetchPart(i) {
      if (i >= PART_COUNT) return Promise.resolve();
      setStatus('Downloading game data — part ' + (i + 1) + ' of ' + PART_COUNT + '…');
      return fetch(PART_BASE + pad2(i)).then(function (res) {
        if (!res.ok) throw new Error('Failed to download part ' + i + ' (HTTP ' + res.status + ')');
        return res.arrayBuffer();
      }).then(function (buf) {
        buffers[i] = new Uint8Array(buf);
        loadedBytes += buffers[i].length;
        done++;
        setProgress(done / (PART_COUNT + 0.5)); // leave headroom for assembly
        return fetchPart(i + 1);
      });
    }

    fetchPart(0).then(function () {
      setStatus('Assembling ' + (loadedBytes / 1048576).toFixed(0) + ' MB…');
      var mpq = new Uint8Array(loadedBytes);
      var off = 0;
      for (var i = 0; i < PART_COUNT; i++) {
        mpq.set(buffers[i], off);
        off += buffers[i].length;
        buffers[i] = null; // free as we go
      }
      setProgress(1);
      setStatus('Launching…');
      injectMpq(mpq);
      // Fade the overlay so the game canvas (rendered by the engine) shows.
      setTimeout(function () {
        overlay.style.transition = 'opacity .6s';
        overlay.style.opacity = '0';
        setTimeout(function () { overlay.remove(); }, 700);
      }, 400);
    }).catch(function (err) {
      setStatus('Error: ' + err.message);
      playBtn.disabled = false;
      swBtn.disabled = false;
      playBtn.style.opacity = '1';
    });
  }

  // ---- Shareware: defer to the engine's own built-in spawn.mpq path ---------
  function loadShareware() {
    // The engine ships spawn.mpq and shows a "Play Shareware" button; simplest is
    // to just remove our overlay and let the user use it.
    overlay.remove();
  }

  playBtn.addEventListener('click', loadRetail);
  swBtn.addEventListener('click', loadShareware);
})();
