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
