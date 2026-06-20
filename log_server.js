// Simple HTTP server to collect logs from ScreenTranslator's JS environment
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    if (parsedUrl.pathname === '/log') {
        const msg = parsedUrl.query.msg || '';
        console.log(`[ST_LOG] ${new Date().toISOString()} - ${msg}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
    } else {
        res.writeHead(404);
        res.end('not found');
    }
});

server.listen(3000, '127.0.0.1', () => {
    console.log('Log server listening on http://localhost:3000/log');
});
