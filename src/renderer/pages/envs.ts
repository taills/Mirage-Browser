import type { Environment, EnvRuntime, FingerprintOverride, ProxySource, ProxyNode } from '../../types';
import { GPU_PRESET_MAP } from '../../shared/gpu-presets';
import { showModal, showConfirm } from '../modal';
import { toast } from '../toast';

const api = window.api;

// ── 指纹预设选项（与 main/fingerprint.ts 保持同步） ──────────────────────────
const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '🎲 随机' },
  { value: 'Asia/Shanghai',    label: '🇨🇳 中国标准时间 (UTC+8)' },
  { value: 'Asia/Hong_Kong',   label: '🇭🇰 香港时间 (UTC+8)' },
  { value: 'Asia/Taipei',      label: '🇹🇼 台湾时间 (UTC+8)' },
  { value: 'Asia/Tokyo',       label: '🇯🇵 日本时间 (UTC+9)' },
  { value: 'Asia/Seoul',       label: '🇰🇷 韩国时间 (UTC+9)' },
  { value: 'Asia/Singapore',   label: '🇸🇬 新加坡时间 (UTC+8)' },
  { value: 'Asia/Bangkok',     label: '🇹🇭 泰国时间 (UTC+7)' },
  { value: 'America/New_York', label: '🇺🇸 美国东部 (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 美国西部 (UTC-8/-7)' },
  { value: 'America/Chicago',  label: '🇺🇸 美国中部 (UTC-6/-5)' },
  { value: 'Europe/London',    label: '🇬🇧 英国时间 (UTC+0/+1)' },
  { value: 'Europe/Paris',     label: '🇫🇷 中欧时间 (UTC+1/+2)' },
  { value: 'Europe/Berlin',    label: '🇩🇪 德国时间 (UTC+1/+2)' },
  { value: 'Europe/Moscow',    label: '🇷🇺 莫斯科时间 (UTC+3)' },
  { value: 'Australia/Sydney', label: '🇦🇺 澳大利亚东部 (UTC+10/+11)' },
];

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',      label: '🎲 随机' },
  { value: 'zh-CN', label: '简体中文 (zh-CN)' },
  { value: 'zh-TW', label: '繁體中文 (zh-TW)' },
  { value: 'en-US', label: 'English US (en-US)' },
  { value: 'en-GB', label: 'English UK (en-GB)' },
  { value: 'ja',    label: '日本語 (ja)' },
  { value: 'ko',    label: '한국어 (ko)' },
  { value: 'fr-FR', label: 'Français (fr-FR)' },
  { value: 'de-DE', label: 'Deutsch (de-DE)' },
  { value: 'es-ES', label: 'Español (es-ES)' },
  { value: 'pt-BR', label: 'Português BR (pt-BR)' },
  { value: 'ru',    label: 'Русский (ru)' },
  { value: 'ar',    label: 'العربية (ar)' },
];

const GEO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',          label: '🎲 随机' },
  { value: 'Shanghai',  label: '🇨🇳 中国-上海' },
  { value: 'Beijing',   label: '🇨🇳 中国-北京' },
  { value: 'HongKong',  label: '🇭🇰 香港' },
  { value: 'Taiwan',    label: '🇹🇼 台湾-台北' },
  { value: 'Tokyo',     label: '🇯🇵 日本-东京' },
  { value: 'Seoul',     label: '🇰🇷 韩国-首尔' },
  { value: 'Singapore', label: '🇸🇬 新加坡' },
  { value: 'NewYork',   label: '🇺🇸 美国-纽约' },
  { value: 'LosAngeles',label: '🇺🇸 美国-洛杉矶' },
  { value: 'Chicago',   label: '🇺🇸 美国-芝加哥' },
  { value: 'London',    label: '🇬🇧 英国-伦敦' },
  { value: 'Paris',     label: '🇫🇷 法国-巴黎' },
  { value: 'Berlin',    label: '🇩🇪 德国-柏林' },
  { value: 'Moscow',    label: '🇷🇺 俄罗斯-莫斯科' },
  { value: 'Sydney',    label: '🇦🇺 澳大利亚-悉尼' },
];

const GEO_PRESET_COORD_MAP: Record<string, { lat: number; lon: number }> = {
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

function inferGeoPresetByCoords(lat: number | undefined, lon: number | undefined): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  const GEO_PRESET_MATCH_THRESHOLD_SQ = 0.1225;
  let bestKey = '';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [key, coord] of Object.entries(GEO_PRESET_COORD_MAP)) {
    const dLat = safeLat - coord.lat;
    const dLon = safeLon - coord.lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < bestDist) {
      bestDist = distSq;
      bestKey = key;
    }
  }
  // 随机偏移在 ±0.1~0.2 度内，阈值 0.35² 可稳定识别预设点
  return bestDist <= GEO_PRESET_MATCH_THRESHOLD_SQ ? bestKey : '';
}

const UA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '🎲 随机' },
  { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    label: 'Chrome 132 / Windows 10' },
  { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    label: 'Chrome 131 / Windows 10' },
  { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    label: 'Chrome 132 / macOS' },
  { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    label: 'Chrome 131 / macOS 14' },
  { value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    label: 'Chrome 132 / Linux' },
  { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0',
    label: 'Edge 132 / Windows 10' },
  { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    label: 'Firefox 133 / Windows 10' },
  { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
    label: 'Firefox 133 / macOS' },
];

const SCREEN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',          label: '🎲 随机' },
  // 桌面
  { value: '1920x1080', label: '1920×1080 (Full HD)' },
  { value: '2560x1440', label: '2560×1440 (2K)' },
  { value: '3840x2160', label: '3840×2160 (4K)' },
  { value: '1440x900',  label: '1440×900' },
  { value: '1680x1050', label: '1680×1050' },
  { value: '1600x900',  label: '1600×900' },
  { value: '1366x768',  label: '1366×768 (HD)' },
  { value: '1280x800',  label: '1280×800' },
  { value: '1280x1024', label: '1280×1024' },
  // 移动端
  { value: '393x852',   label: '393×852 (iPhone 15/16/17)' },
  { value: '390x844',   label: '390×844 (iPhone 14)' },
  { value: '384x824',   label: '384×824 (Samsung Galaxy S25)' },
  { value: '412x915',   label: '412×915 (Google Pixel 9)' },
  { value: '360x800',   label: '360×800 (Android 通用)' },
];

const HARDWARE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',   label: '🎲 随机' },
  { value: '2',  label: '2 核' },
  { value: '4',  label: '4 核' },
  { value: '6',  label: '6 核' },
  { value: '8',  label: '8 核' },
  { value: '12', label: '12 核' },
  { value: '16', label: '16 核' },
];

const MEMORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',   label: '🎲 随机' },
  { value: '2',  label: '2 GB' },
  { value: '4',  label: '4 GB' },
  { value: '8',  label: '8 GB' },
  { value: '16', label: '16 GB' },
  { value: '32', label: '32 GB' },
];

const REFRESH_RATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',    label: '🎲 随机' },
  { value: '60',  label: '60 Hz' },
  { value: '90',  label: '90 Hz' },
  { value: '120', label: '120 Hz' },
  { value: '144', label: '144 Hz' },
  { value: '165', label: '165 Hz' },
  { value: '240', label: '240 Hz' },
];

const PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',             label: '🎲 随机' },
  { value: 'Win32',        label: 'Win32 (Windows)' },
  { value: 'MacIntel',     label: 'MacIntel (macOS)' },
  { value: 'Linux x86_64', label: 'Linux x86_64' },
  { value: 'iPhone',       label: 'iPhone (iOS)' },
  { value: 'Linux armv8l', label: 'Linux armv8l (Android)' },
];

const ARCH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',    label: '🎲 随机' },
  { value: 'x86', label: 'x86 (Intel/AMD 64位)' },
  { value: 'arm', label: 'arm (Apple/移动端)' },
];

const TOUCH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',   label: '🎲 随机' },
  { value: '0',  label: '0 (无触屏)' },
  { value: '5',  label: '5 (标准触屏)' },
  { value: '10', label: '10 (多点触控)' },
];

const DPR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',     label: '🎲 随机' },
  { value: '1',    label: '1× (标准)' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5',  label: '1.5×' },
  { value: '2',    label: '2× (Retina)' },
  { value: '3',    label: '3× (旗舰手机)' },
];

const NETWORK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',        label: '🎲 随机' },
  { value: '4g',      label: '4G' },
  { value: '3g',      label: '3G' },
  { value: '2g',      label: '2G' },
  { value: 'slow-2g', label: 'Slow 2G' },
];

const CHARGING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',      label: '🎲 随机' },
  { value: 'true',  label: '⚡ 充电中' },
  { value: 'false', label: '🔋 使用电池' },
];

const BATTERY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',    label: '🎲 随机' },
  { value: '0.2', label: '20%' },
  { value: '0.4', label: '40%' },
  { value: '0.6', label: '60%' },
  { value: '0.8', label: '80%' },
  { value: '1',   label: '100%' },
];

const GPU_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '🎲 随机' },
  ...Object.entries(GPU_PRESET_MAP).map(([key, preset]) => ({ value: key, label: preset.label })),
  { value: '__custom__', label: '✏️ 自定义...' },
];

function buildSelectHtml(id: string, options: Array<{ value: string; label: string }>, selected = ''): string {
  return `<select id="${id}">${options.map(o =>
    `<option value="${escHtml(o.value)}" ${o.value === selected ? 'selected' : ''}>${escHtml(o.label)}</option>`
  ).join('')}</select>`;
}

// ── 快捷预设 ──────────────────────────────────────────────────────────────────
interface QuickPreset {
  label: string;
  timezone?: string;
  language?: string;
  geo?: string;
  ua?: string;
  screen?: string;
  hw?: string;
  mem?: string;
  rate?: string;
  platform?: string;
  arch?: string;
  touch?: string;
  dpr?: string;
  net?: string;
  charging?: string;
  battery?: string;
  gpu?: string;
}

const LOCATION_PRESETS: Array<{ value: string; label: string } & QuickPreset> = [
  { value: '', label: '— 地区预设 —' },
  { value: 'sh',     label: '🇨🇳 中国-上海',      timezone: 'Asia/Shanghai',        language: 'zh-CN',  geo: 'Shanghai'    },
  { value: 'bj',     label: '🇨🇳 中国-北京',      timezone: 'Asia/Shanghai',        language: 'zh-CN',  geo: 'Beijing'     },
  { value: 'hk',     label: '🇭🇰 香港',           timezone: 'Asia/Hong_Kong',       language: 'zh-TW',  geo: 'HongKong'    },
  { value: 'tw',     label: '🇹🇼 台湾',           timezone: 'Asia/Taipei',          language: 'zh-TW',  geo: 'Taiwan'      },
  { value: 'jp',     label: '🇯🇵 日本-东京',      timezone: 'Asia/Tokyo',           language: 'ja',     geo: 'Tokyo'       },
  { value: 'kr',     label: '🇰🇷 韩国-首尔',      timezone: 'Asia/Seoul',           language: 'ko',     geo: 'Seoul'       },
  { value: 'sg',     label: '🇸🇬 新加坡',         timezone: 'Asia/Singapore',       language: 'en-GB',  geo: 'Singapore'   },
  { value: 'us_la',  label: '🇺🇸 美国-洛杉矶',    timezone: 'America/Los_Angeles',  language: 'en-US',  geo: 'LosAngeles'  },
  { value: 'us_ny',  label: '🇺🇸 美国-纽约',      timezone: 'America/New_York',     language: 'en-US',  geo: 'NewYork'     },
  { value: 'us_chi', label: '🇺🇸 美国-芝加哥',    timezone: 'America/Chicago',      language: 'en-US',  geo: 'Chicago'     },
  { value: 'uk',     label: '🇬🇧 英国-伦敦',      timezone: 'Europe/London',        language: 'en-GB',  geo: 'London'      },
  { value: 'fr',     label: '🇫🇷 法国-巴黎',      timezone: 'Europe/Paris',         language: 'fr-FR',  geo: 'Paris'       },
  { value: 'de',     label: '🇩🇪 德国-柏林',      timezone: 'Europe/Berlin',        language: 'de-DE',  geo: 'Berlin'      },
  { value: 'ru',     label: '🇷🇺 俄罗斯-莫斯科',  timezone: 'Europe/Moscow',        language: 'ru',     geo: 'Moscow'      },
  { value: 'au',     label: '🇦🇺 澳大利亚-悉尼',  timezone: 'Australia/Sydney',     language: 'en-GB',  geo: 'Sydney'      },
];

const DEVICE_PRESETS: Array<{ value: string; label: string } & QuickPreset> = [
  { value: '', label: '— 设备预设 —' },
  { value: 'win_fhd',       label: '🖥️ Windows PC (1080p)',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    screen: '1920x1080', hw: '8', mem: '8', rate: '60',
    platform: 'Win32', arch: 'x86', touch: '0', dpr: '1', net: '4g', charging: 'true', battery: '0.8', gpu: 'nvidia_gtx1060' },
  { value: 'win_2k',        label: '🖥️ Windows PC (2K)',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    screen: '2560x1440', hw: '8', mem: '16', rate: '144',
    platform: 'Win32', arch: 'x86', touch: '0', dpr: '1.25', net: '4g', charging: 'true', battery: '0.8', gpu: 'nvidia_rtx3080' },
  { value: 'mac',           label: '🍎 MacBook Pro (2K)',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    screen: '2560x1440', hw: '12', mem: '16', rate: '120',
    platform: 'MacIntel', arch: 'arm', touch: '0', dpr: '2', net: '4g', charging: 'true', battery: '0.8', gpu: 'apple_m2' },
  { value: 'linux',         label: '🐧 Linux Desktop (1080p)',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    screen: '1920x1080', hw: '8', mem: '8', rate: '60',
    platform: 'Linux x86_64', arch: 'x86', touch: '0', dpr: '1', net: '4g', charging: 'true', battery: '0.8', gpu: 'nvidia_rtx3060' },
  { value: 'iphone17',      label: '📱 iPhone 17 (Safari)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
    screen: '393x852', hw: '6', mem: '8', rate: '120',
    platform: 'iPhone', arch: 'arm', touch: '5', dpr: '3', net: '4g', charging: 'false', battery: '0.6', gpu: 'apple_m3' },
  { value: 'iphone16',      label: '📱 iPhone 16 (Safari)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    screen: '393x852', hw: '6', mem: '8', rate: '120',
    platform: 'iPhone', arch: 'arm', touch: '5', dpr: '3', net: '4g', charging: 'false', battery: '0.6', gpu: 'apple_m3' },
  { value: 'android_s25',   label: '📱 Samsung Galaxy S25 (Chrome)',
    ua: 'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.163 Mobile Safari/537.36',
    screen: '384x824', hw: '8', mem: '8', rate: '120',
    platform: 'Linux armv8l', arch: 'arm', touch: '5', dpr: '3', net: '4g', charging: 'false', battery: '0.6', gpu: 'adreno_650' },
  { value: 'android_pixel', label: '📱 Google Pixel 9 (Chrome)',
    ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.163 Mobile Safari/537.36',
    screen: '412x915', hw: '8', mem: '8', rate: '120',
    platform: 'Linux armv8l', arch: 'arm', touch: '5', dpr: '3', net: '4g', charging: 'false', battery: '0.6', gpu: 'adreno_650' },
];

const LOCATION_PRESET_MAP = new Map(LOCATION_PRESETS.filter(p => p.value).map(p => [p.value, p]));
const DEVICE_PRESET_MAP   = new Map(DEVICE_PRESETS.filter(p => p.value).map(p => [p.value, p]));

/** 将快捷预设的字段回填到 body 内各 select/input */
function applyQuickPreset(presetKey: string, body: HTMLElement, type: 'location' | 'device'): void {
  const preset = type === 'location'
    ? LOCATION_PRESET_MAP.get(presetKey)
    : DEVICE_PRESET_MAP.get(presetKey);
  if (!preset) return;
  const set = (id: string, val: string | undefined) => {
    if (val === undefined) return;
    const el = body.querySelector<HTMLSelectElement | HTMLInputElement>(`#${id}`);
    if (el) el.value = val;
  };
  set('m-timezone', preset.timezone);
  set('m-language', preset.language);
  set('m-geo',      preset.geo);
  set('m-screen',   preset.screen);
  set('m-hw',       preset.hw);
  set('m-memory',   preset.mem);
  set('m-rate',     preset.rate);
  set('m-platform', preset.platform);
  set('m-arch',     preset.arch);
  set('m-touch',    preset.touch);
  set('m-dpr',      preset.dpr);
  set('m-net',      preset.net);
  set('m-charging', preset.charging);
  set('m-battery',  preset.battery);
  set('m-gpu',      preset.gpu);

  const gpuSel = body.querySelector<HTMLSelectElement>('#m-gpu');
  const gpuCustomRow = body.querySelector<HTMLElement>('#m-gpu-custom-row');
  if (gpuSel && gpuCustomRow) {
    gpuCustomRow.style.display = gpuSel.value === '__custom__' ? '' : 'none';
  }
  if (preset.ua !== undefined) {
    const uaSel = body.querySelector<HTMLSelectElement>('#m-ua')!;
    const customRow = body.querySelector<HTMLElement>('#m-ua-custom-row')!;
    const found = UA_OPTIONS.some(o => o.value === preset.ua);
    if (found) {
      uaSel.value = preset.ua;
      customRow.style.display = 'none';
    } else {
      uaSel.value = '__custom__';
      customRow.style.display = '';
      body.querySelector<HTMLInputElement>('#m-ua-custom')!.value = preset.ua;
    }
  }
}

/** 快捷预设两行 HTML（地区 + 设备） */
function quickPresetRowHtml(): string {
  return `<div class="fp-quick-rows">
    <div class="field-row fp-quick-row">
      <label style="white-space:nowrap">🌍 地区</label>
      ${buildSelectHtml('m-loc-preset', LOCATION_PRESETS.map(p => ({ value: p.value, label: p.label })))}
    </div>
    <div class="field-row fp-quick-row">
      <label style="white-space:nowrap">📱 设备</label>
      ${buildSelectHtml('m-dev-preset', DEVICE_PRESETS.map(p => ({ value: p.value, label: p.label })))}
    </div>
  </div>`;
}

/** 从对话框 body 中读取指纹 override 值 */
function readFpOverride(body: HTMLElement): FingerprintOverride {
  const sel = (id: string) => (body.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? '');
  const ua = sel('m-ua');
  const touchStr    = sel('m-touch');
  const chargingStr = sel('m-charging');
  const gpuPresetKey = sel('m-gpu');
  const gpuVendorCustom = body.querySelector<HTMLInputElement>('#m-gpu-vendor')?.value.trim() ?? '';
  const gpuRendererCustom = body.querySelector<HTMLInputElement>('#m-gpu-renderer')?.value.trim() ?? '';
  const gpuPreset = GPU_PRESET_MAP[gpuPresetKey];
  return {
    timezone:            sel('m-timezone') || undefined,
    language:            sel('m-language') || undefined,
    geoPreset:           sel('m-geo') || undefined,
    userAgent:           ua || undefined,
    hardwareConcurrency: sel('m-hw')     ? parseInt(sel('m-hw'))     || undefined : undefined,
    deviceMemory:        sel('m-memory') ? parseInt(sel('m-memory')) || undefined : undefined,
    screenRefreshRate:   sel('m-rate')   ? parseInt(sel('m-rate'))   || undefined : undefined,
    screenPreset:        sel('m-screen') || undefined,
    platform:            sel('m-platform') || undefined,
    architecture:        sel('m-arch')     || undefined,
    maxTouchPoints:      touchStr    !== '' ? parseInt(touchStr)                    : undefined,
    devicePixelRatio:    sel('m-dpr') !== '' ? parseFloat(sel('m-dpr'))             : undefined,
    networkEffectiveType: sel('m-net')     || undefined,
    batteryCharging:     chargingStr !== '' ? chargingStr === 'true'               : undefined,
    batteryLevel:        sel('m-battery') !== '' ? parseFloat(sel('m-battery'))    : undefined,
    gpuVendor: gpuPresetKey === '__custom__'
      ? (gpuVendorCustom || undefined)
      : (gpuPreset?.vendor || undefined),
    gpuRenderer: gpuPresetKey === '__custom__'
      ? (gpuRendererCustom || undefined)
      : (gpuPreset?.renderer || undefined),
  };
}


let envs: Environment[] = [];
let runtimes: Record<string, EnvRuntime> = {};
const selectedIds = new Set<string>();
let searchText = '';
let proxySources: ProxySource[] = [];
let proxyNodes: ProxyNode[] = [];

const tbody = document.getElementById('envs-tbody') as HTMLTableSectionElement;
const searchEl = document.getElementById('env-search') as HTMLInputElement;
const statusRunning = document.getElementById('status-running') as HTMLElement;
const statusTotal = document.getElementById('status-total') as HTMLElement;
const chkAll = document.getElementById('chk-all-envs') as HTMLInputElement;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getProxyLabel(env: Environment): string {
  if (!env.proxyMode) return '—';
  if (env.proxyMode === 'simple') return `简单代理 - ${env.proxySimple || '?'}`;
  // mihomo
  const src = proxySources.find(s => s.id === env.proxySourceId);
  const node = proxyNodes.find(n => n.id === env.proxyNodeId);
  const srcName = src?.name ?? '?';
  const nodeName = node?.name ?? '?';
  return `Mihomo - ${srcName} - ${nodeName}`;
}

function filteredEnvs(): Environment[] {
  return envs.filter(e => {
    if (searchText && !e.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });
}

export function render(): void {
  const list = filteredEnvs();

  // Update status bar
  const runCount = Object.values(runtimes).filter(r => r.running).length;
  statusRunning.textContent = `运行中: ${runCount}`;
  statusTotal.textContent = `环境总数: ${envs.length}`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:20px">暂无环境，点击"新建环境"创建</td></tr>`;
    chkAll.checked = false;
    chkAll.indeterminate = false;
    return;
  }

  tbody.innerHTML = list.map((env, i) => {
    const running = runtimes[env.id]?.running ?? false;
    const selected = selectedIds.has(env.id);
    return `<tr class="${selected ? 'selected' : ''}" data-id="${escHtml(env.id)}">
      <td><input type="checkbox" id="chk-env-${escHtml(env.id)}" class="chk-env" data-id="${escHtml(env.id)}" ${selected ? 'checked' : ''} /><label for="chk-env-${escHtml(env.id)}"></label></td>
      <td>${i + 1}</td>
      <td title="${escHtml(env.name)}">${escHtml(env.name)}</td>
      <td title="${escHtml(getProxyLabel(env))}">${escHtml(getProxyLabel(env))}</td>
      <td style="text-align:center"><span class="status-dot ${running ? 'running' : 'stopped'}" title="${running ? '运行中' : '已停止'}"></span></td>
      <td>
        ${running
          ? `<button class="btn-close-env" data-id="${escHtml(env.id)}">关闭</button>`
          : `<button class="btn-launch-env" data-id="${escHtml(env.id)}">启动</button>`
        }
        <button class="btn-edit-env" data-id="${escHtml(env.id)}">编辑</button>
        <button class="btn-copy-env" data-id="${escHtml(env.id)}">复制</button>
        <button class="btn-del-env btn-danger" data-id="${escHtml(env.id)}">删除</button>
      </td>
    </tr>`;
  }).join('');

  // Sync chk-all state
  const selectedInList = list.filter(e => selectedIds.has(e.id)).length;
  chkAll.checked = selectedInList > 0 && selectedInList === list.length;
  chkAll.indeterminate = selectedInList > 0 && selectedInList < list.length;

  // Bind row events
  tbody.querySelectorAll<HTMLButtonElement>('.btn-launch-env').forEach(btn => {
    btn.addEventListener('click', () => launchEnv(btn.dataset['id']!));
  });
  tbody.querySelectorAll<HTMLButtonElement>('.btn-close-env').forEach(btn => {
    btn.addEventListener('click', () => closeEnv(btn.dataset['id']!));
  });
  tbody.querySelectorAll<HTMLButtonElement>('.btn-edit-env').forEach(btn => {
    btn.addEventListener('click', () => editEnv(btn.dataset['id']!));
  });
  tbody.querySelectorAll<HTMLButtonElement>('.btn-regen-fp').forEach(btn => {
    btn.addEventListener('click', () => regenFP(btn.dataset['id']!));
  });
  tbody.querySelectorAll<HTMLButtonElement>('.btn-copy-env').forEach(btn => {
    btn.addEventListener('click', () => cloneEnv(btn.dataset['id']!));
  });
  tbody.querySelectorAll<HTMLButtonElement>('.btn-del-env').forEach(btn => {
    btn.addEventListener('click', () => deleteEnv(btn.dataset['id']!));
  });
}

async function launchEnv(id: string): Promise<void> {
  try {
    const rt = await api.envLaunch(id);
    runtimes[id] = rt;
    toast('环境已启动', 'success');
    render();
  } catch (e: unknown) {
    toast(`启动失败: ${(e as Error).message}`, 'error');
  }
}

async function closeEnv(id: string): Promise<void> {
  await api.envClose(id);
  runtimes[id] = { envId: id, running: false };
  render();
}

async function regenFP(id: string): Promise<void> {
  await api.envRegenerateFP(id);
  toast('指纹已重新生成', 'info');
  await loadEnvs();
}

async function cloneEnv(id: string): Promise<void> {
  const env = envs.find(e => e.id === id);
  if (!env) return;
  try {
    await api.envCreate({
      name: `${env.name} 副本`,
      homePage: env.homePage,
      notes: env.notes,
      fpOverride: env.fingerprint,
      proxyMode: env.proxyMode,
      proxySimple: env.proxySimple,
      proxySourceId: env.proxySourceId,
      proxyNodeId: env.proxyNodeId,
    });
    await loadEnvs();
    toast(`已复制环境 "${env.name}"`, 'success');
  } catch (e) {
    toast(`复制失败: ${(e as Error).message}`, 'error');
  }
}

async function deleteEnv(id: string): Promise<void> {
  const env = envs.find(e => e.id === id);
  if (!env) return;
  const ok = await showConfirm(`确认删除环境 "${env.name}"？`);
  if (!ok) return;
  await api.envDelete(id);
  selectedIds.delete(id);
  await loadEnvs();
  toast('已删除', 'info');
}

async function editEnv(id: string): Promise<void> {
  const env = envs.find(e => e.id === id);
  if (!env) return;

  const fp = env.fingerprint;

  // Determine current UA preset match (or 'custom')
  const uaPresetMatch = UA_OPTIONS.find(o => o.value === env.userAgent);
  const currentUaValue = uaPresetMatch ? env.userAgent : '__custom__';
  const currentGeoValue = inferGeoPresetByCoords(fp.latitude, fp.longitude);
  const currentGpuPresetEntry = Object.entries(GPU_PRESET_MAP).find(([, preset]) =>
    preset.vendor === (fp.gpuVendor ?? '') && preset.renderer === (fp.gpuRenderer ?? ''),
  );
  const currentGpuValue = currentGpuPresetEntry ? currentGpuPresetEntry[0] : '__custom__';

  // Load proxy sources for mihomo mode
  const proxySources = await api.proxySources();

  const result = await showModal<Partial<Environment>>('编辑环境', (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <div class="name-notes-row">
        <div class="name-col"><label>环境名称</label><input id="m-name" type="text" value="${escHtml(env.name)}" /></div>
        <div class="notes-col"><label>备注</label><input id="m-notes" type="text" value="${escHtml(env.notes || '')}" /></div>
      </div>
      <div class="proxy-inline">
        <div class="proxy-mode-col">
          <label>代理模式</label>
          <select id="m-proxy-mode">
            <option value="" ${!env.proxyMode ? 'selected' : ''}>无</option>
            <option value="simple" ${env.proxyMode === 'simple' ? 'selected' : ''}>简单代理</option>
            <option value="mihomo" ${env.proxyMode === 'mihomo' ? 'selected' : ''}>Mihomo 订阅</option>
          </select>
        </div>
        <div id="m-simple-col" class="proxy-extra-col" style="${env.proxyMode === 'simple' ? '' : 'display:none'}">
          <label>代理地址 (host:port)</label>
          <input id="m-proxy-simple" type="text" value="${escHtml(env.proxySimple || '')}" />
        </div>
        <div id="m-mihomo-source-col" class="proxy-extra-col" style="${env.proxyMode === 'mihomo' ? '' : 'display:none'}">
          <label>订阅源</label>
          <select id="m-proxy-source">
            <option value="">— 选择订阅源 —</option>
            ${proxySources.map(s => `<option value="${escHtml(s.id)}" ${s.id === env.proxySourceId ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div id="m-mihomo-node-col" class="proxy-extra-col" style="${env.proxyMode === 'mihomo' ? '' : 'display:none'}">
          <label>节点</label>
          <select id="m-proxy-node"><option value="">— 选择节点 —</option></select>
        </div>
      </div>
      <div class="field-row-stacked"><label>首页 URL <small style="color:#888">（留空则用全局设置）</small></label><input id="m-homepage" type="text" value="${escHtml(env.homePage || '')}" placeholder="https://www.google.com" /></div>

      <fieldset class="fp-fieldset">
        <legend>🔏 指纹配置 <small style="font-weight:normal;color:#666">（留空保持当前值）</small></legend>
        ${quickPresetRowHtml()}
        <div class="fp-grid">
          <div class="field-row-stacked">
            <label>时区</label>
            ${buildSelectHtml('m-timezone', TIMEZONE_OPTIONS, fp.timezone)}
          </div>
          <div class="field-row-stacked">
            <label>语言</label>
            ${buildSelectHtml('m-language', LANGUAGE_OPTIONS, fp.language)}
          </div>
          <div class="field-row-stacked">
            <label>地区 / 地理位置</label>
            ${buildSelectHtml('m-geo', GEO_OPTIONS, currentGeoValue)}
          </div>
          <div class="field-row-stacked">
            <label>屏幕分辨率</label>
            ${buildSelectHtml('m-screen', SCREEN_OPTIONS, `${fp.screenWidth}x${fp.screenHeight}`)}
          </div>
          <div class="field-row-stacked">
            <label>CPU 核心数</label>
            ${buildSelectHtml('m-hw', HARDWARE_OPTIONS, String(fp.hardwareConcurrency))}
          </div>
          <div class="field-row-stacked">
            <label>内存大小</label>
            ${buildSelectHtml('m-memory', MEMORY_OPTIONS, String(fp.deviceMemory))}
          </div>
          <div class="field-row-stacked">
            <label>屏幕刷新率</label>
            ${buildSelectHtml('m-rate', REFRESH_RATE_OPTIONS, String(fp.screenRefreshRate))}
          </div>
          <div class="field-row-stacked">
            <label>像素比 DPR</label>
            ${buildSelectHtml('m-dpr', DPR_OPTIONS, fp.devicePixelRatio != null ? String(fp.devicePixelRatio) : '')}
          </div>
          <div class="field-row-stacked">
            <label>系统平台</label>
            ${buildSelectHtml('m-platform', PLATFORM_OPTIONS, fp.platform ?? '')}
          </div>
          <div class="field-row-stacked">
            <label>处理器架构</label>
            ${buildSelectHtml('m-arch', ARCH_OPTIONS, fp.architecture ?? '')}
          </div>
          <div class="field-row-stacked">
            <label>触控点数</label>
            ${buildSelectHtml('m-touch', TOUCH_OPTIONS, fp.maxTouchPoints != null ? String(fp.maxTouchPoints) : '')}
          </div>
          <div class="field-row-stacked">
            <label>网络类型</label>
            ${buildSelectHtml('m-net', NETWORK_OPTIONS, fp.networkEffectiveType ?? '')}
          </div>
          <div class="field-row-stacked">
            <label>充电状态</label>
            ${buildSelectHtml('m-charging', CHARGING_OPTIONS, fp.batteryCharging != null ? String(fp.batteryCharging) : '')}
          </div>
          <div class="field-row-stacked">
            <label>电量</label>
            ${buildSelectHtml('m-battery', BATTERY_OPTIONS, fp.batteryLevel != null ? String(fp.batteryLevel) : '')}
          </div>
          <div class="field-row-stacked">
            <label>GPU 型号</label>
            ${buildSelectHtml('m-gpu', GPU_OPTIONS, currentGpuValue)}
          </div>
          <div class="field-row-stacked" id="m-gpu-custom-row" style="${currentGpuValue === '__custom__' ? '' : 'display:none'}">
            <label>GPU Vendor / Renderer</label>
            <input id="m-gpu-vendor" type="text" value="${currentGpuValue === '__custom__' ? escHtml(fp.gpuVendor ?? '') : ''}" placeholder="e.g. Google Inc. (NVIDIA Corporation)" />
            <input id="m-gpu-renderer" type="text" value="${currentGpuValue === '__custom__' ? escHtml(fp.gpuRenderer ?? '') : ''}" placeholder="e.g. ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 ...)" style="margin-top:4px" />
          </div>
          <div class="field-row-stacked fp-ua-row">
            <label>User-Agent</label>
            ${buildSelectHtml('m-ua', [...UA_OPTIONS, { value: '__custom__', label: '✏️ 自定义...' }], currentUaValue)}
          </div>
          <div class="field-row-stacked" id="m-ua-custom-row" style="${currentUaValue === '__custom__' ? '' : 'display:none'}">
            <label>自定义 UA</label>
            <input id="m-ua-custom" type="text" value="${currentUaValue === '__custom__' ? escHtml(env.userAgent) : ''}" placeholder="Mozilla/5.0 ..." />
          </div>
        </div>
        <p class="fp-hint">* 保存后立即生效，下次启动环境时应用新指纹</p>
      </fieldset>

      <div class="modal-footer">
        <button id="m-ok">保存</button><button id="m-cancel">取消</button>
      </div>
    </div>`;

    const proxyModeEl = body.querySelector<HTMLSelectElement>('#m-proxy-mode')!;
    const simpleCol = body.querySelector<HTMLElement>('#m-simple-col')!;
    const mihomoSourceCol = body.querySelector<HTMLElement>('#m-mihomo-source-col')!;
    const mihomoNodeCol = body.querySelector<HTMLElement>('#m-mihomo-node-col')!;
    const sourceEl = body.querySelector<HTMLSelectElement>('#m-proxy-source')!;
    const nodeEl = body.querySelector<HTMLSelectElement>('#m-proxy-node')!;

    const loadMihomoNodes = async (sourceId: string, selectedNodeId = ''): Promise<void> => {
      nodeEl.innerHTML = '<option value="">— 加载中... —</option>';
      if (!sourceId) { nodeEl.innerHTML = '<option value="">— 选择节点 —</option>'; return; }
      const nodes = await api.proxyNodes(sourceId);
      nodeEl.innerHTML = '<option value="">— 选择节点 —</option>' +
        nodes.map(n => `<option value="${escHtml(n.id)}" ${n.id === selectedNodeId ? 'selected' : ''}>${escHtml(n.name)}</option>`).join('');
    };

    if (env.proxyMode === 'mihomo' && env.proxySourceId) {
      loadMihomoNodes(env.proxySourceId, env.proxyNodeId);
    }

    proxyModeEl.addEventListener('change', () => {
      const mode = proxyModeEl.value;
      simpleCol.style.display = mode === 'simple' ? '' : 'none';
      mihomoSourceCol.style.display = mode === 'mihomo' ? '' : 'none';
      mihomoNodeCol.style.display = mode === 'mihomo' ? '' : 'none';
      if (mode === 'mihomo' && sourceEl.value) loadMihomoNodes(sourceEl.value, '');
    });
    sourceEl.addEventListener('change', () => loadMihomoNodes(sourceEl.value, ''));

    const uaSel = body.querySelector<HTMLSelectElement>('#m-ua')!;
    const uaCustomRow = body.querySelector<HTMLElement>('#m-ua-custom-row')!;
    uaSel.addEventListener('change', () => {
      uaCustomRow.style.display = uaSel.value === '__custom__' ? '' : 'none';
    });

    const gpuSel = body.querySelector<HTMLSelectElement>('#m-gpu')!;
    const gpuCustomRow = body.querySelector<HTMLElement>('#m-gpu-custom-row')!;
    gpuSel.addEventListener('change', () => {
      gpuCustomRow.style.display = gpuSel.value === '__custom__' ? '' : 'none';
    });

    const locPresetSel = body.querySelector<HTMLSelectElement>('#m-loc-preset')!;
    locPresetSel.addEventListener('change', () => {
      applyQuickPreset(locPresetSel.value, body, 'location');
      locPresetSel.value = '';
    });
    const devPresetSel = body.querySelector<HTMLSelectElement>('#m-dev-preset')!;
    devPresetSel.addEventListener('change', () => {
      applyQuickPreset(devPresetSel.value, body, 'device');
      devPresetSel.value = '';
    });

    body.querySelector('#m-ok')!.addEventListener('click', () => {
      const name = body.querySelector<HTMLInputElement>('#m-name')!.value.trim();
      if (!name) { alert('请填写环境名称'); return; }

      const fpOv = readFpOverride(body);
      // Resolve UA: custom input overrides select
      const uaSelVal = uaSel.value;
      if (uaSelVal === '__custom__') {
        fpOv.userAgent = body.querySelector<HTMLInputElement>('#m-ua-custom')!.value.trim() || env.userAgent;
      } else if (uaSelVal) {
        fpOv.userAgent = uaSelVal;
      }

      // Merge override into current fingerprint
      const newFp = { ...env.fingerprint };
      if (fpOv.timezone)   newFp.timezone = fpOv.timezone;
      if (fpOv.language)   newFp.language = fpOv.language;
      if (fpOv.geoPreset && GEO_PRESET_COORD_MAP[fpOv.geoPreset]) {
        const geo = GEO_PRESET_COORD_MAP[fpOv.geoPreset];
        newFp.latitude = geo.lat;
        newFp.longitude = geo.lon;
      }
      if (fpOv.screenPreset) {
        const [w, h] = fpOv.screenPreset.split('x').map(Number);
        if (w && h) { newFp.screenWidth = w; newFp.screenHeight = h; }
      }
      if (fpOv.hardwareConcurrency) newFp.hardwareConcurrency = fpOv.hardwareConcurrency;
      if (fpOv.deviceMemory)        newFp.deviceMemory = fpOv.deviceMemory;
      if (fpOv.screenRefreshRate)   newFp.screenRefreshRate = fpOv.screenRefreshRate;
      if (fpOv.platform)                      newFp.platform = fpOv.platform;
      if (fpOv.architecture)                  newFp.architecture = fpOv.architecture;
      if (fpOv.maxTouchPoints !== undefined)  newFp.maxTouchPoints = fpOv.maxTouchPoints;
      if (fpOv.devicePixelRatio)              newFp.devicePixelRatio = fpOv.devicePixelRatio;
      if (fpOv.networkEffectiveType)          newFp.networkEffectiveType = fpOv.networkEffectiveType;
      if (fpOv.batteryCharging !== undefined) newFp.batteryCharging = fpOv.batteryCharging;
      if (fpOv.batteryLevel !== undefined)    newFp.batteryLevel = fpOv.batteryLevel;
      if (fpOv.gpuVendor)                     newFp.gpuVendor = fpOv.gpuVendor;
      if (fpOv.gpuRenderer)                   newFp.gpuRenderer = fpOv.gpuRenderer;

      resolve({
        name,
        proxyMode: proxyModeEl.value as '' | 'simple' | 'mihomo',
        proxySimple: body.querySelector<HTMLInputElement>('#m-proxy-simple')!.value.trim(),
        proxySourceId: sourceEl.value,
        proxyNodeId: nodeEl.value,
        notes: body.querySelector<HTMLInputElement>('#m-notes')!.value.trim(),
        homePage: body.querySelector<HTMLInputElement>('#m-homepage')!.value.trim(),
        fingerprint: newFp,
        userAgent: fpOv.userAgent ?? env.userAgent,
      });
    });
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(null as unknown as Partial<Environment>));
  });

  if (!result || !result.name) return;
  await api.envUpdate(id, result);
  await loadEnvs();
  toast('已保存', 'success');
}

export async function showCreateEnvDialog(): Promise<void> {
  interface CreateData {
    name: string; notes: string; homePage: string; fpOverride: FingerprintOverride;
    proxyMode: '' | 'simple' | 'mihomo'; proxySimple: string; proxySourceId: string; proxyNodeId: string;
  }
  const proxySources = await api.proxySources();
  const result = await showModal<CreateData>('新建环境', (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <div class="name-notes-row">
        <div class="name-col"><label>环境名称</label><input id="m-name" type="text" placeholder="例如: 账号A" /></div>
        <div class="notes-col"><label>备注</label><input id="m-notes" type="text" placeholder="可选" /></div>
      </div>
      <div class="proxy-inline">
        <div class="proxy-mode-col">
          <label>代理模式</label>
          <select id="m-proxy-mode">
            <option value="">无</option>
            <option value="simple">简单代理</option>
            <option value="mihomo">Mihomo 订阅</option>
          </select>
        </div>
        <div id="m-simple-col" class="proxy-extra-col" style="display:none">
          <label>代理地址 (host:port)</label>
          <input id="m-proxy-simple" type="text" placeholder="127.0.0.1:7890" />
        </div>
        <div id="m-mihomo-source-col" class="proxy-extra-col" style="display:none">
          <label>订阅源</label>
          <select id="m-proxy-source">
            <option value="">— 选择订阅源 —</option>
            ${proxySources.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div id="m-mihomo-node-col" class="proxy-extra-col" style="display:none">
          <label>节点</label>
          <select id="m-proxy-node"><option value="">— 选择节点 —</option></select>
        </div>
      </div>
      <div class="field-row-stacked"><label>首页 URL <small style="color:#888">（留空则用全局设置）</small></label><input id="m-homepage" type="text" placeholder="https://www.google.com" /></div>

      <fieldset class="fp-fieldset">
        <legend>🔏 指纹预设 <small style="font-weight:normal;color:#666">（不选则每个环境独立随机）</small></legend>
        ${quickPresetRowHtml()}
        <div class="fp-grid">
          <div class="field-row-stacked">
            <label>时区</label>
            ${buildSelectHtml('m-timezone', TIMEZONE_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>语言</label>
            ${buildSelectHtml('m-language', LANGUAGE_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>地区 / 地理位置</label>
            ${buildSelectHtml('m-geo', GEO_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>屏幕分辨率</label>
            ${buildSelectHtml('m-screen', SCREEN_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>CPU 核心数</label>
            ${buildSelectHtml('m-hw', HARDWARE_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>内存大小</label>
            ${buildSelectHtml('m-memory', MEMORY_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>屏幕刷新率</label>
            ${buildSelectHtml('m-rate', REFRESH_RATE_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>像素比 DPR</label>
            ${buildSelectHtml('m-dpr', DPR_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>系统平台</label>
            ${buildSelectHtml('m-platform', PLATFORM_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>处理器架构</label>
            ${buildSelectHtml('m-arch', ARCH_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>触控点数</label>
            ${buildSelectHtml('m-touch', TOUCH_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>网络类型</label>
            ${buildSelectHtml('m-net', NETWORK_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>充电状态</label>
            ${buildSelectHtml('m-charging', CHARGING_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>电量</label>
            ${buildSelectHtml('m-battery', BATTERY_OPTIONS)}
          </div>
          <div class="field-row-stacked">
            <label>GPU 型号</label>
            ${buildSelectHtml('m-gpu', GPU_OPTIONS)}
          </div>
          <div class="field-row-stacked" id="m-gpu-custom-row" style="display:none">
            <label>GPU Vendor / Renderer</label>
            <input id="m-gpu-vendor" type="text" placeholder="e.g. Google Inc. (NVIDIA Corporation)" />
            <input id="m-gpu-renderer" type="text" placeholder="e.g. ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 ...)" style="margin-top:4px" />
          </div>
          <div class="field-row-stacked fp-ua-row">
            <label>User-Agent</label>
            ${buildSelectHtml('m-ua', [...UA_OPTIONS, { value: '__custom__', label: '✏️ 自定义...' }])}
          </div>
          <div class="field-row-stacked" id="m-ua-custom-row" style="display:none">
            <label>自定义 UA</label>
            <input id="m-ua-custom" type="text" placeholder="Mozilla/5.0 ..." />
          </div>
        </div>
      </fieldset>

      <div class="modal-footer">
        <button id="m-ok">创建</button><button id="m-cancel">取消</button>
      </div>
    </div>`;

    const uaSel = body.querySelector<HTMLSelectElement>('#m-ua')!;
    const uaCustomRow = body.querySelector<HTMLElement>('#m-ua-custom-row')!;
    uaSel.addEventListener('change', () => {
      uaCustomRow.style.display = uaSel.value === '__custom__' ? '' : 'none';
    });

    const gpuSel = body.querySelector<HTMLSelectElement>('#m-gpu')!;
    const gpuCustomRow = body.querySelector<HTMLElement>('#m-gpu-custom-row')!;
    gpuSel.addEventListener('change', () => {
      gpuCustomRow.style.display = gpuSel.value === '__custom__' ? '' : 'none';
    });

    const proxyModeEl2 = body.querySelector<HTMLSelectElement>('#m-proxy-mode')!;
    const simpleCol2 = body.querySelector<HTMLElement>('#m-simple-col')!;
    const mihomoSourceCol2 = body.querySelector<HTMLElement>('#m-mihomo-source-col')!;
    const mihomoNodeCol2 = body.querySelector<HTMLElement>('#m-mihomo-node-col')!;
    const sourceEl2 = body.querySelector<HTMLSelectElement>('#m-proxy-source')!;
    const nodeEl2 = body.querySelector<HTMLSelectElement>('#m-proxy-node')!;

    const loadMihomoNodes2 = async (sourceId: string, selectedNodeId = ''): Promise<void> => {
      nodeEl2.innerHTML = '<option value="">— 加载中... —</option>';
      if (!sourceId) { nodeEl2.innerHTML = '<option value="">— 选择节点 —</option>'; return; }
      const nodes = await api.proxyNodes(sourceId);
      nodeEl2.innerHTML = '<option value="">— 选择节点 —</option>' +
        nodes.map(n => `<option value="${escHtml(n.id)}" ${n.id === selectedNodeId ? 'selected' : ''}>${escHtml(n.name)}</option>`).join('');
    };

    proxyModeEl2.addEventListener('change', () => {
      const mode = proxyModeEl2.value;
      simpleCol2.style.display = mode === 'simple' ? '' : 'none';
      mihomoSourceCol2.style.display = mode === 'mihomo' ? '' : 'none';
      mihomoNodeCol2.style.display = mode === 'mihomo' ? '' : 'none';
      if (mode === 'mihomo' && sourceEl2.value) loadMihomoNodes2(sourceEl2.value, '');
    });
    sourceEl2.addEventListener('change', () => loadMihomoNodes2(sourceEl2.value, ''));

    const locPresetSel = body.querySelector<HTMLSelectElement>('#m-loc-preset')!;
    locPresetSel.addEventListener('change', () => {
      applyQuickPreset(locPresetSel.value, body, 'location');
      locPresetSel.value = '';
    });
    const devPresetSel = body.querySelector<HTMLSelectElement>('#m-dev-preset')!;
    devPresetSel.addEventListener('change', () => {
      applyQuickPreset(devPresetSel.value, body, 'device');
      devPresetSel.value = '';
    });

    body.querySelector('#m-ok')!.addEventListener('click', () => {
      const name = body.querySelector<HTMLInputElement>('#m-name')!.value.trim();
      if (!name) { alert('请填写环境名称'); return; }

      const fpOv = readFpOverride(body);
      const uaSelVal = uaSel.value;
      if (uaSelVal === '__custom__') {
        fpOv.userAgent = body.querySelector<HTMLInputElement>('#m-ua-custom')!.value.trim() || undefined;
      } else if (uaSelVal) {
        fpOv.userAgent = uaSelVal;
      }

      resolve({
        name,
        notes: body.querySelector<HTMLInputElement>('#m-notes')!.value.trim(),
        homePage: body.querySelector<HTMLInputElement>('#m-homepage')!.value.trim(),
        fpOverride: fpOv,
        proxyMode: proxyModeEl2.value as '' | 'simple' | 'mihomo',
        proxySimple: body.querySelector<HTMLInputElement>('#m-proxy-simple')!.value.trim(),
        proxySourceId: sourceEl2.value,
        proxyNodeId: nodeEl2.value,
      });
    });
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(null as unknown as CreateData));
  });
  if (!result) return;
  await api.envCreate({
    name: result.name,
    count: 1,
    notes: result.notes,
    homePage: result.homePage || undefined,
    fpOverride: result.fpOverride,
    proxyMode: result.proxyMode,
    proxySimple: result.proxySimple,
    proxySourceId: result.proxySourceId,
    proxyNodeId: result.proxyNodeId,
  });
  await loadEnvs();
  toast('已创建环境', 'success');
}

export async function loadEnvs(): Promise<void> {
  [envs, runtimes, proxySources, proxyNodes] = await Promise.all([
    api.envList(), api.envStatusAll(), api.proxySources(), api.proxyNodes(),
  ]);
  render();
}

export function updateRuntime(envId: string, runtime: EnvRuntime): void {
  if (runtime.running) runtimes[envId] = runtime;
  else delete runtimes[envId];
  render();
}

export function init(): void {
  searchEl.addEventListener('input', () => { searchText = searchEl.value; render(); });
  chkAll.addEventListener('change', () => {
    const list = filteredEnvs();
    if (chkAll.checked) list.forEach(e => selectedIds.add(e.id));
    else selectedIds.clear();
    render();
  });

  // Delegated checkbox handler — bound once on tbody, survives innerHTML rebuilds
  tbody.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('chk-env')) return;
    const id = target.dataset['id']!;
    if (target.checked) selectedIds.add(id); else selectedIds.delete(id);
    const tr = target.closest('tr');
    if (tr) tr.className = target.checked ? 'selected' : '';
    const envList = filteredEnvs();
    const cnt = envList.filter(e => selectedIds.has(e.id)).length;
    chkAll.checked = cnt > 0 && cnt === envList.length;
    chkAll.indeterminate = cnt > 0 && cnt < envList.length;
  });

  document.getElementById('btn-create-env')!.addEventListener('click', () => showCreateEnvDialog());

  document.getElementById('btn-launch-selected')!.addEventListener('click', async () => {
    for (const id of selectedIds) await launchEnv(id);
  });
  document.getElementById('btn-close-selected')!.addEventListener('click', async () => {
    for (const id of selectedIds) await closeEnv(id);
  });
  document.getElementById('btn-delete-selected')!.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const ok = await showConfirm(`确认删除选中的 ${selectedIds.size} 个环境？`);
    if (!ok) return;
    for (const id of selectedIds) await api.envDelete(id);
    selectedIds.clear();
    await loadEnvs();
  });
}
