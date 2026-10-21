import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function getFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, requested));
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || relativePath.includes(`..${sep}`)) {
    return null;
  }
  return filePath;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let filePath;
  try {
    filePath = getFilePath(request.url);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error('Not a file');
    const contentType = contentTypes[extname(filePath)] ?? 'application/octet-stream';
    response.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentType,
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal server error');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Set PORT to use another port.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, () => {
  console.log(`Event planner running at http://localhost:${port}`);
});
