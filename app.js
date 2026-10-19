/* Studio Facile — strumenti di studio per DSA.
   Tutto gira nel browser: le chiavi API e i dati restano sul dispositivo. */
"use strict";

/* =========================================================
   1. UTILITÀ
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("sf." + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("sf." + key, JSON.stringify(value)); return true; }
    catch (e) { toast("Memoria del dispositivo piena: elimina qualcosa dal quaderno."); return false; }
  }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let toastTimer;
function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function busy(on, text = "Sto lavorando…") {
  $("#busyText").textContent = text;
  $("#busy").classList.toggle("hidden", !on);
}
/* Finestre dell'app al posto di prompt()/confirm() del browser,
   che sul telefono fanno saltare l'impaginazione. */
function uiDialog({ title = "", message = "", input = null, buttons }) {
  return new Promise((resolve) => {
    const d = $("#dlgAsk");
    $("#askTitle").textContent = title;
    $("#askMsg").textContent = message;
    $("#askMsg").classList.toggle("hidden", !message);
    const ta = $("#askInput");
    ta.classList.toggle("hidden", input === null);
    ta.value = input ?? "";
    const box = $("#askBtns");
    box.innerHTML = "";
    let result = null;
    for (const b of buttons) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " bad" : "");
      el.textContent = b.label;
      el.addEventListener("click", () => { result = b.value; d.close(); });
      box.appendChild(el);
    }
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); box.querySelector(".primary")?.click(); } };
    d.onclose = () => resolve(input === null ? result : (result === null ? null : { choice: result, text: ta.value.trim() }));
    d.showModal();
    if (input !== null) setTimeout(() => { ta.focus(); ta.select(); }, 50);
  });
}
const uiConfirm = (message, okLabel = "Sì", danger = false) =>
  uiDialog({ title: message, buttons: [{ label: "No", value: false }, { label: okLabel, value: true, primary: !danger, danger }] }).then(v => v === true);
const uiPrompt = (title, value = "", message = "") =>
  uiDialog({ title, message, input: value, buttons: [{ label: "Annulla", value: null }, { label: "OK", value: "ok", primary: true }] })
    .then(r => (r && r.choice === "ok") ? r.text : null);

function download(filename, blobOrText, type = "text/plain") {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function todayLabel() {
  return new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/* =========================================================
   2. IMPOSTAZIONI
   ========================================================= */
const DEFAULTS = {
  keyGemini: "", keyGroq: "",
  font: "Atkinson", size: 22, letter: 0.05, line: 1.9, theme: "crema", syllables: false,
  voice: "", rate: 0.95,
  modGemini: "gemini-flash-latest",
  modGroq: "llama-3.3-70b-versatile",
  modWhisper: "whisper-large-v3-turbo"
};
const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
const FONTS = {
  Atkinson: '"Atkinson Hyperlegible", Verdana, sans-serif',
  Lexend: 'Lexend, Verdana, sans-serif',
  OpenDyslexic: 'OpenDyslexic, "Atkinson Hyperlegible", Verdana, sans-serif',
  Verdana: 'Verdana, Tahoma, sans-serif'
};
function saveSettings() { store.set("settings", settings); }
function applySettings() {
  const r = document.documentElement.style;
  r.setProperty("--read-font", FONTS[settings.font] || FONTS.Atkinson);
  r.setProperty("--read-size", settings.size + "px");
  r.setProperty("--read-letter", settings.letter + "em");
  r.setProperty("--read-line", settings.line);
  document.body.dataset.theme = settings.theme;
  $("meta[name=theme-color]").content = settings.theme === "scuro" ? "#1d1f21" : "#2f6f6a";
  $("#rngRate").value = settings.rate;
}

/* =========================================================
   3. INTELLIGENZA ARTIFICIALE (Gemini + Groq)
   ========================================================= */
class AIError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}
function friendlyError(provider, status, detail = "") {
  if (status === 400 && /api key/i.test(detail)) return `La chiave ${provider} non è valida. Controllala nelle impostazioni.`;
  if (status === 401 || status === 403) return `La chiave ${provider} non è valida o non ha i permessi. Controllala nelle impostazioni.`;
  if (status === 429) return `Hai raggiunto il limite gratuito di ${provider}. Aspetta un minuto e riprova.`;
  if (status === 404) return `Il modello ${provider} impostato non esiste più. Cambialo in Impostazioni → Avanzate.`;
  if (status >= 500) return `${provider} è momentaneamente sovraccarico. Riprova tra poco.`;
  if (status === 0) return `Nessuna connessione a ${provider}. Controlla internet.`;
  return `${provider}: ${detail || "errore " + status}`;
}

async function geminiCall({ prompt, system, images = [], json = false, temperature = 0.4, model }) {
  if (!settings.keyGemini) throw new AIError("Manca la chiave Gemini (Impostazioni ⚙️).", -1);
  const parts = [];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
  parts.push({ text: prompt });
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature }
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (json) body.generationConfig.responseMimeType = "application/json";
  const m = model || settings.modGemini || DEFAULTS.modGemini;
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": settings.keyGemini },
      body: JSON.stringify(body)
    });
  } catch { throw new AIError(friendlyError("Gemini", 0), 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // se il modello scelto non esiste, riprova una volta con un modello di riserva
    if (res.status === 404 && !model && m !== "gemini-2.5-flash") {
      return geminiCall({ prompt, system, images, json, temperature, model: "gemini-2.5-flash" });
    }
    throw new AIError(friendlyError("Gemini", res.status, data?.error?.message), res.status);
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
  if (!text) {
    if (cand?.finishReason === "SAFETY" || data.promptFeedback?.blockReason)
      throw new AIError("Gemini non ha voluto elaborare questo contenuto. Prova con un altro testo.", 1);
    throw new AIError("Gemini non ha risposto. Riprova.", 1);
  }
  return text;
}

async function groqChat({ prompt, system, json = false, temperature = 0.4 }) {
  if (!settings.keyGroq) throw new AIError("Manca la chiave Groq (Impostazioni ⚙️).", -1);
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const body = { model: settings.modGroq || DEFAULTS.modGroq, messages, temperature };
  if (json) body.response_format = { type: "json_object" };
  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.keyGroq },
      body: JSON.stringify(body)
    });
  } catch { throw new AIError(friendlyError("Groq", 0), 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(friendlyError("Groq", res.status, data?.error?.message), res.status);
  return data.choices?.[0]?.message?.content || "";
}

/** Chiede all'IA: usa Gemini, e se fallisce (limite, rete, sovraccarico) passa a Groq. */
async function ask(opts) {
  const hasG = !!settings.keyGemini, hasQ = !!settings.keyGroq;
  if (!hasG && !hasQ) {
    openSettings();
    throw new AIError("Per iniziare inserisci almeno una chiave gratuita (Gemini o Groq).", -1);
  }
  if (opts.images?.length) return geminiCall(opts); // solo Gemini legge le immagini
  if (!hasG) return groqChat(opts);
  try {
    return await geminiCall(opts);
  } catch (e) {
    const retriable = e.status === 0 || e.status === 429 || e.status >= 500 || e.status === 1;
    if (hasQ && retriable) {
      busy(true, "Gemini è occupato, provo con Groq…");
      return groqChat(opts);
    }
    throw e;
  }
}

function parseJSON(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* prova a estrarre */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("Risposta non valida");
}

async function transcribe(blob) {
  if (!settings.keyGroq) throw new AIError("Per la dettatura serve la chiave Groq (Impostazioni ⚙️).", -1);
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("file", blob, "registrazione." + ext);
  fd.append("model", settings.modWhisper || DEFAULTS.modWhisper);
  fd.append("language", "it");
  fd.append("response_format", "json");
  fd.append("temperature", "0");
  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: "Bearer " + settings.keyGroq }, body: fd
    });
  } catch { throw new AIError(friendlyError("Groq", 0), 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(friendlyError("Groq", res.status, data?.error?.message), res.status);
  return (data.text || "").trim();
}

/* ---------- Istruzioni per l'IA ---------- */
const SYSTEM_TUTOR = `Sei un tutor paziente per una studentessa delle scuole superiori italiane con dislessia (DSA).
Scrivi sempre in italiano, con frasi brevi (massimo 20 parole), parole semplici e un'idea per frase.
Non usare tabelle. Spiega i termini tecnici la prima volta che compaiono, ma non eliminarli: servono per le verifiche.
Non inventare informazioni che non sono nel testo, salvo quando ti viene chiesto di spiegare.
Formato consentito: righe che iniziano con "## " per i titoli, righe che iniziano con "- " per gli elenchi, **grassetto** per le parole chiave. Nient'altro.`;

const PROMPTS = {
  ocr: `Trascrivi fedelmente tutto il testo di questa pagina, nell'ordine in cui si legge.
- Scrivi i titoli su una riga che inizia con "# ".
- Separa i paragrafi con una riga vuota. Unisci le parole spezzate a fine riga.
- Ignora numeri di pagina, intestazioni ripetute e decorazioni.
- Per immagini, grafici o schemi importanti scrivi una breve descrizione tra parentesi quadre, es. [Immagine: cartina dell'Europa nel 1815].
- Scrivi le formule in modo che si possano leggere ad alta voce (es. "x al quadrato più 3").
Rispondi solo con il testo trascritto.`,
  semplifica: (t) => `Riscrivi questo testo per renderlo facile da leggere e capire.
Mantieni TUTTE le informazioni importanti, le date, i nomi e i termini tecnici (in **grassetto**).
Dividilo in piccoli blocchi con un titolo "## " ciascuno. Frasi corte. Usa elenchi "- " quando ci sono più elementi.

TESTO:
${t}`,
  riassunto: (t) => `Fai un riassunto per lo studio di questo testo.
Struttura:
## In una frase
(una frase che dice di cosa parla)
## I punti principali
- (5-10 punti, ognuno breve, parole chiave in **grassetto**)
## Da ricordare per la verifica
- (date, nomi, definizioni, formule importanti)

TESTO:
${t}`,
  parole: (t) => `Estrai dal testo le 8-15 parole o concetti più importanti da studiare.
Per ognuno scrivi una riga così:
- **parola**: spiegazione semplice in una frase.
Mettili nell'ordine in cui compaiono nel testo.

TESTO:
${t}`,
  spiega: (t) => `Spiegami questo testo come farebbe un bravo insegnante, in modo che lo capisca davvero.
## Di cosa parla
(2-3 frasi)
## Spiegazione passo passo
(spiega i passaggi difficili con parole semplici; se serve usa un esempio della vita di tutti i giorni)
## Un esempio per ricordarlo
## Domande per verificare se ho capito
- (3 domande, senza risposta)

TESTO:
${t}`,
  mappa: (t) => `Crea una mappa concettuale di questo testo, per studiare.
Rispondi SOLO con JSON in questo formato:
{"titolo": "argomento centrale", "rami": [{"testo": "concetto", "figli": [{"testo": "dettaglio", "figli": []}]}]}
Regole:
- da 3 a 7 rami principali; massimo 3 livelli sotto il titolo;
- ogni riquadro ha al massimo 6 parole: parole chiave, non frasi lunghe;
- includi date, nomi e termini importanti;
- l'ordine dei rami segue l'ordine logico o cronologico.

TESTO:
${t}`,
  mappaTema: (t) => `Crea una mappa concettuale sull'argomento "${t}" al livello delle scuole superiori italiane.
Rispondi SOLO con JSON in questo formato:
{"titolo": "argomento centrale", "rami": [{"testo": "concetto", "figli": [{"testo": "dettaglio", "figli": []}]}]}
Regole: da 4 a 7 rami principali; massimo 3 livelli; ogni riquadro al massimo 6 parole; includi date, nomi e termini importanti; contenuti corretti e verificabili.`,
  migliora: (json) => `Questa è una mappa concettuale fatta da una studentessa. Aiutala a migliorarla, rispettando il suo lavoro.
Regole:
- MANTIENI la sua struttura e le sue parole: non cancellare i suoi riquadri e non riscriverli, salvo per correggere errori di ortografia o di contenuto evidenti;
- AGGIUNGI solo i concetti importanti che mancano (date, nomi, termini, collegamenti), al punto giusto della mappa;
- metti "nuovo": true SOLO sui riquadri che aggiungi tu, e su quelli in cui correggi un errore;
- ogni riquadro al massimo 6 parole; massimo 3 livelli sotto il titolo; non aggiungere più di 10 riquadri in tutto;
- se un riquadro è troppo lungo puoi accorciarlo (e segnarlo con "nuovo": true).
Rispondi SOLO con JSON in questo formato:
{"titolo": "...", "rami": [{"testo": "...", "nuovo": false, "figli": [{"testo": "...", "nuovo": true, "figli": []}]}]}

MAPPA ATTUALE (il primo "testo" è il titolo al centro):
${json}`,
  flashcard: (t) => `Crea flashcard per ripassare questo testo in vista di una verifica.
Rispondi SOLO con JSON: {"titolo": "argomento breve", "carte": [{"domanda": "...", "risposta": "..."}]}
Regole:
- da 8 a 15 carte, che coprano tutti i concetti importanti;
- domande brevi e chiare, una sola cosa per domanda;
- risposte brevi (massimo 25 parole), con le parole chiave giuste.

TESTO:
${t}`,
  correggi: (t) => `Correggi gli errori di ortografia, grammatica, punteggiatura e le maiuscole in questo testo dettato.
Non cambiare il contenuto, lo stile o le parole scelte, se non per correggere errori.
Se capisci che la persona ha dettato la punteggiatura a voce (es. "virgola", "punto", "a capo"), trasformala nei segni giusti.
Rispondi solo con il testo corretto, senza commenti.

TESTO:
${t}`
};

/* =========================================================
   4. TESTO: frasi, parole, sillabe
   ========================================================= */
function splitSentences(text) {
  if (window.Intl && Intl.Segmenter) {
    const seg = new Intl.Segmenter("it", { granularity: "sentence" });
    return [...seg.segment(text)].map(s => s.segment).filter(s => s.trim());
  }
  return text.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) || [text];
}

const VOWELS = "aeiouàèéìíòóùúAEIOUÀÈÉÌÍÒÓÙÚ";
const isV = (c) => VOWELS.includes(c);
const isL = (c) => /[a-zà-ú]/i.test(c);
/** Divisione in sillabe semplificata per l'italiano (basta per colorare le sillabe). */
function syllabify(word) {
  if (word.length < 3 || !/[aeiouàèéìíòóùú]/i.test(word)) return [word];
  const low = word.toLowerCase();
  const cut = [];
  let i = 0;
  while (i < low.length && !isV(low[i])) i++;           // consonanti iniziali
  while (i < low.length) {
    while (i < low.length && isV(low[i])) i++;          // gruppo vocalico
    const start = i;
    while (i < low.length && !isV(low[i]) && isL(low[i])) i++;
    if (i >= low.length || !isL(low[i])) break;          // consonanti finali: restano
    const cl = low.slice(start, i);
    let k = 0;                                           // quante consonanti restano nella sillaba prima
    if (cl.length === 1) k = 0;
    else if (cl[0] === cl[1]) k = 1;                     // doppie: tet-to
    else if (cl[0] === "s") k = 0;                       // s impura: pa-sta
    else if (/^(ch|gh|gn|sc|gl)/.test(cl) && cl.length === 2) k = 0;
    else if (cl.length === 2 && /[lr]/.test(cl[1]) && /[bcdfgptv]/.test(cl[0])) k = 0; // tr, bl…
    else k = 1;                                          // al-to, ar-te, ap-pun-to
    cut.push(start + k);
  }
  const out = [];
  let prev = 0;
  for (const c of cut) { if (c > prev && c < word.length) { out.push(word.slice(prev, c)); prev = c; } }
  out.push(word.slice(prev));
  return out;
}

/* =========================================================
   5. SINTESI VOCALE
   ========================================================= */
const tts = {
  voices: [],
  speaking: false,
  onStop: null,
  loadVoices() {
    const all = speechSynthesis.getVoices();
    this.voices = all.filter(v => v.lang && v.lang.toLowerCase().startsWith("it"));
    if (!this.voices.length) this.voices = all;
    const sel = $("#setVoice");
    sel.innerHTML = `<option value="">Automatica (la migliore disponibile)</option>` +
      this.voices.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)}${v.localService ? "" : " ☁️"}</option>`).join("");
    sel.value = settings.voice;
  },
  pickVoice() {
    if (settings.voice) { const v = this.voices.find(v => v.name === settings.voice); if (v) return v; }
    const prefs = [/natural|neural|premium|enhanced/i, /google/i, /elsa|isabella|alice|federica|paola|luca/i];
    for (const re of prefs) { const v = this.voices.find(v => re.test(v.name)); if (v) return v; }
    return this.voices[0];
  },
  utter(text) {
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || "it-IT";
    u.rate = settings.rate;
    return u;
  },
  session: 0,  // cambia a ogni nuova lettura: ignora gli eventi delle letture vecchie
  stop() {
    this.speaking = false;
    this.session++;
    speechSynthesis.cancel();
    if (this.onStop) { const f = this.onStop; this.onStop = null; f(); }
  },
  /** Legge un testo qualsiasi (risultati, carte, mappe). */
  say(text, onEnd) {
    this.stop();
    const clean = text.replace(/[#*_`>\[\]]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return;
    const chunks = splitSentences(clean);
    this.speaking = true;
    const my = this.session;
    let i = 0;
    const next = () => {
      if (my !== this.session) return;
      if (!this.speaking || i >= chunks.length) { this.speaking = false; onEnd?.(); return; }
      const u = this.utter(chunks[i++]);
      u.onend = next;
      u.onerror = () => { if (my !== this.session) return; this.speaking = false; onEnd?.(); };
      speechSynthesis.speak(u);
    };
    next();
  }
};

/* =========================================================
   6. LETTORE
   ========================================================= */
const reader = {
  text: "",
  sentences: [],   // { el, text, words: [{el, start, end}] }
  idx: 0,
  playing: false,
  editing: false,

  load(text, { keepPosition = false } = {}) {
    this.text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!keepPosition) this.idx = 0;
    store.set("current", this.text);
    this.render();
    const has = !!this.text;
    $("#readerCard").classList.toggle("hidden", !has);
    $("#toolsCard").classList.toggle("hidden", !has);
  },

  render() {
    const box = $("#reader");
    box.innerHTML = "";
    this.sentences = [];
    // i titoli (# …) diventano sempre un paragrafo a sé
    const paragraphs = this.text.replace(/^(#.*)$/gm, "\n$1\n").split(/\n\s*\n/);
    for (const para of paragraphs) {
      const p = document.createElement("p");
      let t = para.replace(/\n/g, " ").trim();
      if (!t) continue;
      if (t.startsWith("#")) { p.className = "h"; t = t.replace(/^#+\s*/, ""); }
      for (const sent of splitSentences(t)) {
        const s = document.createElement("span");
        s.className = "s";
        s.dataset.i = this.sentences.length;
        const words = [];
        let pos = 0;
        for (const tok of sent.split(/(\s+)/)) {
          if (!tok) continue;
          if (/^\s+$/.test(tok)) { s.appendChild(document.createTextNode(tok)); pos += tok.length; continue; }
          const w = document.createElement("span");
          w.className = "w";
          if (settings.syllables) {
            const m = tok.match(/^([^a-zà-ú]*)([a-zà-ú'’]+)([^a-zà-ú]*)$/i);
            if (m) {
              if (m[1]) w.appendChild(document.createTextNode(m[1]));
              syllabify(m[2]).forEach((syl, j) => {
                const sp = document.createElement("span");
                if (j % 2) sp.className = "syl-b";
                sp.textContent = syl;
                w.appendChild(sp);
              });
              if (m[3]) w.appendChild(document.createTextNode(m[3]));
            } else w.textContent = tok;
          } else w.textContent = tok;
          s.appendChild(w);
          words.push({ el: w, start: pos, end: pos + tok.length });
          pos += tok.length;
        }
        p.appendChild(s);
        this.sentences.push({ el: s, text: sent, words });
      }
      box.appendChild(p);
    }
  },

  mark(i) {
    $$("#reader .s.on, #reader .w.on").forEach(e => e.classList.remove("on"));
    const s = this.sentences[i];
    if (!s) return;
    s.el.classList.add("on");
    const r = s.el.getBoundingClientRect();
    if (r.top < 130 || r.bottom > innerHeight - 120) s.el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (ruler.on) ruler.moveTo(r.top + r.height / 2);
  },

  play(from = this.idx) {
    tts.stop();
    if (!this.sentences.length) return;
    this.idx = Math.min(from, this.sentences.length - 1);
    this.playing = true;
    tts.speaking = true;
    tts.onStop = () => { this.playing = false; this.updateBtn(); };
    this.updateBtn();
    const my = tts.session;
    const speakOne = () => {
      if (!this.playing || my !== tts.session) return;
      if (this.idx >= this.sentences.length) { this.idx = 0; this.playing = false; tts.speaking = false; this.mark(-1); this.updateBtn(); return; }
      const s = this.sentences[this.idx];
      this.mark(this.idx);
      const u = tts.utter(s.text);
      u.onboundary = (e) => {
        if (e.name && e.name !== "word") return;
        const w = s.words.find(w => e.charIndex >= w.start && e.charIndex < w.end);
        if (w) { s.el.querySelectorAll(".w.on").forEach(x => x.classList.remove("on")); w.el.classList.add("on"); }
      };
      u.onend = () => { if (!this.playing || my !== tts.session) return; this.idx++; speakOne(); };
      u.onerror = (e) => {
        if (my !== tts.session) return;
        if (e.error !== "interrupted" && e.error !== "canceled") { this.playing = false; this.updateBtn(); toast("La voce si è interrotta. Premi ▶️ per riprendere."); }
      };
      speechSynthesis.speak(u);
    };
    speakOne();
  },
  pause() { this.playing = false; tts.stop(); this.updateBtn(); },
  stop() { this.pause(); this.idx = 0; this.mark(-1); },
  updateBtn() {
    const b = $("#btnPlay");
    b.textContent = this.playing ? "⏸️" : "▶️";
    b.setAttribute("aria-label", this.playing ? "Pausa" : "Leggi ad alta voce");
  },

  toggleEdit() {
    const box = $("#reader");
    if (!this.editing) {
      this.pause();
      this.editing = true;
      box.contentEditable = "true";
      box.classList.add("edit");
      box.innerText = this.text;
      box.focus();
      $("#btnEdit").textContent = "✅ Fatto";
    } else {
      this.editing = false;
      box.contentEditable = "false";
      box.classList.remove("edit");
      $("#btnEdit").textContent = "✏️";
      this.load(box.innerText);
    }
  }
};

/* ---------- Righello di lettura ---------- */
const ruler = {
  on: false,
  toggle() {
    this.on = !this.on;
    $("#ruler").classList.toggle("hidden", !this.on);
    $("#btnRuler").classList.toggle("primary", this.on);
    if (this.on) this.moveTo(innerHeight / 2.5);
  },
  moveTo(y) {
    const el = $("#ruler");
    el.style.top = (y - el.offsetHeight / 2) + "px";
  }
};

/* =========================================================
   7. FOTO, IMMAGINI E PDF → TESTO
   ========================================================= */
async function imageToBase64(file, maxSide = 2000) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w, h, src;
  if (bmp) { w = bmp.width; h = bmp.height; src = bmp; }
  else {
    src = await new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = URL.createObjectURL(file); });
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return canvasToB64(c);
}
function canvasToB64(canvas) {
  return { mime: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
}

async function pdfToText(file) {
  if (!window.pdfjsLib) throw new Error("Lettore PDF non caricato: controlla la connessione.");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const MAX_PAGES = 30;
  const n = Math.min(pdf.numPages, MAX_PAGES);
  let out = [];
  for (let p = 1; p <= n; p++) {
    busy(true, `Leggo il PDF: pagina ${p} di ${n}…`);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let text = "", lastY = null;
    for (const it of content.items) {
      if (!it.str && !it.hasEOL) continue;
      const y = it.transform?.[5] ?? 0;
      const lineH = it.height || Math.abs(it.transform?.[3]) || 12;
      if (lastY !== null && it.str) {
        const gap = lastY - y;
        if (gap > lineH * 1.8) text = text.replace(/\n?$/, "\n\n");      // nuovo paragrafo
        else if (Math.abs(gap) > 2 && !text.endsWith("\n")) text += "\n"; // nuova riga
      }
      text += it.str;
      if (it.str) lastY = y;
    }
    text = text.replace(/(\w)-\n(\w)/g, "$1$2").replace(/[ \t]+/g, " ");
    if (text.replace(/\s/g, "").length < 40) {
      // pagina scansionata: la trasformo in immagine e la faccio leggere a Gemini
      busy(true, `Pagina ${p} è una foto: la sto leggendo…`);
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      text = await ask({ prompt: PROMPTS.ocr, images: [canvasToB64(c)], temperature: 0 });
    }
    out.push(text.trim());
  }
  if (pdf.numPages > MAX_PAGES) toast(`Ho letto le prime ${MAX_PAGES} pagine. Per il resto dividi il PDF.`, 5000);
  return out.join("\n\n");
}

async function handleFiles(files) {
  if (!files?.length) return;
  let append = false;
  if (reader.text) {
    const c = await uiDialog({
      title: "Hai già un testo aperto",
      message: "Vuoi aggiungere queste pagine in fondo o iniziare un testo nuovo?",
      buttons: [{ label: "Annulla", value: null }, { label: "📄 Nuovo testo", value: "new" }, { label: "➕ Aggiungi", value: "add", primary: true }]
    });
    if (!c) return;
    append = c === "add";
  }
  try {
    const pieces = [];
    let k = 0;
    for (const f of files) {
      k++;
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        busy(true, "Apro il PDF…");
        pieces.push(await pdfToText(f));
      } else {
        busy(true, files.length > 1 ? `Leggo la foto ${k} di ${files.length}…` : "Leggo la foto…");
        const img = await imageToBase64(f);
        pieces.push(await ask({ prompt: PROMPTS.ocr, images: [img], temperature: 0 }));
      }
    }
    const text = pieces.join("\n\n");
    reader.load(append ? reader.text + "\n\n" + text : text);
    toast("Fatto! Premi ▶️ per ascoltare.");
    $("#readerCard").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    toast(e.message, 6000);
  } finally {
    busy(false);
  }
}

/* =========================================================
   8. RISULTATI (semplifica, riassunto, …)
   ========================================================= */
function mdToHtml(md) {
  const lines = escapeHtml(md.trim()).split("\n");
  let html = "", list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { closeList(); continue; }
    let m;
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; }
    else { closeList(); html += `<p>${inline(l)}</p>`; }
  }
  closeList();
  return html;
}

let lastResult = "";
const ACT_LABELS = { semplifica: "Testo semplificato", riassunto: "Riassunto", parole: "Parole chiave", spiega: "Spiegazione" };

async function runAction(act) {
  const text = reader.text;
  if (!text) return;
  reader.pause();
  try {
    if (act === "mappa") {
      busy(true, "Sto creando la mappa…");
      const data = parseJSON(await ask({ prompt: PROMPTS.mappa(text), system: SYSTEM_TUTOR, json: true }));
      mindmap.load(normalizeMap(data));
      showView("mappa");
      return;
    }
    if (act === "flashcard") {
      busy(true, "Sto preparando le flashcard…");
      const data = parseJSON(await ask({ prompt: PROMPTS.flashcard(text), system: SYSTEM_TUTOR, json: true }));
      const cards = (data.carte || data.cards || []).filter(c => c.domanda && c.risposta).map(c => ({ q: c.domanda, a: c.risposta, box: 0 }));
      if (!cards.length) throw new Error("Non sono riuscito a creare le carte. Riprova.");
      const deck = { id: uid(), title: data.titolo || "Flashcard", date: todayLabel(), cards };
      const decks = store.get("decks", []);
      decks.unshift(deck);
      store.set("decks", decks);
      flash.refreshDecks(deck.id);
      showView("ripassa");
      toast(`Creato il mazzo con ${cards.length} carte!`);
      return;
    }
    busy(true, act === "spiega" ? "Preparo la spiegazione…" : "Ci sto pensando…");
    const out = await ask({ prompt: PROMPTS[act](text), system: SYSTEM_TUTOR });
    lastResult = out;
    $("#resultTitle").textContent = ACT_LABELS[act] || "Risultato";
    $("#result").innerHTML = mdToHtml(out);
    $("#resultCard").classList.remove("hidden");
    $("#resultCard").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    toast(e.message || "Qualcosa non ha funzionato. Riprova.", 6000);
  } finally {
    busy(false);
  }
}

/* =========================================================
   9. MAPPA CONCETTUALE
   ========================================================= */
const BRANCH_COLORS = [
  ["#fde2c8", "#c9762e"], ["#d6ecd2", "#4f8a45"], ["#d8e6f6", "#3f6fa8"],
  ["#f3d6e4", "#a54a78"], ["#fff0b8", "#a8861a"], ["#dcd6f3", "#6551a8"], ["#cdeeee", "#2f7f80"]
];
/** Copia della mappa senza le misure di disegno (campi che iniziano con "_"). */
const cleanMap = (root) => root && JSON.parse(JSON.stringify(root, (k, v) => k.startsWith("_") ? undefined : v));

function normalizeMap(d) {
  const fix = (n, depth) => ({
    id: uid(),
    text: String(n.testo || n.text || n.titolo || "").trim() || "…",
    ai: !!(n.nuovo || n.ai),
    children: depth < 4 ? (n.figli || n.children || n.rami || []).map(c => fix(c, depth + 1)) : []
  });
  const root = fix({ testo: d.titolo || d.title || "Argomento", figli: d.rami || d.figli || d.children || [] }, 0);
  return root;
}

const mindmap = {
  root: null,
  layout: "bilanciata",   // "bilanciata" | "albero"
  savedId: null,
  nodes: [],              // nodi con posizione, per disegnare e per l'immagine
  pressTimer: null,

  history: [],            // copie precedenti per "Annulla"
  selected: null,

  load(root, savedId = null) {
    this.root = root;
    this.savedId = savedId;
    this.zoom = null;
    this.history = [];
    this.select(null);
    this.persist();
    this.draw({ center: true });
  },

  showCard() {
    const has = !!this.root;
    $("#mapCard").classList.toggle("hidden", !has);
    $("#mapCreate").classList.toggle("hidden", has);
  },

  persist() {
    this.showCard();
    store.set("currentMap", { root: cleanMap(this.root), savedId: this.savedId });
    $("#btnMapUndo").disabled = !this.history.length;
    const hasAi = JSON.stringify(this.root || {}).includes('"ai":true');
    $("#mapLegend").classList.toggle("hidden", !hasAi);
  },

  /** Applica una modifica alla mappa, ricordando la versione precedente per "Annulla". */
  change(fn) {
    this.history.push(JSON.stringify(cleanMap(this.root)));
    if (this.history.length > 40) this.history.shift();
    fn();
    this.persist();
    this.draw();
  },

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.zoom = null;
    this.root = JSON.parse(prev);
    if (this.selected && !this.find(this.selected)) this.select(null);
    this.persist();
    this.draw();
    toast("Modifica annullata");
  },

  select(id) {
    this.selected = id;
    $$(".map-node.sel").forEach(e => e.classList.remove("sel"));
    if (id) $(`.map-node[data-id="${id}"]`)?.classList.add("sel");
    const on = !!id && $("#view-mappa").classList.contains("active");
    $("#nodeBar").classList.toggle("hidden", !on);
    document.body.classList.toggle("map-editing", on);
  },

  async newMap() {
    if (this.root && this.history.length && !this.savedId) {
      if (!(await uiConfirm("Iniziare una mappa nuova? Quella aperta non è salvata nel quaderno.", "Sì, nuova"))) return;
    }
    const t = await uiPrompt("Qual è l'argomento al centro della mappa?", "", "Poi tocca il riquadro e usa «Sotto» per aggiungere le idee.");
    if (!t) return;
    this.load({ id: uid(), text: t, ai: false, children: [] });
    setTimeout(() => this.select(this.root.id), 50);
  },

  async nodeAction(act) {
    const id = this.selected;
    const f = id && this.find(id);
    if (!f) return this.select(null);
    const { node, parent } = f;
    const sibs = parent?.children;
    const i = sibs ? sibs.indexOf(node) : -1;
    switch (act) {
      case "say": return this.speakNode(id);
      case "close": return this.select(null);
      case "edit": {
        const t = await uiPrompt("Cambia il testo del riquadro", node.text);
        if (t && t !== node.text) this.change(() => { node.text = t; node.ai = false; });
        else if (t && node.ai) this.change(() => { node.ai = false; }); // confermato: diventa suo
        return;
      }
      case "child": {
        const t = await uiPrompt(`Nuova idea collegata a «${node.text}»`);
        if (!t) return;
        const nn = { id: uid(), text: t, ai: false, children: [] };
        this.change(() => node.children.push(nn));
        return this.select(nn.id);
      }
      case "sibling": {
        if (!parent) return toast("Il centro non può avere riquadri accanto: usa «Sotto».");
        const t = await uiPrompt("Nuova idea allo stesso livello");
        if (!t) return;
        const nn = { id: uid(), text: t, ai: false, children: [] };
        this.change(() => sibs.splice(i + 1, 0, nn));
        return this.select(nn.id);
      }
      case "up": case "down": {
        if (!parent) return;
        const j = act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= sibs.length) return;
        return this.change(() => { [sibs[i], sibs[j]] = [sibs[j], sibs[i]]; });
      }
      case "del": {
        if (!parent) return toast("Il centro della mappa non si può togliere.");
        if (node.children.length && !(await uiConfirm(`Togliere «${node.text}» e i riquadri collegati?`, "Togli", true))) return;
        this.change(() => sibs.splice(i, 1));
        return this.select(null);
      }
    }
  },

  /** Chiede all'IA di migliorare la mappa, rispettando il lavoro già fatto. */
  async improve() {
    if (!this.root) return toast("Prima crea una mappa.");
    const plain = (n) => ({ testo: n.text, figli: n.children.map(plain) });
    try {
      busy(true, "L'IA sta guardando la tua mappa…");
      const out = parseJSON(await ask({ prompt: PROMPTS.migliora(JSON.stringify(plain(this.root))), system: SYSTEM_TUTOR, json: true }));
      const fresh = normalizeMap(out);
      if (!fresh.children.length) throw new Error("L'IA non ha restituito una mappa valida. Riprova.");
      this.select(null);
      this.zoom = null; // la mappa è cambiata molto: la rimetto tutta nello schermo
      this.change(() => { this.root = fresh; });
      const added = JSON.stringify(fresh).split('"ai":true').length - 1;
      toast(added ? `Fatto! ${added} riquadri nuovi hanno il bordo tratteggiato. ↩️ Annulla per tornare indietro.` : "Fatto! ↩️ Annulla per tornare indietro.", 6000);
    } catch (e) { toast(e.message || "Non sono riuscito a migliorare la mappa. Riprova.", 6000); }
    finally { busy(false); }
  },

  measure() {
    const c = this._mc || (this._mc = document.createElement("canvas").getContext("2d"));
    return (text, size, bold) => {
      c.font = `${bold ? 700 : 400} ${size}px "Atkinson Hyperlegible", Verdana, sans-serif`;
      return c.measureText(text).width;
    };
  },

  computeLayout() {
    const meas = this.measure();
    const H_GAP = 46, V_GAP = 14, PAD_X = 14, PAD_Y = 10, MAXW = 190;
    const sizeFor = (d) => d === 0 ? 22 : d === 1 ? 18 : 16;
    const prep = (n, depth, color) => {
      const size = sizeFor(depth), bold = depth <= 1;
      // a capo automatico
      const words = n.text.split(/\s+/);
      const lines = [];
      let cur = "";
      for (const w of words) {
        const t = cur ? cur + " " + w : w;
        if (meas(t, size, bold) > MAXW && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      const tw = Math.max(...lines.map(l => meas(l, size, bold)));
      n._lines = lines; n._size = size; n._bold = bold; n._depth = depth;
      n._w = Math.ceil(tw + PAD_X * 2);
      n._h = Math.ceil(lines.length * size * 1.3 + PAD_Y * 2);
      n._color = color;
      n.children.forEach((c, i) => prep(c, depth + 1, depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : color));
      n._sub = n.children.length
        ? Math.max(n._h, n.children.reduce((s, c) => s + c._sub, 0) + V_GAP * (n.children.length - 1))
        : n._h;
    };
    prep(this.root, 0, null);

    const place = (n, x, yTop, dir) => {
      n._x = dir > 0 ? x : x - n._w;           // x è il bordo vicino al genitore
      n._y = yTop + n._sub / 2 - n._h / 2;
      n._dir = dir;
      let y = yTop + (n._sub - (n.children.reduce((s, c) => s + c._sub, 0) + V_GAP * Math.max(0, n.children.length - 1))) / 2;
      const nx = dir > 0 ? n._x + n._w + H_GAP : n._x - H_GAP;
      for (const c of n.children) { place(c, nx, y, dir); y += c._sub + V_GAP; }
    };

    const r = this.root;
    let right = r.children, left = [];
    if (this.layout === "bilanciata" && r.children.length > 2) {
      const total = r.children.reduce((s, c) => s + c._sub, 0);
      let acc = 0, k = 0;
      while (k < r.children.length && acc + r.children[k]._sub / 2 < total / 2) { acc += r.children[k]._sub; k++; }
      k = Math.max(1, Math.min(r.children.length - 1, k));
      right = r.children.slice(0, k);
      left = r.children.slice(k).reverse();
    }
    const colH = (arr) => arr.reduce((s, c) => s + c._sub, 0) + V_GAP * Math.max(0, arr.length - 1);
    const hR = colH(right), hL = colH(left);
    const H = Math.max(hR, hL, r._h);
    r._x = 0; r._y = H / 2 - r._h / 2; r._dir = 0;
    let y = (H - hR) / 2;
    for (const c of right) { place(c, r._w + H_GAP, y, 1); y += c._sub + V_GAP; }
    y = (H - hL) / 2;
    for (const c of left) { place(c, -H_GAP, y, -1); y += c._sub + V_GAP; }

    // raccolgo i nodi e calcolo i confini
    const all = [];
    const walk = (n, parent) => { all.push({ n, parent }); n.children.forEach(c => walk(c, n)); };
    walk(r, null);
    const minX = Math.min(...all.map(a => a.n._x)), maxX = Math.max(...all.map(a => a.n._x + a.n._w));
    const M = 20;
    all.forEach(a => { a.n._x += -minX + M; a.n._y += M; });
    this.nodes = all;
    return { width: maxX - minX + M * 2, height: H + M * 2 };
  },

  edgePath(p, c) {
    let x1, x2;
    if (c._dir > 0) { x1 = p._x + p._w; x2 = c._x; }
    else { x1 = p._x; x2 = c._x + c._w; }
    const y1 = p._y + p._h / 2, y2 = c._y + c._h / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  },

  draw({ center = false } = {}) {
    const wrap = $("#mapWrap");
    if (!this.root) return;
    // posizione sullo schermo del riquadro selezionato, prima di ridisegnare
    let anchor = null;
    const selNode = this.selected && this.find(this.selected)?.node;
    if (selNode && selNode._x != null && this.zoom) {
      anchor = { node: selNode, sx: (selNode._x + selNode._w / 2) * this.zoom - wrap.scrollLeft, sy: (selNode._y + selNode._h / 2) * this.zoom - wrap.scrollTop };
    }
    const { width, height } = this.computeLayout();
    this.size = { width, height };
    const dark = settings.theme === "scuro";
    let edges = "", boxes = "";
    for (const { n, parent } of this.nodes) {
      const fill = n._depth === 0 ? "var(--accent)" : (dark ? n._color[1] : n._color[0]);
      const stroke = n._depth === 0 ? "var(--accent)" : n._color[1];
      const ink = n._depth === 0 ? "var(--accent-ink)" : (dark ? "#fff" : "#2b2a27");
      if (parent) edges += `<path d="${this.edgePath(parent, n)}" fill="none" stroke="${stroke}" stroke-width="${n._depth === 1 ? 4 : 2.5}" stroke-linecap="round"/>`;
      const tx = n._x + n._w / 2;
      const ty0 = n._y + 10 + n._size;
      const tspans = n._lines.map((l, i) => `<tspan x="${tx}" y="${ty0 + i * n._size * 1.3 - n._size * 0.15}">${escapeHtml(l)}</tspan>`).join("");
      const dash = n.ai ? ` stroke-dasharray="8 5"` : "";
      boxes += `<g class="map-node${n.id === this.selected ? " sel" : ""}" data-id="${n.id}" role="button" tabindex="0">
        <rect x="${n._x}" y="${n._y}" width="${n._w}" height="${n._h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${n.ai ? 3 : 2}"${dash}/>
        <text text-anchor="middle" font-family="Atkinson Hyperlegible, Verdana, sans-serif" font-size="${n._size}" font-weight="${n._bold ? 700 : 400}" fill="${ink}">${tspans}</text>
      </g>`;
    }
    // zoom: all'inizio la mappa entra nello schermo (senza diventare illeggibile)
    if (this.zoom == null) { this.zoom = Math.max(0.55, Math.min(1, (wrap.clientWidth || 360) / width)); center = true; }
    const z = this.zoom;
    wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * z}" height="${height * z}" viewBox="0 0 ${width} ${height}">${edges}${boxes}</svg>`;
    // il riquadro su cui si lavora resta fermo sullo schermo; altrimenti centro sulla radice
    const focus = (!center && this.selected && this.find(this.selected)?.node) || this.root;
    const keep = !center && anchor && focus === anchor.node;
    const fx = (focus._x + focus._w / 2) * z, fy = (focus._y + focus._h / 2) * z;
    wrap.scrollLeft = keep ? fx - anchor.sx : fx - wrap.clientWidth / 2;
    wrap.scrollTop = keep ? fy - anchor.sy : fy - wrap.clientHeight / 2;
  },

  zoomBy(f) {
    if (!this.root) return;
    this.zoom = Math.max(0.35, Math.min(2.5, (this.zoom || 1) * f));
    this.draw();
  },

  find(id, n = this.root, parent = null) {
    if (n.id === id) return { node: n, parent };
    for (const c of n.children) { const f = this.find(id, c, n); if (f) return f; }
    return null;
  },

  speakNode(id) {
    const g = $(`.map-node[data-id="${id}"]`);
    $$(".map-node.speaking").forEach(e => e.classList.remove("speaking"));
    g?.classList.add("speaking");
    const { node } = this.find(id) || {};
    if (node) tts.say(node.text, () => g?.classList.remove("speaking"));
  },

  toggleLayout() {
    this.layout = this.layout === "bilanciata" ? "albero" : "bilanciata";
    this.zoom = null;
    this.draw({ center: true });
  },

  /** Disegna la mappa su una tela per salvarla come immagine (usa lo stesso carattere dello schermo). */
  async exportPng() {
    if (!this.root) return toast("Prima crea una mappa.");
    await document.fonts?.ready;
    const { width, height } = this.size;
    const S = 2;
    const c = document.createElement("canvas");
    c.width = width * S; c.height = height * S;
    const ctx = c.getContext("2d");
    ctx.scale(S, S);
    ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, 0, width, height);
    for (const { n, parent } of this.nodes) {
      if (!parent) continue;
      const [x1, y1, x2, y2] = n._dir > 0
        ? [parent._x + parent._w, parent._y + parent._h / 2, n._x, n._y + n._h / 2]
        : [parent._x, parent._y + parent._h / 2, n._x + n._w, n._y + n._h / 2];
      const mx = (x1 + x2) / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
      ctx.strokeStyle = n._color[1]; ctx.lineWidth = n._depth === 1 ? 4 : 2.5; ctx.lineCap = "round"; ctx.stroke();
    }
    for (const { n } of this.nodes) {
      const fill = n._depth === 0 ? "#2f6f6a" : n._color[0];
      const stroke = n._depth === 0 ? "#2f6f6a" : n._color[1];
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(n._x, n._y, n._w, n._h, 12) : ctx.rect(n._x, n._y, n._w, n._h);
      ctx.fillStyle = fill; ctx.fill();
      ctx.setLineDash(n.ai ? [8, 5] : []); ctx.lineWidth = n.ai ? 3 : 2; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = n._depth === 0 ? "#ffffff" : "#2b2a27";
      ctx.font = `${n._bold ? 700 : 400} ${n._size}px "Atkinson Hyperlegible", Verdana, sans-serif`;
      ctx.textAlign = "center";
      n._lines.forEach((l, i) => ctx.fillText(l, n._x + n._w / 2, n._y + 10 + n._size + i * n._size * 1.3 - n._size * 0.15));
    }
    c.toBlob(b => download(`mappa-${slug(this.root.text)}.png`, b), "image/png");
  },

  save() {
    if (!this.root) return toast("Prima crea una mappa.");
    const nb = store.get("notebook", []);
    const item = { id: this.savedId || uid(), type: "mappa", title: this.root.text, date: todayLabel(), data: cleanMap(this.root) };
    const i = nb.findIndex(x => x.id === item.id);
    if (i >= 0) nb[i] = item; else nb.unshift(item);
    if (store.set("notebook", nb)) { this.savedId = item.id; toast("Mappa salvata nel quaderno 📚"); }
  }
};
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mappa";

/* =========================================================
   10. DETTATURA
   ========================================================= */
const dictation = {
  rec: null, chunks: [], stream: null, t0: 0, timer: null, undo: null,

  async toggle() {
    if (this.rec && this.rec.state === "recording") return this.rec.stop();
    if (!settings.keyGroq) { openSettings(); return toast("Per dettare serve la chiave Groq."); }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast("Non riesco a usare il microfono. Controlla i permessi del browser.", 5000);
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => this.finish();
    this.rec.start();
    this.t0 = Date.now();
    $("#btnMic").classList.add("rec");
    $("#btnMic").setAttribute("aria-label", "Ferma registrazione");
    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.t0) / 1000);
      $("#micStatus").textContent = `🔴 Ti ascolto… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} — tocca per finire`;
      if (s >= 600) this.rec.stop(); // massimo 10 minuti per registrazione
    }, 300);
  },

  async finish() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach(t => t.stop());
    $("#btnMic").classList.remove("rec");
    $("#btnMic").setAttribute("aria-label", "Avvia registrazione");
    const blob = new Blob(this.chunks, { type: this.rec.mimeType || "audio/webm" });
    if (blob.size < 1200) { $("#micStatus").textContent = "Registrazione troppo corta. Riprova."; return; }
    $("#micStatus").textContent = "✍️ Sto scrivendo…";
    try {
      const text = await transcribe(blob);
      const ta = $("#txtDictation");
      ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text;
      store.set("dictation", ta.value);
      $("#micStatus").textContent = "Fatto! Tocca il microfono per continuare a dettare.";
    } catch (e) {
      $("#micStatus").textContent = "Tocca il microfono per riprovare";
      toast(e.message, 6000);
    }
  },

  async fix() {
    const ta = $("#txtDictation");
    const t = ta.value.trim();
    if (!t) return toast("Prima detta o scrivi qualcosa.");
    try {
      busy(true, "Correggo gli errori…");
      const out = (await ask({ prompt: PROMPTS.correggi(t), temperature: 0.1 })).trim();
      this.undo = t;
      ta.value = out;
      store.set("dictation", out);
      $("#btnFix").textContent = "↩️ Annulla correzione";
      $("#btnFix").dataset.undo = "1";
    } catch (e) { toast(e.message, 6000); }
    finally { busy(false); }
  },
  undoFix() {
    if (this.undo == null) return;
    $("#txtDictation").value = this.undo;
    store.set("dictation", this.undo);
    this.undo = null;
    this.resetFixBtn();
  },
  resetFixBtn() { $("#btnFix").textContent = "✔️ Correggi errori"; delete $("#btnFix").dataset.undo; }
};

/* =========================================================
   11. FLASHCARD
   ========================================================= */
const flash = {
  deck: null, queue: [], done: 0, total: 0, flipped: false,

  refreshDecks(selectId) {
    const decks = store.get("decks", []);
    const sel = $("#selDeck");
    sel.innerHTML = decks.length
      ? decks.map(d => `<option value="${d.id}">${escapeHtml(d.title)} (${d.cards.length})</option>`).join("")
      : `<option value="">Nessun mazzo</option>`;
    $("#deckHint").classList.toggle("hidden", decks.length > 0);
    if (selectId) sel.value = selectId;
    this.start(sel.value);
  },

  start(id) {
    const decks = store.get("decks", []);
    this.deck = decks.find(d => d.id === id) || null;
    $("#flashArea").classList.toggle("hidden", !this.deck);
    if (!this.deck) return;
    // prima le carte meno sapute
    this.queue = this.deck.cards.map((c, i) => i).sort((a, b) => this.deck.cards[a].box - this.deck.cards[b].box);
    this.total = this.queue.length;
    this.done = 0;
    this.show();
  },

  show() {
    const card = $("#flashcard");
    card.classList.remove("flipped");
    this.flipped = false;
    $("#flashJudge").classList.add("hidden");
    $("#btnFlip").classList.remove("hidden");
    $("#flashBar").style.width = (this.total ? this.done / this.total * 100 : 0) + "%";
    if (!this.queue.length) {
      $("#flashFront").innerHTML = "🎉<br>Hai finito il mazzo!<br><small>Tocca per ricominciare</small>";
      $("#flashBack").textContent = "";
      $("#btnFlip").classList.add("hidden");
      this.finished = true;
      return;
    }
    this.finished = false;
    const c = this.deck.cards[this.queue[0]];
    $("#flashFront").textContent = c.q;
    $("#flashBack").textContent = c.a;
  },

  flip() {
    if (this.finished) return this.start(this.deck.id);
    this.flipped = !this.flipped;
    $("#flashcard").classList.toggle("flipped", this.flipped);
    if (this.flipped) { $("#flashJudge").classList.remove("hidden"); $("#btnFlip").classList.add("hidden"); }
  },

  judge(know) {
    const i = this.queue.shift();
    const c = this.deck.cards[i];
    if (know) { c.box = Math.min(5, c.box + 1); this.done++; }
    else { c.box = 0; this.queue.splice(Math.min(3, this.queue.length), 0, i); } // la rivedi tra poco
    const decks = store.get("decks", []);
    const d = decks.find(d => d.id === this.deck.id);
    if (d) { d.cards = this.deck.cards; store.set("decks", decks); }
    this.show();
  },

  read() {
    if (!this.deck || this.finished) return;
    const c = this.deck.cards[this.queue[0]];
    tts.say(this.flipped ? c.a : c.q);
  },

  async remove() {
    if (!this.deck || !(await uiConfirm(`Eliminare il mazzo «${this.deck.title}»?`, "Elimina", true))) return;
    store.set("decks", store.get("decks", []).filter(d => d.id !== this.deck.id));
    this.refreshDecks();
  }
};

/* =========================================================
   12. QUADERNO
   ========================================================= */
async function saveCurrentText() {
  if (!reader.text) return;
  const firstLine = reader.text.split("\n").find(l => l.trim()) || "Testo";
  const suggested = firstLine.replace(/^#+\s*/, "").slice(0, 60);
  const title = await uiPrompt("Dai un nome a questo testo", suggested);
  if (title === null) return;
  const nb = store.get("notebook", []);
  nb.unshift({ id: uid(), type: "testo", title: title.trim() || suggested, date: todayLabel(), data: reader.text });
  if (store.set("notebook", nb)) toast("Salvato nel quaderno 📚");
}

function renderNotebook() {
  const nb = store.get("notebook", []);
  const decks = store.get("decks", []);
  const items = [
    ...nb,
    ...decks.map(d => ({ id: d.id, type: "flashcard", title: d.title, date: d.date || "" }))
  ];
  const icons = { testo: "📄", mappa: "🗺️", flashcard: "🃏" };
  const ul = $("#notebook");
  if (!items.length) { ul.innerHTML = `<li class="hint">Ancora vuoto. Salva un testo con 💾 o una mappa.</li>`; return; }
  ul.innerHTML = items.map(it => `
    <li data-id="${it.id}" data-type="${it.type}">
      <span aria-hidden="true">${icons[it.type]}</span>
      <span class="t">${escapeHtml(it.title)}<small>${it.type} · ${escapeHtml(it.date || "")}</small></span>
      <button class="btn small" data-del aria-label="Elimina">🗑️</button>
    </li>`).join("");
}

function openNotebookItem(id, type) {
  if (type === "flashcard") { flash.refreshDecks(id); return showView("ripassa"); }
  const it = store.get("notebook", []).find(x => x.id === id);
  if (!it) return;
  if (type === "testo") { reader.load(it.data); showView("leggi"); }
  if (type === "mappa") { mindmap.load(it.data, it.id); showView("mappa"); }
}

async function deleteNotebookItem(id, type) {
  if (!(await uiConfirm("Eliminare questo elemento dal quaderno?", "Elimina", true))) return;
  if (type === "flashcard") store.set("decks", store.get("decks", []).filter(d => d.id !== id));
  else store.set("notebook", store.get("notebook", []).filter(x => x.id !== id));
  renderNotebook();
}

function exportBackup() {
  const data = { app: "studio-facile", version: 1, date: new Date().toISOString(),
    notebook: store.get("notebook", []), decks: store.get("decks", []) };
  download(`studio-facile-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1), "application/json");
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "studio-facile") throw new Error();
    const merge = (key, incoming) => {
      const cur = store.get(key, []);
      const ids = new Set(cur.map(x => x.id));
      store.set(key, [...cur, ...(incoming || []).filter(x => !ids.has(x.id))]);
    };
    merge("notebook", data.notebook);
    merge("decks", data.decks);
    renderNotebook(); flash.refreshDecks();
    toast("Backup caricato ✅");
  } catch { toast("Questo file non è un backup valido."); }
}

/* =========================================================
   13. NAVIGAZIONE E IMPOSTAZIONI (interfaccia)
   ========================================================= */
function showView(name) {
  tts.stop();
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  if (name === "quaderno") renderNotebook();
  if (name === "mappa" && mindmap.root) requestAnimationFrame(() => mindmap.draw({ center: true }));
  mindmap.select(name === "mappa" ? mindmap.selected : null);
  scrollTo({ top: 0 });
}

function openSettings() {
  $("#keyGemini").value = settings.keyGemini;
  $("#keyGroq").value = settings.keyGroq;
  $("#setFont").value = settings.font;
  $("#setSize").value = settings.size;
  $("#setLetter").value = settings.letter;
  $("#setLine").value = settings.line;
  $("#setTheme").value = settings.theme;
  $("#setSyllables").checked = settings.syllables;
  $("#setVoice").value = settings.voice;
  $("#modGemini").value = settings.modGemini;
  $("#modGroq").value = settings.modGroq;
  $("#modWhisper").value = settings.modWhisper;
  const d = $("#dlgSettings");
  if (!d.open) d.showModal();
}

function bindSettings() {
  const map = {
    keyGemini: ["#keyGemini", v => v.trim()], keyGroq: ["#keyGroq", v => v.trim()],
    font: ["#setFont"], size: ["#setSize", Number], letter: ["#setLetter", Number], line: ["#setLine", Number],
    theme: ["#setTheme"], voice: ["#setVoice"],
    modGemini: ["#modGemini", v => v.trim() || DEFAULTS.modGemini],
    modGroq: ["#modGroq", v => v.trim() || DEFAULTS.modGroq],
    modWhisper: ["#modWhisper", v => v.trim() || DEFAULTS.modWhisper]
  };
  for (const [key, [sel, conv = v => v]] of Object.entries(map)) {
    $(sel).addEventListener("input", (e) => {
      settings[key] = conv(e.target.value);
      saveSettings(); applySettings();
      if (["font", "size", "letter", "line"].includes(key) && mindmap.root) mindmap.draw();
    });
  }
  $("#setSyllables").addEventListener("change", (e) => {
    settings.syllables = e.target.checked; saveSettings(); reader.render();
  });
  $("#setTheme").addEventListener("change", () => mindmap.root && mindmap.draw());
  $("#btnVoiceTest").addEventListener("click", () => tts.say("Ciao! Questa è la voce che leggerà i tuoi testi."));
  $("#btnLoadModels").addEventListener("click", loadModels);
  $("#btnExport").addEventListener("click", exportBackup);
  // importazione backup
  const imp = document.createElement("label");
  imp.className = "btn small";
  imp.innerHTML = `⬆️ Carica backup<input type="file" accept="application/json,.json" hidden>`;
  $("#btnExport").after(imp);
  imp.querySelector("input").addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });
  $("#dlgSettings").addEventListener("close", () => { if (mindmap.root) mindmap.draw(); });
}

async function loadModels() {
  const info = $("#modelsInfo");
  info.textContent = "Carico…";
  const msgs = [];
  if (settings.keyGemini) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": settings.keyGemini } });
      const d = await r.json();
      const names = (d.models || []).filter(m => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name))
        .map(m => m.name.replace("models/", ""));
      $("#listGemini").innerHTML = names.map(n => `<option value="${n}">`).join("");
      msgs.push(`Gemini: ${names.length} modelli`);
    } catch { msgs.push("Gemini: errore"); }
  }
  if (settings.keyGroq) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: "Bearer " + settings.keyGroq } });
      const d = await r.json();
      const ids = (d.data || []).map(m => m.id).filter(id => !/whisper|guard|tts|orpheus/i.test(id));
      $("#listGroq").innerHTML = ids.map(n => `<option value="${n}">`).join("");
      msgs.push(`Groq: ${ids.length} modelli`);
    } catch { msgs.push("Groq: errore"); }
  }
  info.textContent = msgs.join(" · ") || "Inserisci prima le chiavi.";
}

/* =========================================================
   14. AVVIO
   ========================================================= */
function init() {
  applySettings();
  bindSettings();

  // voci
  if ("speechSynthesis" in window) {
    tts.loadVoices();
    speechSynthesis.onvoiceschanged = () => tts.loadVoices();
  } else {
    toast("Questo browser non legge ad alta voce. Prova con Chrome o Safari.", 6000);
  }

  // navigazione
  $$(".tab").forEach(t => t.addEventListener("click", () => showView(t.dataset.view)));
  $("#btnSettings").addEventListener("click", openSettings);

  // input testo
  $("#inPhoto").addEventListener("change", (e) => { handleFiles([...e.target.files]); e.target.value = ""; });
  $("#inFile").addEventListener("change", (e) => { handleFiles([...e.target.files]); e.target.value = ""; });
  $("#btnPaste").addEventListener("click", async () => {
    $("#txtInput").classList.remove("hidden");
    $("#pasteActions").classList.remove("hidden");
    try { const t = await navigator.clipboard.readText(); if (t) $("#txtInput").value = t; } catch { /* permesso negato: si incolla a mano */ }
    $("#txtInput").focus();
  });
  $("#btnUseText").addEventListener("click", () => {
    const t = $("#txtInput").value.trim();
    if (!t) return toast("Il riquadro è vuoto.");
    reader.load(t);
    $("#txtInput").value = "";
    $("#txtInput").classList.add("hidden");
    $("#pasteActions").classList.add("hidden");
  });

  // lettore
  $("#btnPlay").addEventListener("click", () => reader.playing ? reader.pause() : reader.play());
  $("#btnStop").addEventListener("click", () => reader.stop());
  $("#rngRate").addEventListener("input", (e) => {
    settings.rate = Number(e.target.value); saveSettings();
    if (reader.playing) reader.play(reader.idx);
  });
  $("#reader").addEventListener("click", (e) => {
    if (reader.editing) return;
    const s = e.target.closest(".s");
    if (s) reader.play(Number(s.dataset.i));
  });
  $("#btnRuler").addEventListener("click", () => ruler.toggle());
  addEventListener("pointermove", (e) => { if (ruler.on && e.pointerType === "mouse") ruler.moveTo(e.clientY); });
  addEventListener("touchmove", (e) => { if (ruler.on && e.target.closest?.("#reader")) ruler.moveTo(e.touches[0].clientY - 40); }, { passive: true });
  $("#btnEdit").addEventListener("click", () => reader.toggleEdit());
  $("#btnSave").addEventListener("click", saveCurrentText);

  // azioni
  $$(".action").forEach(b => b.addEventListener("click", () => runAction(b.dataset.act)));
  $("#btnResultRead").addEventListener("click", () => tts.say(lastResult));
  $("#btnResultToReader").addEventListener("click", () => {
    reader.load(lastResult.replace(/\*\*/g, "").replace(/^##\s*/gm, "# ").replace(/^[-*•]\s+/gm, ""));
    $("#resultCard").classList.add("hidden");
    $("#readerCard").scrollIntoView({ behavior: "smooth" });
  });

  // mappa
  // tocco = seleziona il riquadro (se il dito non ha trascinato la mappa)
  const mw = $("#mapWrap");
  let down = null;
  mw.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  mw.addEventListener("pointercancel", () => { down = null; });
  mw.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
    down = null;
    const g = e.target.closest(".map-node");
    if (!g) return mindmap.select(null);
    if (mindmap.selected === g.dataset.id) mindmap.speakNode(g.dataset.id); // secondo tocco: ascolta
    else mindmap.select(g.dataset.id);
  });
  mw.addEventListener("contextmenu", (e) => e.preventDefault());
  mw.addEventListener("keydown", (e) => {
    const g = e.target.closest(".map-node");
    if (!g) return;
    mindmap.select(g.dataset.id);
    if (e.key === "Enter") mindmap.speakNode(g.dataset.id);
    if (e.key === "F2") mindmap.nodeAction("edit");
  });
  $("#nodeBar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nb]");
    if (b) mindmap.nodeAction(b.dataset.nb);
  });
  $("#btnMapNew").addEventListener("click", () => mindmap.newMap());
  $("#btnMapOther").addEventListener("click", async () => {
    if (mindmap.history.length && !mindmap.savedId &&
        !(await uiConfirm("Chiudere questa mappa? Non è salvata nel quaderno: premi 💾 prima, se vuoi tenerla.", "Chiudi"))) return;
    mindmap.root = null; mindmap.select(null); mindmap.showCard();
    store.set("currentMap", null);
  });
  $("#btnMapUndo").addEventListener("click", () => mindmap.undo());
  $("#btnMapImprove").addEventListener("click", () => mindmap.improve());
  $("#btnMapLayout").addEventListener("click", () => mindmap.toggleLayout());
  $("#btnZoomIn").addEventListener("click", () => mindmap.zoomBy(1.25));
  $("#btnZoomOut").addEventListener("click", () => mindmap.zoomBy(0.8));
  $("#btnMapPng").addEventListener("click", () => mindmap.exportPng());
  $("#btnMapSave").addEventListener("click", () => mindmap.save());
  $("#btnMapTopic").addEventListener("click", async () => {
    const topic = $("#mapTopic").value.trim();
    if (!topic) return toast("Scrivi prima l'argomento.");
    try {
      busy(true, "Sto creando la mappa…");
      const data = parseJSON(await ask({ prompt: PROMPTS.mappaTema(topic), system: SYSTEM_TUTOR, json: true }));
      mindmap.load(normalizeMap(data));
      $("#mapTopic").value = "";
    } catch (e) { toast(e.message || "Non sono riuscito a creare la mappa. Riprova.", 6000); }
    finally { busy(false); }
  });

  // dettatura
  $("#btnMic").addEventListener("click", () => dictation.toggle());
  $("#btnFix").addEventListener("click", () => $("#btnFix").dataset.undo ? dictation.undoFix() : dictation.fix());
  $("#txtDictation").addEventListener("input", (e) => { store.set("dictation", e.target.value); dictation.undo = null; dictation.resetFixBtn(); });
  $("#btnDictRead").addEventListener("click", () => tts.say($("#txtDictation").value));
  $("#btnCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#txtDictation").value); toast("Copiato 📋"); }
    catch { $("#txtDictation").select(); toast("Selezionato: ora copia con il menu."); }
  });
  $("#btnDictToReader").addEventListener("click", () => {
    const t = $("#txtDictation").value.trim();
    if (!t) return;
    reader.load(t); showView("leggi");
  });
  $("#btnDictClear").addEventListener("click", async () => {
    if ($("#txtDictation").value && !(await uiConfirm("Cancellare tutto il testo dettato?", "Cancella", true))) return;
    $("#txtDictation").value = ""; store.set("dictation", ""); dictation.resetFixBtn();
  });

  // flashcard
  $("#selDeck").addEventListener("change", (e) => flash.start(e.target.value));
  $("#flashcard").addEventListener("click", () => flash.flip());
  $("#flashcard").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flash.flip(); } });
  $("#btnFlip").addEventListener("click", () => flash.flip());
  $("#btnKnow").addEventListener("click", () => flash.judge(true));
  $("#btnAgain").addEventListener("click", () => flash.judge(false));
  $("#btnFlashRead").addEventListener("click", () => flash.read());
  $("#btnDeckDelete").addEventListener("click", () => flash.remove());

  // quaderno
  $("#notebook").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    if (e.target.closest("[data-del]")) deleteNotebookItem(li.dataset.id, li.dataset.type);
    else openNotebookItem(li.dataset.id, li.dataset.type);
  });

  // ripristino del lavoro in corso
  const cur = store.get("current", "");
  if (cur) reader.load(cur);
  $("#txtDictation").value = store.get("dictation", "");
  const cm = store.get("currentMap", null);
  if (cm?.root) mindmap.load(cm.root, cm.savedId);
  flash.refreshDecks();
  // quando i caratteri sono pronti ridisegno la mappa con le misure giuste
  document.fonts?.ready.then(() => { if (mindmap.root) mindmap.draw(); });

  // primo avvio: chiedo le chiavi
  if (!settings.keyGemini && !settings.keyGroq) {
    setTimeout(() => { openSettings(); toast("Benvenuta! Inserisci le chiavi gratuite per iniziare.", 5000); }, 400);
  }

  // funziona anche come app installata
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
