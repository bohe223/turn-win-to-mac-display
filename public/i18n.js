// 简单的多语言支持：默认跟随浏览器语言，用户手动切换后记在本机。
// Tiny i18n: follows the browser language by default; a manual choice is remembered locally.
(function () {
  const DICT = {
    zh: {
      // ---- 推流端 sender ----
      senderTitle: '推流端 · turn-win-to-mac-display',
      senderHeading: '推流端',
      step1: '① 在 Windows（或另一台电脑）的浏览器里打开这个网址',
      loading: '正在获取…',
      copy: '复制',
      copied: '已复制 ✓',
      otherAddrs: '其他地址',
      sameNetwork: '同一网络：',
      publicAddr: '公网：',
      none: '无',
      step2: '② 开始推流',
      li1: '点下面的「选择屏幕并开始」。',
      li2: '在弹窗里选「整个屏幕」→「<b>Windows Display</b>」（虚拟显示器），或你想共享的屏幕。',
      li3: '把窗口拖到这块新屏幕上（在「系统设置 → 显示器」里可以调整它的位置）。',
      mode: '模式',
      modeSharp: '清晰优先（适合文字）',
      modeSmooth: '流畅优先（适合动画）',
      fps: '帧率',
      bitrate: '码率',
      fallbackSettings: '备用模式设置（极少用到）',
      quality: '画质',
      low: '低', mid: '中', high: '高',
      scale: '分辨率',
      start: '选择屏幕并开始',
      stop: '停止',
      notStarted: '未开始。',
      noServer: '无法连接本机服务，请确认 start.sh 还在运行。',
      noAddr: '没有可用的网络地址',
      notePublic: '公网地址：任何网络都能打开。免费隧道偶尔会换网址，以这里显示的为准（已经打开的画面不受影响）。',
      noteLan: '局域网地址：两台电脑需要在同一网络。想跨网络使用，启动时不要加 --lan。',
      turnOk: 'TURN 已配置 ✓',
      turnMissing: '未配置 TURN：跨网络时可能很卡（运行 ./setup-turn.sh）',
      statusLive: '推流中 · 已连接 {n} 个 · 备用模式 {m} 个',
      statusIdle: '未推流 · 等待中的观看端 {n} 个',
      replaced: '另一个推流页面已接管，本页已停用。',
      noPermission: '没有获得屏幕录制权限：{e}。Mac 上请在「系统设置 → 隐私与安全性 → 屏幕录制」里允许浏览器，然后重启浏览器。',
      // ---- 连接路径 connection path ----
      pathRelay: 'TURN 中转',
      pathLan: '局域网直连',
      pathDirect: '跨网直连',
      // ---- 观看端 viewer ----
      viewerTitle: 'Mac 显示器',
      connecting: '正在连接…',
      fullscreen: '全屏显示',
      hint: '双击或按 F 全屏 · Esc 退出',
      waitStart: '等待 Mac 开始推流…',
      senderClosed: 'Mac 上的推流页面没有打开。',
      establishing: '正在建立连接…',
      stopped: 'Mac 已停止推流，等待重新开始…',
      interrupted: '连接中断，等待恢复…',
      cantReach: '无法连接 Mac（口令错误或服务没有运行），5 秒后重试…',
      reconnecting: '与 Mac 的连接断开，正在重连…',
      fbWaiting: '备用模式：等待 Mac 推流…',
      fbError: '备用模式：连接 Mac 出错（{s}），重试中…',
      fbNetwork: '备用模式：网络中断，重试中…',
      modeConnecting: '连接中',
      modeFallback: '备用模式',
      signalLost: '（信令已断开，画面不受影响）',
      statRtt: '往返', statBuffer: '缓冲', statDecode: '解码', statLatency: '估算总延迟',
      switchLang: 'English',
    },
    en: {
      senderTitle: 'Sender · turn-win-to-mac-display',
      senderHeading: 'Sender',
      step1: '① Open this URL in a browser on Windows (or any other computer)',
      loading: 'Loading…',
      copy: 'Copy',
      copied: 'Copied ✓',
      otherAddrs: 'Other addresses',
      sameNetwork: 'Same network: ',
      publicAddr: 'Public: ',
      none: 'none',
      step2: '② Start sharing',
      li1: 'Click “Choose screen & start” below.',
      li2: 'In the popup pick “Entire Screen” → “<b>Windows Display</b>” (the virtual display), or any screen you want to share.',
      li3: 'Drag windows onto the new display (arrange it in System Settings → Displays).',
      mode: 'Mode',
      modeSharp: 'Sharp (best for text)',
      modeSmooth: 'Smooth (best for motion)',
      fps: 'FPS',
      bitrate: 'Bitrate',
      fallbackSettings: 'Fallback mode settings (rarely needed)',
      quality: 'Quality',
      low: 'Low', mid: 'Medium', high: 'High',
      scale: 'Scale',
      start: 'Choose screen & start',
      stop: 'Stop',
      notStarted: 'Not started.',
      noServer: 'Cannot reach the local server. Is start.sh still running?',
      noAddr: 'No network address available',
      notePublic: 'Public URL: works from any network. Free tunnels occasionally change the URL; this page always shows the current one (an open stream is not affected).',
      noteLan: 'LAN URL: both computers must be on the same network. To use it across networks, start without --lan.',
      turnOk: 'TURN configured ✓',
      turnMissing: 'TURN not configured: may be choppy across networks (run ./setup-turn.sh)',
      statusLive: 'Streaming · {n} connected · {m} in fallback mode',
      statusIdle: 'Not streaming · {n} viewer(s) waiting',
      replaced: 'Another sender page took over; this page is now inactive.',
      noPermission: 'Screen recording was not allowed: {e}. On a Mac, allow your browser in System Settings → Privacy & Security → Screen Recording, then restart the browser.',
      pathRelay: 'TURN relay',
      pathLan: 'LAN direct',
      pathDirect: 'Direct (internet)',
      viewerTitle: 'Mac Display',
      connecting: 'Connecting…',
      fullscreen: 'Full screen',
      hint: 'Double-click or press F for full screen · Esc to exit',
      waitStart: 'Waiting for the Mac to start sharing…',
      senderClosed: 'The sender page on the Mac is not open.',
      establishing: 'Establishing connection…',
      stopped: 'The Mac stopped sharing. Waiting for it to start again…',
      interrupted: 'Connection interrupted, waiting to recover…',
      cantReach: 'Cannot reach the Mac (wrong key, or the server is not running). Retrying in 5 s…',
      reconnecting: 'Lost connection to the Mac, reconnecting…',
      fbWaiting: 'Fallback mode: waiting for the Mac…',
      fbError: 'Fallback mode: error contacting the Mac ({s}), retrying…',
      fbNetwork: 'Fallback mode: network error, retrying…',
      modeConnecting: 'Connecting',
      modeFallback: 'Fallback',
      signalLost: ' (signaling lost, video unaffected)',
      statRtt: 'RTT', statBuffer: 'buffer', statDecode: 'decode', statLatency: 'est. latency',
      switchLang: '中文',
    },
  };

  function detect() {
    try { const saved = localStorage.getItem('lang'); if (saved && DICT[saved]) return saved; } catch {}
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
    return /^zh\b/i.test(langs[0]) ? 'zh' : 'en'; // 首选语言是中文就用中文，否则英文
  }

  let lang = detect();
  const listeners = [];

  // t('key', { n: 3 }) → 当前语言的文字，{n} 会被替换
  function t(key, vars) {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  }

  // 把页面上带 data-i18n / data-i18n-html / data-i18n-title 的元素换成当前语言
  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    const titleKey = document.documentElement.dataset.i18nTitle;
    if (titleKey) document.title = t(titleKey);
    for (const fn of listeners) fn(lang);
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem('lang', next); } catch {}
    apply();
  }

  window.i18n = {
    t, apply,
    get lang() { return lang; },
    toggle() { setLang(lang === 'zh' ? 'en' : 'zh'); },
    onChange(fn) { listeners.push(fn); },
  };
})();
