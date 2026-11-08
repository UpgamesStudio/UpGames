/**
 * Texto que escriben los usuarios (títulos y descripciones) tal como se MUESTRA
 * en la web. La palabra «ROM/ROMs» no aparece en ningún lado de UpGames: se
 * muestra «versión/versiones» respetando mayúsculas.
 *
 * Solo cambia lo que se muestra (listados públicos y páginas /p/): lo guardado
 * queda igual, así la revisión anti-piratería (modulos/revisionIA.js) sigue
 * viendo el texto original y manda esas publicaciones a revisión humana.
 */
'use strict';

const PALABRA = /\b([Rr])([Oo])([Mm])([Ss])?\b/g;

function sinPalabrasVetadas(s) {
    if (typeof s !== 'string' || !/\brom/i.test(s)) return s;
    return s.replace(PALABRA, (m, r, o, mm, plural) => {
        const base = plural ? 'versiones' : 'versión';
        if ((r + o + mm) === 'ROM') return base.toUpperCase();   // «ROM», «ROMS», «ROMs»
        if (r === 'R') return base[0].toUpperCase() + base.slice(1);
        return base;
    });
}

const CAMPOS = ['title', 'titulo', 'description', 'descripcion', 'desc', 'subtitulo'];

/** Copia del objeto de publicación con sus textos visibles filtrados */
function filtrarPublicacion(o) {
    if (!o || typeof o !== 'object') return o;
    let out = o;
    for (const k of CAMPOS) {
        if (typeof o[k] === 'string') {
            const v = sinPalabrasVetadas(o[k]);
            if (v !== o[k]) { if (out === o) out = { ...o }; out[k] = v; }
        }
    }
    return out;
}

module.exports = { sinPalabrasVetadas, filtrarPublicacion };
