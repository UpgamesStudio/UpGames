/**
 * Posible juego comercial completo (no un mod).
 *
 * Una publicación con el nombre de un juego comercial conocido (gameDetector) que además
 * NO parece un mod —se publica como "Juego", está dividida en partes o el título es el
 * nombre del juego sin decir qué cambia— se publica igual, pero:
 *   • no genera UpCoins ni pagos al creador mientras el equipo la verifica (pagoPausado),
 *   • la página puente sigue mostrando sus anuncios,
 *   • el creador recibe un aviso explicando por qué.
 * Así UpGames no obtiene un beneficio directo de algo que podría ser un juego completo.
 */
'use strict';

const gameDetector = require('./gameDetector');
const series = require('./series');

// Palabras que dicen que es un mod, ajuste o herramienta (y no el juego en sí)
const MOD = /\b(mods?|modded|parches?|patch(es)?|config\w*|ajustes?|optimiz\w*|rendimiento|fps|trainer|save(game)?|partida guardada|guia|tutorial|shaders?|reshade|texturas?|traduccion|doblaje|fix(es)?|launcher|herramientas?|tools?|skins?|graficos|mejoras?|preset|cleo|script|mapa|map|addon|plugin|expansion fan)\b/i;
// Palabras de edición que no cambian el juego ("GTA IV Complete Edition" sigue siendo GTA IV)
const EDICION = /\b(edition|edicion|remake|remastered|remasterizado|complete|completo|goty|definitive|definitiva|deluxe|ultimate|gold|full|pc|android|mobile|movil|portable|port|apk|obb|lite|repack|prepare to die|director'?s cut|enhanced|collection|coleccion|\d{4}|v?\d+(\.\d+)*)\b/gi;

const norm = t => gameDetector.normalizar(t || '');

// Juegos comerciales que gameDetector no tiene (no llevan enlace de compra: solo sirven para
// esta revisión). Incluye variantes usadas para disimular el nombre ("silencio hill").
const COMERCIALES = {
  'GTA IV': ['gta iv', 'gta 4', 'grand theft auto iv', 'grand theft auto 4'],
  'GTA III / Vice City': ['gta iii', 'gta 3', 'gta vice city', 'vice city'],
  'Mortal Kombat': ['mortal kombat', 'mk9', 'mk 9', 'mk10', 'mkx', 'mk11', 'mk 11', 'mk1'],
  'Silent Hill': ['silent hill', 'silencio hill', 'silent hil'],
  'Outlast': ['outlast'],
  "I Am Alive": ['i am alive', "i'm alive", 'im alive'],
  'Dead Space': ['dead space'],
  'Devil May Cry': ['devil may cry', 'dmc', 'dmc4', 'dmc5', 'dmc 4', 'dmc 5'],
  'Left 4 Dead': ['left 4 dead', 'left for dead', 'l4d', 'l4d2'],
  'GRID': ['grid autosport', 'grid 2', 'grid legends'],
  'The Last of Us': ['the last of us', 'tlou'],
  'Call of Duty': ['call of duty', 'black ops', 'blackops', 'modern warfare', 'cod mw', 'cod bo'],
  'God of War': ['god of war', 'gow'],
  'Tomb Raider': ['tomb raider'],
  'Red Dead Redemption': ['red dead redemption', 'red dead', 'rdr', 'rdr2'],
  'Need for Speed': ['need for speed', 'nfs', 'nfsmw', 'nfs mw', 'nfs underground'],
  'F1 (Codemasters)': ['f1 20', 'f1 2014', 'f1 2015', 'f1 2016', 'f1 2017', 'f1 2018', 'f1 2019', 'f1 2020', 'f1 2021', 'f1 22', 'f1 23', 'f1 24', 'formula 1 2014'],
  'Deadpool': ['deadpool'],
  'Halo': ['halo ce', 'halo combat evolved', 'halo 2', 'halo 3', 'halo reach', 'halo'],
  'Assassin\'s Creed': ['assassins creed', "assassin's creed", 'assassin creed'],
  'Spider-Man': ['spider man', 'spiderman', 'spider-man'],
  'Batman Arkham': ['batman arkham', 'arkham city', 'arkham asylum', 'arkham knight'],
  'Far Cry': ['far cry', 'farcry'],
  'Watch Dogs': ['watch dogs', 'watchdogs'],
  'Cyberpunk 2077': ['cyberpunk 2077'],
  'Elden Ring': ['elden ring'],
  'Sekiro': ['sekiro'],
  'Bloodborne': ['bloodborne'],
  'Metal Gear': ['metal gear', 'mgs', 'mgsv'],
  'Hitman': ['hitman'],
  'Max Payne': ['max payne'],
  'Mafia': ['mafia ii', 'mafia 2', 'mafia iii', 'mafia 3', 'mafia definitive'],
  'Bully': ['bully scholarship', 'bully anniversary'],
  'Dying Light': ['dying light'],
  'Resident Evil': ['resident evil', 're2 remake', 're4 remake', 're village', 're8'],
  'Final Fantasy': ['final fantasy'],
  'Persona': ['persona 3', 'persona 4', 'persona 5'],
  'Stardew Valley': ['stardew valley'],
  'Terraria': ['terraria'],
  'Minecraft': ['minecraft'],
  'FIFA / EA FC': ['fifa', 'ea fc', 'ea sports fc', 'fc 24', 'fc 25', 'fc 26'],
  'PES / eFootball': ['pes 20', 'pro evolution soccer'],
  'Forza': ['forza horizon', 'forza motorsport'],
  'The Witcher': ['witcher'],
  'Skyrim': ['skyrim'],
  'Fallout': ['fallout'],
  'Days Gone': ['days gone'],
  'Ghost of Tsushima': ['ghost of tsushima'],
  'Hogwarts Legacy': ['hogwarts legacy'],
  'Sonic': ['sonic frontiers', 'sonic generations', 'sonic mania'],
  'Cuphead': ['cuphead'],
  'Hollow Knight': ['hollow knight', 'silksong'],
  'Dark Souls': ['dark souls', 'dar souls'],
  'Project Zomboid': ['project zomboid'],
  'ARK': ['ark survival', 'pixark'],
};
const PATRONES_COM = Object.entries(COMERCIALES).map(([juego, kws]) => ({
  juego, res: kws.map(k => new RegExp('(^|[^a-z0-9])' + norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])')), kws: kws.map(norm),
}));
const GENERICAS = ['cyberpunk'];
/** Juego comercial del título: el de gameDetector o, si no lo tiene, el de la lista de arriba. */
function juegoComercial(titulo) {
  let det = gameDetector.detectGame(titulo, '');
  // Palabras que solas no nombran un juego ("tema cyberpunk", "estilo halo")
  if (det && GENERICAS.some(g => new RegExp(`(^|[^a-z0-9])${g}($|[^a-z0-9])`).test(norm(titulo))) &&
      !(gameDetector.GAMES_DATABASE[det.gameKey]?.keywords || []).map(norm).some(k => !GENERICAS.includes(k) && new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(norm(titulo)))) det = null;
  if (det) return { juego: det.gameName, kws: (gameDetector.GAMES_DATABASE[det.gameKey]?.keywords || []).map(norm) };
  const t = ' ' + norm(titulo) + ' ';
  for (const p of PATRONES_COM) if (p.res.some(r => r.test(t))) return { juego: p.juego, kws: p.kws };
  return null;
}

/**
 * ¿Parece un juego comercial completo? → null | { juego, motivos[] }
 * item: { title, description, category, serie }
 */
function evaluar(item) {
  const titulo = String(item?.title || '');
  const det = juegoComercial(titulo);   // solo el título: una app que "mejora GTA V" no cuenta
  if (!det || item?.category === 'Video') return null;
  const t = norm(titulo);
  const motivos = [];
  const pareceMod = MOD.test(t);
  if (item.category === 'Juego') motivos.push('Se publicó en la categoría Juego con el nombre de un juego comercial');
  if (item.serie?.parte || series.detectarParte(titulo)) motivos.push('Está dividida en partes, como suelen compartirse los juegos completos');
  const sinEdicion = t.replace(EDICION, ' ').replace(/\s+/g, ' ').trim();
  const kws = det.kws;
  if (!pareceMod && kws.some(k => sinEdicion === k || gameDetector.distancia(sinEdicion, k) <= 2)) motivos.push('El título es el nombre del juego, sin indicar qué mod o ajuste es');
  else if (!pareceMod) motivos.push('El título no dice que sea un mod, parche o configuración');
  // Un mod claro (categoría Mod/Optimización y palabras de mod, sin partes) no es sospechoso
  if (!motivos.length) return null;
  return { juego: det.juego, motivos };
}

const MENSAJE_PUBLICAR = juego => `"${juego}" es un juego comercial: si publicas el juego completo no ganarás UpCoins y puede ser retirado. Si es un mod, parche o configuración, dilo en el título (ej. "${juego} – mod de rendimiento").`;
const mensajeCreador = (titulo, juego) =>
  `⚠️ "${String(titulo).slice(0, 70)}" coincide con el juego comercial ${juego}. Se publicó y sigue visible, pero no generará UpCoins mientras el equipo verifica que no sea el juego completo. Si es un mod o configuración, edita el título para indicarlo.`;

module.exports = { evaluar, juegoComercial, MENSAJE_PUBLICAR, mensajeCreador, MOD };
