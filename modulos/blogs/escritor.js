/**
 * UpGames Blogs · Nexus escritor
 *
 * «Escríbeme una reseña de este juego»: Nexus recibe los datos de la publicación y devuelve el
 * borrador de una entrada ya armada con bloques (no HTML). Lo que devuelve el modelo NUNCA se
 * guarda tal cual: pasa por V.limpiarBloques, igual que lo que escribe una persona.
 * Sin red ni base de datos: la ruta (rutas/blogs.js) le pasa la publicación y la respuesta del modelo.
 */
'use strict';
const V = require('./validar');

const TIPOS = {
    resena: 'una RESEÑA personal: qué es, lo mejor, lo peor, ficha técnica y una nota final',
    guia: 'una GUÍA de instalación paso a paso: requisitos, pasos numerados, avisos y preguntas frecuentes',
    noticia: 'una NOTICIA breve: titular, lo más importante y por qué le interesa a la comunidad',
};

const SISTEMA = `Eres Nexus, el asistente de escritura de UpGames Blogs. Escribes borradores en español para blogs de videojuegos, mods y apps.
Devuelves SOLO un objeto JSON con esta forma:
{"titulo":"…","resumen":"1-2 frases","etiquetas":["…"],"bloques":[…]}
Cada bloque es UNO de estos (sin HTML; en los textos se permite **negrita**, *cursiva*, listas con "- " y numeradas con "1. "):
{"tipo":"texto","texto":"…","grande":true|false}  ·  {"tipo":"titulo","texto":"…"}  ·  {"tipo":"aviso","estilo":"info|exito|alerta|peligro","texto":"…"}
{"tipo":"ficha","titulo":"…","filas":[{"k":"Género","v":"…"}]}  ·  {"tipo":"faq","items":[{"p":"pregunta","r":"respuesta"}]}  ·  {"tipo":"cita","texto":"…","autor":"…"}
Reglas:
- Usa SOLO los datos que te dan. NO inventes cifras, versiones, notas de prensa, requisitos ni funciones. Si algo falta, escribe una frase corta entre [corchetes] para que el creador la complete con su experiencia (p. ej. "[Cuenta aquí cómo corrió en tu equipo]").
- Entre 7 y 12 bloques. Empieza con un texto de introducción (grande:true). Títulos cortos. Tono cercano, sin exagerar ni vender.
- Nada de enlaces, ni de links de descarga, ni de contenido sexual, de odio o ilegal.
- El título tiene máximo 90 caracteres; las etiquetas, máximo 5.`;

/** Mensaje de usuario con los datos de la publicación (recortados: el modelo no necesita más). */
function pedido(j, tipo, nota) {
    const ex = j.extraData && typeof j.extraData === 'object' ? Object.fromEntries(Object.entries(j.extraData).filter(([k, v]) => k !== 'detectedGame' && typeof v !== 'object' && String(v).length < 120).slice(0, 12)) : {};
    return `Escribe ${TIPOS[tipo] || TIPOS.resena}.
Publicación de UpGames:
- Nombre: ${String(j.title || '').slice(0, 140)}
- Categoría: ${String(j.category || '—').slice(0, 40)}
- Etiquetas: ${(j.tags || []).slice(0, 10).join(', ') || '—'}
- Descripción del creador: ${String(j.description || '—').slice(0, 1500)}
- Otros datos: ${JSON.stringify(ex).slice(0, 600)}
${nota ? `- Enfoque pedido por quien escribe: ${String(nota).slice(0, 200)}` : ''}`;
}

/**
 * Convierte la respuesta del modelo en una entrada válida o devuelve null si no sirve.
 * Agrega por código lo que no se le deja al modelo: la imagen y la tarjeta de la publicación.
 */
function armar(o, j, tipo) {
    if (!o || typeof o !== 'object') return null;
    let bloques = V.limpiarBloques(o.bloques).filter(b => !['juego', 'descarga', 'imagen', 'boton', 'galeria', 'video', 'audio', 'codigo'].includes(b.tipo));
    if (bloques.length < 3) return null;
    const imagen = V.urlSegura(j.image);
    const extra = [];
    if (imagen) extra.push({ tipo: 'imagen', url: imagen, alt: V.linea(j.title, 120), pie: '' });
    extra.push({ tipo: 'juego', id: String(j._id) });
    bloques = [bloques[0], ...extra, ...bloques.slice(1)];
    if (tipo === 'guia') bloques.push({ tipo: 'descarga', id: String(j._id) });   // la descarga pasa por la página puente
    return {
        titulo: V.linea(o.titulo, 90) || V.linea(j.title, 90),
        resumen: V.linea(o.resumen, 300),
        etiquetas: V.etiquetas(o.etiquetas).slice(0, 5),
        bloques: bloques.slice(0, V.LIMITES.BLOQUES_POR_ENTRADA),
    };
}

module.exports = { SISTEMA, TIPOS, pedido, armar };
