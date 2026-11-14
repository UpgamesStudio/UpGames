/**
 * UpGames Blogs · atribución de descargas.
 *
 * Cuando alguien llega a la página puente desde el botón «Descargar» de una entrada de blog, la descarga
 * (si cuenta para el autor del juego) también paga al dueño del blog: BLOGS_DESCARGA_CPM US$ por 1.000.
 * Sale del margen de la plataforma, no del autor del juego (el autor cobra igual que siempre).
 *
 * Anti-abuso:
 *  · La entrada va firmada dentro del ticket de la página puente (no se puede añadir ni cambiar después).
 *  · Solo paga si la descarga ya fue válida para el autor: ticket, espera, sin bloqueador, tope por IP, sin pago pausado.
 *  · La entrada debe estar publicada, en un blog activo, y contener de verdad el bloque «descarga» de ese juego.
 *  · El dueño del blog no cobra por sus propios juegos (ya cobra como autor) ni estando en lista negra.
 *  · Tope diario por blog (BLOGS_DESCARGAS_MAX_DIA), reclamado de forma atómica.
 */
'use strict';

const CPM = Math.max(0, Math.min(5, parseFloat(process.env.BLOGS_DESCARGA_CPM) || 0.50));            // US$ por 1.000 descargas
const MAX_DIA = Math.max(1, parseInt(process.env.BLOGS_DESCARGAS_MAX_DIA, 10) || 300);              // pagadas por blog y día
const PAGO = CPM / 1000;

const ES_ID = /^[a-f0-9]{24}$/i;

/** La entrada está visible y lleva el bloque «descarga» de ese juego. (Pura: se prueba sin base de datos.) */
function entradaAtribuye(entrada, juegoId, ahora = Date.now()) {
    if (!entrada || entrada.tipo !== 'entrada') return false;
    const visible = entrada.estado === 'publicada' || (entrada.estado === 'programada' && entrada.publicadaEn && new Date(entrada.publicadaEn).getTime() <= ahora);
    if (!visible) return false;
    return (entrada.bloques || []).some(b => b && b.tipo === 'descarga' && String(b.id).toLowerCase() === String(juegoId).toLowerCase());
}

/** → { blog, entrada } | null. Nunca lanza: un `via` falso o roto simplemente no paga. */
async function resolver({ Blog, Entrada }, via, juegoId, autorJuego) {
    try {
        if (!via || !ES_ID.test(String(via)) || !ES_ID.test(String(juegoId))) return null;
        const entrada = await Entrada.findById(via).select('blog tipo estado publicadaEn bloques usuario').lean();
        if (!entradaAtribuye(entrada, juegoId)) return null;
        const blog = await Blog.findById(entrada.blog).select('usuario estado direccion').lean();
        if (!blog || blog.estado !== 'activo' || blog.usuario === autorJuego) return null;
        return { blog, entrada };
    } catch (_) { return null; }
}

/** Reclama un cupo del día del blog (atómico) y, si lo hay, abona al dueño. → US$ pagados (0 si no se pagó). */
async function pagar({ Blog, BlogVista, Usuario }, { blog, entrada }, logger) {
    if (!PAGO) return 0;
    const dueno = await Usuario.findOne({ usuario: blog.usuario }).select('usuario listaNegraAdmin').lean();
    if (!dueno || dueno.listaNegraAdmin) return 0;
    const dia = new Date().toISOString().slice(0, 10);
    try {
        // Con el cupo agotado el filtro no coincide y el upsert choca con el índice único (blog+dia): no se paga
        await BlogVista.updateOne({ blog: blog._id, dia, d: { $lt: MAX_DIA } }, { $inc: { d: 1, gd: PAGO } }, { upsert: true });
    } catch (e) {
        if (e && e.code === 11000) return 0;
        throw e;
    }
    await Promise.all([
        Usuario.updateOne({ usuario: dueno.usuario }, { $inc: { saldo: PAGO } }),
        Blog.updateOne({ _id: blog._id }, { $inc: { descargasGeneradas: 1, ingresosDescargas: PAGO } }),
    ]);
    if (logger) logger.info(`[blogs] descarga atribuida a «${blog.direccion}» (@${dueno.usuario}): +US$${PAGO.toFixed(4)}`);
    return PAGO;
}

module.exports = { resolver, pagar, entradaAtribuye, CPM, MAX_DIA };
