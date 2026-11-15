#!/usr/bin/env node
/**
 * Packs dist/ into release/ntu-site.zip for upload to CyberPanel (File Manager -> public_html -> Upload -> Extract).
 * No dependencies: a minimal ZIP writer (deflate + CRC-32, UTF-8 names).
 * By default heavy media (assets/img, assets/docs) is left out: it rarely changes and is already on the server,
 * and the CyberPanel uploader handles small archives better. Add --all to include everything (first deploy).
 * Usage: node tools/package.mjs [--all]
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, 'release', 'ntu-site.zip')
if (!fs.existsSync(DIST)) { console.error('dist/ not found - run `npm run build` first'); process.exit(1) }

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

function walk(dir, base = '') {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + '/') : [base + e.name])
}

const MEDIA = /^assets\/(img|docs)\//
const files = walk(DIST).filter(f => process.argv.includes('--all') || !MEDIA.test(f))
const chunks = [], central = []
let offset = 0
const now = new Date()
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
for (const name of files) {
	const data = fs.readFileSync(path.join(DIST, name))
	const packed = zlib.deflateRawSync(data, { level: 9 })
	const store = packed.length >= data.length
	const body = store ? data : packed
	const nameBuf = Buffer.from(name, 'utf8')
	const crc = crc32(data)
	const local = Buffer.alloc(30)
	local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(store ? 0 : 8, 8)
	local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14)
	local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26)
	chunks.push(local, nameBuf, body)
	const cen = Buffer.alloc(46)
	cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(store ? 0 : 8, 10)
	cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20)
	cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42)
	central.push(cen, nameBuf)
	offset += 30 + nameBuf.length + body.length
}
const cenSize = central.reduce((n, b) => n + b.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16)
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, Buffer.concat([...chunks, ...central, end]))
console.log(`${files.length} files -> ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`)
