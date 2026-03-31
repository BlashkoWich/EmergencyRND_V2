import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const file = req.url === '/' ? '/index.html' : req.url;
  try {
    const data = await readFile(join(process.cwd(), file));
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(3000, () => console.log('Server running on http://localhost:3000'));
