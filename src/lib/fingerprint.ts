/**
 * Advanced device fingerprinting for fraud prevention.
 * Combines multiple signals: Canvas, WebGL, Audio, Screen, Timezone, Plugins, Fonts, etc.
 */

const getCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, 😃", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, 😃", 4, 17);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgb(255,0,255)";
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
};

const getWebGLFingerprint = (): string => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";
    const g = gl as WebGLRenderingContext;
    const debugInfo = g.getExtension("WEBGL_debug_renderer_info");
    const vendor = debugInfo ? g.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "unknown";
    const renderer = debugInfo ? g.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown";
    const version = g.getParameter(g.VERSION);
    const shadingLang = g.getParameter(g.SHADING_LANGUAGE_VERSION);
    const maxTexSize = g.getParameter(g.MAX_TEXTURE_SIZE);
    const maxAniso = g.getExtension("EXT_texture_filter_anisotropic")
      ? g.getParameter(g.getExtension("EXT_texture_filter_anisotropic")!.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
      : 0;
    return `${vendor}|${renderer}|${version}|${shadingLang}|${maxTexSize}|${maxAniso}`;
  } catch {
    return "webgl-error";
  }
};

const getAudioFingerprint = (): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) { resolve("no-audio"); return; }
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gain = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0; // mute
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(10000, context.currentTime);
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gain);
      gain.connect(context.destination);
      oscillator.start(0);

      scriptProcessor.onaudioprocess = (event) => {
        const data = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
        oscillator.disconnect();
        scriptProcessor.disconnect();
        context.close();
        resolve(sum.toString(36).substring(0, 16));
      };

      setTimeout(() => {
        try { oscillator.disconnect(); scriptProcessor.disconnect(); context.close(); } catch {}
        resolve("audio-timeout");
      }, 1000);
    } catch {
      resolve("audio-error");
    }
  });
};

const getScreenFingerprint = (): string => {
  const s = window.screen;
  return `${s.width}x${s.height}x${s.colorDepth}|${s.availWidth}x${s.availHeight}|${window.devicePixelRatio}`;
};

const getNavigatorFingerprint = (): string => {
  const n = navigator;
  const plugins = n.plugins ? Array.from(n.plugins).map(p => p.name).sort().join(",") : "";
  const mimeTypes = n.mimeTypes ? Array.from(n.mimeTypes).map(m => m.type).sort().join(",") : "";
  const langs = n.languages ? n.languages.join(",") : n.language;
  const cores = n.hardwareConcurrency || 0;
  const memory = (n as any).deviceMemory || 0;
  const touchPoints = n.maxTouchPoints || 0;
  const platform = n.platform || "";
  const doNotTrack = n.doNotTrack || "";
  return `${n.userAgent}|${platform}|${langs}|${cores}|${memory}|${touchPoints}|${doNotTrack}|${plugins}|${mimeTypes}`;
};

const getTimezoneFingerprint = (): string => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = new Date().getTimezoneOffset();
  return `${tz}|${offset}`;
};

const getFontFingerprint = (): string => {
  const testFonts = [
    "monospace", "sans-serif", "serif",
    "Arial", "Courier New", "Georgia", "Helvetica", "Times New Roman",
    "Trebuchet MS", "Verdana", "Comic Sans MS", "Impact", "Lucida Console",
    "Palatino Linotype", "Tahoma", "Century Gothic"
  ];
  const baseFonts = ["monospace", "sans-serif", "serif"];
  const testString = "mmmmmmmmmmlli";
  const testSize = "72px";
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.left = "-9999px";
  span.style.fontSize = testSize;
  span.innerHTML = testString;
  document.body.appendChild(span);

  const baseWidths: Record<string, number> = {};
  for (const base of baseFonts) {
    span.style.fontFamily = base;
    baseWidths[base] = span.offsetWidth;
  }

  const detected: string[] = [];
  for (const font of testFonts) {
    for (const base of baseFonts) {
      span.style.fontFamily = `'${font}', ${base}`;
      if (span.offsetWidth !== baseWidths[base]) {
        detected.push(font);
        break;
      }
    }
  }
  document.body.removeChild(span);
  return detected.join(",");
};

const getStorageFingerprint = (): string => {
  const signals: string[] = [];
  try { signals.push(localStorage ? "ls:1" : "ls:0"); } catch { signals.push("ls:x"); }
  try { signals.push(sessionStorage ? "ss:1" : "ss:0"); } catch { signals.push("ss:x"); }
  try { signals.push(indexedDB ? "idb:1" : "idb:0"); } catch { signals.push("idb:x"); }
  try { signals.push(document.cookie !== undefined ? "ck:1" : "ck:0"); } catch { signals.push("ck:x"); }
  return signals.join("|");
};

const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  // Generate a longer hash by combining multiple passes
  let hash2 = 5381;
  for (let i = 0; i < str.length; i++) {
    hash2 = ((hash2 << 5) + hash2) + str.charCodeAt(i);
    hash2 |= 0;
  }
  return Math.abs(hash).toString(36) + Math.abs(hash2).toString(36);
};

export interface DeviceFingerprint {
  fingerprint: string;
  canvas_hash: string;
  webgl_hash: string;
  audio_hash: string;
  screen_info: string;
  timezone: string;
  fonts_hash: string;
  navigator_hash: string;
  storage_signals: string;
}

export const generateFingerprint = async (): Promise<DeviceFingerprint> => {
  const canvas = getCanvasFingerprint();
  const webgl = getWebGLFingerprint();
  const audio = await getAudioFingerprint();
  const screen = getScreenFingerprint();
  const nav = getNavigatorFingerprint();
  const tz = getTimezoneFingerprint();
  const fonts = getFontFingerprint();
  const storage = getStorageFingerprint();

  const combined = `${canvas}|${webgl}|${audio}|${screen}|${nav}|${tz}|${fonts}|${storage}`;
  const fingerprint = hashString(combined);

  return {
    fingerprint,
    canvas_hash: hashString(canvas),
    webgl_hash: hashString(webgl),
    audio_hash: audio,
    screen_info: screen,
    timezone: tz,
    navigator_hash: hashString(nav),
    fonts_hash: hashString(fonts),
    storage_signals: storage,
  };
};

export const getClientIP = async (): Promise<string> => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "unknown";
  } catch {
    return "unknown";
  }
};

export const logDeviceAdvanced = async (userId: string, eventType: string, supabase: any) => {
  try {
    const [fp, ip] = await Promise.all([generateFingerprint(), getClientIP()]);
    await supabase.from("device_logs").insert({
      user_id: userId,
      ip_address: ip,
      user_agent: navigator.userAgent,
      fingerprint: fp.fingerprint,
      event_type: eventType,
      canvas_hash: fp.canvas_hash,
      webgl_hash: fp.webgl_hash,
      audio_hash: fp.audio_hash,
      screen_info: fp.screen_info,
      timezone: fp.timezone,
      fonts_hash: fp.fonts_hash,
    });
  } catch { /* silent */ }
};

/**
 * Check if the current device fingerprint matches any existing accounts.
 * Returns matching user IDs if found.
 */
export const checkDuplicateDevice = async (supabase: any): Promise<{ isDuplicate: boolean; matchCount: number }> => {
  try {
    const fp = await generateFingerprint();
    const ip = await getClientIP();
    
    // Check by fingerprint OR canvas+webgl combo
    const { data, error } = await supabase
      .from("device_logs")
      .select("user_id")
      .or(`fingerprint.eq.${fp.fingerprint},and(canvas_hash.eq.${fp.canvas_hash},webgl_hash.eq.${fp.webgl_hash})`)
      .limit(10);
    
    if (error || !data) return { isDuplicate: false, matchCount: 0 };
    
    // Get unique user IDs
    const uniqueUsers = new Set(data.map((d: any) => d.user_id));
    return { isDuplicate: uniqueUsers.size > 0, matchCount: uniqueUsers.size };
  } catch {
    return { isDuplicate: false, matchCount: 0 };
  }
};
