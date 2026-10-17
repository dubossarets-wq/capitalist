// Публикация онлайн-версии (игра с ботами) на GitHub Pages: сборка в dist-pages
// и отправка в ветку gh-pages. Запуск: npm run deploy:pages
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.env.REPO || 'dubossarets-wq/capitalist';
const name = repo.split('/')[1];
const out = path.resolve('dist-pages');
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

fs.rmSync(out, { recursive: true, force: true });
run(`npx vite build --outDir dist-pages --emptyOutDir`, {
  env: { ...process.env, BASE: `/${name}/`, VITE_STATIC: '1', VITE_REPO_URL: `https://github.com/${repo}` },
});
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const cfg = (key, def) => {
  try {
    return execSync(`git config ${key}`).toString().trim() || def;
  } catch {
    return def;
  }
};
const owner = repo.split('/')[0];
const user = cfg('user.name', owner);
const email = cfg('user.email', `${owner}@users.noreply.github.com`);
run('git init -q -b gh-pages', { cwd: out });
run(`git -c user.name="${user}" -c user.email="${email}" add -A`, { cwd: out });
run(`git -c user.name="${user}" -c user.email="${email}" commit -q -m "Deploy web version"`, { cwd: out });
run(`git push -f https://github.com/${repo}.git gh-pages`, { cwd: out });
fs.rmSync(path.join(out, '.git'), { recursive: true, force: true });
console.log(`\nГотово: https://${repo.split('/')[0]}.github.io/${name}/`);
