#!/usr/bin/env node
/** Local preview of dist/: node tools/serve.mjs [port]  ->  http://localhost:8080/ */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const PORT = Number(process.argv[2]) || 8080
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
	'.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
	'.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' }

http.createServer((req, res) => {
	let p
	try { p = decodeURIComponent(new URL(req.url.replace(/^\/+/, '/'), 'http://x').pathname) } catch { res.writeHead(400); res.end('Bad request'); return }
	if (p.endsWith('/')) p += 'index.html'
	const file = path.join(DIST, path.normalize(p))
	if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return }
	res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
	fs.createReadStream(file).pipe(res)
}).listen(PORT, () => console.log('Serving dist/ at http://localhost:' + PORT + '/'))
