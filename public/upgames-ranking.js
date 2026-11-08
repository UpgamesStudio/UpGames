/* ═══════════════════════════════════════════════════════════════
   UpGames · Cómo ordena Nexus el feed (una sola fórmula para el
   servidor y la web: index.js la usa con require(), el navegador
   como window.UGRank).

   PUNTAJE = P + (1 − P) × ORGÁNICO              (todo entre 0 y 1)

   P  = peso de la PROMOCIÓN pagada con UpCoins (0 si no tiene). Crece con
        las UpCoins por día que invierte el creador: 50 UC/día = 30 %,
        cada vez que se duplica la inversión suma 12 puntos, hasta 85 %
        (Plus ≈ 42 %, Máx ≈ 52 %, 1.000 UC/día ≈ 82 %, más ≈ 85 %).
        SEGMENTADA POR GUSTOS: con quien ya eligió contenido parecido
        (mismo juego o género, p. ej. carreras) la promoción pesa completa;
        con el resto pesa un 35 %. Sin historial (aún no sabemos qué le
        gusta), un 90 %.
        Premium del autor: 10 %.

   ORGÁNICO (suma 100 %):
     30 %  Reseñas ............ estrellas (media bayesiana) + "¿te funcionó?"
     20 %  Gustos del usuario . categorías, juegos, géneros y creadores que mira,
                                descarga y guarda (en su teléfono y, con
                                cuenta, lo que Nexus aprendió de él)
     15 %  Guardados .......... favoritos de la publicación
     10 %  Recurrencia ........ cuánto vuelve el usuario a ese creador/juego
     10 %  Seguidores ......... seguidores del creador
     10 %  Elecciones ......... con qué frecuencia la eligen todos esta
                                semana (descargas de 7 días)
      5 %  Novedad ............ lo reciente sube un poco

   VIDEOS (feed vertical) — ORGÁNICO:
     25 % gustos · 20 % me gusta · 15 % guardados · 15 % vistas de la
     semana · 10 % recurrencia · 10 % seguidores · 5 % novedad

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
  const PESOS_VIDEO = { gustos: 0.25, megusta: 0.20, guardados: 0.15, elecciones: 0.15, recurrencia: 0.10, seguidores: 0.10, novedad: 0.05 };
  const esVideo = it => it.category === 'Video';

  // Géneros: para segmentar promociones y gustos más allá del juego exacto
  // ("le gustan los juegos de carros" → también le interesa otro juego de carros)
  const GENEROS = {
    carreras: /\b(carreras?|racing|race|carros?|autos?|coches?|drift|rally|f1|formula\s?1?|need for speed|nfs\w*|grid|forza|gran turismo|gt\d?|asphalt|real racing|velocita|apex gp|motos?|moto ?gp|karts?)\b/i,
    terror: /\b(terror|horror|miedo|zombies?|resident evil|silent hill|silencio hill|outlast|dead space|evil within|alien|fnaf|five nights)\b/i,
    disparos: /\b(shooter|disparos|call of duty|cod|black ?ops|halo|battlefield|counter.?strike|cs2?|valorant|free fire|pubg|fortnite|doom|far cry|deadpool)\b/i,
    mundoAbierto: /\b(mundo abierto|open world|gta|grand theft|red dead|watch dogs|saints row|mafia|just cause|cyberpunk)\b/i,
    rpg: /\b(rpg|rol|souls|elden ring|dark souls|witcher|skyrim|fallout|final fantasy|zelda|diablo|bloodborne|sekiro)\b/i,
    supervivencia: /\b(supervivencia|survival|zomboid|ark|pixark|minecraft|rust|dayz|the forest|subnautica|i.?m alive)\b/i,
    lucha: /\b(lucha|pelea|fighting|mortal kombat|mk\s?\d*|tekken|street fighter|dragon ball|naruto|injustice|smash)\b/i,
    deportes: /\b(deportes?|futbol|fútbol|fifa|fc ?2\d|pes|efootball|nba|nfl|tenis|boxeo|ufc)\b/i,
    plataformas: /\b(plataformas|metroidvania|hollow knight|silksong|celeste|mario|sonic|cuphead|ori)\b/i,
    estrategia: /\b(estrategia|strategy|rts|age of empires|civilization|clash|total war|xcom)\b/i,
    emulacion: /\b(emulador|emulaci[oó]n|winlator|gamehub|ps2|psp|ps3|switch|yuzu|ryujinx|aethersx2|pcsx2|dolphin)\b/i,
  };
  function generos(it) {
    if (it._gen) return it._gen;
    const t = `${it.title || ''} ${it.description || ''} ${(it.tags || []).join(' ')} ${it.juego || ''} ${it.videoType || ''} ${it.extraData?.['juego-base'] || ''}`;
    const g = Object.keys(GENEROS).filter(k => GENEROS[k].test(t));
    try { Object.defineProperty(it, '_gen', { value: g, enumerable: false, configurable: true }); } catch (_) {}
    return g;
  }
  const PERSONALES = ['gustos', 'recurrencia'];

  // Promoción con UpCoins: duración a elegir y nivel (más UpCoins = más peso)
  const PROMO_NIVELES = [   // el peso se calcula con pesoDeUCDia (≈ 30 %, 42 %, 52 %)
    { id: 'estandar', nombre: 'Estándar', mult: 1 },
    { id: 'plus',     nombre: 'Plus',     mult: 2 },
    { id: 'max',      nombre: 'Máx',      mult: 3.5 },
  ];
  const PROMO_PREMIUM = 0.10;            // autores con Premium activo
  const PROMO_DIAS = [1, 3, 7, 14, 30];
  const PROMO_UC_DIA = 50;               // 1 día Estándar = 50 UpCoins (como antes)
  const PROMO_DESCUENTO = { 1: 1, 3: 0.9, 7: 0.8, 14: 0.72, 30: 0.65 };   // más días, más barato por día
  const nivel = id => PROMO_NIVELES.find(n => n.id === id) || null;
  const PROMO_PESO_MIN = 0.30, PROMO_PESO_MAX = 0.85, PROMO_PASO = 0.12;   // +12 puntos cada vez que se duplica la inversión
  const PROMO_MONTO_MAX = 100000000;
  /** Peso de la promoción según las UpCoins por día (equivalentes, sin el descuento por días). */
  const pesoDeUCDia = uc => (uc > 0 ? Math.min(PROMO_PESO_MAX, Math.max(PROMO_PESO_MIN, PROMO_PESO_MIN + PROMO_PASO * Math.log2(uc / PROMO_UC_DIA))) : 0);
  /** UpCoins por día equivalentes de un pago (sin el descuento por comprar muchos días). */
  const ucDiaEquivalente = (monto, dias) => (PROMO_DESCUENTO[dias] ? monto / (dias * PROMO_DESCUENTO[dias]) : 0);
  const nivelDeUCDia = uc => (uc >= 160 ? 'max' : uc >= 90 ? 'plus' : 'estandar');
  /** Inversión libre: válida si alcanza al menos el precio Estándar de esos días. */
  function montoPromoValido(dias, monto) {
    const min = precioPromo(dias, 'estandar'), m = Math.floor(Number(monto));
    return min && Number.isFinite(m) && m >= min && m <= PROMO_MONTO_MAX ? m : null;
  }
  PROMO_NIVELES.forEach(n => { n.peso = Math.round(pesoDeUCDia(PROMO_UC_DIA * n.mult) * 100) / 100; });
  /** UpCoins de una promoción (redondeado a múltiplos de 5). null si la combinación no existe. */
  function precioPromo(dias, nivelId) {
    const n = nivel(nivelId), d = Number(dias);
    if (!n || !PROMO_DESCUENTO[d]) return null;
    return Math.max(5, Math.round(PROMO_UC_DIA * d * PROMO_DESCUENTO[d] * n.mult / 5) * 5);
  }
  const tablaPrecios = () => Object.fromEntries(PROMO_NIVELES.map(n => [n.id, Object.fromEntries(PROMO_DIAS.map(d => [d, precioPromo(d, n.id)]))]));

  const ahora = () => Date.now();
  const vigente = f => !!f && new Date(f).getTime() > ahora();
  /** Peso de la promoción de una publicación (0 si no tiene), antes de segmentar por gustos. */
  function pesoPromo(it) {
    if (it.promocionado || vigente(it.destacadoHasta))
      return pesoDeUCDia(it.promoUCDia > 0 ? it.promoUCDia : PROMO_UC_DIA * (nivel(it.promoNivel) || PROMO_NIVELES[0]).mult);
    if (it.impulsado || vigente(it.impulsoHasta)) return PROMO_PREMIUM;
    return 0;
  }
  /** Cuánto le interesa a este usuario el tipo de contenido (0..1): juego, género y categoría. */
  function afinidad(it, pf) {
    if (!pf || pf.vacio) return null;
    const j = juegoDe(it), gs = generos(it), c = String(it.category || '').toLowerCase();
    const sj = j && pf.mG > 0 ? (pf.g[j] || 0) / pf.mG : 0;
    const sg = pf.mGen > 0 ? Math.max(0, ...gs.map(x => (pf.gen[x] || 0) / pf.mGen)) : 0;
    const sc = c && pf.mCat > 0 ? (pf.cat[c] || 0) / pf.mCat : 0;
    return Math.min(1, Math.max(sj, sg, 0.2 * sc));   // la categoría sola ("los dos son mods") dice poco
  }
  /** La promoción pesa completa con quien tiene gustos afines, 35 % con el resto, 90 % sin historial. */
  function factorSegmento(it, pf) { const a = afinidad(it, pf); return a === null ? 0.9 : 0.35 + 0.65 * a; }

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
    let likes = 0, seg = 0, sem = 0, tot = 0, mg = 0, vsem = 0, vtot = 0;
    for (const it of items) {
      likes = Math.max(likes, it.likesCount || 0); seg = Math.max(seg, it.seguidoresAutor || 0);
      sem = Math.max(sem, it.descargasSemana || 0); tot = Math.max(tot, it.descargasEfectivas || 0);
      mg = Math.max(mg, it.meGustaCount || 0); vsem = Math.max(vsem, it.vistasSemana || 0);
      vtot = Math.max(vtot, (it.vistas || 0) + (esVideo(it) ? it.descargasEfectivas || 0 : 0));
    }
    return { likes, seg, sem, tot, mg, vsem, vtot };
  }
  const juegoDe = it => String(it.juego || it.extraData?.detectedGame?.gameName || it.extraData?.['juego-base'] || '').toLowerCase().trim();

  /** Señales globales de una publicación (0..1). */
  function globales(it, ctx) {
    const dias = it.createdAt ? (ahora() - new Date(it.createdAt)) / 864e5 : 60;
    if (esVideo(it)) return {
      megusta: log01(it.meGustaCount, ctx.mg),
      guardados: log01(it.likesCount, ctx.likes),
      seguidores: log01(it.seguidoresAutor, ctx.seg),
      // Elecciones de un video = vistas de la semana (si aún no hay, el total pesa menos)
      elecciones: ctx.vsem > 0 ? log01(it.vistasSemana, ctx.vsem) : 0.6 * log01((it.vistas || 0) + (it.descargasEfectivas || 0), ctx.vtot),
      novedad: Math.exp(-Math.max(0, dias) / 10),
    };
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
   *   [{ cat, u, g, gs, k: 'v'|'l'|'d'|'f', t }]   v = abrió, l = me gusta, d = descargó, f = guardó
   *   extraCat: { categoría: peso }        lo que Nexus aprendió en el servidor (con cuenta)
   */
  const PESO_ELECCION = { v: 1, l: 2, f: 3, d: 4 };   // abrió, me gusta, guardó, descargó
  function perfil(elecciones, extraCat) {
    const cat = {}, u = {}, g = {}, gen = {}, recU = {}, recG = {};
    const mes = ahora() - 30 * 864e5;
    for (const e of elecciones || []) {
      const w = PESO_ELECCION[e.k] || 1;
      if (e.cat) cat[e.cat] = (cat[e.cat] || 0) + w;
      if (e.u) u[e.u] = (u[e.u] || 0) + w;
      if (e.g) g[e.g] = (g[e.g] || 0) + w;
      for (const x of e.gs || []) gen[x] = (gen[x] || 0) + w;
      if ((e.t || 0) > mes) { if (e.u) recU[e.u] = (recU[e.u] || 0) + 1; if (e.g) recG[e.g] = (recG[e.g] || 0) + 1; }
    }
    if (extraCat) {
      const m = Math.max(1, ...Object.values(extraCat));
      for (const [k, v] of Object.entries(extraCat)) if (v > 0) cat[k] = (cat[k] || 0) + 4 * v / m;
    }
    const max = o => Math.max(0, ...Object.values(o));
    return { cat, u, g, gen, recU, recG, mCat: max(cat), mU: max(u), mG: max(g), mGen: max(gen), vacio: !Object.keys(cat).length && !Object.keys(u).length };
  }
  /** Señales personales de una publicación (0..1). */
  function personales(it, pf) {
    const c = String(it.category || '').toLowerCase(), u = String(it.usuario || '').toLowerCase(), j = juegoDe(it);
    const share = (o, k, m) => (k && m > 0 ? (o[k] || 0) / m : 0);
    return {
      // El juego dice más que la categoría ("le gusta Resident Evil" > "le gustan los mods")
      gustos: 0.30 * share(pf.cat, c, pf.mCat) + 0.30 * share(pf.g, j, pf.mG) + 0.25 * Math.max(0, ...generos(it).map(x => share(pf.gen, x, pf.mGen))) + 0.15 * share(pf.u, u, pf.mU),
      recurrencia: 0.6 * (j ? 1 - Math.exp(-(pf.recG[j] || 0) / 2) : 0) + 0.4 * (1 - Math.exp(-(pf.recU[u] || 0) / 3)),
    };
  }

  /** Puntaje final 0..1 (con el desglose para explicar "por qué ves esto"). */
  function puntaje(it, ctx, pf) {
    const s = { ...globales(it, ctx), ...(pf && !pf.vacio ? personales(it, pf) : {}) };
    const W = esVideo(it) ? PESOS_VIDEO : PESOS;
    const usar = Object.keys(W).filter(k => k in s);
    const total = usar.reduce((a, k) => a + W[k], 0);
    const organico = usar.reduce((a, k) => a + W[k] * s[k], 0) / total;
    const p = pesoPromo(it) * factorSegmento(it, pf);   // segmentada por gustos
    return { total: p + (1 - p) * organico, organico, promo: p, senales: s };
  }

  /**
   * Ordena el catálogo. opts: { perfil, yaDescargadas: Set<id>, azar: 0..1 (feed de videos: algo de sorpresa) }
   * Variedad: cada aparición extra del mismo creador entre las primeras resta un 8 %.
   */
  function ordenar(items, opts = {}) {
    const ctx = contexto(items), pf = opts.perfil || null, desc = opts.yaDescargadas;
    const conPuntaje = items.map(it => {
      let v = puntaje(it, ctx, pf).total;
      if (opts.azar) v *= 1 - opts.azar / 2 + opts.azar * Math.random();
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

  return { PESOS, PESOS_VIDEO, PERSONALES, PROMO_NIVELES, PROMO_PREMIUM, PROMO_DIAS, PROMO_UC_DIA, PROMO_PESO_MAX, PROMO_MONTO_MAX,
    precioPromo, tablaPrecios, pesoPromo, pesoDeUCDia, ucDiaEquivalente, nivelDeUCDia, montoPromoValido, afinidad, factorSegmento,
    puntajeResenas, contexto, globales, perfil, personales, puntaje, ordenar, juegoDe, generos, GENEROS };
});
