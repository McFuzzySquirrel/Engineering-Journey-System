import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('./index.html', import.meta.url));
const port = Number(process.env.PORT ?? 4173);

createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path !== '/' && path !== '/index.html') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(page);
}).listen(port, '127.0.0.1', () => {
  console.log(
    `Decision-record explorer prototype at http://127.0.0.1:${port}/?variant=A`,
  );
});
