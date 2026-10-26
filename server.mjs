import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
});
/** Only browser assets are public; server code, tests and config are never served. */
const PUBLIC_FILES = new Set(['index.html', 'styles.css']);
const PUBLIC_DIRS = Object.freeze(['src']);
const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

/**
 * Map a request URL to a file path inside the public allowlist.
 * @param {string} requestUrl
 * @returns {string | null} absolute path, or null when forbidden
 * @throws {URIError} on malformed percent-encoding
 */
export function getFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  if (pathname.includes('\0')) return null;
  const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
  const relativePath = relative(root, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) return null;
  const [first] = relativePath.split(sep);
  const isPublic = PUBLIC_FILES.has(relativePath) || (PUBLIC_DIRS.includes(first) && extname(relativePath) === '.js');
  return isPublic ? filePath : null;
}

const DEFAULT_PORT = 8080;

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  response.end(body);
}

/** Stream a file; pipeline() cleans up the file handle if the client disconnects mid-transfer. */
function sendFile(request, response, filePath, stats) {
  response.writeHead(200, {
    'Content-Length': stats.size,
    'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    ...SECURITY_HEADERS,
  });
  if (request.method === 'HEAD') response.end();
  else pipeline(createReadStream(filePath), response, () => {});
}

/**
 * Build the static file server. Exported so tests can start it on a random port.
 * @param {{ stat?: typeof fs.stat }} [options] stat is injectable so error paths can be tested
 */
export function createAppServer({ stat = fs.stat } = {}) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let filePath;
    try {
      filePath = getFilePath(request.url);
    } catch {
      send(response, 400, 'Bad request');
      return;
    }
    if (!filePath) {
      send(response, 403, 'Forbidden');
      return;
    }

    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
      sendFile(request, response, filePath, stats);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') send(response, 404, 'Not found');
      else send(response, 500, 'Internal server error');
    }
  });
}

/**
 * Decide what a listen error means: report a busy port, rethrow anything unexpected.
 * @param {NodeJS.ErrnoException} error
 * @param {number} port
 * @param {Pick<Console, 'error'>} [logger]
 * @returns {number} process exit code
 */
export function handleServerError(error, port, logger = console) {
  if (error.code !== 'EADDRINUSE') throw error;
  logger.error(`Port ${port} is already in use. Set PORT to use another port.`);
  return 1;
}

/**
 * Start listening on a port (0 picks a free one).
 * @param {number} port
 * @param {Pick<Console, 'log' | 'error'>} [logger]
 */
export function startServer(port, logger = console) {
  const server = createAppServer();
  server.on('error', (error) => {
    process.exitCode = handleServerError(error, port, logger);
  });
  server.listen(port, () => {
    logger.log(`Event planner running at http://localhost:${server.address().port}`);
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(Number(process.env.PORT) || DEFAULT_PORT);
}
