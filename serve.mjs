import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = path === '/' ? '/index.html' : path;
  try {
    const data = await readFile(join(process.cwd(), file));
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(process.env.PORT || 3000, function() {
  var p = process.env.PORT || 3000;
  console.log('Server running on http://localhost:' + p);
});
