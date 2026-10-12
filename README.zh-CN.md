# turn-win-to-mac-display

[English](README.md) | **中文**

**把一台 Windows 电脑变成 Mac 的扩展显示器。Windows 上什么都不用装，打开一个网址就行。**

Mac 上运行一个脚本，会多出一块虚拟显示器，同时打开一个网页，网页上显示一个网址。在 Windows 上用浏览器打开这个网址，Mac 那块屏幕的画面就会实时显示出来。两台电脑在不在同一个网络都可以用。

- 🪟 **Windows 端零安装**：Chrome / Edge 打开网址即可，也可以用手机或平板。
- 🖥️ **真正的扩展屏**：Mac 上多出一块「Windows Display」，可以把窗口拖过去。
- 🌐 **跨网络可用**：自带免费公网隧道，不在同一 WiFi 也能看；配合 Cloudflare TURN 中转，在学校、公司、手机网络下也流畅。
- ⚡ **低延迟**：WebRTC + H.264 硬件编解码，最高 60 帧；局域网内实测估算延迟约 40–50 ms。
- 🔒 **只用你自己的资源**：服务跑在你的 Mac 上，TURN 用你自己的 Cloudflare 账号，不经过任何第三方服务器保存画面。
- 📦 **零依赖**：只需要 Node.js，不用 `npm install`。

> 不需要扩展屏、只想共享现有屏幕？加上 `--no-display` 即可。服务端在 Windows / Linux 上也能运行，只是虚拟显示器仅支持 macOS。

---

## 目录

- [快速开始](#快速开始)
- [配置 Cloudflare TURN（详细教程）](#配置-cloudflare-turn详细教程)
- [启动选项](#启动选项)
- [工作原理](#工作原理)
- [安全说明](#安全说明)
- [常见问题](#常见问题)
- [已知限制](#已知限制)

---

## 快速开始

### 需要准备

| | 要求 |
|---|---|
| **Mac**（共享屏幕的电脑） | macOS（已在 macOS 26 上测试）· [Node.js](https://nodejs.org) 18+ · Chrome · Xcode 命令行工具（用于编译虚拟显示器，运行 `xcode-select --install` 安装） |
| **Windows**（当显示器的电脑） | 任意现代浏览器（推荐 Chrome / Edge），**不用装任何东西** |

### 三步用起来

**1. 下载项目**
```bash
git clone https://github.com/bohe223/turn-win-to-mac-display.git
cd turn-win-to-mac-display
```

**2. 启动**：在访达里**双击 `start.command`**，或者在终端运行：
```bash
./start.sh
```
- 第一次运行会问你要不要配置 Cloudflare TURN：两台电脑**在同一网络**可以选 `n` 跳过；**跨网络使用**建议选 `y`，按[下面的教程](#配置-cloudflare-turn详细教程)配置，大约 5 分钟。
- 第一次使用时，macOS 会要求允许 Chrome「屏幕录制」：到「系统设置 → 隐私与安全性 → 屏幕录制」里打开 Chrome，然后重启 Chrome。

**3. 照着网页做**：脚本会自动用 Chrome 打开推流页面，页面最上方是 **Windows 要打开的网址**：

1. 把这个网址发到 Windows 上，用浏览器打开（双击画面可全屏）。
2. 在 Mac 页面上点「选择屏幕并开始」，弹窗里选「整个屏幕」→「**Windows Display**」。
3. 把 Mac 上的窗口拖到这块新屏幕上。屏幕的位置可以在「系统设置 → 显示器」里调整。

用完后在终端按 `Ctrl+C`，虚拟显示器和公网地址会一起关掉。

---

## 配置 Cloudflare TURN（详细教程）

### 为什么需要它？

两台电脑不在同一网络时，浏览器会先尝试**直连**。但很多网络（学校、公司、手机 4G/5G）的防火墙会挡住直连，这时需要一台**中转服务器（TURN）**来转发画面。没有 TURN 的话，程序会退回一个很慢的备用模式，每秒只有一两帧。

Cloudflare 提供 TURN 服务：**每月前 1000 GB 免费**，超出后每 GB 0.05 美元。1080p 画面一小时大约 2–7 GB，所以一般用不完免费额度。而且只有直连失败时才走 TURN，能直连的时候不产生费用。

> 两台电脑在同一网络时，不需要配置 TURN。

### 第 1 步：注册 Cloudflare 账号

打开 <https://dash.cloudflare.com/sign-up>，用邮箱注册并验证邮箱。选免费套餐即可。

### 第 2 步：开通 Realtime（TURN）

1. 登录后，在左侧菜单找到 **Realtime → TURN Server**（旧版界面叫 **Calls**）。
2. 第一次进入会显示 **Get Started**。点进去后是订阅页面：
   - 页面会写着 **1,000 GB / month free**，今天应付 **$0.00**。
   - 需要填写**银行卡和账单地址**。这是 Cloudflare 的要求，只有超出免费额度才会扣费。
   - 点 **Save payment details & activate Realtime**。

> 💡 建议顺手设一个账单提醒：Cloudflare 后台 → **Billing** → **Budget alerts**，比如设为 $1。这样万一超出免费额度，你会第一时间收到邮件。

### 第 3 步：创建 TURN Key

1. 回到 **Realtime → TURN Server**，点右上角 **Create**。
2. **Name** 随便填，比如 `my-display`，然后点 **Create**。
3. 页面会显示两个值：
   - **Turn Token ID**：一串 32 位的字符
   - **API Token**：一串更长的字符，**只显示这一次，请马上复制**

### 第 4 步：把密钥填进程序

在项目文件夹里运行：
```bash
./setup-turn.sh
```
按提示粘贴 **Turn Token ID** 和 **API Token**，粘贴 API Token 时屏幕上不会显示内容，这是正常的。脚本会先向 Cloudflare 验证一次，看到 `✅ 验证通过` 就说明配好了。

密钥保存在项目文件夹的 `.turn.env` 文件里：
- 文件权限是 600，只有你自己能读。
- 已经写进 `.gitignore`，**不会被提交到 Git**。
- 密钥只用来在你的 Mac 上申请**临时通行证**（24 小时有效），浏览器拿到的只是这个临时通行证，看不到你的密钥。

### 第 5 步：确认生效

重新运行 `./start.sh`，推流页面上会显示「**TURN 已配置 ✓**」。Windows 连上以后，可以在画面右上角看到当前用的是哪种连接：
- **局域网直连 / 跨网直连**：没有经过 TURN，不产生费用。
- **TURN 中转**：经过 Cloudflare 中转，计入免费额度。

用量可以在 Cloudflare 后台 **Realtime → TURN Server → Analytics** 里查看。

---

## 启动选项

```bash
./start.sh [宽 高] [hidpi] [--lan] [--no-display]
```

| 选项 | 说明 |
|---|---|
| `2560 1440` | 虚拟显示器分辨率，默认 `1920 1080` |
| `hidpi` | 虚拟显示器使用 HiDPI（Retina）模式，更清晰但更费带宽 |
| `--lan` | 只在局域网使用，不开公网隧道 |
| `--no-display` | 不创建虚拟显示器，直接共享现有屏幕 |

| 环境变量 | 说明 |
|---|---|
| `PORT=8765` | 本地端口；隧道使用 `PORT+1` |
| `KEY=...` | 指定观看口令，默认每次随机生成 12 位 |
| `TUNNEL=cloudflared` | 改用 Cloudflare 快速隧道，需要先 `brew install cloudflared` |
| `NO_OPEN=1` | 不自动打开浏览器 |

示例：
```bash
./start.sh 2560 1440 hidpi        # 2K HiDPI 扩展屏
./start.sh --no-display --lan     # 局域网内共享现有屏幕
```

---

## 工作原理

```
┌──────────────────────── Mac ────────────────────────┐
│ ① virtual-display    让 macOS 以为多接了一台显示器    │
│ ② Chrome 推流页面    录制这块屏幕 → H.264 编码        │
│ ③ server.js          信令（介绍两端认识）+ 口令校验   │
│ ④ ssh 隧道           给 ③ 一个公网 https 地址         │
│                      （localhost.run，免费、无需安装）│
└─────────────────────────┬───────────────────────────┘
       信令（数据量很小）经过隧道；视频不经过隧道
                          │
      视频路线（自动选最快）：局域网直连 → 跨网直连 → Cloudflare TURN 中转 → 备用模式
                          ▼
┌────────────────────── Windows ──────────────────────┐
│ ⑤ 浏览器打开网址 → 全屏显示画面                       │
└─────────────────────────────────────────────────────┘
```

- **信令**：两端通过 Mac 上的 `server.js` 交换"怎么连接对方"的信息（WebRTC 的 offer/answer/ICE）。
- **视频**：浏览器之间直接传输（WebRTC，DTLS-SRTP 加密），**不经过 `server.js`，也不经过隧道**。
- **TURN**：直连被防火墙挡住时，视频经过 Cloudflare 的服务器转发。Cloudflare 用任播（Anycast）技术，会自动选离你最近的机房。
- **备用模式**：以上都失败时（20 秒内没连上），改为把画面压成 JPEG 图片，通过隧道逐帧传输。很慢，只用来兜底。

| 文件 | 作用 |
|---|---|
| `start.command` | macOS 双击启动 |
| `start.sh` | 依次启动虚拟显示器、隧道、服务器，退出时一起关闭 |
| `setup-turn.sh` | 配置并验证 Cloudflare TURN 密钥 |
| `virtual-display.m` | 虚拟显示器（Objective-C，第一次启动时自动编译） |
| `server.js` | 信令 + 静态文件服务器（Node.js，零依赖） |
| `public/sender.html` | 推流页面（Mac） |
| `public/viewer.html` | 显示页面（Windows） |

---

## 安全说明

- **观看口令**：每次启动随机生成 12 位十六进制（48 bit），网址里不带口令的人看不到画面。
- **推流端只允许本机访问**：程序会检查请求的来源地址、Host 和 Origin，局域网里的其他人、公网隧道、以及你浏览器里打开的其他网站，都无法冒充推流端。
- **公网隧道的提供方**（localhost.run 或 Cloudflare）能看到经过隧道的信令内容，包括口令。**视频本身不经过隧道**，并且端到端加密。在意这一点的话，可以用 `--lan` 只在局域网使用。
- **每次启动网址和口令都会变**，关掉程序后旧网址立即失效。
- **TURN 密钥**只保存在你的 Mac 上（`.turn.env`，已被 git 忽略）。

---

## 常见问题

**启动时提示「公网隧道没建起来」**
你所在的网络可能拦截了 localhost.run。可以试试 Cloudflare 的隧道：
```bash
brew install cloudflared
TUNNEL=cloudflared ./start.sh
```
有些网络（比如部分大学）会拦截 Cloudflare 快速隧道。这种情况下只能用局域网模式 `--lan`，或者换一个网络。

**Windows 上显示「no tunnel」或打不开**
免费隧道会不定时更换网址。到 Mac 推流页面上看最新的网址，页面每 5 秒自动更新一次。已经在播放的画面不受影响。

**画面很卡，右上角显示「备用模式」**
说明直连失败了，而且没有配置 TURN。请按[教程](#配置-cloudflare-turn详细教程)配置 TURN。

**点「开始」后提示没有权限**
到「系统设置 → 隐私与安全性 → 屏幕录制」允许 Chrome，然后**重启 Chrome**。

**找不到「Windows Display」**
确认终端里有「✅ Virtual display created / 虚拟显示器已创建」这一行。如果编译失败，先运行 `xcode-select --install` 安装命令行工具。

**想降低延迟**
在推流页面保持「清晰优先」、60 帧即可。移动鼠标时，Windows 画面右上角会显示往返时间、缓冲、解码各花了多少毫秒。延迟主要取决于网络：同一局域网最快，TURN 中转会多几十毫秒。

**Windows 能控制 Mac 吗？**
目前不能，只能显示画面。可以把 Mac 的鼠标移到虚拟屏上进行操作。

---

## 已知限制

- 虚拟显示器使用 macOS 的**私有接口** `CGVirtualDisplay`（[DeskPad](https://github.com/Stengo/DeskPad)、BetterDisplay 也在用）。未来的 macOS 更新可能让它失效。
- 推流端需要电脑版 Chrome（或 Edge）。
- 界面支持中文和英文，默认跟随浏览器语言，页面上可以手动切换。
- 免费的 localhost.run 隧道会不定时更换网址。想要固定网址，需要自己的域名和隧道服务。
- 每个观看端单独编码一路视频，观看的人越多，Mac 的上传带宽占用越大。

---

## 许可证

[Apache License 2.0](LICENSE)：可以自由使用、修改、商用，需要保留版权和许可声明。
