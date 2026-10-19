/* Zaino — Fisica.
   Formule interattive (con formule inverse e conversioni), problemi guidati,
   simulazioni (moto e vettori), unità, prefissi e notazione scientifica.
   Usa le funzioni di app.js e mate.js: parte con fisica.init(). */
"use strict";

/* =========================================================
   1. GRANDEZZE E UNITÀ
   Ogni tipo di grandezza ha le sue unità: [simbolo, fattore per arrivare all'unità SI]
   ========================================================= */
const QTY = {
  len: [["m", 1], ["km", 1000], ["cm", 0.01], ["mm", 0.001]],
  time: [["s", 1], ["min", 60], ["h", 3600]],
  speed: [["m/s", 1], ["km/h", 1 / 3.6]],
  acc: [["m/s²", 1]],
  mass: [["kg", 1], ["g", 0.001], ["t", 1000]],
  force: [["N", 1], ["kN", 1000]],
  energy: [["J", 1], ["kJ", 1000], ["cal", 4.186], ["kcal", 4186], ["kWh", 3.6e6]],
  power: [["W", 1], ["kW", 1000], ["CV", 735.5]],
  pressure: [["Pa", 1], ["hPa", 100], ["kPa", 1000], ["bar", 1e5], ["atm", 101325]],
  density: [["kg/m³", 1], ["g/cm³", 1000]],
  volume: [["m³", 1], ["L", 1e-3], ["dm³", 1e-3], ["cm³", 1e-6]],
  area: [["m²", 1], ["cm²", 1e-4], ["mm²", 1e-6]],
  dtemp: [["K", 1], ["°C", 1]],
  tempK: [["K", 1]],
  tempC: [["°C", 1]],
  freq: [["Hz", 1], ["kHz", 1000]],
  period: [["s", 1], ["min", 60]],
  angle: [["°", 1]],
  charge: [["C", 1], ["mC", 1e-3], ["μC", 1e-6], ["nC", 1e-9]],
  current: [["A", 1], ["mA", 1e-3]],
  volt: [["V", 1], ["kV", 1000], ["mV", 1e-3]],
  ohm: [["Ω", 1], ["kΩ", 1000]],
  spring: [["N/m", 1]],
  none: [["(numero puro)", 1]],
  cspec: [["J/(kg·K)", 1]],
  lambdaT: [["1/K", 1]],
  resistiv: [["Ω·m", 1]],
  mom: [["kg·m/s", 1]],
  imp: [["N·s", 1]],
  mol: [["mol", 1]],
  capac: [["F", 1], ["μF", 1e-6], ["nF", 1e-9], ["pF", 1e-12]],
  efield: [["N/C", 1], ["kN/C", 1000]],
  intensity: [["W/m²", 1]],
  entropy: [["J/K", 1]],
  db: [["dB", 1]],
  bfield: [["T", 1], ["mT", 1e-3], ["μT", 1e-6]]
};
const CONSTS = {
  g: [9.81, "m/s²", "accelerazione di gravità"],
  G: [6.674e-11, "N·m²/kg²", "costante di gravitazione universale"],
  R: [8.314, "J/(mol·K)", "costante dei gas"],
  "kₑ": [8.99e9, "N·m²/C²", "costante di Coulomb"],
  c: [3e8, "m/s", "velocità della luce nel vuoto"],
  "ε₀": [8.854e-12, "C²/(N·m²)", "costante dielettrica del vuoto"],
  "μ₀": [4 * Math.PI * 1e-7, "T·m/A", "permeabilità magnetica del vuoto"],
  "I₀": [1e-12, "W/m²", "soglia di udibilità"]
};
const { g: [G_ACC], G: [G_UNIV], R: [R_GAS] } = CONSTS;
const K_E = CONSTS["kₑ"][0], C_LUCE = CONSTS.c[0], EPS0 = CONSTS["ε₀"][0], MU0 = CONSTS["μ₀"][0], I0 = CONSTS["I₀"][0];
const RAD = Math.PI / 180;

/* =========================================================
   2. FORMULE
   show: la formula con {simboli}; vars: simbolo → [etichetta, nome, tipo];
   solve: per ogni incognita → [formula inversa con {simboli}, funzione sui valori SI]
   ========================================================= */
const PHYS_TOPICS = ["Moto", "Forze", "Energia", "Fluidi", "Calore", "Termodinamica", "Oscillazioni e onde", "Ottica", "Elettrostatica", "Circuiti", "Magnetismo"];
const PHYS = [
  // ---------- MOTO ----------
  { t: "Moto", name: "Velocità media", show: "{v} = {s} / {t}",
    vars: { v: ["v", "velocità", "speed"], s: ["s", "spazio percorso", "len"], t: ["t", "tempo", "time"] },
    solve: { v: ["{s} / {t}", x => x.s / x.t], s: ["{v} · {t}", x => x.v * x.t], t: ["{s} / {v}", x => x.s / x.v] } },
  { t: "Moto", name: "Accelerazione", show: "{a} = ({v} − {v0}) / {t}",
    vars: { a: ["a", "accelerazione", "acc"], v: ["v", "velocità finale", "speed"], v0: ["v₀", "velocità iniziale", "speed"], t: ["t", "tempo", "time"] },
    solve: { a: ["({v} − {v0}) / {t}", x => (x.v - x.v0) / x.t], v: ["{v0} + {a} · {t}", x => x.v0 + x.a * x.t],
      v0: ["{v} − {a} · {t}", x => x.v - x.a * x.t], t: ["({v} − {v0}) / {a}", x => (x.v - x.v0) / x.a] } },
  { t: "Moto", name: "Legge oraria del moto accelerato", show: "{s} = {v0} · {t} + ½ · {a} · {t}²",
    vars: { s: ["s", "spazio percorso", "len"], v0: ["v₀", "velocità iniziale", "speed"], a: ["a", "accelerazione", "acc"], t: ["t", "tempo", "time"] },
    solve: { s: ["{v0} · {t} + ½ · {a} · {t}²", x => x.v0 * x.t + 0.5 * x.a * x.t ** 2],
      v0: ["({s} − ½ · {a} · {t}²) / {t}", x => (x.s - 0.5 * x.a * x.t ** 2) / x.t],
      a: ["2 · ({s} − {v0} · {t}) / {t}²", x => 2 * (x.s - x.v0 * x.t) / x.t ** 2],
      t: ["(−{v0} + √({v0}² + 2 · {a} · {s})) / {a}", x => x.a === 0 ? x.s / x.v0 : (-x.v0 + Math.sqrt(x.v0 ** 2 + 2 * x.a * x.s)) / x.a] } },
  { t: "Moto", name: "Velocità senza il tempo", show: "{v}² = {v0}² + 2 · {a} · {s}",
    vars: { v: ["v", "velocità finale", "speed"], v0: ["v₀", "velocità iniziale", "speed"], a: ["a", "accelerazione", "acc"], s: ["s", "spazio percorso", "len"] },
    solve: { v: ["√({v0}² + 2 · {a} · {s})", x => Math.sqrt(x.v0 ** 2 + 2 * x.a * x.s)], v0: ["√({v}² − 2 · {a} · {s})", x => Math.sqrt(x.v ** 2 - 2 * x.a * x.s)],
      a: ["({v}² − {v0}²) / (2 · {s})", x => (x.v ** 2 - x.v0 ** 2) / (2 * x.s)], s: ["({v}² − {v0}²) / (2 · {a})", x => (x.v ** 2 - x.v0 ** 2) / (2 * x.a)] } },
  { t: "Moto", name: "Caduta libera: altezza", show: "{h} = ½ · g · {t}²",
    vars: { h: ["h", "altezza di caduta", "len"], t: ["t", "tempo di caduta", "time"] },
    solve: { h: ["½ · g · {t}²", x => 0.5 * G_ACC * x.t ** 2], t: ["√(2 · {h} / g)", x => Math.sqrt(2 * x.h / G_ACC)] }, consts: ["g"] },
  { t: "Moto", name: "Caduta libera: velocità", show: "{v} = g · {t}",
    vars: { v: ["v", "velocità", "speed"], t: ["t", "tempo di caduta", "time"] },
    solve: { v: ["g · {t}", x => G_ACC * x.t], t: ["{v} / g", x => x.v / G_ACC] }, consts: ["g"] },
  { t: "Moto", name: "Moto circolare uniforme", show: "{v} = 2 · π · {r} / {T}",
    vars: { v: ["v", "velocità", "speed"], r: ["r", "raggio", "len"], T: ["T", "periodo (tempo di un giro)", "period"] },
    solve: { v: ["2 · π · {r} / {T}", x => 2 * Math.PI * x.r / x.T], r: ["{v} · {T} / (2 · π)", x => x.v * x.T / (2 * Math.PI)], T: ["2 · π · {r} / {v}", x => 2 * Math.PI * x.r / x.v] } },
  { t: "Moto", name: "Accelerazione centripeta", show: "{a} = {v}² / {r}",
    vars: { a: ["a", "accelerazione centripeta", "acc"], v: ["v", "velocità", "speed"], r: ["r", "raggio", "len"] },
    solve: { a: ["{v}² / {r}", x => x.v ** 2 / x.r], v: ["√({a} · {r})", x => Math.sqrt(x.a * x.r)], r: ["{v}² / {a}", x => x.v ** 2 / x.a] } },
  // ---------- FORZE ----------
  { t: "Forze", name: "Secondo principio della dinamica", show: "{F} = {m} · {a}",
    vars: { F: ["F", "forza", "force"], m: ["m", "massa", "mass"], a: ["a", "accelerazione", "acc"] },
    solve: { F: ["{m} · {a}", x => x.m * x.a], m: ["{F} / {a}", x => x.F / x.a], a: ["{F} / {m}", x => x.F / x.m] } },
  { t: "Forze", name: "Forza peso", show: "{P} = {m} · g",
    vars: { P: ["P", "peso", "force"], m: ["m", "massa", "mass"] },
    solve: { P: ["{m} · g", x => x.m * G_ACC], m: ["{P} / g", x => x.P / G_ACC] }, consts: ["g"] },
  { t: "Forze", name: "Legge di Hooke (molla)", show: "{F} = {k} · {x}",
    vars: { F: ["F", "forza elastica", "force"], k: ["k", "costante elastica", "spring"], x: ["Δx", "allungamento", "len"] },
    solve: { F: ["{k} · {x}", x => x.k * x.x], k: ["{F} / {x}", x => x.F / x.x], x: ["{F} / {k}", x => x.F / x.k] } },
  { t: "Forze", name: "Forza di attrito", show: "{Fa} = {mu} · {Fn}",
    vars: { Fa: ["Fₐ", "forza di attrito", "force"], mu: ["μ", "coefficiente di attrito", "none"], Fn: ["F⊥", "forza premente", "force"] },
    solve: { Fa: ["{mu} · {Fn}", x => x.mu * x.Fn], mu: ["{Fa} / {Fn}", x => x.Fa / x.Fn], Fn: ["{Fa} / {mu}", x => x.Fa / x.mu] } },
  { t: "Forze", name: "Gravitazione universale", show: "{F} = G · {m1} · {m2} / {d}²",
    vars: { F: ["F", "forza di gravità", "force"], m1: ["m₁", "prima massa", "mass"], m2: ["m₂", "seconda massa", "mass"], d: ["d", "distanza", "len"] },
    solve: { F: ["G · {m1} · {m2} / {d}²", x => G_UNIV * x.m1 * x.m2 / x.d ** 2], m1: ["{F} · {d}² / (G · {m2})", x => x.F * x.d ** 2 / (G_UNIV * x.m2)],
      m2: ["{F} · {d}² / (G · {m1})", x => x.F * x.d ** 2 / (G_UNIV * x.m1)], d: ["√(G · {m1} · {m2} / {F})", x => Math.sqrt(G_UNIV * x.m1 * x.m2 / x.F)] }, consts: ["G"] },
  { t: "Forze", name: "Quantità di moto", show: "{p} = {m} · {v}",
    vars: { p: ["p", "quantità di moto", "mom"], m: ["m", "massa", "mass"], v: ["v", "velocità", "speed"] },
    solve: { p: ["{m} · {v}", x => x.m * x.v], m: ["{p} / {v}", x => x.p / x.v], v: ["{p} / {m}", x => x.p / x.m] } },
  { t: "Forze", name: "Impulso", show: "{I} = {F} · {t}",
    vars: { I: ["I", "impulso", "imp"], F: ["F", "forza", "force"], t: ["Δt", "durata", "time"] },
    solve: { I: ["{F} · {t}", x => x.F * x.t], F: ["{I} / {t}", x => x.I / x.t], t: ["{I} / {F}", x => x.I / x.F] } },
  // ---------- ENERGIA ----------
  { t: "Energia", name: "Lavoro", show: "{L} = {F} · {s} · cos {al}",
    vars: { L: ["L", "lavoro", "energy"], F: ["F", "forza", "force"], s: ["s", "spostamento", "len"], al: ["α", "angolo tra forza e spostamento", "angle"] },
    solve: { L: ["{F} · {s} · cos {al}", x => x.F * x.s * Math.cos(x.al * RAD)], F: ["{L} / ({s} · cos {al})", x => x.L / (x.s * Math.cos(x.al * RAD))],
      s: ["{L} / ({F} · cos {al})", x => x.L / (x.F * Math.cos(x.al * RAD))], al: ["arccos({L} / ({F} · {s}))", x => Math.acos(x.L / (x.F * x.s)) / RAD] } },
  { t: "Energia", name: "Energia cinetica", show: "{Ec} = ½ · {m} · {v}²",
    vars: { Ec: ["Ec", "energia cinetica", "energy"], m: ["m", "massa", "mass"], v: ["v", "velocità", "speed"] },
    solve: { Ec: ["½ · {m} · {v}²", x => 0.5 * x.m * x.v ** 2], m: ["2 · {Ec} / {v}²", x => 2 * x.Ec / x.v ** 2], v: ["√(2 · {Ec} / {m})", x => Math.sqrt(2 * x.Ec / x.m)] } },
  { t: "Energia", name: "Energia potenziale gravitazionale", show: "{Ep} = {m} · g · {h}",
    vars: { Ep: ["Ep", "energia potenziale", "energy"], m: ["m", "massa", "mass"], h: ["h", "altezza", "len"] },
    solve: { Ep: ["{m} · g · {h}", x => x.m * G_ACC * x.h], m: ["{Ep} / (g · {h})", x => x.Ep / (G_ACC * x.h)], h: ["{Ep} / ({m} · g)", x => x.Ep / (x.m * G_ACC)] }, consts: ["g"] },
  { t: "Energia", name: "Energia potenziale elastica", show: "{Ee} = ½ · {k} · {x}²",
    vars: { Ee: ["Eₑ", "energia elastica", "energy"], k: ["k", "costante elastica", "spring"], x: ["Δx", "allungamento", "len"] },
    solve: { Ee: ["½ · {k} · {x}²", x => 0.5 * x.k * x.x ** 2], k: ["2 · {Ee} / {x}²", x => 2 * x.Ee / x.x ** 2], x: ["√(2 · {Ee} / {k})", x => Math.sqrt(2 * x.Ee / x.k)] } },
  { t: "Energia", name: "Potenza", show: "{P} = {L} / {t}",
    vars: { P: ["P", "potenza", "power"], L: ["L", "lavoro (o energia)", "energy"], t: ["t", "tempo", "time"] },
    solve: { P: ["{L} / {t}", x => x.L / x.t], L: ["{P} · {t}", x => x.P * x.t], t: ["{L} / {P}", x => x.L / x.P] } },
  // ---------- FLUIDI ----------
  { t: "Fluidi", name: "Densità", show: "{d} = {m} / {V}",
    vars: { d: ["d", "densità", "density"], m: ["m", "massa", "mass"], V: ["V", "volume", "volume"] },
    solve: { d: ["{m} / {V}", x => x.m / x.V], m: ["{d} · {V}", x => x.d * x.V], V: ["{m} / {d}", x => x.m / x.d] } },
  { t: "Fluidi", name: "Pressione", show: "{p} = {F} / {S}",
    vars: { p: ["p", "pressione", "pressure"], F: ["F", "forza", "force"], S: ["S", "superficie", "area"] },
    solve: { p: ["{F} / {S}", x => x.F / x.S], F: ["{p} · {S}", x => x.p * x.S], S: ["{F} / {p}", x => x.F / x.p] } },
  { t: "Fluidi", name: "Legge di Stevino", show: "{p} = {d} · g · {h}",
    vars: { p: ["p", "pressione del liquido", "pressure"], d: ["d", "densità del liquido", "density"], h: ["h", "profondità", "len"] },
    solve: { p: ["{d} · g · {h}", x => x.d * G_ACC * x.h], d: ["{p} / (g · {h})", x => x.p / (G_ACC * x.h)], h: ["{p} / ({d} · g)", x => x.p / (x.d * G_ACC)] }, consts: ["g"] },
  { t: "Fluidi", name: "Spinta di Archimede", show: "{Sa} = {d} · g · {V}",
    vars: { Sa: ["Sₐ", "spinta di Archimede", "force"], d: ["d", "densità del fluido", "density"], V: ["V", "volume immerso", "volume"] },
    solve: { Sa: ["{d} · g · {V}", x => x.d * G_ACC * x.V], d: ["{Sa} / (g · {V})", x => x.Sa / (G_ACC * x.V)], V: ["{Sa} / ({d} · g)", x => x.Sa / (x.d * G_ACC)] }, consts: ["g"] },
  // ---------- CALORE ----------
  { t: "Calore", name: "Calore e temperatura", show: "{Q} = {m} · {c} · {dT}",
    vars: { Q: ["Q", "calore", "energy"], m: ["m", "massa", "mass"], c: ["c", "calore specifico", "cspec"], dT: ["ΔT", "variazione di temperatura", "dtemp"] },
    solve: { Q: ["{m} · {c} · {dT}", x => x.m * x.c * x.dT], m: ["{Q} / ({c} · {dT})", x => x.Q / (x.c * x.dT)],
      c: ["{Q} / ({m} · {dT})", x => x.Q / (x.m * x.dT)], dT: ["{Q} / ({m} · {c})", x => x.Q / (x.m * x.c)] } },
  { t: "Calore", name: "Dilatazione lineare", show: "{dL} = {lam} · {L0} · {dT}",
    vars: { dL: ["ΔL", "allungamento", "len"], lam: ["λ", "coefficiente di dilatazione", "lambdaT"], L0: ["L₀", "lunghezza iniziale", "len"], dT: ["ΔT", "variazione di temperatura", "dtemp"] },
    solve: { dL: ["{lam} · {L0} · {dT}", x => x.lam * x.L0 * x.dT], lam: ["{dL} / ({L0} · {dT})", x => x.dL / (x.L0 * x.dT)],
      L0: ["{dL} / ({lam} · {dT})", x => x.dL / (x.lam * x.dT)], dT: ["{dL} / ({lam} · {L0})", x => x.dL / (x.lam * x.L0)] } },
  { t: "Calore", name: "Da gradi Celsius a kelvin", show: "{T} = {tc} + 273,15",
    vars: { T: ["T", "temperatura assoluta", "tempK"], tc: ["t", "temperatura in gradi Celsius", "tempC"] },
    solve: { T: ["{tc} + 273,15", x => x.tc + 273.15], tc: ["{T} − 273,15", x => x.T - 273.15] } },
  { t: "Calore", name: "Gas perfetti", show: "{p} · {V} = {n} · R · {T}",
    vars: { p: ["p", "pressione", "pressure"], V: ["V", "volume", "volume"], n: ["n", "numero di moli", "mol"], T: ["T", "temperatura (in kelvin)", "tempK"] },
    solve: { p: ["{n} · R · {T} / {V}", x => x.n * R_GAS * x.T / x.V], V: ["{n} · R · {T} / {p}", x => x.n * R_GAS * x.T / x.p],
      n: ["{p} · {V} / (R · {T})", x => x.p * x.V / (R_GAS * x.T)], T: ["{p} · {V} / ({n} · R)", x => x.p * x.V / (x.n * R_GAS)] }, consts: ["R"] },
  // ---------- ONDE ----------
  { t: "Oscillazioni e onde", name: "Velocità di un'onda", show: "{v} = {wl} · {f}",
    vars: { v: ["v", "velocità dell'onda", "speed"], wl: ["λ", "lunghezza d'onda", "len"], f: ["f", "frequenza", "freq"] },
    solve: { v: ["{wl} · {f}", x => x.wl * x.f], wl: ["{v} / {f}", x => x.v / x.f], f: ["{v} / {wl}", x => x.v / x.wl] } },
  { t: "Oscillazioni e onde", name: "Frequenza e periodo", show: "{f} = 1 / {T}",
    vars: { f: ["f", "frequenza", "freq"], T: ["T", "periodo", "period"] },
    solve: { f: ["1 / {T}", x => 1 / x.T], T: ["1 / {f}", x => 1 / x.f] } },
  // ---------- ELETTRICITÀ ----------
  { t: "Circuiti", name: "Prima legge di Ohm", show: "{V} = {R} · {I}",
    vars: { V: ["V", "tensione", "volt"], R: ["R", "resistenza", "ohm"], I: ["I", "intensità di corrente", "current"] },
    solve: { V: ["{R} · {I}", x => x.R * x.I], R: ["{V} / {I}", x => x.V / x.I], I: ["{V} / {R}", x => x.V / x.R] } },
  { t: "Circuiti", name: "Potenza elettrica", show: "{P} = {V} · {I}",
    vars: { P: ["P", "potenza", "power"], V: ["V", "tensione", "volt"], I: ["I", "intensità di corrente", "current"] },
    solve: { P: ["{V} · {I}", x => x.V * x.I], V: ["{P} / {I}", x => x.P / x.I], I: ["{P} / {V}", x => x.P / x.V] } },
  { t: "Circuiti", name: "Carica e corrente", show: "{q} = {I} · {t}",
    vars: { q: ["q", "carica elettrica", "charge"], I: ["I", "intensità di corrente", "current"], t: ["t", "tempo", "time"] },
    solve: { q: ["{I} · {t}", x => x.I * x.t], I: ["{q} / {t}", x => x.q / x.t], t: ["{q} / {I}", x => x.q / x.I] } },
  { t: "Elettrostatica", name: "Legge di Coulomb", show: "{F} = kₑ · {q1} · {q2} / {d}²",
    vars: { F: ["F", "forza elettrica", "force"], q1: ["q₁", "prima carica", "charge"], q2: ["q₂", "seconda carica", "charge"], d: ["d", "distanza", "len"] },
    solve: { F: ["kₑ · {q1} · {q2} / {d}²", x => K_E * x.q1 * x.q2 / x.d ** 2], q1: ["{F} · {d}² / (kₑ · {q2})", x => x.F * x.d ** 2 / (K_E * x.q2)],
      q2: ["{F} · {d}² / (kₑ · {q1})", x => x.F * x.d ** 2 / (K_E * x.q1)], d: ["√(kₑ · {q1} · {q2} / {F})", x => Math.sqrt(K_E * x.q1 * x.q2 / x.F)] }, consts: ["kₑ"] },
  { t: "Circuiti", name: "Seconda legge di Ohm", show: "{R} = {rho} · {L} / {S}",
    vars: { R: ["R", "resistenza", "ohm"], rho: ["ρ", "resistività del materiale", "resistiv"], L: ["L", "lunghezza del filo", "len"], S: ["S", "sezione del filo", "area"] },
    solve: { R: ["{rho} · {L} / {S}", x => x.rho * x.L / x.S], rho: ["{R} · {S} / {L}", x => x.R * x.S / x.L],
      L: ["{R} · {S} / {rho}", x => x.R * x.S / x.rho], S: ["{rho} · {L} / {R}", x => x.rho * x.L / x.R] } },
  // ---------- TERMODINAMICA ----------
  { t: "Termodinamica", name: "Primo principio", show: "{dU} = {Q} − {L}",
    vars: { dU: ["ΔU", "variazione di energia interna", "energy"], Q: ["Q", "calore assorbito dal sistema", "energy"], L: ["L", "lavoro fatto dal sistema", "energy"] },
    solve: { dU: ["{Q} − {L}", x => x.Q - x.L], Q: ["{dU} + {L}", x => x.dU + x.L], L: ["{Q} − {dU}", x => x.Q - x.dU] } },
  { t: "Termodinamica", name: "Lavoro a pressione costante (isobara)", show: "{L} = {p} · {dV}",
    vars: { L: ["L", "lavoro", "energy"], p: ["p", "pressione", "pressure"], dV: ["ΔV", "variazione di volume", "volume"] },
    solve: { L: ["{p} · {dV}", x => x.p * x.dV], p: ["{L} / {dV}", x => x.L / x.dV], dV: ["{L} / {p}", x => x.L / x.p] } },
  { t: "Termodinamica", name: "Lavoro a temperatura costante (isoterma)", show: "{L} = {n} · R · {T} · ln({Vf} / {Vi})",
    vars: { L: ["L", "lavoro", "energy"], n: ["n", "numero di moli", "mol"], T: ["T", "temperatura (kelvin)", "tempK"], Vf: ["V_f", "volume finale", "volume"], Vi: ["V_i", "volume iniziale", "volume"] },
    solve: { L: ["{n} · R · {T} · ln({Vf} / {Vi})", x => x.n * R_GAS * x.T * Math.log(x.Vf / x.Vi)],
      n: ["{L} / (R · {T} · ln({Vf} / {Vi}))", x => x.L / (R_GAS * x.T * Math.log(x.Vf / x.Vi))],
      T: ["{L} / ({n} · R · ln({Vf} / {Vi}))", x => x.L / (x.n * R_GAS * Math.log(x.Vf / x.Vi))],
      Vf: ["{Vi} · e^({L} / ({n} · R · {T}))", x => x.Vi * Math.exp(x.L / (x.n * R_GAS * x.T))],
      Vi: ["{Vf} / e^({L} / ({n} · R · {T}))", x => x.Vf / Math.exp(x.L / (x.n * R_GAS * x.T))] }, consts: ["R"] },
  { t: "Termodinamica", name: "Energia interna di un gas monoatomico", show: "{dU} = 3/2 · {n} · R · {dT}",
    vars: { dU: ["ΔU", "variazione di energia interna", "energy"], n: ["n", "numero di moli", "mol"], dT: ["ΔT", "variazione di temperatura", "dtemp"] },
    solve: { dU: ["3/2 · {n} · R · {dT}", x => 1.5 * x.n * R_GAS * x.dT], n: ["2 · {dU} / (3 · R · {dT})", x => 2 * x.dU / (3 * R_GAS * x.dT)], dT: ["2 · {dU} / (3 · {n} · R)", x => 2 * x.dU / (3 * x.n * R_GAS)] }, consts: ["R"] },
  { t: "Termodinamica", name: "Trasformazione isoterma (Boyle)", show: "{p1} · {V1} = {p2} · {V2}",
    vars: { p1: ["p₁", "pressione iniziale", "pressure"], V1: ["V₁", "volume iniziale", "volume"], p2: ["p₂", "pressione finale", "pressure"], V2: ["V₂", "volume finale", "volume"] },
    solve: { p1: ["{p2} · {V2} / {V1}", x => x.p2 * x.V2 / x.V1], V1: ["{p2} · {V2} / {p1}", x => x.p2 * x.V2 / x.p1], p2: ["{p1} · {V1} / {V2}", x => x.p1 * x.V1 / x.V2], V2: ["{p1} · {V1} / {p2}", x => x.p1 * x.V1 / x.p2] } },
  { t: "Termodinamica", name: "Trasformazione isobara (Gay-Lussac)", show: "{V1} / {T1} = {V2} / {T2}",
    vars: { V1: ["V₁", "volume iniziale", "volume"], T1: ["T₁", "temperatura iniziale (kelvin)", "tempK"], V2: ["V₂", "volume finale", "volume"], T2: ["T₂", "temperatura finale (kelvin)", "tempK"] },
    solve: { V1: ["{V2} · {T1} / {T2}", x => x.V2 * x.T1 / x.T2], T1: ["{V1} · {T2} / {V2}", x => x.V1 * x.T2 / x.V2], V2: ["{V1} · {T2} / {T1}", x => x.V1 * x.T2 / x.T1], T2: ["{V2} · {T1} / {V1}", x => x.V2 * x.T1 / x.V1] } },
  { t: "Termodinamica", name: "Trasformazione isocora", show: "{p1} / {T1} = {p2} / {T2}",
    vars: { p1: ["p₁", "pressione iniziale", "pressure"], T1: ["T₁", "temperatura iniziale (kelvin)", "tempK"], p2: ["p₂", "pressione finale", "pressure"], T2: ["T₂", "temperatura finale (kelvin)", "tempK"] },
    solve: { p1: ["{p2} · {T1} / {T2}", x => x.p2 * x.T1 / x.T2], T1: ["{p1} · {T2} / {p2}", x => x.p1 * x.T2 / x.p2], p2: ["{p1} · {T2} / {T1}", x => x.p1 * x.T2 / x.T1], T2: ["{p2} · {T1} / {p1}", x => x.p2 * x.T1 / x.p1] } },
  { t: "Termodinamica", name: "Rendimento di una macchina termica", show: "{eta} = {L} / {Qa}",
    vars: { eta: ["η", "rendimento (es. 0,3 = 30%)", "none"], L: ["L", "lavoro prodotto", "energy"], Qa: ["Q_ass", "calore assorbito", "energy"] },
    solve: { eta: ["{L} / {Qa}", x => x.L / x.Qa], L: ["{eta} · {Qa}", x => x.eta * x.Qa], Qa: ["{L} / {eta}", x => x.L / x.eta] } },
  { t: "Termodinamica", name: "Rendimento con i calori", show: "{eta} = 1 − {Qc} / {Qa}",
    vars: { eta: ["η", "rendimento", "none"], Qc: ["Q_ced", "calore ceduto", "energy"], Qa: ["Q_ass", "calore assorbito", "energy"] },
    solve: { eta: ["1 − {Qc} / {Qa}", x => 1 - x.Qc / x.Qa], Qc: ["(1 − {eta}) · {Qa}", x => (1 - x.eta) * x.Qa], Qa: ["{Qc} / (1 − {eta})", x => x.Qc / (1 - x.eta)] } },
  { t: "Termodinamica", name: "Rendimento di Carnot", show: "{eta} = 1 − {Tf} / {Tc}",
    vars: { eta: ["η", "rendimento massimo", "none"], Tf: ["T_f", "temperatura fredda (kelvin)", "tempK"], Tc: ["T_c", "temperatura calda (kelvin)", "tempK"] },
    solve: { eta: ["1 − {Tf} / {Tc}", x => 1 - x.Tf / x.Tc], Tf: ["(1 − {eta}) · {Tc}", x => (1 - x.eta) * x.Tc], Tc: ["{Tf} / (1 − {eta})", x => x.Tf / (1 - x.eta)] } },
  { t: "Termodinamica", name: "Variazione di entropia (T costante)", show: "{dS} = {Q} / {T}",
    vars: { dS: ["ΔS", "variazione di entropia", "entropy"], Q: ["Q", "calore scambiato", "energy"], T: ["T", "temperatura (kelvin)", "tempK"] },
    solve: { dS: ["{Q} / {T}", x => x.Q / x.T], Q: ["{dS} · {T}", x => x.dS * x.T], T: ["{Q} / {dS}", x => x.Q / x.dS] } },
  // ---------- OSCILLAZIONI E ONDE ----------
  { t: "Oscillazioni e onde", name: "Periodo del pendolo", show: "{T} = 2 · π · √({l} / g)",
    vars: { T: ["T", "periodo", "period"], l: ["l", "lunghezza del filo", "len"] },
    solve: { T: ["2 · π · √({l} / g)", x => 2 * Math.PI * Math.sqrt(x.l / G_ACC)], l: ["g · ({T} / (2 · π))²", x => G_ACC * (x.T / (2 * Math.PI)) ** 2] }, consts: ["g"] },
  { t: "Oscillazioni e onde", name: "Periodo della molla", show: "{T} = 2 · π · √({m} / {k})",
    vars: { T: ["T", "periodo", "period"], m: ["m", "massa", "mass"], k: ["k", "costante elastica", "spring"] },
    solve: { T: ["2 · π · √({m} / {k})", x => 2 * Math.PI * Math.sqrt(x.m / x.k)], m: ["{k} · ({T} / (2 · π))²", x => x.k * (x.T / (2 * Math.PI)) ** 2], k: ["{m} · (2 · π / {T})²", x => x.m * (2 * Math.PI / x.T) ** 2] } },
  { t: "Oscillazioni e onde", name: "Intensità di un'onda sferica", show: "{I} = {P} / (4 · π · {r}²)",
    vars: { I: ["I", "intensità", "intensity"], P: ["P", "potenza della sorgente", "power"], r: ["r", "distanza dalla sorgente", "len"] },
    solve: { I: ["{P} / (4 · π · {r}²)", x => x.P / (4 * Math.PI * x.r ** 2)], P: ["{I} · 4 · π · {r}²", x => x.I * 4 * Math.PI * x.r ** 2], r: ["√({P} / (4 · π · {I}))", x => Math.sqrt(x.P / (4 * Math.PI * x.I))] } },
  { t: "Oscillazioni e onde", name: "Livello di intensità sonora", show: "{Ls} = 10 · log({I} / I₀)",
    vars: { Ls: ["L", "livello sonoro", "db"], I: ["I", "intensità del suono", "intensity"] },
    solve: { Ls: ["10 · log({I} / I₀)", x => 10 * Math.log10(x.I / I0)], I: ["I₀ · 10^({Ls} / 10)", x => I0 * Math.pow(10, x.Ls / 10)] }, consts: ["I₀"] },
  { t: "Oscillazioni e onde", name: "Effetto Doppler (sorgente che si avvicina)", show: "{fp} = {f} · {v} / ({v} − {vs})",
    vars: { fp: ["f'", "frequenza percepita", "freq"], f: ["f", "frequenza emessa", "freq"], v: ["v", "velocità del suono", "speed"], vs: ["v_s", "velocità della sorgente", "speed"] },
    solve: { fp: ["{f} · {v} / ({v} − {vs})", x => x.f * x.v / (x.v - x.vs)], f: ["{fp} · ({v} − {vs}) / {v}", x => x.fp * (x.v - x.vs) / x.v],
      v: ["{fp} · {vs} / ({fp} − {f})", x => x.fp * x.vs / (x.fp - x.f)], vs: ["{v} · (1 − {f} / {fp})", x => x.v * (1 - x.f / x.fp)] } },
  // ---------- OTTICA ----------
  { t: "Ottica", name: "Indice di rifrazione", show: "{n} = c / {v}",
    vars: { n: ["n", "indice di rifrazione", "none"], v: ["v", "velocità della luce nel mezzo", "speed"] },
    solve: { n: ["c / {v}", x => C_LUCE / x.v], v: ["c / {n}", x => C_LUCE / x.n] }, consts: ["c"] },
  { t: "Ottica", name: "Legge di Snell (rifrazione)", show: "{n1} · sin {a1} = {n2} · sin {a2}",
    vars: { n1: ["n₁", "indice del primo mezzo", "none"], a1: ["θ₁", "angolo di incidenza", "angle"], n2: ["n₂", "indice del secondo mezzo", "none"], a2: ["θ₂", "angolo di rifrazione", "angle"] },
    solve: { n1: ["{n2} · sin {a2} / sin {a1}", x => x.n2 * Math.sin(x.a2 * RAD) / Math.sin(x.a1 * RAD)], a1: ["arcsin({n2} · sin {a2} / {n1})", x => Math.asin(x.n2 * Math.sin(x.a2 * RAD) / x.n1) / RAD],
      n2: ["{n1} · sin {a1} / sin {a2}", x => x.n1 * Math.sin(x.a1 * RAD) / Math.sin(x.a2 * RAD)], a2: ["arcsin({n1} · sin {a1} / {n2})", x => Math.asin(x.n1 * Math.sin(x.a1 * RAD) / x.n2) / RAD] } },
  { t: "Ottica", name: "Lente sottile", show: "1 / {f} = 1 / {p} + 1 / {q}",
    vars: { f: ["f", "distanza focale", "len"], p: ["p", "distanza dell'oggetto", "len"], q: ["q", "distanza dell'immagine", "len"] },
    solve: { f: ["1 / (1 / {p} + 1 / {q})", x => 1 / (1 / x.p + 1 / x.q)], p: ["1 / (1 / {f} − 1 / {q})", x => 1 / (1 / x.f - 1 / x.q)], q: ["1 / (1 / {f} − 1 / {p})", x => 1 / (1 / x.f - 1 / x.p)] } },
  { t: "Ottica", name: "Ingrandimento", show: "{G} = {q} / {p}",
    vars: { G: ["G", "ingrandimento", "none"], q: ["q", "distanza dell'immagine", "len"], p: ["p", "distanza dell'oggetto", "len"] },
    solve: { G: ["{q} / {p}", x => x.q / x.p], q: ["{G} · {p}", x => x.G * x.p], p: ["{q} / {G}", x => x.q / x.G] } },
  { t: "Ottica", name: "Luce: lunghezza d'onda e frequenza", show: "c = {wl} · {f}",
    vars: { wl: ["λ", "lunghezza d'onda", "len"], f: ["f", "frequenza", "freq"] },
    solve: { wl: ["c / {f}", x => C_LUCE / x.f], f: ["c / {wl}", x => C_LUCE / x.wl] }, consts: ["c"] },
  // ---------- ELETTROSTATICA ----------
  { t: "Elettrostatica", name: "Campo elettrico", show: "{E} = {F} / {q}",
    vars: { E: ["E", "campo elettrico", "efield"], F: ["F", "forza sulla carica di prova", "force"], q: ["q", "carica di prova", "charge"] },
    solve: { E: ["{F} / {q}", x => x.F / x.q], F: ["{E} · {q}", x => x.E * x.q], q: ["{F} / {E}", x => x.F / x.E] } },
  { t: "Elettrostatica", name: "Campo di una carica puntiforme", show: "{E} = kₑ · {Q} / {r}²",
    vars: { E: ["E", "campo elettrico", "efield"], Q: ["Q", "carica che crea il campo", "charge"], r: ["r", "distanza", "len"] },
    solve: { E: ["kₑ · {Q} / {r}²", x => K_E * x.Q / x.r ** 2], Q: ["{E} · {r}² / kₑ", x => x.E * x.r ** 2 / K_E], r: ["√(kₑ · {Q} / {E})", x => Math.sqrt(K_E * x.Q / x.E)] }, consts: ["kₑ"] },
  { t: "Elettrostatica", name: "Potenziale di una carica puntiforme", show: "{V} = kₑ · {Q} / {r}",
    vars: { V: ["V", "potenziale elettrico", "volt"], Q: ["Q", "carica", "charge"], r: ["r", "distanza", "len"] },
    solve: { V: ["kₑ · {Q} / {r}", x => K_E * x.Q / x.r], Q: ["{V} · {r} / kₑ", x => x.V * x.r / K_E], r: ["kₑ · {Q} / {V}", x => K_E * x.Q / x.V] }, consts: ["kₑ"] },
  { t: "Elettrostatica", name: "Energia potenziale elettrica", show: "{U} = kₑ · {q1} · {q2} / {r}",
    vars: { U: ["U", "energia potenziale", "energy"], q1: ["q₁", "prima carica", "charge"], q2: ["q₂", "seconda carica", "charge"], r: ["r", "distanza", "len"] },
    solve: { U: ["kₑ · {q1} · {q2} / {r}", x => K_E * x.q1 * x.q2 / x.r], q1: ["{U} · {r} / (kₑ · {q2})", x => x.U * x.r / (K_E * x.q2)],
      q2: ["{U} · {r} / (kₑ · {q1})", x => x.U * x.r / (K_E * x.q1)], r: ["kₑ · {q1} · {q2} / {U}", x => K_E * x.q1 * x.q2 / x.U] }, consts: ["kₑ"] },
  { t: "Elettrostatica", name: "Lavoro e differenza di potenziale", show: "{L} = {q} · {dV}",
    vars: { L: ["L", "lavoro", "energy"], q: ["q", "carica", "charge"], dV: ["ΔV", "differenza di potenziale", "volt"] },
    solve: { L: ["{q} · {dV}", x => x.q * x.dV], q: ["{L} / {dV}", x => x.L / x.dV], dV: ["{L} / {q}", x => x.L / x.q] } },
  { t: "Elettrostatica", name: "Campo uniforme (tra due piastre)", show: "{E} = {dV} / {d}",
    vars: { E: ["E", "campo elettrico", "efield"], dV: ["ΔV", "differenza di potenziale", "volt"], d: ["d", "distanza tra le piastre", "len"] },
    solve: { E: ["{dV} / {d}", x => x.dV / x.d], dV: ["{E} · {d}", x => x.E * x.d], d: ["{dV} / {E}", x => x.dV / x.E] } },
  { t: "Elettrostatica", name: "Capacità di un condensatore", show: "{C} = {Q} / {V}",
    vars: { C: ["C", "capacità", "capac"], Q: ["Q", "carica sulle armature", "charge"], V: ["ΔV", "differenza di potenziale", "volt"] },
    solve: { C: ["{Q} / {V}", x => x.Q / x.V], Q: ["{C} · {V}", x => x.C * x.V], V: ["{Q} / {C}", x => x.Q / x.C] } },
  { t: "Elettrostatica", name: "Condensatore piano", show: "{C} = ε₀ · {er} · {S} / {d}",
    vars: { C: ["C", "capacità", "capac"], er: ["εᵣ", "costante dielettrica relativa (1 nel vuoto)", "none"], S: ["S", "area delle armature", "area"], d: ["d", "distanza tra le armature", "len"] },
    solve: { C: ["ε₀ · {er} · {S} / {d}", x => EPS0 * x.er * x.S / x.d], er: ["{C} · {d} / (ε₀ · {S})", x => x.C * x.d / (EPS0 * x.S)],
      S: ["{C} · {d} / (ε₀ · {er})", x => x.C * x.d / (EPS0 * x.er)], d: ["ε₀ · {er} · {S} / {C}", x => EPS0 * x.er * x.S / x.C] }, consts: ["ε₀"] },
  { t: "Elettrostatica", name: "Energia di un condensatore", show: "{U} = ½ · {C} · {V}²",
    vars: { U: ["U", "energia immagazzinata", "energy"], C: ["C", "capacità", "capac"], V: ["ΔV", "differenza di potenziale", "volt"] },
    solve: { U: ["½ · {C} · {V}²", x => 0.5 * x.C * x.V ** 2], C: ["2 · {U} / {V}²", x => 2 * x.U / x.V ** 2], V: ["√(2 · {U} / {C})", x => Math.sqrt(2 * x.U / x.C)] } },
  // ---------- CIRCUITI ----------
  { t: "Circuiti", name: "Resistenze in serie", show: "{R} = {R1} + {R2}",
    vars: { R: ["R_eq", "resistenza equivalente", "ohm"], R1: ["R₁", "prima resistenza", "ohm"], R2: ["R₂", "seconda resistenza", "ohm"] },
    solve: { R: ["{R1} + {R2}", x => x.R1 + x.R2], R1: ["{R} − {R2}", x => x.R - x.R2], R2: ["{R} − {R1}", x => x.R - x.R1] } },
  { t: "Circuiti", name: "Resistenze in parallelo", show: "1 / {R} = 1 / {R1} + 1 / {R2}",
    vars: { R: ["R_eq", "resistenza equivalente", "ohm"], R1: ["R₁", "prima resistenza", "ohm"], R2: ["R₂", "seconda resistenza", "ohm"] },
    solve: { R: ["{R1} · {R2} / ({R1} + {R2})", x => x.R1 * x.R2 / (x.R1 + x.R2)], R1: ["{R} · {R2} / ({R2} − {R})", x => x.R * x.R2 / (x.R2 - x.R)], R2: ["{R} · {R1} / ({R1} − {R})", x => x.R * x.R1 / (x.R1 - x.R)] } },
  { t: "Circuiti", name: "Effetto Joule", show: "{P} = {R} · {I}²",
    vars: { P: ["P", "potenza dissipata", "power"], R: ["R", "resistenza", "ohm"], I: ["I", "intensità di corrente", "current"] },
    solve: { P: ["{R} · {I}²", x => x.R * x.I ** 2], R: ["{P} / {I}²", x => x.P / x.I ** 2], I: ["√({P} / {R})", x => Math.sqrt(x.P / x.R)] } },
  { t: "Circuiti", name: "Energia elettrica consumata", show: "{E} = {P} · {t}",
    vars: { E: ["E", "energia", "energy"], P: ["P", "potenza", "power"], t: ["t", "tempo", "time"] },
    solve: { E: ["{P} · {t}", x => x.P * x.t], P: ["{E} / {t}", x => x.E / x.t], t: ["{E} / {P}", x => x.E / x.P] } },
  // ---------- MAGNETISMO ----------
  { t: "Magnetismo", name: "Forza di Lorentz", show: "{F} = {q} · {v} · {B}",
    vars: { F: ["F", "forza (velocità perpendicolare al campo)", "force"], q: ["q", "carica", "charge"], v: ["v", "velocità", "speed"], B: ["B", "campo magnetico", "bfield"] },
    solve: { F: ["{q} · {v} · {B}", x => x.q * x.v * x.B], q: ["{F} / ({v} · {B})", x => x.F / (x.v * x.B)], v: ["{F} / ({q} · {B})", x => x.F / (x.q * x.B)], B: ["{F} / ({q} · {v})", x => x.F / (x.q * x.v)] } },
  { t: "Magnetismo", name: "Forza su un filo percorso da corrente", show: "{F} = {B} · {I} · {L}",
    vars: { F: ["F", "forza (filo perpendicolare al campo)", "force"], B: ["B", "campo magnetico", "bfield"], I: ["I", "intensità di corrente", "current"], L: ["L", "lunghezza del filo", "len"] },
    solve: { F: ["{B} · {I} · {L}", x => x.B * x.I * x.L], B: ["{F} / ({I} · {L})", x => x.F / (x.I * x.L)], I: ["{F} / ({B} · {L})", x => x.F / (x.B * x.L)], L: ["{F} / ({B} · {I})", x => x.F / (x.B * x.I)] } },
  { t: "Magnetismo", name: "Campo di un filo rettilineo", show: "{B} = μ₀ · {I} / (2 · π · {d})",
    vars: { B: ["B", "campo magnetico", "bfield"], I: ["I", "intensità di corrente", "current"], d: ["d", "distanza dal filo", "len"] },
    solve: { B: ["μ₀ · {I} / (2 · π · {d})", x => MU0 * x.I / (2 * Math.PI * x.d)], I: ["{B} · 2 · π · {d} / μ₀", x => x.B * 2 * Math.PI * x.d / MU0], d: ["μ₀ · {I} / (2 · π · {B})", x => MU0 * x.I / (2 * Math.PI * x.B)] }, consts: ["μ₀"] },
  { t: "Magnetismo", name: "Raggio della traiettoria di una carica", show: "{r} = {m} · {v} / ({q} · {B})",
    vars: { r: ["r", "raggio della circonferenza", "len"], m: ["m", "massa", "mass"], v: ["v", "velocità", "speed"], q: ["q", "carica", "charge"], B: ["B", "campo magnetico", "bfield"] },
    solve: { r: ["{m} · {v} / ({q} · {B})", x => x.m * x.v / (x.q * x.B)], m: ["{r} · {q} · {B} / {v}", x => x.r * x.q * x.B / x.v], v: ["{r} · {q} · {B} / {m}", x => x.r * x.q * x.B / x.m],
      q: ["{m} · {v} / ({r} · {B})", x => x.m * x.v / (x.r * x.B)], B: ["{m} · {v} / ({q} · {r})", x => x.m * x.v / (x.q * x.r)] } }
];

/* Simboli con pedice: "V_f" diventa V con f in basso (a schermo) e "Vf" (nel testo semplice). */
const symHtml = (l) => escapeHtml(l).replace(/_(\S+)/, "<sub>$1</sub>");
const symTxt = (l) => l.replace("_", "");

/* Colori dei simboli: ogni grandezza ha il suo evidenziatore, nella formula e nei campi. */
const SYM_COLORS = ["sky", "yellow", "mint", "pink", "lilac"];

/* ---------- numeri: lettura e scrittura ---------- */
/** Legge "72", "0,5", "6,67e-11", "6,67 × 10^-11", "3·10^8". */
function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).trim().replace(/\s+/g, "").replace(/−/g, "-").replace(/,/g, ".");
  if (!t) return NaN;
  const m = t.match(/^(-?[\d.]+)(?:[x×*·]10\^?(-?\d+))$/i);
  if (m) return parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10));
  if (/^-?[\d.]+(e-?\d+)?$/i.test(t)) return parseFloat(t);
  return NaN;
}
/** Numero leggibile con l'unità; notazione scientifica per numeri molto grandi o piccoli. */
function physNum(v) {
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e7 || a < 1e-3)) {
    const e = Math.floor(Math.log10(a));
    const m = v / Math.pow(10, e);
    return `${Number(m.toPrecision(4)).toLocaleString("it-IT")} × 10${supNum(e)}`;
  }
  // sotto 10 000 niente punti delle migliaia: «3000» si legge meglio di «3.000»
  return Number(v.toPrecision(6)).toLocaleString("it-IT", { maximumFractionDigits: 6, useGrouping: a >= 10000 }).replace(/-/g, "−");
}
const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const supNum = (n) => String(n).split("").map(c => SUP[c] || c).join("");

/* =========================================================
   3. SEZIONE FISICA
   ========================================================= */
const fisica = {
  inited: {},
  init() {
    $("#fisSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-ft]"); if (b) this.tab(b.dataset.ft); });
    this.tab("formule");
  },
  tab(name) {
    $$("#fisSeg button").forEach(b => b.classList.toggle("on", b.dataset.ft === name));
    $$(".fis-pane").forEach(p => p.classList.toggle("hidden", p.dataset.fpane !== name));
    const init = { formule: () => pf.init(), problemi: () => probl.init(), simula: () => sim.init(), unita: () => si.init() }[name];
    if (init && !this.inited[name]) { init(); this.inited[name] = true; }
    if (name === "simula") sim.redraw();
  }
};

/* ---------- formule interattive ---------- */
const pf = {
  topic: "Moto", f: null, unknown: null,
  init() {
    $("#pfTopics").innerHTML = PHYS_TOPICS.map(t => `<button class="chip" data-t="${t}">${t}</button>`).join("");
    $("#pfTopics").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) this.setTopic(b.dataset.t); });
    $("#pfList").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) this.open(+b.dataset.f); });
    $("#pfWork").addEventListener("click", (e) => {
      const u = e.target.closest("[data-unk]"); if (u) return this.setUnknown(u.dataset.unk);
      const say = e.target.closest("[data-say]"); if (say) return tts.say(say.dataset.say, null, "it");
      if (e.target.closest("#pfCalc")) return this.calc();
      if (e.target.closest("#pfRead")) return tts.say(this.spoken || "", null, "it");
      if (e.target.closest("#pfPrint")) return this.print();
      if (e.target.closest("#pfBack")) { $("#pfWork").classList.add("hidden"); $("#pfPick").classList.remove("hidden"); $("#pfPick").scrollIntoView({ behavior: "smooth" }); }
    });
    $("#pfWork").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input")) this.calc(); });
    $("#pfPrintAll").addEventListener("click", () => this.printAll());
    this.setTopic("Moto");
  },
  setTopic(t) {
    this.topic = t;
    $$("#pfTopics .chip").forEach(c => c.classList.toggle("on", c.dataset.t === t));
    $("#pfList").innerHTML = PHYS.map((f, i) => f.t === t ? `<button class="pf-item" data-f="${i}"><span class="pf-name">${escapeHtml(f.name)}</span><span class="pf-show">${escapeHtml(this.plain(f.show, f))}</span></button>` : "").join("");
  },
  /** formula in testo semplice (con le etichette dei simboli) */
  plain(tpl, f) { return tpl.replace(/\{(\w+)\}/g, (_, k) => symTxt(f.vars[k][0])); },
  /** formula con i simboli colorati */
  colored(tpl, f) {
    const keys = Object.keys(f.vars);
    return escapeHtml(tpl).replace(/\{(\w+)\}/g, (_, k) => `<span class="sym c-${SYM_COLORS[keys.indexOf(k) % SYM_COLORS.length]}${k === this.unknown ? " unk" : ""}">${symHtml(f.vars[k][0])}</span>`);
  },
  open(i) {
    this.f = PHYS[i];
    this.unknown = Object.keys(this.f.vars)[0];
    this.render();
    $("#pfPick").classList.add("hidden");
    $("#pfWork").classList.remove("hidden");
    $("#pfWork").scrollIntoView({ behavior: "smooth", block: "start" });
  },
  setUnknown(k) {
    // tengo i valori già scritti
    const keep = {};
    $$("#pfWork [data-in]").forEach(inp => { keep[inp.dataset.in] = [inp.value, $(`#pfWork [data-unit="${inp.dataset.in}"]`).value]; });
    this.unknown = k;
    this.render(keep);
  },
  render(keep = {}) {
    const f = this.f, keys = Object.keys(f.vars), k = this.unknown;
    const unitSel = (key, attr) => `<select ${attr}="${key}" aria-label="Unità di misura">${QTY[f.vars[key][2]].map(([u]) => `<option${keep[key]?.[1] === u ? " selected" : ""}>${u}</option>`).join("")}</select>`;
    const consts = (f.consts || []).map(c => `<li><b>${c}</b> = ${physNum(CONSTS[c][0])} ${CONSTS[c][1]} <small>${CONSTS[c][2]}</small></li>`).join("");
    $("#pfWork").innerHTML = `
      <button class="btn small ghost" id="pfBack"><svg class="i"><use href="#i-back"/></svg>Tutte le formule</button>
      <h2>${escapeHtml(f.name)}</h2>
      <div class="pf-formula">${this.colored(f.show, f)}</div>
      <ul class="pf-legend">${keys.map((key, i) => `<li><span class="sym c-${SYM_COLORS[i % SYM_COLORS.length]}">${symHtml(f.vars[key][0])}</span>
        <span>${escapeHtml(f.vars[key][1])}<small>si misura in ${escapeHtml(QTY[f.vars[key][2]][0][0])}</small></span>
        <button class="icon-btn" data-say="${escapeHtml(f.vars[key][0].replace("_", " ").replace("₀", " zero").replace("₁", " uno").replace("₂", " due"))}: ${escapeHtml(f.vars[key][1])}" aria-label="Ascolta"><svg class="i"><use href="#i-volume"/></svg></button></li>`).join("")}
        ${consts ? `<li class="consts"><span class="hint">Costanti:</span><ul>${consts}</ul></li>` : ""}</ul>
      <h3 class="pf-q">Cosa devi trovare?</h3>
      <div class="chips">${keys.map(key => `<button class="chip${key === k ? " on" : ""}" data-unk="${key}">${symHtml(f.vars[key][0])} <small>${escapeHtml(f.vars[key][1])}</small></button>`).join("")}</div>
      <div class="pf-inverse"><span class="hint">Formula da usare</span><div>${this.colored(`{${k}} = ` + f.solve[k][0], f)}</div></div>
      <h3 class="pf-q">Scrivi i dati che conosci</h3>
      <div class="pf-inputs">${keys.filter(key => key !== k).map(key => `
        <label class="pf-in"><span class="sym c-${SYM_COLORS[keys.indexOf(key) % SYM_COLORS.length]}">${symHtml(f.vars[key][0])}</span>
          <input type="text" inputmode="decimal" data-in="${key}" value="${escapeHtml(keep[key]?.[0] || "")}" placeholder="${escapeHtml(f.vars[key][1])}" autocomplete="off">
          ${unitSel(key, "data-unit")}</label>`).join("")}
        <label class="pf-in result-unit"><span>Risultato in</span>${unitSel(k, "data-unit")}</label>
      </div>
      <button class="btn primary" id="pfCalc"><svg class="i"><use href="#i-equal"/></svg>Calcola</button>
      <div id="pfOut"></div>`;
  },
  calc() {
    const f = this.f, k = this.unknown, keys = Object.keys(f.vars);
    const x = {}, conv = [];
    for (const key of keys) {
      if (key === k) continue;
      const inp = $(`#pfWork [data-in="${key}"]`), unit = $(`#pfWork [data-unit="${key}"]`).value;
      const v = parseNum(inp.value);
      if (!isFinite(v)) { inp.focus(); inp.classList.add("bad"); return toast(`Scrivi il valore di ${symTxt(f.vars[key][0])} (${f.vars[key][1]}).`); }
      inp.classList.remove("bad");
      const units = QTY[f.vars[key][2]], fac = units.find(u => u[0] === unit)[1], siU = units[0][0];
      x[key] = v * fac;
      conv.push({ key, v, unit, si: x[key], siU, changed: fac !== 1 });
    }
    const res = f.solve[k][1](x);
    const outUnit = $(`#pfWork [data-unit="${k}"]`).value, units = QTY[f.vars[k][2]];
    const siU = units[0][0], fac = units.find(u => u[0] === outUnit)[1];
    const lab = (key) => symTxt(f.vars[key][0]);
    // sostituzione: metto i valori (in unità SI) al posto dei simboli
    const subst = f.solve[k][0].replace(/\{(\w+)\}/g, (_, key) => {
      const c = conv.find(c => c.key === key);
      const u = QTY[f.vars[key][2]][0][0];
      const val = physNum(c.si);
      const unitTxt = u === "(numero puro)" ? "" : " " + u;
      return (c.si < 0 ? `(${val}${unitTxt})` : `${val}${unitTxt}`);
    });
    const steps = [];
    const changed = conv.filter(c => c.changed);
    steps.push({ t: "I dati", m: conv.map(c => `${lab(c.key)} = ${physNum(c.v)} ${c.unit === "(numero puro)" ? "" : c.unit}`).join("\n") });
    if (changed.length) steps.push({ t: "Porto i dati nelle unità del Sistema Internazionale", m: changed.map(c => `${physNum(c.v)} ${c.unit} = ${physNum(c.si)} ${c.siU}`).join("\n") });
    steps.push({ t: k === Object.keys(f.solve)[0] ? "Scrivo la formula" : `Uso la formula inversa per trovare ${lab(k)}`, m: `${lab(k)} = ${this.plain(f.solve[k][0], f)}` });
    if (f.consts?.length) steps.push({ t: "Le costanti", m: f.consts.map(c => `${c} = ${physNum(CONSTS[c][0])} ${CONSTS[c][1]}`).join("\n") });
    steps.push({ t: "Sostituisco i valori", m: `${lab(k)} = ${subst}` });
    const out = $("#pfOut");
    if (!isFinite(res)) {
      out.innerHTML = `<ol class="eq-steps">${steps.map(s => `<li><div>${escapeHtml(s.t)}</div><div class="math">${escapeHtml(s.m)}</div></li>`).join("")}</ol>
        <p class="pf-err">Con questi dati non si può calcolare: forse c'è una divisione per zero o la radice di un numero negativo. Controlla i valori e i segni.</p>`;
      return;
    }
    const resU = siU === "(numero puro)" ? "" : " " + siU;
    let final = `${lab(k)} = ${physNum(res)}${resU}`;
    if (fac !== 1) final += `  =  ${physNum(res / fac)} ${outUnit}`;
    steps.push({ t: "Calcolo il risultato", m: final });
    const warn = (res < 0 && ["len", "time", "mass", "period", "volume", "area", "density", "tempK"].includes(f.vars[k][2]))
      ? `<p class="pf-err">Attenzione: è venuto un valore negativo per ${escapeHtml(f.vars[k][1])}. Probabilmente un dato è sbagliato o va preso con il segno opposto.</p>` : "";
    out.innerHTML = `<ol class="eq-steps">${steps.map(s => `<li><div>${escapeHtml(s.t)}</div><div class="math">${escapeHtml(s.m)}</div></li>`).join("")}</ol>
      <div class="eq-sol">${escapeHtml(lab(k))} = <span>${escapeHtml(physNum(fac !== 1 ? res / fac : res))}</span> ${escapeHtml(fac !== 1 ? outUnit : (resU.trim()))}</div>${warn}
      <div class="btn-row"><button class="btn" id="pfRead"><svg class="i"><use href="#i-volume"/></svg>Ascolta i passaggi</button>
      <button class="btn" id="pfPrint"><svg class="i"><use href="#i-printer"/></svg>Stampa</button></div>`;
    this.spoken = steps.map(s => s.t + ": " + speakable(s.m.replace(/\n/g, ", ").replace(/×\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (m, e) => " per dieci alla " + e.split("").map(c => Object.keys(SUP).find(k => SUP[k] === c)).join("").replace("-", "meno ")))).join(". ");
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
  print() {
    const box = $("#pfWork").cloneNode(true);
    box.querySelectorAll("button, .chips, .pf-inputs, .pf-q, select").forEach(e => e.remove());
    printer.run(`<div class="print-text phys-print">${box.innerHTML}</div>`, { title: "Fisica: " + this.f.name });
  },
  printAll() {
    const html = PHYS_TOPICS.map(t => `<h3>${t}</h3>` + PHYS.filter(f => f.t === t).map(f => {
      const inv = Object.keys(f.solve).slice(1).map(k => `${symTxt(f.vars[k][0])} = ${this.plain(f.solve[k][0], f)}`).join("   ·   ");
      const legend = Object.values(f.vars).map(v => `${symTxt(v[0])} ${v[1]} (${QTY[v[2]][0][0]})`).join("; ");
      return `<div class="f-item"><div class="f-name">${escapeHtml(f.name)}</div><div class="f-eq">${escapeHtml(this.plain(f.show, f))}</div><div class="f-note">Inverse: ${escapeHtml(inv)}<br>${escapeHtml(legend)}</div></div>`;
    }).join("")).join("");
    printer.run(`<div class="print-form">${html}</div>`, { title: "Formulario di fisica" });
  }
};

/* ---------- problemi guidati (IA) ---------- */
const probl = {
  init() {
    $("#physPhoto").addEventListener("change", async (e) => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      try {
        busy(true, "Leggo il problema…");
        const img = await imageToBase64(file);
        this.show(parseJSON(await ask({ prompt: PROMPTS.fisica("(Il problema è nella foto.)"), images: [img], json: true, temperature: 0.2, claude: true })));
      } catch (err) { toast(err.message || "Non sono riuscito a leggere il problema. Riprova con una foto più vicina.", 6000); }
      finally { busy(false); }
    });
    $("#btnPhysText").addEventListener("click", async () => {
      const t = $("#physText").value.trim();
      if (!t) return toast("Scrivi prima il testo del problema.");
      try {
        busy(true, "Studio il problema…");
        this.show(parseJSON(await ask({ prompt: PROMPTS.fisica(t), json: true, temperature: 0.2, claude: true })));
      } catch (err) { toast(err.message || "Non sono riuscito a risolverlo. Riprova.", 6000); }
      finally { busy(false); }
    });
    $("#physOut").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ex]"); if (b) return exerciseControl(b.dataset.ex, $("#physOut"));
      if (e.target.closest("#physRead")) return tts.say(this.md || "", null, "it");
      if (e.target.closest("#physPrint")) {
        const box = $("#physOut").cloneNode(true);
        box.querySelectorAll(".hidden").forEach(x => x.classList.remove("hidden"));
        box.querySelectorAll("button, .no-print").forEach(x => x.remove());
        printer.run(`<div class="print-text phys-print">${box.innerHTML}</div>`, { title: "Problema di fisica" });
      }
    });
  },
  show(d) {
    const dati = (d.dati || []).filter(x => x.simbolo || x.grandezza);
    const steps = (d.passi || []).filter(p => p.spiegazione || p.titolo || p.calcolo);
    if (!steps.length) throw new Error("Non sono riuscito a capire il problema. Prova a scriverlo o a fare una foto più chiara.");
    const inc = d.incognite || [];
    const html = `
      ${d.riassunto ? `<p class="ph-sum">${escapeHtml(d.riassunto)}</p>` : ""}
      <h3>Dati</h3>
      <div class="table-wrap"><table class="dati">
        <thead><tr><th>Simbolo</th><th>Grandezza</th><th>Dato</th><th>In SI</th></tr></thead>
        <tbody>${dati.map(x => `<tr><td><span class="sym c-sky">${escapeHtml(x.simbolo || "")}</span></td><td>${escapeHtml(x.grandezza || "")}</td>
          <td>${escapeHtml([x.valore, x.unita].filter(Boolean).join(" "))}</td><td>${escapeHtml(x.si || "")}</td></tr>`).join("")}
        ${inc.map(x => `<tr class="unk-row"><td><span class="sym c-pink unk">${escapeHtml(x.simbolo || "?")}</span></td><td>${escapeHtml(x.grandezza || "")}</td><td colspan="2"><b>da trovare</b></td></tr>`).join("")}</tbody>
      </table></div>
      ${(d.formule || []).length ? `<h3>Formule</h3><ul class="ph-formule">${d.formule.map(f => `<li><span class="pf-formula small">${escapeHtml(f.formula || "")}</span>${f.perche ? `<small>${escapeHtml(f.perche)}</small>` : ""}</li>`).join("")}</ul>` : ""}
      ${d.disegno ? `<p class="hint"><b>Fai uno schema:</b> ${escapeHtml(d.disegno)}</p>` : ""}
      <h3>Risolviamolo</h3>
      <p class="hint no-print">Prova a fare ogni passo da sola, poi apri il successivo per controllare.</p>
      ${steps.map((p, i) => `<div class="ex-step${i ? " hidden" : ""}"><div class="ex-num">Passo ${i + 1} di ${steps.length}</div>
        <b>${escapeHtml(p.titolo || "")}</b>${p.spiegazione ? `<p>${escapeHtml(p.spiegazione)}</p>` : ""}${p.calcolo ? `<div class="ph-calc">${escapeHtml(p.calcolo)}</div>` : ""}</div>`).join("")}
      <div class="ex-final hidden"><b>Risultato</b><p class="ph-res">${escapeHtml(d.risultato || "")}</p>
        ${d.controllo ? `<b>Ha senso?</b><p>${escapeHtml(d.controllo)}</p>` : ""}</div>
      <div class="row gap wrap no-print ex-ctrl">
        <button class="btn primary" data-ex="next">Passo successivo</button>
        <button class="btn" data-ex="all">Mostra tutto</button>
      </div>
      <div class="btn-row">
        <button class="btn" id="physRead"><svg class="i"><use href="#i-volume"/></svg>Ascolta</button>
        <button class="btn" id="physPrint"><svg class="i"><use href="#i-printer"/></svg>Stampa</button>
      </div>`;
    this.md = [d.riassunto, "Dati: " + dati.map(x => `${x.grandezza} ${x.valore || ""} ${x.unita || ""}`).join(", "),
      inc.length ? "Da trovare: " + inc.map(x => x.grandezza).join(", ") : "",
      ...steps.map((p, i) => `Passo ${i + 1}. ${p.titolo || ""}. ${p.spiegazione || ""} ${p.calcolo ? speakable(p.calcolo) : ""}`),
      d.risultato ? "Risultato: " + speakable(d.risultato) : ""].filter(Boolean).join(". ");
    const out = $("#physOut");
    out.innerHTML = html;
    out.classList.remove("hidden");
    out.scrollIntoView({ behavior: "smooth" });
  }
};

/* ---------- simulazioni ---------- */
const sim = {
  mode: "moto",
  init() {
    $("#simSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-sm]"); if (b) this.setMode(b.dataset.sm); });
    ["#sV0", "#sA"].forEach(s => $(s).addEventListener("input", () => { this.stop(); this.t = 0; this.redraw(); }));
    ["#sF1", "#sF2", "#sTh"].forEach(s => $(s).addEventListener("input", () => this.drawVec()));
    $("#simPlay").addEventListener("click", () => this.running ? this.stop() : this.play());
    $("#simReset").addEventListener("click", () => { this.stop(); this.t = 0; this.redraw(); });
    $("#simPresets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-p]"); if (!b) return;
      const [v0, a] = b.dataset.p.split(",").map(Number);
      $("#sV0").value = v0; $("#sA").value = a; this.stop(); this.t = 0; this.redraw();
    });
    addEventListener("resize", () => { if ($("#view-fisica").classList.contains("active")) this.redraw(); });
    this.t = 0;
  },
  setMode(m) {
    this.mode = m; this.stop();
    $$("#simSeg button").forEach(b => b.classList.toggle("on", b.dataset.sm === m));
    $("#simMoto").classList.toggle("hidden", m !== "moto");
    $("#simVett").classList.toggle("hidden", m !== "vettori");
    this.redraw();
  },
  redraw() { this.mode === "moto" ? this.drawMoto() : this.drawVec(); },
  /** canvas nitido su schermi ad alta densità */
  ctx(cv) {
    const dpr = window.devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, W, H };
  },
  /* --- moto rettilineo --- */
  T: 10,
  params() {
    const v0 = +$("#sV0").value, a = +$("#sA").value;
    // se l'accelerazione è contraria alla velocità, il corpo frena e poi si ferma
    const tStop = (v0 !== 0 && a !== 0 && Math.sign(a) !== Math.sign(v0)) ? -v0 / a : Infinity;
    const st = (t) => { const tt = Math.min(t, tStop); return v0 * tt + 0.5 * a * tt * tt; };
    const vt = (t) => t >= tStop ? 0 : v0 + a * t;
    return { v0, a, tStop, st, vt };
  },
  play() {
    if (this.t >= this.T) this.t = 0;
    this.running = true;
    $("#simPlay").innerHTML = `${icon("pause")}Pausa`;
    let last = performance.now();
    const step = (now) => {
      if (!this.running) return;
      this.t = Math.min(this.T, this.t + (now - last) / 1000); last = now;
      this.drawMoto();
      if (this.t >= this.T) return this.stop();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    const b = $("#simPlay"); if (b) b.innerHTML = `${icon("play")}Avvia`;
  },
  drawMoto() {
    const p = this.params(), t = this.t || 0;
    $("#sV0v").textContent = physNum(p.v0) + " m/s"; $("#sAv").textContent = physNum(p.a) + " m/s²";
    // intervallo di spazio da mostrare
    let smin = 0, smax = 0;
    for (let i = 0; i <= 100; i++) { const s = p.st(this.T * i / 100); smin = Math.min(smin, s); smax = Math.max(smax, s); }
    if (smax - smin < 10) { smax = smin + 10; }
    const pad = (smax - smin) * 0.08; smin -= pad; smax += pad;
    // pista
    const { g, W, H } = this.ctx($("#simTrack"));
    const X = (s) => 16 + (s - smin) / (smax - smin) * (W - 32);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#eef0f6"; g.fillRect(0, H - 34, W, 22);
    g.strokeStyle = "#c9cfdf"; g.lineWidth = 1; g.font = "11px Lexend, sans-serif"; g.fillStyle = "#5b6482"; g.textAlign = "center";
    const raw = (smax - smin) / 6, pw = Math.pow(10, Math.floor(Math.log10(raw)));
    const stp = [1, 2, 5, 10].map(m => m * pw).find(s => s >= raw);
    for (let s = Math.ceil(smin / stp) * stp; s <= smax; s += stp) {
      g.beginPath(); g.moveTo(X(s), H - 34); g.lineTo(X(s), H - 12); g.stroke();
      g.fillText(physNum(s) + " m", X(s), H - 1);
    }
    // auto
    const s = p.st(t), v = p.vt(t), cx = X(s), y = H - 34;
    g.fillStyle = "#2c47c9";
    g.beginPath(); g.roundRect ? g.roundRect(cx - 22, y - 22, 44, 16, 5) : g.rect(cx - 22, y - 22, 44, 16); g.fill();
    g.beginPath(); g.roundRect ? g.roundRect(cx - 12, y - 32, 24, 12, 4) : g.rect(cx - 12, y - 32, 24, 12); g.fill();
    g.fillStyle = "#1c2440";
    [cx - 13, cx + 13].forEach(wx => { g.beginPath(); g.arc(wx, y - 5, 5, 0, Math.PI * 2); g.fill(); });
    // frecce di velocità e accelerazione
    const arrow = (x0, yy, len, col, label) => {
      if (Math.abs(len) < 2) return;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + len, yy); g.stroke();
      const d = Math.sign(len);
      g.beginPath(); g.moveTo(x0 + len, yy); g.lineTo(x0 + len - 8 * d, yy - 5); g.lineTo(x0 + len - 8 * d, yy + 5); g.fill();
      g.font = "600 12px Lexend, sans-serif"; g.textAlign = "center"; g.fillText(label, x0 + len / 2, yy - 6);
    };
    arrow(cx, y - 44, v * 4, "#17824f", "v");
    if (t < p.tStop) arrow(cx, y - 64, p.a * 10, "#e0457b", "a");
    // valori
    $("#simT").textContent = physNum(Math.round(t * 10) / 10) + " s";
    $("#simS").textContent = physNum(Math.round(s * 10) / 10) + " m";
    $("#simV").textContent = physNum(Math.round(v * 10) / 10) + " m/s";
    // grafici
    this.plot($("#simST"), (tt) => p.st(tt), t, "s (m)", "#2c47c9");
    this.plot($("#simVT"), (tt) => p.vt(tt), t, "v (m/s)", "#17824f");
    // spiegazione
    $("#simExplain").innerHTML = p.a === 0
      ? `<b>Moto rettilineo uniforme</b> (a = 0): la velocità non cambia. Il grafico spazio-tempo è una <b>retta</b>: più è ripida, più il corpo è veloce. Il grafico velocità-tempo è una retta orizzontale.`
      : `<b>Moto uniformemente accelerato</b> (a = ${physNum(p.a)} m/s²): la velocità cambia sempre della stessa quantità ogni secondo. Il grafico velocità-tempo è una <b>retta inclinata</b> (la pendenza è a), quello spazio-tempo è un pezzo di <b>parabola</b>.` +
        (p.tStop < this.T ? ` Qui l'accelerazione è contraria alla velocità: il corpo <b>frena</b> e si ferma dopo ${physNum(Math.round(p.tStop * 10) / 10)} s.` : "");
  },
  plot(cv, fn, tNow, label, color) {
    const { g, W, H } = this.ctx(cv);
    const L = 40, B = 22, T0 = 10;
    let ymin = 0, ymax = 0;
    for (let i = 0; i <= 100; i++) { const y = fn(this.T * i / 100); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    if (ymax - ymin < 1) ymax = ymin + 1;
    const X = (t) => L + t / this.T * (W - L - 10), Y = (y) => T0 + (1 - (y - ymin) / (ymax - ymin)) * (H - B - T0);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "#eef0f6"; g.lineWidth = 1;
    for (let t = 0; t <= this.T; t += 2) { g.beginPath(); g.moveTo(X(t), T0); g.lineTo(X(t), H - B); g.stroke(); }
    g.strokeStyle = "#1c2440"; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(L, T0); g.lineTo(L, H - B); g.lineTo(W - 6, H - B); g.stroke();
    if (ymin < 0 && ymax > 0) { g.strokeStyle = "#c9cfdf"; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(W - 6, Y(0)); g.stroke(); }
    g.fillStyle = "#5b6482"; g.font = "11px Lexend, sans-serif"; g.textAlign = "center";
    for (let t = 0; t <= this.T; t += 2) g.fillText(t + " s", X(t), H - 6);
    g.textAlign = "right";
    [ymin, (ymin + ymax) / 2, ymax].forEach(y => g.fillText(physNum(Math.round(y)), L - 5, Y(y) + 4));
    g.textAlign = "left"; g.font = "600 12px Lexend, sans-serif"; g.fillStyle = "#1c2440"; g.fillText(label, L + 6, T0 + 10);
    // curva intera chiara, poi la parte già percorsa
    const curve = (tEnd, col, w) => {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (let i = 0; i <= 200; i++) { const t = tEnd * i / 200; const px = X(t), py = Y(fn(t)); i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    };
    curve(this.T, color + "33", 2);
    if (tNow > 0) curve(tNow, color, 3);
    g.fillStyle = color; g.beginPath(); g.arc(X(tNow), Y(fn(tNow)), 5, 0, Math.PI * 2); g.fill();
  },
  /* --- vettori: somma di due forze --- */
  drawVec() {
    const F1 = +$("#sF1").value, F2 = +$("#sF2").value, th = +$("#sTh").value;
    $("#sF1v").textContent = physNum(F1) + " N"; $("#sF2v").textContent = physNum(F2) + " N"; $("#sThv").textContent = th + "°";
    const r = th * RAD;
    const Rx = F1 + F2 * Math.cos(r), Ry = F2 * Math.sin(r);
    const R = Math.hypot(Rx, Ry), ang = Math.atan2(Ry, Rx) / RAD;
    const { g, W, H } = this.ctx($("#simVec"));
    g.clearRect(0, 0, W, H);
    const maxX = Math.max(F1, Rx, F2 * Math.cos(r), 0), minX = Math.min(0, F2 * Math.cos(r), Rx);
    const maxY = Math.max(Ry, 1);
    const sc = Math.min((W - 60) / Math.max(maxX - minX, 1), (H - 50) / maxY);
    const ox = 30 - minX * sc, oy = H - 25;
    const P = (x, y) => [ox + x * sc, oy - y * sc];
    // griglia
    g.strokeStyle = "#eef0f6"; g.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = H; y > 0; y -= 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // parallelogramma
    g.setLineDash([6, 5]); g.strokeStyle = "#8b93ad"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(...P(F1, 0)); g.lineTo(...P(Rx, Ry)); g.lineTo(...P(F2 * Math.cos(r), Ry)); g.stroke();
    g.setLineDash([]);
    const vec = (x, y, col, label, w = 3.5) => {
      const [x0, y0] = P(0, 0), [x1, y1] = P(x, y);
      const len = Math.hypot(x1 - x0, y1 - y0); if (len < 3) return;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - ux * 8, y1 - uy * 8); g.stroke();
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * 13 - uy * 6, y1 - uy * 13 + ux * 6); g.lineTo(x1 - ux * 13 + uy * 6, y1 - uy * 13 - ux * 6); g.fill();
      g.font = "600 14px Lexend, sans-serif"; g.textAlign = "left"; g.fillText(label, x1 + 6, y1 - 6);
    };
    vec(F1, 0, "#2c47c9", "F₁");
    vec(F2 * Math.cos(r), F2 * Math.sin(r), "#e0457b", "F₂");
    vec(Rx, Ry, "#17824f", "R", 4.5);
    // valori e spiegazione
    $("#vecR").textContent = `R = ${physNum(Math.round(R * 100) / 100)} N`;
    $("#vecAng").textContent = `${physNum(Math.round(ang * 10) / 10)}° rispetto a F₁`;
    let why = `Regola del parallelogramma: R = √(F₁² + F₂² + 2 · F₁ · F₂ · cos θ).`;
    if (th === 0) why = `Stessa direzione e stesso verso: le forze si <b>sommano</b>. R = F₁ + F₂.`;
    else if (th === 180) why = `Stessa direzione, verso opposto: le forze si <b>sottraggono</b>. R = |F₁ − F₂|.`;
    else if (th === 90) why = `Forze perpendicolari: si usa il <b>teorema di Pitagora</b>. R = √(F₁² + F₂²).`;
    $("#vecExplain").innerHTML = why;
  }
};

/* ---------- unità, prefissi, notazione scientifica ---------- */
const PREFIXES = [["tera", "T", 12], ["giga", "G", 9], ["mega", "M", 6], ["kilo", "k", 3], ["etto", "h", 2], ["deca", "da", 1], ["(nessuno)", "", 0],
  ["deci", "d", -1], ["centi", "c", -2], ["milli", "m", -3], ["micro", "μ", -6], ["nano", "n", -9], ["pico", "p", -12]];
const GRANDEZZE = [
  ["Lunghezza", "l, s", "metro", "m", "scalare", true], ["Massa", "m", "chilogrammo", "kg", "scalare", true], ["Tempo", "t", "secondo", "s", "scalare", true],
  ["Temperatura", "T", "kelvin", "K", "scalare", true], ["Intensità di corrente", "I", "ampere", "A", "scalare", true],
  ["Quantità di sostanza", "n", "mole", "mol", "scalare", true], ["Intensità luminosa", "Iᵥ", "candela", "cd", "scalare", true],
  ["Velocità", "v", "metro al secondo", "m/s", "vettoriale"], ["Accelerazione", "a", "metro al secondo quadrato", "m/s²", "vettoriale"],
  ["Forza", "F", "newton", "N = kg·m/s²", "vettoriale"], ["Energia, lavoro, calore", "E, L, Q", "joule", "J = N·m", "scalare"],
  ["Potenza", "P", "watt", "W = J/s", "scalare"], ["Pressione", "p", "pascal", "Pa = N/m²", "scalare"], ["Densità", "d, ρ", "chilogrammo al metro cubo", "kg/m³", "scalare"],
  ["Frequenza", "f", "hertz", "Hz = 1/s", "scalare"], ["Carica elettrica", "q", "coulomb", "C = A·s", "scalare"],
  ["Tensione", "V", "volt", "V", "scalare"], ["Resistenza", "R", "ohm", "Ω", "scalare"]
];
const COSTANTI = [
  ["Accelerazione di gravità (sulla Terra)", "g", "9,81 m/s²"], ["Costante di gravitazione universale", "G", "6,67 × 10⁻¹¹ N·m²/kg²"],
  ["Velocità della luce nel vuoto", "c", "3,00 × 10⁸ m/s"], ["Velocità del suono nell'aria (20 °C)", "", "343 m/s"],
  ["Carica dell'elettrone", "e", "1,60 × 10⁻¹⁹ C"], ["Costante di Coulomb", "kₑ", "8,99 × 10⁹ N·m²/C²"],
  ["Costante dei gas", "R", "8,314 J/(mol·K)"], ["Numero di Avogadro", "Nₐ", "6,02 × 10²³ mol⁻¹"],
  ["Densità dell'acqua", "", "1000 kg/m³ = 1 g/cm³"], ["Calore specifico dell'acqua", "", "4186 J/(kg·K)"], ["Pressione atmosferica", "", "101 325 Pa ≈ 1 atm"]
];
const si = {
  init() {
    $("#prefixes").innerHTML = PREFIXES.map(([n, s, e]) => `<button class="pref" data-say="${n === "(nessuno)" ? "unità" : n}, dieci alla ${e < 0 ? "meno " + (-e) : e}">
      <b>${s || "—"}</b><span>${n}</span><small>10${supNum(e)}${e > 0 && e <= 3 ? " = " + Math.pow(10, e).toLocaleString("it-IT") : e < 0 && e >= -3 ? " = " + (Math.pow(10, e)).toLocaleString("it-IT") : ""}</small></button>`).join("");
    $("#prefixes").addEventListener("click", (e) => { const b = e.target.closest("[data-say]"); if (b) tts.say(b.dataset.say, null, "it"); });
    $("#grandezze").innerHTML = `<thead><tr><th>Grandezza</th><th>Simbolo</th><th>Unità</th><th>Tipo</th></tr></thead><tbody>${GRANDEZZE.map(([n, s, un, u, ty, fond]) =>
      `<tr><td>${n}${fond ? ' <span class="tag">fondamentale</span>' : ""}</td><td>${s}</td><td><b>${u}</b><br><small>${un}</small></td><td>${ty}</td></tr>`).join("")}</tbody>`;
    $("#costanti").innerHTML = COSTANTI.map(([n, s, v]) => `<div class="f-item"><div class="f-name">${n}</div><div class="f-eq">${s ? s + " = " : ""}${v}</div></div>`).join("");
    $("#sciIn").addEventListener("input", () => this.sci());
    this.sci();
  },
  /** notazione scientifica spiegata con la virgola che si sposta */
  sci() {
    const raw = $("#sciIn").value;
    const v = parseNum(raw);
    const out = $("#sciOut");
    if (!isFinite(v) || v === 0) { out.innerHTML = `<small>Scrivi un numero diverso da zero, ad esempio 0,00045 oppure 3 400 000.</small>`; return; }
    const e = Math.floor(Math.log10(Math.abs(v)));
    const m = v / Math.pow(10, e);
    const mTxt = Number(m.toPrecision(6)).toLocaleString("it-IT", { maximumFractionDigits: 6 });
    const posti = Math.abs(e);
    const how = e === 0 ? "Il numero è già tra 1 e 10: l'esponente è 0."
      : e > 0 ? `Sposto la virgola di <b>${posti}</b> ${posti === 1 ? "posto" : "posti"} verso <b>sinistra</b> per avere un numero tra 1 e 10: l'esponente è <b>positivo</b> (+${posti}). Un numero grande ha l'esponente positivo.`
      : `Sposto la virgola di <b>${posti}</b> ${posti === 1 ? "posto" : "posti"} verso <b>destra</b> per avere un numero tra 1 e 10: l'esponente è <b>negativo</b> (−${posti}). Un numero piccolo (minore di 1) ha l'esponente negativo.`;
    out.innerHTML = `<div class="sci-res">${mTxt} × 10<sup>${e}</sup></div><p>${how}</p>`;
  }
};
