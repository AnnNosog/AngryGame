#!/usr/bin/env node
/*
 * build_atlas.js - atlas packer without native TexturePacker.
 *
 * Reads all images from ./img/, lays them out into one atlas
 * (shelf packing) and writes:
 *   build_res/atlas-0.png   - atlas image (RGBA, transparent background)
 *   build_res/atlas-0.json  - [[name,x,y,w,h], ...]  (eeditor engine format)
 *
 * Atlas pixels are taken from a headless browser (Edge/Chrome) via
 * canvas.toDataURL() over the DevTools Protocol - exact RGBA pixels with
 * preserved antialiasing (unlike --screenshot, which composites and
 * clips semi-transparent sprite edges).
 *
 * No dependencies: DevTools WebSocket implemented with built-in
 * net/crypto/http modules.
 *
 * Run:   node build_atlas.js
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJ = __dirname;
const IMG_DIR = path.join(PROJ, 'img');
const OUT_DIR = path.join(PROJ, 'build_res');
const PAD = 16;                // padding between sprites, px (large - avoids neighbor bleed with mipmaps)
const START = 512;             // starting atlas size
const MAX = 4096;              // limit
const DEVTOOLS_PORT = 9355;

// ---- find a browser for rendering ----
function findBrowser() {
  const cands = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('Edge/Chrome not found for atlas rendering');
}

// ---- read PNG size from IHDR (no libraries) ----
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 12, 16) !== 'IHDR')
    throw new Error('Not a PNG or corrupt file: ' + file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ---- shelf packing into a size x size square ----
function packShelf(items, size) {
  const placed = [];
  let x = PAD, y = PAD, shelfH = 0;
  for (const it of items) {
    const w = it.w + PAD, h = it.h + PAD;
    if (x + w > size) { x = PAD; y += shelfH; shelfH = 0; }
    if (y + h > size) return null;
    placed.push({ ...it, x, y });
    x += w;
    if (h > shelfH) shelfH = h;
  }
  return placed;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const httpGet = urlPath => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: DEVTOOLS_PORT, path: urlPath }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});

// ---- minimal WebSocket client (RFC6455) for DevTools ----
function connectWS(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
        `Host: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let handshook = false, buf = Buffer.alloc(0);
    const listeners = [];
    const api = {
      onMessage(fn) { listeners.push(fn); },
      send(obj) { sock.write(encodeFrame(Buffer.from(JSON.stringify(obj)))); },
      close() { try { sock.end(); } catch (e) {} },
    };
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshook) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        handshook = true;
        buf = buf.slice(idx + 4);
        resolve(api);
      }
      // decode frames (server->client, unmasked)
      while (buf.length >= 2) {
        const len0 = buf[1] & 0x7f;
        let off = 2, len = len0;
        if (len0 === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len0 === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) break;
        const payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        try { const msg = JSON.parse(payload.toString()); listeners.forEach(fn => fn(msg)); } catch (e) {}
      }
    });
    sock.on('error', reject);
  });
}

// client->server frame must be masked
function encodeFrame(payload) {
  const len = payload.length;
  const mask = crypto.randomBytes(4);
  let header;
  if (len < 126) { header = Buffer.from([0x81, 0x80 | len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

async function renderAtlasPNG(browser, size, draws, outPng) {
  const script = draws.map((d, i) =>
    `imgs[${i}]=new Image();imgs[${i}].src='data:image/png;base64,${d.b64}';pos[${i}]=[${d.x},${d.y}];`
  ).join('\n');

  // Page draws sprites and, once ready, puts the dataURL into window.__ATLAS__
  const html = `<!doctype html><meta charset=utf8>
<canvas id=c width=${size} height=${size}></canvas>
<script>
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const imgs=[],pos=[];
${script}
let loaded=0,total=${draws.length};
function tick(){
  if(loaded<total) return;
  ctx.clearRect(0,0,${size},${size});
  for(let i=0;i<total;i++){ctx.drawImage(imgs[i],pos[i][0],pos[i][1]);}
  window.__ATLAS__ = cv.toDataURL('image/png');
}
for(let i=0;i<total;i++){imgs[i].onload=()=>{loaded++;tick();};imgs[i].onerror=()=>{loaded++;tick();};}
</script>`;

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = path.join(OUT_DIR, '_atlas_render.html');
  fs.writeFileSync(htmlPath, html);

  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--remote-debugging-port=' + DEVTOOLS_PORT,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    // wait for DevTools and the page
    let target;
    for (let i = 0; i < 50; i++) {
      try { const list = await httpGet('/json'); target = list.find(t => t.type === 'page'); if (target) break; }
      catch (e) {}
      await sleep(200);
    }
    if (!target) throw new Error('DevTools did not start');

    const ws = await connectWS(target.webSocketDebuggerUrl);
    let id = 0; const pending = {};
    ws.onMessage(msg => { if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id]; } });
    const call = (method, params) => new Promise(res => { const i = ++id; pending[i] = res; ws.send({ id: i, method, params: params || {} }); });

    await call('Page.enable');
    await call('Runtime.enable');
    await call('Page.navigate', { url: 'file:///' + htmlPath.replace(/\\/g, '/') });

    // poll window.__ATLAS__ until ready
    let dataUrl = null;
    for (let i = 0; i < 80; i++) {
      await sleep(150);
      const r = await call('Runtime.evaluate', { expression: 'window.__ATLAS__ || ""', returnByValue: true });
      const v = r && r.result && r.result.value;
      if (v && v.length > 100) { dataUrl = v; break; }
    }
    ws.close();
    if (!dataUrl) throw new Error('canvas did not return dataURL');

    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(outPng, Buffer.from(b64, 'base64'));
  } finally {
    proc.kill();
    try { fs.unlinkSync(htmlPath); } catch (e) {}
  }
}

async function main() {
  const browser = findBrowser();

  //const files = fs.readdirSync(IMG_DIR).filter(f => f.toLowerCase().endsWith('.png')).sort();
  const SKIP = ['sky', 'sky-day', 'sky-night', 'menu-win'];
  const files = fs.readdirSync(IMG_DIR)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .filter(f => !SKIP.includes(path.basename(f, '.png')))
    .sort();

  if (!files.length) { console.error('No png in img/'); process.exit(1); }

  let items = files.map(f => {
    const s = pngSize(path.join(IMG_DIR, f));
    return { name: path.basename(f, '.png'), file: path.join(IMG_DIR, f), w: s.w, h: s.h };
  });
  items = items.slice().sort((a, b) => b.h - a.h || b.w - a.w);

  let size = START, placed = null;
  while (size <= MAX) { placed = packShelf(items, size); if (placed) break; size *= 2; }
  if (!placed) { console.error(`Does not fit even in ${MAX}x${MAX}`); process.exit(1); }

  console.log(`Atlas ${size}x${size}, sprites: ${placed.length}`);

  const draws = placed.map(p => ({
    name: p.name, x: p.x, y: p.y, w: p.w, h: p.h,
    b64: fs.readFileSync(p.file).toString('base64'),
  }));

  const pngOut = path.join(OUT_DIR, 'atlas-0.png');
  await renderAtlasPNG(browser, size, draws, pngOut);

  const byName = {};
  placed.forEach(p => { byName[p.name] = p; });
  const json = '[' + files.map(f => {
    const n = path.basename(f, '.png');
    const p = byName[n];
    return `["${n}",${p.x},${p.y},${p.w},${p.h}]`;
  }).join(',') + ']';
  fs.writeFileSync(path.join(OUT_DIR, 'atlas-0.json'), json);

  console.log('Done: build_res/atlas-0.png + atlas-0.json');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
