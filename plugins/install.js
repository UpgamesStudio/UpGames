// Instala TODOS los plugins de plugins/*/ en este repo (idempotente).
//   skills/ references/ agents/ commands/ -> .claude/<igual>/
//   install.sh           -> se ejecuta si existe (p. ej. pip install de una CLI)
//   hooks.json           -> se mezcla en .claude/settings.json ({{DIR}} = ruta del plugin)
// Uso: node plugins/install.js [plugin ...]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const only = process.argv.slice(2);   // node plugins/install.js [plugin ...]  (sin args: todos)
const root = path.join(__dirname, '..');
const claude = path.join(root, '.claude');
const settingsPath = path.join(claude, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
const hooks = {};
for (const name of fs.readdirSync(__dirname)) {
  const dir = path.join(__dirname, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const go = !only.length || only.includes(name);
  if (go) for (const d of ['skills', 'references', 'agents', 'commands'])   // references: los skills enlazan a ../../references/
    if (fs.existsSync(path.join(dir, d))) fs.cpSync(path.join(dir, d), path.join(claude, d), { recursive: true });
  const hj = path.join(dir, 'hooks.json');
  if (fs.existsSync(hj)) {
    const txt = fs.readFileSync(hj, 'utf8').split('{{DIR}}').join('$CLAUDE_PROJECT_DIR/plugins/' + name);
    for (const [ev, list] of Object.entries(JSON.parse(txt))) (hooks[ev] ||= []).push(...list);
  }
  if (go && fs.existsSync(path.join(dir, 'install.sh'))) execFileSync('bash', [path.join(dir, 'install.sh')], { stdio: 'inherit' });
  if (go) console.log('instalado:', name);
}
settings.hooks = hooks;
fs.mkdirSync(claude, { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
