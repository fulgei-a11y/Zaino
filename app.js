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
/** Icona dal set in index.html */
const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
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
function uiDialog({ title = "", message = "", input = null, subject = null, buttons }) {
  return new Promise((resolve) => {
    const d = $("#dlgAsk");
    $("#askTitle").textContent = title;
    $("#askMsg").textContent = message;
    $("#askMsg").classList.toggle("hidden", !message);
    const ta = $("#askInput");
    $("#askInputWrap").classList.toggle("hidden", input === null);
    $("#askMicStatus").classList.add("hidden");
    ta.value = input ?? "";
    $("#askSubjWrap").classList.toggle("hidden", subject === null);
    $("#askSubject").value = subject ?? "";
    if (subject !== null) fillSubjects();
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
    d.onclose = () => { askRec?.cancel(); resolve(input === null ? result : (result === null ? null : { choice: result, text: ta.value.trim(), subject: $("#askSubject").value.trim() })); };
    d.showModal();
    if (input !== null) setTimeout(() => { ta.focus(); ta.select(); }, 50);
  });
}
const uiConfirm = (message, okLabel = "Sì", danger = false) =>
  uiDialog({ title: message, buttons: [{ label: "No", value: false }, { label: okLabel, value: true, primary: !danger, danger }] }).then(v => v === true);
/* microfono della finestra di scrittura: detta invece di scrivere */
let askRec = null;
function askMicToggle() {
  $("#askMicStatus").classList.remove("hidden");
  askRec ||= makeRecorder($("#askMic"), $("#askMicStatus"), (text) => {
    const ta = $("#askInput");
    ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text.replace(/[.。]$/, "");
    ta.focus();
  }, "Fatto. Puoi correggere a mano o dettare ancora.");
  askRec.toggle();
}

/** Chiede nome e materia prima di salvare nel quaderno. */
const askSave = (title, value = "", subject = "") =>
  uiDialog({ title, input: value, subject, buttons: [{ label: "Annulla", value: null }, { label: "Salva", value: "ok", primary: true }] })
    .then(r => (r && r.choice === "ok") ? { title: r.text || value, subject: r.subject } : null);

const DEFAULT_SUBJECTS = ["Italiano", "Storia", "Geografia", "Matematica", "Fisica", "Chimica", "Scienze", "Inglese", "Francese", "Spagnolo", "Tedesco", "Latino", "Filosofia", "Arte", "Diritto", "Economia", "Informatica"];
function allSubjects() {
  const used = [...store.get("notebook", []), ...store.get("decks", []), ...store.get("plans", [])].map(x => x.subject).filter(Boolean);
  return [...new Set([...used, ...DEFAULT_SUBJECTS])];
}
function fillSubjects() {
  $("#subjectsList").innerHTML = allSubjects().map(x => `<option value="${escapeHtml(x)}">`).join("");
}

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
  modWhisper: "whisper-large-v3-turbo",
  modGeminiLite: "gemini-flash-lite-latest",
  modGroqVision: ""
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
  $("meta[name=theme-color]").content = settings.theme === "scuro" ? "#12151f" : "#f5f6fa";
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

/* ---------- Pause dopo un limite: il servizio stanco viene saltato per un po' ---------- */
const cooldown = {
  until: store.get("cooldown", {}),
  ok(key) { return !(this.until[key] > Date.now()); },
  set(key, seconds) {
    this.until[key] = Date.now() + seconds * 1000;
    store.set("cooldown", this.until);
  },
  clear(key) { if (this.until[key]) { delete this.until[key]; store.set("cooldown", this.until); } }
};
/** Quanto aspettare dopo un errore di limite (secondi), leggendo i dettagli dell'errore. */
function waitSeconds(status, raw, retryAfter) {
  if (status !== 429) return status >= 500 || status === 0 ? 20 : 0;
  const txt = JSON.stringify(raw || "");
  if (/per ?day|PerDay|RPD|daily/i.test(txt)) return 60 * 60;                   // limite del giorno: un'ora
  const m = txt.match(/"retryDelay":"(\d+)/) || txt.match(/try again in (\d+)/i);
  const s = Number(retryAfter) || (m ? Number(m[1]) : 0);
  return Math.min(Math.max(s || 60, 15), 600);
}

async function geminiCall({ prompt, system, images = [], json = false, temperature = 0.4, model }) {
  if (!settings.keyGemini) throw new AIError("Manca la chiave Gemini (in Impostazioni).", -1);
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
    const e = new AIError(friendlyError("Gemini", res.status, data?.error?.message), res.status);
    e.wait = waitSeconds(res.status, data?.error, res.headers.get("retry-after"));
    throw e;
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

async function groqChat({ prompt, system, images = [], json = false, temperature = 0.4, model }) {
  if (!settings.keyGroq) throw new AIError("Manca la chiave Groq (in Impostazioni).", -1);
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  if (images.length) {
    messages.push({ role: "user", content: [
      { type: "text", text: prompt },
      ...images.map(img => ({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.data}` } }))
    ] });
  } else {
    messages.push({ role: "user", content: prompt });
  }
  const body = { model: model || settings.modGroq || DEFAULTS.modGroq, messages, temperature };
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
  if (!res.ok) {
    const e = new AIError(friendlyError("Groq", res.status, data?.error?.message), res.status);
    e.wait = waitSeconds(res.status, data?.error, res.headers.get("retry-after"));
    throw e;
  }
  const out = data.choices?.[0]?.message?.content || "";
  if (!out) throw new AIError("Groq non ha risposto. Riprova.", 1);
  return out;
}

/** Trova su Groq un modello che legge le immagini (i nomi cambiano nel tempo). */
let groqVisionModel = null;
async function findGroqVision() {
  if (settings.modGroqVision) return settings.modGroqVision;
  if (groqVisionModel !== null) return groqVisionModel;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: "Bearer " + settings.keyGroq } });
    const ids = ((await r.json()).data || []).filter(m => m.active !== false).map(m => m.id);
    const prefs = [/llama-4-scout/i, /llama-4-maverick/i, /llama-4/i, /vision|-vl\b|-vl-/i];
    groqVisionModel = "";
    for (const re of prefs) { const id = ids.find(i => re.test(i)); if (id) { groqVisionModel = id; break; } }
  } catch { groqVisionModel = ""; }
  return groqVisionModel;
}

/** Chiede all'IA provando in ordine: Gemini → Gemini Flash-Lite → Groq.
    Un servizio che ha appena segnalato il limite viene saltato finché non si riposa. */
async function ask(opts) {
  const hasG = !!settings.keyGemini, hasQ = !!settings.keyGroq;
  if (!hasG && !hasQ) {
    openSettings();
    throw new AIError("Per iniziare inserisci almeno una chiave gratuita (Gemini o Groq).", -1);
  }
  const withImages = !!opts.images?.length;
  const main = settings.modGemini || DEFAULTS.modGemini;
  const steps = [];
  if (hasG) {
    steps.push({ key: "gemini:" + main, name: "Gemini", run: () => geminiCall({ ...opts, model: main }) });
    for (const m of [DEFAULTS.modGeminiLite, "gemini-2.5-flash"]) {
      if (m !== main) steps.push({ key: "gemini:" + m, name: "Gemini (riserva)", run: () => geminiCall({ ...opts, model: m }), quiet404: true });
    }
  }
  if (hasQ) {
    if (withImages) steps.push({ key: "groq:vision", name: "Groq", run: async () => {
      const m = await findGroqVision();
      if (!m) throw new AIError("Su Groq non c'è un modello per leggere le foto.", 404);
      return groqChat({ ...opts, model: m });
    } });
    else steps.push({ key: "groq:text", name: "Groq", run: () => groqChat(opts) });
  }
  // prima quelli riposati; se sono tutti in pausa, li provo comunque
  const ready = steps.filter(s => cooldown.ok(s.key));
  const order = ready.length ? ready : steps;
  let firstErr = null, lastErr = null;
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    if (i > 0) busy(true, `${order[i - 1].name} è occupato, provo con ${s.name}…`);
    try {
      const out = await s.run();
      cooldown.clear(s.key);
      return out;
    } catch (e) {
      if (e.wait) cooldown.set(s.key, e.wait);
      if (e.status === 404 && s.quiet404) cooldown.set(s.key, 24 * 3600); // modello di riserva inesistente: lo salto
      if (!firstErr && !(e.status === 404 && s.quiet404)) firstErr = e;
      lastErr = e;
      // chiave sbagliata o richiesta non valida: provo comunque il servizio successivo
    }
  }
  throw firstErr || lastErr || new AIError("L'IA non risponde. Riprova tra un minuto.", 1);
}

function parseJSON(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* prova a estrarre */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("Risposta non valida");
}

async function transcribe(blob) {
  if (!settings.keyGroq) throw new AIError("Per la dettatura serve la chiave Groq (in Impostazioni).", -1);
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
  traduci: (t, from, to) => `Traduci questo testo ${from === "it" ? "dall'italiano" : "in italiano"}${to && to !== "it" ? " in " + LANGS[to].name.toLowerCase() : ""}, per una studentessa che lo deve studiare.
Procedi paragrafo per paragrafo. Per ogni paragrafo scrivi:
- prima una riga che inizia con "${LANGS[from]?.flag || ""} " seguita dal paragrafo originale;
- poi una riga che inizia con "${LANGS[to]?.flag || "🇮🇹"} " seguita dalla traduzione, semplice e naturale.
Lascia una riga vuota tra un paragrafo e l'altro. Metti in **grassetto** nella traduzione le parole più importanti. Nessun altro commento.

TESTO:
${t}`,
  vocaboli: (t, lang) => `Questo testo è in ${LANGS[lang].name.toLowerCase()}. Crea flashcard di vocaboli per una studentessa italiana delle superiori.
Rispondi SOLO con JSON: {"titolo": "argomento breve in italiano", "carte": [{"domanda": "parola o espressione in ${LANGS[lang].name.toLowerCase()}", "risposta": "traduzione italiana — breve esempio in ${LANGS[lang].name.toLowerCase()}"}]}
Regole: da 10 a 20 carte; scegli parole utili e importanti del testo (anche verbi ed espressioni), non quelle banali; per i verbi irregolari indica le forme principali.

TESTO:
${t}`,
  formulario: (t) => `Crea un formulario di una pagina da questo testo di matematica, fisica, chimica o scienze, da usare durante lo studio e le verifiche.
Formato:
## (argomento)
- **nome della formula**: formula
  - cosa significa ogni lettera, con l'unità di misura
  - quando si usa (una frase)
## Formule inverse
- (le formule inverse più utili)
## Attenzione a
- (2-4 errori tipici da evitare)
Scrivi le formule in modo leggibile, con simboli come ², ³, √, ·, /, Δ, π, ≈, ≤, ≥ (niente LaTeX). Se il testo non contiene formule, fai uno schema dei concetti e delle definizioni da ricordare.

TESTO:
${t}`,
  esercizio: (t) => `Questo è un esercizio (di matematica, fisica, chimica, grammatica o altro). Aiuta la studentessa a risolverlo DA SOLA, passo per passo, come farebbe un buon insegnante.
Rispondi SOLO con JSON:
{"esercizio": "testo dell'esercizio, ricopiato in breve", "dati": ["dato 1", "dato 2"], "passi": [{"titolo": "titolo breve del passo", "spiegazione": "cosa fare e perché, con il calcolo di questo passo"}], "risultato": "risultato finale con unità di misura", "controllo": "come verificare che il risultato sia sensato"}
Regole: da 3 a 7 passi; frasi brevi; formule leggibili (², √, ·, niente LaTeX); se ci sono più esercizi, risolvi solo il primo.

TESTO:
${t}`,
  linea: (t) => `Crea una linea del tempo con gli eventi di questo testo, in ordine cronologico.
Rispondi SOLO con JSON: {"titolo": "argomento", "eventi": [{"data": "1789 (o 14 luglio 1789, o III sec. a.C.)", "titolo": "evento in max 8 parole", "dettaglio": "una frase semplice su perché è importante"}]}
Regole: da 4 a 15 eventi; solo eventi con una data o un periodo; se il testo non contiene date, metti le fasi o i passaggi nell'ordine in cui avvengono e scrivi nel campo "data" la parola "Fase 1", "Fase 2"...

TESTO:
${t}`,
  confronta: (t) => `Trova nel testo gli elementi più utili da confrontare (es. due popoli, due personaggi, due periodi, due processi, due teorie) e crea una tabella di confronto per lo studio.
Rispondi SOLO con JSON: {"titolo": "Confronto tra X e Y", "colonne": ["X", "Y"], "righe": [{"aspetto": "es. governo", "valori": ["per X", "per Y"]}]}
Regole: da 2 a 4 colonne; da 4 a 8 righe; celle brevi (max 12 parole), parole chiave; "valori" ha sempre lo stesso numero di elementi di "colonne".

TESTO:
${t}`,
  domanda: (t, gia) => `Sei un insegnante che interroga una studentessa delle superiori su questo testo.
Fai UNA sola domanda aperta, chiara e breve, come in una vera interrogazione orale. Alterna domande di definizione, di spiegazione ("perché…", "come…") e di collegamento.
${gia.length ? "NON ripetere queste domande già fatte:\n- " + gia.join("\n- ") : ""}
Rispondi SOLO con JSON: {"domanda": "..."}

TESTO:
${t}`,
  valuta: (t, domanda, risposta) => `Sei un insegnante gentile ma preciso. Una studentessa con dislessia ha risposto A VOCE a una domanda di interrogazione (la risposta è trascritta automaticamente: ignora errori di trascrizione, ripetizioni e punteggiatura).
Valuta il CONTENUTO confrontandolo con il testo studiato. Sii incoraggiante e concreto.
Rispondi SOLO con JSON:
{"livello": "ottimo" | "buono" | "sufficiente" | "da rivedere", "bene": ["cosa ha detto di giusto"], "manca": ["concetto importante che non ha detto"], "errori": ["affermazione sbagliata → versione corretta"], "risposta_modello": "come avrebbe potuto rispondere, in 3-5 frasi semplici", "consiglio": "un consiglio pratico per migliorare l'esposizione"}

TESTO STUDIATO:
${t}

DOMANDA: ${domanda}

RISPOSTA DELLA STUDENTESSA:
${risposta}`,
  piano: (materia, argomenti, giorni, minuti) => `Crea un piano di studio per una studentessa con dislessia che deve prepararsi a una verifica di ${materia}.
Argomenti da studiare:
${argomenti}

Giorni disponibili (formato AAAA-MM-GG): ${giorni.join(", ")}
Tempo al giorno: circa ${minuti} minuti, divisi in sessioni da 20-25 minuti con pause.
Regole:
- distribuisci gli argomenti in modo equilibrato, prima i più difficili;
- per ogni argomento prevedi attività attive: leggere con la sintesi vocale, fare la mappa, flashcard, interrogazione simulata;
- l'ultimo giorno è solo ripasso generale (mappe, flashcard, interrogazione);
- se i giorni sono pochi, concentra l'essenziale;
- attività brevi e concrete (max 12 parole ciascuna).
Rispondi SOLO con JSON: {"sessioni": [{"data": "AAAA-MM-GG", "attivita": ["...", "..."]}]}`,
  spiegaErrori: (t) => `Trova gli errori di ortografia, grammatica e punteggiatura in questo testo scritto da una studentessa con dislessia e disortografia.
Per ogni errore spiega la regola in modo semplice e gentile, con un trucco per ricordarla.
Rispondi SOLO con JSON:
{"errori": [{"sbagliato": "parola o pezzo sbagliato, esattamente come è scritto", "corretto": "versione giusta", "tipo": "accenti" | "apostrofo" | "h" | "doppie" | "maiuscole" | "punteggiatura" | "lettere scambiate" | "parole unite o staccate" | "grammatica" | "altro", "regola": "spiegazione breve con un trucco"}], "testo_corretto": "tutto il testo corretto"}
Se non ci sono errori, "errori" è una lista vuota.

TESTO:
${t}`,
  schede: (json) => `Questa è una mappa concettuale di una studentessa. Per ogni ramo principale scrivi una scheda di ripasso.
Rispondi SOLO con JSON:
{"introduzione": "2 frasi: di cosa parla l'argomento e perché è importante",
 "schede": [{"ramo": "testo ESATTO del ramo", "spiegazione": "2-3 frasi brevi e semplici che collegano i concetti del ramo", "ricorda": "una frase chiave da ricordare"}],
 "domande": ["3-5 domande da interrogazione su tutta la mappa"]}
Usa solo informazioni corrette; frasi di massimo 20 parole; nessun elenco dentro le frasi.

MAPPA:
${json}`,
  fisica: (t) => `Sei un insegnante di fisica paziente. Aiuta una studentessa delle superiori con dislessia e discalculia a risolvere questo problema DA SOLA, un passo alla volta.
Rispondi SOLO con JSON:
{"riassunto": "cosa chiede il problema, in una frase semplice",
 "dati": [{"simbolo": "v₀", "grandezza": "velocità iniziale", "valore": "72", "unita": "km/h", "si": "20 m/s"}],
 "incognite": [{"simbolo": "t", "grandezza": "tempo"}],
 "formule": [{"formula": "v = s / t", "perche": "lega spazio, tempo e velocità"}],
 "disegno": "come fare uno schema del problema (facoltativo, una frase)",
 "passi": [{"titolo": "titolo breve", "spiegazione": "cosa fare e perché, frasi brevi", "calcolo": "t = 100 m / 20 m/s = 5 s"}],
 "risultato": "t = 5 s",
 "controllo": "perché il risultato ha senso (ordine di grandezza, unità)"}
Regole:
- nei dati metti TUTTI i valori del testo, anche quelli nascosti nelle parole (es. "parte da fermo" → v₀ = 0 m/s; "cade" → a = g = 9,81 m/s²);
- nel campo "si" scrivi il dato convertito nell'unità del Sistema Internazionale (se è già in SI, ripetilo);
- se serve una formula inversa, ricavala in un passo a parte spiegando l'operazione fatta su entrambi i membri;
- nei calcoli scrivi sempre i numeri CON le unità di misura; usa la virgola per i decimali; simboli leggibili (², √, ·, niente LaTeX);
- da 3 a 7 passi; se ci sono più domande, rispondi a tutte, una dopo l'altra.

PROBLEMA:
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
/* ---------- Lingua del testo (per scegliere la voce giusta) ---------- */
const LANGS = {
  it: { name: "Italiano", flag: "🇮🇹", bcp: "it-IT" },
  en: { name: "Inglese", flag: "🇬🇧", bcp: "en-GB" },
  fr: { name: "Francese", flag: "🇫🇷", bcp: "fr-FR" },
  es: { name: "Spagnolo", flag: "🇪🇸", bcp: "es-ES" },
  de: { name: "Tedesco", flag: "🇩🇪", bcp: "de-DE" }
};
const STOPWORDS = {
  it: "il lo gli di che non per una sono con del della dei nel anche questo come più ma è perché alla delle essere",
  en: "the and of to is that it you was for are with this have from they not but what which their were been would",
  fr: "le les des est et que une pour dans pas qui sur avec être sont mais nous vous ils elle cette aux du ce",
  es: "el los las que y en un una por para con es está pero como más sus del al muy también fue son este",
  de: "der die das und ist nicht ein eine zu mit den sich auch auf für von dem des im sie es wird werden"
};
const STOP_SETS = Object.fromEntries(Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v.split(" "))]));
function detectLang(text) {
  const words = (text || "").toLowerCase().match(/[a-zà-ÿäöüß']+/g) || [];
  const score = {};
  for (const w of words.slice(0, 600)) for (const k in STOP_SETS) if (STOP_SETS[k].has(w)) score[k] = (score[k] || 0) + 1;
  let best = "it", max = 0;
  for (const k in score) if (score[k] > max) { max = score[k]; best = k; }
  return max >= 2 ? best : "it";
}

const tts = {
  voices: [],      // voci italiane (per le impostazioni)
  all: [],         // tutte le voci del dispositivo
  speaking: false,
  onStop: null,
  loadVoices() {
    this.all = speechSynthesis.getVoices();
    this.voices = this.all.filter(v => v.lang && v.lang.toLowerCase().startsWith("it"));
    if (!this.voices.length) this.voices = this.all;
    const sel = $("#setVoice");
    sel.innerHTML = `<option value="">Automatica (la migliore disponibile)</option>` +
      this.voices.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)}${v.localService ? "" : " (online)"}</option>`).join("");
    sel.value = settings.voice;
  },
  pickVoice(lang = "it") {
    const prefs = [/natural|neural|premium|enhanced/i, /google/i];
    if (lang === "it") {
      if (settings.voice) { const v = this.voices.find(v => v.name === settings.voice); if (v) return v; }
      for (const re of [...prefs, /elsa|isabella|alice|federica|paola|luca/i]) { const v = this.voices.find(v => re.test(v.name)); if (v) return v; }
      return this.voices[0];
    }
    const pool = this.all.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang));
    if (lang === "en") pool.sort((a, b) => (/GB|UK/i.test(b.lang + b.name) ? 1 : 0) - (/GB|UK/i.test(a.lang + a.name) ? 1 : 0));
    for (const re of prefs) { const v = pool.find(v => re.test(v.name)); if (v) return v; }
    return pool[0] || null;
  },
  utter(text, lang = "it") {
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || LANGS[lang]?.bcp || "it-IT";
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
  /** Legge un testo qualsiasi (risultati, carte, mappe). La lingua, se non indicata, la riconosce da sola. */
  say(text, onEnd, lang) {
    this.stop();
    const clean = (text || "").replace(/[#*_`>\[\]]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return;
    const lg = lang || detectLang(clean);
    const chunks = splitSentences(clean);
    this.speaking = true;
    const my = this.session;
    let i = 0;
    const next = () => {
      if (my !== this.session) return;
      if (!this.speaking || i >= chunks.length) { this.speaking = false; onEnd?.(); return; }
      const u = this.utter(chunks[i++], lg);
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

  picked: new Set(),   // frasi scelte: gli strumenti useranno solo quelle
  picking: false,
  subject: "",         // materia (se il testo viene dal quaderno)
  lang: "it",          // lingua della voce (riconosciuta da sola, si può cambiare)

  load(text, { keepPosition = false } = {}) {
    this.text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!keepPosition) this.idx = 0;
    store.set("current", this.text);
    this.render();
    this.setLang(detectLang(this.text));
    this.subject = "";
    this.setPicked(new Set());
    if (this.picking) this.togglePick();
    const has = !!this.text;
    $("#readerCard").classList.toggle("hidden", !has);
    $("#toolsCard").classList.toggle("hidden", !has);
    $("#homeIntro").classList.toggle("hidden", has);
    $("#homePanels").classList.toggle("hidden", has);
    $("#inputCard").classList.toggle("compact", has);
    if (!has) home.render();
    if (!has) $("#resultCard").classList.add("hidden");
  },

  /** Un titolo per il testo aperto: la prima riga. */
  title() {
    return (this.text.split("\n").find(l => l.trim()) || "Testo").replace(/^#+\s*/, "").slice(0, 60);
  },

  setLang(lang) {
    this.lang = LANGS[lang] ? lang : "it";
    $("#selLang").value = this.lang;
    const foreign = this.lang !== "it";
    $$(".action.lang-only").forEach(b => b.classList.toggle("dim", !foreign));
  },

  /** Il testo su cui lavorano gli strumenti: la parte scelta, oppure tutto. */
  activeText() {
    if (!this.picked.size) return this.text;
    return [...this.picked].sort((a, b) => a - b).map(i => this.sentences[i]?.text.trim()).filter(Boolean).join(" ");
  },

  setPicked(set) {
    this.picked = set;
    this.sentences.forEach((s, i) => s.el.classList.toggle("picked", set.has(i)));
    const n = set.size;
    $("#pickInfo").classList.toggle("hidden", !n);
    $("#pickTip").classList.toggle("hidden", !!n || !this.text);
    if (n) {
      const words = this.activeText().split(/\s+/).length;
      $("#pickCount").textContent = `${n} ${n === 1 ? "frase" : "frasi"} (${words} parole)`;
    }
  },

  /** Modalità "Scegli": toccando le frasi le aggiungi o togli dalla parte scelta. */
  togglePick() {
    this.picking = !this.picking;
    if (this.picking) this.pause();
    $("#reader").classList.toggle("picking", this.picking);
    $("#pickHint").classList.toggle("hidden", !this.picking);
    const b = $("#btnPick");
    b.innerHTML = this.picking ? `${icon("check")}<span>Fatto</span>` : `${icon("scissors")}<span>Scegli parte</span>`;
    b.classList.toggle("on", this.picking);
  },

  /** Selezione fatta col dito o col mouse: prendo le frasi toccate dalla selezione. */
  fromSelection() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || this.editing) return;
    const range = sel.getRangeAt(0);
    if (!$("#reader").contains(range.commonAncestorContainer)) return;
    const set = new Set();
    this.sentences.forEach((s, i) => { if (range.intersectsNode(s.el)) set.add(i); });
    if (set.size) this.setPicked(set);
  },

  async clear() {
    const saved = store.get("notebook", []).some(x => x.type === "testo" && x.data === this.text);
    const msg = saved ? "Chiudere questo testo? È salvato nel quaderno." : "Chiudere questo testo? Non è salvato nel quaderno: premi Salva prima, se vuoi tenerlo.";
    if (!(await uiConfirm(msg, "Chiudi", !saved))) return;
    this.stop();
    this.load("");
    scrollTo({ top: 0, behavior: "smooth" });
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
      const u = tts.utter(s.text, this.lang);
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
    b.innerHTML = icon(this.playing ? "pause" : "play");
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
      $("#btnEdit").innerHTML = `${icon("check")}<span>Fatto</span>`;
      $("#btnEdit").classList.add("on");
    } else {
      this.editing = false;
      box.contentEditable = "false";
      box.classList.remove("edit");
      $("#btnEdit").innerHTML = `${icon("pencil")}<span>Modifica</span>`;
      $("#btnEdit").classList.remove("on");
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
    $("#btnRuler").classList.toggle("on", this.on);
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
      buttons: [{ label: "Annulla", value: null }, { label: "Testo nuovo", value: "new" }, { label: "Aggiungi in fondo", value: "add", primary: true }]
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
const ACT_LABELS = {
  semplifica: "Testo semplificato", riassunto: "Riassunto", parole: "Parole chiave", spiega: "Spiegazione",
  traduci: "Traduzione", formulario: "Formulario", esercizio: "Esercizio passo passo",
  linea: "Linea del tempo", confronta: "Confronto"
};
const BUSY_TEXT = {
  spiega: "Preparo la spiegazione…", traduci: "Traduco…", formulario: "Preparo il formulario…",
  esercizio: "Studio l'esercizio…", linea: "Metto in ordine le date…", confronta: "Preparo il confronto…"
};

/** Mostra un risultato: html per lo schermo, md (testo semplice) per ascoltarlo e riusarlo. */
function showResult(title, html, md) {
  lastResult = md;
  $("#resultTitle").textContent = title;
  $("#result").innerHTML = html;
  $("#resultCard").classList.remove("hidden");
  $("#resultCard").scrollIntoView({ behavior: "smooth" });
}

function makeDeck(data, lang = "it") {
  const cards = (data.carte || data.cards || []).filter(c => c.domanda && c.risposta).map(c => ({ q: c.domanda, a: c.risposta, box: 0 }));
  if (!cards.length) throw new Error("Non sono riuscito a creare le carte. Riprova.");
  const deck = { id: uid(), title: data.titolo || "Flashcard", date: todayLabel(), cards, lang, subject: reader.subject || "" };
  const decks = store.get("decks", []);
  decks.unshift(deck);
  store.set("decks", decks);
  flash.refreshDecks(deck.id);
  showView("ripassa");
  ripassa.tab("carte");
  toast(`Creato il mazzo con ${cards.length} carte!`);
}

/* ---------- Disegno dei risultati speciali ---------- */
function renderTimeline(d) {
  const ev = (d.eventi || []).filter(e => e.titolo);
  if (!ev.length) throw new Error("Nel testo non ho trovato date o fasi da mettere in ordine.");
  const html = `<ol class="timeline">${ev.map(e => `<li><div class="tl-date">${escapeHtml(String(e.data || ""))}</div>
    <div class="tl-body"><b>${escapeHtml(e.titolo)}</b>${e.dettaglio ? `<p>${escapeHtml(e.dettaglio)}</p>` : ""}</div></li>`).join("")}</ol>`;
  const md = ev.map(e => `## ${e.data} — ${e.titolo}\n${e.dettaglio || ""}`).join("\n\n");
  return { title: d.titolo ? "Linea del tempo: " + d.titolo : "Linea del tempo", html, md };
}
function renderCompare(d) {
  const cols = d.colonne || [];
  const rows = (d.righe || []).filter(r => r.aspetto && Array.isArray(r.valori));
  if (cols.length < 2 || !rows.length) throw new Error("Nel testo non ho trovato cose da confrontare.");
  const html = `<div class="table-wrap"><table class="compare"><thead><tr><th></th>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr><th>${escapeHtml(r.aspetto)}</th>${cols.map((_, i) => `<td>${escapeHtml(String(r.valori[i] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const md = rows.map(r => `## ${r.aspetto}\n` + cols.map((c, i) => `- **${c}**: ${r.valori[i] ?? ""}`).join("\n")).join("\n\n");
  return { title: d.titolo || "Confronto", html, md };
}
function renderExercise(d) {
  const steps = (d.passi || []).filter(p => p.spiegazione || p.titolo);
  if (!steps.length) throw new Error("Non sono riuscito a capire l'esercizio. Prova con una foto più chiara.");
  const html = `<div class="exercise">
    <div class="ex-box"><b>Esercizio</b><p>${escapeHtml(d.esercizio || "")}</p>
      ${(d.dati || []).length ? `<b>Dati</b><ul>${d.dati.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</div>
    <p class="hint no-print">Prova a fare ogni passo da sola, poi apri il passo dopo per controllare.</p>
    ${steps.map((p, i) => `<div class="ex-step${i ? " hidden" : ""}" data-step="${i}">
      <div class="ex-num">Passo ${i + 1} di ${steps.length}</div><b>${escapeHtml(p.titolo || "")}</b><p>${escapeHtml(p.spiegazione || "")}</p></div>`).join("")}
    <div class="ex-final hidden"><b>Risultato</b><p>${escapeHtml(d.risultato || "")}</p>
      ${d.controllo ? `<b>Controllo</b><p>${escapeHtml(d.controllo)}</p>` : ""}</div>
    <div class="row gap wrap no-print ex-ctrl">
      <button class="btn primary" data-ex="next">Passo successivo</button>
      <button class="btn" data-ex="all">Mostra tutto</button>
    </div></div>`;
  const md = `Esercizio: ${d.esercizio || ""}\n\n` + steps.map((p, i) => `## Passo ${i + 1}: ${p.titolo || ""}\n${p.spiegazione || ""}`).join("\n\n") +
    `\n\n## Risultato\n${d.risultato || ""}` + (d.controllo ? `\n\n## Controllo\n${d.controllo}` : "");
  return { title: "Esercizio passo passo", html, md };
}
function exerciseControl(which, root = $("#result")) {
  const hidden = [...root.querySelectorAll(".ex-step.hidden, .ex-final.hidden")];
  if (which === "all") hidden.forEach(e => e.classList.remove("hidden"));
  else if (hidden[0]) { hidden[0].classList.remove("hidden"); hidden[0].scrollIntoView({ behavior: "smooth", block: "center" }); tts.say(hidden[0].innerText); }
  if (!root.querySelectorAll(".ex-step.hidden, .ex-final.hidden").length) root.querySelector(".ex-ctrl")?.remove();
}

async function chooseTargetLang() {
  return uiDialog({
    title: "In quale lingua traduco?",
    buttons: [{ label: "Annulla", value: null }, ...["en", "fr", "es", "de"].map(k => ({ label: `${LANGS[k].flag} ${LANGS[k].name}`, value: k, primary: k === "en" }))]
  });
}

async function runAction(act, source) {
  const text = source || reader.activeText();
  if (!text) return;
  reader.pause();
  const part = !source && reader.picked.size ? " (parte scelta)" : "";
  try {
    if (act === "interroga") { showView("ripassa"); ripassa.tab("interroga"); return quiz.setSource(text, reader.title()); }
    if (act === "mappa") {
      busy(true, "Sto creando la mappa…");
      const data = parseJSON(await ask({ prompt: PROMPTS.mappa(text), system: SYSTEM_TUTOR, json: true }));
      mindmap.load(normalizeMap(data));
      showView("mappa");
      return;
    }
    if (act === "flashcard") {
      busy(true, "Sto preparando le flashcard…");
      return makeDeck(parseJSON(await ask({ prompt: PROMPTS.flashcard(text), system: SYSTEM_TUTOR, json: true })));
    }
    if (act === "vocaboli") {
      const lang = source ? detectLang(text) : reader.lang;
      if (lang === "it") return toast("«Vocaboli» serve per i testi in inglese, francese, spagnolo o tedesco. Se il testo è straniero, scegli la lingua con il menu 🇮🇹 nel lettore.", 7000);
      busy(true, "Scelgo i vocaboli…");
      return makeDeck(parseJSON(await ask({ prompt: PROMPTS.vocaboli(text, lang), json: true })), lang);
    }
    if (act === "traduci") {
      const from = source ? detectLang(text) : reader.lang;
      const to = from === "it" ? await chooseTargetLang() : "it";
      if (!to) return;
      busy(true, BUSY_TEXT.traduci);
      const out = await ask({ prompt: PROMPTS.traduci(text, from, to), temperature: 0.2 });
      return showResult(ACT_LABELS.traduci + part, `<div class="translation">${mdToHtml(out)}</div>`, out);
    }
    if (act === "linea" || act === "confronta" || act === "esercizio") {
      busy(true, BUSY_TEXT[act]);
      const data = parseJSON(await ask({ prompt: PROMPTS[act](text), system: SYSTEM_TUTOR, json: true, temperature: 0.2 }));
      const r = act === "linea" ? renderTimeline(data) : act === "confronta" ? renderCompare(data) : renderExercise(data);
      return showResult(r.title + part, r.html, r.md);
    }
    busy(true, BUSY_TEXT[act] || "Ci sto pensando…");
    const out = await ask({ prompt: PROMPTS[act](text), system: SYSTEM_TUTOR });
    showResult((ACT_LABELS[act] || "Risultato") + part, mdToHtml(out), out);
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
      toast(added ? `Fatto! ${added} riquadri nuovi hanno il bordo tratteggiato. Con Annulla torni a prima.` : "Fatto! Con Annulla torni a prima.", 6000);
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

  /** Riquadri e collegamenti in SVG. Per la stampa: colori chiari fissi e niente selezione. */
  svgParts({ print = false } = {}) {
    const dark = !print && settings.theme === "scuro";
    const ACC = print ? "#1c2440" : "var(--ink)", ACC_INK = print ? "#ffffff" : "var(--app)";
    let edges = "", boxes = "";
    for (const { n, parent } of this.nodes) {
      const fill = n._depth === 0 ? ACC : (dark ? n._color[1] : n._color[0]);
      const stroke = n._depth === 0 ? ACC : n._color[1];
      const ink = n._depth === 0 ? ACC_INK : (dark ? "#fff" : "#2b2a27");
      if (parent) edges += `<path d="${this.edgePath(parent, n)}" fill="none" stroke="${stroke}" stroke-width="${n._depth === 1 ? 4 : 2.5}" stroke-linecap="round"/>`;
      const tx = n._x + n._w / 2;
      const ty0 = n._y + 10 + n._size;
      const tspans = n._lines.map((l, i) => `<tspan x="${tx}" y="${ty0 + i * n._size * 1.3 - n._size * 0.15}">${escapeHtml(l)}</tspan>`).join("");
      const dash = n.ai ? ` stroke-dasharray="8 5"` : "";
      const sel = !print && n.id === this.selected ? " sel" : "";
      boxes += `<g class="map-node${sel}" data-id="${n.id}" role="button" tabindex="0">
        <rect x="${n._x}" y="${n._y}" width="${n._w}" height="${n._h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${n.ai ? 3 : 2}"${dash}/>
        <text text-anchor="middle" font-family="Atkinson Hyperlegible, Verdana, sans-serif" font-size="${n._size}" font-weight="${n._bold ? 700 : 400}" fill="${ink}">${tspans}</text>
      </g>`;
    }
    return { edges, boxes };
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
    const { edges, boxes } = this.svgParts();
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
      const fill = n._depth === 0 ? "#1c2440" : n._color[0];
      const stroke = n._depth === 0 ? "#1c2440" : n._color[1];
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

  subject: "",
  async save() {
    if (!this.root) return toast("Prima crea una mappa.");
    let subject = this.subject;
    if (!this.savedId) {
      const r = await askSave("Salva la mappa", this.root.text, this.subject || reader.subject);
      if (!r) return;
      subject = this.subject = r.subject;
    }
    const item = { id: this.savedId || uid(), type: "mappa", title: this.root.text, subject, date: todayLabel(), data: cleanMap(this.root) };
    if (notebookPut(item)) { this.savedId = item.id; toast("Mappa salvata nel quaderno"); }
  }
};
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mappa";

/* =========================================================
   10. DETTATURA
   ========================================================= */
/** Registratore riutilizzabile: un pulsante microfono, una scritta di stato, e cosa fare col testo. */
function makeRecorder(btn, statusEl, onText, idleMsg) {
  const r = { rec: null, chunks: [], stream: null, t0: 0, timer: null };
  r.toggle = async () => {
    if (r.rec && r.rec.state === "recording") return r.rec.stop();
    if (!settings.keyGroq) { openSettings(); return toast("Per usare il microfono serve la chiave Groq."); }
    tts.stop();
    try {
      r.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast("Non riesco a usare il microfono. Controlla i permessi del browser.", 5000);
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    r.rec = new MediaRecorder(r.stream, type ? { mimeType: type } : undefined);
    r.chunks = [];
    r.rec.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
    r.rec.onstop = () => r.finish();
    r.rec.start();
    r.t0 = Date.now();
    btn.classList.add("rec");
    btn.setAttribute("aria-label", "Ferma registrazione");
    r.timer = setInterval(() => {
      const sec = Math.floor((Date.now() - r.t0) / 1000);
      statusEl.textContent = `Ti ascolto… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} — tocca per finire`;
      if (sec >= 600) r.rec.stop(); // massimo 10 minuti per registrazione
    }, 300);
  };
  /** ferma senza trascrivere (es. la finestra è stata chiusa) */
  r.cancel = () => { if (r.rec && r.rec.state === "recording") { r.cancelled = true; r.rec.stop(); } };
  r.finish = async () => {
    clearInterval(r.timer);
    r.stream?.getTracks().forEach(t => t.stop());
    btn.classList.remove("rec");
    btn.setAttribute("aria-label", "Avvia registrazione");
    if (r.cancelled) { r.cancelled = false; statusEl.textContent = idleMsg; return; }
    const blob = new Blob(r.chunks, { type: r.rec.mimeType || "audio/webm" });
    if (blob.size < 1200) { statusEl.textContent = "Registrazione troppo corta. Riprova."; return; }
    statusEl.textContent = "Sto scrivendo…";
    try {
      onText(await transcribe(blob));
      statusEl.textContent = idleMsg;
    } catch (e) {
      statusEl.textContent = "Tocca il microfono per riprovare";
      toast(e.message, 6000);
    }
  };
  return r;
}

const dictation = {
  undo: null,
  rec: null,
  toggle() {
    this.rec ||= makeRecorder($("#btnMic"), $("#micStatus"), (text) => {
      const ta = $("#txtDictation");
      ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text;
      store.set("dictation", ta.value);
    }, "Fatto! Tocca il microfono per continuare a dettare.");
    return this.rec.toggle();
  },

  /** Trova gli errori e li spiega, invece di correggerli in silenzio. */
  async explain() {
    const t = $("#txtDictation").value.trim();
    if (!t) return toast("Prima detta o scrivi qualcosa.");
    try {
      busy(true, "Cerco gli errori e preparo le spiegazioni…");
      const d = parseJSON(await ask({ prompt: PROMPTS.spiegaErrori(t), json: true, temperature: 0.1 }));
      const errs = (d.errori || []).filter(e => e.sbagliato && e.corretto && e.sbagliato !== e.corretto);
      this.fixed = d.testo_corretto || "";
      const stats = store.get("errStats", {});
      errs.forEach(e => { const k = e.tipo || "altro"; stats[k] = (stats[k] || 0) + 1; });
      store.set("errStats", stats);
      const card = $("#errCard");
      card.classList.remove("hidden");
      $("#errList").innerHTML = errs.length
        ? errs.map(e => `<li><span class="err-bad">${escapeHtml(e.sbagliato)}</span> → <span class="err-good">${escapeHtml(e.corretto)}</span>
            <small class="err-type">${escapeHtml(e.tipo || "")}</small><p>${escapeHtml(e.regola || "")}</p></li>`).join("")
        : `<li class="hint">Nessun errore trovato. Ottimo lavoro.</li>`;
      $("#btnErrApply").classList.toggle("hidden", !errs.length || !this.fixed);
      this.renderStats();
      card.scrollIntoView({ behavior: "smooth" });
    } catch (e) { toast(e.message || "Non sono riuscito a controllare il testo. Riprova.", 6000); }
    finally { busy(false); }
  },
  applyFix() {
    if (!this.fixed) return;
    this.undo = $("#txtDictation").value;
    $("#txtDictation").value = this.fixed;
    store.set("dictation", this.fixed);
    $("#btnFix").innerHTML = `${icon("undo")}Annulla correzione`;
    $("#btnFix").dataset.undo = "1";
    $("#btnErrApply").classList.add("hidden");
    toast("Correzioni applicate");
  },
  renderStats() {
    const stats = Object.entries(store.get("errStats", {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $("#errStats").innerHTML = stats.length
      ? `<b>I tuoi errori più frequenti:</b> ` + stats.map(([k, n]) => `<span class="chip">${escapeHtml(k)} · ${n}</span>`).join(" ")
      : "";
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
      $("#btnFix").innerHTML = `${icon("undo")}Annulla correzione`;
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
  resetFixBtn() { $("#btnFix").innerHTML = `${icon("check")}Correggi tutto`; delete $("#btnFix").dataset.undo; }
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
      $("#flashFront").innerHTML = "Mazzo finito.<br><small>Tocca la carta per ricominciare</small>";
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
    tts.say(this.flipped ? c.a : c.q, null, this.flipped ? undefined : (this.deck.lang || "it"));
  },

  async remove() {
    if (!this.deck || !(await uiConfirm(`Eliminare il mazzo «${this.deck.title}»?`, "Elimina", true))) return;
    store.set("decks", store.get("decks", []).filter(d => d.id !== this.deck.id));
    this.refreshDecks();
  }
};

/* =========================================================
   11b. RIPASSA: sezioni, interrogazione, piano, timer
   ========================================================= */
const ripassa = {
  current: "carte",
  tab(name) {
    this.current = name;
    $$("#ripSeg button").forEach(b => b.classList.toggle("on", b.dataset.rt === name));
    $$(".rip-pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== name));
    if (name === "interroga") quiz.fillSources();
    if (name === "piano") planner.render();
  }
};

/* ---------- Interrogazione simulata ---------- */
const quiz = {
  source: "", title: "", question: "", asked: [], rec: null,

  fillSources(selectValue) {
    const sel = $("#quizSource");
    const texts = store.get("notebook", []).filter(x => x.type === "testo");
    const opts = [];
    if (this.source && !texts.some(t => t.data === this.source) && this.source !== reader.text) opts.push(["custom", "Testo scelto: " + (this.title || "")]);
    if (reader.text) opts.push(["reader", "Testo aperto in Studia: " + reader.title()]);
    texts.forEach(t => opts.push(["nb:" + t.id, `${t.subject ? t.subject + ": " : ""}${t.title}`]));
    sel.innerHTML = opts.length ? opts.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("")
      : `<option value="">Prima apri un testo in Leggi o salvane uno nel quaderno</option>`;
    if (selectValue) sel.value = selectValue;
  },

  /** Testo su cui interrogare, in base alla scelta nel menu. */
  pick() {
    const v = $("#quizSource").value;
    if (v === "custom") return { text: this.source, title: this.title };
    if (v === "reader") return { text: reader.activeText(), title: reader.title() };
    if (v.startsWith("nb:")) {
      const t = store.get("notebook", []).find(x => x.id === v.slice(3));
      if (t) return { text: t.data, title: t.title };
    }
    return null;
  },

  setSource(text, title) {
    this.source = text; this.title = title; this.asked = [];
    this.fillSources(text === reader.activeText() ? "reader" : "custom");
    toast("Pronta? Premi «Fammi una domanda».");
  },

  async next(expose = false) {
    const src = this.pick();
    if (!src?.text) return toast("Scegli prima su cosa vuoi essere interrogata.");
    if (src.text !== this.source) { this.source = src.text; this.title = src.title; this.asked = []; }
    try {
      if (expose) this.question = `Esponi l'argomento «${src.title}»: di cosa parla, i concetti principali e come sono collegati.`;
      else {
        busy(true, "Preparo una domanda…");
        const d = parseJSON(await ask({ prompt: PROMPTS.domanda(src.text, this.asked.slice(-8)), json: true, temperature: 0.8 }));
        this.question = d.domanda || "Di cosa parla questo argomento?";
      }
      this.asked.push(this.question);
      $("#quizQuestion").textContent = this.question;
      $("#quizAnswer").value = "";
      $("#quizFeedback").classList.add("hidden");
      $("#quizQ").classList.remove("hidden");
      $("#quizQ").scrollIntoView({ behavior: "smooth" });
      tts.say(this.question, null, "it");
    } catch (e) { toast(e.message || "Non sono riuscito a fare la domanda. Riprova.", 6000); }
    finally { busy(false); }
  },

  mic() {
    this.rec ||= makeRecorder($("#btnQuizMic"), $("#quizMicStatus"), (text) => {
      const ta = $("#quizAnswer");
      ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text;
    }, "Puoi continuare a parlare, oppure premi «Com'è andata?»");
    this.rec.toggle();
  },

  async check() {
    const answer = $("#quizAnswer").value.trim();
    if (!answer) return toast("Prima rispondi a voce o scrivi la risposta.");
    try {
      busy(true, "Ascolto la tua risposta…");
      const d = parseJSON(await ask({ prompt: PROMPTS.valuta(this.source, this.question, answer), json: true, temperature: 0.3 }));
      const LV = { ottimo: ["check", "Ottimo", "good"], buono: ["check", "Buona risposta", "good"], sufficiente: ["bulb", "Sufficiente", "mid"], "da rivedere": ["book", "Da rivedere", "bad"] };
      const [ico, label, cls] = LV[d.livello] || LV.sufficiente;
      const list = (arr, cls2) => (arr || []).length ? `<ul class="${cls2}">${arr.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : "";
      $("#quizFeedback").innerHTML = `
        <div class="quiz-level ${cls}">${icon(ico)} ${label}</div>
        ${(d.bene || []).length ? `<h3>Cosa hai detto bene</h3>${list(d.bene, "fb-good")}` : ""}
        ${(d.manca || []).length ? `<h3>Cosa mancava</h3>${list(d.manca, "fb-miss")}` : ""}
        ${(d.errori || []).length ? `<h3>Da correggere</h3>${list(d.errori, "fb-err")}` : ""}
        ${d.risposta_modello ? `<h3>Una risposta completa</h3><p class="model">${escapeHtml(d.risposta_modello)}</p>` : ""}
        ${d.consiglio ? `<p class="tip"><b>Consiglio:</b> ${escapeHtml(d.consiglio)}</p>` : ""}
        <div class="row gap wrap">
          <button class="btn" id="btnFbRead">${icon("volume")}Ascolta</button>
          <button class="btn" id="btnFbRetry">${icon("undo")}Riprova questa</button>
          <button class="btn primary" id="btnFbNext">${icon("shuffle")}Altra domanda</button>
        </div>`;
      const fb = $("#quizFeedback");
      fb.classList.remove("hidden");
      fb.scrollIntoView({ behavior: "smooth" });
      $("#btnFbRead").onclick = () => tts.say(fb.innerText.replace(/Ascolta|Riprova questa|Altra domanda/g, ""), null, "it");
      $("#btnFbRetry").onclick = () => { $("#quizAnswer").value = ""; fb.classList.add("hidden"); $("#quizQ").scrollIntoView({ behavior: "smooth" }); };
      $("#btnFbNext").onclick = () => this.next();
    } catch (e) { toast(e.message || "Non sono riuscito a valutare. Riprova.", 6000); }
    finally { busy(false); }
  }
};

/* ---------- Piano verso la verifica ---------- */
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (iso) => new Date(iso + "T12:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);

const planner = {
  async create() {
    const subject = $("#planSubject").value.trim() || "la materia";
    const date = $("#planDate").value;
    const topics = $("#planTopics").value.trim();
    const minutes = Number($("#planMinutes").value);
    const today = isoDay(new Date());
    if (!date) return toast("Scegli la data della verifica.");
    if (date <= today) return toast("La data della verifica deve essere dopo oggi.");
    if (!topics) return toast("Scrivi cosa devi studiare.");
    const days = [];
    for (let d = new Date(today + "T12:00"); isoDay(d) < date && days.length < 30; d.setDate(d.getDate() + 1)) days.push(isoDay(d));
    let sessions;
    try {
      busy(true, "Preparo il piano…");
      const out = parseJSON(await ask({ prompt: PROMPTS.piano(subject, topics, days, minutes), json: true, temperature: 0.3 }));
      sessions = (out.sessioni || []).map((x, i) => ({ date: days.includes(x.data) ? x.data : days[Math.min(i, days.length - 1)], items: (x.attivita || []).map(t => ({ t: String(t), done: false })) }))
        .filter(x => x.items.length);
      if (!sessions.length) throw new Error();
    } catch {
      sessions = this.simplePlan(topics, days);
      toast("Ho creato un piano semplice senza IA: puoi comunque usarlo.");
    } finally { busy(false); }
    // unisco eventuali giorni doppi e metto in ordine
    const byDay = {};
    sessions.forEach(x => { (byDay[x.date] ||= []).push(...x.items); });
    const plan = { id: uid(), subject, date, minutes, topics, created: today,
      sessions: Object.keys(byDay).sort().map(d => ({ date: d, items: byDay[d] })) };
    const plans = store.get("plans", []);
    plans.unshift(plan);
    store.set("plans", plans);
    $("#planTopics").value = "";
    this.render();
    $("#planList").scrollIntoView({ behavior: "smooth" });
  },

  /** Piano di riserva, senza IA: un argomento al giorno e ripasso finale. */
  simplePlan(topics, days) {
    const parts = topics.split(/\n|;|,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
    const study = days.length > 1 ? days.slice(0, -1) : days;
    const sessions = study.map(d => ({ date: d, items: [] }));
    parts.forEach((p, i) => {
      const s = sessions[i % sessions.length];
      s.items.push({ t: `Leggi e ascolta: ${p}`, done: false }, { t: `Fai la mappa: ${p}`, done: false });
    });
    if (days.length > 1) sessions.push({ date: days[days.length - 1], items: [
      { t: "Ripassa tutte le mappe", done: false }, { t: "Flashcard di tutti gli argomenti", done: false }, { t: "Interrogazione simulata", done: false }] });
    return sessions.filter(s => s.items.length);
  },

  render() {
    const plans = store.get("plans", []);
    const today = isoDay(new Date());
    const box = $("#planList");
    if (!plans.length) { box.innerHTML = ""; return; }
    // prima le verifiche future, poi quelle passate
    plans.sort((a, b) => (a.date < today) - (b.date < today) || a.date.localeCompare(b.date));
    box.innerHTML = plans.map(p => {
      const all = p.sessions.flatMap(s => s.items);
      const done = all.filter(i => i.done).length;
      const left = daysBetween(today, p.date);
      const when = left > 1 ? `tra ${left} giorni` : left === 1 ? "domani!" : left === 0 ? "oggi!" : "passata";
      return `<div class="card plan${left < 0 ? " past" : ""}" data-plan="${p.id}">
        <div class="row between wrap gap">
          <h2>${escapeHtml(p.subject)} <span class="plan-when">${escapeHtml(when)}</span></h2>
          <div class="row"><button class="icon-btn" data-pp="print" aria-label="Stampa">${icon("printer")}</button><button class="icon-btn" data-pp="del" aria-label="Elimina">${icon("trash")}</button></div>
        </div>
        <p class="hint">Verifica: ${escapeHtml(dayLabel(p.date))} · ${done} attività fatte su ${all.length}</p>
        <div class="progress"><div style="width:${all.length ? done / all.length * 100 : 0}%"></div></div>
        ${p.sessions.map((s, si) => `<div class="plan-day${s.date === today ? " today" : s.date < today ? " gone" : ""}">
          <div class="plan-date">${s.date === today ? "Oggi" : escapeHtml(dayLabel(s.date))}</div>
          ${s.items.map((it, ii) => `<label class="plan-item"><input type="checkbox" data-si="${si}" data-ii="${ii}"${it.done ? " checked" : ""}> <span>${escapeHtml(it.t)}</span></label>`).join("")}
        </div>`).join("")}
      </div>`;
    }).join("");
  },

  toggle(planId, si, ii, done) {
    const plans = store.get("plans", []);
    const p = plans.find(x => x.id === planId);
    if (!p) return;
    p.sessions[si].items[ii].done = done;
    store.set("plans", plans);
    const all = p.sessions.flatMap(s => s.items);
    if (all.every(i => i.done)) toast("Piano completato: sei pronta per la verifica.", 5000);
    this.render();
  },

  async remove(planId) {
    if (!(await uiConfirm("Eliminare questo piano?", "Elimina", true))) return;
    store.set("plans", store.get("plans", []).filter(x => x.id !== planId));
    this.render();
  },

  print(planId) {
    const p = store.get("plans", []).find(x => x.id === planId);
    if (!p) return;
    const html = p.sessions.map(s => `<h3>${escapeHtml(dayLabel(s.date))}</h3><ul class="print-check">${s.items.map(i => `<li>${i.done ? "☑" : "☐"} ${escapeHtml(i.t)}</li>`).join("")}</ul>`).join("");
    printer.run(`<div class="print-text"><p>Verifica: <b>${escapeHtml(dayLabel(p.date))}</b></p>${html}</div>`, { title: "Piano di studio: " + p.subject });
  }
};

/* ---------- Timer di studio (studio + pausa) ---------- */
const timer = {
  end: 0, left: 0, phase: "idle", tick: null,   // phase: idle | study | break | paused-study | paused-break
  fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; },
  start(phase = "study", minutes) {
    const m = minutes ?? (phase === "study" ? Number($("#timerLen").value) : 5);
    this.phase = phase;
    this.end = Date.now() + m * 60000;
    clearInterval(this.tick);
    this.tick = setInterval(() => this.update(), 500);
    this.update();
  },
  toggle() {
    if (this.phase === "idle") return this.start("study");
    if (this.phase.startsWith("paused-")) { const ph = this.phase.slice(7); this.phase = ph; this.end = Date.now() + this.left; this.tick = setInterval(() => this.update(), 500); return this.update(); }
    this.left = this.end - Date.now(); this.phase = "paused-" + this.phase; clearInterval(this.tick); this.update();
  },
  stop() { clearInterval(this.tick); this.phase = "idle"; this.update(); },
  update() {
    const running = this.phase === "study" || this.phase === "break";
    const ms = running ? this.end - Date.now() : this.phase === "idle" ? Number($("#timerLen").value) * 60000 : this.left;
    const t = this.fmt(ms);
    const label = { idle: "Timer di studio", study: "Studio", break: "Pausa", "paused-study": "Studio in pausa", "paused-break": "Pausa ferma" }[this.phase];
    $("#timerDisplay").textContent = t;
    $("#timerLabel").textContent = label;
    $("#btnTimer").textContent = running ? "Pausa" : this.phase === "idle" ? "Avvia" : "Riprendi";
    const chip = $("#timerChip");
    chip.classList.toggle("hidden", this.phase === "idle");
    chip.textContent = (this.phase.includes("break") ? "Pausa " : "Studio ") + t;
    if (running && ms <= 0) this.ring();
  },
  ring() {
    clearInterval(this.tick);
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(d => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 660; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.25, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.3); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.3); });
    } catch { /* niente suono */ }
    navigator.vibrate?.([300, 150, 300]);
    if (this.phase === "study") {
      toast("⏰ Bravissima! Ora 5 minuti di pausa: alzati e muoviti un po'.", 7000);
      tts.say("Bravissima! Ora cinque minuti di pausa.", null, "it");
      this.start("break", 5);
    } else {
      toast("⏰ Fine pausa! Quando sei pronta, premi Avvia.", 7000);
      tts.say("Fine della pausa. Quando sei pronta, ricomincia.", null, "it");
      this.stop();
    }
  }
};

/* =========================================================
   12. QUADERNO
   ========================================================= */
/** Aggiunge (o aggiorna) un elemento nel quaderno. */
function notebookPut(item) {
  const nb = store.get("notebook", []);
  const i = nb.findIndex(x => x.id === item.id);
  if (i >= 0) nb[i] = item; else nb.unshift(item);
  return store.set("notebook", nb);
}

async function saveCurrentText() {
  if (!reader.text) return;
  const r = await askSave("Salva nel quaderno", reader.title(), reader.subject);
  if (!r) return;
  reader.subject = r.subject;
  if (notebookPut({ id: uid(), type: "testo", title: r.title, subject: r.subject, date: todayLabel(), data: reader.text })) toast("Salvato nel quaderno");
}

let nbFilter = "";
function renderNotebook() {
  const nb = store.get("notebook", []);
  const decks = store.get("decks", []);
  const items = [
    ...nb,
    ...decks.map(d => ({ id: d.id, type: "flashcard", title: d.title, date: d.date || "", subject: d.subject || "" }))
  ];
  // filtro per materia
  const subs = [...new Set(items.map(x => x.subject).filter(Boolean))].sort();
  if (nbFilter && !subs.includes(nbFilter) && nbFilter !== "-") nbFilter = "";
  const hasNone = items.some(x => !x.subject);
  $("#nbFilter").innerHTML = subs.length
    ? [["", "Tutto"], ...subs.map(x => [x, x]), ...(hasNone ? [["-", "Senza materia"]] : [])]
        .map(([v, l]) => `<button class="chip${v === nbFilter ? " on" : ""}" data-sub="${escapeHtml(v)}">${escapeHtml(l)}</button>`).join("")
    : "";
  const shown = items.filter(x => !nbFilter || (nbFilter === "-" ? !x.subject : x.subject === nbFilter));
  const icons = { testo: "file", mappa: "map", flashcard: "cards" };
  const ul = $("#notebook");
  if (!items.length) { ul.innerHTML = `<li class="hint">Il quaderno è vuoto. Quando apri un testo o una mappa, premi Salva per ritrovarli qui.</li>`; return; }
  ul.innerHTML = shown.map(it => `
    <li data-id="${it.id}" data-type="${it.type}">
      <span class="nb-ico" aria-hidden="true">${icon(icons[it.type])}</span>
      <span class="t">${escapeHtml(it.title)}<small>${it.subject ? `<span class="tag">${escapeHtml(it.subject)}</span> ` : ""}${it.type} · ${escapeHtml(it.date || "")}</small></span>
      <button class="icon-btn" data-tag aria-label="Cambia materia">${icon("tag")}</button>
      <button class="icon-btn" data-del aria-label="Elimina">${icon("trash")}</button>
    </li>`).join("");
}

async function tagNotebookItem(id, type) {
  const key = type === "flashcard" ? "decks" : "notebook";
  const list = store.get(key, []);
  const it = list.find(x => x.id === id);
  if (!it) return;
  const r = await uiDialog({ title: "Di che materia è?", input: null, subject: it.subject || "",
    buttons: [{ label: "Annulla", value: null }, { label: "OK", value: "ok", primary: true }] });
  if (r !== "ok") return;
  it.subject = $("#askSubject").value.trim();
  store.set(key, list);
  renderNotebook();
}

function openNotebookItem(id, type) {
  if (type === "flashcard") { flash.refreshDecks(id); showView("ripassa"); return ripassa.tab("carte"); }
  const it = store.get("notebook", []).find(x => x.id === id);
  if (!it) return;
  if (type === "testo") { reader.load(it.data); reader.subject = it.subject || ""; showView("leggi"); }
  if (type === "mappa") { mindmap.load(it.data, it.id); mindmap.subject = it.subject || ""; showView("mappa"); }
}

async function deleteNotebookItem(id, type) {
  if (!(await uiConfirm("Eliminare questo elemento dal quaderno?", "Elimina", true))) return;
  if (type === "flashcard") store.set("decks", store.get("decks", []).filter(d => d.id !== id));
  else store.set("notebook", store.get("notebook", []).filter(x => x.id !== id));
  renderNotebook();
}

function exportBackup() {
  const data = { app: "studio-facile", version: 1, date: new Date().toISOString(),
    notebook: store.get("notebook", []), decks: store.get("decks", []), plans: store.get("plans", []), errStats: store.get("errStats", {}) };
  download(`zaino-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1), "application/json");
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
    merge("plans", data.plans);
    if (data.errStats) {
      const st = store.get("errStats", {});
      for (const [k, n] of Object.entries(data.errStats)) st[k] = Math.max(st[k] || 0, n);
      store.set("errStats", st);
    }
    renderNotebook(); flash.refreshDecks();
    toast("Backup caricato");
  } catch { toast("Questo file non è un backup valido."); }
}

/* =========================================================
   12b. STAMPA (mappe, testi, riassunti, flashcard)
   ========================================================= */
const printer = {
  run(html, { title = "Zaino", landscape = false, head = true } = {}) {
    const area = $("#printArea");
    area.innerHTML = (head ? `<div class="print-head"><b>${escapeHtml(title)}</b><span>${todayLabel()}</span></div>` : "") + html;
    $("#printPage").textContent = `@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: ${head ? 12 : 8}mm; }`;
    const oldTitle = document.title;
    document.title = title; // diventa il nome del PDF se si sceglie "Salva come PDF"
    const done = () => { document.title = oldTitle; removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(() => window.print(), 80));
  },

  text(text, title) {
    if (!text) return toast("Non c'è niente da stampare.");
    this.run(`<div class="print-text">${mdToHtml(text)}</div>`, { title });
  },

  map() {
    const m = mindmap;
    if (!m.root) return toast("Prima crea una mappa.");
    const { width, height } = m.size = m.computeLayout();
    const { edges, boxes } = m.svgParts({ print: true });
    const landscape = width >= height;
    const svg = `<svg class="print-map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${edges}${boxes}</svg>`;
    const legend = JSON.stringify(cleanMap(m.root)).includes('"ai":true') ? `<p class="print-note">Bordo tratteggiato = aggiunto dall'IA</p>` : "";
    this.run(svg + legend, { title: m.root.text, landscape });
  },

  deck() {
    const d = flash.deck;
    if (!d) return toast("Scegli prima un mazzo.");
    const rows = d.cards.map((c, i) => `<tr><td class="n">${i + 1}</td><td>${escapeHtml(c.q)}</td><td>${escapeHtml(c.a)}</td></tr>`).join("");
    this.run(`<p class="print-note">Piega il foglio lungo la linea tratteggiata: leggi la domanda e prova a rispondere prima di guardare.</p>
      <table class="print-cards"><thead><tr><th></th><th>Domanda</th><th>Risposta</th></tr></thead><tbody>${rows}</tbody></table>`, { title: d.title });
  }
};

/* =========================================================
   12c. SCHERMATA INIZIALE, GUIDA, BENVENUTO
   ========================================================= */
const home = {
  render() {
    const today = isoDay(new Date());
    // oggi nel piano
    const plans = store.get("plans", []).filter(p => p.date >= today);
    const todayItems = [];
    plans.forEach(p => p.sessions.forEach((s, si) => { if (s.date === today) s.items.forEach((it, ii) => todayItems.push({ p, si, ii, it })); }));
    const next = plans.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
    const t = $("#homeToday");
    if (todayItems.length) {
      t.innerHTML = `<h2>${icon("calendar")}Oggi nel piano</h2><ul>${todayItems.map(({ p, si, ii, it }) =>
        `<li><label class="p-item"><input type="checkbox" data-plan="${p.id}" data-si="${si}" data-ii="${ii}"${it.done ? " checked" : ""}><span>${escapeHtml(it.t)}<small>${escapeHtml(p.subject)}</small></span></label></li>`).join("")}</ul>`;
    } else if (next) {
      const left = daysBetween(today, next.date);
      t.innerHTML = `<h2>${icon("calendar")}Prossima verifica</h2><ul><li><button class="p-item" data-go="piano"><span>${escapeHtml(next.subject)}<small>${left === 1 ? "domani" : "tra " + left + " giorni"}: oggi niente in programma</small></span></button></li></ul>`;
    } else {
      t.innerHTML = `<h2>${icon("calendar")}Hai una verifica in arrivo?</h2><p class="hint">Dimmi la data e cosa studiare: preparo un piano giorno per giorno, a piccoli passi.</p><button class="btn small" data-go="piano">Crea un piano</button>`;
    }
    t.classList.remove("hidden");
    // da riprendere
    const r = $("#homeRecent");
    const nb = store.get("notebook", []).slice(0, 4);
    const ico = { testo: "file", mappa: "map" };
    r.innerHTML = nb.length
      ? `<h2>${icon("library")}Da riprendere</h2><ul>${nb.map(x => `<li><button class="p-item" data-open="${x.id}" data-type="${x.type}">${icon(ico[x.type] || "file")}<span>${escapeHtml(x.title)}<small>${x.subject ? escapeHtml(x.subject) + ", " : ""}${escapeHtml(x.date || "")}</small></span></button></li>`).join("")}</ul>
         <button class="btn small ghost" data-go="quaderno">Apri il quaderno</button>`
      : `<h2>${icon("library")}Il tuo quaderno</h2><p class="hint">Testi, mappe e flashcard che salvi li ritrovi qui, pronti da riprendere.</p>`;
    r.classList.remove("hidden");
  },
  bind() {
    $("#homePanels").addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { if (go.dataset.go === "piano") { showView("ripassa"); ripassa.tab("piano"); } else showView(go.dataset.go); return; }
      const op = e.target.closest("[data-open]");
      if (op) openNotebookItem(op.dataset.open, op.dataset.type);
    });
    $("#homePanels").addEventListener("change", (e) => {
      const c = e.target.closest("input[data-plan]");
      if (c) { planner.toggle(c.dataset.plan, +c.dataset.si, +c.dataset.ii, c.checked); this.render(); }
    });
  }
};

const GUIDE = [
  ["Come si usa", null, [
    ["book", "1. Porta il testo", "In Studia fotografa una pagina, carica una foto o un PDF, oppure incolla un testo."],
    ["volume", "2. Ascoltalo", "Premi il tasto blu: la voce legge e la frase si colora come con un evidenziatore. Tocca una frase per partire da lì."],
    ["sparkles", "3. Trasformalo", "Sotto il testo scegli cosa ti serve: riassunto, mappa, linea del tempo, flashcard e altro."],
    ["chat", "4. Mettiti alla prova", "In Ripassa: flashcard, interrogazione a voce e piano verso la verifica."]
  ]],
  ["Studia", "Il lettore e gli strumenti sul testo.", [
    ["play", "Leggi ad alta voce", "Avvia e mette in pausa la lettura. Accanto: ferma e velocità della voce."],
    ["languages", "Lingua", "La voce si adatta da sola alla lingua del testo. Se sbaglia, scegli qui italiano, inglese, francese, spagnolo o tedesco."],
    ["ruler", "Righello", "Scurisce la pagina e lascia in luce solo la riga che stai leggendo."],
    ["scissors", "Scegli parte", "Tocca le frasi che ti servono: gli strumenti lavoreranno solo su quelle. Puoi anche selezionare il testo tenendo premuto."],
    ["pencil", "Modifica", "Correggi a mano il testo, per esempio se la foto è stata letta male."],
    ["bookmark", "Salva", "Mette il testo nel quaderno, con la materia."],
    ["printer", "Stampa", "Stampa il testo con il carattere e le spaziature che hai scelto. Puoi anche salvarlo come PDF."],
    ["x", "Chiudi", "Chiude il testo per iniziarne un altro."],
    ["feather", "Semplifica", "Riscrive il testo con frasi brevi e parole chiare, tenendo i termini da sapere."],
    ["bulb", "Spiegami", "Una spiegazione passo passo, con un esempio e tre domande per capire se hai capito."],
    ["key", "Parole chiave", "I termini importanti, ognuno con una spiegazione semplice."],
    ["languages", "Traduci", "Testo straniero: originale e traduzione affiancati. Testo italiano: lo traduce nella lingua che scegli."],
    ["list", "Riassunto", "I punti principali e cosa ricordare per la verifica."],
    ["map", "Mappa", "Crea la mappa concettuale e la apre in Mappe, dove puoi modificarla."],
    ["timeline", "Linea del tempo", "Le date e gli eventi in ordine. Utile per storia e scienze."],
    ["columns", "Confronta", "Una tabella con somiglianze e differenze (es. Atene e Sparta)."],
    ["chat", "Interrogami", "Ti porta all'interrogazione simulata su questo testo."],
    ["cards", "Flashcard", "Carte domanda e risposta per ripassare."],
    ["type", "Vocaboli", "Solo per i testi stranieri: le parole utili con traduzione e pronuncia."],
    ["sigma", "Formulario", "Le formule del capitolo su una pagina da stampare."],
    ["steps", "Esercizio passo passo", "Ti guida un passo alla volta: prova da sola, poi apri il passo dopo."]
  ]],
  ["Scrivi", "Per temi, risposte e appunti.", [
    ["mic", "Microfono", "Tocca e parla. Tocca di nuovo per finire: il testo compare sotto. Puoi dettare anche la punteggiatura («virgola», «punto»)."],
    ["spell", "Spiegami gli errori", "Trova gli errori e ti spiega la regola con un trucco per ricordarla. Tiene il conto degli errori che fai più spesso."],
    ["check", "Correggi tutto", "Corregge il testo in un colpo. Con «Annulla correzione» torni indietro."],
    ["volume", "Rileggi", "Ti legge ad alta voce quello che hai scritto: aiuta a trovare gli errori."]
  ]],
  ["Mappe", "Mappe concettuali da costruire o da far preparare.", [
    ["pencil", "Faccio io la mappa", "Scrivi l'argomento al centro e aggiungi le idee una alla volta."],
    ["sparkles", "Migliora con l'IA", "Controlla la tua mappa: corregge gli errori e aggiunge ciò che manca. I riquadri aggiunti sono tratteggiati."],
    ["branch", "Tocca un riquadro", "Compare una barra: Ascolta, Scrivi, Sotto (idea collegata), Accanto (stesso livello), Su, Giù, Togli."],
    ["undo", "Annulla", "Torna indietro di una modifica alla volta."],
    ["swap", "Cambia forma", "Rami a destra e sinistra, oppure tutti a destra."],
    ["mic", "Detta invece di scrivere", "In ogni finestra in cui scrivi (riquadri della mappa, titoli, nomi) c'è il microfono: tocca, parla e tocca di nuovo."],
    ["present", "Schede", "Trasforma la mappa in schede di studio: una per ramo, da sfogliare, ascoltare e stampare. L'IA può aggiungere a ogni scheda una spiegazione breve e la frase da ricordare."],
    ["printer", "Stampa", "Stampa la mappa intera su un foglio A4 orizzontale."],
    ["bookmark", "Salva e immagine", "Salva la mappa nel quaderno o scaricala come immagine."]
  ]],
  ["Mate", "Strumenti per matematica e fisica.", [
    ["calc", "Calcolatrice", "Grandi tasti, legge il calcolo e il risultato ad alta voce, ricorda gli ultimi calcoli. Mostra anche la frazione quando c'è."],
    ["equal", "Equazioni", "Equazioni di 1° e 2° grado, con tutti i passaggi spiegati (anche Δ)."],
    ["graph", "Grafici", "Disegna fino a tre funzioni. Trascina per spostarti, tocca la curva per leggere un punto."],
    ["scale", "Unità", "Converte le unità di misura e mostra la scala: quanti gradini, se moltiplicare o dividere, dove va la virgola."],
    ["sigma", "Formule", "Formulario pronto: geometria, potenze, equazioni, percentuali, piano cartesiano, goniometria, fisica. Si stampa."],
    ["grid", "Tabelline", "La tavola pitagorica: tocca un numero per sentire l'operazione."],
    ["camera", "Da foto", "Fotografa un esercizio e risolvetelo insieme, un passo alla volta."]
  ]],
  ["Filosofia e Scienze umane", "Gli autori, le idee e i collegamenti. Si aprono da Materie, in basso.", [
    ["timeline", "Autori", "Gli autori in ordine di tempo, divisi per periodo (filosofia) o per disciplina (pedagogia, psicologia, sociologia, antropologia). Puoi cercare per nome."],
    ["file", "Scheda autore", "Tocca un nome: contesto, vita, il pensiero in punti, un esempio, le parole chiave, le opere, i collegamenti, una frase celebre e le domande da interrogazione. Viene salvata: la seconda volta si apre subito."],
    ["map", "Dalla scheda", "Con un tocco ne fai una mappa, le flashcard o un'interrogazione simulata, oppure la salvi e la stampi."],
    ["columns", "Confronta", "Scegli due autori e ottieni una tabella con somiglianze e differenze."],
    ["chat", "Chiedi all'autore", "Fai domande a Kant, Socrate, Piaget o Montessori: rispondono in prima persona, in modo semplice. È una simulazione, quindi controlla sempre sul libro."],
    ["bulb", "Concetti", "Una parola o un'idea che non ti è chiara, spiegata con un esempio e con la differenza dai concetti simili."]
  ]],
  ["Fisica", "La materia più temuta, un passo alla volta.", [
    ["sigma", "Formule", "Scegli una formula e cosa devi trovare: Zaino scrive la formula inversa, converte le unità (km/h, minuti, grammi…) e fa la sostituzione passo per passo. Ogni grandezza ha il suo colore."],
    ["steps", "Problemi", "Fotografa il problema: ottieni la tabella dei dati con le conversioni, l'incognita evidenziata, la formula giusta e i passaggi uno alla volta."],
    ["activity", "Simula", "Guarda un'auto muoversi mentre si disegnano i grafici spazio-tempo e velocità-tempo. Oppure somma due forze e guarda la risultante."],
    ["scale", "Unità e prefissi", "Notazione scientifica spiegata con la virgola che si sposta, prefissi (kilo, milli, micro…), grandezze del Sistema Internazionale e costanti."]
  ]],
  ["Ripassa", "Per prepararti alle verifiche.", [
    ["cards", "Flashcard", "Gira la carta, poi dimmi se la sapevi. Quelle sbagliate tornano più spesso."],
    ["chat", "Interrogami", "Una domanda come in classe, tu rispondi a voce. Poi vedi cosa hai detto bene, cosa mancava e una risposta completa."],
    ["calendar", "Piano", "Inserisci data e argomenti: ottieni un programma giorno per giorno con le attività da spuntare."],
    ["timer", "Timer", "25 minuti di studio, poi 5 di pausa. Resta visibile in alto anche se cambi sezione."]
  ]],
  ["Quaderno e impostazioni", "", [
    ["library", "Quaderno", "In alto a destra: tutto quello che hai salvato, diviso per materia."],
    ["tag", "Materia", "Cambia la materia di un elemento del quaderno."],
    ["sliders", "Impostazioni", "Carattere, grandezza, spaziature, colore della pagina, voce, chiavi e backup."],
    ["help", "Guida", "Questa pagina. La trovi sempre in alto."]
  ]]
];
const guide = {
  open(section = 0) {
    $("#guideSeg").innerHTML = GUIDE.map(([t], i) => `<button data-g="${i}"${i === section ? ' class="on"' : ""}>${t}</button>`).join("");
    this.show(section);
    $("#dlgGuide").showModal();
  },
  show(i) {
    const [title, lead, rows] = GUIDE[i];
    $$("#guideSeg button").forEach(b => b.classList.toggle("on", +b.dataset.g === i));
    $("#guideBody").innerHTML = (lead ? `<p class="lead">${escapeHtml(lead)}</p>` : "") +
      rows.map(([ic, n, d]) => `<div class="g-row"><span class="tile">${icon(ic)}</span><div><b>${escapeHtml(n)}</b><span>${escapeHtml(d)}</span></div></div>`).join("");
  },
  /** sezione della guida adatta a dove ci si trova */
  forView() {
    const v = $(".view.active")?.id.replace("view-", "");
    return { leggi: 1, detta: 2, mappa: 3, mate: 4, filo: 5, umane: 5, fisica: 6, ripassa: 7, quaderno: 8 }[v] ?? 0;
  }
};

const WELCOME = [
  { tiles: ["camera", "volume", "book"], title: "Ciao, questo è Zaino", text: `Il posto dove porti libri e compiti. Fotografi una pagina e Zaino te la <span class="hl">legge ad alta voce</span>, evidenziando la frase che stai ascoltando.` },
  { tiles: ["list", "map", "timeline"], title: "Lo studio, più leggero", text: `Da ogni testo ottieni in un tocco <span class="hl">riassunti, mappe, linee del tempo</span> e spiegazioni passo passo. Le mappe puoi farle anche tu: l'IA le controlla.` },
  { tiles: ["chat", "calendar", "layers"], title: "Pronta per le verifiche", text: `Interrogazione simulata a voce, flashcard e piano di studio con timer. In <b>Materie</b> trovi <span class="hl">filosofia e scienze umane</span> con le schede degli autori, e strumenti per <span class="hl">matematica e fisica</span>.` },
  { tiles: ["sliders", "help"], title: "Fallo tuo", text: `Nelle impostazioni scegli carattere, grandezza e colore della pagina. Il tasto <b>?</b> in alto apre la guida in qualsiasi momento.` }
];
const welcome = {
  i: 0,
  open() { this.i = 0; this.show(); $("#dlgWelcome").showModal(); },
  show() {
    const w = WELCOME[this.i];
    $("#welcomeBody").innerHTML = `<div class="welcome-art">${w.tiles.map((t, k) => `<span class="tile${k === 0 ? " t-pen" : ""}">${icon(t)}</span>`).join("")}</div><h2>${w.title}</h2><p>${w.text}</p>`;
    $("#welcomeDots").innerHTML = WELCOME.map((_, k) => `<span${k === this.i ? ' class="on"' : ""}></span>`).join("");
    $("#btnWelcomeNext").textContent = this.i === WELCOME.length - 1 ? "Inizia" : "Avanti";
  },
  next() {
    if (this.i < WELCOME.length - 1) { this.i++; return this.show(); }
    $("#dlgWelcome").close();
    store.set("welcomed", true);
    if (!settings.keyGemini && !settings.keyGroq) {
      openSettings();
      toast("Ultimo passo: inserisci le chiavi gratuite di Gemini e Groq.", 6000);
    }
  }
};

/* =========================================================
   13. NAVIGAZIONE E IMPOSTAZIONI (interfaccia)
   ========================================================= */
function showView(name) {
  tts.stop();
  if (name === "materie") name = store.get("lastSubject", "filo");
  const view = $("#view-" + name);
  const inMaterie = view?.dataset.group === "materie";
  if (inMaterie) store.set("lastSubject", name);
  $$(".view").forEach(v => v.classList.toggle("active", v === view));
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name || (inMaterie && t.dataset.view === "materie")));
  $("#subjNav").classList.toggle("hidden", !inMaterie);
  $$("#subjNav button").forEach(b => b.classList.toggle("on", b.dataset.view === name));
  if (name === "quaderno") renderNotebook();
  if (name === "leggi" && !reader.text) home.render();
  if (name === "mate") requestAnimationFrame(() => graph.draw());
  if (name === "fisica") requestAnimationFrame(() => fisica.inited.simula && sim.redraw());
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
  $("#modGroqVision").value = settings.modGroqVision;
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
    modWhisper: ["#modWhisper", v => v.trim() || DEFAULTS.modWhisper],
    modGroqVision: ["#modGroqVision", v => { groqVisionModel = null; return v.trim(); }]
  };
  for (const [key, [sel, conv = v => v]] of Object.entries(map)) {
    $(sel).addEventListener("input", (e) => {
      settings[key] = conv(e.target.value);
      saveSettings(); applySettings();
      if (["font", "size", "letter", "line"].includes(key) && mindmap.root) mindmap.draw();
    });
  }
  $("#setSyllables").addEventListener("change", (e) => {
    settings.syllables = e.target.checked; saveSettings(); reader.render(); reader.setPicked(reader.picked);
  });
  $("#setTheme").addEventListener("change", () => mindmap.root && mindmap.draw());
  $("#btnVoiceTest").addEventListener("click", () => tts.say("Ciao! Questa è la voce che leggerà i tuoi testi."));
  $("#btnLoadModels").addEventListener("click", loadModels);
  $("#btnExport").addEventListener("click", exportBackup);
  // importazione backup
  const imp = document.createElement("label");
  imp.className = "btn small";
  imp.style.cursor = "pointer";
  imp.innerHTML = `${icon("arrow-up")}Carica backup<input type="file" accept="application/json,.json" hidden>`;
  $("#backupRow").appendChild(imp);
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
const APP_VERSION = "11";

function init() {
  if (!versionGuard()) return;
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
  $("#askMic").addEventListener("click", askMicToggle);
  $("#btnNotebook").addEventListener("click", () => showView("quaderno"));
  $("#btnHelp").addEventListener("click", () => guide.open(guide.forView()));
  $("#btnGuideClose").addEventListener("click", () => $("#dlgGuide").close());
  $("#guideSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-g]"); if (b) guide.show(+b.dataset.g); });
  $("#btnWelcomeNext").addEventListener("click", () => welcome.next());
  $("#btnShowWelcome").addEventListener("click", () => { $("#dlgSettings").close(); welcome.open(); });
  home.bind();
  mate.init();
  fisica.init();
  slides.bind();
  autori.init();
  $("#subjNav").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) showView(b.dataset.view); });

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
    if (!s) return;
    const i = Number(s.dataset.i);
    if (reader.picking) {
      const set = new Set(reader.picked);
      set.has(i) ? set.delete(i) : set.add(i);
      return reader.setPicked(set);
    }
    if (!getSelection().isCollapsed) return; // sta selezionando, non leggo
    reader.play(i);
  });
  let selTimer;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => reader.fromSelection(), 350);
  });
  $("#btnPick").addEventListener("click", () => reader.togglePick());
  $("#selLang").innerHTML = Object.entries(LANGS).map(([k, l]) => `<option value="${k}">${l.flag} ${l.name}</option>`).join("");
  $("#selLang").addEventListener("change", (e) => { reader.setLang(e.target.value); if (reader.playing) reader.play(reader.idx); });
  $("#btnClear").addEventListener("click", () => reader.clear());
  $("#btnPickClear").addEventListener("click", () => { reader.setPicked(new Set()); getSelection().removeAllRanges(); });
  $("#btnPickRead").addEventListener("click", () => tts.say(reader.activeText()));
  $("#btnRuler").addEventListener("click", () => ruler.toggle());
  addEventListener("pointermove", (e) => { if (ruler.on && e.pointerType === "mouse") ruler.moveTo(e.clientY); });
  addEventListener("touchmove", (e) => { if (ruler.on && e.target.closest?.("#reader")) ruler.moveTo(e.touches[0].clientY - 40); }, { passive: true });
  $("#btnEdit").addEventListener("click", () => reader.toggleEdit());
  $("#btnSave").addEventListener("click", saveCurrentText);
  $("#btnPrintText").addEventListener("click", () => {
    const first = (reader.text.split("\n").find(l => l.trim()) || "Testo").replace(/^#+\s*/, "").slice(0, 60);
    printer.text(reader.picked.size ? reader.activeText() : reader.text, first);
  });
  $("#btnResultPrint").addEventListener("click", () => {
    // stampo quello che si vede, con tutti i passi aperti e senza pulsanti
    const box = $("#result").cloneNode(true);
    box.querySelectorAll(".hidden").forEach(e => e.classList.remove("hidden"));
    box.querySelectorAll(".no-print, button").forEach(e => e.remove());
    printer.run(`<div class="print-text">${box.innerHTML}</div>`, { title: $("#resultTitle").textContent });
  });
  $("#btnMapPrint").addEventListener("click", () => printer.map());
  $("#btnDeckPrint").addEventListener("click", () => printer.deck());

  // azioni
  $$(".action").forEach(b => b.addEventListener("click", () => runAction(b.dataset.act)));
  $("#btnResultRead").addEventListener("click", () => tts.say(lastResult));
  $("#result").addEventListener("click", (e) => { const b = e.target.closest("[data-ex]"); if (b) exerciseControl(b.dataset.ex); });
  $("#btnResultMap").addEventListener("click", () => runAction("mappa", lastResult));
  $("#btnResultCards").addEventListener("click", () => runAction("flashcard", lastResult));
  $("#btnResultSave").addEventListener("click", async () => {
    const r = await askSave("Salva nel quaderno", $("#resultTitle").textContent, reader.subject);
    if (!r) return;
    const text = lastResult.replace(/\*\*/g, "").replace(/^##\s*/gm, "# ").replace(/^[-*•]\s+/gm, "• ");
    if (notebookPut({ id: uid(), type: "testo", title: r.title, subject: r.subject, date: todayLabel(), data: text })) toast("Salvato nel quaderno");
  });
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
        !(await uiConfirm("Chiudere questa mappa? Non è salvata nel quaderno: premi Salva prima, se vuoi tenerla.", "Chiudi"))) return;
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
    try { await navigator.clipboard.writeText($("#txtDictation").value); toast("Copiato"); }
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

  // ripassa: sezioni, interrogazione, piano, timer
  $("#ripSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-rt]"); if (b) ripassa.tab(b.dataset.rt); });
  $("#btnQuizAsk").addEventListener("click", () => quiz.next());
  $("#btnQuizExpose").addEventListener("click", () => quiz.next(true));
  $("#btnQuizRepeat").addEventListener("click", () => tts.say(quiz.question, null, "it"));
  $("#btnQuizMic").addEventListener("click", () => quiz.mic());
  $("#btnQuizCheck").addEventListener("click", () => quiz.check());
  $("#btnPlanCreate").addEventListener("click", () => planner.create());
  $("#planList").addEventListener("change", (e) => {
    const c = e.target.closest("input[data-si]");
    if (c) planner.toggle(c.closest("[data-plan]").dataset.plan, +c.dataset.si, +c.dataset.ii, c.checked);
  });
  $("#planList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pp]");
    if (!b) return;
    const id = b.closest("[data-plan]").dataset.plan;
    b.dataset.pp === "del" ? planner.remove(id) : planner.print(id);
  });
  $("#btnTimer").addEventListener("click", () => timer.toggle());
  $("#btnTimerStop").addEventListener("click", () => timer.stop());
  $("#timerLen").addEventListener("change", () => timer.update());
  $("#timerChip").addEventListener("click", () => { showView("ripassa"); ripassa.tab("piano"); });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7);
  $("#planDate").value = isoDay(tomorrow);
  $("#planDate").min = isoDay(new Date());

  // dettatura: errori spiegati
  $("#btnExplain").addEventListener("click", () => dictation.explain());
  $("#btnErrApply").addEventListener("click", () => dictation.applyFix());
  $("#btnErrRead").addEventListener("click", () => tts.say($("#errList").innerText, null, "it"));
  dictation.renderStats();

  // quaderno
  $("#notebook").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    if (e.target.closest("[data-del]")) deleteNotebookItem(li.dataset.id, li.dataset.type);
    else if (e.target.closest("[data-tag]")) tagNotebookItem(li.dataset.id, li.dataset.type);
    else openNotebookItem(li.dataset.id, li.dataset.type);
  });

  $("#nbFilter").addEventListener("click", (e) => {
    const c = e.target.closest("[data-sub]");
    if (c) { nbFilter = c.dataset.sub; renderNotebook(); }
  });

  // ripristino del lavoro in corso
  const cur = store.get("current", "");
  if (cur) reader.load(cur); else home.render();
  $("#txtDictation").value = store.get("dictation", "");
  const cm = store.get("currentMap", null);
  if (cm?.root) mindmap.load(cm.root, cm.savedId);
  flash.refreshDecks();
  // quando i caratteri sono pronti ridisegno la mappa con le misure giuste
  document.fonts?.ready.then(() => { if (mindmap.root) mindmap.draw(); });

  // primo avvio: chiedo le chiavi
  if (!store.get("welcomed", false)) setTimeout(() => welcome.open(), 300);
  else if (!settings.keyGemini && !settings.keyGroq) setTimeout(() => { openSettings(); toast("Inserisci le chiavi gratuite di Gemini e Groq per iniziare.", 5000); }, 400);

  // funziona anche come app installata; quando arriva una versione nuova la pagina si ricarica da sola
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !sessionStorage.getItem("zaino-reloaded")) { sessionStorage.setItem("zaino-reloaded", "1"); location.reload(); }
    });
  }
  $("#appVersion").textContent = "Versione " + APP_VERSION;
}

/** Se la pagina e il programma sono di versioni diverse (aggiornamento a metà), svuoto la cache e ricarico una volta. */
function versionGuard() {
  const pageV = document.querySelector('meta[name="zaino-version"]')?.content;
  if (pageV === APP_VERSION) { try { sessionStorage.removeItem("zaino-fix"); } catch {} return true; }
  try {
    if (sessionStorage.getItem("zaino-fix")) return true;   // già provato: vado avanti comunque
    sessionStorage.setItem("zaino-fix", "1");
  } catch { return true; }
  (window.caches ? caches.keys().then(k => Promise.all(k.map(x => caches.delete(x)))) : Promise.resolve())
    .finally(() => location.reload());
  return false;
}

document.addEventListener("DOMContentLoaded", init);
