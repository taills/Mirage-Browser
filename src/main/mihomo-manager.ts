/**
 * mihomo-manager.ts
 * 管理 mihomo 二进制的下载/安装/卸载，以及每个环境的 mihomo 进程生命周期。
 * 订阅备份保存在与 mihomo 二进制相同的规范文档目录中。
 */

import { spawn, execFile, ChildProcess } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import { app } from 'electron';
import * as yaml from 'js-yaml';
import type { ProxyNode } from '../types';

// ── 目录 ──────────────────────────────────────────────────────────────────────

/** 返回 OS 规范的 Mirage-Browser 应用文档目录（不含 userData）*/
export function getMihomoDir(): string {
  // macOS: ~/Library/Application Support/Mirage-Browser
  // Windows: %APPDATA%\Mirage-Browser
  // Linux: ~/.config/Mirage-Browser
  const appData = app.getPath('appData');
  const dir = path.join(appData, 'Mirage-Browser');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** mihomo 二进制路径 */
export function getMihomoPath(): string {
  const bin = process.platform === 'win32' ? 'mihomo.exe' : 'mihomo';
  return path.join(getMihomoDir(), bin);
}

/** 订阅备份目录 */
export function getSubsDir(): string {
  const dir = path.join(getMihomoDir(), 'subscriptions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 某个订阅的备份文件路径 */
export function getSubsBackupPath(sourceId: string): string {
  return path.join(getSubsDir(), `${sourceId}.yaml`);
}

/** 将原始订阅 YAML 写入备份文件（仅在成功获取后调用）*/
export function saveSubscriptionBackup(sourceId: string, rawYaml: string): void {
  try {
    const dest = getSubsBackupPath(sourceId);
    fs.writeFileSync(dest + '.tmp', rawYaml, 'utf-8');
    fs.renameSync(dest + '.tmp', dest);
  } catch (e) {
    console.error('[MihomoManager] Failed to save subscription backup:', e);
  }
}

// ── 版本检查 ──────────────────────────────────────────────────────────────────

/** 获取已安装的 mihomo 版本，不存在或执行失败返回 null */
export function getInstalledVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const bin = getMihomoPath();
    if (!fs.existsSync(bin)) { resolve(null); return; }
    execFile(bin, ['-v'], { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      // 输出格式: "mihomo Meta v1.18.x linux/amd64 ..."
      const match = stdout.match(/v[\d.]+[\w.-]*/);
      resolve(match ? match[0] : null);
    });
  });
}

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

/** 平台/架构 → 资产名称关键字 */
function getPlatformAssetPattern(): RegExp {
  const { platform, arch } = process;
  if (platform === 'darwin') {
    return arch === 'arm64'
      ? /mihomo-darwin-arm64[^/]*\.gz$/
      : /mihomo-darwin-amd64[^/]*\.gz$/;
  }
  if (platform === 'linux') {
    return arch === 'arm64'
      ? /mihomo-linux-arm64[^/]*\.gz$/
      : /mihomo-linux-amd64[^/]*\.gz$/;
  }
  // win32
  return arch === 'arm64'
    ? /mihomo-windows-arm64[^/]*\.zip$/
    : /mihomo-windows-amd64[^/]*\.zip$/;
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mirage-Browser/1.0', Accept: 'application/json' },
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchJson<T>(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

export interface ReleaseInfo {
  version: string;
  downloadUrl: string;
}

/** 检查 GitHub 最新版本，返回版本号和当前平台的下载 URL */
export async function checkLatestRelease(): Promise<ReleaseInfo> {
  const release = await fetchJson<GitHubRelease>(
    'https://api.github.com/repos/MetaCubeX/mihomo/releases/latest',
  );
  const pattern = getPlatformAssetPattern();
  const asset = release.assets.find(a => pattern.test(a.name));
  if (!asset) {
    throw new Error(`未找到适合当前平台 (${process.platform}/${process.arch}) 的 mihomo 资产`);
  }
  return { version: release.tag_name, downloadUrl: asset.browser_download_url };
}

// ── 下载 & 安装 ───────────────────────────────────────────────────────────────

function downloadToBuffer(url: string, onProgress?: (pct: number) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mirage-Browser/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadToBuffer(res.headers.location!, onProgress).then(resolve).catch(reject);
        return;
      }
      const total = parseInt(res.headers['content-length'] ?? '0', 10);
      let received = 0;
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => {
        chunks.push(c);
        received += c.length;
        if (total > 0) onProgress?.(Math.round((received / total) * 100));
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

/** 下载并安装 mihomo 二进制，onProgress 回调传入 0-100 */
export async function downloadMihomo(
  downloadUrl: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  onProgress?.(0);
  const buf = await downloadToBuffer(downloadUrl, (p) => onProgress?.(Math.round(p * 0.9)));

  const dest = getMihomoPath();
  const tmpDest = dest + '.tmp';

  if (downloadUrl.endsWith('.zip')) {
    // Windows ZIP
    // Node.js 내장으로 ZIP 처리 불가 → 임시파일에 저장 후 unzip 명령 사용
    const tmpZip = dest + '.download.zip';
    fs.writeFileSync(tmpZip, buf);
    await new Promise<void>((resolve, reject) => {
      const tmpDir = dest + '.extracted';
      fs.mkdirSync(tmpDir, { recursive: true });
      const proc = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path "${tmpZip}" -DestinationPath "${tmpDir}" -Force`,
      ]);
      proc.on('close', (code) => {
        if (code !== 0) { reject(new Error('Unzip failed')); return; }
        // Find mihomo.exe in extracted dir
        const files = fs.readdirSync(tmpDir);
        const exe = files.find(f => f.endsWith('.exe'));
        if (!exe) { reject(new Error('mihomo.exe not found in zip')); return; }
        fs.copyFileSync(path.join(tmpDir, exe), tmpDest);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(tmpZip, { force: true });
        resolve();
      });
      proc.on('error', reject);
    });
  } else {
    // .gz (gunzip → single binary)
    const decompressed = await new Promise<Buffer>((resolve, reject) => {
      zlib.gunzip(buf, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
    fs.writeFileSync(tmpDest, decompressed);
  }

  fs.renameSync(tmpDest, dest);
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }
  onProgress?.(100);
}

/** 卸载 mihomo 二进制 */
export function uninstallMihomo(): void {
  const bin = getMihomoPath();
  if (fs.existsSync(bin)) fs.rmSync(bin, { force: true });
}

// ── 端口 ─────────────────────────────────────────────────────────────────────

function getFreePortInRange(start: number, end: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = start + Math.floor(Math.random() * (end - start));
    const tryPort = (attempt: number) => {
      if (attempt > end - start) { reject(new Error('No free port found')); return; }
      const server = net.createServer();
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port));
      });
      server.on('error', () => {
        port = start + ((port - start + 1) % (end - start));
        tryPort(attempt + 1);
      });
    };
    tryPort(0);
  });
}

// ── Mihomo 配置生成 ───────────────────────────────────────────────────────────

interface ClashConfig {
  proxies?: Array<Record<string, unknown>>;
}

/**
 * 从备份订阅 YAML 生成 mihomo 运行配置。
 * 当备份不存在时，退回到 rawYaml（单节点配置）。
 */
function buildMihomoConfig(
  sourceId: string,
  selectedNodeName: string,
  socksPort: number,
  controlPort: number,
  mode: 'env' | 'test' = 'env',
  explicitProxyYamls?: string[],
): string {
  let proxies: Array<Record<string, unknown>> = [];

  const backupPath = getSubsBackupPath(sourceId);
  if (fs.existsSync(backupPath)) {
    try {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      const parsed = yaml.load(raw) as ClashConfig;
      if (parsed?.proxies && Array.isArray(parsed.proxies)) {
        proxies = parsed.proxies;
      }
    } catch (e) {
      console.warn('[MihomoManager] Failed to parse backup, trying explicit yamls:', e);
    }
  }

  // Fallback: build proxies list from individual node rawYaml strings
  if (proxies.length === 0 && explicitProxyYamls?.length) {
    for (const rawYaml of explicitProxyYamls) {
      if (!rawYaml) continue;
      try {
        const p = yaml.load(rawYaml) as Record<string, unknown>;
        if (p && typeof p === 'object' && p['name']) proxies.push(p);
      } catch { /* ignore malformed yaml */ }
    }
    if (proxies.length > 0) {
      console.log(`[MihomoManager] Built config from ${proxies.length} explicit proxy yamls (backup not found)`);
    }
  }

  // 确保有 selectedNodeName 对应的代理（若备份不可用则啥都没有，mihomo 不会启动）
  const selectedExists = proxies.some(p => p['name'] === selectedNodeName);
  if (!selectedExists && proxies.length === 0) {
    console.warn(`[MihomoManager] No proxies available for source ${sourceId}`);
  }

  const config: Record<string, unknown> = {
    'socks-port': socksPort,
    'allow-lan': false,
    'mode': mode === 'test' ? 'global' : 'rule',
    'log-level': 'silent',
    'external-controller': `127.0.0.1:${controlPort}`,
    'proxies': proxies,
  };

  if (mode === 'env') {
    config['rules'] = [`MATCH,${selectedNodeName}`];
  }

  return yaml.dump(config);
}

// ── 每环境 mihomo 实例 ─────────────────────────────────────────────────────────

interface MihomoInstance {
  process: ChildProcess;
  socksPort: number;
  controlPort: number;
}

const runningInstances = new Map<string, MihomoInstance>();

function waitForControlApi(controlPort: number, maxMs = 8000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (Date.now() - start > maxMs) {
        reject(new Error(`Mihomo control API not ready after ${maxMs}ms`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${controlPort}/version`, (res) => {
        if (res.statusCode === 200) { resolve(); return; }
        res.resume();
        setTimeout(poll, 400);
      });
      req.on('error', () => setTimeout(poll, 400));
      req.setTimeout(800, () => { req.destroy(); setTimeout(poll, 400); });
    };
    poll();
  });
}

/**
 * 为指定环境启动 mihomo 进程。
 * @returns socks5 监听端口
 */
export async function startMihomoForEnv(
  envId: string,
  sourceId: string,
  selectedNodeName: string,
): Promise<number> {
  // 如果已在运行，直接返回端口
  const existing = runningInstances.get(envId);
  if (existing) return existing.socksPort;

  const bin = getMihomoPath();
  if (!fs.existsSync(bin)) {
    throw new Error('未找到 mihomo 可执行文件，请在设置中下载安装 Mihomo');
  }

  const socksPort = await getFreePortInRange(40000, 49999);
  const controlPort = await getFreePortInRange(50000, 50999);

  const configContent = buildMihomoConfig(sourceId, selectedNodeName, socksPort, controlPort, 'env');

  const profileDir = path.join(app.getPath('userData'), 'profiles', envId);
  fs.mkdirSync(profileDir, { recursive: true });
  const configPath = path.join(profileDir, 'mihomo.yaml');
  fs.writeFileSync(configPath, configContent, 'utf-8');

  const proc = spawn(bin, ['-f', configPath], {
    detached: false,
    stdio: 'ignore',
  });

  const instance: MihomoInstance = { process: proc, socksPort, controlPort };
  runningInstances.set(envId, instance);

  proc.on('exit', () => {
    runningInstances.delete(envId);
  });

  // 等待控制 API 就绪
  try {
    await waitForControlApi(controlPort);
  } catch (e) {
    console.error(`[MihomoManager] Mihomo control API timeout for env ${envId}:`, e);
    // 不 throw，允许继续（Chrome 可能仍能连接 socks5）
  }

  return socksPort;
}

/** 停止指定环境的 mihomo 进程 */
export function stopMihomoForEnv(envId: string): void {
  const instance = runningInstances.get(envId);
  if (!instance) return;
  try { instance.process.kill(); } catch { /* already dead */ }
  runningInstances.delete(envId);

  // 清理临时配置
  try {
    const configPath = path.join(app.getPath('userData'), 'profiles', envId, 'mihomo.yaml');
    if (fs.existsSync(configPath)) fs.rmSync(configPath, { force: true });
  } catch { /* ignore */ }
}

/** 停止所有 mihomo 进程（app quit 时调用） */
export function stopAllMihomo(): void {
  for (const envId of runningInstances.keys()) {
    stopMihomoForEnv(envId);
  }
}

// ── 测速 ──────────────────────────────────────────────────────────────────────

const TEST_URL = 'http://www.gstatic.com/generate_204';
const TEST_TIMEOUT = 5000;

function callDelayApi(controlPort: number, proxyName: string): Promise<number> {
  return new Promise((resolve) => {
    const encodedName = encodeURIComponent(proxyName);
    const encodedUrl = encodeURIComponent(TEST_URL);
    const urlPath = `/proxies/${encodedName}/delay?timeout=${TEST_TIMEOUT}&url=${encodedUrl}`;
    const req = http.get({
      host: '127.0.0.1',
      port: controlPort,
      path: urlPath,
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { delay?: number };
          resolve(body.delay ?? -1);
        } catch {
          resolve(-1);
        }
      });
    });
    req.on('error', () => resolve(-1));
    req.setTimeout(TEST_TIMEOUT + 2000, () => { req.destroy(); resolve(-1); });
  });
}

async function runWithTempMihomo<T>(
  sourceId: string,
  fn: (controlPort: number) => Promise<T>,
  explicitProxyYamls?: string[],
): Promise<T> {
  const bin = getMihomoPath();
  if (!fs.existsSync(bin)) {
    throw new Error('未安装 mihomo，无法测速');
  }

  const socksPort = await getFreePortInRange(40000, 49999);
  const controlPort = await getFreePortInRange(50000, 50999);

  // 用 mode=global 配置，只需加载所有代理
  const configContent = buildMihomoConfig(sourceId, '', socksPort, controlPort, 'test', explicitProxyYamls);
  const tmpConfig = path.join(getMihomoDir(), `test-${Date.now()}.yaml`);
  fs.writeFileSync(tmpConfig, configContent, 'utf-8');

  const proc = spawn(bin, ['-f', tmpConfig], { detached: false, stdio: 'ignore' });

  try {
    await waitForControlApi(controlPort, 8000);
    return await fn(controlPort);
  } finally {
    try { proc.kill(); } catch { /* ignore */ }
    try { fs.rmSync(tmpConfig, { force: true }); } catch { /* ignore */ }
  }
}

/**
 * TCP 直连测试（备用）：测量连接到 host:port 的耗时（ms），失败返回 -1。
 */
export function tcpPing(host: string, port: number, timeout = 5000): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve(ms);
    });
    socket.on('error', () => { socket.destroy(); resolve(-1); });
    socket.on('timeout', () => { socket.destroy(); resolve(-1); });
  });
}

/**
 * 测试单个节点延迟（ms），失败或超时返回 -1。
 * 依赖 mihomo 已安装；rawYaml 在备份文件不存在时用于构建 mihomo 配置。
 */
export async function testNodeDelay(
  sourceId: string,
  nodeName: string,
  nodeRawYaml?: string,
): Promise<number> {
  return runWithTempMihomo(
    sourceId,
    (controlPort) => callDelayApi(controlPort, nodeName),
    nodeRawYaml ? [nodeRawYaml] : undefined,
  );
}

/**
 * 批量测试某个订阅源所有节点的延迟。
 * 返回 Record<nodeName, ms>，失败节点为 -1。
 */
export async function testSourceDelays(
  sourceId: string,
  nodes: ProxyNode[],
): Promise<Record<string, number>> {
  if (nodes.length === 0) return {};

  // Pass all node rawYamls so that if backup file is missing, mihomo can still load them
  const explicitYamls = nodes.map(n => n.rawYaml).filter(Boolean) as string[];

  return runWithTempMihomo(sourceId, async (controlPort) => {
    const results: Record<string, number> = {};
    // 并发测速，每批 10 个
    const CONCURRENCY = 10;
    for (let i = 0; i < nodes.length; i += CONCURRENCY) {
      const batch = nodes.slice(i, i + CONCURRENCY);
      const delays = await Promise.all(
        batch.map(n => callDelayApi(controlPort, n.name)),
      );
      batch.forEach((n, idx) => { results[n.name] = delays[idx]!; });
    }
    return results;
  }, explicitYamls);
}
