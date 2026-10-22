(() => {
  const P = window.PROJECTS;
  const CATS = window.CATEGORIES;
  const catLabel = Object.fromEntries(CATS.map(c => [c.id, c.label]));
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  const SITE_URL = location.origin + location.pathname;
  const STATUS = {
    live:   { label: "Live", cls: "live" },
    lab:    { label: "In the lab", cls: "lab" },
    family: { label: "Family only", cls: "family" },
  };

  // ── Stats + marquee ────────────────────────────────────
  const liveCount = P.filter(p => p.status === "live").length;
  $("#stats").innerHTML = [
    [P.length, "Builds"],
    [liveCount, "Live now"],
    [CATS.length, "Kinds of thing"],
  ].map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join("");

  const names = P.map(p => `<span>${esc(p.title)}</span>`).join("");
  $("#marquee").innerHTML = names + names;

  // ── Filters ────────────────────────────────────────────
  let cat = "all";
  let liveOnly = false;

  function renderChips() {
    const pool = liveOnly ? P.filter(p => p.status === "live") : P;
    const chips = [{ id: "all", label: "All", n: pool.length }]
      .concat(CATS.map(c => ({ ...c, n: pool.filter(p => p.cat === c.id).length })))
      .filter(c => c.id === "all" || c.n > 0 || c.id === cat);
    $("#chips").innerHTML = chips.map(c =>
      `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${c.id === cat}">${esc(c.label)}<span class="n">${c.n}</span></button>`
    ).join("");
  }

  $("#chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    cat = b.dataset.cat;
    renderChips();
    renderGrid();
  });
  $("#live-only").addEventListener("change", e => {
    liveOnly = e.target.checked;
    renderChips();
    renderGrid();
  });

  // ── Cards ──────────────────────────────────────────────
  function typeArt(p) {
    return `<div class="type-art" data-glyph="${esc(p.title[0])}">${esc(p.title)}</div>`;
  }
  function badge(p) {
    const s = STATUS[p.status];
    return `<span class="badge ${s.cls}"><span class="dot" aria-hidden="true"></span>${s.label}</span>`;
  }
  const playIcon = `<span class="play-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg></span>`;

  function card(p, i) {
    const media = p.img
      ? `<img src="img/${p.img}.webp" alt="" loading="lazy" decoding="async">`
      : typeArt(p);
    return `<a class="card c-${p.cat}${p.featured && cat === "all" && !liveOnly ? " big" : ""}" href="#p/${p.id}" style="animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="card-media">${media}${badge(p)}${p.video ? playIcon : ""}</div>
      <div class="card-body">
        <p class="card-cat">${esc(catLabel[p.cat])}</p>
        <h3>${esc(p.title)}</h3>
        <p class="card-line">${esc(p.line)}</p>
      </div>
    </a>`;
  }

  function renderGrid() {
    const list = P.filter(p => (cat === "all" || p.cat === cat) && (!liveOnly || p.status === "live"));
    $("#grid").innerHTML = list.length
      ? list.map(card).join("")
      : `<p class="empty">Nothing live in this group yet. Turn off “Live only” to see what's in the lab.</p>`;
    const where = cat === "all" ? "" : ` in ${catLabel[cat]}`;
    $("#count").textContent = `${list.length} ${liveOnly ? "live " : ""}project${list.length === 1 ? "" : "s"}${where}`;
  }

  // ── Detail sheet ───────────────────────────────────────
  const sheet = $("#sheet");
  let openedByNav = false;

  function qrImg(url) {
    if (!window.qrcode) return "";
    const q = qrcode(0, "M");
    q.addData(url);
    q.make();
    return `<img src="${q.createDataURL(8, 0)}" alt="QR code for ${esc(url)}">`;
  }

  function showQR(url) {
    $("#qr").innerHTML = qrImg(url);
    $("#qr-wrap").hidden = !window.qrcode;
  }

  function fillProject(p) {
    sheet.className = `sheet c-${p.cat}`;
    const media = $("#sheet-media");
    if (p.video) {
      media.innerHTML = `<video controls playsinline preload="metadata" ${p.id === "tinydoor" ? "loop" : ""}
        poster="img/${p.img}.webp" src="video/${p.video}.mp4" aria-label="${esc(p.title)} video"></video>`;
    } else if (p.img) {
      media.innerHTML = `<img src="img/${p.img}.webp" alt="${esc(p.title)} screenshot">`;
    } else {
      media.innerHTML = typeArt(p);
    }
    $("#sheet-cat").textContent = catLabel[p.cat];
    $("#sheet-title").textContent = p.title;
    $("#sheet-line").textContent = p.line;
    $("#sheet-text").textContent = p.body;
    $("#sheet-tags").innerHTML = p.tags.map(t => `<li>${esc(t)}</li>`).join("");

    const a = $("#sheet-actions");
    $("#qr-wrap").hidden = true;
    if (p.status === "live") {
      a.innerHTML = `<a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">Open it
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.5"/></svg></a>
        <button type="button" class="btn secondary" id="qr-btn" aria-expanded="false">Show QR code</button>`;
      $("#qr-btn").addEventListener("click", e => {
        const open = $("#qr-wrap").hidden;
        if (open) showQR(p.url); else $("#qr-wrap").hidden = true;
        e.currentTarget.setAttribute("aria-expanded", String(open));
        e.currentTarget.textContent = open ? "Hide QR code" : "Show QR code";
      });
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
    $("#sheet-actions").innerHTML = `<button type="button" class="btn" id="copy-btn">Copy link</button>`;
    $("#copy-btn").addEventListener("click", async e => {
      const b = e.currentTarget;
      try {
        if (navigator.share) await navigator.share({ title: "Terrell Massey Sr. — Builds", url: SITE_URL });
        else { await navigator.clipboard.writeText(SITE_URL); b.textContent = "Copied ✓"; }
      } catch { b.textContent = "Copy failed — long-press the address bar"; }
    });
    if (navigator.share) $("#copy-btn").textContent = "Share link";
    showQR(SITE_URL);
  }

  function route() {
    const h = location.hash;
    const id = h.startsWith("#p/") ? h.slice(3) : null;
    const p = id && P.find(x => x.id === id);
    if (p) fillProject(p);
    else if (h === "#share") fillShare();
    else { if (sheet.open) sheet.close(); return; }
    if (!sheet.open) sheet.showModal();
    sheet.querySelector(".sheet-inner").scrollTop = 0;
    $("#sheet-close").focus();
  }

  function requestClose() {
    if (openedByNav) history.back();
    else {
      history.replaceState(null, "", location.pathname + location.search);
      route();
    }
  }

  window.addEventListener("hashchange", () => { openedByNav = true; route(); });
  $("#sheet-close").addEventListener("click", requestClose);
  sheet.addEventListener("cancel", e => { e.preventDefault(); requestClose(); });
  sheet.addEventListener("click", e => { if (e.target === sheet) requestClose(); });
  sheet.addEventListener("close", () => {
    sheet.querySelector("video")?.pause();
    openedByNav = false;
  });
  $("#share-site").addEventListener("click", () => { location.hash = "share"; });

  renderChips();
  renderGrid();
  route();
})();
