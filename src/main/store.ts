import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Environment, ProxySource, ProxyNode, AppConfig, Script, TrustedCert } from '../types';

let DATA_DIR = '';
let ENV_DIR = '';
let PROXY_DIR = '';
let NODES_DIR = '';
let CERTS_DIR = '';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch { /* ignore */ }
  return defaultValue;
}

function writeJSON(filePath: string, data: unknown): void {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function initStore(): void {
  DATA_DIR = path.join(app.getPath('userData'), 'data');
  ENV_DIR = path.join(DATA_DIR, 'environments');
  PROXY_DIR = path.join(DATA_DIR, 'proxy');
  NODES_DIR = path.join(PROXY_DIR, 'nodes');
  ensureDir(DATA_DIR);
  ensureDir(ENV_DIR);
  ensureDir(PROXY_DIR);
  ensureDir(NODES_DIR);
  CERTS_DIR = path.join(DATA_DIR, 'certs');
  ensureDir(CERTS_DIR);
}

// ── Config ──────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  geoRules: [
    { id: 'Shanghai', name: '🇨🇳 中国-上海', latitude: 31.2304, longitude: 121.4737, builtin: true },
    { id: 'Beijing', name: '🇨🇳 中国-北京', latitude: 39.9042, longitude: 116.4074, builtin: true },
    { id: 'HongKong', name: '🇭🇰 香港', latitude: 22.3193, longitude: 114.1694, builtin: true },
    { id: 'Taiwan', name: '🇹🇼 台湾-台北', latitude: 25.033, longitude: 121.5654, builtin: true },
    { id: 'Tokyo', name: '🇯🇵 日本-东京', latitude: 35.6762, longitude: 139.6503, builtin: true },
    { id: 'Seoul', name: '🇰🇷 韩国-首尔', latitude: 37.5665, longitude: 126.978, builtin: true },
    { id: 'Singapore', name: '🇸🇬 新加坡', latitude: 1.3521, longitude: 103.8198, builtin: true },
    { id: 'NewYork', name: '🇺🇸 美国-纽约', latitude: 40.7128, longitude: -74.006, builtin: true },
    { id: 'LosAngeles', name: '🇺🇸 美国-洛杉矶', latitude: 34.0522, longitude: -118.2437, builtin: true },
    { id: 'Chicago', name: '🇺🇸 美国-芝加哥', latitude: 41.8781, longitude: -87.6298, builtin: true },
    { id: 'London', name: '🇬🇧 英国-伦敦', latitude: 51.5074, longitude: -0.1278, builtin: true },
    { id: 'Paris', name: '🇫🇷 法国-巴黎', latitude: 48.8566, longitude: 2.3522, builtin: true },
    { id: 'Berlin', name: '🇩🇪 德国-柏林', latitude: 52.52, longitude: 13.405, builtin: true },
    { id: 'Moscow', name: '🇷🇺 俄罗斯-莫斯科', latitude: 55.7558, longitude: 37.6176, builtin: true },
    { id: 'Sydney', name: '🇦🇺 澳大利亚-悉尼', latitude: -33.8688, longitude: 151.2093, builtin: true },
  ],
  timezoneRules: [
    { id: 'Asia/Shanghai', name: '🇨🇳 中国标准时间 (UTC+8)', timezoneId: 'Asia/Shanghai', builtin: true },
    { id: 'Asia/Hong_Kong', name: '🇭🇰 香港时间 (UTC+8)', timezoneId: 'Asia/Hong_Kong', builtin: true },
    { id: 'Asia/Taipei', name: '🇹🇼 台湾时间 (UTC+8)', timezoneId: 'Asia/Taipei', builtin: true },
    { id: 'Asia/Tokyo', name: '🇯🇵 日本时间 (UTC+9)', timezoneId: 'Asia/Tokyo', builtin: true },
    { id: 'Asia/Seoul', name: '🇰🇷 韩国时间 (UTC+9)', timezoneId: 'Asia/Seoul', builtin: true },
    { id: 'Asia/Singapore', name: '🇸🇬 新加坡时间 (UTC+8)', timezoneId: 'Asia/Singapore', builtin: true },
    { id: 'Asia/Bangkok', name: '🇹🇭 泰国时间 (UTC+7)', timezoneId: 'Asia/Bangkok', builtin: true },
    { id: 'America/New_York', name: '🇺🇸 美国东部 (UTC-5/-4)', timezoneId: 'America/New_York', builtin: true },
    { id: 'America/Los_Angeles', name: '🇺🇸 美国西部 (UTC-8/-7)', timezoneId: 'America/Los_Angeles', builtin: true },
    { id: 'America/Chicago', name: '🇺🇸 美国中部 (UTC-6/-5)', timezoneId: 'America/Chicago', builtin: true },
    { id: 'Europe/London', name: '🇬🇧 英国时间 (UTC+0/+1)', timezoneId: 'Europe/London', builtin: true },
    { id: 'Europe/Paris', name: '🇫🇷 中欧时间 (UTC+1/+2)', timezoneId: 'Europe/Paris', builtin: true },
    { id: 'Europe/Berlin', name: '🇩🇪 德国时间 (UTC+1/+2)', timezoneId: 'Europe/Berlin', builtin: true },
    { id: 'Europe/Moscow', name: '🇷🇺 莫斯科时间 (UTC+3)', timezoneId: 'Europe/Moscow', builtin: true },
    { id: 'Australia/Sydney', name: '🇦🇺 澳大利亚东部 (UTC+10/+11)', timezoneId: 'Australia/Sydney', builtin: true },
    { id: 'Asia/Dubai', name: '🇦🇪 迪拜 (UTC+4)', timezoneId: 'Asia/Dubai', builtin: true },
    { id: 'Asia/Kolkata', name: '🇮🇳 印度 (UTC+5:30)', timezoneId: 'Asia/Kolkata', builtin: true },
    { id: 'Asia/Jakarta', name: '🇮🇩 雅加达 (UTC+7)', timezoneId: 'Asia/Jakarta', builtin: true },
    { id: 'Asia/Kathmandu', name: '🇳🇵 加德满都 (UTC+5:45)', timezoneId: 'Asia/Kathmandu', builtin: true },
    { id: 'America/Toronto', name: '🇨🇦 多伦多 (UTC-5/-4)', timezoneId: 'America/Toronto', builtin: true },
    { id: 'America/Vancouver', name: '🇨🇦 温哥华 (UTC-8/-7)', timezoneId: 'America/Vancouver', builtin: true },
    { id: 'America/Mexico_City', name: '🇲🇽 墨西哥城 (UTC-6/-5)', timezoneId: 'America/Mexico_City', builtin: true },
    { id: 'America/Sao_Paulo', name: '🇧🇷 圣保罗 (UTC-3)', timezoneId: 'America/Sao_Paulo', builtin: true },
    { id: 'Europe/Rome', name: '🇮🇹 罗马 (UTC+1/+2)', timezoneId: 'Europe/Rome', builtin: true },
  ],
  chromePath: '',
  mihomoPath: '',
  logLevel: 'info',
  homePage: '',
  subscriptionUserAgent: 'clash-verge/v2.5.1',
};

function configPath(): string { return path.join(DATA_DIR, 'config.json'); }

export function getConfig(): AppConfig {
  return { ...DEFAULT_CONFIG, ...readJSON<AppConfig>(configPath(), DEFAULT_CONFIG) };
}

export function saveConfig(config: AppConfig): AppConfig {
  writeJSON(configPath(), config);
  return config;
}

// ── Environments ──────────────────────────────────

function envFilePath(id: string): string {
  return path.join(ENV_DIR, `${id}.json`);
}

export function listEnvs(): Environment[] {
  ensureDir(ENV_DIR);
  const files = fs.readdirSync(ENV_DIR).filter(f => f.endsWith('.json'));
  const envs: Environment[] = [];
  for (const f of files) {
    try {
      const env = JSON.parse(fs.readFileSync(path.join(ENV_DIR, f), 'utf-8')) as Environment;
      envs.push(env);
    } catch { /* skip corrupt files */ }
  }
  return envs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getEnv(id: string): Environment | null {
  const p = envFilePath(id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as Environment; } catch { return null; }
}

export function saveEnv(env: Environment): Environment {
  writeJSON(envFilePath(env.id), env);
  return env;
}

export function deleteEnv(id: string): void {
  const p = envFilePath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ── Proxy Sources ──────────────────────────────────

function sourcesPath(): string { return path.join(PROXY_DIR, 'sources.json'); }

export function listSources(): ProxySource[] {
  return readJSON<ProxySource[]>(sourcesPath(), []);
}

export function saveSource(source: ProxySource): ProxySource {
  const sources = listSources();
  const idx = sources.findIndex(s => s.id === source.id);
  if (idx === -1) {
    writeJSON(sourcesPath(), [...sources, source]);
  } else {
    sources[idx] = source;
    writeJSON(sourcesPath(), sources);
  }
  return source;
}

export function deleteSource(id: string): void {
  const sources = listSources().filter(s => s.id !== id);
  writeJSON(sourcesPath(), sources);
  const nodesFile = path.join(NODES_DIR, `${id}.json`);
  if (fs.existsSync(nodesFile)) fs.unlinkSync(nodesFile);
}

// ── Proxy Nodes ──────────────────────────────────

function nodesFilePath(sourceId: string): string {
  return path.join(NODES_DIR, `${sourceId}.json`);
}

export function listNodes(sourceId?: string): ProxyNode[] {
  if (sourceId) {
    return readJSON<ProxyNode[]>(nodesFilePath(sourceId), []);
  }
  const sources = listSources();
  const all: ProxyNode[] = [];
  for (const s of sources) {
    all.push(...readJSON<ProxyNode[]>(nodesFilePath(s.id), []));
  }
  return all;
}

export function saveNodes(sourceId: string, nodes: ProxyNode[]): void {
  writeJSON(nodesFilePath(sourceId), nodes);
}

export function getNode(nodeId: string): ProxyNode | null {
  return listNodes().find(n => n.id === nodeId) ?? null;
}

export function updateNode(node: ProxyNode): ProxyNode {
  const nodes = listNodes(node.sourceId);
  const idx = nodes.findIndex(n => n.id === node.id);
  if (idx >= 0) {
    nodes[idx] = node;
    saveNodes(node.sourceId, nodes);
  }
  return node;
}

// ── Scripts ──────────────────────────────────

function scriptsPath(): string { return path.join(DATA_DIR, 'scripts.json'); }

export function listScripts(): Script[] {
  return readJSON<Script[]>(scriptsPath(), []);
}

export function saveScript(script: Script): Script {
  const scripts = listScripts();
  const idx = scripts.findIndex(s => s.id === script.id);
  if (idx === -1) {
    writeJSON(scriptsPath(), [...scripts, script]);
  } else {
    scripts[idx] = script;
    writeJSON(scriptsPath(), scripts);
  }
  return script;
}

export function deleteScript(id: string): void {
  writeJSON(scriptsPath(), listScripts().filter(s => s.id !== id));
}

// ── Certificates ──────────────────────────────────

function certPemPath(id: string): string { return path.join(CERTS_DIR, `${id}.pem`); }
function certsIndexPath(): string { return path.join(CERTS_DIR, 'index.json'); }

export function listCerts(): TrustedCert[] {
  return readJSON<TrustedCert[]>(certsIndexPath(), []);
}

export function saveCert(cert: TrustedCert, pem: string): TrustedCert {
  fs.writeFileSync(certPemPath(cert.id), pem, 'utf-8');
  const certs = listCerts();
  const idx = certs.findIndex(c => c.id === cert.id);
  if (idx === -1) {
    writeJSON(certsIndexPath(), [...certs, cert]);
  } else {
    certs[idx] = cert;
    writeJSON(certsIndexPath(), certs);
  }
  return cert;
}

export function deleteCert(id: string): TrustedCert | null {
  const certs = listCerts();
  const cert = certs.find(c => c.id === id) ?? null;
  if (!cert) return null;
  const pemPath = certPemPath(id);
  if (fs.existsSync(pemPath)) fs.unlinkSync(pemPath);
  writeJSON(certsIndexPath(), certs.filter(c => c.id !== id));
  return cert;
}

export function getCertPemPath(id: string): string {
  return certPemPath(id);
}
