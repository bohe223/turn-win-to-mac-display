#!/bin/bash
# 配置 Cloudflare TURN（只需一次）/ Configure Cloudflare TURN (one time)
# 密钥保存在本文件夹的 .turn.env，仅你自己可读，已被 .gitignore 排除。
# Keys are stored in .turn.env (mode 600, git-ignored).
cd "$(dirname "$0")"
cat <<'TXT'

=== 配置 Cloudflare TURN / Cloudflare TURN setup ===

还没有 TURN Key？按下面做（详细图文见 README）/ No TURN key yet? Do this (details in README):
  1. 注册并登录 Cloudflare / Sign up & log in:  https://dash.cloudflare.com/sign-up
  2. 左侧菜单 Realtime → TURN Server（第一次会要求开通，每月 1000 GB 免费）
     Sidebar: Realtime → TURN Server (first time asks you to subscribe; 1,000 GB/month free)
  3. 点 Create，名字随便填，再点 Create
     Click Create, enter any name, click Create
  4. 页面会显示 Turn Token ID 和 API Token，复制下来粘贴到这里（API Token 只显示一次）
     Copy "Turn Token ID" and "API Token" (the token is shown only once) and paste below

TXT
if [ "$(uname)" = Darwin ]; then
  read -r -p "现在打开 Cloudflare 后台吗？/ Open the Cloudflare dashboard now? [y/N] " o
  [ "$o" = y ] || [ "$o" = Y ] && open "https://dash.cloudflare.com/?to=/:account/realtime/turn"
fi
read -r -p "Turn Token ID: " ID
read -r -s -p "API Token（输入时不显示 / hidden）: " TOKEN; echo
if [ -z "$ID" ] || [ -z "$TOKEN" ]; then echo "没有填完整，已取消 / Cancelled"; exit 1; fi
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"ttl": 60}' \
  "https://rtc.live.cloudflare.com/v1/turn/keys/$ID/credentials/generate-ice-servers")
if [ "${CODE:0:1}" != 2 ]; then echo "❌ 验证失败（HTTP $CODE），请检查两个值是否复制完整 / Verification failed"; exit 1; fi
umask 077
printf 'export TURN_KEY_ID=%q\nexport TURN_KEY_API_TOKEN=%q\n' "$ID" "$TOKEN" > .turn.env
rm -f .turn.skip
echo "✅ 验证通过，已保存到 .turn.env / Verified and saved."
