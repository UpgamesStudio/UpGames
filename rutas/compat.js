/**
 * Compatibilidad real por dispositivo: "funcionó en mi Snapdragon 8 Gen 2 a 45 FPS".
 *
 * Quien probó una publicación reporta cómo le fue en SU equipo. El navegador detecta la
 * GPU, el modelo, la RAM aproximada y el sistema; el usuario confirma el procesador,
 * el resultado, los FPS y con qué lo ejecutó (nativo, Winlator, GameHub, emulador…).
 * La ficha muestra el resumen por gama y, sobre todo, lo que reportaron equipos como el tuyo.
 *
 *   GET    /items/:id/compat?gpu=&so=    resumen + "tu equipo" + últimos reportes (público)
 *   POST   /items/:id/compat             { dispositivo, chip, resultado, fps, app, nota }  (con cuenta)
 *   DELETE /items/:id/compat             borrar mi reporte
 */
'use strict';

const mongoose = require('mongoose');
const { dispositivo: limpiarDispositivo, gamaGPU } = require('../modulos/nexus/compatibilidad');

const RESULTADOS = ['funciona', 'ajustes', 'no'];
const APPS = ['nativo', 'winlator', 'gamehub', 'mobox', 'emulador', 'pc', 'otro'];
const GAMA_NOMBRE = { 4: 'Gama tope', 3: 'Gama alta', 2: 'Gama media', 1: 'Gama baja' };
const txt = (v, n) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Adreno (TM) 740" → "Adreno 740"; "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11…)" → "GeForce RTX 3060" */
function familiaGPU(gpu) {
  const g = String(gpu || '');
  let m;
  if ((m = g.match(/adreno[^0-9]*(\d{3}[a-z]?)/i))) return `Adreno ${m[1]}`;
  if ((m = g.match(/(immortalis|mali)[\s-]*(g\d{2,3})/i))) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}-${m[2].toUpperCase()}`;
  if ((m = g.match(/xclipse\s*(\d{3})/i))) return `Xclipse ${m[1]}`;
  if ((m = g.match(/powervr[^,)]*/i))) return m[0].trim().slice(0, 30);
  if ((m = g.match(/(geforce\s+(?:rtx|gtx|mx)?\s*\d{3,4}\s*(?:ti|super)?)/i))) return m[1].replace(/\s+/g, ' ').trim();
  if ((m = g.match(/(radeon\s+(?:rx\s*)?[\w ]{2,12}?)(?:\s+graphics|\s*\(|,|$)/i))) return m[1].trim();
  if (/intel/i.test(g) && (m = g.match(/(iris xe|iris|uhd|hd|arc)\s*(?:graphics)?\s*([a-z]?\d{2,4}[a-z]?)?/i))) return `Intel ${m[1]}${m[2] ? ' ' + m[2] : ''}`.replace(/\s+/g, ' ');
  if (/apple (gpu|m\d)/i.test(g)) return (g.match(/apple m\d\s*\w*/i) || ['Apple GPU'])[0];
  return txt(g, 40);
}
/** Procesador probable a partir de la GPU (el usuario lo puede corregir). */
const SOC = [
  [/adreno 830/i, 'Snapdragon 8 Elite'], [/adreno 750/i, 'Snapdragon 8 Gen 3'], [/adreno 740/i, 'Snapdragon 8 Gen 2'], [/adreno 735/i, 'Snapdragon 8s Gen 3'],
  [/adreno 730/i, 'Snapdragon 8 Gen 1 / 8+ Gen 1'], [/adreno 725/i, 'Snapdragon 7+ Gen 2'], [/adreno 720/i, 'Snapdragon 7 Gen 3'], [/adreno 710/i, 'Snapdragon 7 Gen 1 / 7s Gen 2'],
  [/adreno 660/i, 'Snapdragon 888'], [/adreno 650/i, 'Snapdragon 865 / 870'], [/adreno 644/i, 'Snapdragon 7 Gen 1'], [/adreno 642/i, 'Snapdragon 778G / 780G'],
  [/adreno 640/i, 'Snapdragon 855 / 860'], [/adreno 630/i, 'Snapdragon 845'], [/adreno 620/i, 'Snapdragon 765G / 750G'], [/adreno 619/i, 'Snapdragon 695 / 480'],
  [/adreno 618/i, 'Snapdragon 720G / 730G / 732G'], [/adreno 616/i, 'Snapdragon 710 / 712'], [/adreno 61[0-3]/i, 'Snapdragon 6xx (gama de entrada)'],
  [/immortalis-g925/i, 'Dimensity 9400'], [/immortalis-g720/i, 'Dimensity 9300'], [/immortalis-g715/i, 'Dimensity 9200'], [/mali-g710/i, 'Dimensity 9000 / Tensor G2'],
  [/mali-g78/i, 'Exynos 2100 / Tensor G1 / Kirin 9000'], [/mali-g77/i, 'Dimensity 1000–1200 / Exynos 990'], [/mali-g68/i, 'Dimensity 900 / 1080 / Exynos 1280'],
  [/mali-g615/i, 'Dimensity 7200 / 8300'], [/mali-g610/i, 'Dimensity 8100 / 8200'], [/mali-g57/i, 'Dimensity 700 / 6020 / Helio G99'], [/mali-g52/i, 'Helio G85 / G88 / G96'],
  [/xclipse 9[45]0/i, 'Exynos 2400'], [/xclipse 920/i, 'Exynos 2200'],
];
const socDe = gpu => (SOC.find(([r]) => r.test(gpu)) || [])[1] || '';
const mediana = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

function registrar(app, { verificarToken, Juego, Moderacion, Limites, logger }) {
  const Compat = mongoose.models.Compat || mongoose.model('Compat', new mongoose.Schema({
    itemId: { type: String, required: true },
    usuario: { type: String, required: true },
    so: String, gpu: String, familia: String, chip: String, modelo: String, ramGB: Number, gama: Number,
    resultado: { type: String, enum: RESULTADOS, required: true },
    fps: { type: Number, default: null }, app: { type: String, default: 'otro' }, nota: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
  }, { collection: 'compat', versionKey: false }).index({ itemId: 1, usuario: 1 }, { unique: true }).index({ itemId: 1, familia: 1 }));

  // Resumen guardado en la publicación (para mostrar "✓ funciona en 9 de 12 equipos" sin otra consulta)
  async function guardarResumen(itemId) {
    const l = await Compat.find({ itemId }).select('resultado fps').lean();
    const si = l.filter(x => x.resultado === 'funciona').length, aj = l.filter(x => x.resultado === 'ajustes').length;
    await Juego.updateOne({ _id: itemId }, { $set: { compat: { n: l.length, si, aj, no: l.length - si - aj, fps: mediana(l.map(x => x.fps).filter(Boolean)) } } }, { timestamps: false }).catch(() => {});
  }

  app.get('/items/:id/compat', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false });
      const l = await Compat.find({ itemId: req.params.id }).sort({ fecha: -1 }).limit(500).lean();
      const resumen = (arr) => ({
        n: arr.length, funciona: arr.filter(x => x.resultado === 'funciona').length, ajustes: arr.filter(x => x.resultado === 'ajustes').length,
        no: arr.filter(x => x.resultado === 'no').length, fps: mediana(arr.map(x => x.fps).filter(Boolean)),
      });
      const porGama = [4, 3, 2, 1].map(g => ({ gama: g, nombre: GAMA_NOMBRE[g], ...resumen(l.filter(x => x.gama === g)) })).filter(x => x.n);
      // Equipos más reportados
      const fam = new Map();
      for (const x of l) { const k = x.chip || x.familia || 'Equipo sin identificar'; if (!fam.has(k)) fam.set(k, []); fam.get(k).push(x); }
      const equipos = [...fam].map(([equipo, arr]) => ({ equipo, gpu: arr[0].familia, ...resumen(arr) })).sort((a, b) => b.n - a.n).slice(0, 8);
      // Tu equipo: misma GPU o, si no hay, misma gama
      let tuyo = null;
      const gpu = String(req.query.gpu || '').slice(0, 120);
      if (gpu) {
        const f = familiaGPU(gpu), g = gamaGPU(gpu);
        const misma = l.filter(x => x.familia && norm(x.familia) === norm(f));
        const parecida = misma.length ? misma : l.filter(x => g && x.gama === g);
        tuyo = { familia: f, chip: socDe(f), gama: g, nombreGama: GAMA_NOMBRE[g] || null, exacto: misma.length > 0, ...resumen(parecida) };
      }
      res.set('Cache-Control', 'public, max-age=60').json({
        success: true, total: resumen(l), porGama, equipos, tuyo,
        recientes: l.slice(0, 12).map(x => ({ equipo: x.chip || x.familia || x.modelo || 'Equipo', modelo: x.modelo, so: x.so, ram: x.ramGB, resultado: x.resultado, fps: x.fps, app: x.app, nota: x.nota, fecha: x.fecha })),
      });
    } catch (e) { logger?.error?.(`[compat] ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo cargar la compatibilidad' }); }
  });

  // Sugerencia del procesador según la GPU que detecta el navegador
  app.get('/compat/equipo', (req, res) => {
    const gpu = String(req.query.gpu || '').slice(0, 120), f = familiaGPU(gpu);
    res.json({ success: true, familia: f, chip: socDe(f), gama: gamaGPU(gpu), nombreGama: GAMA_NOMBRE[gamaGPU(gpu)] || null });
  });

  app.post('/items/:id/compat', verificarToken, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Publicación no válida' });
      if (!(await Limites.permitir(`compat:${req.usuario}`, [[Limites.MIN, 6], [Limites.DIA, 60]]))) return res.status(429).json({ success: false, error: 'Espera un momento' });
      const b = req.body || {};
      if (!RESULTADOS.includes(b.resultado)) return res.status(400).json({ success: false, error: 'Elige cómo te funcionó' });
      const it = await Juego.findById(req.params.id).select('_id category status').lean();
      if (!it || it.status !== 'aprobado' || it.category === 'Video') return res.status(404).json({ success: false, error: 'Publicación no disponible' });
      const d = limpiarDispositivo(b.dispositivo || {});
      const nota = txt(b.nota, 300);
      if (nota) { const mod = Moderacion.reglas(nota, 'comentario'); if (mod.bloquear) return res.status(400).json({ success: false, error: 'La nota no cumple las normas' }); }
      const fps = Number(b.fps); const familia = familiaGPU(d.gpu);
      const doc = {
        so: d.so, gpu: d.gpu, familia, modelo: d.modelo, ramGB: d.ramGB, gama: gamaGPU(d.gpu),
        chip: txt(b.chip, 40) || socDe(familia), resultado: b.resultado,
        fps: Number.isFinite(fps) && fps > 0 && fps <= 240 ? Math.round(fps) : null,
        app: APPS.includes(b.app) ? b.app : 'otro', nota, fecha: new Date(),
      };
      await Compat.updateOne({ itemId: String(it._id), usuario: req.usuario }, { $set: doc }, { upsert: true });
      await guardarResumen(String(it._id));
      res.json({ success: true });
    } catch (e) { logger?.error?.(`[compat] ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo guardar tu reporte' }); }
  });

  app.delete('/items/:id/compat', verificarToken, async (req, res) => {
    try {
      await Compat.deleteOne({ itemId: String(req.params.id), usuario: req.usuario });
      await guardarResumen(String(req.params.id));
      res.json({ success: true });
    } catch (_) { res.status(500).json({ success: false }); }
  });

  return { Compat };
}

module.exports = { registrar, familiaGPU, socDe };
