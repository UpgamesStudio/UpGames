// Instala TODOS los plugins de plugins/*/ en este repo (idempotente).
//   skills/<x>/SKILL.md  -> .claude/skills/<x>/
//   hooks.json           -> se mezcla en .claude/settings.json ({{DIR}} = ruta del plugin)
// Uso: node plugins/install.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const claude = path.join(root, '.claude');
const settingsPath = path.join(claude, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
const hooks = {};
for (const name of fs.readdirSync(__dirname)) {
  const dir = path.join(__dirname, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const skills = path.join(dir, 'skills');
  if (fs.existsSync(skills)) fs.cpSync(skills, path.join(claude, 'skills'), { recursive: true });
  const hj = path.join(dir, 'hooks.json');
  if (fs.existsSync(hj)) {
    const txt = fs.readFileSync(hj, 'utf8').split('{{DIR}}').join('$CLAUDE_PROJECT_DIR/plugins/' + name);
    for (const [ev, list] of Object.entries(JSON.parse(txt))) (hooks[ev] ||= []).push(...list);
  }
  console.log('instalado:', name);
}
settings.hooks = hooks;
fs.mkdirSync(claude, { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
