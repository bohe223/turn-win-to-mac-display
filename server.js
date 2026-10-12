// turn-win-to-mac-display —— 零依赖的信令 + 静态文件服务器
// 在共享屏幕的电脑（通常是 Mac）上运行：node server.js（或 ./start.sh）
// - 本机浏览器打开 http://localhost:8765/sender.html 推流（只允许本机访问）
// - 其他电脑用浏览器打开终端里打印出来的地址观看（带随机口令）
// Zero-dependency signaling + static server. Run on the machine whose screen you share.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8765;
// 观看口令：12 位十六进制（48 bit），公网隧道上无法暴力猜出
const KEY = process.env.KEY || crypto.randomBytes(6).toString('hex');
const PUBLIC = path.join(__dirname, 'public');

let sender = null;            // { res }
const viewers = new Map();    // id -> { res }
// 备用模式：观看端主动来取"最新一帧"，取完再取下一帧。
// 不用服务器往外推，慢速隧道里就不会堆积旧帧，画面永远是当前的（网慢只是帧率低）。
let latest = null, latestSeq = 0;
const frameWaiters = new Set();
const pollers = new Map(); // pollId -> 最近一次来取帧的时间
let lastPollerCount = 0;
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

// ---- ICE 服务器：配置了 Cloudflare TURN 就向它要临时凭证，直连不通时视频走 TURN 中转 ----
const STUN_ONLY = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = process.env;
let iceCache = null, iceCacheAt = 0;
async function getIceServers() {
  if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) return STUN_ONLY;
  if (iceCache && Date.now() - iceCacheAt < 12 * 3600e3) return iceCache;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const { iceServers } = await r.json();
    // 去掉 53 端口的地址：浏览器里常超时
    iceCache = [].concat(iceServers).map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) }));
    iceCacheAt = Date.now();
    log('已获取 Cloudflare TURN 凭证');
    return iceCache;
  } catch (e) {
    log('获取 Cloudflare TURN 凭证失败，只用 STUN：', e.message);
    return STUN_ONLY;
  }
}

function notifyPollers() {
  const now = Date.now();
  for (const [id, t] of pollers) if (now - t > 5000) pollers.delete(id);
  if (pollers.size !== lastPollerCount) {
    log(`备用模式观看端: ${pollers.size} 个`);
    lastPollerCount = pollers.size;
    if (sender) sse(sender.res, { type: 'mjpeg', count: pollers.size });
  }
}
setInterval(notifyPollers, 2000);

// 经隧道（cloudflared 等）转发进来的请求虽然来自本机，但带有转发头，不算本机
// 隧道专用端口（PORT+1）上的请求一律视为外部请求——有的隧道不加转发头，单看来源地址分不出来
const TUNNEL_PORT = PORT + 1;
// 另外校验 Host 和 Origin：防止本机浏览器里打开的其他网站（CSRF / DNS 重绑定）冒充推流端
const LOCAL_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`];
const isLocal = (req) => req.socket.localPort !== TUNNEL_PORT
  && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
  && !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for'] && !req.headers['x-real-ip']
  && LOCAL_HOSTS.includes(req.headers.host)
  && (!req.headers.origin || LOCAL_HOSTS.some((h) => req.headers.origin === `http://${h}`));

// 常量时间比较口令
const keyOk = (k) => typeof k === 'string' && k.length === KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(KEY));

function sse(res, msg) { res.write(`data: ${JSON.stringify(msg)}\n\n`); }

function openSSE(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': ok\n\n');
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(ping));
}

const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/events') {
    const role = url.searchParams.get('role');
    if (role === 'sender') {
      if (!isLocal(req)) return res.writeHead(403).end();
      openSSE(req, res);
      if (sender) sse(sender.res, { type: 'replaced' });
      sender = { res };
      sse(res, { type: 'viewers', ids: [...viewers.keys()] });
      sse(res, { type: 'mjpeg', count: pollers.size });
      log('推流端已连接');
      req.on('close', () => {
        if (sender?.res === res) {
          sender = null;
          for (const v of viewers.values()) sse(v.res, { type: 'sender-left' });
        }
      });
    } else {
      if (!keyOk(url.searchParams.get('k'))) return res.writeHead(403).end();
      const id = crypto.randomUUID();
      openSSE(req, res);
      viewers.set(id, { res });
      sse(res, { type: 'hello', id, senderOnline: !!sender });
      log(`观看端加入 ${id.slice(0, 8)}（来自${req.socket.localPort === TUNNEL_PORT ? '公网隧道' : ' ' + req.socket.remoteAddress}）`);
      if (sender) sse(sender.res, { type: 'viewer-joined', id });
      req.on('close', () => {
        viewers.delete(id);
        if (sender) sse(sender.res, { type: 'viewer-left', id });
      });
    }
    return;
  }

  // 备用模式：Mac 推流页把每一帧 JPEG POST 过来，只保留最新一帧
  if (url.pathname === '/frame' && req.method === 'POST') {
    if (!isLocal(req)) return res.writeHead(403).end();
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      latest = Buffer.concat(chunks);
      latestSeq++;
      for (const w of frameWaiters) w();
      frameWaiters.clear();
      res.writeHead(204).end();
    });
    return;
  }

  // 备用模式：观看端取帧。after=上次拿到的序号；没有新帧就最多等 3 秒
  if (url.pathname === '/latest.jpg') {
    if (!keyOk(url.searchParams.get('k'))) return res.writeHead(403).end();
    const pid = url.searchParams.get('id') || 'anon';
    const isNew = !pollers.has(pid);
    pollers.set(pid, Date.now());
    if (isNew) notifyPollers();
    const after = Number(url.searchParams.get('after')) || 0;
    const send = () => {
      if (res.writableEnded) return;
      if (latest && latestSeq > after) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Seq': String(latestSeq) }).end(latest);
      } else res.writeHead(204, { 'Cache-Control': 'no-store' }).end();
    };
    if (latest && latestSeq > after) return send();
    const w = () => { clearTimeout(timer); send(); };
    const timer = setTimeout(() => { frameWaiters.delete(w); send(); }, 3000);
    frameWaiters.add(w);
    req.on('close', () => { clearTimeout(timer); frameWaiters.delete(w); });
    return;
  }

  if (url.pathname === '/ice') {
    if (!isLocal(req) && !keyOk(url.searchParams.get('k'))) return res.writeHead(403).end();
    getIceServers().then((iceServers) =>
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ iceServers })));
    return;
  }

  if (url.pathname === '/signal' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch { return res.writeHead(400).end(); }
      if (msg.to === 'log') {
        if (!isLocal(req)) return res.writeHead(403).end();
        log(`[Mac 推流端] ${String(msg.text).slice(0, 300)}`);
        return res.writeHead(204).end();
      }
      if (msg.to === 'sender') {
        // 观看端 -> 推流端
        if (!keyOk(url.searchParams.get('k')) || !viewers.has(msg.from)) return res.writeHead(403).end();
        if (msg.type === 'log') { log(`[观看端 ${msg.from.slice(0, 8)}] ${String(msg.text).slice(0, 300)}`); return res.writeHead(204).end(); }
        if (sender) sse(sender.res, msg);
      } else {
        // 推流端 -> 某个观看端
        if (!isLocal(req)) return res.writeHead(403).end();
        const v = viewers.get(msg.to);
        if (v) sse(v.res, msg);
      }
      res.writeHead(204).end();
    });
    return;
  }

  // 静态文件
  let file = url.pathname === '/' ? '/viewer.html' : url.pathname;
  if (file === '/sender.html' && !isLocal(req)) return res.writeHead(403).end('sender 只能在 Mac 本机打开');
  if (file === '/info' && isLocal(req)) {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ urls: viewerUrls().map((u) => u.split(' ')[0]), publicUrl: publicUrl(), turn: !!TURN_KEY_ID }));
  }
  const fp = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!fp.startsWith(PUBLIC + path.sep)) return res.writeHead(403).end();
  fs.readFile(fp, (err, data) => {
    if (err) return res.writeHead(404).end('not found');
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' }[path.extname(fp)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }).end(data);
  });
};

function publicUrl() {
  try { return fs.readFileSync(path.join(__dirname, '.tunnel-url'), 'utf8').trim() + `/?k=${KEY}`; } catch { return null; }
}

function viewerUrls() {
  return Object.entries(os.networkInterfaces())
    .flatMap(([name, list]) => list.map((i) => ({ name, ...i })))
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => {
      const via = i.name === 'en0' ? 'Wi-Fi' : i.name.startsWith('bridge') ? '雷电/USB4 线' : i.address.startsWith('169.254.') ? '直连线（自动地址）' : '有线/USB 网卡';
      return `http://${i.address}:${PORT}/?k=${KEY}   ← ${via} (${i.name})`;
    });
}

http.createServer(handler).listen(TUNNEL_PORT, '127.0.0.1');
http.createServer(handler).listen(PORT, '0.0.0.0', () => {
  console.log(`\n服务已启动 / Server running: http://localhost:${PORT}/sender.html`);
  console.log(TURN_KEY_ID ? '\n✅ 已配置 Cloudflare TURN：直连不通时视频会走 TURN 中转 (TURN relay enabled)' : '\n（未配置 TURN：跨网络直连不通时只能走很慢的备用模式。运行 ./setup-turn.sh 配置 / TURN not configured, run ./setup-turn.sh）');
  console.log('\n按 Ctrl+C 停止 / Press Ctrl+C to stop.\n');
  getIceServers();
});
