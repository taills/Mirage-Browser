import type { FingerprintConfig, FingerprintOverride } from '../types';
import { GPU_PRESET_MAP, getGpuPoolForPlatform } from '../shared/gpu-presets';

const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Bangkok', 'America/New_York', 'America/Los_Angeles',
  'America/Chicago', 'America/Toronto', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Moscow', 'Australia/Sydney', 'America/Sao_Paulo',
];

const LANGUAGES = [
  'zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja', 'ko', 'fr-FR',
  'de-DE', 'es-ES', 'pt-BR', 'ru', 'it-IT', 'nl-NL', 'ar',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
];

const SCREEN_SIZES = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1600, height: 900 },
  { width: 1280, height: 1024 },
];

/** 地区坐标预设，key 供前端下拉引用 */
export const GEO_PRESET_MAP: Record<string, { lat: number; lon: number }> = {
  Shanghai:   { lat: 31.2304,  lon: 121.4737  },
  Beijing:    { lat: 39.9042,  lon: 116.4074  },
  HongKong:   { lat: 22.3193,  lon: 114.1694  },
  Taiwan:     { lat: 25.0330,  lon: 121.5654  },
  Tokyo:      { lat: 35.6762,  lon: 139.6503  },
  Seoul:      { lat: 37.5665,  lon: 126.9780  },
  Singapore:  { lat:  1.3521,  lon: 103.8198  },
  NewYork:    { lat: 40.7128,  lon: -74.0060  },
  LosAngeles: { lat: 34.0522,  lon: -118.2437 },
  Chicago:    { lat: 41.8781,  lon: -87.6298  },
  London:     { lat: 51.5074,  lon:  -0.1278  },
  Paris:      { lat: 48.8566,  lon:   2.3522  },
  Berlin:     { lat: 52.5200,  lon:  13.4050  },
  Moscow:     { lat: 55.7558,  lon:  37.6176  },
  Sydney:     { lat: -33.8688, lon: 151.2093  },
};

const GEO_LOCATIONS = Object.values(GEO_PRESET_MAP);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/</g, '\\x3C');
}

function sanitizeOverrideText(value: string | undefined, maxLen = 256): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withoutControlChars = Array.from(trimmed)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(code <= 0x1f || code === 0x7f);
    })
    .join('');
  return withoutControlChars ? withoutControlChars.slice(0, maxLen) : undefined;
}

function pickGpuForPlatform(platform: string): { vendor: string; renderer: string } {
  const pool = getGpuPoolForPlatform(platform);
  const presetKey = pick(pool);
  const preset = GPU_PRESET_MAP[presetKey] ?? GPU_PRESET_MAP.nvidia_gtx1060;
  return {
    vendor: preset.vendor,
    renderer: preset.renderer,
  };
}

export function getPlatformVersionForUserAgentData(platform: string | undefined): string {
  return platform === 'Win32' ? '15.0.0'
    : platform === 'MacIntel' ? '14.0.0'
    : platform === 'iPhone' ? '17.0.0'
    : '0.0.0';
}

export function generateFingerprint(): FingerprintConfig {
  const geo = pick(GEO_LOCATIONS);
  const screen = pick(SCREEN_SIZES);
  const platform = pick(['Win32', 'Win32', 'Win32', 'Win32', 'MacIntel', 'Linux x86_64']);
  const gpu = pickGpuForPlatform(platform);
  return {
    timezone: pick(TIMEZONES),
    language: pick(LANGUAGES),
    latitude: geo.lat + (Math.random() - 0.5) * 0.2,
    longitude: geo.lon + (Math.random() - 0.5) * 0.2,
    canvasSeed: randInt(1, 0x7fffffff),
    webglSeed: randInt(1, 0x7fffffff),
    hardwareConcurrency: pick([2, 4, 4, 6, 8, 8, 12, 16]),
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: pick([24, 24, 30, 32]),
    deviceMemory: pick([2, 4, 4, 8, 8]),
    screenRefreshRate: pick([60, 60, 60, 60, 120, 144]),
    platform,
    architecture: pick(['x86', 'x86', 'x86', 'arm']),
    maxTouchPoints: 0,
    devicePixelRatio: pick([1, 1, 1, 1.25, 1.5, 2]),
    networkEffectiveType: pick(['4g', '4g', '4g', '3g']),
    batteryCharging: pick([true, true, false]),
    batteryLevel: pick([0.4, 0.6, 0.8, 0.8, 1]),
    gpuVendor: gpu.vendor,
    gpuRenderer: gpu.renderer,
  };
}

/** 生成指纹，并按 override 字段覆盖指定值（空字符串 / undefined 表示随机） */
export function generateFingerprintWithOverride(
  override: FingerprintOverride,
): { fingerprint: FingerprintConfig; userAgent: string } {
  const base = generateFingerprint();
  let ua = generateUserAgent();

  if (override.timezone) base.timezone = override.timezone;
  if (override.language) base.language = override.language;

  if (override.geoPreset && GEO_PRESET_MAP[override.geoPreset]) {
    const geo = GEO_PRESET_MAP[override.geoPreset];
    base.latitude  = geo.lat + (Math.random() - 0.5) * 0.1;
    base.longitude = geo.lon + (Math.random() - 0.5) * 0.1;
  }

  if (override.userAgent) ua = override.userAgent;

  if (override.hardwareConcurrency) base.hardwareConcurrency = override.hardwareConcurrency;

  if (override.deviceMemory) base.deviceMemory = override.deviceMemory;

  if (override.screenRefreshRate) base.screenRefreshRate = override.screenRefreshRate;

  if (override.platform)                      base.platform = override.platform;
  if (override.architecture)                  base.architecture = override.architecture;
  if (override.maxTouchPoints !== undefined)  base.maxTouchPoints = override.maxTouchPoints;
  if (override.devicePixelRatio)              base.devicePixelRatio = override.devicePixelRatio;
  if (override.networkEffectiveType)          base.networkEffectiveType = override.networkEffectiveType;
  if (override.batteryCharging !== undefined) base.batteryCharging = override.batteryCharging;
  if (override.batteryLevel !== undefined)    base.batteryLevel = override.batteryLevel;
  const sanitizedGpuVendor = sanitizeOverrideText(override.gpuVendor);
  const sanitizedGpuRenderer = sanitizeOverrideText(override.gpuRenderer, 512);
  if (sanitizedGpuVendor)                      base.gpuVendor = sanitizedGpuVendor;
  if (sanitizedGpuRenderer)                    base.gpuRenderer = sanitizedGpuRenderer;

  if (override.platform && (sanitizedGpuVendor === undefined || sanitizedGpuRenderer === undefined)) {
    const gpu = pickGpuForPlatform(base.platform);
    if (sanitizedGpuVendor === undefined) {
      base.gpuVendor = gpu.vendor;
    }
    if (sanitizedGpuRenderer === undefined) {
      base.gpuRenderer = gpu.renderer;
    }
  }

  if (override.screenPreset) {
    const [w, h] = override.screenPreset.split('x').map(Number);
    if (w && h) { base.screenWidth = w; base.screenHeight = h; }
  }

  return { fingerprint: base, userAgent: ua };
}

export function generateUserAgent(): string {
  return pick(USER_AGENTS);
}

/** 生成注入到每个新文档的指纹覆写 JS 脚本 */
export function buildFingerprintScript(fp: FingerprintConfig, ua: string): string {
  const lang = escapeJsString(fp.language || 'zh-CN');
  const noiseByte = fp.canvasSeed % 16;
  const webglHash = fp.webglSeed % 10000;
  const gpuVendor = escapeJsString(fp.gpuVendor || '');
  const gpuRenderer = escapeJsString((fp.gpuRenderer || '').replace('{HASH}', String(webglHash)));
  const uaDataPlatformRaw = fp.platform === 'Win32' ? 'Windows'
    : fp.platform === 'MacIntel' ? 'macOS'
    : fp.platform === 'iPhone' ? 'iOS' : 'Linux';
  const uaDataPlatform = escapeJsString(uaDataPlatformRaw);
  const uaDataPlatformVersion = escapeJsString(getPlatformVersionForUserAgentData(fp.platform));
  const platform = escapeJsString(fp.platform || '');
  const architecture = escapeJsString(fp.architecture || '');
  const networkEffectiveType = escapeJsString(fp.networkEffectiveType || '4g');
  const isMobile = fp.maxTouchPoints > 0;
  const battCharging = fp.batteryCharging ?? false;
  const battLevel    = fp.batteryLevel    ?? 0.8;
  const battChargingTime = battCharging ? Math.floor(3600 * (1 - battLevel)) : 'Infinity';
  const battDischargingTime = battCharging ? 'Infinity' : Math.floor(battLevel * 14400);
  return `(function(){
  // Language — prototype first, then instance fallback
  try{Object.defineProperty(Navigator.prototype,'language',{get:()=>'${lang}',configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'language',{get:()=>'${lang}',configurable:true});}catch(e2){}}
  try{Object.defineProperty(Navigator.prototype,'languages',{get:()=>['${lang}','en'],configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'languages',{get:()=>['${lang}','en'],configurable:true});}catch(e2){}}
  // Hardware — prototype first
  try{Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{get:()=>${fp.hardwareConcurrency},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>${fp.hardwareConcurrency},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Navigator.prototype,'deviceMemory',{get:()=>${fp.deviceMemory},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'deviceMemory',{get:()=>${fp.deviceMemory},configurable:true});}catch(e2){}}
  // maxTouchPoints — prototype first (isTouch = navigator.maxTouchPoints > 0)
  try{Object.defineProperty(Navigator.prototype,'maxTouchPoints',{get:()=>${fp.maxTouchPoints},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'maxTouchPoints',{get:()=>${fp.maxTouchPoints},configurable:true});}catch(e2){}}
  ${fp.maxTouchPoints > 0
    ? `try{if(!('ontouchstart' in window))window.ontouchstart=null;}catch(e){}
  try{if(typeof TouchEvent==='undefined')window.TouchEvent=function TouchEvent(){};if(typeof Touch==='undefined')window.Touch=function Touch(){};}catch(e){}`
    : `try{delete window.ontouchstart;}catch(e){}`}
  // Screen — prototype first (Screen.prototype 覆盖比 screen 实例更可靠)
  try{Object.defineProperty(Screen.prototype,'width',{get:()=>${fp.screenWidth},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'width',{get:()=>${fp.screenWidth},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Screen.prototype,'height',{get:()=>${fp.screenHeight},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'height',{get:()=>${fp.screenHeight},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Screen.prototype,'availWidth',{get:()=>${fp.screenWidth},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'availWidth',{get:()=>${fp.screenWidth},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Screen.prototype,'availHeight',{get:()=>${fp.screenHeight},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'availHeight',{get:()=>${fp.screenHeight},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Screen.prototype,'colorDepth',{get:()=>${fp.colorDepth},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'colorDepth',{get:()=>${fp.colorDepth},configurable:true});}catch(e2){}}
  try{Object.defineProperty(Screen.prototype,'pixelDepth',{get:()=>${fp.colorDepth},configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(screen,'pixelDepth',{get:()=>${fp.colorDepth},configurable:true});}catch(e2){}}
  try{Object.defineProperty(screen,'refreshRate',{get:()=>${fp.screenRefreshRate},configurable:true});}catch(e){}
  // Platform — prototype first
  try{Object.defineProperty(Navigator.prototype,'platform',{get:()=>'${platform}',configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'platform',{get:()=>'${platform}',configurable:true});}catch(e2){}}
  try{Object.defineProperty(window,'devicePixelRatio',{get:()=>${fp.devicePixelRatio},configurable:true});}catch(e){}
  // Network Connection
  try{
    const _conn={effectiveType:'${networkEffectiveType}',downlink:10,rtt:50,saveData:false,addEventListener:()=>{},removeEventListener:()=>{}};
    try{Object.defineProperty(Navigator.prototype,'connection',{get:()=>_conn,configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'connection',{get:()=>_conn,configurable:true});}catch(e2){}}
    try{Object.defineProperty(navigator,'mozConnection',{get:()=>_conn,configurable:true});}catch(e){}
    try{Object.defineProperty(navigator,'webkitConnection',{get:()=>_conn,configurable:true});}catch(e){}
  }catch(e){}
  // Battery API — prototype first (navigator.getBattery().then(b=>b.charging/b.level))
  try{
    const _bat={charging:${battCharging},chargingTime:${battChargingTime},dischargingTime:${battDischargingTime},level:${battLevel},addEventListener:()=>{},removeEventListener:()=>{}};
    const _getBattery=()=>Promise.resolve(_bat);
    try{Object.defineProperty(Navigator.prototype,'getBattery',{value:_getBattery,configurable:true,writable:true,enumerable:true});}catch(e){}
    try{Navigator.prototype.getBattery=_getBattery;}catch(e){}
    try{Object.defineProperty(navigator,'getBattery',{value:_getBattery,configurable:true,writable:true});}catch(e){}
    try{navigator.getBattery=_getBattery;}catch(e){}
  }catch(e){}
  // User-Agent Data (architecture)
  try{if(navigator.userAgentData){const _uad={brands:navigator.userAgentData.brands,mobile:${isMobile},platform:'${uaDataPlatform}',getHighEntropyValues:async()=>({architecture:'${architecture}',bitness:'64',mobile:${isMobile},platform:'${uaDataPlatform}',platformVersion:'${uaDataPlatformVersion}'})};try{Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>_uad,configurable:true,enumerable:true});}catch(e){try{Object.defineProperty(navigator,'userAgentData',{get:()=>_uad,configurable:true});}catch(e2){}}}}catch(e){}
  // Canvas noise (seed:${fp.canvasSeed})
  try{
    const _toDataURL=HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL=function(){
      const ctx=this.getContext('2d');
      if(ctx){const d=ctx.getImageData(0,0,1,1);d.data[0]=(d.data[0]+${noiseByte})%256;ctx.putImageData(d,0,0);}
      return _toDataURL.apply(this,arguments);
    };
  }catch(e){}
  // WebGL noise (seed:${fp.webglSeed})
  try{
    const VENDOR=7936;
    const RENDERER=7937;
    const UNMASKED_VENDOR_WEBGL=37445;
    const UNMASKED_RENDERER_WEBGL=37446;
    const patchGetParameter=(proto)=>{
      if(!proto||typeof proto.getParameter!=='function')return;
      const rawGetParameter=proto.getParameter;
      proto.getParameter=function(p){
        if(p===UNMASKED_VENDOR_WEBGL||p===VENDOR)return'${gpuVendor}';
        if(p===UNMASKED_RENDERER_WEBGL||p===RENDERER)return'${gpuRenderer}';
        return rawGetParameter.apply(this,arguments);
      };
    };
    patchGetParameter(WebGLRenderingContext&&WebGLRenderingContext.prototype);
    patchGetParameter(typeof WebGL2RenderingContext!=='undefined'&&WebGL2RenderingContext.prototype);
  }catch(e){}
})();`;
}
