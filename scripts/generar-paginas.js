#!/usr/bin/env node
/**
 * Escribe public/p/<slug>-<id>.html para cada publicación aprobada (ver modulos/seo.js)
 * y public/j/<slug>.html para cada juego o tema con varias publicaciones.
 * Lo corre cada hora .github/workflows/sitemap.yml (y el backend al publicar). Borra las páginas de publicaciones
 * que ya no están (eliminadas o rechazadas) para no dejar páginas huérfanas indexadas.
 *
 *   node scripts/generar-paginas.js [archivo.json | URL]
 */
'use strict';
const fs = require('fs'), path = require('path');
const Seo = require('../modulos/seo');

(async () => {
    const fuente = process.argv[2] || 'https://upgames-production.up.railway.app/seo/paginas.json';
    const data = /^https?:/.test(fuente) ? await (await fetch(fuente)).json() : JSON.parse(fs.readFileSync(fuente, 'utf8'));
    if (!data?.success || !Array.isArray(data.items)) throw new Error('Respuesta inválida del backend');
    const dir = process.env.SEO_DIR || path.join(__dirname, '..', 'public', 'p');   // SEO_DIR: carpeta de pruebas
    fs.mkdirSync(dir, { recursive: true });
    const quedan = new Set();
    const validos = data.items.filter(it => /^[a-f\d]{24}$/i.test(it.id) && it.title);
    const grupos = Seo.grupos(validos);
    // Cada publicación enlaza a su juego (o, si no tiene, a su primer tema)
    const grupoDe = new Map();
    for (const g of [...grupos.filter(g => g.juego), ...grupos.filter(g => !g.juego)]) for (const it of g.items) if (!grupoDe.has(it.id)) grupoDe.set(it.id, g);
    for (const it of validos) {
        const f = Seo.archivo(it); quedan.add(f);
        const html = Seo.pagina(it, grupoDe.get(it.id)), ruta = path.join(dir, f);
        if (!fs.existsSync(ruta) || fs.readFileSync(ruta, 'utf8') !== html) fs.writeFileSync(ruta, html);
        // Copia con nombre fijo (<id>.html): es el enlace que se comparte. No depende del título, así que
        // sigue funcionando aunque el autor lo cambie (antes el enlace compartido daba 404). Su canónica es la de arriba.
        // Quien abre el enlace compartido va DIRECTO a la publicación dentro de UpGames. WhatsApp, Telegram y
        // Google no ejecutan scripts: siguen leyendo aquí el título y la imagen para la vista previa.
        const directo = html.replace('</title>', `</title>\n<script>location.replace(${JSON.stringify(`https://upgames.games/public/biblioteca.html?id=${it.id}`)})</script>`);
        const fijo = `${it.id}.html`, rutaFija = path.join(dir, fijo); quedan.add(fijo);
        if (!fs.existsSync(rutaFija) || fs.readFileSync(rutaFija, 'utf8') !== directo) fs.writeFileSync(rutaFija, directo);
    }
    let borradas = 0;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.html') && !quedan.has(f)) { fs.unlinkSync(path.join(dir, f)); borradas++; }
    console.log(`Páginas: ${quedan.size / 2} · borradas: ${borradas}`);

    // Juegos y temas → public/j/<slug>.html
    const dirJ = process.env.SEO_DIR_J || path.join(dir, '..', 'j');
    fs.mkdirSync(dirJ, { recursive: true });
    const quedanJ = new Set();
    for (const g of grupos) {
        const f = `${g.slug}.html`; quedanJ.add(f);
        const html = Seo.paginaGrupo(g, grupos), ruta = path.join(dirJ, f);
        if (!fs.existsSync(ruta) || fs.readFileSync(ruta, 'utf8') !== html) fs.writeFileSync(ruta, html);
    }
    let bj = 0;
    for (const f of fs.readdirSync(dirJ)) if (f.endsWith('.html') && !quedanJ.has(f)) { fs.unlinkSync(path.join(dirJ, f)); bj++; }
    console.log(`Juegos y temas: ${quedanJ.size} · borradas: ${bj}`);

    // Perfiles de creadores → public/u/<usuario>.html
    const fuenteP = process.argv[3] || fuente.replace(/paginas\.json$/, 'perfiles.json');
    let dp = null;
    try { dp = /^https?:/.test(fuenteP) ? await (await fetch(fuenteP)).json() : JSON.parse(fs.readFileSync(fuenteP, 'utf8')); } catch (e) { console.warn('Perfiles: ' + e.message); }
    if (dp?.success && Array.isArray(dp.perfiles)) {
        const dirU = process.env.SEO_DIR_U || path.join(dir, '..', 'u');
        fs.mkdirSync(dirU, { recursive: true });
        const quedanU = new Set();
        for (const p of dp.perfiles) {
            if (!Seo.usuarioValido(p.usuario)) continue;
            const f = `${p.usuario}.html`; quedanU.add(f);
            const html = Seo.paginaPerfil(p), ruta = path.join(dirU, f);
            if (!fs.existsSync(ruta) || fs.readFileSync(ruta, 'utf8') !== html) fs.writeFileSync(ruta, html);
        }
        let bu = 0;
        for (const f of fs.readdirSync(dirU)) if (f.endsWith('.html') && !quedanU.has(f)) { fs.unlinkSync(path.join(dirU, f)); bu++; }
        console.log(`Perfiles: ${quedanU.size} · borrados: ${bu}`);
    }
})().catch(e => { console.error(e.message); process.exit(1); });
