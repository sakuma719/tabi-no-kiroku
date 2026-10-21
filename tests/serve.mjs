// A static subdirectory server, matching GitHub Pages asset paths (no SPA fallback).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const prefix = '/tabi-no-kiroku/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404).end();
        return;
      }
      let file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      res
        .writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4173, '127.0.0.1');
