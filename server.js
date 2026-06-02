import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const filePath = path.normalize(path.join(ROOT, relativePath));

    if (!filePath.startsWith(ROOT)) {
      sendText(response, 403, 'Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) {
      sendText(response, 404, 'Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES.get(path.extname(filePath)) || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, 'Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Pay Watcher is running at http://localhost:${PORT}`);
});

function sendText(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}
