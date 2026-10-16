#!/bin/bash
# 一键启动 / One-command start
#
# 用法 Usage: ./start.sh [宽 高] [hidpi] [--lan] [--no-display]
#   宽 高 / W H    虚拟显示器分辨率，默认 1920 1080 (virtual display size)
#   hidpi          虚拟显示器使用 HiDPI (Retina) 模式
#   --lan          只在局域网使用，不开公网隧道 (same network only, no public tunnel)
#   --no-display   不创建虚拟显示器，直接共享现有屏幕 (share an existing screen instead)
#
# 环境变量 Env: PORT（默认 8765）、KEY（观看口令，默认随机）、TUNNEL=cloudflared（改用 Cloudflare 隧道）、NO_OPEN=1（不自动打开浏览器）
cd "$(dirname "$0")"
ARGS=(); INTERNET=1; DISPLAY_ON=1
for a in "$@"; do
  case "$a" in
    --internet) INTERNET=1 ;;
    --lan) INTERNET=0 ;;
    --no-display) DISPLAY_ON=0 ;;
    *) ARGS+=("$a") ;;
  esac
done
W=${ARGS[0]:-1920}; H=${ARGS[1]:-1080}; HIDPI=${ARGS[2]}
PORT=${PORT:-8765}
# 第一次运行：引导配置 Cloudflare TURN（跨网络时让画面流畅；可跳过）
# First run: offer to set up Cloudflare TURN (makes cross-network streaming smooth; optional)
if [ ! -f .turn.env ] && [ ! -f .turn.skip ] && [ -t 0 ]; then
  echo
  echo "还没有配置 Cloudflare TURN 中转。/ Cloudflare TURN relay is not configured."
  echo "  · 两台电脑在同一网络：不需要。/ Same network: not needed."
  echo "  · 跨网络（学校/公司/手机网络）：强烈建议配置，否则可能很卡。/ Across networks: strongly recommended."
  echo "  · 配置教程见 README「配置 Cloudflare TURN」。/ See README for the step-by-step guide."
  read -r -p "现在配置吗？/ Set it up now? [y = 是 / n = 以后再说 / s = 不再询问] " ans
  case "$ans" in
    y|Y) ./setup-turn.sh || true ;;
    s|S) touch .turn.skip ;;
  esac
fi
[ -f .turn.env ] && source .turn.env   # Cloudflare TURN 密钥（由 ./setup-turn.sh 生成）
export KEY=${KEY:-$(openssl rand -hex 6)}

command -v node >/dev/null || { echo "需要 Node.js 18+ / Node.js 18+ is required: https://nodejs.org"; exit 1; }

PIDS=()
rm -f .tunnel-url
trap 'kill "${PIDS[@]}" 2>/dev/null; rm -f .tunnel-url' EXIT

# 虚拟显示器只支持 macOS / The virtual display is macOS-only
if [ $DISPLAY_ON = 1 ] && [ "$(uname)" = Darwin ]; then
  if [ ! -x virtual-display ] || [ virtual-display.m -nt virtual-display ]; then
    echo "编译虚拟显示器 / Building virtual-display…"
    clang -fobjc-arc -framework Foundation -framework CoreGraphics virtual-display.m -o virtual-display \
      || { echo "编译失败，请先安装 Xcode 命令行工具：xcode-select --install"; exit 1; }
  fi
  ./virtual-display "$W" "$H" $HIDPI &
  PIDS+=($!)
fi

if [ $INTERNET = 1 ]; then
  # 默认用 localhost.run（只需系统自带的 ssh）；TUNNEL=cloudflared 改用 Cloudflare 快速隧道
  LOG=$(mktemp)
  if [ "${TUNNEL:-ssh}" = cloudflared ]; then
    command -v cloudflared >/dev/null || { echo "需要先安装 cloudflared / install cloudflared first: brew install cloudflared"; exit 1; }
    cloudflared tunnel --no-autoupdate --url "http://localhost:$((PORT + 1))" > "$LOG" 2>&1 &
    PAT='https://[a-z0-9-]+\.trycloudflare\.com'
  else
    ssh -tt -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=20 -o ExitOnForwardFailure=yes \
      -R 80:localhost:$((PORT + 1)) nokey@localhost.run > "$LOG" 2>&1 &
    PAT='https://[a-z0-9]+\.lhr\.life'
  fi
  PIDS+=($!)
  for _ in $(seq 30); do URL=$(grep -aoE "$PAT" "$LOG" | grep -v '^https://api\.' | tail -1); [ -n "$URL" ] && break; sleep 1; done
  if [ -n "$URL" ]; then
    echo; echo "🌐 任何网络都能打开 / Open from any network: $URL/?k=$KEY"; echo
    echo "$URL" > .tunnel-url
    # 免费隧道会不定时换网址：持续检查，变了就更新（推流页面上会实时显示最新地址）
    ( last=$URL; while sleep 3; do
        u=$(grep -aoE "$PAT" "$LOG" | grep -v '^https://api\.' | tail -1)
        if [ -n "$u" ] && [ "$u" != "$last" ]; then
          echo "$u" > .tunnel-url; echo "🔄 公网地址变了 / Public URL changed: $u/?k=$KEY"; last=$u
        fi
      done ) &
    PIDS+=($!)
  else
    echo "⚠️  公网隧道没建起来（可能被当前网络拦截）/ Tunnel failed (maybe blocked by your network). Log: $LOG"
    echo "    可以试试 / Try: TUNNEL=cloudflared ./start.sh --internet"
  fi
fi

# 服务就绪后自动打开推流页面 / Open the sender page once the server is up
SENDER_URL="http://localhost:$PORT/sender.html"
( for _ in $(seq 20); do curl -s -o /dev/null "$SENDER_URL" && break; sleep 0.5; done
  echo
  echo "================================================================"
  echo "  在本机浏览器打开 / Open on this computer:  $SENDER_URL"
  echo "  页面上会显示另一台电脑要打开的网址 / The page shows the URL for the other computer."
  echo "================================================================"
  echo
  if [ -n "$NO_OPEN" ]; then :
  elif [ "$(uname)" = Darwin ]; then
    open -b com.google.Chrome "$SENDER_URL" 2>/dev/null || open "$SENDER_URL"
  elif command -v xdg-open >/dev/null; then xdg-open "$SENDER_URL" >/dev/null 2>&1; fi
) &
PIDS+=($!)

PORT=$PORT node server.js
