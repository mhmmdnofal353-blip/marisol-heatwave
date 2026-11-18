// take-screenshots.mjs — capture this entry's screenshots from the game
// itself. It serves game/ locally, drives headless Chrome over the DevTools
// protocol (Node's built-in fetch and WebSocket; no dependencies), opens
// each staged scene listed in shots.json, waits until the game raises
// window.__shotReady, and saves the frame as a JPEG sized for the gate
// (at most 256 KiB, 1280x720 here).
//
//   node take-screenshots.mjs
//
// CHROME_PATH picks the browser binary when the default is not present.

import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const scenes = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const HTTP_PORT = 8911;
const CDP_PORT = 9341;
const CHROME = process.env.CHROME_PATH
  || '/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll `probe` until it returns something truthy or the deadline passes. */
async function until(probe, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`gave up waiting for ${what}`);
    await delay(150);
  }
}

/** The smallest useful DevTools client: request/response over one socket. */
class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.waiting = new Map();
    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const slot = msg.id !== undefined ? this.waiting.get(msg.id) : undefined;
      if (!slot) return;
      this.waiting.delete(msg.id);
      if (msg.error) slot.reject(new Error(msg.error.message));
      else slot.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const server = spawn('node', [join(here, 'serve.ts'), '--port', String(HTTP_PORT)], { stdio: 'ignore' });
const browser = spawn(CHROME, [
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1280,720',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=/tmp/marisol-heatwave-shots',
  'about:blank',
], { stdio: 'ignore' });

try {
  const target = await until(async () => {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const list = await res.json();
    return list.find((t) => t.type === 'page');
  }, 20000, 'a Chrome page target');

  // The server needs a breath before the first navigation, or the page
  // lands on a dead port and no scene ever stages.
  await until(async () => {
    const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/`);
    return res.ok;
  }, 10000, 'the game server to listen');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = new DevTools(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  for (const scene of scenes) {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/${scene.query}` });
    await until(async () => {
      const reply = await cdp.send('Runtime.evaluate', {
        expression: 'window.__shotReady === true',
        returnByValue: true,
      });
      return reply.result && reply.result.value === true;
    }, 25000, `scene ${scene.name} to stage itself`);
    await delay(300); // let the held frame paint once more before capture
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 86, captureBeyondViewport: false,
    });
    const file = join(here, 'screenshots', scene.name);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const bytes = statSync(file).size;
    console.log(`${scene.name}: ${bytes} bytes`);
    // The dossier gate caps a screenshot at 256 KiB; fail here, loudly,
    // rather than at submission time with a rejected bundle.
    if (bytes > 262144) {
      throw new Error(`${scene.name} is ${bytes} bytes, over the 256 KiB cap`);
    }
    // A frame of a few kilobytes is a blank or unpainted page wearing a
    // scene's name; that, too, is cheaper to catch here than at the gate.
    if (bytes < 8000) {
      throw new Error(`${scene.name} is only ${bytes} bytes — the scene likely never painted`);
    }
  }
  socket.close();
} finally {
  browser.kill();
  server.kill();
}
