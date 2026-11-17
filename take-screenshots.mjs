// Capture the entry's screenshots: serve game/ locally, open each staged
// scene from shots.json in headless Chrome over the DevTools protocol (Node
// standard library only — fetch and WebSocket are built in), wait for the
// game to flag its staged frame, and save a JPEG under the gate's 256 KiB.
// Run: node take-screenshots.mjs   (CHROME_PATH overrides the browser)

import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const PORT = 8907;
const DEBUG_PORT = 9337;
const CHROME = process.env.CHROME_PATH || '/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell';

const server = spawn('node', [join(here, 'serve.ts'), '--port', String(PORT)], { stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--user-data-dir=/tmp/marisol-shots-profile',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout, label) {
  const start = Date.now();
  for (;;) {
    const value = await fn().catch(() => null);
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${label}`);
    await sleep(200);
  }
}

/** A minimal CDP client: numbered calls over one WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  call(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

try {
  await sleep(700);
  const targets = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const list = await res.json();
    return list.find((t) => t.type === 'page') || null;
  }, 15000, 'chrome target');
  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  for (const shot of shots) {
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` });
    const ready = await waitFor(async () => {
      const r = await cdp.call('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      return r.result && r.result.value === true;
    }, 20000, `shot ${shot.name}`);
    void ready;
    await sleep(250);
    const shot1 = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: false });
    const out = join(here, 'screenshots', shot.name);
    writeFileSync(out, Buffer.from(shot1.data, 'base64'));
    console.log(shot.name, statSync(out).size, 'bytes');
  }
  ws.close();
} finally {
  chrome.kill();
  server.kill();
}
