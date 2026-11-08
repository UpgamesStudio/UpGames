/* ═══════════════════════════════════════════════════════════════
   UpGames · Cómo ordena Nexus el feed (una sola fórmula para el
   servidor y la web: index.js la usa con require(), el navegador
   como window.UGRank).

   PUNTAJE = P + (1 − P) × ORGÁNICO              (todo entre 0 y 1)

   P  = peso de la PROMOCIÓN pagada con UpCoins (0 si no tiene):
        Estándar 30 % · Plus 40 % · Máx 50 % · Premium del autor 10 %
        Cuantas más UpCoins invierte el creador, más pesa su promoción,
        pero nunca más de la mitad: la otra mitad la gana el contenido.

   ORGÁNICO (suma 100 %):
     30 %  Reseñas ............ estrellas (media bayesiana) + "¿te funcionó?"
     20 %  Gustos del usuario . categorías, juegos y creadores que mira,
                                descarga y guarda (en su teléfono y, con
                                cuenta, lo que Nexus aprendió de él)
     15 %  Guardados .......... favoritos de la publicación
     10 %  Recurrencia ........ cuánto vuelve el usuario a ese creador/juego
     10 %  Seguidores ......... seguidores del creador
     10 %  Elecciones ......... con qué frecuencia la eligen todos esta
                                semana (descargas de 7 días)
      5 %  Novedad ............ lo reciente sube un poco

   Sin historial (primera visita) los gustos y la recurrencia no
   aplican y su peso se reparte entre el resto. Para que el feed no
   sea monótono, el mismo creador seguido pierde un poco de peso.
═══════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.UGRank = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PESOS = { resenas: 0.30, gustos: 0.20, guardados: 0.15, recurrencia: 0.10, seguidores: 0.10, elecciones: 0.10, novedad: 0.05 };
  const PERSONALES = ['gustos', 'recurrencia'];

  // Promoción con UpCoins: duración a elegir y nivel (más UpCoins = más peso)
  const PROMO_NIVELES = [
    { id: 'estandar', nombre: 'Estándar', peso: 0.30, mult: 1 },
    { id: 'plus',     nombre: 'Plus',     peso: 0.40, mult: 2 },
    { id: 'max',      nombre: 'Máx',      peso: 0.50, mult: 3.5 },
  ];
  const PROMO_PREMIUM = 0.10;            // autores con Premium activo
  const PROMO_DIAS = [1, 3, 7, 14, 30];
  const PROMO_UC_DIA = 50;               // 1 día Estándar = 50 UpCoins (como antes)
  const PROMO_DESCUENTO = { 1: 1, 3: 0.9, 7: 0.8, 14: 0.72, 30: 0.65 };   // más días, más barato por día
  const nivel = id => PROMO_NIVELES.find(n => n.id === id) || null;
  /** UpCoins de una promoción (redondeado a múltiplos de 5). null si la combinación no existe. */
  function precioPromo(dias, nivelId) {
    const n = nivel(nivelId), d = Number(dias);
    if (!n || !PROMO_DESCUENTO[d]) return null;
    return Math.max(5, Math.round(PROMO_UC_DIA * d * PROMO_DESCUENTO[d] * n.mult / 5) * 5);
  }
  const tablaPrecios = () => Object.fromEntries(PROMO_NIVELES.map(n => [n.id, Object.fromEntries(PROMO_DIAS.map(d => [d, precioPromo(d, n.id)]))]));

  const ahora = () => Date.now();
  const vigente = f => !!f && new Date(f).getTime() > ahora();
  /** Peso de la promoción de una publicación (0 si no tiene). */
  function pesoPromo(it) {
    if (it.promocionado || vigente(it.destacadoHasta)) return (nivel(it.promoNivel) || PROMO_NIVELES[0]).peso;
    if (it.impulsado || vigente(it.impulsoHasta)) return PROMO_PREMIUM;
    return 0;
  }

  const log01 = (v, max) => (max > 0 ? Math.log1p(Math.max(0, v || 0)) / Math.log1p(max) : 0);
  /** Reseñas → 0..1. Media bayesiana (sin reseñas = 0,5 neutro) y, si votaron, "¿te funcionó?". */
  function puntajeResenas(r) {
    const n = r?.n || 0, prom = r?.promedio || 0;
    const estrellas = ((3 * 3 + n * prom) / (3 + n) - 1) / 4;           // prior: 3 estrellas con peso de 3 reseñas
    const si = r?.si || 0, no = r?.no || 0;
    return si + no ? 0.7 * estrellas + 0.3 * ((si + 1) / (si + no + 2)) : estrellas;
  }

  /** Lo que se compara entre publicaciones (máximos del catálogo). */
  function contexto(items) {
    let likes = 0, seg = 0, sem = 0, tot = 0;
    for (const it of items) {
      likes = Math.max(likes, it.likesCount || 0); seg = Math.max(seg, it.seguidoresAutor || 0);
      sem = Math.max(sem, it.descargasSemana || 0); tot = Math.max(tot, it.descargasEfectivas || 0);
    }
    return { likes, seg, sem, tot };
  }
  const juegoDe = it => String(it.juego || it.extraData?.detectedGame?.gameName || it.extraData?.['juego-base'] || '').toLowerCase().trim();

  /** Señales globales de una publicación (0..1). */
  function globales(it, ctx) {
    const dias = it.createdAt ? (ahora() - new Date(it.createdAt)) / 864e5 : 60;
    return {
      resenas: puntajeResenas(it.resenas),
      guardados: log01(it.likesCount, ctx.likes),
      seguidores: log01(it.seguidoresAutor, ctx.seg),
      // Semana con datos: descargas de 7 días; si aún no hay, el total pesa menos
      elecciones: ctx.sem > 0 ? log01(it.descargasSemana, ctx.sem) : 0.6 * log01(it.descargasEfectivas, ctx.tot),
      novedad: Math.exp(-Math.max(0, dias) / 14),
    };
  }

  /**
   * Perfil del usuario a partir de sus elecciones:
   *   [{ cat, u, g, k: 'v'|'d'|'f', t }]   v = abrió, d = descargó, f = guardó
   *   extraCat: { categoría: peso }        lo que Nexus aprendió en el servidor (con cuenta)
   */
  const PESO_ELECCION = { v: 1, f: 3, d: 4 };
  function perfil(elecciones, extraCat) {
    const cat = {}, u = {}, g = {}, recU = {}, recG = {};
    const mes = ahora() - 30 * 864e5;
    for (const e of elecciones || []) {
      const w = PESO_ELECCION[e.k] || 1;
      if (e.cat) cat[e.cat] = (cat[e.cat] || 0) + w;
      if (e.u) u[e.u] = (u[e.u] || 0) + w;
      if (e.g) g[e.g] = (g[e.g] || 0) + w;
      if ((e.t || 0) > mes) { if (e.u) recU[e.u] = (recU[e.u] || 0) + 1; if (e.g) recG[e.g] = (recG[e.g] || 0) + 1; }
    }
    if (extraCat) {
      const m = Math.max(1, ...Object.values(extraCat));
      for (const [k, v] of Object.entries(extraCat)) if (v > 0) cat[k] = (cat[k] || 0) + 4 * v / m;
    }
    const max = o => Math.max(0, ...Object.values(o));
    return { cat, u, g, recU, recG, mCat: max(cat), mU: max(u), mG: max(g), vacio: !Object.keys(cat).length && !Object.keys(u).length };
  }
  /** Señales personales de una publicación (0..1). */
  function personales(it, pf) {
    const c = String(it.category || '').toLowerCase(), u = String(it.usuario || '').toLowerCase(), j = juegoDe(it);
    const share = (o, k, m) => (k && m > 0 ? (o[k] || 0) / m : 0);
    return {
      // El juego dice más que la categoría ("le gusta Resident Evil" > "le gustan los mods")
      gustos: 0.35 * share(pf.cat, c, pf.mCat) + 0.45 * share(pf.g, j, pf.mG) + 0.20 * share(pf.u, u, pf.mU),
      recurrencia: 0.6 * (j ? 1 - Math.exp(-(pf.recG[j] || 0) / 2) : 0) + 0.4 * (1 - Math.exp(-(pf.recU[u] || 0) / 3)),
    };
  }

  /** Puntaje final 0..1 (con el desglose para explicar "por qué ves esto"). */
  function puntaje(it, ctx, pf) {
    const s = { ...globales(it, ctx), ...(pf && !pf.vacio ? personales(it, pf) : {}) };
    const usar = Object.keys(PESOS).filter(k => k in s);
    const total = usar.reduce((a, k) => a + PESOS[k], 0);
    const organico = usar.reduce((a, k) => a + PESOS[k] * s[k], 0) / total;
    const p = pesoPromo(it);
    return { total: p + (1 - p) * organico, organico, promo: p, senales: s };
  }

  /**
   * Ordena el catálogo. opts: { perfil, yaDescargadas: Set<id> }
   * Variedad: cada aparición extra del mismo creador entre las primeras resta un 8 %.
   */
  function ordenar(items, opts = {}) {
    const ctx = contexto(items), pf = opts.perfil || null, desc = opts.yaDescargadas;
    const conPuntaje = items.map(it => {
      let v = puntaje(it, ctx, pf).total;
      if (desc && desc.has(it._id)) v *= 0.85;   // ya lo descargó: deja sitio a lo nuevo para él
      return { it, v };
    }).sort((a, b) => b.v - a.v);
    const out = [], vistos = {};
    let cola = conPuntaje;
    while (cola.length) {
      let mejor = 0, mv = -1;
      for (let i = 0; i < Math.min(cola.length, 12); i++) {
        const v = cola[i].v * Math.pow(0.92, vistos[cola[i].it.usuario] || 0);
        if (v > mv) { mv = v; mejor = i; }
      }
      const [x] = cola.splice(mejor, 1);
      vistos[x.it.usuario] = (vistos[x.it.usuario] || 0) + 1;
      out.push(x.it);
    }
    return out;
  }

  return { PESOS, PERSONALES, PROMO_NIVELES, PROMO_PREMIUM, PROMO_DIAS, PROMO_UC_DIA, precioPromo, tablaPrecios, pesoPromo,
    puntajeResenas, contexto, globales, perfil, personales, puntaje, ordenar, juegoDe };
});
