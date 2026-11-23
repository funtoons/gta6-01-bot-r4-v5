// Capture the 4 screenshots from shots.json, twice, and compare hashes so a
// re-render is proven byte-identical. Usage: node tools/shoot.mjs [outdir]
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GAME = join(ROOT, 'game');
const SHOTS = JSON.parse(await readFile(join(ROOT, 'shots.json'), 'utf8'));
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const OUT = process.argv[2] || join(ROOT, 'screenshots');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const data = await readFile(join(GAME, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

async function capture(browser, query, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/index.html${query}`, { waitUntil: 'load' });
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 15000) {
    if (await page.evaluate(() => window.__game && window.__game.shotReady)) { ready = true; break; }
    await page.waitForTimeout(50);
  }
  if (!ready) throw new Error(`shot ${name} never became ready`);
  await page.waitForTimeout(120);
  const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
  if (errors.length) console.log(`  warnings ${name}: ${errors.join(' | ').slice(0, 200)}`);
  await page.close();
  return buf;
}

const browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
await mkdir(OUT, { recursive: true });
const hashes = {};
for (const pass of [1, 2]) {
  for (const shot of SHOTS) {
    const buf = await capture(browser, shot.query, shot.name);
    const sha = createHash('sha256').update(buf).digest('hex');
    console.log(`pass ${pass} ${shot.name}: ${buf.length} bytes sha256 ${sha.slice(0, 16)}...`);
    if (pass === 1) {
      await writeFile(join(OUT, shot.name), buf);
      hashes[shot.name] = sha;
    } else if (hashes[shot.name] !== sha) {
      console.log(`MISMATCH ${shot.name}: pass1 ${hashes[shot.name].slice(0, 16)} pass2 ${sha.slice(0, 16)}`);
      process.exitCode = 1;
    }
  }
}
await browser.close();
server.close();
console.log(process.exitCode ? 'SHOOT: byte-identical check FAILED' : 'SHOOT: all 4 shots byte-identical across 2 passes');
