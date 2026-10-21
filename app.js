/* Studio Facile — strumenti di studio per DSA.
   Tutto gira nel browser: le chiavi API e i dati restano sul dispositivo. */
"use strict";

/* =========================================================
   1. UTILITÀ
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let onStoreChange = null; // impostato più avanti: salvataggio automatico
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("sf." + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("sf." + key, JSON.stringify(value)); onStoreChange?.(key); return true; }
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
      if (b.swatch) { el.style.background = b.swatch[0]; el.style.borderColor = b.swatch[1]; el.style.color = "#1c2440"; }
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
  keyGemini: "", keyGroq: "", keyClaude: "",
  modClaude: "claude-sonnet-5-5", modClaudeFast: "claude-haiku-5-5",
  font: "Atkinson", size: 22, letter: 0.05, line: 1.9, theme: "crema", syllables: false,
  voice: "", rate: 0.95,
  modGemini: "gemini-flash-latest",
  modGroq: "openai/gpt-oss-120b",
  modGroqBackup: "llama-3.3-70b-versatile",
  check: true,
  modWhisper: "whisper-large-v3-turbo",
  modGeminiLite: "gemini-flash-lite-latest",
  modGroqVision: ""
};
const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
// aggiornamento: chi aveva il vecchio modello Groq predefinito passa a quello nuovo, più preciso
if (settings.modGroq === "llama-3.3-70b-versatile") { settings.modGroq = DEFAULTS.modGroq; store.set("settings", settings); }
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

async function geminiCall({ prompt, system, images = [], json = false, temperature = 0.4, model, tools }) {
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
  if (tools) body.tools = tools;
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
    e.raw = data?.error?.message || "";
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

/* ---------- Claude (facoltativo, a pagamento a consumo) ---------- */
const claudeModels = {};
async function findClaudeModel(kind) {
  if (claudeModels[kind] !== undefined) return claudeModels[kind];
  let m = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": settings.keyClaude, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } });
    if (r.ok) m = ((await r.json()).data || []).map(x => x.id).find(id => id.includes(kind)) || ""; // l'elenco arriva dal più recente
  } catch { /* niente */ }
  return (claudeModels[kind] = m);
}
async function claudeCall({ prompt, system, images = [], json = false, temperature = 0.4, model, _retry }) {
  if (!settings.keyClaude) throw new AIError("Manca la chiave Claude (in Impostazioni).", -1);
  const content = images.map(img => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data } }));
  content.push({ type: "text", text: prompt + (json ? "\n\nRispondi solo con il JSON valido, senza testo prima o dopo e senza ```." : "") });
  const body = { model, max_tokens: 8000, temperature, messages: [{ role: "user", content }] };
  if (system) body.system = system;
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": settings.keyClaude, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(body)
    });
  } catch { throw new AIError(friendlyError("Claude", 0), 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message || "";
    // nome del modello cambiato: cerco quello attuale della stessa famiglia e riprovo una volta
    if (res.status === 404 && !_retry) {
      const kind = /haiku/.test(model) ? "haiku" : "sonnet";
      const m = await findClaudeModel(kind);
      if (m && m !== model) return claudeCall({ prompt, system, images, json, temperature, model: m, _retry: true });
    }
    const e = new AIError(/credit|balance|billing/i.test(raw) ? "Il credito di Claude è finito: continuo con i servizi gratuiti." : friendlyError("Claude", res.status, raw), res.status);
    e.raw = raw;
    e.wait = /credit|balance|billing/i.test(raw) ? 6 * 3600 : waitSeconds(res.status, data?.error, res.headers.get("retry-after"));
    throw e;
  }
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!text) throw new AIError("Claude non ha risposto. Riprova.", 1);
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

/** Il modello Gemini più potente ("Pro") disponibile con la chiave; controllo una volta al giorno. */
let geminiProModel;
async function findGeminiPro() {
  if (geminiProModel !== undefined) return geminiProModel;
  const c = store.get("geminiPro", null);
  if (c && Date.now() - c.t < 86400000) return (geminiProModel = c.m);
  let m = "";
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": settings.keyGemini } });
    if (r.ok) {
      const names = ((await r.json()).models || [])
        .filter(x => (x.supportedGenerationMethods || []).includes("generateContent"))
        .map(x => x.name.replace(/^models\//, ""));
      const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
      if (names.includes("gemini-pro-latest")) m = "gemini-pro-latest";
      else m = names.filter(n => /^gemini-\d+(\.\d+)?-pro(-preview)?(-[\d-]+)?$/.test(n)).sort((a, b) => ver(b) - ver(a) || a.length - b.length)[0] || "";
    }
  } catch { /* uso solo Flash */ }
  store.set("geminiPro", { m, t: Date.now() });
  return (geminiProModel = m);
}

/** Chiede all'IA provando in ordine: (Gemini Pro per i compiti importanti) → Gemini → Gemini Flash-Lite → Groq.
    Un servizio che ha appena segnalato il limite viene saltato finché non si riposa. */
async function ask(opts) {
  const hasG = !!settings.keyGemini, hasQ = !!settings.keyGroq, hasC = !!settings.keyClaude;
  if (!hasG && !hasQ && !hasC) {
    openSettings();
    throw new AIError("Per iniziare inserisci almeno una chiave gratuita (Gemini o Groq).", -1);
  }
  const withImages = !!opts.images?.length;
  const main = settings.modGemini || DEFAULTS.modGemini;
  const steps = [];
  // compiti importanti (schede, ricontrollo, quiz, esercizi): prima Claude, se c'è la chiave
  if (hasC && (opts.quality || opts.claude)) {
    const cm = settings.modClaude || DEFAULTS.modClaude;
    steps.push({ key: "claude:" + cm, name: "Claude", run: () => {
      busy(true, "Uso Claude, il modello più preciso…");
      return claudeCall({ ...opts, model: cm });
    } });
  }
  if (hasG && opts.quality && !withImages && !hasC) {
    steps.push({ key: "gemini:pro", name: "Gemini Pro", pro: true, run: async () => {
      const m = await findGeminiPro();
      if (!m) throw new AIError("Nessun modello Pro disponibile.", 404);
      busy(true, "Uso il modello più preciso: ci vuole qualche secondo in più…");
      return geminiCall({ ...opts, model: m });
    } });
  }
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
    else {
      const gm = settings.modGroq || DEFAULTS.modGroq;
      steps.push({ key: "groq:" + gm, name: "Groq", run: () => groqChat({ ...opts, model: gm }) });
      // riserva: se il modello principale rifiuta (testo troppo lungo, limite), provo il modello più leggero
      if (DEFAULTS.modGroqBackup !== gm) steps.push({ key: "groq:" + DEFAULTS.modGroqBackup, name: "Groq (riserva)", run: () => groqChat({ ...opts, model: DEFAULTS.modGroqBackup }), quiet404: true });
    }
  }
  // ultima riserva: Claude veloce (costa pochissimo), se i servizi gratuiti non rispondono
  if (hasC) {
    const fm = settings.modClaudeFast || DEFAULTS.modClaudeFast;
    steps.push({ key: "claude:" + fm, name: "Claude (riserva)", run: () => claudeCall({ ...opts, model: fm }) });
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
      // il modello Pro non è compreso nella chiave gratuita (limite 0, accesso negato): lo salto per un giorno
      if (s.pro && (e.status === 403 || e.status === 404 || /limit:\s*0\b|free_tier|not available/i.test(e.raw || ""))) cooldown.set(s.key, 24 * 3600);
      if (s.pro) continue; // un errore del Pro non deve mai bloccare: si passa al Flash
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
  // l'estensione dice al servizio che formato è: la prendo dal nome del file, se c'è
  const fromName = (blob.name || "").toLowerCase().match(/\.(\w+)$/)?.[1];
  const known = { mp3: "mp3", mpeg: "mp3", mpga: "mp3", m4a: "m4a", mp4: "m4a", aac: "m4a", wav: "wav", ogg: "ogg", oga: "ogg", opus: "ogg", webm: "webm", flac: "flac" };
  const t = blob.type || "";
  const ext = known[fromName] || (t.includes("mpeg") ? "mp3" : t.includes("wav") ? "wav" : t.includes("flac") ? "flac" : t.includes("mp4") || t.includes("m4a") || t.includes("aac") ? "m4a" : t.includes("ogg") || t.includes("opus") ? "ogg" : "webm");
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

/** Trascrive un file audio caricato dal telefono (memo vocale, nota di WhatsApp…).
    I file grandi vengono divisi in pezzi da 10 minuti. */
async function transcribeFile(file, onStatus = () => {}) {
  if (!settings.keyGroq) { openSettings(); throw new AIError("Per trascrivere l'audio serve la chiave Groq (in Impostazioni).", -1); }
  if (file.size <= 24e6) { onStatus("Trascrivo l'audio…"); return transcribe(file); }
  onStatus("L'audio è lungo: lo preparo…");
  let pcm;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    ctx.close?.();
    const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
    pcm = (await off.startRendering()).getChannelData(0);
  } catch { throw new AIError("Questo audio è troppo lungo o in un formato che non riesco ad aprire. Prova con un audio più corto.", 1); }
  const SEG = 16000 * 600, parts = [];
  const n = Math.ceil(pcm.length / SEG);
  for (let k = 0; k < n; k++) {
    onStatus(`Trascrivo l'audio: parte ${k + 1} di ${n}…`);
    parts.push(await transcribe(wavBlob(pcm.subarray(k * SEG, (k + 1) * SEG), 16000)));
  }
  return parts.join(" ");
}
function wavBlob(samples, rate) {
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  const blob = new Blob([b], { type: "audio/wav" }); blob.name = "parte.wav";
  return blob;
}

/* ---------- Istruzioni per l'IA ---------- */
const SYSTEM_TUTOR = `Sei un assistente esperto di studio e di lavoro sui testi. Chi ti usa può essere uno studente (scuola superiore o università) o un professionista, e ha la dislessia (DSA).
La dislessia riguarda la LETTURA, non la capacità di capire. Quindi l'aiuto sta nella FORMA, mai nella riduzione del contenuto.
REGOLA FONDAMENTALE — il livello del contenuto è quello della FONTE: liceo, università, documento professionale, tecnico, scientifico o giuridico. Mantieni lo stesso lessico specialistico, la stessa precisione, le stesse distinzioni e la stessa ricchezza di concetti. Non trasformare mai un testo specialistico in un testo divulgativo o scolastico, e non scendere mai sotto il livello liceale.
Conserva SEMPRE: nomi, date, numeri, dati e unità di misura, luoghi, opere e fonti, riferimenti precisi (articoli, norme, sigle, codici), definizioni, distinzioni concettuali, argomentazioni, condizioni ed eccezioni, cause e conseguenze, collegamenti. Non generalizzare e non sostituire i dettagli con frasi vaghe.
Forma: italiano chiaro e ordinato, frasi non troppo lunghe (indicativamente fino a 25-30 parole), un'idea per frase, titoli ed elenchi. Non usare tabelle. I termini tecnici restano: spiegali brevemente solo la prima volta, se aiuta.
Non inventare informazioni che non sono nel testo, salvo quando ti viene chiesto di spiegare.
Formato consentito: righe che iniziano con "## " per i titoli, righe che iniziano con "- " per gli elenchi, **grassetto** per le parole chiave. Nient'altro.`;

/* misure proporzionate alla lunghezza del testo */
const wordCount = (t) => (String(t).match(/\S+/g) || []).length;
const sumTarget = (t) => Math.round(Math.min(1600, Math.max(200, wordCount(t) * 0.3)) / 10) * 10;
const cardCount = (t) => { const n = Math.min(40, Math.max(10, Math.round(wordCount(t) / 120))); return `da ${n} a ${n + 5}`; };
const mapSize = (t) => wordCount(t) > 2500 ? "da 5 a 9 rami principali; fino a 4 livelli sotto il titolo; dentro i riquadri metti nomi, date e termini precisi" : wordCount(t) > 900 ? "da 4 a 8 rami principali; massimo 3 livelli sotto il titolo" : "da 3 a 7 rami principali; massimo 3 livelli sotto il titolo";

const PROMPTS = {
  palazzoLuoghi: (t) => `Una persona ha descritto a voce un percorso che conosce bene (casa sua o un tragitto), per usarlo con il metodo dei loci.
Estrai i luoghi IN ORDINE, uno per ogni punto preciso del percorso (es. "porta d'ingresso", "attaccapanni", "divano"). Togli parole come "poi", "dopo", "c'è".
Rispondi SOLO con JSON: {"luoghi": ["...", "..."]}

DESCRIZIONE:
"""${t}"""`,
  palazzoCammino: (luoghi, richiesta, testo) => `Sei un esperto di tecniche di memoria. Aiuta una persona con dislessia a memorizzare una SEQUENZA con il metodo dei loci, usando il suo percorso personale.
COSA DEVE RICORDARE: ${richiesta}
${testo ? `Prendi gli elementi della sequenza dal TESTO qui sotto (sono la fonte giusta).` : `Se è una sequenza nota (stadi, fasi, opere, elenchi, procedure), usa gli elementi corretti; se non sei sicuro, usa solo quello che è scritto nella richiesta.`}
LUOGHI DEL PERCORSO, in ordine: ${luoghi.map((l, i) => `${i + 1}. ${l}`).join("; ")}

Rispondi SOLO con JSON:
{"titolo": "titolo breve della sequenza",
 "elementi": [{"luogo": "il luogo, copiato identico dall'elenco", "cosa": "l'elemento da ricordare, in poche parole", "spiegazione": "una frase semplice su cosa significa", "immagine": "la scena da immaginare in quel luogo"}]}
Regole:
- un elemento per luogo, nell'ordine dei luoghi e nell'ordine giusto della sequenza; usa solo i luoghi che servono;
- l'immagine è in seconda persona ("apri la porta e vedi…"), 2-3 frasi, concreta, piena di dettagli da vedere, sentire e toccare, esagerata o buffa, con movimento: così si ricorda;
- l'immagine deve contenere un aggancio chiaro alla parola chiave dell'elemento (un oggetto, un gioco di parole, un personaggio) e legarsi al luogo;
- niente scene violente, paurose o inadatte;
- gli elementi devono essere corretti e completi, con il lessico della materia: è materiale di studio o di lavoro.${testo ? `

TESTO:
"""${testo}"""` : ""}`,
  palazzoUnaImmagine: (luogo, cosa, spiegazione) => `Inventa una nuova scena da immaginare per ricordare «${cosa}» (${spiegazione}) nel luogo «${luogo}», con il metodo dei loci.
Seconda persona, 2-3 frasi, concreta, esagerata o buffa, con un aggancio chiaro alla parola chiave; niente di violento o pauroso; diversa dalla solita.
Rispondi SOLO con JSON: {"immagine": "..."}`,
  profEstrai: (t, prof, materia) => `Una studentessa racconta (trascrizione automatica, ignora gli errori di trascrizione) cosa le ha chiesto ${prof} di ${materia || "una materia"} in un'interrogazione o verifica.
Estrai le informazioni. Rispondi SOLO con JSON:
{"argomento": "argomento in poche parole",
 "domande": ["ogni domanda fatta, riformulata in modo chiaro e completo"],
 "errori": [{"domanda": "...", "cosa_mancava": "dove ha perso punti o cosa le ha detto il professore"}],
 "voto": "il voto se lo dice, altrimenti null"}
"errori" solo se lei dice dove ha sbagliato o cosa le hanno corretto.

RACCONTO:
"""${t}"""`,
  profFoto: (prof, materia) => `Questa è la foto di una verifica corretta da ${prof} (${materia || "materia"}). Leggi le domande e le correzioni (segni, commenti, punteggi).
Rispondi SOLO con JSON:
{"argomento": "argomento in poche parole",
 "domande": ["ogni domanda o esercizio, scritto in modo chiaro"],
 "errori": [{"domanda": "...", "cosa_mancava": "dove ha perso punti, secondo le correzioni del professore"}],
 "voto": "il voto se si legge, altrimenti null"}`,
  profStile: (prof, materia, storico) => `Ecco l'archivio delle domande che ${prof} (${materia || "materia"}) ha fatto a una studentessa delle superiori con dislessia, con gli errori segnati.
Analizza come interroga questo professore, per aiutarla a prepararsi. Rispondi SOLO con JSON:
{"stile": "2-3 frasi: come fa le domande (definizioni? collegamenti? esempi? date? confronti? ragionamento?)",
 "tipi_di_domanda": [{"tipo": "es. definizione, collegamento tra autori, esempio pratico", "esempio": "una sua domanda di quel tipo", "frequenza": "spesso | a volte | raramente"}],
 "temi_frequenti": ["argomenti o richieste che tornano spesso"],
 "punti_deboli": ["dove lei perde punti più spesso, dalle correzioni"],
 "consigli": ["3 consigli pratici per prepararsi a QUESTO professore"]}
Basati solo sull'archivio; se le domande sono poche, dillo nello stile e sii prudente.

ARCHIVIO:
${storico}`,
  profDomande: (prof, materia, storico, testo) => `Prepara 6 domande di interrogazione sul TESTO, come le farebbe ${prof} (${materia || "materia"}), imitando il suo stile come risulta dall'ARCHIVIO delle sue domande passate.
Insisti un po' sui punti dove la studentessa ha perso punti in passato. Domande chiare, una alla volta, in italiano.
Rispondi SOLO con JSON: {"domande": ["...", "..."]}

ARCHIVIO:
${storico}

TESTO:
"""${testo}"""`,
  zoom: (t) => `Prepara una vista "a zoom" di questo testo, per una persona con dislessia: la legge PRIMA del testo intero, per capirne subito il senso e la struttura. Resta al livello della fonte: frasi concrete e precise, con il lessico del testo.
Rispondi SOLO con JSON:
{"frase": "il succo di tutto il testo in UNA frase di massimo 25 parole",
 "parole_chiave": ["da 3 a 5 parole, nomi o date chiave"],
 "punti": [{"titolo": "3-6 parole", "frase": "il contenuto di quella parte in una frase breve", "ancora": "le prime 6-8 parole ESATTE, copiate dal testo, della frase dove comincia quella parte"}]}
Regole: da 4 a ${Math.min(14, Math.max(8, Math.round(wordCount(t) / 600)))} punti, nello stesso ordine del testo, ognuno con una frase concreta (nomi, date, concetti), non generica, che insieme coprano tutto il testo; frasi semplici; "ancora" copiata identica dal testo.

TESTO:
"""${t}"""`,
  spiegalo: (src, detto) => `Una persona con dislessia ha spiegato a voce un argomento, senza leggere, come a un'interrogazione, un esame orale o una presentazione di lavoro.
Confronta la sua spiegazione con il TESTO di riferimento. La spiegazione è trascritta in automatico: ignora errori di trascrizione, ripetizioni e intercalari ("ehm", "cioè", "praticamente").
Rispondi SOLO con JSON:
{"copertura": numero da 0 a 100 (quanta parte dei concetti importanti del testo ha spiegato),
 "giudizio": "2 frasi sincere e incoraggianti",
 "punti_detti": ["concetti importanti spiegati bene, in poche parole"],
 "punti_mancanti": [{"punto": "concetto importante che non ha detto", "in_breve": "come poteva dirlo, in una frase precisa con i termini giusti"}],
 "errori": [{"detto": "cosa ha detto di sbagliato o di confuso", "corretto": "la versione giusta"}],
 "termini_usati": ["termini tecnici che ha usato bene"],
 "termini_da_usare": [{"termine": "termine tecnico del testo che non ha usato", "significato": "definizione chiara e precisa"}],
 "ordine": "una frase sull'ordine del discorso: era logico? cosa conveniva dire prima?",
 "consiglio": "un solo consiglio pratico per la prossima volta"}
Regole: valuta come un professore esigente, al livello del testo (per una copertura alta servono anche i termini tecnici, i nomi, le date e i collegamenti); conta i concetti importanti (al massimo 15 tra detti e mancanti); non segnare come errore una parola trascritta male; se ha detto poco, copertura bassa ma tono gentile; frasi brevi e semplici; liste vuote se non c'è niente da dire.

TESTO:
"""${src}"""

SPIEGAZIONE DELLA STUDENTESSA:
"""${detto}"""`,
  domandeVerifica: (t, materia) => `Una persona deve prepararsi a una prova (verifica, interrogazione, esame universitario o colloquio) di ${materia || "questa materia"} su questo testo. Le domande e le risposte devono essere al livello della FONTE.
Prepara le ${Math.min(15, Math.max(8, Math.round(wordCount(t) / 400)))} domande più probabili che un esaminatore potrebbe fare (scritte o orali), dalla più semplice alla più difficile: definizioni, spiegazioni, esposizioni di un argomento, confronti, collegamenti.
Per ognuna scrivi una risposta modello da voto alto, presa dal testo.
Rispondi SOLO con JSON: {"domande": [{"domanda": "...", "risposta": "4-8 frasi chiare e complete, con i termini tecnici, i nomi e le date giuste; parole chiave in **grassetto**"}]}

TESTO:
"""${t}"""`,
  controlla: (src, out, cosa, json) => `Sei un revisore molto attento. Un assistente ha preparato ${cosa} a partire dal TESTO qui sotto, per una persona con dislessia che deve studiarlo o usarlo.
Controlla il lavoro confrontandolo riga per riga con il TESTO:
1. correggi ogni informazione sbagliata, confusa o che nel testo non c'è (nomi, date, numeri, definizioni, cause e conseguenze);
2. aggiungi le informazioni importanti del testo che mancano;
3. togli ripetizioni e frasi vuote;
4. controlla che il livello sia quello del TESTO (stesso lessico tecnico e stessa precisione): se il lavoro è troppo generico o semplificato, rendilo preciso;
5. mantieni lo stesso formato; la lunghezza può crescere se servono informazioni mancanti.
${json ? "Rispondi SOLO con il JSON corretto, con la stessa identica struttura e gli stessi nomi dei campi." : "Rispondi SOLO con la versione corretta e completa, nello stesso formato, senza commenti e senza dire cosa hai cambiato."}
Se è già tutto corretto, restituiscilo identico.

TESTO:
"""${src}"""

${cosa.toUpperCase()} DA CONTROLLARE:
"""${out}"""`,
  ocr: `Trascrivi fedelmente tutto il testo di questa pagina, nell'ordine in cui si legge.
- Scrivi i titoli su una riga che inizia con "# ".
- Separa i paragrafi con una riga vuota. Unisci le parole spezzate a fine riga.
- Ignora numeri di pagina, intestazioni ripetute e decorazioni.
- Per immagini, grafici o schemi importanti scrivi una breve descrizione tra parentesi quadre, es. [Immagine: cartina dell'Europa nel 1815].
- Scrivi le formule in modo che si possano leggere ad alta voce (es. "x al quadrato più 3").
Rispondi solo con il testo trascritto.`,
  semplifica: (t) => `Riscrivi questo testo per renderlo più facile da LEGGERE, senza renderlo più povero: semplifica la forma, NON il contenuto.
Mantieni TUTTE le informazioni: ogni nome, data, numero, luogo, opera, definizione, termine tecnico (in **grassetto**), causa, conseguenza e collegamento. La lunghezza deve restare simile all'originale.
Dividilo in blocchi con un titolo "## " ciascuno, nell'ordine del testo. Frasi più corte e ordinate (soggetto, verbo, complemento). Usa elenchi "- " quando ci sono più elementi in fila.

TESTO:
${t}`,
  riassunto: (t) => `Fai un riassunto DI STUDIO di questo testo: chi lo usa deve poter studiare o lavorare SOLO sul riassunto senza perdere nulla di importante: prendere il voto massimo a scuola o all'università, oppure usarlo al lavoro.
Livello: quello della FONTE. Mantieni il lessico specialistico, la precisione dei concetti, le distinzioni, le argomentazioni e i passaggi logici dell'autore; non trasformare un testo universitario in un testo divulgativo.
Lunghezza: circa ${sumTarget(t)} parole; se il testo è denso, puoi superarla: meglio un riassunto più lungo che uno lacunoso. Non essere generico: ogni punto deve contenere informazioni concrete.
Struttura:
## In una frase
(di cosa parla tutto il testo)
Poi una sezione "## titolo" per ogni parte del testo, NELLO STESSO ORDINE del testo, con elenchi "- " ricchi di dettagli:
chi, cosa, quando, dove, perché, con quali conseguenze; definizioni dei concetti; nomi, date, numeri, opere; parole chiave in **grassetto**.
## Da ricordare
- (TUTTI i nomi, le date, i numeri, i dati, i riferimenti, le definizioni e i termini importanti del testo, uno per riga, con una breve spiegazione)
Non aggiungere informazioni che nel testo non ci sono.

TESTO:
${t}`,
  riassuntoParte: (t, k, n) => `Questa è la parte ${k} di ${n} di un documento lungo. Fai il riassunto DI STUDIO solo di questa parte, al livello della FONTE (se è universitaria, resta universitario: stesso lessico tecnico e stessa precisione).
Lunghezza: circa ${sumTarget(t)} parole; se la parte è densa puoi superarla, meglio più lungo che lacunoso. Non essere generico: conserva nomi, date, numeri, opere, definizioni, distinzioni concettuali, argomentazioni, termini tecnici, cause e conseguenze.
Formato: una sezione "## titolo" per ogni argomento della parte, nello stesso ordine del testo, con elenchi "- " ricchi di dettagli e parole chiave in **grassetto**. Niente introduzioni o conclusioni generali.

TESTO (parte ${k} di ${n}):
${t}`,
  riassuntoCornice: (sum) => `Ecco il riassunto dettagliato di un documento lungo, diviso per sezioni. Preparane la cornice.
Rispondi SOLO con JSON:
{"frase": "di cosa parla tutto il documento, in 1-2 frasi",
 "da_ricordare": ["TUTTI i nomi, le date, i numeri, i dati, i riferimenti e i termini importanti, ciascuno con una breve spiegazione"]}

RIASSUNTO:
${sum}`,
  parole: (t) => `Estrai dal testo le ${Math.min(40, Math.max(8, Math.round(wordCount(t) / 120)))} parole, nomi o concetti più importanti da studiare (al livello della fonte: termini tecnici, autori, opere, date chiave).
Per ognuno scrivi una riga così:
- **parola**: definizione precisa, come la chiederebbe l'insegnante (1-2 frasi), con l'autore o il contesto a cui si lega, se c'è.
Mettili nell'ordine in cui compaiono nel testo.

TESTO:
${t}`,
  spiega: (t) => `Spiegami questo testo come farebbe un ottimo insegnante, in modo che lo capisca a fondo e sappia spiegarlo a sua volta (a un'interrogazione, a un esame o in una riunione di lavoro).
QUI puoi (e devi) usare parole più semplici, analogie ed esempi di vita quotidiana: è lo strumento per capire. Però non togliere concetti, non dire cose inesatte e non eliminare i termini tecnici: spiegali con parole semplici, così li impara.
## Di cosa parla
(2-3 frasi: argomento, contesto, perché è importante)
## Spiegazione passo passo
(segui l'ordine del testo; per ogni passaggio spiega il concetto con parole semplici, il ragionamento che c'è dietro, cosa significano i termini tecnici, i nomi e le date; sui punti difficili usa un'analogia)
## Collegamenti
- (con altri autori, periodi, materie o concetti, se il testo li permette)
## Un esempio per fissarlo
(un esempio concreto che aiuta a capire il concetto più difficile)
## Domande per verificare se ho capito
- (4 domande sul testo, al suo livello, senza risposta)

TESTO:
${t}`,
  mappa: (t) => `Crea una mappa concettuale di questo testo, per studiare.
Rispondi SOLO con JSON in questo formato:
{"titolo": "argomento centrale", "rami": [{"testo": "concetto", "figli": [{"testo": "dettaglio", "figli": []}]}]}
Regole:
- ${mapSize(t)};
- ogni riquadro ha al massimo 7 parole: parole chiave, non frasi lunghe;
- ogni riquadro deve dire qualcosa di PRECISO (un nome, una data, una definizione, una causa, una conseguenza): mai riquadri vaghi come "Importanza", "Conseguenze", "Aspetti" senza contenuto sotto;
- includi tutti i nomi, le date, le opere e i termini importanti del testo;
- l'ordine dei rami segue l'ordine logico o cronologico; il livello è quello della fonte (anche universitario).

TESTO:
${t}`,
  mappaTema: (t) => `Crea una mappa concettuale sull'argomento "${t}", al livello che l'argomento richiede (almeno quello di un buon manuale di liceo; se l'argomento è universitario o professionale, a quel livello).
Rispondi SOLO con JSON in questo formato:
{"titolo": "argomento centrale", "rami": [{"testo": "concetto", "figli": [{"testo": "dettaglio", "figli": []}]}]}
Regole: da 5 a 8 rami principali; fino a 4 livelli; ogni riquadro al massimo 7 parole e con un contenuto preciso (nomi, date, opere, definizioni, cause, conseguenze), mai vago; contenuti corretti e verificabili.`,
  migliora: (json) => `Questa è una mappa concettuale fatta da una persona con dislessia. Aiutala a migliorarla, rispettando il suo lavoro e restando al livello dei suoi contenuti.
Regole:
- MANTIENI la sua struttura e le sue parole: non cancellare i suoi riquadri e non riscriverli, salvo per correggere errori di ortografia o di contenuto evidenti;
- AGGIUNGI i concetti importanti che mancano per conoscere bene l'argomento al suo livello (date, nomi, opere, termini tecnici, cause, conseguenze, collegamenti), al punto giusto della mappa;
- metti "nuovo": true SOLO sui riquadri che aggiungi tu, e su quelli in cui correggi un errore;
- ogni riquadro al massimo 7 parole; massimo 4 livelli sotto il titolo; non aggiungere più di 15 riquadri in tutto;
- se un riquadro è troppo lungo puoi accorciarlo (e segnarlo con "nuovo": true).
Rispondi SOLO con JSON in questo formato:
{"titolo": "...", "rami": [{"testo": "...", "nuovo": false, "figli": [{"testo": "...", "nuovo": true, "figli": []}]}]}

MAPPA ATTUALE (il primo "testo" è il titolo al centro):
${json}`,
  flashcard: (t) => `Crea flashcard per ripassare e ricordare questo testo (in vista di una verifica, di un esame o per il lavoro).
Rispondi SOLO con JSON: {"titolo": "argomento breve", "carte": [{"domanda": "...", "risposta": "..."}]}
Regole:
- ${cardCount(t)} carte, che coprano TUTTI i concetti, i nomi, le date e le definizioni importanti (al livello della fonte, anche universitario; mai domande banali);
- mescola i tipi di domanda: definizioni precise, "perché…", "come…", cause e conseguenze, confronti, collegamenti, chi/quando/dove;
- domande chiare, una sola cosa per domanda;
- risposte complete ma compatte (fino a 40 parole), con i termini tecnici, i nomi e le date giuste.

TESTO:
${t}`,
  traduci: (t, from, to) => `Traduci questo testo ${from === "it" ? "dall'italiano" : "in italiano"}${to && to !== "it" ? " in " + LANGS[to].name.toLowerCase() : ""}, per chi lo deve studiare o usare.
Procedi paragrafo per paragrafo. Per ogni paragrafo scrivi:
- prima una riga che inizia con "${LANGS[from]?.flag || ""} " seguita dal paragrafo originale;
- poi una riga che inizia con "${LANGS[to]?.flag || "🇮🇹"} " seguita dalla traduzione, fedele e naturale, con la terminologia tecnica corretta del settore.
Lascia una riga vuota tra un paragrafo e l'altro. Metti in **grassetto** nella traduzione le parole più importanti. Nessun altro commento.

TESTO:
${t}`,
  vocaboli: (t, lang) => `Questo testo è in ${LANGS[lang].name.toLowerCase()}. Crea flashcard di vocaboli per una persona italiana che deve studiare o usare questo testo.
Rispondi SOLO con JSON: {"titolo": "argomento breve in italiano", "carte": [{"domanda": "parola o espressione in ${LANGS[lang].name.toLowerCase()}", "risposta": "traduzione italiana — breve esempio in ${LANGS[lang].name.toLowerCase()}"}]}
Regole: da 10 a 25 carte; scegli parole utili e importanti del testo (anche verbi, espressioni e termini tecnici del settore), non quelle banali; per i verbi irregolari indica le forme principali.

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
  esercizio: (t) => `Questo è un esercizio (di matematica, fisica, chimica, grammatica o altro). Aiuta chi studia a risolverlo DA SOLO, passo per passo, come farebbe un buon insegnante, al livello dell'esercizio (scuola o università).
Rispondi SOLO con JSON:
{"esercizio": "testo dell'esercizio, ricopiato in breve", "dati": ["dato 1", "dato 2"], "passi": [{"titolo": "titolo breve del passo", "spiegazione": "cosa fare e perché, con il calcolo di questo passo"}], "risultato": "risultato finale con unità di misura", "controllo": "come verificare che il risultato sia sensato"}
Regole: da 3 a 7 passi; frasi brevi; formule leggibili (², √, ·, niente LaTeX); se ci sono più esercizi, risolvi solo il primo.

TESTO:
${t}`,
  linea: (t) => `Crea una linea del tempo con gli eventi di questo testo, in ordine cronologico.
Rispondi SOLO con JSON: {"titolo": "argomento", "eventi": [{"data": "1789 (o 14 luglio 1789, o III sec. a.C.)", "titolo": "evento in max 8 parole", "dettaglio": "1-2 frasi: cosa accade, chi è coinvolto, con quale causa o conseguenza"}]}
Regole: da 4 a ${Math.min(40, Math.max(15, Math.round(wordCount(t) / 150)))} eventi, cioè TUTTI quelli con una data o un periodo presenti nel testo; solo eventi con una data o un periodo; se il testo non contiene date, metti le fasi o i passaggi nell'ordine in cui avvengono e scrivi nel campo "data" la parola "Fase 1", "Fase 2"...

TESTO:
${t}`,
  confronta: (t) => `Trova nel testo gli elementi più utili da confrontare (es. due popoli, due personaggi, due periodi, due processi, due teorie) e crea una tabella di confronto per lo studio.
Rispondi SOLO con JSON: {"titolo": "Confronto tra X e Y", "colonne": ["X", "Y"], "righe": [{"aspetto": "es. governo", "valori": ["per X", "per Y"]}]}
Regole: da 2 a 4 colonne; da 5 a 10 righe; celle precise e concrete (fino a 20 parole), con nomi, date, concetti e termini del testo, mai generiche; "valori" ha sempre lo stesso numero di elementi di "colonne".

TESTO:
${t}`,
  domanda: (t, gia) => `Sei un docente esigente che interroga su questo testo (interrogazione o esame orale).
Fai UNA sola domanda aperta, chiara, come in una vera interrogazione orale, al livello del testo (liceo o università). Alterna domande di definizione precisa, di spiegazione ("perché…", "come…"), di esposizione ("parlami di…"), di confronto e di collegamento; non fare domande banali o di sola memoria spicciola.
${gia.length ? "NON ripetere queste domande già fatte:\n- " + gia.join("\n- ") : ""}
Rispondi SOLO con JSON: {"domanda": "..."}

TESTO:
${t}`,
  valuta: (t, domanda, risposta) => `Sei un docente gentile ma preciso. Una persona con dislessia ha risposto A VOCE a una domanda d'esame o di interrogazione (la risposta è trascritta automaticamente: ignora errori di trascrizione, ripetizioni e punteggiatura).
Valuta il CONTENUTO confrontandolo con il testo studiato, con il metro di un professore esigente, al livello del testo: "ottimo" solo se la risposta è completa, precisa e usa i termini giusti; "buono" se manca poco; non regalare il giudizio. Sii incoraggiante nel tono e concreto nelle indicazioni.
Rispondi SOLO con JSON:
{"livello": "ottimo" | "buono" | "sufficiente" | "da rivedere", "bene": ["cosa ha detto di giusto"], "manca": ["concetto importante che non ha detto"], "errori": ["affermazione sbagliata → versione corretta"], "risposta_modello": "una risposta da voto alto, in 4-7 frasi chiare, con i termini tecnici, i nomi e le date giuste", "consiglio": "un consiglio pratico per migliorare l'esposizione"}

TESTO STUDIATO:
${t}

DOMANDA: ${domanda}

RISPOSTA DELLA STUDENTESSA:
${risposta}`,
  piano: (materia, argomenti, giorni, minuti) => `Crea un piano di studio per una persona con dislessia che deve prepararsi a una prova (verifica, esame o certificazione) di ${materia}.
Argomenti da studiare:
${argomenti}

Giorni disponibili (formato AAAA-MM-GG): ${giorni.join(", ")}
Tempo al giorno: circa ${minuti} minuti, divisi in sessioni da 20-25 minuti con pause.
Regole:
- distribuisci gli argomenti in modo equilibrato, prima i più difficili;
- per ogni argomento prevedi attività attive: leggere con la sintesi vocale, fare la mappa, flashcard, spiegarlo a voce, interrogazione simulata;
- l'ultimo giorno è solo ripasso generale (mappe, flashcard, interrogazione);
- se i giorni sono pochi, concentra l'essenziale;
- attività brevi e concrete (max 12 parole ciascuna).
Rispondi SOLO con JSON: {"sessioni": [{"data": "AAAA-MM-GG", "attivita": ["...", "..."]}]}`,
  spiegaErrori: (t) => `Trova gli errori di ortografia, grammatica e punteggiatura in questo testo scritto da una persona con dislessia e disortografia.
Per ogni errore spiega la regola in modo semplice e gentile, con un trucco per ricordarla.
Rispondi SOLO con JSON:
{"errori": [{"sbagliato": "parola o pezzo sbagliato, esattamente come è scritto", "corretto": "versione giusta", "tipo": "accenti" | "apostrofo" | "h" | "doppie" | "maiuscole" | "punteggiatura" | "lettere scambiate" | "parole unite o staccate" | "grammatica" | "altro", "regola": "spiegazione breve con un trucco"}], "testo_corretto": "tutto il testo corretto"}
Se non ci sono errori, "errori" è una lista vuota.

TESTO:
${t}`,
  schede: (json) => `Questa è una mappa concettuale. Per ogni ramo principale scrivi una scheda di ripasso, al livello dei contenuti della mappa.
Rispondi SOLO con JSON:
{"introduzione": "2 frasi: di cosa parla l'argomento e perché è importante",
 "schede": [{"ramo": "testo ESATTO del ramo", "spiegazione": "3-5 frasi chiare che spiegano e collegano i concetti del ramo, con nomi, date e termini precisi", "ricorda": "la frase chiave da ricordare"}],
 "domande": ["4-6 domande di ripasso su tutta la mappa, al livello dei suoi contenuti"]}
Usa solo informazioni corrette; frasi di massimo 25 parole; nessun elenco dentro le frasi; contenuti precisi al livello della mappa (almeno liceo), non generici.

MAPPA:
${json}`,
  fisica: (t) => `Sei un insegnante di fisica paziente. Aiuta una persona con dislessia e discalculia a risolvere questo problema DA SOLA, un passo alla volta, al livello del problema (scuola o università).
Rispondi SOLO con JSON:
{"riassunto": "cosa chiede il problema, in una frase chiara",
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
    if (!keepPosition) zoom.reset();
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
  let pages = [...Array(Math.min(pdf.numPages, MAX_PAGES)).keys()].map(i => i + 1);
  // PDF lunghi (per esempio i libri di LibroAID): chiedo quali pagine servono
  if (pdf.numPages > 8) {
    busy(false);
    let labels = null;
    try { labels = await pdf.getPageLabels(); } catch { /* niente */ }
    const chosen = await askPdfPages(pdf.numPages, labels, file.name);
    if (!chosen) throw new Error("Nessuna pagina scelta.");
    pages = chosen;
  }
  const n = pages.length;
  let out = [];
  for (let k = 0; k < n; k++) {
    const p = pages[k];
    busy(true, `Leggo il PDF: pagina ${k + 1} di ${n}…`);
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
  return out.join("\n\n");
}

/** «45-52, 60» → elenco di pagine del PDF. Se il PDF ha i numeri stampati (etichette), uso quelli. */
function parsePageList(txt, total, labels) {
  const toIndex = (v) => {
    if (labels) { const i = labels.indexOf(String(v)); if (i >= 0) return i + 1; }
    const n = parseInt(v, 10);
    return n >= 1 && n <= total ? n : null;
  };
  const out = [];
  for (const part of txt.replace(/\s*[-–]\s*/g, "-").split(/[\s,;]+/).filter(Boolean)) {
    const m = part.match(/^(\w+)\s*[-–]\s*(\w+)$/);
    if (m) {
      const a = toIndex(m[1]), b = toIndex(m[2]);
      if (a && b) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i);
    } else { const a = toIndex(part); if (a) out.push(a); }
  }
  return [...new Set(out)].sort((x, y) => x - y);
}
async function askPdfPages(total, labels, name) {
  const useLabels = labels && labels.some((l, i) => l !== String(i + 1));
  const msg = `«${name}» ha ${total} pagine. Quali ti servono? Scrivi per esempio 45-52 oppure 12, 15-18.` +
    (useLabels ? " Puoi usare i numeri stampati sulle pagine del libro." : " Usa i numeri delle pagine del PDF (possono essere diversi da quelli stampati sul libro).") +
    ` Al massimo 30 pagine alla volta.`;
  for (;;) {
    const r = await uiDialog({ title: "Quali pagine?", message: msg, input: "", buttons: [{ label: "Annulla", value: null }, { label: "Leggi queste pagine", value: "ok", primary: true }] });
    if (!r || r.choice !== "ok") return null;
    const pages = parsePageList(r.text, total, useLabels ? labels : null);
    if (!pages.length) { toast("Non ho capito le pagine. Scrivi per esempio 45-52."); continue; }
    if (pages.length > 30) { toast(`Sono ${pages.length} pagine: scegline al massimo 30 alla volta.`, 5000); continue; }
    return pages;
  }
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
      if (f.type.startsWith("audio/") || /\.(m4a|mp3|wav|ogg|opus|aac|webm|flac)$/i.test(f.name)) {
        busy(true, "Trascrivo l'audio…");
        pieces.push(await transcribeFile(f, (m) => busy(true, m)));
      } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
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

function buildDeck(data, lang = "it", subject = reader.subject || "", title = "") {
  const cards = (data.carte || data.cards || []).filter(c => c.domanda && c.risposta).map(c => ({ q: c.domanda, a: c.risposta, box: 0 }));
  if (!cards.length) throw new Error("Non sono riuscito a creare le carte. Riprova.");
  const deck = { id: uid(), title: title || data.titolo || "Flashcard", date: todayLabel(), cards, lang, subject };
  const decks = store.get("decks", []);
  decks.unshift(deck);
  store.set("decks", decks);
  return deck;
}
function makeDeck(data, lang = "it") {
  const deck = buildDeck(data, lang);
  const cards = deck.cards;
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

/** Chiede il lavoro all'IA e poi lo fa ricontrollare sul testo di partenza.
    Se il controllo non riesce o rovina il formato, tengo la prima versione. */
const CHECK_WHAT = { mappa: "una mappa concettuale (in JSON)", flashcard: "delle flashcard (in JSON)", linea: "una linea del tempo (in JSON)",
  confronta: "una tabella di confronto (in JSON)", riassunto: "un riassunto", semplifica: "una versione semplificata", parole: "un elenco di parole chiave", formulario: "un formulario" };
/** Divide un testo lungo in parti di circa 3500 parole, senza spezzare i paragrafi. */
function chunkText(t, maxWords = 3500) {
  const paras = t.split(/\n{2,}/).flatMap(p => wordCount(p) > maxWords ? splitSentences(p).reduce((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && wordCount(last) + wordCount(s) <= maxWords) acc[acc.length - 1] = last + " " + s; else acc.push(s);
    return acc;
  }, []) : [p]);
  const out = []; let cur = [], n = 0;
  for (const p of paras) {
    const w = wordCount(p);
    if (n + w > maxWords && cur.length) { out.push(cur.join("\n\n")); cur = []; n = 0; }
    cur.push(p); n += w;
  }
  if (cur.length) out.push(cur.join("\n\n"));
  return out;
}
const LONG_TEXT = 4500;   // oltre queste parole si lavora a parti
/** Riassunto di studio: un passaggio per i testi normali, a parti per quelli lunghi (salvato per non rifarlo). */
async function studySummary(text) {
  const key = "sum:" + zoom.hash(text);
  const cached = store.get(key, null);
  if (cached) return cached;
  let md;
  const parts = wordCount(text) > LONG_TEXT ? chunkText(text) : [text];
  if (parts.length === 1) md = await askChecked("riassunto", text, { prompt: PROMPTS.riassunto(text), system: SYSTEM_TUTOR });
  else {
    const sums = [];
    for (let k = 0; k < parts.length; k++) {
      busy(true, `Riassumo la parte ${k + 1} di ${parts.length}…`);
      sums.push((await ask({ prompt: PROMPTS.riassuntoParte(parts[k], k + 1, parts.length), system: SYSTEM_TUTOR, temperature: 0.3 })).trim());
    }
    const body = sums.join("\n\n");
    let frame = null;
    try { busy(true, "Metto insieme il riassunto…"); frame = parseJSON(await ask({ prompt: PROMPTS.riassuntoCornice(body), json: true, temperature: 0.2 })); } catch { /* il corpo basta */ }
    md = [frame?.frase ? `## In una frase\n${frame.frase}` : "", body,
      (frame?.da_ricordare || []).length ? "## Da ricordare\n" + frame.da_ricordare.map(x => "- " + x).join("\n") : ""].filter(Boolean).join("\n\n");
  }
  store.set(key, md);
  const keys = store.get("sumKeys", []).filter(k => k !== key); keys.push(key);
  keys.slice(0, Math.max(0, keys.length - 10)).forEach(k => { try { localStorage.removeItem("sf." + k); } catch { /* niente */ } });
  store.set("sumKeys", keys.slice(-10));
  return md;
}
/** Per mappe, flashcard e simili su testi lunghi: si parte dal riassunto dettagliato, che conserva nomi e date. */
async function studyBase(text) {
  if (wordCount(text) <= LONG_TEXT) return text;
  busy(true, "Il testo è lungo: prima preparo un riassunto dettagliato…");
  return studySummary(text);
}

async function askChecked(act, text, opts) {
  const first = await ask(opts);
  if (!settings.check || !CHECK_WHAT[act] || text.length < 300 || text.length > 30000) return first;
  busy(true, "Ricontrollo sul testo che sia tutto giusto…");
  try {
    const fixed = await ask({ prompt: PROMPTS.controlla(text, first, CHECK_WHAT[act], !!opts.json), system: opts.system, json: !!opts.json, temperature: 0, claude: true });
    if (opts.json) {
      const a = parseJSON(first), b = parseJSON(fixed);
      const ok = Object.keys(a).every(k => k in b && (!Array.isArray(a[k]) || (Array.isArray(b[k]) && (b[k].length > 0 || a[k].length === 0))));
      return ok ? fixed : first;
    }
    const t = fixed.trim();
    return t.length > first.length * 0.6 && t.length < first.length * 1.8 ? t : first;
  } catch { return first; }
}

async function runAction(act, source) {
  const text = source || reader.activeText();
  if (!text) return;
  reader.pause();
  const part = !source && reader.picked.size ? " (parte scelta)" : "";
  try {
    if (act === "interroga") { showView("ripassa"); ripassa.tab("interroga"); return quiz.setSource(text, reader.title()); }
    if (act === "palazzo") return palazzo.fromReader();
    if (act === "mappa") {
      busy(true, "Sto creando la mappa…");
      const base = await studyBase(text);
      busy(true, "Sto creando la mappa…");
      const data = parseJSON(await askChecked("mappa", base, { prompt: PROMPTS.mappa(base), system: SYSTEM_TUTOR, json: true }));
      mindmap.load(normalizeMap(data));
      showView("mappa");
      return;
    }
    if (act === "flashcard") {
      busy(true, "Sto preparando le flashcard…");
      const base = await studyBase(text);
      busy(true, "Sto preparando le flashcard…");
      return makeDeck(parseJSON(await askChecked("flashcard", base, { prompt: PROMPTS.flashcard(base), system: SYSTEM_TUTOR, json: true })));
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
      const base = act === "esercizio" ? text : await studyBase(text);
      busy(true, BUSY_TEXT[act]);
      const data = parseJSON(await askChecked(act, base, { prompt: PROMPTS[act](base), system: SYSTEM_TUTOR, json: true, temperature: 0.2 }));
      const r = act === "linea" ? renderTimeline(data) : act === "confronta" ? renderCompare(data) : renderExercise(data);
      return showResult(r.title + part, r.html, r.md);
    }
    busy(true, BUSY_TEXT[act] || "Ci sto pensando…");
    let out;
    if (act === "riassunto") out = await studySummary(text);
    else if (act === "semplifica" && wordCount(text) > LONG_TEXT) {
      const parts = chunkText(text), outs = [];
      for (let k = 0; k < parts.length; k++) { busy(true, `Semplifico la parte ${k + 1} di ${parts.length}…`); outs.push((await ask({ prompt: PROMPTS.semplifica(parts[k]), system: SYSTEM_TUTOR })).trim()); }
      out = outs.join("\n\n");
    } else {
      const base = ["parole", "formulario", "spiega"].includes(act) ? await studyBase(text) : text;
      busy(true, BUSY_TEXT[act] || "Ci sto pensando…");
      out = await askChecked(act, base, { prompt: PROMPTS[act](base), system: SYSTEM_TUTOR });
    }
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
    if (this.moving) this.toggleMove();
    this.linking = null; $("#mapWrap").classList.remove("linking");
    this.root = root;
    this.savedId = savedId;
    this.zoom = null;
    this.history = [];
    this.select(null);
    this.persist();
    this.draw({ center: true });
    mapImages.preload(root).then(added => { if (added && this.root === root) this.draw(); }).catch(() => {});
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
        this.change(() => { sibs.splice(i, 1); this.cleanLinks(); });
        return this.select(null);
      }
      case "link": {
        this.select(null);              // nascondo la barra: non deve coprire i riquadri
        this.linking = id;
        $("#mapWrap").classList.add("linking");
        $(`.map-node[data-id="${id}"]`)?.classList.add("sel");
        return toast("Ora tocca il riquadro da collegare. Tocca uno spazio vuoto per annullare.", 5000);
      }
      case "label": {
        if (!parent) return toast("Il centro non ha una linea in entrata: scegli un altro riquadro.");
        const t = await uiPrompt(`Parola sulla linea che arriva a «${node.text}»`, node.label || "", "Es. causa, produce, è formato da, si divide in. Lascia vuoto per toglierla.");
        if (t === null) return;
        return this.change(() => { node.label = t || undefined; });
      }
      case "img": return imgPicker.open(node);
      case "color": {
        const names = ["Arancio", "Verde", "Blu", "Rosa", "Giallo", "Viola", "Azzurro"];
        const c = await uiDialog({ title: `Colore di «${node.text}»`, message: node.children.length ? "Il colore vale anche per le idee collegate sotto." : "",
          buttons: [...names.map((nm, k) => ({ label: nm, value: String(k), swatch: BRANCH_COLORS[k] })), { label: "Automatico", value: "auto" }] });
        if (c === null) return;
        return this.change(() => { node.color = c === "auto" ? undefined : +c; });
      }
    }
  },

  /** Toglie i collegamenti che puntano a riquadri che non ci sono più. */
  cleanLinks() {
    if (!this.root.links) return;
    const ids = new Set();
    const walk = (n) => { ids.add(n.id); n.children.forEach(walk); };
    walk(this.root);
    this.root.links = this.root.links.filter(l => ids.has(l.a) && ids.has(l.b));
  },

  /** Secondo tocco del «Collega»: crea la freccia con la parola di collegamento. */
  async finishLink(targetId) {
    const from = this.linking;
    this.linking = null;
    $("#mapWrap").classList.remove("linking");
    if (!targetId || targetId === from) return;
    const A = this.find(from)?.node, B = this.find(targetId)?.node;
    if (!A || !B) return;
    const t = await uiPrompt(`Collegamento da «${A.text}» a «${B.text}»`, "", "Scrivi la parola di collegamento (es. causa, influenza, è un esempio di). Puoi anche lasciarla vuota.");
    if (t === null) return;
    this.change(() => { (this.root.links ||= []).push({ a: from, b: targetId, label: t || "" }); });
    toast("Collegamento creato. Toccalo per cambiarlo o toglierlo.");
  },

  async editLink(i) {
    const l = this.root.links?.[i];
    if (!l) return;
    const A = this.find(l.a)?.node, B = this.find(l.b)?.node;
    const r = await uiDialog({ title: `Collegamento da «${A?.text}» a «${B?.text}»`, input: l.label || "",
      buttons: [{ label: "Togli collegamento", value: "del", danger: true }, { label: "Annulla", value: null }, { label: "Salva", value: "ok", primary: true }] });
    if (!r || r.choice === null) return;
    if (r.choice === "del") this.change(() => this.root.links.splice(i, 1));
    else this.change(() => { l.label = r.text; });
  },

  /** Modalità «Sposta»: si trascinano i riquadri; lasciati sopra un altro, ne diventano le idee collegate. */
  toggleMove() {
    this.moving = !this.moving;
    $("#mapWrap").classList.toggle("moving", this.moving);
    const b = $("#btnMapMove");
    b.classList.toggle("on", this.moving);
    b.innerHTML = this.moving ? `${icon("check")}<span>Fatto</span>` : `${icon("hand")}<span>Sposta</span>`;
    if (this.moving) { this.select(null); toast("Trascina i riquadri. Lasciane uno sopra un altro per spostarlo in quel ramo.", 5000); }
  },

  /** Trascinamento in modalità «Sposta» */
  dragStart(e, g) {
    const id = g.dataset.id;
    if (id === this.root.id) { toast("Il centro resta fermo: sposta gli altri riquadri."); return null; }
    const f = this.find(id);
    const ids = new Set();
    const walk = (n) => { ids.add(n.id); n.children.forEach(walk); };
    walk(f.node);
    const groups = [...$$("#mapWrap .map-node")].filter(x => ids.has(x.dataset.id));
    groups.forEach(x => { x.style.pointerEvents = "none"; x.classList.add("dragging"); });
    return { id, ids, groups, x0: e.clientX, y0: e.clientY, target: null };
  },
  dragMove(e, d) {
    const z = this.zoom || 1;
    const dx = (e.clientX - d.x0) / z, dy = (e.clientY - d.y0) / z;
    d.groups.forEach(x => x.setAttribute("transform", `translate(${dx},${dy})`));
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".map-node");
    const tid = under && !d.ids.has(under.dataset.id) ? under.dataset.id : null;
    if (tid !== d.target) {
      $$("#mapWrap .map-node.drop").forEach(x => x.classList.remove("drop"));
      if (tid) under.classList.add("drop");
      d.target = tid;
    }
    // vicino al bordo, la mappa scorre da sola
    const w = $("#mapWrap"), r = w.getBoundingClientRect();
    if (e.clientX > r.right - 30) w.scrollLeft += 12; else if (e.clientX < r.left + 30) w.scrollLeft -= 12;
    if (e.clientY > r.bottom - 30) w.scrollTop += 12; else if (e.clientY < r.top + 30) w.scrollTop -= 12;
    d.dx = dx; d.dy = dy;
  },
  dragEnd(d) {
    const f = this.find(d.id);
    if (!f) return;
    if (d.target) {
      const T = this.find(d.target).node;
      this.change(() => {
        f.parent.children.splice(f.parent.children.indexOf(f.node), 1);
        f.node.off = undefined;
        T.children.push(f.node);
      });
      toast(`«${f.node.text}» ora è sotto «${T.text}»`);
    } else if (Math.hypot(d.dx || 0, d.dy || 0) > 4) {
      this.change(() => { f.node.off = { x: (f.node.off?.x || 0) + d.dx, y: (f.node.off?.y || 0) + d.dy }; });
    } else this.draw();
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
      // quello che ha aggiunto lei (immagini, colori, parole sulle linee, collegamenti) resta al suo posto
      const key = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const old = new Map();
      const walkOld = (n) => { old.set(key(n.text), n); n.children.forEach(walkOld); };
      walkOld(this.root);
      const newByKey = new Map();
      const walkNew = (n) => {
        const o = old.get(key(n.text));
        if (o) { if (o.img) n.img = o.img; if (o.color != null) n.color = o.color; if (o.label) n.label = o.label; }
        newByKey.set(key(n.text), n); n.children.forEach(walkNew);
      };
      walkNew(fresh);
      const idToKey = new Map(); old.forEach((n, k) => idToKey.set(n.id, k));
      fresh.links = (this.root.links || []).map(l => ({ ...l, a: newByKey.get(idToKey.get(l.a))?.id, b: newByKey.get(idToKey.get(l.b))?.id })).filter(l => l.a && l.b);
      const lost = mapImages.ids(this.root).filter(i => !mapImages.ids(fresh).includes(i));
      if (lost.length) {
        // l'IA ha cambiato il testo di un riquadro con immagine: rimetto l'immagine sul riquadro più simile del suo ramo
        const all = []; const w = (n) => { all.push(n); n.children.forEach(w); }; w(fresh);
        for (const id of lost) {
          let src; const f = (n) => { if (n.img === id) src = n; n.children.forEach(f); }; f(this.root);
          const words = key(src?.text).split(" ").filter(x => x.length > 3);
          const best = all.filter(n => !n.img).map(n => ({ n, sc: words.filter(x => key(n.text).includes(x)).length })).sort((a, b) => b.sc - a.sc)[0];
          if (best && best.sc > 0) best.n.img = id;
        }
      }
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
    const H_GAP = 64, V_GAP = 18, PAD_X = 14, PAD_Y = 10, MAXW = 190;
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
      n._img = null;
      const im = n.img && mapImages.cache.get(n.img);
      if (im) {
        // immagine sopra il testo, dentro il riquadro
        let iw = Math.min(depth === 0 ? 240 : 200, Math.max(n._w - 12, 150)), ih = Math.round(iw * im.h / im.w);
        if (ih > 170) { ih = 170; iw = Math.round(ih * im.w / im.h); }
        n._img = { src: im.src, w: iw, h: ih };
        n._w = Math.max(n._w, iw + 12);
        n._h += ih + 6;
      }
      if (depth > 0 && n.color != null && BRANCH_COLORS[n.color]) color = BRANCH_COLORS[n.color];
      n._color = color;
      n.children.forEach((c, i) => prep(c, depth + 1, depth === 0 ? BRANCH_COLORS[(c.color ?? i) % BRANCH_COLORS.length] : color));
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

    // spostamenti fatti a mano: valgono per il riquadro e per tutto il suo ramo
    const all = [];
    const walk = (n, parent, ox, oy) => {
      const x = ox + (n.off?.x || 0), y = oy + (n.off?.y || 0);
      n._x += x; n._y += y;
      all.push({ n, parent });
      n.children.forEach(c => walk(c, n, x, y));
    };
    walk(r, null, 0, 0);
    // confini (con margine per le parole sulle frecce)
    const M = 34;
    const minX = Math.min(...all.map(a => a.n._x)), maxX = Math.max(...all.map(a => a.n._x + a.n._w));
    const minY = Math.min(...all.map(a => a.n._y)), maxY = Math.max(...all.map(a => a.n._y + a.n._h));
    all.forEach(a => { a.n._x += -minX + M; a.n._y += -minY + M; });
    this.nodes = all;
    this.byId = Object.fromEntries(all.map(a => [a.n.id, a.n]));
    return { width: maxX - minX + M * 2, height: maxY - minY + M * 2 };
  },

  /** Linea tra due riquadri: dal lato giusto, in orizzontale o in verticale. */
  geom(a, b) {
    const acx = a._x + a._w / 2, acy = a._y + a._h / 2, bcx = b._x + b._w / 2, bcy = b._y + b._h / 2;
    const dx = bcx - acx, dy = bcy - acy;
    let x1, y1, x2, y2, d;
    if (Math.abs(dx) > (a._w + b._w) / 2 * 0.75 || Math.abs(dx) * 1.2 > Math.abs(dy)) {
      x1 = dx > 0 ? a._x + a._w : a._x; x2 = dx > 0 ? b._x : b._x + b._w; y1 = acy; y2 = bcy;
      const mx = (x1 + x2) / 2;
      d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    } else {
      y1 = dy > 0 ? a._y + a._h : a._y; y2 = dy > 0 ? b._y : b._y + b._h; x1 = acx; x2 = bcx;
      const my = (y1 + y2) / 2;
      d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
    }
    return { d, x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  },

  edgePath(p, c) { return this.geom(p, c).d; },

  /** Etichetta (parola di collegamento) in mezzo a una linea */
  labelSvg(x, y, text, color, attrs, print) {
    const w = Math.ceil(this.measure()(text, 13, false) + 14), h = 22;
    const bg = print ? "#ffffff" : "var(--sheet)", ink = print ? "#1c2440" : "var(--ink)";
    return `<g class="map-label" ${attrs}><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="11" fill="${bg}" stroke="${color}" stroke-width="1.5"/>
      <text x="${x}" y="${y + 4.5}" text-anchor="middle" font-family="Atkinson Hyperlegible, Verdana, sans-serif" font-size="13" font-style="italic" fill="${ink}">${escapeHtml(text)}</text></g>`;
  },

  /** Riquadri e collegamenti in SVG. Per la stampa: colori chiari fissi e niente selezione. */
  svgParts({ print = false } = {}) {
    const dark = !print && settings.theme === "scuro";
    const ACC = print ? "#1c2440" : "var(--ink)", ACC_INK = print ? "#ffffff" : "var(--app)";
    let edges = "", boxes = "", labels = "";
    for (const { n, parent } of this.nodes) {
      const fill = n._depth === 0 ? ACC : (dark ? n._color[1] : n._color[0]);
      const stroke = n._depth === 0 ? ACC : n._color[1];
      const ink = n._depth === 0 ? ACC_INK : (dark ? "#fff" : "#2b2a27");
      if (parent) {
        const gm = this.geom(parent, n);
        edges += `<path d="${gm.d}" fill="none" stroke="${stroke}" stroke-width="${n._depth === 1 ? 4 : 2.5}" stroke-linecap="round"/>`;
        if (n.label) labels += this.labelSvg(gm.mx, gm.my, n.label, stroke, `data-elabel="${n.id}"`, print);
      }
      const tx = n._x + n._w / 2;
      const ty0 = n._y + 10 + n._size + (n._img ? n._img.h + 6 : 0);
      const imgSvg = n._img ? `<image href="${n._img.src}" x="${n._x + (n._w - n._img.w) / 2}" y="${n._y + 6}" width="${n._img.w}" height="${n._img.h}" preserveAspectRatio="xMidYMid meet"/>` : "";
      const tspans = n._lines.map((l, i) => `<tspan x="${tx}" y="${ty0 + i * n._size * 1.3 - n._size * 0.15}">${escapeHtml(l)}</tspan>`).join("");
      const dash = n.ai ? ` stroke-dasharray="8 5"` : "";
      const sel = !print && n.id === this.selected ? " sel" : "";
      boxes += `<g class="map-node${sel}" data-id="${n.id}" role="button" tabindex="0">
        <rect x="${n._x}" y="${n._y}" width="${n._w}" height="${n._h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${n.ai ? 3 : 2}"${dash}/>
        ${imgSvg}<text text-anchor="middle" font-family="Atkinson Hyperlegible, Verdana, sans-serif" font-size="${n._size}" font-weight="${n._bold ? 700 : 400}" fill="${ink}">${tspans}</text>
      </g>`;
    }
    // collegamenti trasversali: frecce tratteggiate con la parola di collegamento
    const LC = print ? "#5b6482" : (dark ? "#a9b0c7" : "#5b6482");
    (this.root.links || []).forEach((l, i) => {
      const a = this.byId?.[l.a], b = this.byId?.[l.b];
      if (!a || !b) return;
      const gm = this.geom(a, b);
      edges += `<path d="${gm.d}" fill="none" stroke="${LC}" stroke-width="2.2" stroke-dasharray="7 5" marker-end="url(#mapArrow)" data-link="${i}"/>`;
      edges += `<path d="${gm.d}" fill="none" stroke="transparent" stroke-width="16" data-link="${i}" class="map-hit"/>`;
      if (l.label) labels += this.labelSvg(gm.mx, gm.my, l.label, LC, `data-link="${i}"`, print);
    });
    const defs = `<defs><marker id="mapArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${LC}"/></marker></defs>`;
    return { edges: defs + edges, boxes: boxes + labels };
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

  async toggleLayout() {
    const moved = JSON.stringify(cleanMap(this.root)).includes('"off":');
    if (moved) {
      const c = await uiDialog({ title: "Forma della mappa", message: "Hai spostato a mano alcuni riquadri.",
        buttons: [{ label: "Annulla", value: null }, { label: "Rimetti tutto in ordine", value: "reset" }, { label: "Cambia forma", value: "shape", primary: true }] });
      if (!c) return;
      if (c === "reset") {
        const walk = (n) => { delete n.off; n.children.forEach(walk); };
        this.zoom = null;
        return this.change(() => walk(this.root));
      }
    }
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
    const curve = (gm) => {
      ctx.beginPath(); ctx.moveTo(gm.x1, gm.y1);
      if (gm.d.includes(`C${gm.mx},`)) ctx.bezierCurveTo(gm.mx, gm.y1, gm.mx, gm.y2, gm.x2, gm.y2);
      else ctx.bezierCurveTo(gm.x1, gm.my, gm.x2, gm.my, gm.x2, gm.y2);
    };
    const pendingLabels = [];
    for (const { n, parent } of this.nodes) {
      if (!parent) continue;
      const gm = this.geom(parent, n);
      curve(gm); ctx.strokeStyle = n._color[1]; ctx.lineWidth = n._depth === 1 ? 4 : 2.5; ctx.lineCap = "round"; ctx.stroke();
      if (n.label) pendingLabels.push([gm.mx, gm.my, n.label, n._color[1]]);
    }
    (this.root.links || []).forEach(l => {
      const A = this.byId[l.a], B = this.byId[l.b]; if (!A || !B) return;
      const gm = this.geom(A, B);
      ctx.setLineDash([7, 5]); curve(gm); ctx.strokeStyle = "#5b6482"; ctx.lineWidth = 2.2; ctx.stroke(); ctx.setLineDash([]);
      const ang = Math.atan2(gm.y2 - (gm.d.includes(`C${gm.mx},`) ? gm.y2 : gm.my), gm.x2 - (gm.d.includes(`C${gm.mx},`) ? gm.mx : gm.x2));
      ctx.beginPath(); ctx.moveTo(gm.x2, gm.y2);
      ctx.lineTo(gm.x2 - 10 * Math.cos(ang - 0.45), gm.y2 - 10 * Math.sin(ang - 0.45));
      ctx.lineTo(gm.x2 - 10 * Math.cos(ang + 0.45), gm.y2 - 10 * Math.sin(ang + 0.45));
      ctx.fillStyle = "#5b6482"; ctx.fill();
      if (l.label) pendingLabels.push([gm.mx, gm.my, l.label, "#5b6482"]);
    });
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
    for (const [x, y, t, col] of pendingLabels) {
      ctx.font = `italic 13px "Atkinson Hyperlegible", Verdana, sans-serif`;
      const w = ctx.measureText(t).width + 14;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 11, w, 22, 11) : ctx.rect(x - w / 2, y - 11, w, 22);
      ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = "#1c2440"; ctx.textAlign = "center"; ctx.fillText(t, x, y + 4.5);
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
function makeRecorder(btn, statusEl, onText, idleMsg, { maxSec = 600 } = {}) {
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
      if (sec >= maxSec) r.rec.stop(); // limite tecnico della trascrizione
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
    if (name === "spiega") spiega.fill();
    if (name === "prof") prof.render();
    if (name === "palazzo") palazzo.render();
    if (name === "piano") planner.render();
  }
};

/* ---------- Testo a zoom: in una frase → i punti → tutto il testo ---------- */
const zoom = {
  level: 3, data: null,
  hash(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + t.length; },
  reset() {
    this.level = 3; this.data = null;
    $$("#zoomBar [data-z]").forEach(b => b.classList.toggle("on", b.dataset.z === "3"));
    $("#zoomView")?.classList.add("hidden");
    $("#reader")?.classList.remove("hidden");
  },
  async set(level) {
    level = Number(level);
    if (level !== 3 && !this.data) {
      const key = "zoom:" + this.hash(reader.text);
      this.data = store.get(key, null);
      if (!this.data) {
        try {
          busy(true, "Preparo la vista a zoom…");
          const d = parseJSON(await ask({ prompt: PROMPTS.zoom(reader.text.slice(0, 40000)), json: true, temperature: 0.2 }));
          if (!d.frase || !Array.isArray(d.punti) || !d.punti.length) throw new Error();
          this.data = d;
          store.set(key, d);
          const keys = store.get("zoomKeys", []).filter(k => k !== key); keys.push(key);
          keys.slice(0, Math.max(0, keys.length - 20)).forEach(k => { try { localStorage.removeItem("sf." + k); } catch { /* niente */ } });
          store.set("zoomKeys", keys.slice(-20));
        } catch (e) { busy(false); return toast(e.message && e.message.length > 3 ? e.message : "Non sono riuscito a preparare lo zoom. Riprova.", 6000); }
        busy(false);
      }
    }
    tts.stop();
    this.level = level;
    $$("#zoomBar [data-z]").forEach(b => b.classList.toggle("on", Number(b.dataset.z) === level));
    $("#reader").classList.toggle("hidden", level !== 3);
    const v = $("#zoomView");
    v.classList.toggle("hidden", level === 3);
    if (level === 3) return;
    const d = this.data;
    v.innerHTML = level === 1
      ? `<p class="zm-frase">${escapeHtml(d.frase)}</p>
         ${(d.parole_chiave || []).length ? `<div class="chips">${d.parole_chiave.map(k => `<span class="chip on">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
         <div class="btn-row"><button class="btn" data-zs="say">${icon("volume")}Ascolta</button><button class="btn" data-zs="save">${icon("bookmark")}Salva nel quaderno</button><button class="btn primary" data-z="2">Allarga: i punti principali ›</button></div>`
      : `<p class="zm-frase small">${escapeHtml(d.frase)}</p>
         <ol class="zm-points">${d.punti.map((p, i) => `<li><button data-jump="${i}"><b>${escapeHtml(p.titolo || "")}</b><span>${escapeHtml(p.frase || "")}</span><small>Leggi questa parte nel testo ›</small></button></li>`).join("")}</ol>
         <div class="btn-row"><button class="btn" data-zs="say">${icon("volume")}Ascolta</button><button class="btn" data-zs="save">${icon("bookmark")}Salva nel quaderno</button><button class="btn primary" data-z="3">Allarga: tutto il testo ›</button></div>`;
  },
  say() {
    const d = this.data; if (!d) return;
    tts.say(this.level === 1 ? d.frase : [d.frase, ...d.punti.map((p, i) => `${i + 1}. ${p.titolo}. ${p.frase}`)].join(" "), null, reader.lang);
  },
  /** I punti (con la frase e le parole chiave) diventano un testo del quaderno */
  async save() {
    const d = this.data; if (!d) return;
    const r = await askSave("Salva i punti nel quaderno", "I punti: " + reader.title(), reader.subject);
    if (!r) return;
    const md = [`# ${reader.title()}`, d.frase, (d.parole_chiave || []).length ? "Parole chiave: " + d.parole_chiave.join(", ") : "",
      "# I punti", ...d.punti.map((p, i) => `${i + 1}. ${p.titolo}: ${p.frase}`)].filter(Boolean).join("\n\n");
    if (notebookPut({ id: uid(), type: "testo", title: r.title, subject: r.subject, date: todayLabel(), data: md })) toast("Punti salvati nel quaderno");
  },
  /** Dal punto al passaggio nel testo intero */
  jump(i) {
    const p = this.data?.punti?.[i]; if (!p) return;
    this.set(3);
    const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    const words = norm(p.ancora).split(" ").slice(0, 6);
    let k = -1;
    for (let n = words.length; n >= 3 && k < 0; n--) {
      const probe = words.slice(0, n).join(" ");
      k = reader.sentences.findIndex(sn => norm(sn.text).includes(probe));
    }
    if (k < 0) return toast("Non ho trovato il punto esatto: lo cerchi tu nel testo?");
    const el = reader.sentences[k].el;
    reader.idx = k;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("zm-flash"); setTimeout(() => el.classList.remove("zm-flash"), 2200);
  },
  bind() {
    const click = (e) => {
      const z = e.target.closest("[data-z]"); if (z) return this.set(z.dataset.z);
      const j = e.target.closest("[data-jump]"); if (j) return this.jump(+j.dataset.jump);
      if (e.target.closest("[data-zs=say]")) return this.say();
      if (e.target.closest("[data-zs=save]")) return this.save();
    };
    $("#zoomBar").addEventListener("click", click);
    $("#zoomView").addEventListener("click", click);
  }
};

/* ---------- Le domande dei professori ---------- */
const prof = {
  current: null, rec: null, recErr: null,
  list() { return store.get("profs", []); },
  entries(id) { return store.get("profQ", []).filter(e => e.profId === id).sort((a, b) => b.date.localeCompare(a.date)); },
  storico(id) {
    return this.entries(id).map(e => `- ${e.date} · ${e.tipo}${e.argomento ? " su " + e.argomento : ""}${e.voto ? " · voto " + e.voto : ""}\n` +
      (e.domande || []).map(q => `  domanda: ${q}`).join("\n") + ((e.errori || []).length ? "\n" + e.errori.map(x => `  errore: ${x.domanda} → ${x.cosa_mancava}`).join("\n") : "")).join("\n");
  },
  render() {
    const ps = this.list();
    $("#profList").innerHTML = ps.length ? ps.map(p => `<button class="chip${p.id === this.current ? " on" : ""}" data-prof="${p.id}">${escapeHtml(p.name)}${p.subject ? ` <small>· ${escapeHtml(p.subject)}</small>` : ""}</button>`).join("")
      : `<p class="hint">Ancora nessun professore. Aggiungi quelli che interrogano di più.</p>`;
    const p = ps.find(x => x.id === this.current);
    $("#profCard").classList.toggle("hidden", !p);
    if (!p) return;
    $("#profName").textContent = p.name + (p.subject ? ` · ${p.subject}` : "");
    const es = this.entries(p.id);
    const nQ = es.reduce((n, e) => n + (e.domande || []).length, 0);
    $("#profCount").textContent = es.length ? `${es.length} ${es.length === 1 ? "interrogazione o verifica annotata" : "interrogazioni e verifiche annotate"}, ${nQ} domande` : "Ancora niente di annotato: comincia dalla prossima interrogazione.";
    $("#profArchive").innerHTML = es.map(e => `<li><div class="pa-head"><b>${escapeHtml(dayLabel(e.date))} · ${escapeHtml(e.tipo)}${e.argomento ? ": " + escapeHtml(e.argomento) : ""}</b>${e.voto ? `<span class="pa-voto">${escapeHtml(String(e.voto))}</span>` : ""}
        <button class="icon-btn" data-pdel="${e.id}" aria-label="Elimina">${icon("trash")}</button></div>
      <ul>${(e.domande || []).map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
      ${(e.errori || []).length ? `<p class="pa-err"><b>Punti persi:</b> ${e.errori.map(x => escapeHtml(`${x.domanda}: ${x.cosa_mancava}`)).join(" · ")}</p>` : ""}</li>`).join("");
    const st = store.get("profStyle:" + p.id, null);
    $("#profStyle").innerHTML = st && st.n === es.length ? this.styleHtml(st.d) : "";
    sourceSelect($("#profSource"));
  },
  styleHtml(d) {
    const L = (x) => Array.isArray(x) ? x : [];
    return `<h3>Come interroga</h3><p>${escapeHtml(d.stile || "")}</p>
      ${L(d.tipi_di_domanda).length ? `<ul class="pf-types">${L(d.tipi_di_domanda).map(t => `<li><span class="pf-freq f-${escapeHtml((t.frequenza || "").split(" ")[0])}">${escapeHtml(t.frequenza || "")}</span><b>${escapeHtml(t.tipo || "")}</b>${t.esempio ? `<br><span class="hint">«${escapeHtml(t.esempio)}»</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${L(d.temi_frequenti).length ? `<h3>Chiede spesso</h3><div class="chips">${L(d.temi_frequenti).map(t => `<span class="chip on">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      ${L(d.punti_deboli).length ? `<h3>Dove perdi punti</h3><ul>${L(d.punti_deboli).map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
      ${L(d.consigli).length ? `<div class="sp-tip"><b>Per prepararti con questo professore:</b><ul>${L(d.consigli).map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : ""}`;
  },
  async add() {
    const r = await uiDialog({ title: "Nuovo professore", message: "Come lo chiami? Per esempio «Prof.ssa Rossi». Poi scegli la materia.", input: "", subject: "",
      buttons: [{ label: "Annulla", value: null }, { label: "Aggiungi", value: "ok", primary: true }] });
    if (!r || r.choice !== "ok" || !r.text) return;
    const p = { id: uid(), name: r.text, subject: r.subject || "" };
    store.set("profs", [...this.list(), p]);
    this.current = p.id; this.render();
  },
  async remove() {
    const p = this.list().find(x => x.id === this.current); if (!p) return;
    if (!(await uiConfirm(`Togliere ${p.name} e tutto il suo archivio?`, "Togli", true))) return;
    store.set("profs", this.list().filter(x => x.id !== p.id));
    store.set("profQ", store.get("profQ", []).filter(e => e.profId !== p.id));
    this.current = null; this.render();
  },
  openNote() {
    $("#pqTipo").value = "Interrogazione"; $("#pqTopic").value = ""; $("#pqText").value = ""; $("#pqErr").value = ""; $("#pqVoto").value = "";
    $("#dlgProfQ").showModal();
  },
  async saveNote() {
    const p = this.list().find(x => x.id === this.current); if (!p) return;
    const text = $("#pqText").value.trim(), err = $("#pqErr").value.trim();
    if (!text) return toast("Scrivi o detta almeno una domanda.");
    let d = { argomento: $("#pqTopic").value.trim(), domande: text.split(/\n+/).map(x => x.trim()).filter(Boolean), errori: [], voto: $("#pqVoto").value.trim() || null };
    try {
      busy(true, "Metto in ordine le domande…");
      const out = parseJSON(await ask({ prompt: PROMPTS.profEstrai(text + (err ? "\nDove ho perso punti: " + err : ""), p.name, p.subject), json: true, temperature: 0.1 }));
      if (Array.isArray(out.domande) && out.domande.length) d = { argomento: d.argomento || out.argomento || "", domande: out.domande, errori: out.errori || [], voto: d.voto || out.voto || null };
    } catch { if (err) d.errori = [{ domanda: "", cosa_mancava: err }]; }
    finally { busy(false); }
    this.store({ ...d, tipo: $("#pqTipo").value });
    $("#dlgProfQ").close();
  },
  async audio(file) {
    if (!file) return;
    try {
      busy(true, "Trascrivo il tuo audio…");
      const t = await transcribeFile(file, (m) => busy(true, m));
      if (!t.trim()) throw new Error("Nell'audio non ho sentito parole. Riprova con un altro file.");
      const ta = $("#pqText"); ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + t.trim();
      if (!$("#dlgProfQ").open) $("#dlgProfQ").showModal();
      toast("Ho scritto il tuo audio: controlla e premi Salva.", 5000);
    } catch (e) { toast(e.message || "Non sono riuscito a trascrivere l'audio.", 6000); }
    finally { busy(false); }
  },
  async photo(file) {
    const p = this.list().find(x => x.id === this.current); if (!p || !file) return;
    try {
      busy(true, "Leggo la verifica corretta…");
      const img = await imageToBase64(file);
      const d = parseJSON(await ask({ prompt: PROMPTS.profFoto(p.name, p.subject), images: [img], json: true, temperature: 0.1 }));
      if (!Array.isArray(d.domande) || !d.domande.length) throw new Error("Non sono riuscito a leggere le domande. Prova con una foto più vicina e dritta.");
      this.store({ ...d, tipo: "Verifica scritta" });
    } catch (e) { toast(e.message || "Non sono riuscito a leggere la foto.", 6000); }
    finally { busy(false); }
  },
  store(d) {
    const e = { id: uid(), profId: this.current, date: isoDay(new Date()), tipo: d.tipo, argomento: d.argomento || "", domande: d.domande || [], errori: (d.errori || []).filter(x => x && (x.cosa_mancava || x.domanda)), voto: d.voto || null };
    store.set("profQ", [e, ...store.get("profQ", [])]);
    toast(`Annotate ${e.domande.length} domande.`);
    this.render();
  },
  async analyze() {
    const p = this.list().find(x => x.id === this.current); if (!p) return;
    const es = this.entries(p.id);
    if (!es.length) return toast("Prima annota almeno un'interrogazione o una verifica.");
    try {
      busy(true, `Studio come interroga ${p.name}…`);
      const d = parseJSON(await ask({ prompt: PROMPTS.profStile(p.name, p.subject, this.storico(p.id)), json: true, temperature: 0.2, claude: true }));
      store.set("profStyle:" + p.id, { n: es.length, d });
      this.render();
      $("#profStyle").scrollIntoView({ behavior: "smooth" });
    } catch (e) { toast(e.message || "Non sono riuscito ad analizzare l'archivio.", 6000); }
    finally { busy(false); }
  },
  async train() {
    const p = this.list().find(x => x.id === this.current); if (!p) return;
    const src = pickSource($("#profSource"));
    if (!src?.text) return toast("Scegli l'argomento su cui allenarti.");
    if (!this.entries(p.id).length) return toast("Prima annota qualche sua domanda: così imito il suo stile.");
    try {
      busy(true, `Preparo le domande come le farebbe ${p.name}…`);
      const d = parseJSON(await ask({ prompt: PROMPTS.profDomande(p.name, p.subject, this.storico(p.id), src.text.slice(0, 30000)), json: true, temperature: 0.5, claude: true }));
      const qs = (d.domande || []).filter(Boolean);
      if (!qs.length) throw new Error();
      busy(false);
      showView("ripassa"); ripassa.tab("interroga");
      quiz.setSource(src.text, src.title);
      quiz.queue = qs; quiz.queueBy = p.name;
      quiz.next();
    } catch (e) { busy(false); toast(e.message || "Non sono riuscito a preparare le domande.", 6000); }
  },
  bind() {
    $("#profList").addEventListener("click", (e) => { const b = e.target.closest("[data-prof]"); if (b) { this.current = b.dataset.prof; this.render(); } });
    $("#btnProfAdd").addEventListener("click", () => this.add());
    $("#btnProfDel").addEventListener("click", () => this.remove());
    $("#btnProfNote").addEventListener("click", () => this.openNote());
    $("#profPhoto").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; this.photo(f); });
    const onAudio = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f && !$("#dlgProfQ").open) this.openNote(); this.audio(f); };
    $("#profAudio").addEventListener("change", onAudio);
    $("#pqAudio").addEventListener("change", onAudio);
    $("#btnProfStyle").addEventListener("click", () => this.analyze());
    $("#btnProfTrain").addEventListener("click", () => this.train());
    $("#profArchive").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-pdel]"); if (!b) return;
      if (!(await uiConfirm("Eliminare questa annotazione?", "Elimina", true))) return;
      store.set("profQ", store.get("profQ", []).filter(x => x.id !== b.dataset.pdel)); this.render();
    });
    $("#btnPqSave").addEventListener("click", () => this.saveNote());
    $("#btnPqCancel").addEventListener("click", () => { this.rec?.cancel(); this.recErr?.cancel(); $("#dlgProfQ").close(); });
    const append = (sel) => (t) => { const ta = $(sel); ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + t; };
    this.rec = makeRecorder($("#pqMic"), $("#pqMicStatus"), append("#pqText"), "Tocca il microfono e racconta cosa ti ha chiesto.");
    this.recErr = makeRecorder($("#pqMicErr"), $("#pqMicErrStatus"), append("#pqErr"), "");
    $("#pqMic").addEventListener("click", () => this.rec.toggle());
    $("#pqMicErr").addEventListener("click", () => this.recErr.toggle());
  }
};

/** Menu dei testi su cui lavorare: testo aperto e testi del quaderno. */
function sourceSelect(sel) {
  const keep = sel.value;
  const texts = store.get("notebook", []).filter(x => x.type === "testo");
  const opts = [];
  if (reader.text) opts.push(["reader", "Testo aperto in Studia: " + reader.title()]);
  texts.forEach(t => opts.push(["nb:" + t.id, `${t.subject ? t.subject + ": " : ""}${t.title}`]));
  sel.innerHTML = opts.length ? opts.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("") : `<option value="">Prima apri un testo in Studia o salvane uno nel quaderno</option>`;
  if (keep && opts.some(o => o[0] === keep)) sel.value = keep;
}
function pickSource(sel) {
  const v = sel.value;
  if (v === "reader") return { text: reader.activeText(), title: reader.title() };
  if (v.startsWith("nb:")) { const t = store.get("notebook", []).find(x => x.id === v.slice(3)); if (t) return { text: t.data, title: t.title }; }
  return null;
}

/* ---------- Cosa c'è di nuovo: alla prima apertura dopo un aggiornamento ---------- */
const NEWS = [
  { v: 29, icon: "list", title: "Studio al livello del testo", text: "Riassunti, mappe, schede e flashcard restano al livello della fonte, anche universitario o di lavoro: completi, con nomi, date, dati e termini. Solo «Spiegami» usa parole semplici. I documenti lunghi vengono lavorati parte per parte.", go: "leggi" },
  { v: 27, icon: "home", title: "Palazzo della memoria", text: "Le sequenze da ricordare diventano una passeggiata a voce nei posti di casa tua.", go: "palazzo" },
  { v: 26, icon: "library", title: "Il Quaderno è in basso", text: "Tutto quello che salvi, a portata di dito. E «Preparo la verifica» ti dice cosa ha salvato.", go: "quaderno" },
  { v: 25, icon: "volume", title: "I tuoi audio", text: "Carica un memo vocale: diventa testo, domande dei professori o una spiegazione da valutare.", go: "leggi" },
  { v: 24, icon: "people", title: "Le domande dei professori", text: "Annota cosa ti chiedono: Zaino impara come interrogano e ti allena con domande come le loro.", go: "prof" },
  { v: 23, icon: "present", title: "Spiegalo tu", text: "Spiega a voce, senza fretta: vedi quanto hai coperto, cosa mancava e i tuoi progressi.", go: "spiega" },
  { v: 23, icon: "layers", title: "Testo a zoom", text: "Sopra ogni testo: il succo in una frase, poi i punti, poi tutto. Tocca un punto per saltare lì.", go: "zoom" },
  { v: 22, icon: "feather", title: "Letteratura latina", text: "35 autori per età, generi letterari e schede con una frase in latino.", go: "latino" },
  { v: 21, icon: "people", title: "Scienze umane complete", text: "145 autori di pedagogia, psicologia, sociologia e antropologia, divisi per scuola.", go: "umane" },
  { v: 19, icon: "image", title: "Immagini nelle mappe", text: "Una foto o un'immagine da Wikipedia dentro ogni riquadro.", go: "mappa" },
  { v: 19, icon: "download", title: "Il lavoro è al sicuro", text: "Cestino per 30 giorni, una copia automatica al giorno e, sul computer, il salvataggio in una cartella.", go: "settings" },
  { v: 17, icon: "layers", title: "Preparo la verifica", text: "Riassunto, mappa, flashcard, domande probabili e piano, in un passo solo.", go: "leggi" },
  { v: 13, icon: "globe", title: "Testo da un sito o da Wikipedia", text: "Incolla un link o cerca un argomento: arriva solo il testo, pulito.", go: "web" }
];
const news = {
  pending() {
    const seen = Number(store.get("newsSeen", 0));
    return NEWS.filter(n => n.v > seen);
  },
  maybeShow() {
    if (!store.get("welcomed", false)) { store.set("newsSeen", Number(APP_VERSION)); return; }   // chi inizia ora vede la presentazione
    if (!settings.keyGemini && !settings.keyGroq && !settings.keyClaude) return;                   // prima le chiavi, le novità dopo
    const list = this.pending();
    if (list.length) setTimeout(() => this.open(list), 700);
    else store.set("newsSeen", Number(APP_VERSION));
  },
  open(list = NEWS) {
    const shown = list.slice(0, 7);
    $("#newsBody").innerHTML = `<p class="hint">${list.length > 1 ? "Ecco cosa è arrivato in Zaino. Tocca «Provalo» per andarci subito." : "Una novità in Zaino:"}</p>
      <ul class="news-list">${shown.map((n, i) => `<li><span class="tile">${icon(n.icon)}</span><div><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.text)}</p></div>
        <button class="btn small" data-news="${NEWS.indexOf(n)}">Provalo</button></li>`).join("")}</ul>
      ${list.length > shown.length ? `<p class="hint">…e altre ${list.length - shown.length}: le trovi tutte nella guida (il punto di domanda in alto).</p>` : ""}
      <div class="btn-row"><button class="btn primary" id="btnNewsOk">Ho capito</button></div>`;
    $("#dlgNews").showModal();
  },
  go(n) {
    $("#dlgNews").close();
    const t = n.go;
    if (["palazzo", "spiega", "prof", "interroga", "carte", "piano"].includes(t)) { showView("ripassa"); return ripassa.tab(t); }
    if (t === "settings") return openSettings();
    if (t === "web") { showView("leggi"); return web.showBox(); }
    if (t === "zoom") { showView("leggi"); return toast(reader.text ? "Sopra il testo trovi «Vista»: prova «In una frase»." : "Apri un testo: sopra troverai «Vista» con «In una frase» e «I punti».", 6000); }
    if (t === "leggi" && !reader.text) { showView("leggi"); return toast("Porta qui un testo: foto, PDF, audio o link.", 5000); }
    showView(t);
  },
  bind() {
    $("#dlgNews").addEventListener("click", (e) => {
      if (e.target.closest("#btnNewsOk")) return $("#dlgNews").close();
      const b = e.target.closest("[data-news]"); if (b) this.go(NEWS[+b.dataset.news]);
    });
    $("#dlgNews").addEventListener("close", () => store.set("newsSeen", Number(APP_VERSION)));
    $("#btnGuideNews")?.addEventListener("click", () => { $("#dlgGuide").close(); this.open(NEWS); });
  }
};

/* ---------- Palazzo della memoria (metodo dei loci, sul percorso di casa sua) ---------- */
const palazzo = {
  rec: null, recWhat: null, walk: null, step: 0, auto: false, quizMode: false, score: { ok: 0, no: 0 },
  palazzi() { return store.get("palazzi", []); },
  walks() { return store.get("passeggiate", []); },
  render() {
    const ps = this.palazzi(), ws = this.walks();
    $("#palList").innerHTML = ps.length ? ps.map(p => `<div class="pal-row"><span>${icon("map")}<b>${escapeHtml(p.name)}</b><small>${p.luoghi.length} luoghi</small></span>
        <button class="btn small ghost" data-pal-edit="${p.id}">Modifica</button></div>`).join("")
      : `<p class="hint">Prima crea il tuo percorso: per esempio i posti di casa tua, nell'ordine in cui li incontri entrando.</p>`;
    $("#palNewCard").classList.toggle("hidden", !ps.length);
    $("#palWhich").innerHTML = ps.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.luoghi.length} luoghi)</option>`).join("");
    $("#palUseText").closest("label").classList.toggle("hidden", !reader.text);
    $("#palWalks").innerHTML = ws.length ? ws.map(w => `<li><button class="pal-walk" data-walk="${w.id}"><b>${escapeHtml(w.titolo)}</b>
        <small>${w.elementi.length} posti · ${escapeHtml(this.palazzi().find(p => p.id === w.palazzoId)?.name || "")}${w.best != null ? ` · ricordati ${w.best} su ${w.elementi.length}` : ""}</small></button>
        <button class="icon-btn" data-walk-del="${w.id}" aria-label="Elimina">${icon("trash")}</button></li>`).join("")
      : `<li class="hint">Le passeggiate che crei restano qui, per ripassarle quando vuoi.</li>`;
  },
  /* -- il percorso -- */
  edit(id) {
    const p = this.palazzi().find(x => x.id === id);
    this.editing = p?.id || null;
    $("#palName").value = p?.name || (this.palazzi().length ? "" : "Casa mia");
    $("#palPlaces").value = p ? p.luoghi.join("\n") : "";
    $("#btnPalDelete").classList.toggle("hidden", !p);
    $("#dlgPal").showModal();
  },
  async cleanPlaces() {
    const t = $("#palPlaces").value.trim();
    if (!t) return;
    // una riga per luogo: se ha dettato tutto di seguito, li separo io
    if (t.split("\n").length >= 3 && !/ poi | dopo /i.test(t)) return;
    try {
      busy(true, "Metto in ordine i luoghi…");
      const d = parseJSON(await ask({ prompt: PROMPTS.palazzoLuoghi(t), json: true, temperature: 0 }));
      if (Array.isArray(d.luoghi) && d.luoghi.length) $("#palPlaces").value = d.luoghi.join("\n");
    } catch { $("#palPlaces").value = t.split(/[,;\n]| poi | dopo /i).map(x => x.trim()).filter(Boolean).join("\n"); }
    finally { busy(false); }
  },
  async savePalace() {
    await this.cleanPlaces();
    const luoghi = $("#palPlaces").value.split("\n").map(x => x.trim()).filter(Boolean);
    if (luoghi.length < 3) return toast("Servono almeno 3 luoghi, uno per riga.");
    const name = $("#palName").value.trim() || "Il mio percorso";
    const ps = this.palazzi();
    if (this.editing) { const p = ps.find(x => x.id === this.editing); p.name = name; p.luoghi = luoghi; }
    else ps.push({ id: uid(), name, luoghi });
    store.set("palazzi", ps);
    $("#dlgPal").close(); this.render();
    toast(`Percorso salvato: ${luoghi.length} luoghi.`);
  },
  async deletePalace() {
    if (!(await uiConfirm("Eliminare questo percorso? Le passeggiate fatte su questo percorso restano.", "Elimina", true))) return;
    store.set("palazzi", this.palazzi().filter(p => p.id !== this.editing));
    $("#dlgPal").close(); this.render();
  },
  /* -- una nuova passeggiata -- */
  fromReader() {
    showView("ripassa"); ripassa.tab("palazzo");
    if (!this.palazzi().length) { toast("Prima crea il tuo percorso, poi ci mettiamo quello che vuoi ricordare.", 5000); return this.edit(); }
    $("#palUseText").checked = true;
    $("#palWhat").focus();
  },
  async create() {
    const p = this.palazzi().find(x => x.id === $("#palWhich").value);
    const what = $("#palWhat").value.trim();
    if (!p) return toast("Scegli il percorso.");
    if (!what) return toast("Scrivi o detta cosa vuoi ricordare (es. «gli 8 stadi di Erikson»).");
    const testo = $("#palUseText").checked && reader.text ? reader.activeText().slice(0, 30000) : "";
    try {
      busy(true, "Costruisco la passeggiata…");
      const d = parseJSON(await ask({ prompt: PROMPTS.palazzoCammino(p.luoghi, what, testo), json: true, temperature: 0.8, quality: true }));
      let el = (d.elementi || []).filter(x => x.cosa && x.immagine);
      if (!el.length) throw new Error();
      // ogni elemento su un luogo del percorso, nell'ordine
      el = el.slice(0, p.luoghi.length).map((x, i) => ({ ...x, luogo: p.luoghi[i] }));
      if ((d.elementi || []).length > p.luoghi.length) toast(`La sequenza è più lunga del percorso: ho usato i primi ${p.luoghi.length} elementi. Aggiungi luoghi per metterli tutti.`, 7000);
      const w = { id: uid(), palazzoId: p.id, titolo: d.titolo || what, richiesta: what, subject: reader.subject || "", date: isoDay(new Date()), elementi: el, best: null };
      store.set("passeggiate", [w, ...this.walks()]);
      $("#palWhat").value = "";
      this.render(); this.open(w.id);
    } catch (e) { toast(e.message && e.message.length > 3 ? e.message : "Non sono riuscito a costruire la passeggiata. Riprova.", 6000); }
    finally { busy(false); }
  },
  /* -- la passeggiata -- */
  open(id) {
    const w = this.walks().find(x => x.id === id); if (!w) return;
    this.walk = w; this.step = 0; this.quizMode = false; this.auto = false; this.score = { ok: 0, no: 0 };
    $("#dlgWalk").showModal();
    this.show();
  },
  show() {
    const w = this.walk, n = w.elementi.length, i = this.step;
    const box = $("#walkBody");
    $("#walkTitle").textContent = w.titolo;
    if (i >= n) {
      const tot = this.score.ok + this.score.no;
      if (this.quizMode && tot) { w.best = Math.max(w.best || 0, this.score.ok); this.saveWalk(); }
      box.innerHTML = this.quizMode
        ? `<div class="walk-end"><b>${this.score.ok} su ${n}</b><p>${this.score.ok === n ? "Perfetto: il palazzo funziona!" : "Rifai la passeggiata e riprova: ogni volta le immagini restano più impresse."}</p></div>
           <div class="btn-row"><button class="btn primary" data-w="walk">${icon("play")}Rifai la passeggiata</button><button class="btn" data-w="quiz">${icon("repeat")}Riprova</button></div>`
        : `<div class="walk-end"><b>Fine della passeggiata</b><p>Ora chiudi gli occhi e ripercorri il percorso da sola. Poi mettiti alla prova.</p></div>
           <div class="btn-row"><button class="btn primary" data-w="quiz">${icon("check")}Mettimi alla prova</button><button class="btn" data-w="walk">${icon("play")}Rifalla</button><button class="btn" data-w="list">${icon("list")}Tutti i posti</button><button class="btn" data-w="save">${icon("bookmark")}Salva nel quaderno</button></div>`;
      return;
    }
    const e = w.elementi[i];
    const dots = w.elementi.map((_, k) => `<span class="${k < i ? "done" : k === i ? "now" : ""}"></span>`).join("");
    box.innerHTML = `<div class="walk-dots">${dots}</div>
      <div class="walk-place"><small>${i + 1} di ${n}</small>${escapeHtml(e.luogo)}</div>
      ${this.quizMode
        ? `<p class="walk-q">Cosa c'è qui?</p>
           <div class="walk-reveal hidden" id="walkReveal"><p class="walk-cosa">${escapeHtml(e.cosa)}</p><p class="hint">${escapeHtml(e.spiegazione || "")}</p><p class="walk-img">${escapeHtml(e.immagine)}</p></div>
           <div class="btn-row" id="walkQBtns"><button class="btn primary" data-w="reveal">Mostra</button></div>`
        : `<p class="walk-img">${escapeHtml(e.immagine)}</p>
           <div class="walk-cosa-box"><p class="walk-cosa">${escapeHtml(e.cosa)}</p><p class="hint">${escapeHtml(e.spiegazione || "")}</p></div>
           <div class="btn-row">
             <button class="btn" data-w="prev" ${i ? "" : "disabled"}>‹ Indietro</button>
             <button class="btn" data-w="say">${icon("volume")}Ascolta</button>
             <button class="btn primary" data-w="next">Avanti ›</button>
           </div>
           <div class="btn-row walk-tools">
             <button class="btn small ghost" data-w="auto">${this.auto ? icon("pause") + "Ferma la guida" : icon("play") + "Guida a voce, da sola"}</button>
             <button class="btn small ghost" data-w="newimg">${icon("sparkles")}Un'altra immagine</button>
             <button class="btn small ghost" data-w="myimg">${icon("pencil")}La invento io</button>
           </div>`}`;
    if (!this.quizMode && this.auto) this.say(() => { if (this.auto && this.walk === w && this.step === i) setTimeout(() => { if (this.auto && this.step === i) { this.step++; this.show(); } }, 2500); });
  },
  say(onEnd) { const e = this.walk.elementi[this.step]; if (e) tts.say(`${e.luogo}. ${e.immagine} Ricorda: ${e.cosa}.`, onEnd, "it"); },
  saveWalk() { store.set("passeggiate", this.walks().map(x => x.id === this.walk.id ? this.walk : x)); this.render(); },
  async action(a) {
    const w = this.walk; if (!w) return;
    if (a === "next") { tts.stop(); this.step++; return this.show(); }
    if (a === "prev") { tts.stop(); this.step = Math.max(0, this.step - 1); return this.show(); }
    if (a === "say") return this.say();
    if (a === "auto") { this.auto = !this.auto; if (!this.auto) tts.stop(); return this.show(); }
    if (a === "walk") { this.quizMode = false; this.step = 0; return this.show(); }
    if (a === "quiz") { tts.stop(); this.auto = false; this.quizMode = true; this.step = 0; this.score = { ok: 0, no: 0 }; return this.show(); }
    if (a === "reveal") {
      $("#walkReveal").classList.remove("hidden");
      $("#walkQBtns").innerHTML = `<button class="btn" data-w="no">Non lo ricordavo</button><button class="btn primary" data-w="ok">${icon("check")}Lo sapevo</button>`;
      return;
    }
    if (a === "ok" || a === "no") { this.score[a]++; this.step++; return this.show(); }
    if (a === "list") {
      $("#walkBody").innerHTML = `<ol class="walk-list">${w.elementi.map(e => `<li><b>${escapeHtml(e.luogo)}</b> → ${escapeHtml(e.cosa)}<br><span class="hint">${escapeHtml(e.immagine)}</span></li>`).join("")}</ol>
        <div class="btn-row"><button class="btn primary" data-w="quiz">${icon("check")}Mettimi alla prova</button></div>`;
      return;
    }
    if (a === "save") {
      const md = [`# ${w.titolo}`, "Palazzo della memoria: ripercorri i luoghi in ordine.", ...w.elementi.map((e, i) => `# ${i + 1}. ${e.luogo}: ${e.cosa}\n\n${e.immagine}`)].join("\n\n");
      if (notebookPut({ id: "pal-" + w.id, type: "testo", title: "Palazzo: " + w.titolo, subject: w.subject || "", date: todayLabel(), data: md })) toast("Passeggiata salvata nel quaderno");
      return;
    }
    const e = w.elementi[this.step]; if (!e) return;
    if (a === "newimg") {
      try {
        busy(true, "Invento un'altra immagine…");
        const d = parseJSON(await ask({ prompt: PROMPTS.palazzoUnaImmagine(e.luogo, e.cosa, e.spiegazione || ""), json: true, temperature: 1 }));
        if (d.immagine) { e.immagine = d.immagine; this.saveWalk(); this.show(); }
      } catch { toast("Non sono riuscito a inventarne un'altra. Riprova."); }
      finally { busy(false); }
    }
    if (a === "myimg") {
      const t = await uiPrompt(`La tua immagine per «${e.cosa}» in «${e.luogo}»`, e.immagine, "Le immagini inventate da te si ricordano ancora meglio.");
      if (t) { e.immagine = t; this.saveWalk(); this.show(); }
    }
  },
  bind() {
    $("#btnPalNew").addEventListener("click", () => this.edit());
    $("#palList").addEventListener("click", (e) => { const b = e.target.closest("[data-pal-edit]"); if (b) this.edit(b.dataset.palEdit); });
    $("#btnPalSave").addEventListener("click", () => this.savePalace());
    $("#btnPalCancel").addEventListener("click", () => { this.rec?.cancel(); $("#dlgPal").close(); });
    $("#btnPalDelete").addEventListener("click", () => this.deletePalace());
    $("#btnPalCreate").addEventListener("click", () => this.create());
    $("#palWalks").addEventListener("click", async (e) => {
      const d = e.target.closest("[data-walk-del]");
      if (d) { if (await uiConfirm("Eliminare questa passeggiata?", "Elimina", true)) { store.set("passeggiate", this.walks().filter(x => x.id !== d.dataset.walkDel)); this.render(); } return; }
      const b = e.target.closest("[data-walk]"); if (b) this.open(b.dataset.walk);
    });
    $("#walkBody").addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (b && !b.disabled) this.action(b.dataset.w); });
    $("#btnWalkClose").addEventListener("click", () => { this.auto = false; tts.stop(); $("#dlgWalk").close(); });
    $("#dlgWalk").addEventListener("close", () => { this.auto = false; tts.stop(); });
    const append = (sel, sep) => (t) => { const ta = $(sel); ta.value = (ta.value.trim() ? ta.value.trim() + sep : "") + t; };
    this.rec = makeRecorder($("#palMic"), $("#palMicStatus"), append("#palPlaces", "\n"), "Tocca il microfono e racconta il percorso, un posto dopo l'altro.");
    $("#palMic").addEventListener("click", () => this.rec.toggle());
    this.recWhat = makeRecorder($("#palWhatMic"), $("#palWhatStatus"), append("#palWhat", " "), "");
    $("#palWhatMic").addEventListener("click", () => this.recWhat.toggle());
  }
};

/* ---------- Spiegalo tu: esposizione libera, senza limiti di tempo ---------- */
const spiega = {
  source: null, title: "", rec: null, last: null,
  fill(selectValue) {
    const sel = $("#spSource");
    const texts = store.get("notebook", []).filter(x => x.type === "testo");
    const opts = [];
    if (this.source && this.source !== reader.text && !texts.some(t => t.data === this.source)) opts.push(["custom", "Testo scelto: " + (this.title || "")]);
    if (reader.text) opts.push(["reader", "Testo aperto in Studia: " + reader.title()]);
    texts.forEach(t => opts.push(["nb:" + t.id, `${t.subject ? t.subject + ": " : ""}${t.title}`]));
    sel.innerHTML = opts.length ? opts.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("")
      : `<option value="">Prima apri un testo in Studia o salvane uno nel quaderno</option>`;
    if (selectValue) sel.value = selectValue;
    this.renderHistory();
  },
  pick() {
    const v = $("#spSource").value;
    if (v === "custom") return { text: this.source, title: this.title };
    if (v === "reader") return { text: reader.activeText(), title: reader.title() };
    if (v.startsWith("nb:")) { const t = store.get("notebook", []).find(x => x.id === v.slice(3)); if (t) return { text: t.data, title: t.title }; }
    return null;
  },
  setSource(text, title) { this.source = text; this.title = title; this.fill(text === reader.activeText() ? "reader" : "custom"); },
  renderHistory() {
    const src = this.pick();
    const h = src ? (store.get("spiegaHist", {})[src.title] || []) : [];
    $("#spHistory").innerHTML = h.length ? `Le tue spiegazioni su questo argomento: ${h.slice(-6).map(x => `<b>${x.cop}%</b>`).join(" → ")}` : "";
  },
  start() {
    const src = this.pick();
    if (!src?.text) return toast("Scegli prima l'argomento da spiegare.");
    $("#spTalk").classList.remove("hidden");
    $("#spResult").classList.add("hidden");
    $("#spText").value = "";
    $("#spTopic").textContent = src.title || "l'argomento";
    const reminder = this.last?.title === src.title ? (this.last.mancanti || []) : [];
    $("#spRemind").innerHTML = reminder.length ? `<b>La volta scorsa mancavano:</b> ${reminder.map(m => escapeHtml(m.punto)).join(" · ")}` : "";
    $("#spRemind").classList.toggle("hidden", !reminder.length);
    $("#spTalk").scrollIntoView({ behavior: "smooth" });
  },
  async check() {
    const src = this.pick();
    const detto = $("#spText").value.trim();
    if (!src?.text) return toast("Scegli prima l'argomento.");
    if (detto.split(/\s+/).length < 15) return toast("Spiega ancora un po': registra o scrivi almeno qualche frase.");
    try {
      busy(true, "Confronto la tua spiegazione con il testo…");
      const d = parseJSON(await ask({ prompt: PROMPTS.spiegalo(src.text.slice(0, 30000), detto), json: true, temperature: 0.2, claude: true }));
      const cop = Math.max(0, Math.min(100, Math.round(Number(d.copertura) || 0)));
      const hist = store.get("spiegaHist", {});
      (hist[src.title] ||= []).push({ cop, date: isoDay(new Date()) });
      store.set("spiegaHist", hist);
      this.last = { title: src.title, mancanti: d.punti_mancanti || [], d };
      this.render(d, cop, hist[src.title]);
      this.renderHistory();
    } catch (e) { toast(e.message || "Non sono riuscito a valutare la spiegazione. Riprova.", 6000); }
    finally { busy(false); }
  },
  render(d, cop, hist) {
    const L = (x) => Array.isArray(x) ? x : [];
    const prev = hist.length > 1 ? hist[hist.length - 2].cop : null;
    const trend = prev === null ? "" : cop > prev ? `<span class="sp-up">+${cop - prev} rispetto alla volta scorsa</span>` : cop < prev ? `<span class="sp-same">la volta scorsa ${prev}%</span>` : `<span class="sp-same">come la volta scorsa</span>`;
    const box = $("#spResult");
    box.innerHTML = `
      <div class="sp-score"><div class="sp-ring" style="--p:${cop}"><span>${cop}%</span></div>
        <div><b>dell'argomento spiegato</b>${trend}<p>${escapeHtml(d.giudizio || "")}</p></div></div>
      ${L(d.punti_detti).length ? `<h3 class="sp-ok">${icon("check")}Hai spiegato</h3><ul>${L(d.punti_detti).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
      ${L(d.punti_mancanti).length ? `<h3 class="sp-miss">${icon("plus")}Ti è mancato</h3><ul>${L(d.punti_mancanti).map(x => `<li><b>${escapeHtml(x.punto || "")}</b>${x.in_breve ? `<br><span class="hint">${escapeHtml(x.in_breve)}</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${L(d.errori).length ? `<h3 class="sp-err">${icon("pencil")}Da correggere</h3><ul>${L(d.errori).map(x => `<li><s>${escapeHtml(x.detto || "")}</s><br>${escapeHtml(x.corretto || "")}</li>`).join("")}</ul>` : ""}
      ${L(d.termini_usati).length || L(d.termini_da_usare).length ? `<h3>${icon("key")}Le parole giuste</h3>
        ${L(d.termini_usati).length ? `<div class="chips">${L(d.termini_usati).map(t => `<span class="chip on">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        ${L(d.termini_da_usare).length ? `<p class="hint">Prova a usare anche:</p><dl class="au-words">${L(d.termini_da_usare).map(t => `<dt>${escapeHtml(t.termine || "")}</dt><dd>${escapeHtml(t.significato || "")}</dd>`).join("")}</dl>` : ""}` : ""}
      ${d.ordine ? `<h3>${icon("list")}L'ordine del discorso</h3><p>${escapeHtml(d.ordine)}</p>` : ""}
      ${d.consiglio ? `<div class="sp-tip"><b>Per la prossima volta:</b> ${escapeHtml(d.consiglio)}</div>` : ""}
      <div class="btn-row">
        <button class="btn primary" data-sp="again">${icon("repeat")}Rispiegalo</button>
        <button class="btn" data-sp="listen">${icon("volume")}Ascolta il commento</button>
        ${L(d.punti_mancanti).length ? `<button class="btn" data-sp="cards">${icon("cards")}Flashcard di quello che mancava</button>` : ""}
      </div>`;
    box.classList.remove("hidden");
    $("#spTalk").classList.add("hidden");
    box.scrollIntoView({ behavior: "smooth" });
  },
  action(what) {
    const d = this.last?.d; if (!d) return;
    if (what === "again") return this.start();
    if (what === "listen") return tts.say([d.giudizio, ...(d.punti_mancanti || []).map(x => "Ti è mancato: " + x.punto), d.consiglio].filter(Boolean).join(". "), null, "it");
    if (what === "cards") {
      const deck = buildDeck({ carte: (d.punti_mancanti || []).map(x => ({ domanda: `Spiega: ${x.punto}`, risposta: x.in_breve || x.punto })) }, "it", reader.subject || "", `Da ripassare: ${this.last.title}`);
      flash.refreshDecks(deck.id); ripassa.tab("carte"); toast(`Creato il mazzo con ${deck.cards.length} carte.`);
    }
  },
  bind() {
    $("#spSource").addEventListener("change", () => this.renderHistory());
    $("#btnSpStart").addEventListener("click", () => this.start());
    $("#btnSpCheck").addEventListener("click", () => this.check());
    $("#spResult").addEventListener("click", (e) => { const b = e.target.closest("[data-sp]"); if (b) this.action(b.dataset.sp); });
    this.rec = makeRecorder($("#btnSpMic"), $("#spMicStatus"), (t) => {
      const ta = $("#spText"); ta.value = (ta.value ? ta.value.trim() + " " : "") + t;
      toast("Ho scritto quello che hai detto. Puoi continuare a parlare o premere «Com'è andata?».", 5000);
    }, "Tocca il microfono e spiega con calma. Quando hai finito, toccalo di nuovo.", { maxSec: 1800 });
    $("#btnSpMic").addEventListener("click", () => this.rec.toggle());
    $("#spAudio").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        busy(true, "Trascrivo la tua spiegazione…");
        const t = await transcribeFile(f, (m) => busy(true, m));
        const ta = $("#spText"); ta.value = (ta.value ? ta.value.trim() + " " : "") + t.trim();
        toast("Ho scritto la tua spiegazione. Premi «Com'è andata?».", 5000);
      } catch (err) { toast(err.message || "Non sono riuscito a trascrivere l'audio.", 6000); }
      finally { busy(false); }
    });
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
      else if (this.queue?.length) {
        this.question = this.queue.shift();
        toast(this.queue.length ? `Domanda nello stile di ${this.queueBy} (ne restano ${this.queue.length})` : `Ultima domanda nello stile di ${this.queueBy}`, 4000);
      } else {
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
    await this.make({ subject, date, topics, minutes });
    $("#planTopics").value = "";
    this.render();
    $("#planList").scrollIntoView({ behavior: "smooth" });
  },

  /** Crea e salva un piano; lo usa anche «Preparo la verifica». */
  async make({ subject, date, topics, minutes, extra = "" }) {
    const today = isoDay(new Date());
    const days = [];
    for (let d = new Date(today + "T12:00"); isoDay(d) < date && days.length < 30; d.setDate(d.getDate() + 1)) days.push(isoDay(d));
    let sessions;
    try {
      busy(true, "Preparo il piano…");
      const out = parseJSON(await ask({ prompt: PROMPTS.piano(subject, topics + (extra ? "\n" + extra : ""), days, minutes), json: true, temperature: 0.3 }));
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
    return plan;
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
let nbHighlight = new Set();   // elementi appena creati (es. da «Preparo la verifica»), evidenziati
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
    <li data-id="${it.id}" data-type="${it.type}"${nbHighlight.has(it.id) ? ' class="nb-new"' : ""}>
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
  if (!(await uiConfirm("Spostare questo elemento nel cestino? Potrai ripristinarlo per 30 giorni.", "Sposta nel cestino", true))) return;
  if (type === "flashcard") {
    const decks = store.get("decks", []), d = decks.find(x => x.id === id);
    if (d) trash.put("deck", d);
    store.set("decks", decks.filter(x => x.id !== id));
    flash.refreshDecks();
  } else {
    const nb = store.get("notebook", []), it = nb.find(x => x.id === id);
    if (it) trash.put("notebook", it);
    store.set("notebook", nb.filter(x => x.id !== id));
  }
  trash.render();
  renderNotebook();
}

/* ---------- scelta dell'immagine per un riquadro della mappa ---------- */
const imgPicker = {
  node: null,
  open(node) {
    this.node = node;
    $("#imgTitle").textContent = `Immagine per «${node.text.slice(0, 40)}»`;
    $("#imgQuery").value = node.text;
    $("#imgResults").innerHTML = "";
    const cur = node.img && mapImages.cache.get(node.img);
    $("#imgCurrent").classList.toggle("hidden", !cur);
    $("#imgCurrent").innerHTML = cur ? `<img src="${cur.src}" alt=""><button class="btn small bad" id="btnImgRemove">${icon("trash")}Togli l'immagine</button>` : "";
    $("#btnImgPaste").classList.toggle("hidden", !navigator.clipboard?.read);
    $("#dlgImg").showModal();
  },
  async set(getId) {
    const node = this.node; if (!node) return;
    try {
      busy(true, "Preparo l'immagine…");
      const id = await getId();
      $("#dlgImg").close();
      mindmap.change(() => { node.img = id; });
      toast("Immagine aggiunta. Con Annulla la togli.");
    } catch (e) { toast(e.message || "Non sono riuscito ad aggiungere l'immagine.", 6000); }
    finally { busy(false); }
  },
  async search() {
    const q = $("#imgQuery").value.trim(); if (!q) return;
    const box = $("#imgResults");
    box.innerHTML = `<p class="hint">Cerco…</p>`;
    try {
      const res = await mapImages.wikiSearch(q);
      box.innerHTML = res.length ? res.map(r => `<button class="img-hit" data-src="${escapeHtml(r.src)}" title="${escapeHtml(r.title)}"><img src="${escapeHtml(r.src)}" alt="${escapeHtml(r.title)}" loading="lazy"><small>${escapeHtml(r.title)}</small></button>`).join("")
        : `<p class="hint">Nessuna immagine trovata: prova con un'altra parola.</p>`;
    } catch (e) { box.innerHTML = `<p class="hint">${escapeHtml(e.message)}</p>`; }
  },
  async paste() {
    try {
      for (const it of await navigator.clipboard.read()) {
        const type = it.types.find(t => t.startsWith("image/"));
        if (type) { const blob = await it.getType(type); return this.set(() => mapImages.add(blob)); }
      }
      toast("Negli appunti non c'è un'immagine: copiala prima (tasto destro → Copia immagine).", 6000);
    } catch { toast("Il browser non mi lascia leggere gli appunti. Usa «Foto o galleria».", 6000); }
  },
  bind() {
    $("#btnImgClose").addEventListener("click", () => $("#dlgImg").close());
    $("#imgFile").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) this.set(() => mapImages.add(f)); });
    $("#btnImgPaste").addEventListener("click", () => this.paste());
    $("#btnImgSearch").addEventListener("click", () => this.search());
    $("#imgQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.search(); } });
    $("#imgResults").addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (b) this.set(() => mapImages.fromUrl(b.dataset.src)); });
    $("#imgCurrent").addEventListener("click", (e) => {
      if (!e.target.closest("#btnImgRemove")) return;
      const node = this.node; $("#dlgImg").close();
      mindmap.change(() => { delete node.img; });
    });
  }
};

/* =========================================================
   ARCHIVIO GRANDE (IndexedDB): immagini delle mappe e copie automatiche
   ========================================================= */
const idb = {
  _db: null,
  open() {
    return this._db ||= new Promise((res, rej) => {
      const r = indexedDB.open("zaino", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", mode), req = fn(tx.objectStore("kv"));
      tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  },
  get(k) { return this.run("readonly", st => st.get(k)).catch(() => undefined); },
  set(k, v) { return this.run("readwrite", st => st.put(v, k)); },
  del(k) { return this.run("readwrite", st => st.delete(k)).catch(() => {}); },
  async keys(prefix = "") { return ((await this.run("readonly", st => st.getAllKeys()).catch(() => [])) || []).filter(k => String(k).startsWith(prefix)); }
};

/* ---------- immagini delle mappe ---------- */
const mapImages = {
  cache: new Map(),             // id → { src, w, h }
  /** Riduce l'immagine (lato lungo 520 px, JPEG): leggera da salvare e da stampare. */
  async compress(blob, max = 520) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      return { src: c.toDataURL("image/jpeg", 0.8), w, h };
    } finally { URL.revokeObjectURL(url); }
  },
  async add(blob) {
    const im = await this.compress(blob);
    const id = "img_" + uid();
    await idb.set("img:" + id, im);
    this.cache.set(id, im);
    return id;
  },
  ids(root) { const out = []; const walk = (n) => { if (n.img) out.push(n.img); (n.children || []).forEach(walk); }; if (root) walk(root); return out; },
  /** Carica in memoria le immagini della mappa; true se ne ha caricate di nuove. */
  async preload(root) {
    let added = false;
    for (const id of this.ids(root)) {
      if (this.cache.has(id)) continue;
      const im = await idb.get("img:" + id);
      if (im) { this.cache.set(id, im); added = true; }
    }
    return added;
  },
  async wikiSearch(q) {
    const p = new URLSearchParams({ action: "query", generator: "search", gsrsearch: q, gsrlimit: "12", prop: "pageimages", piprop: "thumbnail", pithumbsize: "480", format: "json", origin: "*" });
    const r = await fetch("https://it.wikipedia.org/w/api.php?" + p);
    if (!r.ok) throw new Error("Wikipedia non risponde. Riprova tra poco.");
    return Object.values((await r.json()).query?.pages || {}).filter(x => x.thumbnail?.source)
      .sort((a, b) => (a.index || 0) - (b.index || 0)).map(x => ({ title: x.title, src: x.thumbnail.source }));
  },
  async fromUrl(src) {
    const r = await fetch(src);
    if (!r.ok) throw new Error("Non riesco a scaricare l'immagine.");
    return this.add(await r.blob());
  }
};

/* ---------- copia completa (backup) ---------- */
async function buildBackup({ images = true } = {}) {
  const cache = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^sf\.(autore|quiz):/.test(k)) cache[k.slice(3)] = store.get(k.slice(3), null);
  }
  const data = { app: "studio-facile", version: 3, date: new Date().toISOString(),
    notebook: store.get("notebook", []), decks: store.get("decks", []), plans: store.get("plans", []), kits: store.get("kits", []),
    trash: store.get("trash", []), currentMap: store.get("currentMap", null), errStats: store.get("errStats", {}), cache,
    profs: store.get("profs", []), profQ: store.get("profQ", []), spiegaHist: store.get("spiegaHist", {}),
    palazzi: store.get("palazzi", []), passeggiate: store.get("passeggiate", []) };
  if (images) {
    // le immagini delle mappe (salvate, in uso e nel cestino)
    const ids = new Set();
    data.notebook.filter(x => x.type === "mappa").forEach(x => mapImages.ids(x.data).forEach(i => ids.add(i)));
    data.trash.filter(t => t.item?.type === "mappa").forEach(t => mapImages.ids(t.item.data).forEach(i => ids.add(i)));
    mapImages.ids(data.currentMap?.root).forEach(i => ids.add(i));
    data.images = {};
    for (const id of ids) { const im = mapImages.cache.get(id) || await idb.get("img:" + id); if (im) data.images[id] = im; }
  }
  return data;
}
/** Unisce un backup a quello che c'è: non cancella niente, aggiunge quello che manca. */
async function mergeBackup(data) {
  const merge = (key, incoming) => {
    const cur = store.get(key, []);
    const ids = new Set(cur.map(x => x.id));
    store.set(key, [...cur, ...(incoming || []).filter(x => x && !ids.has(x.id))]);
  };
  merge("notebook", data.notebook);
  merge("decks", data.decks);
  merge("plans", data.plans);
  merge("kits", data.kits);
  merge("profs", data.profs);
  merge("profQ", data.profQ);
  merge("palazzi", data.palazzi);
  merge("passeggiate", data.passeggiate);
  if (data.spiegaHist && !Object.keys(store.get("spiegaHist", {})).length) store.set("spiegaHist", data.spiegaHist);
  for (const [k, v] of Object.entries(data.cache || {})) if (/^(autore|quiz):/.test(k) && v && !store.get(k, null)) store.set(k, v);
  for (const [id, im] of Object.entries(data.images || {})) if (!(await idb.get("img:" + id))) await idb.set("img:" + id, im);
  if (data.errStats) {
    const st = store.get("errStats", {});
    for (const [k, n] of Object.entries(data.errStats)) st[k] = Math.max(st[k] || 0, n);
    store.set("errStats", st);
  }
  if (!mindmap.root && data.currentMap?.root) mindmap.load(data.currentMap.root, data.currentMap.savedId);
  renderNotebook(); flash.refreshDecks(); planner.render(); home.render(); trash.render();
}

/* ---------- copie automatiche giornaliere (ultimi 7 giorni, su questo dispositivo) ---------- */
const autosave = {
  timer: null,
  KEYS: /^(notebook|decks|plans|kits|trash|currentMap|errStats|profs|profQ|spiegaHist|palazzi|passeggiate|autore:|quiz:)/,
  init() {
    onStoreChange = (key) => { if (this.KEYS.test(key)) this.schedule(); };
    setTimeout(() => this.run(), 4000);
  },
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 15000); },
  async run() {
    try {
      const day = isoDay(new Date());
      const data = await buildBackup({ images: false });
      if (data.notebook.length || data.decks.length || data.currentMap) await idb.set("snap:" + day, data);
      const snaps = (await idb.keys("snap:")).sort();
      for (const k of snaps.slice(0, Math.max(0, snaps.length - 7))) await idb.del(k);
      await folder.write();
    } catch { /* la copia automatica non deve mai disturbare */ }
  },
  async list() {
    const out = [];
    for (const k of (await idb.keys("snap:")).sort().reverse()) {
      const d = await idb.get(k);
      if (d) out.push({ key: k, day: k.slice(5), n: (d.notebook?.length || 0) + (d.decks?.length || 0) });
    }
    return out;
  },
  async renderList() {
    const box = $("#snapList");
    if (!box) return;
    const list = await this.list();
    box.innerHTML = list.length
      ? list.map(x => `<div class="snap-row"><span>${escapeHtml(dayLabel(x.day))}<small>${x.n} ${x.n === 1 ? "elemento" : "elementi"}</small></span><button type="button" class="btn small" data-snap="${x.key}">Recupera</button></div>`).join("")
      : `<p class="hint">Ancora nessuna copia: la prima arriva dopo qualche minuto di lavoro.</p>`;
  },
  async restore(key) {
    const d = await idb.get(key);
    if (!d) return;
    if (!(await uiConfirm(`Recuperare quello che c'era il ${dayLabel(key.slice(5))}? Gli elementi che mancano oggi vengono aggiunti, niente viene cancellato.`, "Recupera"))) return;
    await mergeBackup(d);
    toast("Fatto: ho rimesso nel quaderno quello che mancava.");
  }
};

/* ---------- cestino: quello che si elimina resta recuperabile per 30 giorni ---------- */
const trash = {
  put(kind, item) {
    const t = store.get("trash", []).filter(x => Date.now() - x.at < 30 * 86400000);
    t.unshift({ kind, item, at: Date.now() });
    store.set("trash", t.slice(0, 200));
  },
  render() {
    const t = store.get("trash", []);
    const b = $("#btnTrash");
    if (b) { b.textContent = `Cestino (${t.length})`; b.classList.toggle("hidden", !t.length); }
  },
  open() {
    const t = store.get("trash", []);
    $("#trashList").innerHTML = t.length ? t.map((x, i) => `<li><span class="t">${escapeHtml(x.item.title || "Senza titolo")}<small>${x.kind === "deck" ? "flashcard" : escapeHtml(x.item.type || "")} · eliminato ${escapeHtml(new Date(x.at).toLocaleDateString("it-IT", { day: "numeric", month: "long" }))}</small></span>
      <button class="btn small" data-tr="${i}">Ripristina</button></li>`).join("") : `<li class="hint">Il cestino è vuoto.</li>`;
    $("#dlgTrash").showModal();
  },
  restore(i) {
    const t = store.get("trash", []);
    const x = t[i]; if (!x) return;
    if (x.kind === "deck") store.set("decks", [x.item, ...store.get("decks", []).filter(d => d.id !== x.item.id)]);
    else notebookPut(x.item);
    t.splice(i, 1); store.set("trash", t);
    renderNotebook(); flash.refreshDecks(); this.render(); this.open();
    toast("Ripristinato nel quaderno");
  },
  purge() { store.set("trash", store.get("trash", []).filter(x => Date.now() - x.at < 30 * 86400000)); }
};

/* ---------- salvataggio automatico in una cartella del computer (Chrome, Edge) ---------- */
const folder = {
  supported: () => "showDirectoryPicker" in window,
  async handle() { return idb.get("backupDir"); },
  async choose() {
    try {
      const dir = await window.showDirectoryPicker({ id: "zaino-backup", mode: "readwrite" });
      await idb.set("backupDir", dir);
      await this.write(true);
      toast(`Fatto: salvo automaticamente nella cartella «${dir.name}».`, 6000);
    } catch (e) { if (e?.name !== "AbortError") toast("Non sono riuscito a usare quella cartella. Prova con un'altra.", 6000); }
    this.render(); home.render();
  },
  async stop() { await idb.del("backupDir"); this.render(); home.render(); toast("Salvataggio nella cartella disattivato."); },
  async state() {
    const dir = await this.handle();
    if (!dir) return { dir: null };
    let perm = "denied";
    try { perm = await dir.queryPermission({ mode: "readwrite" }); } catch { /* niente */ }
    return { dir, perm };
  },
  /** Riattiva il permesso (serve un tocco: il browser lo chiede a ogni avvio). */
  async resume() {
    const dir = await this.handle(); if (!dir) return;
    try { if (await dir.requestPermission({ mode: "readwrite" }) === "granted") { await this.write(true); toast("Salvataggio automatico riattivato."); } } catch { /* niente */ }
    this.render(); home.render();
  },
  async write(force = false) {
    const { dir, perm } = await this.state();
    if (!dir || perm !== "granted") return false;
    const data = JSON.stringify(await buildBackup());
    const put = async (name) => { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); };
    await put("zaino-backup.json");                                   // sempre l'ultima versione
    await put(`zaino-backup-${isoDay(new Date())}.json`);             // una copia per giorno
    // tengo le ultime 14 copie giornaliere
    const days = [];
    for await (const [name] of dir.entries()) if (/^zaino-backup-\d{4}-\d{2}-\d{2}\.json$/.test(name)) days.push(name);
    for (const n of days.sort().slice(0, Math.max(0, days.length - 14))) { try { await dir.removeEntry(n); } catch { /* niente */ } }
    store.set("lastBackup", Date.now());
    localStorage.setItem("sf.folderSaved", String(Date.now()));
    if (force) this.render();
    return true;
  },
  async render() {
    const box = $("#folderBox");
    if (!box) return;
    if (!this.supported()) { box.innerHTML = `<p class="hint">Il salvataggio automatico in una cartella funziona sul computer con Chrome o Edge. Su questo dispositivo usa «Scarica backup».</p>`; return; }
    const { dir, perm } = await this.state();
    const when = Number(localStorage.getItem("sf.folderSaved") || 0);
    box.innerHTML = !dir
      ? `<p class="hint">Sul computer Zaino può salvare da solo una copia in una cartella, a ogni modifica. Scegli una cartella di Google Drive, OneDrive o iCloud: così la copia finisce anche online.</p>
         <button type="button" class="btn small primary" data-fold="choose">${icon("download")}Scegli la cartella</button>`
      : perm === "granted"
        ? `<p class="hint">Attivo: salvo nella cartella <b>${escapeHtml(dir.name)}</b>${when ? `, ultima copia alle ${new Date(when).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}.</p>
           <button type="button" class="btn small ghost" data-fold="stop">Disattiva</button>`
        : `<p class="hint">Cartella <b>${escapeHtml(dir.name)}</b>: il browser chiede di nuovo il permesso.</p>
           <button type="button" class="btn small primary" data-fold="resume">Riattiva il salvataggio</button> <button type="button" class="btn small ghost" data-fold="stop">Disattiva</button>`;
  }
};

async function exportBackup() {
  const data = await buildBackup();
  const name = `zaino-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  store.set("lastBackup", Date.now());
  // sul telefono: si apre «Condividi», così si salva su File/iCloud, Drive o si manda via WhatsApp
  const file = new File([blob], name, { type: "application/json" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Backup di Zaino" }); return; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  download(name, blob);
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "studio-facile") throw new Error();
    await mergeBackup(data);
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
      // se per questa verifica c'è un kit pronto, lo offro
      t.innerHTML = `<h2>${icon("calendar")}Prossima verifica</h2><ul><li><button class="p-item" data-go="piano"><span>${escapeHtml(next.subject)}<small>${left === 1 ? "domani" : "tra " + left + " giorni"}: oggi niente in programma</small></span></button></li></ul>`;
    } else {
      t.innerHTML = `<h2>${icon("calendar")}Hai una verifica in arrivo?</h2><p class="hint">Apri il capitolo (foto, PDF o testo) e premi <b>Preparo la verifica</b>: riassunto, mappa, flashcard, domande probabili e piano, tutto insieme.</p><button class="btn small" data-go="piano">Oppure crea solo un piano</button>`;
    }
    const kitNext = store.get("kits", []).filter(k => k.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (kitNext) t.insertAdjacentHTML("beforeend", `<button class="btn small" data-kitopen="${kitNext.id}">${icon("layers")}Materiale per «${escapeHtml(kitNext.topic.slice(0, 40))}»</button>`);
    t.classList.remove("hidden");
    // da riprendere
    const r = $("#homeRecent");
    const nb = store.get("notebook", []).slice(0, 4);
    const ico = { testo: "file", mappa: "map" };
    r.innerHTML = nb.length
      ? `<h2>${icon("library")}Da riprendere</h2><ul>${nb.map(x => `<li><button class="p-item" data-open="${x.id}" data-type="${x.type}">${icon(ico[x.type] || "file")}<span>${escapeHtml(x.title)}<small>${x.subject ? escapeHtml(x.subject) + ", " : ""}${escapeHtml(x.date || "")}</small></span></button></li>`).join("")}</ul>
         <button class="btn small ghost" data-go="quaderno">Apri il quaderno</button>`
      : `<h2>${icon("library")}Il tuo quaderno</h2><p class="hint">Testi, mappe e flashcard che salvi li ritrovi qui, pronti da riprendere.</p>`;
    folder.state().then(({ dir, perm }) => {
      if (dir && perm !== "granted" && !$("#homeRecent [data-fold]")) r.insertAdjacentHTML("beforeend", `<div class="bk-remind"><span>${icon("download")}<b>Salvataggio automatico in pausa.</b> Il browser chiede di nuovo il permesso per la cartella «${escapeHtml(dir.name)}».</span><div class="row gap"><button class="btn small primary" data-fold="resume">Riattiva</button></div></div>`);
    }).catch(() => {});
    // promemoria: un backup alla settimana, se c'è qualcosa da salvare
    const last = store.get("lastBackup", 0), many = nb.length + store.get("decks", []).length;
    const folderOn = Date.now() - Number(localStorage.getItem("sf.folderSaved") || 0) < 3 * 86400000;
    if (many >= 3 && !folderOn && Date.now() - last > 7 * 86400000 && !sessionStorage.getItem("sf-bk-later")) {
      r.insertAdjacentHTML("beforeend", `<div class="bk-remind"><span>${icon("download")}<b>Fai una copia di sicurezza</b> del quaderno: se il browser cancella i dati, non perdi niente.</span>
        <div class="row gap"><button class="btn small primary" data-bk="now">Scarica backup</button><button class="btn small ghost" data-bk="later">Più tardi</button></div></div>`);
    }
    r.classList.remove("hidden");
  },
  bind() {
    $("#homePanels").addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { if (go.dataset.go === "piano") { showView("ripassa"); ripassa.tab("piano"); } else showView(go.dataset.go); return; }
      const fo = e.target.closest("[data-fold]");
      if (fo) return folder[fo.dataset.fold]?.();
      const bk = e.target.closest("[data-bk]");
      if (bk) { if (bk.dataset.bk === "now") exportBackup(); else sessionStorage.setItem("sf-bk-later", "1"); return this.render(); }
      const ko = e.target.closest("[data-kitopen]");
      if (ko) { const K = kit.find(ko.dataset.kitopen); if (K) kit.showDone(K); return; }
      const op = e.target.closest("[data-open]");
      if (op) openNotebookItem(op.dataset.open, op.dataset.type);
    });
    $("#homePanels").addEventListener("change", (e) => {
      const c = e.target.closest("input[data-plan]");
      if (c) { planner.toggle(c.dataset.plan, +c.dataset.si, +c.dataset.ii, c.checked); this.render(); }
    });
  }
};

/* =========================================================
   PREPARO LA VERIFICA: tutto il materiale in un passo
   ========================================================= */
const kit = {
  STEPS: [
    ["testo", "Salvo il testo nel quaderno"],
    ["riassunto", "Riassunto"],
    ["mappa", "Mappa"],
    ["flashcard", "Flashcard"],
    ["domande", "Domande probabili con le risposte"],
    ["piano", "Piano giorno per giorno"]
  ],
  open() {
    const text = reader.activeText();
    if (!text) return toast("Prima apri il testo da studiare.");
    if (text.length < 300) return toast("Il testo è troppo breve per preparare una verifica.");
    fillSubjects();
    $("#kitSubject").value = reader.subject || "";
    $("#kitTopic").value = reader.title() || "";
    const d = new Date(); d.setDate(d.getDate() + 7);
    $("#kitDate").value = "";
    $("#kitDate").min = isoDay(new Date(Date.now() + 86400000));
    $("#kitForm").classList.remove("hidden");
    $("#kitProgress").classList.add("hidden");
    $("#kitDone").classList.add("hidden");
    $("#dlgKit").showModal();
  },
  async run() {
    const text = reader.activeText();
    const subject = $("#kitSubject").value.trim();
    const topic = $("#kitTopic").value.trim() || reader.title() || "Verifica";
    const date = $("#kitDate").value;
    const minutes = Number($("#kitMinutes").value) || 30;
    const today = isoDay(new Date());
    if (date && date <= today) return toast("La data della verifica deve essere dopo oggi.");
    reader.subject = subject;
    const steps = this.STEPS.filter(([k]) => k !== "piano" || date);
    $("#kitForm").classList.add("hidden");
    const prog = $("#kitProgress");
    prog.classList.remove("hidden");
    prog.innerHTML = `<p class="hint">Ci vuole circa un minuto: puoi lasciare il telefono, continuo da sola.</p><ol class="kit-steps">${steps.map(([k, l]) => `<li data-k="${k}"><span class="ks-dot"></span>${escapeHtml(l)}</li>`).join("")}</ol>`;
    const mark = (k, st) => { const li = prog.querySelector(`[data-k="${k}"]`); if (li) li.className = st; };
    const K = { id: uid(), subject, topic, date, created: today, problems: [] };
    const title = (what) => `${what}: ${topic}`;
    for (const [k] of steps) {
      mark(k, "doing");
      try {
        if (k === "testo") {
          K.textId = uid();
          notebookPut({ id: K.textId, type: "testo", title: title("Testo"), subject, date: todayLabel(), data: text });
        }
        if (k === "riassunto") {
          const md = await studySummary(text);
          K.sumId = uid(); K.sum = md;
          notebookPut({ id: K.sumId, type: "testo", title: title("Riassunto"), subject, date: todayLabel(), data: md.replace(/\*\*/g, "").replace(/^##\s*/gm, "# ").replace(/^[-*•]\s+/gm, "") });
        }
        if (k === "mappa") {
          const base = wordCount(text) > LONG_TEXT && K.sum ? K.sum : text;
          const root = normalizeMap(parseJSON(await askChecked("mappa", base, { prompt: PROMPTS.mappa(base), system: SYSTEM_TUTOR, json: true })));
          K.mapId = uid();
          notebookPut({ id: K.mapId, type: "mappa", title: root.text || title("Mappa"), subject, date: todayLabel(), data: cleanMap(root) });
        }
        if (k === "flashcard") {
          const base = wordCount(text) > LONG_TEXT && K.sum ? K.sum : text;
          const deck = buildDeck(parseJSON(await askChecked("flashcard", base, { prompt: PROMPTS.flashcard(base), system: SYSTEM_TUTOR, json: true })), "it", subject, title("Flashcard"));
          K.deckId = deck.id; flash.refreshDecks();
        }
        if (k === "domande") {
          const qBase = wordCount(text) > LONG_TEXT && K.sum ? K.sum : text;
          const d = parseJSON(await ask({ prompt: PROMPTS.domandeVerifica(qBase, subject), system: SYSTEM_TUTOR, json: true, temperature: 0.3, claude: true }));
          K.questions = (d.domande || []).filter(q => q.domanda && q.risposta);
          if (!K.questions.length) throw new Error();
          K.qId = uid();
          notebookPut({ id: K.qId, type: "testo", title: title("Domande probabili"), subject, date: todayLabel(),
            data: "# Domande probabili\n\n" + K.questions.map((q, i) => `# ${i + 1}. ${q.domanda}\n\n${q.risposta.replace(/\*\*/g, "")}`).join("\n\n") });
        }
        if (k === "piano") {
          const plan = await planner.make({ subject: subject || topic, date, minutes,
            topics: topic,
            extra: "Materiale già pronto in Zaino: riassunto, mappa, flashcard e domande probabili. Usa attività come: ascolta il riassunto, ripassa la mappa, flashcard, rispondi a voce alle domande probabili, interrogazione simulata." });
          K.planId = plan.id;
        }
        mark(k, "ok");
      } catch (e) {
        mark(k, "ko"); K.problems.push(k);
      }
      busy(false);
    }
    const kits = store.get("kits", []).filter(x => x.date >= today || !x.date).slice(0, 9);
    kits.unshift(K); store.set("kits", kits);
    planner.render(); home.render(); renderNotebook();
    this.showDone(K);
  },
  showDone(K) {
    $("#kitForm").classList.add("hidden");
    $("#kitProgress").classList.add("hidden");
    const box = $("#kitDone");
    const b = (k, ic, label, sub, ok = true) => ok ? `<button class="kit-out" data-kit="${k}">${icon(ic)}<span><b>${label}</b><small>${sub}</small></span></button>` : "";
    const left = K.date ? daysBetween(isoDay(new Date()), K.date) : null;
    const saved = [K.sumId && "riassunto", K.mapId && "mappa", K.qId && "domande probabili", K.deckId && "flashcard", K.textId && "testo"].filter(Boolean);
    box.innerHTML = `${saved.length ? `<div class="kit-saved">${icon("check")}<div><b>Tutto salvato nel quaderno</b><small>${escapeHtml(saved.join(", "))}${K.subject ? " · materia " + escapeHtml(K.subject) : ""}</small></div>
        <button class="btn small primary" data-kit="notebook">${icon("library")}Apri il quaderno</button></div>` : ""}
      <h3>${escapeHtml(K.topic)}</h3>
      <p class="hint">${K.subject ? escapeHtml(K.subject) + " · " : ""}${left !== null ? (left === 1 ? "verifica domani" : left > 1 ? `verifica tra ${left} giorni` : "verifica passata") : "senza data"}</p>
      ${K.problems.length ? `<p class="kit-warn">Qualcosa non è riuscito (${K.problems.length}): puoi rifarlo dagli strumenti sotto il testo.</p>` : ""}
      <div class="kit-grid">
        ${b("sum", "list", "Riassunto", "Leggilo o ascoltalo", !!K.sumId)}
        ${b("map", "map", "Mappa", "Da completare e stampare", !!K.mapId)}
        ${b("cards", "cards", "Flashcard", "Ripasso a carte", !!K.deckId)}
        ${b("questions", "help", "Domande probabili", "Con le risposte modello", !!K.qId)}
        ${b("ask", "chat", "Interrogami", "A voce, sul testo", !!K.textId)}
        ${b("plan", "calendar", "Il piano", "Cosa fare ogni giorno", !!K.planId)}
      </div>
      <div class="btn-row"><button class="btn primary" data-kit="print">${icon("printer")}Stampa riassunto e domande</button></div>`;
    box.dataset.kit = K.id;
    box.classList.remove("hidden");
    if (!$("#dlgKit").open) $("#dlgKit").showModal();
  },
  find(id) { return store.get("kits", []).find(x => x.id === id); },
  action(what) {
    const K = this.find($("#kitDone").dataset.kit);
    if (!K) return;
    const close = () => $("#dlgKit").close();
    if (what === "sum") { close(); return openNotebookItem(K.sumId, "testo"); }
    if (what === "questions") { close(); return openNotebookItem(K.qId, "testo"); }
    if (what === "map") { close(); return openNotebookItem(K.mapId, "mappa"); }
    if (what === "cards") { close(); return openNotebookItem(K.deckId, "flashcard"); }
    if (what === "plan") { close(); showView("ripassa"); return ripassa.tab("piano"); }
    if (what === "notebook") {
      close();
      nbFilter = K.subject || "";
      nbHighlight = new Set([K.textId, K.sumId, K.mapId, K.qId, K.deckId].filter(Boolean));
      showView("quaderno");
      setTimeout(() => $("#notebook .nb-new")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      return;
    }
    if (what === "ask") {
      const it = store.get("notebook", []).find(x => x.id === K.textId);
      if (!it) return toast("Il testo non è più nel quaderno.");
      close(); showView("ripassa"); ripassa.tab("interroga"); return quiz.setSource(it.data, K.topic);
    }
    if (what === "print") {
      const qs = (K.questions || []).map((q, i) => `<h3>${i + 1}. ${escapeHtml(q.domanda)}</h3>${mdToHtml(q.risposta)}`).join("");
      return printer.run(`<div class="print-text"><h1>${escapeHtml(K.topic)}</h1>${K.sum ? mdToHtml(K.sum) : ""}${qs ? `<h2>Domande probabili</h2>${qs}` : ""}</div>`, { title: (K.subject ? K.subject + " · " : "") + "Verifica" });
    }
  },
  bind() {
    $("#btnKit").addEventListener("click", () => this.open());
    $("#btnKitGo").addEventListener("click", () => this.run());
    $("#btnKitCancel").addEventListener("click", () => $("#dlgKit").close());
    $("#btnKitClose").addEventListener("click", () => $("#dlgKit").close());
    $("#kitDone").addEventListener("click", (e) => { const b = e.target.closest("[data-kit]"); if (b) this.action(b.dataset.kit); });
  }
};

const GUIDE = [
  ["Come si usa", null, [
    ["book", "1. Porta il testo", "In Studia fotografa una pagina, carica una foto o un PDF, oppure incolla un testo o un link. Con un PDF lungo, come un libro di LibroAID, ti chiedo quali pagine leggere."],
    ["globe", "Da un sito o Wikipedia", "Incolla un link: Zaino prende solo il testo della pagina, senza pubblicità. Oppure scrivi un argomento e trova la voce di Wikipedia. Per le pagine con accesso (registro, piattaforma della scuola) c'è il tasto «Manda a Zaino»; su Android anche Condividi → Zaino."],
    ["volume", "2. Ascoltalo", "Premi il tasto blu: la voce legge e la frase si colora come con un evidenziatore. Tocca una frase per partire da lì."],
    ["layers", "Testo a zoom", "Sopra il testo scegli la vista: «In una frase» per il succo, «I punti» per la struttura, «Tutto il testo» per leggere. Tocca un punto per saltare a quella parte."],
    ["sparkles", "3. Trasformalo", "Sotto il testo scegli cosa ti serve: riassunto, mappa, linea del tempo, flashcard e altro."],
    ["image", "Immagini nelle mappe", "Tocca un riquadro e premi «Immagine»: una foto, un'immagine copiata o una cercata su Wikipedia. Si vede nella mappa, in stampa e nelle schede."],
    ["download", "Il lavoro è al sicuro", "Zaino tiene da solo una copia al giorno per 7 giorni, e quello che elimini resta nel cestino del quaderno per 30 giorni. Sul computer può salvare tutto da solo in una cartella di Google Drive o OneDrive (Impostazioni → Quaderno)."],
    ["layers", "Preparo la verifica", "Un tasto solo, sotto il testo: riassunto, mappa, flashcard, le domande più probabili con le risposte e il piano fino alla data. Tutto viene salvato da solo nel quaderno (tasto «Apri il quaderno» alla fine) e in Ripassa."],
    ["home", "Palazzo della memoria", "In Ripassa: detti una volta il percorso di casa tua; poi ogni sequenza da ricordare (stadi, fasi, opere in ordine) diventa una passeggiata a voce con immagini buffe, una per stanza. Il metodo dei loci, già usato da Cicerone."],
    ["people", "Professori", "In Ripassa: dopo ogni interrogazione detta cosa ti hanno chiesto, o fotografa la verifica corretta. Zaino capisce come interroga ogni professore, dove perdi punti, e ti allena con domande nel suo stile."],
    ["present", "Spiegalo tu", "In Ripassa: spieghi a voce un argomento, senza limiti di tempo. Poi vedi quanta parte hai spiegato, cosa mancava, gli errori, le parole tecniche e i progressi tra un tentativo e l'altro."],
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
    ["branch", "Tocca un riquadro", "Compare una barra: Ascolta, Scrivi, Sotto (idea collegata), Accanto (stesso livello), Collega, Parola, Colore, Su, Giù, Togli."],
    ["hand", "Sposta", "Premi Sposta e trascina i riquadri dove vuoi: il ramo li segue. Se lasci un riquadro sopra un altro, diventa una sua idea collegata. Premi Fatto quando hai finito."],
    ["link", "Collega", "Unisce due idee anche di rami diversi con una freccia tratteggiata e una parola di collegamento (causa, influenza, è un esempio di…). Tocca la freccia per cambiarla o toglierla."],
    ["tag", "Parola", "Scrive una parola di collegamento sulla linea che arriva al riquadro, come nelle mappe concettuali fatte a scuola."],
    ["palette", "Colore", "Cambia il colore del riquadro e delle idee sotto di lui."],
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
    ["activity", "Statistica", "Scrivi una serie di numeri (per esempio i voti): media, mediana, moda, campo, varianza e scarto con tutti i passaggi e un grafico delle frequenze."],
    ["grid", "Tabelline", "La tavola pitagorica: tocca un numero per sentire l'operazione."],
    ["camera", "Da foto", "Fotografa un esercizio e risolvetelo insieme, un passo alla volta."]
  ]],
  ["Filosofia e Scienze umane", "Gli autori, le idee e i collegamenti. Si aprono da Materie, in basso.", [
    ["timeline", "Autori", "Gli autori in ordine di tempo, divisi per periodo (filosofia) o per disciplina (pedagogia, psicologia, sociologia, antropologia). Puoi cercare per nome."],
    ["file", "Scheda autore", "Tocca un nome: contesto, vita, il pensiero in punti, un esempio, le parole chiave, le opere, i collegamenti, una frase celebre e le domande da interrogazione. Viene salvata: la seconda volta si apre subito."],
    ["timeline", "Linea del tempo", "In Autori tocca «Linea del tempo»: ogni vita è una barra. Le barre che si sovrappongono sono autori contemporanei."],
    ["map", "Dalla scheda", "Con un tocco ne fai una mappa, le flashcard o un'interrogazione simulata, oppure la salvi e la stampi."],
    ["check", "Quiz", "Dalla scheda: 6 domande a scelta multipla, una alla volta, con la spiegazione dopo ogni risposta."],
    ["layers", "Correnti", "Gli autori raggruppati per scuola di pensiero, con l'idea in una frase. «Spiegami questa corrente» per approfondire."],
    ["columns", "Confronta", "Scegli due autori e ottieni una tabella con somiglianze e differenze."],
    ["chat", "Chiedi all'autore", "Fai domande a Kant, Socrate, Piaget o Montessori: rispondono in prima persona, in modo semplice. È una simulazione, quindi controlla sempre sul libro."],
    ["bulb", "Concetti", "Una parola o un'idea che non ti è chiara, spiegata con un esempio e con la differenza dai concetti simili."],
    ["key", "Glossario", "Si riempie da solo con le parole chiave delle schede che apri. Puoi cercare una parola."]
  ]],
  ["Letteratura latina", "Gli autori latini, da Plauto ad Agostino. Si apre da Materie → Latino.", [
    ["timeline", "Autori per età", "Età arcaica, di Cesare, augustea, imperiale e tarda: in elenco o sulla linea del tempo, per vedere chi scriveva sotto quale imperatore."],
    ["file", "Scheda autore", "Vita, opere con il titolo latino, temi e stile, parole chiave, una frase celebre in latino con la traduzione e le domande da interrogazione. Parte dalla voce di Wikipedia."],
    ["layers", "Generi", "Epica, lirica, storiografia, satira, romanzo…: gli autori raggruppati per genere, con la spiegazione del genere."],
    ["check", "Quiz, confronto, domande", "Come per filosofia: quiz sull'autore, confronto tra due autori (es. Virgilio e Ovidio) e domande all'autore che risponde in prima persona."]
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
  if (name === "quaderno") { renderNotebook(); nbHighlight = new Set(); }
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
  $("#keyClaude").value = settings.keyClaude;
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
  $("#setCheck").checked = settings.check;
  folder.render(); autosave.renderList();
  const d = $("#dlgSettings");
  if (!d.open) d.showModal();
}

function bindSettings() {
  const map = {
    keyGemini: ["#keyGemini", v => v.trim()], keyGroq: ["#keyGroq", v => v.trim()], keyClaude: ["#keyClaude", v => v.trim()],
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
  $("#setCheck").addEventListener("change", (e) => { settings.check = e.target.checked; saveSettings(); });
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
const APP_VERSION = "29";

/* =========================================================
   TESTO DA UN SITO WEB
   - Wikipedia: servizio ufficiale (aperto a tutti), con ricerca per argomento
   - altri siti: estrattore di testo gratuito; se non basta, Gemini legge la pagina
   - "Manda a Zaino": un preferito del browser che spedisce qui il testo della pagina aperta
   - Android: Condividi → Zaino
   Esce solo l'indirizzo della pagina, mai dati personali.
   ========================================================= */
const web = {
  SKIP: /^(note|bibliografia|voci correlate|altri progetti|collegamenti esterni|fonti|riferimenti|note e riferimenti|see also|references|external links|further reading|notes)$/i,
  isUrl(t) { return /^(https?:\/\/|www\.)\S+$/i.test(t.trim()) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(t.trim()); },
  normUrl(t) { t = t.trim(); return /^https?:\/\//i.test(t) ? t : "https://" + t; },
  wikiOf(u) {
    try {
      const x = new URL(u);
      const m = x.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/i);
      if (!m) return null;
      const title = decodeURIComponent((x.pathname.match(/\/wiki\/(.+)$/) || [])[1] || x.searchParams.get("title") || "");
      return title ? { lang: m[1], title: title.replace(/_/g, " ") } : null;
    } catch { return null; }
  },
  async wikiText(lang, title) {
    const q = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", redirects: "1", titles: title, format: "json", origin: "*" });
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`);
    if (!r.ok) throw new Error("Wikipedia non risponde. Riprova tra poco.");
    const page = Object.values((await r.json()).query?.pages || {})[0];
    if (!page || page.missing !== undefined || !page.extract) throw new Error("Non ho trovato questa voce su Wikipedia.");
    // titoli "== Sezione ==" → "# Sezione"; mi fermo a Note, Bibliografia, ecc.
    const out = [];
    for (const line of page.extract.split("\n")) {
      const h = line.match(/^(=+)\s*(.*?)\s*=+$/);
      if (h) { if (this.SKIP.test(h[2])) break; if (h[2]) out.push("", "# " + h[2]); continue; }
      out.push(line);
    }
    const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return { title: page.title, text: "# " + page.title + "\n\n" + text };
  },
  async wikiSearch(q, lang = "it") {
    const p = new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: "6", format: "json", origin: "*" });
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${p}`);
    if (!r.ok) throw new Error("Wikipedia non risponde. Riprova tra poco.");
    return ((await r.json()).query?.search || []).map(x => ({ title: x.title, snippet: x.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#0?39;/g, "'") }));
  },
  /** Pulizia del testo che arriva dall'estrattore (Markdown) */
  clean(md) {
    return md
      .replace(/^(?:\s*(?:Title|URL Source|Published Time|Warning|Markdown Content):.*\n)+/, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                 // immagini
      .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")   // link → solo il testo
      .replace(/^\s*[-*+]\s*$/gm, "")
      .replace(/^#{2,6}\s*/gm, "# ")
      .replace(/^(=+|-{3,})\s*$/gm, "")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
      .split("\n\n").filter(par => {          // via i menu: blocchi fatti solo di parole corte senza punteggiatura
        const t = par.trim(); if (!t) return false;
        const lines = t.split("\n");
        return !(lines.length > 3 && lines.every(l => l.trim().split(/\s+/).length <= 4 && !/[.!?:;]$/.test(l.trim())));
      }).join("\n\n").trim();
  },
  async pageText(url) {
    const w = this.wikiOf(url);
    if (w) return this.wikiText(w.lang, w.title);
    // 1) estrattore di testo gratuito
    try {
      const r = await fetch("https://r.jina.ai/" + url, { headers: { Accept: "text/plain" } });
      if (r.ok) {
        const raw = await r.text();
        const title = (raw.match(/^Title:\s*(.+)$/m) || [])[1] || "";
        const text = this.clean(raw);
        if (text.split(/\s+/).length > 60) return { title, text: (title ? "# " + title + "\n\n" : "") + text };
      }
    } catch { /* provo con Gemini */ }
    // 2) Gemini legge la pagina
    if (settings.keyGemini) {
      busy(true, "Chiedo a Gemini di leggere la pagina…");
      const prompt = `Apri questa pagina e riporta il TESTO PRINCIPALE così com'è, in italiano se è in italiano, senza riassumere e senza commenti.
Togli menu, pubblicità, commenti dei lettori, note a piè di pagina e link. Metti il titolo della pagina sulla prima riga preceduto da "# " e i titoli dei paragrafi preceduti da "# ".
Se la pagina non si può aprire o richiede un accesso, rispondi solo: NON_DISPONIBILE
Pagina: ${url}`;
      for (const m of [settings.modGemini || DEFAULTS.modGemini, "gemini-2.5-flash"]) {
        try {
          const t = (await geminiCall({ prompt, model: m, temperature: 0, tools: [{ url_context: {} }] })).trim();
          if (/NON_DISPONIBILE/.test(t) || t.split(/\s+/).length < 40) break;
          return { title: (t.match(/^#\s*(.+)$/m) || [])[1] || "", text: t };
        } catch { /* provo il modello successivo */ }
      }
    }
    throw new Error("Questa pagina non si lascia leggere (forse serve un accesso). Usa il tasto «Manda a Zaino» oppure copia e incolla il testo.");
  },
  open({ title, text }, from = "") {
    if (text.length > 120000) text = text.slice(0, 120000) + "\n\n[…il testo continua sulla pagina originale]";
    reader.load(text);
    showView("leggi");
    this.hideBox();
    toast(from ? `Testo arrivato da ${from}. Premi ▶️ per ascoltare.` : "Fatto! Premi ▶️ per ascoltare.");
    setTimeout(() => $("#readerCard").scrollIntoView({ behavior: "smooth" }), 50);
  },
  async go(q) {
    q = (q ?? $("#webInput").value).trim();
    if (!q) return toast("Scrivi un argomento o incolla un link.");
    const res = $("#webResults");
    try {
      if (this.isUrl(q)) {
        busy(true, "Leggo la pagina…");
        this.open(await this.pageText(this.normUrl(q)));
      } else {
        busy(true, "Cerco su Wikipedia…");
        const list = await this.wikiSearch(q);
        res.innerHTML = list.length
          ? `<p class="hint">Scegli la voce giusta:</p>` + list.map(x => `<button class="web-hit" data-wt="${escapeHtml(x.title)}"><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.snippet)}…</small></button>`).join("")
          : `<p class="hint">Nessuna voce trovata. Prova con un'altra parola.</p>`;
      }
    } catch (e) { toast(e.message || "Non sono riuscito a leggere la pagina.", 7000); }
    finally { busy(false); }
  },
  async openWiki(title) {
    try { busy(true, "Apro la voce…"); this.open(await this.wikiText("it", title)); }
    catch (e) { toast(e.message, 6000); }
    finally { busy(false); }
  },
  showBox() {
    $("#webBox").classList.remove("hidden");
    $("#pasteActions").classList.add("hidden");
    $("#webInput").focus();
  },
  hideBox() { $("#webBox").classList.add("hidden"); $("#webResults").innerHTML = ""; $("#webInput").value = ""; },

  /* ---- "Manda a Zaino" ---- */
  appUrl() { return location.origin + location.pathname.replace(/index\.html$/, ""); },
  bookmarklet() {
    const app = this.appUrl(), origin = location.origin;
    const code = `(()=>{const s=String(getSelection()).trim();const el=document.querySelector('article,main,[role=main]')||document.body;const t=s.length>80?s:el.innerText;const m={type:'zaino-text',title:document.title,url:location.href,text:t};try{navigator.clipboard.writeText(t)}catch(e){}const w=window.open('${app}?from=page','zaino');let n=0;const i=setInterval(()=>{try{w.postMessage(m,'${origin}')}catch(e){}if(++n>60)clearInterval(i)},250);addEventListener('message',e=>{if(e.origin==='${origin}'&&e.data==='zaino-ok')clearInterval(i)})})()`;
    return "javascript:" + encodeURIComponent(code).replace(/%3D/g, "=").replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%2F/g, "/");
  },
  guide() {
    const bm = this.bookmarklet(), code = decodeURIComponent(bm);
    $("#bmBody").innerHTML = `<p>È un preferito speciale del browser. Quando sei su una pagina, anche dove hai fatto l'accesso (registro, piattaforma della scuola), lo tocchi e il testo arriva qui, pulito. Se prima selezioni una parte, arriva solo quella.</p>
      <h3>Sul computer</h3>
      <p>Trascina questo tasto nella barra dei preferiti (se non la vedi: <b>Ctrl+Maiusc+B</b>, sul Mac <b>Cmd+Maiusc+B</b>).</p>
      <p><a class="btn primary bm-link" href="${bm}" draggable="true">${icon("bookmark")}Manda a Zaino</a></p>
      <h3>Su iPhone o iPad (Safari)</h3>
      <ol class="bm-steps">
        <li>Premi <b>Copia il codice</b> qui sotto.</li>
        <li>Tocca il tasto <b>Condividi</b> di Safari, scegli <b>Aggiungi segnalibro</b> e poi <b>Salva</b>.</li>
        <li>Apri i segnalibri (l'icona del libro), tocca <b>Modifica</b> e poi il segnalibro appena creato.</li>
        <li>Chiamalo <b>Manda a Zaino</b>, cancella l'indirizzo e <b>incolla</b> al suo posto il codice.</li>
        <li>Per usarlo: sulla pagina che ti serve apri i segnalibri e tocca <b>Manda a Zaino</b>.</li>
      </ol>
      <div class="btn-row"><button class="btn primary" id="bmCopy">${icon("copy")}Copia il codice</button></div>
      <textarea class="bm-code" readonly rows="3" aria-label="Codice del tasto">${escapeHtml(code)}</textarea>
      <p class="hint">Se usi Zaino dall'icona sulla schermata Home, il testo viene anche copiato: apri Zaino e premi <b>Incolla un testo</b>.</p>
      <h3>Su Android</h3>
      <p>Più semplice ancora: con Zaino installato, nel browser tocca <b>Condividi</b> e scegli <b>Zaino</b>.</p>`;
    $("#bmBody .bm-link").addEventListener("click", (e) => { e.preventDefault(); toast("Non toccarlo qui: trascinalo nella barra dei preferiti."); });
    $("#bmCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(code); toast("Codice copiato. Ora incollalo nel segnalibro."); }
      catch { const ta = $("#bmBody .bm-code"); ta.focus(); ta.select(); document.execCommand?.("copy"); toast("Codice selezionato: copialo e incollalo nel segnalibro."); }
    });
    $("#dlgBookmark").showModal();
  },
  /** Riceve il testo dal tasto «Manda a Zaino» e dalla condivisione su Android */
  receive() {
    const qs = new URLSearchParams(location.search);
    const clean = () => history.replaceState(null, "", location.pathname);
    if (qs.get("from") === "page") {
      busy(true, "Aspetto il testo dalla pagina…");
      let done = false;
      const onMsg = (e) => {
        const d = e.data;
        if (done || !d || d.type !== "zaino-text" || typeof d.text !== "string") return;
        done = true; window.removeEventListener("message", onMsg); clean();
        try { e.source?.postMessage("zaino-ok", e.origin); } catch { /* niente */ }
        busy(false);
        let host = ""; try { host = new URL(d.url).hostname.replace(/^www\./, ""); } catch { /* niente */ }
        const title = String(d.title || "").slice(0, 200);
        const body = d.text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        this.open({ title, text: (title && !body.startsWith(title) ? "# " + title + "\n\n" : "") + body }, host || "la pagina");
      };
      window.addEventListener("message", onMsg);
      setTimeout(() => {
        if (done) return;
        done = true; window.removeEventListener("message", onMsg); busy(false); clean();
        toast("Il testo non è arrivato, ma è stato copiato: premi «Incolla un testo».", 7000);
        $("#btnPaste").click();
      }, 8000);
      return;
    }
    if (qs.has("share")) {
      setTimeout(clean, 4000);
      const text = (qs.get("text") || "").trim(), url = (qs.get("url") || "").trim() || (text.match(/https?:\/\/\S+/) || [])[0] || "";
      const textOnly = text.replace(url, "").trim();
      if (textOnly.split(/\s+/).length > 40) return this.open({ title: qs.get("title") || "", text: textOnly }, "la condivisione");
      if (url) { $("#webInput").value = url; this.showBox(); return this.go(url); }
      if (textOnly) return this.open({ title: "", text: textOnly });
    }
  },
  bind() {
    $("#btnWeb").addEventListener("click", () => this.showBox());
    $("#btnWebGo").addEventListener("click", () => this.go());
    $("#webInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.go(); } });
    $("#webResults").addEventListener("click", (e) => { const b = e.target.closest("[data-wt]"); if (b) this.openWiki(b.dataset.wt); });
    $("#btnBookmarklet").addEventListener("click", () => this.guide());
    $("#btnWebClose").addEventListener("click", () => this.hideBox());
    $("#btnBmClose").addEventListener("click", () => $("#dlgBookmark").close());
  }
};

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
  $("#btnNotebook")?.addEventListener("click", () => showView("quaderno"));
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
  let down = null, drag = null;
  mw.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
    const g = e.target.closest(".map-node");
    if (mindmap.moving && g) { drag = mindmap.dragStart(e, g); if (drag) mw.setPointerCapture(e.pointerId); }
  });
  mw.addEventListener("pointermove", (e) => { if (drag) mindmap.dragMove(e, drag); });
  mw.addEventListener("pointercancel", () => { down = null; if (drag) { drag = null; mindmap.draw(); } });
  mw.addEventListener("pointerup", (e) => {
    if (drag) { const d = drag; drag = null; down = null; return mindmap.dragEnd(d); }
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
    down = null;
    if (mindmap.moving) return;
    const g = e.target.closest(".map-node");
    if (mindmap.linking) return mindmap.finishLink(g?.dataset.id || null);
    const link = e.target.closest("[data-link]");
    if (link) return mindmap.editLink(+link.dataset.link);
    const el = e.target.closest("[data-elabel]");
    if (el) { mindmap.select(el.dataset.elabel); return mindmap.nodeAction("label"); }
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
  $("#btnMapMove").addEventListener("click", () => mindmap.toggleMove());
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
  $("#btnQuizExpose").addEventListener("click", () => { const src = quiz.pick(); ripassa.tab("spiega"); if (src?.text) spiega.setSource(src.text, src.title); spiega.start(); });
  spiega.bind();
  prof.bind();
  palazzo.bind();
  zoom.bind();
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

  // chiedo al browser di non cancellare i dati di Zaino quando manca spazio
  try { navigator.storage?.persist?.(); } catch { /* niente */ }
  web.bind();
  kit.bind();
  trash.purge(); trash.render();
  imgPicker.bind();
  autosave.init();
  $("#btnTrash").addEventListener("click", () => trash.open());
  $("#trashList").addEventListener("click", (e) => { const b = e.target.closest("[data-tr]"); if (b) trash.restore(+b.dataset.tr); });
  $("#btnTrashClose").addEventListener("click", () => $("#dlgTrash").close());
  $("#folderBox").addEventListener("click", (e) => { const b = e.target.closest("[data-fold]"); if (b) folder[b.dataset.fold]?.(); });
  $("#snapList").addEventListener("click", (e) => { const b = e.target.closest("[data-snap]"); if (b) autosave.restore(b.dataset.snap); });

  // ripristino del lavoro in corso
  const cur = store.get("current", "");
  if (cur) reader.load(cur); else home.render();
  $("#txtDictation").value = store.get("dictation", "");
  const cm = store.get("currentMap", null);
  if (cm?.root) mindmap.load(cm.root, cm.savedId);
  flash.refreshDecks();
  web.receive();
  // quando i caratteri sono pronti ridisegno la mappa con le misure giuste
  document.fonts?.ready.then(() => { if (mindmap.root) mindmap.draw(); });

  // primo avvio: chiedo le chiavi
  if (!store.get("welcomed", false)) setTimeout(() => welcome.open(), 300);
  else if (!settings.keyGemini && !settings.keyGroq) setTimeout(() => { openSettings(); toast("Inserisci le chiavi gratuite di Gemini e Groq per iniziare.", 5000); }, 400);
  news.bind(); news.maybeShow();

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
