/**
 * UpGames Blogs · modelos
 *
 * Blog       → el sitio de un creador (dirección, tema, ajustes, dominio propio).
 * Entrada    → una entrada o una página fija; el contenido son bloques (JSON), no HTML.
 * BlogVista  → visitas por día de cada blog (para las estadísticas del panel).
 * BlogReporte→ reportes de los visitantes.
 *
 * El campo `usuario` se llama así a propósito: al cambiar de nombre de usuario,
 * rutas/perfil.js actualiza solo todos los modelos que lo tienen.
 */
'use strict';

module.exports = function modelos(mongoose) {
    if (mongoose.models.Blog) return { Blog: mongoose.models.Blog, Entrada: mongoose.models.Entrada, BlogVista: mongoose.models.BlogVista, BlogReporte: mongoose.models.BlogReporte };

    const BlogSchema = new mongoose.Schema({
        usuario:     { type: String, required: true, index: true },
        direccion:   { type: String, required: true, unique: true },   // upgames…/b/<direccion>
        titulo:      { type: String, required: true, maxlength: 140 },
        descripcion: { type: String, default: '', maxlength: 300 },
        tema:        { type: String, default: 'neon' },
        ajustes:     { type: mongoose.Schema.Types.Mixed, default: {} },   // acento, fuente, portada, logo, idioma, gadgets, enlaces
        visibilidad: { type: String, enum: ['publico', 'oculto'], default: 'publico' },   // oculto: solo con el enlace, sin buscadores
        estado:      { type: String, enum: ['activo', 'revision', 'suspendido'], default: 'activo' },
        reportes:    { type: Number, default: 0 },
        sinMarca:    { type: Boolean, default: false },
        // Aceptación expresa de los Términos de UpGames Blogs al crear el blog (prueba de que el creador asumió la responsabilidad)
        terminos:    { version: { type: String, default: '' }, fecha: { type: Date, default: null }, ip: { type: String, default: '' } },   // Premium: sin «Hecho con UpGames»
        vistas:      { type: Number, default: 0 },
        // Monetización opcional: el creador decide si su blog lleva publicidad de UpGames
        monetizar:   { type: Boolean, default: false },
        ingresos:    { type: Number, default: 0 },   // US$ ganados con los anuncios del blog
        anunciosVistos: { type: Number, default: 0 },
        descargasGeneradas: { type: Number, default: 0 },   // descargas pagadas que llegaron desde sus entradas
        ingresosDescargas:  { type: Number, default: 0 },   // US$ ganados por esas descargas
        motivoEstado: { type: String, default: '' },   // nota del equipo al suspender
        dominio: {
            nombre:       { type: String, default: '' },
            token:        { type: String, default: '' },
            verificado:   { type: Boolean, default: false },
            verificadoEn: { type: Date, default: null },
        },
    }, { timestamps: true, minimize: false });
    BlogSchema.index({ 'dominio.nombre': 1 });

    const EntradaSchema = new mongoose.Schema({
        blog:      { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
        usuario:   { type: String, required: true },
        tipo:      { type: String, enum: ['entrada', 'pagina'], default: 'entrada' },
        titulo:    { type: String, required: true, maxlength: 140 },
        slug:      { type: String, required: true },
        bloques:   { type: [mongoose.Schema.Types.Mixed], default: [] },
        etiquetas: { type: [String], default: [] },
        etiquetasSlug: { type: [String], default: [] },
        portada:   { type: String, default: '' },
        resumen:   { type: String, default: '', maxlength: 300 },
        estado:    { type: String, enum: ['borrador', 'publicada', 'programada'], default: 'borrador' },
        publicadaEn: { type: Date, default: null },
        vistas:    { type: Number, default: 0 },
        avisada:   { type: Boolean, default: false },   // ya se avisó a los seguidores del creador
    }, { timestamps: true });
    EntradaSchema.index({ blog: 1, tipo: 1, slug: 1 }, { unique: true });
    EntradaSchema.index({ blog: 1, estado: 1, publicadaEn: -1 });
    EntradaSchema.index({ blog: 1, etiquetasSlug: 1 });

    const BlogVistaSchema = new mongoose.Schema({ blog: { type: mongoose.Schema.Types.ObjectId, required: true }, dia: { type: String, required: true }, n: { type: Number, default: 0 }, a: { type: Number, default: 0 }, g: { type: Number, default: 0 }, d: { type: Number, default: 0 }, gd: { type: Number, default: 0 } });   // n visitas · a anuncios vistos · g ganancia US$ · d descargas atribuidas · gd ganancia US$ por ellas
    BlogVistaSchema.index({ blog: 1, dia: 1 }, { unique: true });

    const BlogReporteSchema = new mongoose.Schema({ blog: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, motivo: String, detalle: String, ip: String }, { timestamps: true });

    return {
        Blog: mongoose.model('Blog', BlogSchema),
        Entrada: mongoose.model('Entrada', EntradaSchema),
        BlogVista: mongoose.model('BlogVista', BlogVistaSchema),
        BlogReporte: mongoose.model('BlogReporte', BlogReporteSchema),
    };
};
