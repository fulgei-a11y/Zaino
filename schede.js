/* Zaino — Schede di studio dalle mappe.
   Una scheda di copertina con l'indice, poi una scheda per ogni ramo della mappa.
   Si sfogliano, si ascoltano, si stampano (una per foglio A4 orizzontale).
   Facoltativo: l'IA aggiunge a ogni scheda una spiegazione breve e la frase da ricordare. */
"use strict";

const slides = {
  list: [], i: 0,

  /** Costruisce le schede dalla mappa aperta. */
  build() {
    const root = mindmap.root;
    const notes = root.notes || {};
    const MAX = 7; // righe per scheda: oltre, la scheda continua nella successiva
    const out = [];
    const branches = root.children;
    out.push({ kind: "cover", title: root.text, items: branches.map(b => ({ text: b.text, sub: [] })), color: "#2c47c9", soft: "#e9edfc", note: notes.__intro });
    branches.forEach((b, bi) => {
      const [soft, color] = BRANCH_COLORS[bi % BRANCH_COLORS.length];
      const flat = (n) => [n.text, ...n.children.flatMap(flat)];
      const items = b.children.map(c => ({ text: c.text, sub: c.children.flatMap(flat) }));
      // divido in più schede se le righe sono troppe
      const chunks = [];
      let cur = [], lines = 0;
      for (const it of items) {
        const l = 1 + it.sub.length;
        if (cur.length && lines + l > MAX) { chunks.push(cur); cur = []; lines = 0; }
        cur.push(it); lines += l;
      }
      if (cur.length || !chunks.length) chunks.push(cur);
      chunks.forEach((ch, k) => out.push({
        kind: "branch", title: b.text + (k ? " (continua)" : ""), items: ch, color, soft, ai: b.ai,
        note: k === chunks.length - 1 ? notes[b.text] : null, part: k
      }));
    });
    if (notes.__domande?.length) out.push({ kind: "questions", title: "Domande per ripassare", items: notes.__domande.map(q => ({ text: q, sub: [] })), color: "#1c2440", soft: "#f5f6fa" });
    this.list = out;
  },

  html(s, n, total) {
    const topic = escapeHtml(mindmap.root.text);
    const list = s.items.length
      ? `<${s.kind === "questions" ? "ol" : "ul"} class="sl-list">${s.items.map(it => `<li><span>${escapeHtml(it.text)}</span>${it.sub.length ? `<ul>${it.sub.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</${s.kind === "questions" ? "ol" : "ul"}>`
      : `<p class="sl-empty">Questo ramo non ha ancora dettagli: aggiungili nella mappa o chiedi le spiegazioni all'IA.</p>`;
    const note = s.note ? `<div class="sl-note">${s.note.spiegazione ? `<p>${escapeHtml(s.note.spiegazione)}</p>` : ""}${s.note.ricorda ? `<p class="sl-key"><b>Da ricordare:</b> ${escapeHtml(s.note.ricorda)}</p>` : ""}</div>` : "";
    return `<div class="slide-frame"><div class="slide sl-${s.kind}" style="--sc:${s.color};--ss:${s.soft}">
      <div class="sl-band"></div>
      <div class="sl-top"><span>${s.kind === "cover" ? "Schede di studio" : topic}</span><span>${n} / ${total}</span></div>
      <h2 class="sl-title">${escapeHtml(s.title)}</h2>
      ${s.kind === "cover" ? `<div class="sl-index"><span class="sl-label">In queste schede</span>${list}</div>` : list}
      ${note}
    </div></div>`;
  },

  open() {
    if (!mindmap.root) return toast("Prima crea una mappa.");
    if (!mindmap.root.children.length) return toast("La mappa è vuota: aggiungi almeno un ramo con «Sotto».");
    this.build();
    this.i = 0;
    this.show();
    $("#dlgSlides").showModal();
  },
  show() {
    const n = this.list.length;
    this.i = Math.max(0, Math.min(this.i, n - 1));
    $("#slideStage").innerHTML = this.html(this.list[this.i], this.i + 1, n);
    $("#slideCount").textContent = `${this.i + 1} di ${n}`;
    $("#slidePrev").disabled = this.i === 0;
    $("#slideNext").disabled = this.i === n - 1;
    $("#slideNotesBtn").innerHTML = mindmap.root.notes ? `${icon("sparkles")}<span>Rifai spiegazioni</span>` : `${icon("sparkles")}<span>Aggiungi spiegazioni</span>`;
  },
  go(d) { tts.stop(); this.i += d; this.show(); },
  read() {
    const s = this.list[this.i];
    const parts = [s.title, ...s.items.flatMap(it => [it.text, ...it.sub])];
    if (s.note?.spiegazione) parts.push(s.note.spiegazione);
    if (s.note?.ricorda) parts.push("Da ricordare: " + s.note.ricorda);
    tts.say(parts.join(". "), null, "it");
  },

  /** L'IA scrive una spiegazione breve per ogni ramo e qualche domanda finale. */
  async addNotes() {
    const plain = (n) => ({ testo: n.text, figli: n.children.map(plain) });
    try {
      busy(true, "Scrivo le spiegazioni delle schede…");
      const d = parseJSON(await ask({ prompt: PROMPTS.schede(JSON.stringify(plain(mindmap.root))), system: SYSTEM_TUTOR, json: true, temperature: 0.3 }));
      const notes = {};
      (d.schede || []).forEach((x, k) => {
        const b = mindmap.root.children.find(c => c.text === x.ramo) || mindmap.root.children[k];
        if (b) notes[b.text] = { spiegazione: x.spiegazione || "", ricorda: x.ricorda || "" };
      });
      if (d.introduzione) notes.__intro = { spiegazione: d.introduzione, ricorda: "" };
      notes.__domande = (d.domande || []).slice(0, 6);
      mindmap.root.notes = notes;
      mindmap.persist();
      const keep = this.i;
      this.build(); this.i = keep; this.show();
      toast("Spiegazioni aggiunte. Controllale: le ha scritte l'IA.");
    } catch (e) { toast(e.message || "Non sono riuscito a scrivere le spiegazioni. Riprova.", 6000); }
    finally { busy(false); }
  },

  print() {
    this.build();
    const n = this.list.length;
    const html = `<div class="print-slides">${this.list.map((s, k) => this.html(s, k + 1, n)).join("")}</div>`;
    printer.run(html, { title: "Schede: " + mindmap.root.text, landscape: true, head: false });
  },

  bind() {
    $("#btnMapSlides").addEventListener("click", () => this.open());
    $("#slideClose").addEventListener("click", () => { tts.stop(); $("#dlgSlides").close(); });
    $("#slidePrev").addEventListener("click", () => this.go(-1));
    $("#slideNext").addEventListener("click", () => this.go(1));
    $("#slideRead").addEventListener("click", () => this.read());
    $("#slidePrint").addEventListener("click", () => this.print());
    $("#slideNotesBtn").addEventListener("click", () => this.addNotes());
    $("#dlgSlides").addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); this.go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); this.go(-1); }
    });
    // scorrere con il dito
    let x0 = null;
    $("#slideStage").addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    $("#slideStage").addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) this.go(dx < 0 ? 1 : -1);
    });
    $("#dlgSlides").addEventListener("close", () => tts.stop());
  }
};
