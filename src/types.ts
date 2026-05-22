// Shared TypeScript types between main process and renderer

export interface FingerprintConfig {
  timezone: string;
  language: string;
  latitude: number;
  longitude: number;
  canvasSeed: number;
  webglSeed: number;
  hardwareConcurrency: number;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  deviceMemory: number;
  screenRefreshRate: number;
  /** 系统平台，例如 'Win32' | 'MacIntel' | 'Linux x86_64' | 'iPhone' | 'Linux armv8l' */
  platform: string;
  /** 处理器架构，例如 'x86' | 'arm' */
  architecture: string;
  /** 触控点数，0=非触屏，5=标准触屏 */
  maxTouchPoints: number;
  /** 设备像素比，例如 1 | 1.5 | 2 | 3 */
  devicePixelRatio: number;
  /** 网络连接类型，例如 '4g' | '3g' | '2g' | 'slow-2g' */
  networkEffectiveType: string;
  /** 是否正在充电 */
  batteryCharging: boolean;
  /** 剩余电量 0.0-1.0，例如 0.8 = 80% */
  batteryLevel: number;
  /** WebGL GPU Vendor，例如 'Google Inc. (NVIDIA Corporation)' */
  gpuVendor: string;
  /** WebGL GPU Renderer，例如 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 ...)' */
  gpuRenderer: string;
}

export interface Environment {
  id: string;
  name: string;
  createdAt: string;
  userAgent: string;
  fingerprint: FingerprintConfig;
  proxyMode: '' | 'simple' | 'mihomo';
  proxySimple: string;
  proxySourceId: string;
  proxyNodeId: string;
  notes: string;
  homePage?: string;
}

export interface ProxySource {
  id: string;
  name: string;
  type: 'subscription' | 'file';
  url: string;
  nodeCount: number;
  lastUpdated: string;
  createdAt: string;
}

export interface ProxyNode {
  id: string;
  sourceId: string;
  name: string;
  type: string;
  server: string;
  port: number;
  rawYaml: string;
  delay?: number;
}

export interface AppConfig {
  chromePath: string;
  mihomoPath: string;
  logLevel: string;
  homePage: string;
  subscriptionUserAgent: string;
}

export interface Script {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrustedCert {
  id: string;
  name: string;
  sha256Fingerprint: string;
  sha1Hex: string;
  spkiFingerprint: string;
  subject: string;
  addedAt: string;
}

export interface EnvRuntime {
  envId: string;
  running: boolean;
  pid?: number;
  debugPort?: number;
  proxyPort?: number;
  launchedAt?: string;
}

/** 创建环境时可手动指定的指纹字段，不填则随机 */
export interface FingerprintOverride {
  timezone?: string;
  language?: string;
  /** 地区预设 key，例如 "Shanghai" */
  geoPreset?: string;
  userAgent?: string;
  /** 硬件并发数 */
  hardwareConcurrency?: number;
  /** 屏幕分辨率预设，格式 "1920x1080" */
  screenPreset?: string;
  /** 设备内存 (GB)，例如 4 / 8 / 16 */
  deviceMemory?: number;
  /** 屏幕刷新率 (Hz)，例如 60 / 120 / 144 */
  screenRefreshRate?: number;
  /** 系统平台，例如 'Win32' | 'MacIntel' | 'Linux x86_64' | 'iPhone' | 'Linux armv8l' */
  platform?: string;
  /** 处理器架构，例如 'x86' | 'arm' */
  architecture?: string;
  /** 触控点数，0=非触屏，5=标准触屏 */
  maxTouchPoints?: number;
  /** 设备像素比，例如 1 | 1.5 | 2 | 3 */
  devicePixelRatio?: number;
  /** 网络连接类型，例如 '4g' | '3g' | '2g' | 'slow-2g' */
  networkEffectiveType?: string;
  /** 是否正在充电 */
  batteryCharging?: boolean;
  /** 剩余电量 0.0-1.0，例如 0.8 = 80% */
  batteryLevel?: number;
  /** WebGL GPU Vendor，例如 'Google Inc. (NVIDIA Corporation)' */
  gpuVendor?: string;
  /** WebGL GPU Renderer，例如 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 ...)' */
  gpuRenderer?: string;
}

export interface CreateEnvData {
  name: string;
  count?: number;
  fpOverride?: FingerprintOverride;
  homePage?: string;
  notes?: string;
  proxyMode?: '' | 'simple' | 'mihomo';
  proxySimple?: string;
  proxySourceId?: string;
  proxyNodeId?: string;
}

export interface BatchCreateResult {
  created: Environment[];
}
