/* Local development server, API logic shared with Vercel. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./api/index');
const PORT = Number(process.env.PORT || 3000);
http.createServer((req,res)=>{
 const pathname = new URL(req.url,'http://localhost').pathname;
 if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});
   res.end(fs.readFileSync(path.join(__dirname,'index.html')));
   return;
 }
 return Promise.resolve(api(req,res)).catch(()=>{res.writeHead(500);res.end('Internal error');});
}).listen(PORT,'0.0.0.0',()=>console.log('Resume Builder listening on '+PORT));
