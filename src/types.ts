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

export interface GeoRule {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  builtin?: boolean;
}

export interface TimezoneRule {
  id: string;
  name: string;
  timezoneId: string;
  builtin?: boolean;
}

export interface AppConfig {
  geoRules?: GeoRule[];
  timezoneRules?: TimezoneRule[];
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
  /** 代理异常说明（如 mihomo 意外退出、线路不可用）；为空表示未发现异常 */
  proxyIssue?: string;
}

/** 创建环境时可手动指定的指纹字段，不填则随机 */
export interface FingerprintOverride {
  timezone?: string;
  language?: string;
  geoLatitude?: number;
  geoLongitude?: number;
  /** 地区规则 ID */
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

// ── 环境导入/导出 ──────────────────────────────────

export interface ExportEnvOptions {
  /** 是否打包 Chrome 用户数据（Cookie/登录态/扩展等） */
  includeProfile: boolean;
}

export interface ExportEnvResult {
  filePath: string;
  count: number;
  bytes: number;
}

export type ProxyImportAction = 'none' | 'simple' | 'reuse' | 'create' | 'missing';

export interface ImportPreviewItem {
  name: string;
  proxyMode: Environment['proxyMode'];
  proxyAction: ProxyImportAction;
  /** 例如 "机场 - HK-01" 或 "socks5://..." */
  proxyLabel: string;
  hasProfile: boolean;
}

export interface ImportPreview {
  /** 主进程保存的待导入会话标识，渲染进程只能拿它确认导入 */
  token: string;
  fileName: string;
  appVersion: string;
  exportedAt: string;
  includesProfile: boolean;
  items: ImportPreviewItem[];
}

/** 导入时为单个环境选择的线路：沿用包内配置 / 不使用代理 / 本机已有节点 */
export type ImportProxyChoice =
  | { kind: 'keep' }
  | { kind: 'none' }
  | { kind: 'node'; nodeId: string };

/** 导入确认时用户对单个环境的修改，与预览中的 items 一一对应 */
export interface ImportItemOverride {
  /** 新名称；留空则沿用包内名称 */
  name: string;
  proxy: ImportProxyChoice;
}

export interface ImportEnvResult {
  imported: Environment[];
  createdSources: number;
}

export interface TransferProgress {
  stage: 'export' | 'import';
  percent: number;
}
