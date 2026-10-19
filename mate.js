/* Zaino — Matematica.
   Calcolatrice parlante, equazioni con i passaggi, grafici, unità di misura,
   formulario, tavola pitagorica, esercizio da foto.
   Usa le funzioni di app.js ($, tts, toast, ask…): parte con mate.init(). */
"use strict";

/* =========================================================
   1. LETTURA DELLE ESPRESSIONI (senza eval)
   ========================================================= */
const MathParse = (() => {
  const FUNCS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10,
    sin: null, cos: null, tan: null, asin: null, acos: null, atan: null // dipendono da gradi/radianti
  };
  const NAMES = ["asin", "acos", "atan", "sqrt", "cbrt", "sin", "cos", "tan", "sen", "tg", "log", "abs", "ln", "pi", "x", "e"];

  function normalize(s) {
    return s.toLowerCase()
      .replace(/[×·∙]/g, "*").replace(/[÷:]/g, "/").replace(/[−–]/g, "-")
      .replace(/,/g, ".").replace(/π/g, "pi").replace(/√/g, "sqrt")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/\s+/g, "");
  }

  function tokenize(src) {
    const s = normalize(src), out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1 || num === ".") throw new Error(`Numero non valido: ${num.replace(".", ",")}`);
        out.push({ t: "n", v: parseFloat(num) }); i = j; continue;
      }
      if (/[a-z]/.test(c)) {
        const name = NAMES.find(n => s.startsWith(n, i));
        if (!name) { const w = s.slice(i).match(/^[a-z]+/)[0]; throw new Error(`Non conosco «${w}». Puoi usare x, π, √, sin, cos, tan, log, ln.`); }
        const norm = { sen: "sin", tg: "tan" }[name] || name;
        out.push({ t: "id", v: norm }); i += name.length; continue;
      }
      if ("+-*/^()!%".includes(c)) { out.push({ t: c }); i++; continue; }
      if (c === "=") throw new Error("Usa «=» solo nelle equazioni.");
      throw new Error(`Simbolo non valido: ${c}`);
    }
    return out;
  }

  /** Trasforma il testo in una funzione f(x). */
  function compile(src, { deg = false } = {}) {
    const toks = tokenize(src);
    if (!toks.length) throw new Error("Scrivi un'espressione.");
    let p = 0;
    const peek = () => toks[p], take = () => toks[p++];
    const k = deg ? Math.PI / 180 : 1;
    const trig = {
      sin: (v) => Math.sin(v * k), cos: (v) => Math.cos(v * k), tan: (v) => {
        if (deg && Math.abs(((v % 180) + 180) % 180 - 90) < 1e-9) return NaN;
        return Math.tan(v * k);
      },
      asin: (v) => Math.asin(v) / k, acos: (v) => Math.acos(v) / k, atan: (v) => Math.atan(v) / k
    };
    const startsFactor = (t) => t && (t.t === "n" || t.t === "id" || t.t === "(");

    function expr() {
      let left = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = take().t, a = left, b = term();
        left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
      }
      return left;
    }
    function term() {
      let left = unary();
      for (;;) {
        const t = peek();
        if (t && (t.t === "*" || t.t === "/")) {
          take(); const a = left, b = unary();
          left = t.t === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
        } else if (startsFactor(t)) {            // moltiplicazione sottintesa: 2x, 3(x+1), 2π
          const a = left, b = power();
          left = (x) => a(x) * b(x);
        } else return left;
      }
    }
    function unary() {
      const t = peek();
      if (t && (t.t === "-" || t.t === "+")) { take(); const a = unary(); return t.t === "-" ? (x) => -a(x) : a; }
      return power();
    }
    function power() {
      const base = postfix();
      if (peek() && peek().t === "^") { take(); const ex = unary(); return (x) => Math.pow(base(x), ex(x)); }
      return base;
    }
    function postfix() {
      let a = primary();
      while (peek() && (peek().t === "!" || peek().t === "%")) {
        const op = take().t, f = a;
        a = op === "%" ? (x) => f(x) / 100 : (x) => factorial(f(x));
      }
      return a;
    }
    function primary() {
      const t = take();
      if (!t) throw new Error("L'espressione è incompleta.");
      if (t.t === "n") { const v = t.v; return () => v; }
      if (t.t === "(") {
        const e = expr();
        if (!peek() || peek().t !== ")") throw new Error("Manca una parentesi chiusa «)».");
        take(); return e;
      }
      if (t.t === "id") {
        if (t.v === "x") return (x) => x;
        if (t.v === "pi") return () => Math.PI;
        if (t.v === "e") return () => Math.E;
        const fn = trig[t.v] || FUNCS[t.v];
        if (!fn) throw new Error(`Non conosco «${t.v}».`);
        let arg;
        if (peek() && peek().t === "(") { take(); arg = expr(); if (!peek() || peek().t !== ")") throw new Error("Manca una parentesi chiusa «)»."); take(); }
        else arg = power();                       // √9, sin30
        return (x) => fn(arg(x));
      }
      if (t.t === ")") throw new Error("C'è una parentesi chiusa di troppo.");
      throw new Error("Manca un numero vicino a «" + t.t + "».");
    }
    const f = expr();
    if (p < toks.length) throw new Error(toks[p].t === ")" ? "C'è una parentesi chiusa di troppo." : "Controlla l'espressione: c'è qualcosa di troppo.");
    return f;
  }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  return { compile, normalize };
})();

/* ---------- numeri in italiano ---------- */
function fmtNum(v, digits = 10) {
  if (!isFinite(v)) return isNaN(v) ? "impossibile" : (v > 0 ? "∞" : "−∞");
  if (Math.abs(v) < 1e-12) v = 0;
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e12 || a < 1e-7)) {
    const [m, e] = v.toExponential(6).split("e");
    return `${Number(m).toLocaleString("it-IT", { maximumFractionDigits: 6 })} × 10^${Number(e)}`;
  }
  return Number(v.toPrecision(12)).toLocaleString("it-IT", { maximumFractionDigits: digits, useGrouping: true }).replace(/-/g, "−");
}
/** Frazione se il numero è "bello" (denominatore piccolo). */
function toFrac(v, maxDen = 1000) {
  if (!isFinite(v)) return null;
  if (Number.isInteger(Math.round(v * 1e9) / 1e9)) return fmtNum(Math.round(v));
  for (let d = 2; d <= maxDen; d++) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const nn = Math.round(n);
      return `${nn < 0 ? "−" : ""}${Math.abs(nn)}/${d}`;
    }
  }
  return null;
}
const nice = (v) => toFrac(v) || fmtNum(v, 6);
/** Come si legge un'espressione ad alta voce. */
function speakable(expr) {
  return expr.replace(/\*|×|·/g, " per ").replace(/\/|÷/g, " diviso ").replace(/\+/g, " più ").replace(/[-−]/g, " meno ")
    .replace(/\^2|²/g, " al quadrato ").replace(/\^3|³/g, " al cubo ").replace(/\^/g, " elevato alla ")
    .replace(/√|sqrt/g, " radice quadrata di ").replace(/π|pi/g, " pi greco ").replace(/%/g, " per cento ")
    .replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

/* =========================================================
   2. SEZIONE MATEMATICA
   ========================================================= */
const mate = {
  inited: {},
  tab(name) {
    $$("#mateSeg button").forEach(b => b.classList.toggle("on", b.dataset.mt === name));
    $$(".mate-pane").forEach(p => p.classList.toggle("hidden", p.dataset.mpane !== name));
    const init = { calc: () => calc.init(), eq: () => eqs.init(), graph: () => graph.init(), units: () => units.init(), formule: () => formule.init(), tab: () => pyth.init(), stat: () => stat.init() }[name];
    if (init && !this.inited[name]) { init(); this.inited[name] = true; }
    if (name === "graph") graph.draw();
  },
  init() {
    $("#mateSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-mt]"); if (b) this.tab(b.dataset.mt); });
    this.tab("calc");
    // esercizio da foto o scritto
    $("#mathPhoto").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try {
        busy(true, "Leggo l'esercizio…");
        const img = await imageToBase64(f);
        this.showExercise(parseJSON(await ask({ prompt: PROMPTS.esercizio("(L'esercizio è nella foto.)"), images: [img], json: true, temperature: 0.2 })));
      } catch (err) { toast(err.message || "Non sono riuscito a leggere l'esercizio. Riprova con una foto più vicina.", 6000); }
      finally { busy(false); }
    });
    $("#btnMathText").addEventListener("click", async () => {
      const t = $("#mathText").value.trim();
      if (!t) return toast("Scrivi prima l'esercizio.");
      try {
        busy(true, "Studio l'esercizio…");
        this.showExercise(parseJSON(await ask({ prompt: PROMPTS.esercizio(t), system: SYSTEM_TUTOR, json: true, temperature: 0.2 })));
      } catch (err) { toast(err.message || "Non sono riuscito a risolverlo. Riprova.", 6000); }
      finally { busy(false); }
    });
    $("#mathResult").addEventListener("click", (e) => { const b = e.target.closest("[data-ex]"); if (b) exerciseControl(b.dataset.ex, $("#mathResult")); });
  },
  showExercise(data) {
    const r = renderExercise(data);
    $("#mathResult").innerHTML = r.html;
    $("#mathOut").classList.remove("hidden");
    $("#mathOut").scrollIntoView({ behavior: "smooth" });
  }
};

/* ---------- calcolatrice ---------- */
const calc = {
  history: [],
  KEYS: [
    ["sin", "fn"], ["cos", "fn"], ["tan", "fn"], ["√", "fn"], ["C", "del"],
    ["(", "fn"], [")", "fn"], ["x²", "fn"], ["^", "fn"], ["⌫", "del"],
    ["7"], ["8"], ["9"], ["÷", "op"], ["π", "fn"],
    ["4"], ["5"], ["6"], ["×", "op"], ["log", "fn"],
    ["1"], ["2"], ["3"], ["−", "op"], ["%", "fn"],
    ["0"], [","], ["!", "fn"], ["+", "op"], ["=", "eq"]
  ],
  init() {
    this.history = store.get("calcHistory", []);
    $("#calcKeys").innerHTML = this.KEYS.map(([k, c]) => `<button class="key ${c || ""}" data-k="${k}" aria-label="${this.label(k)}">${k}</button>`).join("");
    $("#calcKeys").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) this.press(b.dataset.k); });
    const inp = $("#calcExpr");
    inp.addEventListener("input", () => this.preview());
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.equals(); } });
    $("#calcKeyboard").addEventListener("click", () => {
      const on = inp.getAttribute("inputmode") === "none";
      inp.setAttribute("inputmode", on ? "text" : "none");
      $("#calcKeyboard").textContent = on ? "Usa i tasti" : "Usa la tastiera";
      inp.blur(); setTimeout(() => inp.focus(), 30);
    });
    $("#calcDeg").addEventListener("change", () => this.preview());
    $("#calcHistory").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (!li) return;
      inp.value = this.history[li.dataset.i].e; this.preview();
    });
    this.renderHistory();
  },
  label(k) {
    return { "√": "radice quadrata", "⌫": "cancella", "C": "cancella tutto", "÷": "diviso", "×": "per", "−": "meno", "x²": "al quadrato", "^": "elevato", "π": "pi greco", ",": "virgola", "!": "fattoriale", "%": "per cento" }[k] || k;
  },
  press(k) {
    const inp = $("#calcExpr");
    const ins = { "sin": "sin(", "cos": "cos(", "tan": "tan(", "log": "log(", "√": "√(", "x²": "²" }[k] ?? k;
    if (k === "=") return this.equals();
    if (k === "C") { inp.value = ""; this.preview(); return; }
    let s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
    if (document.activeElement !== inp) { s = en = inp.value.length; }
    if (k === "⌫") {
      if (s === en && s > 0) s--;
      inp.value = inp.value.slice(0, s) + inp.value.slice(en);
      inp.setSelectionRange(s, s);
    } else {
      inp.value = inp.value.slice(0, s) + ins + inp.value.slice(en);
      inp.setSelectionRange(s + ins.length, s + ins.length);
    }
    this.preview();
  },
  eval(src) {
    // chiudo da sola le parentesi rimaste aperte
    const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
    const full = src + ")".repeat(Math.max(0, open));
    return MathParse.compile(full, { deg: $("#calcDeg").checked })(0);
  },
  preview() {
    const src = $("#calcExpr").value.trim(), out = $("#calcResult");
    out.classList.remove("err");
    if (!src) { out.textContent = ""; return; }
    try { const v = this.eval(src); out.textContent = isFinite(v) ? "= " + fmtNum(v) : ""; out.style.opacity = .55; }
    catch { out.textContent = ""; }
  },
  equals() {
    const src = $("#calcExpr").value.trim(), out = $("#calcResult");
    if (!src) return;
    try {
      const v = this.eval(src);
      out.classList.remove("err"); out.style.opacity = 1;
      if (!isFinite(v)) {
        out.classList.add("err");
        out.textContent = isNaN(v) ? "Non si può calcolare (es. divisione per zero o radice di un numero negativo)." : "Il risultato è troppo grande.";
        return;
      }
      const r = fmtNum(v), fr = toFrac(v, 100);
      out.textContent = "= " + r + (fr && fr.includes("/") ? `   (${fr})` : "");
      this.history.unshift({ e: src, r });
      this.history = this.history.slice(0, 30);
      store.set("calcHistory", this.history);
      this.renderHistory();
      if ($("#calcSpeak").checked) tts.say(`${speakable(src)} uguale ${r}`, null, "it");
    } catch (err) {
      out.classList.add("err"); out.style.opacity = 1;
      out.textContent = err.message;
    }
  },
  renderHistory() {
    $("#calcHistory").innerHTML = this.history.length
      ? this.history.map((h, i) => `<li data-i="${i}"><span>${escapeHtml(h.e)}</span><span>= ${escapeHtml(h.r)}</span></li>`).join("")
      : `<li class="hint">I calcoli compariranno qui. Toccane uno per riusarlo.</li>`;
  }
};

/* ---------- equazioni di 1° e 2° grado ---------- */
const eqs = {
  init() {
    $("#eqKeys").innerHTML = ["x", "x²", "=", "+", "−", "(", ")", "/", "√"].map(k => `<button class="key" data-k="${k}">${k}</button>`).join("");
    $("#eqKeys").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      const inp = $("#eqInput"), ins = { "x²": "x^2", "√": "√(" }[b.dataset.k] || b.dataset.k;
      const s = inp.selectionStart ?? inp.value.length;
      inp.value = inp.value.slice(0, s) + ins + inp.value.slice(inp.selectionEnd ?? s);
      inp.focus(); inp.setSelectionRange(s + ins.length, s + ins.length);
    });
    $("#btnEqSolve").addEventListener("click", () => this.solve());
    $("#eqInput").addEventListener("keydown", (e) => { if (e.key === "Enter") this.solve(); });
  },
  /** ax² + bx + c in forma leggibile */
  poly(a, b, c) {
    const parts = [];
    const term = (k, v) => {
      if (Math.abs(k) < 1e-12) return;
      const sign = k < 0 ? "−" : "+";
      const abs = Math.abs(k);
      const coef = (v && Math.abs(abs - 1) < 1e-12) ? "" : nice(abs);
      parts.push({ sign, txt: coef + v });
    };
    term(a, "x²"); term(b, "x"); term(c, "");
    if (!parts.length) return "0";
    return parts.map((p, i) => i === 0 ? (p.sign === "−" ? "−" : "") + p.txt : ` ${p.sign} ${p.txt}`).join("");
  },
  par: (v) => v < 0 ? `(${nice(v)})` : nice(v),
  solve() {
    const raw = $("#eqInput").value.trim();
    const out = $("#eqOut");
    if (!raw) return toast("Scrivi prima l'equazione.");
    const sides = raw.split("=");
    if (sides.length > 2) return toast("L'equazione deve avere un solo «=».");
    const L = sides[0].trim(), R = (sides[1] ?? "0").trim() || "0";
    let f;
    try {
      const fl = MathParse.compile(L), fr = MathParse.compile(R);
      f = (x) => fl(x) - fr(x);
    } catch (e) { return toast(e.message, 5000); }
    const c = f(0), f1 = f(1), fm = f(-1);
    const a = (f1 + fm) / 2 - c, b = (f1 - fm) / 2;
    const check = [2, 3, -2.5, 0.5].every(x => Math.abs(f(x) - (a * x * x + b * x + c)) < 1e-7 * Math.max(1, Math.abs(f(x))));
    if (![a, b, c].every(isFinite) || !check) {
      out.innerHTML = `<h2>Non riesco a risolverla</h2><p>Questo strumento risolve le equazioni di <b>1° e 2° grado</b> (anche con parentesi e frazioni numeriche). Se l'equazione ha la x al denominatore o un grado più alto, prova con <b>Da foto</b>: ti guido passo per passo.</p>`;
      out.classList.remove("hidden"); return;
    }
    const steps = [];
    const show = (txt, math) => steps.push({ txt, math });
    const pretty = (s) => s.replace(/\*/g, "·").replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/-/g, "−");
    show("L'equazione di partenza", pretty(raw.includes("=") ? raw : raw + " = 0"));
    if (R !== "0") show("Porto tutto a sinistra dell'uguale, cambiando il segno ai termini che sposto", `${pretty(L)} − (${pretty(R)}) = 0`);
    const normal = `${this.poly(a, b, c)} = 0`;
    if (normal.replace(/\s/g, "") !== pretty(raw.includes("=") ? raw : raw + "=0").replace(/\s/g, "")) show("Faccio i calcoli e ordino i termini (forma normale)", normal);
    let sol = "", speech = "";
    const A = Math.abs(a) < 1e-12 ? 0 : a, B = Math.abs(b) < 1e-12 ? 0 : b, C = Math.abs(c) < 1e-12 ? 0 : c;
    if (A === 0) {
      if (B === 0) {
        if (C === 0) { show("Resta 0 = 0: è sempre vera", "0 = 0"); sol = "Indeterminata: <span>ogni numero è soluzione</span>"; }
        else { show(`Resta ${nice(-C)} = 0, che è falsa`, `${nice(-C)} ≠ 0`); sol = "Impossibile: <span>nessuna soluzione</span>"; }
      } else {
        show("È di 1° grado. Isolo il termine con la x: porto il numero dall'altra parte", `${this.poly(0, B, 0)} = ${nice(-C)}`);
        show(`Divido entrambi i membri per ${nice(B)}`, `x = ${nice(-C)} / ${this.par(B)}`);
        const x = -C / B;
        sol = `x = <span>${nice(x)}</span>` + (toFrac(x) && toFrac(x).includes("/") ? ` <small>(≈ ${fmtNum(x, 4)})</small>` : "");
        speech = `x uguale ${nice(x).replace("/", " fratto ")}`;
      }
    } else {
      show("È di 2° grado. Riconosco i coefficienti", `a = ${nice(A)};   b = ${nice(B)};   c = ${nice(C)}`);
      if (C === 0 && B !== 0) show("Suggerimento: c = 0, si può anche raccogliere la x", `x · (${this.poly(0, A, B).replace("x", "x")}) = 0`);
      if (B === 0) show("Suggerimento: b = 0, è un'equazione pura: si può isolare x²", `x² = ${nice(-C / A)}`);
      const D = B * B - 4 * A * C;
      show("Calcolo il discriminante Δ = b² − 4ac", `Δ = ${this.par(B)}² − 4 · ${this.par(A)} · ${this.par(C)} = ${nice(D)}`);
      if (D < -1e-12) {
        show("Δ è negativo: non esiste la radice quadrata di un numero negativo", "Δ < 0");
        sol = "Impossibile: <span>nessuna soluzione reale</span>";
        speech = "Delta è negativo: nessuna soluzione reale";
      } else if (Math.abs(D) <= 1e-12) {
        const x = -B / (2 * A);
        show("Δ = 0: c'è una sola soluzione (doppia)", `x = −b / 2a = ${nice(-B)} / ${nice(2 * A)}`);
        sol = `x₁ = x₂ = <span>${nice(x)}</span>`;
        speech = `una sola soluzione: x uguale ${nice(x).replace("/", " fratto ")}`;
      } else {
        const r = Math.sqrt(D);
        const rTxt = Number.isInteger(Math.round(r * 1e9) / 1e9) ? nice(r) : `√${nice(D)} ≈ ${fmtNum(r, 4)}`;
        show("Δ è positivo: ci sono due soluzioni. Calcolo √Δ", `√Δ = ${rTxt}`);
        show("Uso la formula risolutiva", `x = (−b ± √Δ) / 2a = (${nice(-B)} ± ${Number.isInteger(Math.round(r * 1e9) / 1e9) ? nice(r) : "√" + nice(D)}) / ${nice(2 * A)}`);
        let x1 = (-B - r) / (2 * A), x2 = (-B + r) / (2 * A);
        if (x1 > x2) [x1, x2] = [x2, x1];
        const fmt = (x) => toFrac(x) ? toFrac(x) : `≈ ${fmtNum(x, 4)}`;
        sol = `x₁ = <span>${fmt(x1)}</span> &nbsp; x₂ = <span>${fmt(x2)}</span>`;
        speech = `due soluzioni: x uno uguale ${fmt(x1).replace("≈", "circa").replace("/", " fratto ")}, x due uguale ${fmt(x2).replace("≈", "circa").replace("/", " fratto ")}`;
      }
    }
    out.innerHTML = `
      <h2>Passaggi</h2>
      <ol class="eq-steps">${steps.map(s => `<li><div>${escapeHtml(s.txt)}</div><div class="math">${escapeHtml(s.math)}</div></li>`).join("")}</ol>
      <div class="eq-sol">${sol}</div>
      <div class="btn-row">
        <button class="btn" id="btnEqRead"><svg class="i"><use href="#i-volume"/></svg>Ascolta i passaggi</button>
        <button class="btn" id="btnEqPrint"><svg class="i"><use href="#i-printer"/></svg>Stampa</button>
      </div>`;
    out.classList.remove("hidden");
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    const spoken = steps.map(s => s.txt + ": " + speakable(s.math.replace(/x²/g, "x al quadrato").replace(/Δ/g, "delta"))).join(". ") + ". " + (speech || out.querySelector(".eq-sol").innerText);
    $("#btnEqRead").onclick = () => tts.say(spoken, null, "it");
    $("#btnEqPrint").onclick = () => {
      const box = out.cloneNode(true);
      box.querySelectorAll(".btn-row").forEach(x => x.remove());
      printer.run(`<div class="print-text">${box.innerHTML}</div>`, { title: "Equazione: " + raw });
    };
  }
};

/* ---------- grafici di funzioni ---------- */
const graph = {
  view: { cx: 0, cy: 0, ppu: 40 },   // centro e pixel per unità
  COLORS: ["#2c47c9", "#e0457b", "#17824f"],
  fns: [],
  init() {
    const cv = $("#graph");
    ["#fx1", "#fx2", "#fx3"].forEach(s => $(s).addEventListener("input", () => this.draw()));
    $("#gZoomIn").addEventListener("click", () => { this.view.ppu = Math.min(400, this.view.ppu * 1.4); this.draw(); });
    $("#gZoomOut").addEventListener("click", () => { this.view.ppu = Math.max(4, this.view.ppu / 1.4); this.draw(); });
    $("#gReset").addEventListener("click", () => { this.view = { cx: 0, cy: 0, ppu: 40 }; this.draw(); });
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      this.view.cx = drag.cx - dx / this.view.ppu; this.view.cy = drag.cy + dy / this.view.ppu;
      this.draw();
    });
    cv.addEventListener("pointerup", (e) => { if (drag && !drag.moved) this.probe(e); drag = null; });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); this.view.ppu = Math.max(4, Math.min(400, this.view.ppu * (e.deltaY < 0 ? 1.15 : 0.87))); this.draw(); }, { passive: false });
    addEventListener("resize", () => { if (!$("#view-mate").classList.contains("active")) return; this.draw(); });
  },
  compileAll() {
    this.fns = ["#fx1", "#fx2", "#fx3"].map((s, i) => {
      const src = $(s).value.trim();
      if (!src) return null;
      try { const f = MathParse.compile(src.replace(/^y\s*=/i, "")); $(s).style.borderColor = ""; return { f, color: this.COLORS[i], src }; }
      catch { $(s).style.borderColor = "var(--bad)"; return null; }
    });
  },
  draw() {
    const cv = $("#graph");
    if (!cv.offsetWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.offsetWidth, H = cv.offsetHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const { cx, cy, ppu } = this.view;
    const X = (x) => W / 2 + (x - cx) * ppu, Y = (y) => H / 2 - (y - cy) * ppu;
    const xmin = cx - W / 2 / ppu, xmax = cx + W / 2 / ppu, ymin = cy - H / 2 / ppu, ymax = cy + H / 2 / ppu;
    // passo della griglia: 1, 2, 5 × 10^n, almeno 40 px
    const raw = 40 / ppu, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= raw);
    g.lineWidth = 1; g.strokeStyle = "#eef0f6";
    for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(W, Y(y)); g.stroke(); }
    // assi
    g.strokeStyle = "#1c2440"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.stroke();
    g.fillStyle = "#5b6482"; g.font = "12px Lexend, sans-serif";
    const ay = Math.min(Math.max(Y(0) + 14, 14), H - 4), ax = Math.min(Math.max(X(0) - 6, 24), W - 4);
    g.textAlign = "center";
    for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) if (Math.abs(x) > step / 2) g.fillText(fmtNum(x, 3), X(x), ay);
    g.textAlign = "right";
    for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) if (Math.abs(y) > step / 2) g.fillText(fmtNum(y, 3), ax, Y(y) + 4);
    g.fillStyle = "#1c2440"; g.font = "600 13px Lexend, sans-serif";
    g.textAlign = "right"; g.fillText("x", W - 6, Math.min(Math.max(Y(0) - 6, 14), H - 4));
    g.textAlign = "left"; g.fillText("y", Math.min(Math.max(X(0) + 6, 4), W - 14), 14);
    // curve
    this.compileAll();
    for (const fn of this.fns) {
      if (!fn) continue;
      g.strokeStyle = fn.color; g.lineWidth = 2.5; g.beginPath();
      let pen = false, lastY = null;
      for (let px = 0; px <= W; px += 1) {
        const x = cx + (px - W / 2) / ppu;
        let y; try { y = fn.f(x); } catch { y = NaN; }
        const py = Y(y);
        if (!isFinite(y) || Math.abs(py) > 1e5 || (lastY !== null && Math.abs(py - lastY) > H * 1.5)) { pen = false; lastY = null; continue; }
        pen ? g.lineTo(px, py) : g.moveTo(px, py);
        pen = true; lastY = py;
      }
      g.stroke();
    }
    $("#graphPt").style.display = "none";
  },
  probe(e) {
    const cv = $("#graph"), r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const { cx, cy, ppu } = this.view;
    const x = cx + (px - r.width / 2) / ppu;
    let best = null;
    for (const fn of this.fns) {
      if (!fn) continue;
      const y = fn.f(x);
      if (!isFinite(y)) continue;
      const d = Math.abs(r.height / 2 - (y - cy) * ppu - py);
      if (d < 36 && (!best || d < best.d)) best = { d, y, fn };
    }
    const tip = $("#graphPt");
    if (!best) { tip.style.display = "none"; return; }
    const xr = Math.round(x * 100) / 100;
    const yr = best.fn.f(xr);
    tip.textContent = `x = ${fmtNum(xr, 2)}   y = ${fmtNum(yr, 3)}`;
    tip.style.left = (r.width / 2 + (xr - cx) * ppu) + "px";
    tip.style.top = (r.height / 2 - (yr - cy) * ppu) + "px";
    tip.style.display = "block";
    tip.style.background = best.fn.color;
  }
};

/* ---------- unità di misura ---------- */
const units = {
  // e = esponente di 10 rispetto all'unità base; f = fattore (per le unità non decimali)
  CATS: {
    lunghezza: { step: 1, list: [["km", 3], ["hm", 2], ["dam", 1], ["m", 0], ["dm", -1], ["cm", -2], ["mm", -3]] },
    massa: { step: 1, list: [["t", 6], ["q", 5], ["kg", 3], ["hg", 2], ["dag", 1], ["g", 0], ["dg", -1], ["cg", -2], ["mg", -3]] },
    capacità: { step: 1, list: [["kl", 3], ["hl", 2], ["dal", 1], ["l", 0], ["dl", -1], ["cl", -2], ["ml", -3]] },
    superficie: { step: 2, list: [["km²", 6], ["hm²", 4], ["dam²", 2], ["m²", 0], ["dm²", -2], ["cm²", -4], ["mm²", -6]], alias: { "ha (ettaro)": 4, "a (ara)": 2 } },
    volume: { step: 3, list: [["km³", 9], ["hm³", 6], ["dam³", 3], ["m³", 0], ["dm³", -3], ["cm³", -6], ["mm³", -9]], alias: { "l (= dm³)": -3, "ml (= cm³)": -6, "hl": -1 } },
    tempo: { list: [["giorni", 86400], ["h", 3600], ["min", 60], ["s", 1]], factor: true },
    velocità: { list: [["km/h", 1 / 3.6], ["m/s", 1]], factor: true }
  },
  cat: "lunghezza",
  init() {
    $("#unitSeg").innerHTML = Object.keys(this.CATS).map(k => `<button data-uc="${k}"${k === this.cat ? ' class="on"' : ""}>${k[0].toUpperCase() + k.slice(1)}</button>`).join("");
    $("#unitSeg").classList.add("scroll");
    $("#unitSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-uc]"); if (b) this.setCat(b.dataset.uc); });
    ["#unitVal", "#unitFrom", "#unitTo"].forEach(s => $(s).addEventListener("input", () => this.update()));
    $("#unitSwap").addEventListener("click", () => { const a = $("#unitFrom").value; $("#unitFrom").value = $("#unitTo").value; $("#unitTo").value = a; this.update(); });
    this.setCat("lunghezza");
  },
  all(cat) {
    const c = this.CATS[cat];
    return [...c.list, ...Object.entries(c.alias || {})];
  },
  setCat(cat) {
    this.cat = cat;
    $$("#unitSeg button").forEach(b => b.classList.toggle("on", b.dataset.uc === cat));
    const opts = this.all(cat).map(([n]) => `<option value="${n}">${n}</option>`).join("");
    $("#unitFrom").innerHTML = opts; $("#unitTo").innerHTML = opts;
    const l = this.CATS[cat].list;
    $("#unitFrom").value = l[Math.min(3, l.length - 2)][0];
    $("#unitTo").value = l[Math.min(5, l.length - 1)][0];
    this.update();
  },
  update() {
    const c = this.CATS[this.cat];
    const v = parseFloat($("#unitVal").value.replace(",", "."));
    const map = Object.fromEntries(this.all(this.cat));
    const from = $("#unitFrom").value, to = $("#unitTo").value;
    if (!isFinite(v)) { $("#unitOut").innerHTML = `<small>Scrivi un numero.</small>`; $("#unitLadder").innerHTML = ""; return; }
    let res, how;
    if (c.factor) {
      const k = map[from] / map[to];
      res = v * k;
      how = k >= 1 ? `Moltiplica per ${fmtNum(k, 4)}` : `Dividi per ${fmtNum(1 / k, 4)}`;
      $("#unitLadder").innerHTML = "";
    } else {
      const diff = map[from] - map[to];
      const k = Math.pow(10, diff);
      res = v * k;
      const n = Math.abs(diff);
      how = diff === 0 ? "Stessa unità: il numero non cambia."
        : diff > 0 ? `Scendi verso unità più piccole: moltiplica per ${fmtNum(k)} (sposta la virgola di ${n} ${n === 1 ? "posto" : "posti"} a destra).`
        : `Sali verso unità più grandi: dividi per ${fmtNum(1 / k)} (sposta la virgola di ${n} ${n === 1 ? "posto" : "posti"} a sinistra).`;
      // la scala: un gradino per unità
      const ef = map[from], et = map[to];
      const lo = Math.min(ef, et), hi = Math.max(ef, et);
      const per = fmtNum(Math.pow(10, c.step));
      $("#unitLadder").innerHTML = c.list.map(([name, e]) => {
        const cls = e === ef ? "from" : e === et ? "to" : (e < hi && e > lo ? "pass" : "");
        return `<div class="rung ${cls}"><b>${name}</b><small>${cls === "from" ? "parti da qui" : cls === "to" ? "arrivi qui" : ""}</small></div>`;
      }).join("") + `<p class="hint">Ogni gradino della scala vale × ${per}${this.cat === "massa" ? " (tra q, t e kg i gradini mancanti contano lo stesso)" : ""}.</p>`;
    }
    $("#unitOut").innerHTML = `${fmtNum(v)} ${escapeHtml(from)} = ${fmtNum(res)} ${escapeHtml(to)}<small>${escapeHtml(how)}</small>`;
  }
};

/* ---------- formulario pronto ---------- */
const FORMULARIO = [
  ["Geometria piana", [
    ["Quadrato", "A = l²   P = 4 · l", "d = l · √2"],
    ["Rettangolo", "A = b · h   P = 2 · (b + h)", "d = √(b² + h²)"],
    ["Triangolo", "A = b · h / 2", "P = somma dei lati"],
    ["Parallelogramma", "A = b · h"],
    ["Rombo", "A = D · d / 2", "D e d sono le diagonali"],
    ["Trapezio", "A = (B + b) · h / 2", "B base maggiore, b base minore"],
    ["Cerchio", "C = 2 · π · r   A = π · r²", "π ≈ 3,14"],
    ["Teorema di Pitagora", "i² = c₁² + c₂²", "i = √(c₁² + c₂²); vale solo nei triangoli rettangoli"]
  ]],
  ["Geometria solida", [
    ["Cubo", "V = l³   Sₜ = 6 · l²"],
    ["Parallelepipedo", "V = a · b · c", "Sₜ = 2 · (ab + bc + ac)"],
    ["Prisma", "V = A_base · h", "Sₗ = P_base · h"],
    ["Piramide", "V = A_base · h / 3"],
    ["Cilindro", "V = π · r² · h", "Sₗ = 2 · π · r · h"],
    ["Cono", "V = π · r² · h / 3", "Sₗ = π · r · a (a = apotema)"],
    ["Sfera", "V = 4/3 · π · r³   S = 4 · π · r²"]
  ]],
  ["Potenze", [
    ["Prodotto, stessa base", "aᵐ · aⁿ = aᵐ⁺ⁿ"],
    ["Quoziente, stessa base", "aᵐ : aⁿ = aᵐ⁻ⁿ"],
    ["Potenza di potenza", "(aᵐ)ⁿ = aᵐ·ⁿ"],
    ["Stesso esponente", "aⁿ · bⁿ = (a · b)ⁿ"],
    ["Esponente zero", "a⁰ = 1", "con a ≠ 0"],
    ["Esponente negativo", "a⁻ⁿ = 1 / aⁿ"],
    ["Esponente frazionario", "a^(m/n) = ⁿ√(aᵐ)"]
  ]],
  ["Prodotti notevoli", [
    ["Quadrato di binomio", "(a + b)² = a² + 2ab + b²"],
    ["", "(a − b)² = a² − 2ab + b²"],
    ["Somma per differenza", "(a + b)(a − b) = a² − b²"],
    ["Cubo di binomio", "(a + b)³ = a³ + 3a²b + 3ab² + b³"],
    ["Quadrato di trinomio", "(a + b + c)² = a² + b² + c² + 2ab + 2ac + 2bc"]
  ]],
  ["Equazioni", [
    ["1° grado", "ax + b = 0  →  x = −b / a", "se a ≠ 0"],
    ["2° grado", "ax² + bx + c = 0", "Δ = b² − 4ac"],
    ["Formula risolutiva", "x = (−b ± √Δ) / 2a", "Δ > 0 due soluzioni · Δ = 0 una · Δ < 0 nessuna reale"],
    ["Somma e prodotto", "x₁ + x₂ = −b/a   x₁ · x₂ = c/a"]
  ]],
  ["Percentuali e proporzioni", [
    ["Percentuale", "p% di N = N · p / 100"],
    ["Che percentuale è", "p = parte / tutto · 100"],
    ["Sconto", "prezzo finale = prezzo · (100 − p) / 100"],
    ["Aumento", "prezzo finale = prezzo · (100 + p) / 100"],
    ["Proporzione", "a : b = c : d  →  a · d = b · c", "il prodotto dei medi è uguale al prodotto degli estremi"],
    ["Termine incognito", "x = b · c / d"]
  ]],
  ["Piano cartesiano", [
    ["Retta", "y = m x + q", "m pendenza, q ordinata all'origine"],
    ["Pendenza", "m = (y₂ − y₁) / (x₂ − x₁)"],
    ["Distanza tra due punti", "d = √((x₂ − x₁)² + (y₂ − y₁)²)"],
    ["Punto medio", "M = ((x₁ + x₂)/2 ; (y₁ + y₂)/2)"],
    ["Rette parallele", "m₁ = m₂"],
    ["Rette perpendicolari", "m₁ · m₂ = −1"],
    ["Parabola", "y = ax² + bx + c", "vertice: x = −b / 2a"]
  ]],
  ["Goniometria", [
    ["Relazione fondamentale", "sin²α + cos²α = 1"],
    ["Tangente", "tan α = sin α / cos α"],
    ["30°", "sin = 1/2   cos = √3/2   tan = √3/3"],
    ["45°", "sin = √2/2   cos = √2/2   tan = 1"],
    ["60°", "sin = √3/2   cos = 1/2   tan = √3"],
    ["Gradi e radianti", "rad = gradi · π / 180"]
  ]],
  ["Logaritmi", [
    ["Definizione", "logₐ b = c  ↔  aᶜ = b"],
    ["Prodotto", "logₐ(b · c) = logₐ b + logₐ c"],
    ["Quoziente", "logₐ(b / c) = logₐ b − logₐ c"],
    ["Potenza", "logₐ bⁿ = n · logₐ b"],
    ["Cambio di base", "logₐ b = log b / log a"]
  ]],
  ["Fisica di base", [
    ["Velocità", "v = s / t", "m/s; km/h = m/s · 3,6"],
    ["Accelerazione", "a = Δv / Δt", "m/s²"],
    ["Moto uniformemente accelerato", "s = v₀ · t + ½ · a · t²"],
    ["Secondo principio", "F = m · a", "newton (N)"],
    ["Peso", "P = m · g", "g ≈ 9,81 m/s²"],
    ["Densità", "d = m / V"],
    ["Pressione", "p = F / S", "pascal (Pa)"],
    ["Lavoro", "L = F · s", "joule (J)"],
    ["Energia cinetica", "Ec = ½ · m · v²"],
    ["Energia potenziale", "Ep = m · g · h"],
    ["Potenza", "P = L / t", "watt (W)"],
    ["Legge di Ohm", "V = R · I"]
  ]]
];
const formule = {
  html(open) {
    return FORMULARIO.map(([title, items], i) => `
      <details${open || i === 0 ? " open" : ""}><summary>${escapeHtml(title)}</summary>
        ${items.map(([n, f, note]) => `<div class="f-item"><div class="f-name">${escapeHtml(n)}</div><div class="f-eq">${escapeHtml(f)}</div>${note ? `<div class="f-note">${escapeHtml(note)}</div>` : ""}</div>`).join("")}
      </details>`).join("");
  },
  init() {
    $("#formulario").innerHTML = this.html(false);
    $("#btnFormPrint").addEventListener("click", () => {
      // stampo le sezioni aperte (o tutte, se nessuna è aperta)
      const open = $$("#formulario details[open]");
      const chosen = open.length ? open.map(d => d.querySelector("summary").textContent) : FORMULARIO.map(x => x[0]);
      const html = FORMULARIO.filter(([t]) => chosen.includes(t)).map(([t, items]) => `<h3>${escapeHtml(t)}</h3>` +
        items.map(([n, f, note]) => `<div class="f-item"><div class="f-name">${escapeHtml(n)}</div><div class="f-eq">${escapeHtml(f)}</div>${note ? `<div class="f-note">${escapeHtml(note)}</div>` : ""}</div>`).join("")).join("");
      printer.run(`<div class="print-form">${html}</div>`, { title: "Formulario" });
    });
  }
};

/* ---------- tavola pitagorica ---------- */
const NUM_IT = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];
const pyth = {
  init() {
    let h = `<button class="h" aria-hidden="true">×</button>`;
    for (let c = 1; c <= 10; c++) h += `<button class="h" aria-hidden="true">${c}</button>`;
    for (let r = 1; r <= 10; r++) {
      h += `<button class="h" aria-hidden="true">${r}</button>`;
      for (let c = 1; c <= 10; c++) h += `<button data-r="${r}" data-c="${c}" aria-label="${r} per ${c}">${r * c}</button>`;
    }
    $("#pyth").innerHTML = h;
    $("#pyth").addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]"); if (!b) return;
      const r = +b.dataset.r, c = +b.dataset.c;
      $$("#pyth [data-r]").forEach(x => {
        const xr = +x.dataset.r, xc = +x.dataset.c;
        x.classList.toggle("hit", xr === r && xc === c);
        x.classList.toggle("line", (xr === r && xc < c) || (xc === c && xr < r));
      });
      tts.say(`${NUM_IT[r]} per ${NUM_IT[c]}, fa ${r * c}`, null, "it");
    });
  }
};

/* =========================================================
   STATISTICA: media, mediana, moda, campo, varianza, scarto, con i passaggi
   ========================================================= */
const stat = {
  init() {
    $("#btnStat").addEventListener("click", () => this.run());
    $("#statData").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.run(); } });
    $("#btnStatEx").addEventListener("click", () => { $("#statData").value = "6 7,5 8 6 5,5 9 7 6"; this.run(); });
    $("#btnStatClear").addEventListener("click", () => { $("#statData").value = ""; $("#statOut").innerHTML = ""; });
    $("#statOut").addEventListener("click", (e) => { const b = e.target.closest("[data-say]"); if (b) tts.say(b.dataset.say, null, "it"); });
  },
  parse(t) {
    // "7,5" è un numero decimale; i dati si separano con spazi, ";" oppure ", " (virgola seguita da spazio)
    return t.replace(/;/g, " ").replace(/,(\s)/g, " ").split(/\s+/).filter(Boolean)
      .map(x => Number(x.replace(",", "."))).filter(x => Number.isFinite(x));
  },
  run() {
    const xs = this.parse($("#statData").value);
    const out = $("#statOut");
    if (xs.length < 2) { out.innerHTML = `<div class="card"><p class="hint">Servono almeno due numeri.</p></div>`; return; }
    const f = (v) => fmtNum(Math.round(v * 1e4) / 1e4, 6);
    const n = xs.length, sum = xs.reduce((a, b) => a + b, 0), mean = sum / n;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const freq = new Map(); sorted.forEach(x => freq.set(x, (freq.get(x) || 0) + 1));
    const maxF = Math.max(...freq.values());
    const modes = maxF > 1 ? [...freq].filter(([, c]) => c === maxF).map(([v]) => v) : [];
    const min = sorted[0], max = sorted[n - 1];
    const dev = xs.map(x => (x - mean) ** 2), varp = dev.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(varp);
    const show = (arr) => arr.length > 14 ? arr.slice(0, 12).map(f).join(" + ") + " + …" : arr.map(f).join(" + ");
    const sortedTxt = sorted.map((x, i) => {
      const hit = n % 2 ? i === mid : (i === mid - 1 || i === mid);
      return hit ? `<mark>${f(x)}</mark>` : f(x);
    }).join(" · ");
    const row = (name, val, how, say) => `<div class="st-row"><div class="st-k">${name}</div><div class="st-v">${val}</div>
      <button class="icon-btn" data-say="${escapeHtml(say)}" aria-label="Ascolta">${icon("volume")}</button><div class="st-how">${how}</div></div>`;
    // grafico: frequenza di ogni valore
    const bars = [...freq];
    const W = 100 / bars.length;
    // posizione della media fra le colonne (le colonne sono in ordine, non in scala)
    let meanPos = 50;
    for (let i = 0; i < bars.length; i++) {
      const v = bars[i][0], nx = bars[i + 1]?.[0];
      if (mean === v || nx === undefined) { meanPos = (i + .5) * W; break; }
      if (mean > v && mean < nx) { meanPos = (i + .5 + (mean - v) / (nx - v)) * W; break; }
    }
    const chart = `<div class="st-chart" role="img" aria-label="Grafico delle frequenze">${bars.map(([v, c]) => `
      <div class="st-col" style="width:${W}%"><span class="st-c">${c}</span><div class="st-bar${modes.includes(v) ? " mode" : ""}" style="height:${c / maxF * 100}%"></div><span class="st-x">${f(v)}</span></div>`).join("")}
      <div class="st-mean" style="left:${meanPos}%"><span>media ${f(mean)}</span></div></div>`;
    out.innerHTML = `<div class="card">
      <h2>Risultati <small class="hint">(${n} dati)</small></h2>
      <div class="st-grid">
        ${row("Media", f(mean), `Somma tutti i dati e dividi per quanti sono:<br>(${show(xs)}) ÷ ${n} = ${f(sum)} ÷ ${n} = <b>${f(mean)}</b>`, `La media è ${f(mean)}`)}
        ${row("Mediana", f(median), `Metti i dati in ordine e prendi quello ${n % 2 ? "centrale" : "a metà fra i due centrali"}:<br>${sortedTxt}${n % 2 ? "" : `<br>(${f(sorted[mid - 1])} + ${f(sorted[mid])}) ÷ 2 = <b>${f(median)}</b>`}`, `La mediana è ${f(median)}`)}
        ${row("Moda", modes.length ? modes.map(f).join(" e ") : "nessuna", modes.length ? `Il valore che compare più volte (${maxF} volte).` : "Ogni valore compare una volta sola: non c'è una moda.", modes.length ? `La moda è ${modes.map(f).join(" e ")}` : "Non c'è moda")}
        ${row("Campo di variazione", f(max - min), `Il più grande meno il più piccolo: ${f(max)} − ${f(min)} = <b>${f(max - min)}</b>`, `Il campo di variazione è ${f(max - min)}`)}
        ${row("Varianza", f(varp), `Per ogni dato: (dato − media)², poi fai la media di questi quadrati:<br>(${show(dev)}) ÷ ${n} = <b>${f(varp)}</b>`, `La varianza è ${f(varp)}`)}
        ${row("Scarto quadratico medio", f(sd), `È la radice quadrata della varianza: √${f(varp)} = <b>${f(sd)}</b>. Dice quanto i dati sono lontani, in media, dalla media.`, `Lo scarto quadratico medio è ${f(sd)}`)}
      </div>
    </div>
    <div class="card"><h2>Frequenze</h2><p class="hint">Quante volte compare ogni valore. La barra più scura è la moda.</p>${chart}</div>`;
  }
};
