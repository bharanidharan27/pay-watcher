import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_PORT = 4200 + Math.floor(Math.random() * 700);
const CDP_PORT = 9300 + Math.floor(Math.random() * 700);
const APP_URL = `http://127.0.0.1:${APP_PORT}/?id=txn-cdp&merchant=Metro&amount=8.50&card=Mom%20Visa&category=Transit&note=Apple%20Pay`;
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });
await mkdir(path.join(ROOT, '.browser-profiles'), { recursive: true });

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(APP_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=swiftshader',
    '--use-angle=swiftshader',
    '--no-first-run',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(ROOT, '.browser-profiles', `cdp-${Date.now()}`)}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

try {
  await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
  const target = await waitForTarget();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const mobile = await captureViewport(cdp, {
    name: 'mobile',
    width: 390,
    height: 844,
    mobile: true,
    path: path.join(SCREENSHOT_DIR, 'cdp-mobile.png'),
  });

  const desktop = await captureViewport(cdp, {
    name: 'desktop',
    width: 1280,
    height: 900,
    mobile: false,
    path: path.join(SCREENSHOT_DIR, 'cdp-desktop.png'),
  });

  cdp.close();

  const summary = { mobile, desktop };
  console.log(JSON.stringify(summary, null, 2));

  const failed = [mobile, desktop].some(
    (result) =>
      !result.hasMetro ||
      !result.hasAmount ||
      result.scrollWidth > result.clientWidth,
  );

  if (failed) {
    process.exitCode = 1;
  }
} finally {
  chrome.kill();
  server.kill();
}

async function captureViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });

  const load = cdp.waitEvent('Page.loadEventFired', 10000);
  await cdp.send('Page.navigate', { url: APP_URL });
  await load;
  await cdp.send('Runtime.evaluate', {
    expression: 'new Promise((resolve) => setTimeout(resolve, 600))',
    awaitPromise: true,
  });

  const state = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        hasMetro: text.includes('Metro'),
        hasAmount: text.includes('$8.50'),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight
      };
    })()`,
    returnByValue: true,
  });

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(viewport.path, Buffer.from(screenshot.data, 'base64'));

  return {
    viewport: viewport.name,
    screenshot: viewport.path,
    ...state.result.value,
  };
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const waiters = new Map();
    let id = 0;

    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          socket.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((messageResolve, messageReject) => {
            pending.set(messageId, { resolve: messageResolve, reject: messageReject });
          });
        },
        waitEvent(method, timeoutMs) {
          return new Promise((eventResolve, eventReject) => {
            const timeout = setTimeout(() => {
              eventReject(new Error(`Timed out waiting for ${method}`));
            }, timeoutMs);
            waiters.set(method, {
              resolve(value) {
                clearTimeout(timeout);
                eventResolve(value);
              },
            });
          });
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener('error', reject);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const handler = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          handler.reject(new Error(message.error.message));
        } else {
          handler.resolve(message.result || {});
        }
        return;
      }

      if (message.method && waiters.has(message.method)) {
        const waiter = waiters.get(message.method);
        waiters.delete(message.method);
        waiter.resolve(message.params || {});
      }
    });
  });
}

async function waitForTarget() {
  const url = `http://127.0.0.1:${CDP_PORT}/json/list`;
  return waitFor(async () => {
    const targets = await getJson(url);
    return targets.find((target) => target.type === 'page');
  });
}

async function waitForHttp(url) {
  await waitFor(() => request(url).then(() => true));
}

async function waitFor(callback, timeoutMs = 12000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await callback();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error('Timed out');
}

function getJson(url) {
  return request(url).then((body) => JSON.parse(body));
}

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      });
    });
    req.on('error', reject);
  });
}
