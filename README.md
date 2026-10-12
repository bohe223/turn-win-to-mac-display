# turn-win-to-mac-display

**English** | [中文](README.zh-CN.md)

**Turn any Windows PC into an extra display for your Mac — nothing to install on Windows, just open a URL.**

Run one script on the Mac: a virtual display appears, a web page opens, and that page shows a URL. Open the URL in a browser on the Windows PC and it shows the Mac's virtual screen in real time — whether or not the two machines are on the same network.

- 🪟 **Zero install on Windows** — Chrome / Edge is all you need (phones and tablets work too).
- 🖥️ **A real extended display** — macOS gets a new "Windows Display" you can drag windows onto.
- 🌐 **Works across networks** — a free public tunnel is built in; add Cloudflare TURN and it stays smooth on school, office and mobile networks.
- ⚡ **Low latency** — WebRTC + hardware H.264, up to 60 fps; ~40–50 ms estimated on a LAN.
- 🔒 **Your own infrastructure** — the server runs on your Mac and TURN uses your own Cloudflare account. No third party stores your screen.
- 📦 **Zero dependencies** — just Node.js, no `npm install`.

> Just want to share an existing screen? Add `--no-display`. The server also runs on Windows / Linux; only the virtual display is macOS-specific.

---

## Contents

- [Quick start](#quick-start)
- [Setting up Cloudflare TURN (step by step)](#setting-up-cloudflare-turn-step-by-step)
- [Options](#options)
- [How it works](#how-it-works)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

---

## Quick start

### Requirements

| | |
|---|---|
| **Mac** (the machine being shared) | macOS (tested on macOS 26) · [Node.js](https://nodejs.org) 18+ · Chrome · Xcode Command Line Tools (`xcode-select --install`, used to build the virtual display) |
| **Windows** (the "monitor") | Any modern browser (Chrome / Edge recommended). **Nothing to install.** |

### Three steps

**1. Get the code**
```bash
git clone https://github.com/bohe223/turn-win-to-mac-display.git
cd turn-win-to-mac-display
```

**2. Start** — **double-click `start.command`** in Finder, or run:
```bash
./start.sh
```
- On first run it asks whether to set up Cloudflare TURN. **Same network?** Press `n`. **Across networks?** Press `y` and follow [the guide below](#setting-up-cloudflare-turn-step-by-step) (~5 minutes).
- The first time, macOS asks you to allow **Screen Recording** for Chrome: *System Settings → Privacy & Security → Screen Recording*, enable Chrome, then restart Chrome.

**3. Follow the page** — Chrome opens the sender page automatically. At the top is **the URL to open on Windows**:

1. Open that URL in a browser on the Windows PC (double-click the video for full screen).
2. On the Mac page click **Choose screen & start** and pick **Entire Screen → Windows Display**.
3. Drag windows onto the new display. Arrange it in *System Settings → Displays*.

Press `Ctrl+C` in the terminal when you're done — the virtual display and the public URL go away together.

---

## Setting up Cloudflare TURN (step by step)

### Why?

When the two machines are on different networks, the browsers first try to **connect directly**. Many networks (universities, offices, 4G/5G) block that, so the video needs a **relay (TURN server)**. Without TURN the app falls back to a very slow mode (1–2 fps).

Cloudflare's TURN service includes **1,000 GB free per month**, then $0.05/GB. 1080p uses roughly 2–7 GB per hour, so most people never leave the free tier — and TURN is only used when a direct connection fails.

> Same network only? You don't need TURN.

### Step 1 — Create a Cloudflare account

Go to <https://dash.cloudflare.com/sign-up>, sign up with your email and verify it. The free plan is fine.

### Step 2 — Enable Realtime (TURN)

1. In the dashboard sidebar open **Realtime → TURN Server** (older UI: **Calls**).
2. The first time you'll see **Get Started**, which leads to a subscription page:
   - It shows **1,000 GB / month free** and **$0.00 due today**.
   - Cloudflare requires a **payment method and billing address**; you are only charged beyond the free tier.
   - Click **Save payment details & activate Realtime**.

> 💡 Recommended: *Billing → Budget alerts*, e.g. $1, so you get an email if you ever exceed the free tier.

### Step 3 — Create a TURN key

1. Back in **Realtime → TURN Server**, click **Create**.
2. Enter any **Name** (e.g. `my-display`) and click **Create**.
3. The page shows two values:
   - **Turn Token ID** — 32 characters
   - **API Token** — longer; **shown only once, copy it now**

### Step 4 — Give the keys to the app

In the project folder run:
```bash
./setup-turn.sh
```
Paste the **Turn Token ID** and the **API Token** (the token is hidden while you type — that's expected). The script verifies them with Cloudflare; `✅ Verified and saved` means you're done.

The keys live in `.turn.env`:
- file mode 600 (only you can read it),
- listed in `.gitignore` — **never committed**,
- used only on your Mac to mint **short-lived credentials** (24 h). Browsers only ever see those temporary credentials, never your key.

### Step 5 — Check it works

Run `./start.sh` again; the sender page shows **TURN configured ✓**. Once Windows connects, the top-right corner shows the connection type:
- **LAN direct / Direct (internet)** — no TURN, no cost.
- **TURN relay** — relayed by Cloudflare, counts toward the free tier.

Usage is under **Realtime → TURN Server → Analytics** in the dashboard.

---

## Options

```bash
./start.sh [W H] [hidpi] [--lan] [--no-display]
```

| Option | Description |
|---|---|
| `2560 1440` | Virtual display size (default `1920 1080`) |
| `hidpi` | HiDPI (Retina) virtual display — sharper, more bandwidth |
| `--lan` | Same network only, no public tunnel |
| `--no-display` | Don't create a virtual display; share an existing screen |

| Env var | Description |
|---|---|
| `PORT=8765` | Local port (the tunnel uses `PORT+1`) |
| `KEY=...` | Fixed viewer key (default: random 12 hex chars each run) |
| `TUNNEL=cloudflared` | Use a Cloudflare quick tunnel instead (`brew install cloudflared`) |
| `NO_OPEN=1` | Don't open the browser automatically |

```bash
./start.sh 2560 1440 hidpi        # 1440p HiDPI extended display
./start.sh --no-display --lan     # share an existing screen on the LAN
```

---

## How it works

```
┌──────────────────────── Mac ────────────────────────┐
│ ① virtual-display   macOS thinks a monitor is attached│
│ ② Chrome sender     captures that screen → H.264       │
│ ③ server.js         signaling + viewer key check       │
│ ④ ssh tunnel        public https URL for ③             │
│                     (localhost.run — free, no install) │
└─────────────────────────┬───────────────────────────┘
   signaling (tiny) goes through the tunnel; video does NOT
                          │
   video path (fastest wins): LAN → direct P2P → Cloudflare TURN → fallback
                          ▼
┌────────────────────── Windows ──────────────────────┐
│ ⑤ browser opens the URL → full-screen video          │
└─────────────────────────────────────────────────────┘
```

- **Signaling** — the two browsers exchange WebRTC offer/answer/ICE through `server.js`.
- **Video** — browser to browser over WebRTC (DTLS-SRTP encrypted). It never passes through `server.js` or the tunnel.
- **TURN** — if firewalls block direct paths, Cloudflare relays the video; anycast picks the nearest data center automatically.
- **Fallback** — if nothing connects within 20 s, frames are sent as JPEGs through the tunnel. Slow; last resort only.

| File | Purpose |
|---|---|
| `start.command` | Double-click to start (macOS) |
| `start.sh` | Starts virtual display, tunnel and server; stops them all on exit |
| `setup-turn.sh` | Configure and verify Cloudflare TURN keys |
| `virtual-display.m` | Virtual display (Objective-C, compiled automatically on first run) |
| `server.js` | Signaling + static file server (Node.js, zero dependencies) |
| `public/sender.html` | Sender page (Mac) |
| `public/viewer.html` | Viewer page (Windows) |

---

## Security

- **Viewer key** — 12 random hex chars (48 bits) per run; without it nobody can watch.
- **Sender is local-only** — requests are checked by source address, `Host` and `Origin`, so LAN devices, the public tunnel and other websites open in your browser cannot impersonate the sender.
- **The tunnel provider** (localhost.run or Cloudflare) can see signaling that passes through it, including the viewer key. **The video does not go through the tunnel** and is end-to-end encrypted. Use `--lan` if this matters to you.
- **URL and key change every run**; old URLs stop working as soon as you quit.
- **TURN keys** stay on your Mac (`.turn.env`, git-ignored).

---

## Troubleshooting

**"Tunnel failed" on start** — your network may block localhost.run. Try:
```bash
brew install cloudflared
TUNNEL=cloudflared ./start.sh
```
Some networks (e.g. some universities) also block Cloudflare quick tunnels; use `--lan` or another network.

**Windows shows "no tunnel" / can't open** — free tunnels rotate URLs. The sender page always shows the current one (refreshes every 5 s); an already-playing stream is not affected.

**Choppy video, "Fallback" in the corner** — direct connection failed and TURN isn't configured. [Set up TURN](#setting-up-cloudflare-turn-step-by-step).

**Permission error after clicking start** — allow Chrome in *System Settings → Privacy & Security → Screen Recording*, then **restart Chrome**.

**No "Windows Display"** — check the terminal for `✅ Virtual display created`. If compilation failed, run `xcode-select --install`.

**Lower latency** — keep the default "Sharp" mode at 60 fps. Move the mouse on the viewer to see RTT, jitter buffer and decode times in the top-right corner. Latency is mostly network: LAN is fastest, TURN adds a few tens of ms.

**Can Windows control the Mac?** — Not yet; display only. Move the Mac's pointer onto the virtual display.

---

## Limitations

- The virtual display uses the **private** macOS API `CGVirtualDisplay` (also used by [DeskPad](https://github.com/Stengo/DeskPad) and BetterDisplay); a future macOS update could break it.
- The sender needs desktop Chrome (or Edge).
- Free localhost.run URLs rotate; a fixed URL needs your own domain and tunnel.
- Each viewer gets its own encoded stream, so more viewers = more upload bandwidth on the Mac.
- The UI is available in English and Chinese (follows the browser language; switch with the button on the page).

---

## License

[Apache License 2.0](LICENSE) — free to use, modify and use commercially; keep the copyright and license notices.
