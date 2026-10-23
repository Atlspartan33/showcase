(() => {
  const P = window.PROJECTS;
  const CATS = window.CATEGORIES;
  const catLabel = Object.fromEntries(CATS.map(c => [c.id, c.label]));
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SITE_URL = location.origin + location.pathname;
  const absUrl = u => new URL(u, SITE_URL).href;

  // What a tap on "Play" does for a project: run the app, play the film, or nothing.
  const action = p => (p.url ? "play" : p.video ? "watch" : null);
  const isPlayable = p => !!action(p);

  const ICON_PLAY = `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>`;
  const ICON_EXT = `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;

  function playButton(p, cls = "play-btn") {
    const a = action(p);
    if (!a) return "";
    const label = a === "play" ? "Play" : "Watch";
    return `<button type="button" class="${cls}${a === "watch" ? " watch" : ""}" data-play="${p.id}" aria-label="${label} ${esc(p.title)}">${ICON_PLAY}${label}</button>`;
  }

  $("#total").textContent = `(${P.length})`;

  // ── Hero carousel ──────────────────────────────────────
  const slides = P.filter(p => p.hero && p.img && isPlayable(p)).sort((a, b) => a.hero - b.hero);
  const carousel = $("#carousel");
  const DUR = 6000;
  let cur = 0, timer = null, paused = false;

  $("#slides").innerHTML = slides.map((p, i) => `
    <div class="slide c-${p.cat}" id="slide-${i}" role="tabpanel" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}: ${esc(p.title)}" ${i ? 'aria-hidden="true"' : ""}>
      <img src="img/${p.img}.webp" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
      <a class="slide-open" href="#p/${p.id}" tabindex="${i ? -1 : 0}" aria-label="About ${esc(p.title)}"></a>
      <div class="slide-cap">
        <div>
          <p class="slide-kicker">${esc(catLabel[p.cat])}</p>
          <p class="slide-title">${esc(p.title)}</p>
          <p class="slide-line">${esc(p.line)}</p>
        </div>
        ${playButton(p, "btn")}
      </div>
    </div>`).join("");
  $("#progress").innerHTML = slides.map((p, i) =>
    `<button type="button" role="tab" aria-controls="slide-${i}" aria-selected="${i === 0}" aria-label="Show ${esc(p.title)}"><span></span></button>`
  ).join("");
  carousel.style.setProperty("--dur", DUR + "ms");

  function show(i) {
    cur = (i + slides.length) % slides.length;
    carousel.querySelectorAll(".slide").forEach((s, k) => {
      s.classList.toggle("on", k === cur);
      s.toggleAttribute("aria-hidden", k !== cur);
      s.querySelectorAll("a, button").forEach(el => (el.tabIndex = k === cur ? 0 : -1));
    });
    $("#progress").querySelectorAll("button").forEach((b, k) => {
      b.setAttribute("aria-selected", String(k === cur));
      b.classList.toggle("done", k < cur);
      // Restart the fill animation on the active bar.
      const span = b.firstElementChild;
      span.style.animation = "none"; void span.offsetWidth; span.style.animation = "";
    });
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (reduceMotion || paused || slides.length < 2) return;
    timer = setTimeout(() => show(cur + 1), DUR);
  }
  function setPaused(v) {
    paused = v;
    carousel.classList.toggle("paused", v);
    if (v) clearTimeout(timer); else schedule();
  }
  if (slides.length) {
    $("#slides .slide").classList.add("on");
    if (reduceMotion) carousel.classList.add("paused");
    $("#progress").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (b) show([...b.parentNode.children].indexOf(b));
    });
    carousel.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") setPaused(true); });
    carousel.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") setPaused(false); });
    carousel.addEventListener("focusin", () => setPaused(true));
    carousel.addEventListener("focusout", e => { if (!carousel.contains(e.relatedTarget)) setPaused(false); });
    document.addEventListener("visibilitychange", () => setPaused(document.hidden));
    // Swipe on touch.
    let x0 = null;
    carousel.addEventListener("pointerdown", e => { swallowClick = false; if (e.pointerType !== "mouse") x0 = e.clientX; });
    carousel.addEventListener("pointerup", e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { show(cur + (dx < 0 ? 1 : -1)); }
    });
    carousel.addEventListener("click", e => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; } }, true);
    let swallowClick = false;
    carousel.addEventListener("pointermove", e => { if (x0 !== null && Math.abs(e.clientX - x0) > 12) swallowClick = true; });
    schedule();
  } else {
    carousel.hidden = true;
  }

  // ── Filters ────────────────────────────────────────────
  let cat = "all";
  let playOnly = false;

  function renderChips() {
    const pool = playOnly ? P.filter(isPlayable) : P;
    const chips = [{ id: "all", label: "All", n: pool.length }]
      .concat(CATS.map(c => ({ ...c, n: pool.filter(p => p.cat === c.id).length })))
      .filter(c => c.id === "all" || c.n > 0 || c.id === cat);
    $("#chips").innerHTML = chips.map(c =>
      `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${c.id === cat}">${esc(c.label)}<span class="n">${c.n}</span></button>`
    ).join("");
  }
  function refilter() {
    renderChips();
    renderGrid();
    const w = $("#work");
    if (w.getBoundingClientRect().top < 0) w.scrollIntoView({ behavior: "instant" });
  }
  $("#chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    cat = b.dataset.cat;
    refilter();
  });
  $("#play-only").addEventListener("change", e => {
    playOnly = e.target.checked;
    refilter();
  });

  // ── Cards ──────────────────────────────────────────────
  const typeArt = p => `<div class="type-art" data-glyph="${esc(p.title[0])}">${esc(p.title)}</div>`;
  function badge(p) {
    if (isPlayable(p)) return "";
    const fam = p.status === "family";
    return `<span class="badge ${fam ? "family" : "lab"}"><span class="dot" aria-hidden="true"></span>${fam ? "Family only" : "In the lab"}</span>`;
  }

  function card(p, i) {
    const media = p.img ? `<img src="img/${p.img}.webp" alt="" loading="lazy" decoding="async">` : typeArt(p);
    const big = p.featured && cat === "all" && !playOnly;
    return `<article class="card c-${p.cat}${big ? " big" : ""}" style="animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="card-media">${media}${badge(p)}${playButton(p)}</div>
      <div class="card-body">
        <p class="card-cat">${esc(catLabel[p.cat])}</p>
        <h3><a class="card-link" href="#p/${p.id}">${esc(p.title)}</a></h3>
        <p class="card-line">${esc(p.line)}</p>
      </div>
    </article>`;
  }

  function renderGrid() {
    const list = P.filter(p => (cat === "all" || p.cat === cat) && (!playOnly || isPlayable(p)));
    $("#grid").innerHTML = list.length
      ? list.map(card).join("")
      : `<p class="empty">Nothing playable in this group yet. Turn off “Playable” to see what's in the lab.</p>`;
    const where = cat === "all" ? "" : ` in ${catLabel[cat]}`;
    $("#count").textContent = `${list.length} ${playOnly ? "playable " : ""}project${list.length === 1 ? "" : "s"}${where}`;
  }

  // ── Detail sheet ───────────────────────────────────────
  const sheet = $("#sheet");
  const player = $("#player");
  let openedByNav = false;
  let returnFocus = null;

  function qrImg(url) {
    if (!window.qrcode) return "";
    const q = qrcode(0, "M");
    q.addData(url);
    q.make();
    const size = q.getModuleCount() * 6 + 48;
    return `<img src="${q.createDataURL(6, 24)}" width="${size}" height="${size}" alt="QR code for ${esc(url)}">`;
  }
  function showQR(url) {
    $("#qr").innerHTML = qrImg(url);
    $("#qr-wrap").hidden = !window.qrcode;
  }

  function fillProject(p) {
    sheet.className = `sheet c-${p.cat}`;
    $("#sheet-media").innerHTML = p.img ? `<img src="img/${p.img}.webp" alt="${esc(p.title)} screenshot">` : typeArt(p);
    $("#sheet-cat").textContent = catLabel[p.cat];
    $("#sheet-title").textContent = p.title;
    $("#sheet-line").textContent = p.line;
    $("#sheet-text").textContent = p.body;
    $("#sheet-tags").innerHTML = p.tags.map(t => `<li>${esc(t)}</li>`).join("");
    $("#qr-wrap").hidden = true;

    const a = $("#sheet-actions");
    const act = action(p);
    if (act === "play") {
      a.innerHTML = `${playButton(p, "btn")}
        <a class="btn secondary" href="${esc(p.url)}" target="_blank" rel="noopener">New tab ${ICON_EXT}</a>
        <button type="button" class="btn secondary" id="qr-btn" aria-expanded="false">QR code</button>`;
      $("#qr-btn").addEventListener("click", e => {
        const open = $("#qr-wrap").hidden;
        if (open) { showQR(absUrl(p.url)); $("#qr-wrap").scrollIntoView({ block: "end" }); }
        else $("#qr-wrap").hidden = true;
        e.currentTarget.setAttribute("aria-expanded", String(open));
        e.currentTarget.textContent = open ? "Hide QR" : "QR code";
      });
    } else if (act === "watch") {
      a.innerHTML = playButton(p, "btn");
    } else if (p.status === "family") {
      a.innerHTML = `<p class="note">Live, but the link stays in the family. Ask and I'll show you on my phone.</p>`;
    } else {
      a.innerHTML = `<p class="note">In the lab: built and working, not public yet. Ask for a demo.</p>`;
    }
  }

  function fillShare() {
    sheet.className = "sheet c-work";
    $("#sheet-media").innerHTML = `<div class="type-art" style="background:var(--accent)" data-glyph="T">Terrell Massey Sr.</div>`;
    $("#sheet-cat").textContent = "Share";
    $("#sheet-title").textContent = "Take it with you";
    $("#sheet-line").textContent = "Scan this to open the whole showcase on your phone.";
    $("#sheet-text").textContent = SITE_URL;
    $("#sheet-tags").innerHTML = "";
    $("#sheet-actions").innerHTML = `<button type="button" class="btn" id="copy-btn">${navigator.share ? "Share link" : "Copy link"}</button>`;
    $("#copy-btn").addEventListener("click", async e => {
      const b = e.currentTarget;
      try {
        if (navigator.share) await navigator.share({ title: "Terrell Massey Sr. — Builds", url: SITE_URL });
        else { await navigator.clipboard.writeText(SITE_URL); b.textContent = "Copied ✓"; }
      } catch (err) {
        if (err.name !== "AbortError") b.textContent = "Couldn't copy. The link is shown above.";
      }
    });
    showQR(SITE_URL);
  }

  // ── Player ─────────────────────────────────────────────
  function fillPlayer(p) {
    const stage = $("#player-stage");
    $("#player-title").textContent = p.title;
    const ext = $("#player-ext");
    if (p.url) {
      ext.href = p.url;
      stage.innerHTML = `<div class="loading"><div><div class="spinner"></div>Loading ${esc(p.title)}…</div></div>
        <iframe title="${esc(p.title)}" src="${esc(p.url)}"
          allow="camera; microphone; midi; fullscreen; autoplay; accelerometer; gyroscope; screen-wake-lock; clipboard-write"></iframe>`;
      stage.querySelector("iframe").addEventListener("load", () => stage.querySelector(".loading")?.remove(), { once: true });
    } else {
      ext.href = `video/${p.video}.mp4`;
      stage.innerHTML = `<video controls autoplay playsinline ${p.id === "tinydoor" ? "loop" : ""}
        poster="img/${p.img}.webp" src="video/${p.video}.mp4" aria-label="${esc(p.title)}"></video>`;
    }
  }

  // ── Routing: #p/<id> sheet · #play/<id> player · #share ─
  function route() {
    const h = location.hash;
    let target = null;
    if (h.startsWith("#p/") && byId[h.slice(3)]) { target = sheet; fillProject(byId[h.slice(3)]); }
    else if (h.startsWith("#play/") && byId[h.slice(6)] && isPlayable(byId[h.slice(6)])) { target = player; fillPlayer(byId[h.slice(6)]); }
    else if (h === "#share") { target = sheet; fillShare(); }

    for (const d of [sheet, player]) if (d !== target && d.open) d.close();
    if (!target) return;
    if (!target.open) {
      if (!returnFocus || !returnFocus.isConnected || returnFocus === document.body) returnFocus = document.activeElement;
      target.showModal();
    }
    if (target === sheet) sheet.querySelector(".sheet-inner").scrollTop = 0;
    target.querySelector("[data-close]").focus();
  }

  const ROUTED = /^#(p\/|play\/|share$)/;
  function requestClose() {
    if (openedByNav) history.back();
    else {
      history.replaceState(null, "", location.pathname + location.search);
      route();
    }
  }

  window.addEventListener("hashchange", () => { openedByNav = true; route(); });
  for (const d of [sheet, player]) {
    d.addEventListener("cancel", e => { e.preventDefault(); requestClose(); });
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-close]")) requestClose();
    });
    d.addEventListener("close", () => {
      if (d === player) $("#player-stage").innerHTML = "";
      d.querySelector("video")?.pause();
      if (sheet.open || player.open) return;
      openedByNav = false;
      // Closed some other way (e.g. Android back): drop the stale hash so the same card can reopen.
      if (ROUTED.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    });
  }

  function go(hash) {
    if (location.hash === hash) { openedByNav = false; route(); }
    else location.hash = hash;
  }
  document.addEventListener("click", e => {
    const pb = e.target.closest("[data-play]");
    if (pb) { e.preventDefault(); go("#play/" + pb.dataset.play); return; }
    const a = e.target.closest('a[href^="#p/"]');
    if (a && a.getAttribute("href") === location.hash && !sheet.open) { e.preventDefault(); go(location.hash); }
  });
  $("#share-site").addEventListener("click", () => go("#share"));
  $("#surprise").addEventListener("click", () => {
    const pool = P.filter(p => p.url);
    go("#play/" + pool[Math.floor(Math.random() * pool.length)].id);
  });

  renderChips();
  renderGrid();
  route();
})();
