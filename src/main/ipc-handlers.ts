import { ipcMain, dialog, BrowserWindow, app, net } from 'electron';
import fs from 'node:fs';
import type { Environment, AppConfig, Script, CreateEnvData, ProxyNode, TrustedCert } from '../types';
import * as yaml from 'js-yaml';
import * as store from './store';
import { parseCertFile, addCertToOsTrust, removeCertFromOsTrust } from './cert-manager';
import {
  generateFingerprint, generateUserAgent,
  generateFingerprintWithOverride,
} from './fingerprint';
import {
  launchEnv, closeEnv, getAllRuntimes, detectChrome, getCdpClient,
  type StatusCallback,
} from './chrome-manager';
import { fetchSubscription, parseYamlContent } from './subscription';
import {
  getMihomoPath, getMihomoDir,
  getInstalledVersion, checkLatestRelease, downloadMihomo, uninstallMihomo,
  testNodeDelay, testSourceDelays, tcpPing,
} from './mihomo-manager';

let statusCb: StatusCallback | null = null;

export function setStatusCallback(cb: StatusCallback): void {
  statusCb = cb;
}

function notifyStatus(envId: string, runtime: Parameters<StatusCallback>[1]): void {
  statusCb?.(envId, runtime);
}

export function registerHandlers(): void {
  // ── Settings ────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    const config = store.getConfig();
    if (!config.chromePath) config.chromePath = detectChrome();
    return config;
  });

  ipcMain.handle('settings:save', (_e, config: AppConfig) => store.saveConfig(config));


  // ── Environments ────────────────────────────────────────
  ipcMain.handle('env:list', () => store.listEnvs());

  ipcMain.handle('env:create', (_e, data: CreateEnvData) => {
    const count = Math.max(1, Math.min(data.count ?? 1, 100));
    const created: Environment[] = [];
    for (let i = 0; i < count; i++) {
      let fingerprint = generateFingerprint();
      let userAgent   = generateUserAgent();

      if (data.fpOverride && Object.values(data.fpOverride).some(v => v !== '' && v !== undefined)) {
        const res = generateFingerprintWithOverride(data.fpOverride);
        fingerprint = res.fingerprint;
        userAgent   = res.userAgent;
      }

      const env: Environment = {
        id: store.newId(),
        name: count > 1 ? `${data.name}-${String(i + 1).padStart(3, '0')}` : data.name,
        createdAt: new Date().toISOString(),
        userAgent,
        fingerprint,
        proxyMode: data.proxyMode || '',
        proxySimple: data.proxySimple || '',
        proxySourceId: data.proxySourceId || '',
        proxyNodeId: data.proxyNodeId || '',
        notes: data.notes || '',
        homePage: data.homePage || '',
      };
      store.saveEnv(env);
      created.push(env);
    }
    return count === 1 ? created[0] : created;
  });

  ipcMain.handle('env:update', (_e, id: string, data: Partial<Environment>) => {
    const env = store.getEnv(id);
    if (!env) throw new Error('环境不存在');
    return store.saveEnv({ ...env, ...data });
  });

  ipcMain.handle('env:delete', (_e, id: string) => {
    closeEnv(id);
    store.deleteEnv(id);
  });

  ipcMain.handle('env:launch', async (_e, id: string) => {
    const env = store.getEnv(id);
    if (!env) throw new Error('环境不存在');
    const config = store.getConfig();
    const chromePath = config.chromePath || detectChrome();
    if (!chromePath || !fs.existsSync(chromePath)) {
      throw new Error('未找到 Chrome，请在设置中配置 Chrome 路径');
    }
    return launchEnv(env, chromePath, env.homePage || config.homePage || undefined, notifyStatus);
  });

  ipcMain.handle('env:close', (_e, id: string) => {
    closeEnv(id);
    notifyStatus(id, { envId: id, running: false });
    return { envId: id, running: false };
  });

  ipcMain.handle('env:statusAll', () => getAllRuntimes());

  ipcMain.handle('env:regenerateFP', (_e, id: string) => {
    const env = store.getEnv(id);
    if (!env) throw new Error('环境不存在');
    return store.saveEnv({
      ...env,
      userAgent: generateUserAgent(),
      fingerprint: generateFingerprint(),
    });
  });

  // ── Proxy Sources ────────────────────────────────────────
  ipcMain.handle('proxy:sources', () => store.listSources());

  ipcMain.handle('proxy:addSub', async (_e, url: string, name: string) => {
    let displayName = name;
    if (!displayName) {
      try { displayName = new URL(url).hostname; } catch { displayName = url.slice(0, 30); }
    }
    const source = {
      id: store.newId(),
      name: displayName,
      type: 'subscription' as const,
      url,
      nodeCount: 0,
      lastUpdated: '',
      createdAt: new Date().toISOString(),
    };
    store.saveSource(source);
    try {
      const config = store.getConfig();
      const nodes = await fetchSubscription(url, source.id, config.subscriptionUserAgent);
      store.saveNodes(source.id, nodes);
      source.nodeCount = nodes.length;
      source.lastUpdated = new Date().toISOString();
      store.saveSource(source);
    } catch (e) {
      console.error('[IPC] Subscription fetch error:', e);
    }
    return source;
  });

  ipcMain.handle('proxy:importFile', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'YAML Config', extensions: ['yaml', 'yml'] }],
      title: '导入代理配置文件',
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    const baseName = filePath.split('/').pop()?.replace(/\.(yaml|yml)$/, '') ?? 'Imported';

    const source = {
      id: store.newId(),
      name: baseName,
      type: 'file' as const,
      url: filePath,
      nodeCount: 0,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const nodes = parseYamlContent(content, source.id);
    store.saveNodes(source.id, nodes);
    source.nodeCount = nodes.length;
    store.saveSource(source);
    return source;
  });

  ipcMain.handle('proxy:refreshSource', async (_e, id: string) => {
    const source = store.listSources().find(s => s.id === id);
    if (!source) throw new Error('订阅源不存在');
    if (source.type === 'subscription') {
      const config = store.getConfig();
      const nodes = await fetchSubscription(source.url, source.id, config.subscriptionUserAgent);
      store.saveNodes(source.id, nodes);
      source.nodeCount = nodes.length;
    } else {
      const content = fs.readFileSync(source.url, 'utf-8');
      const nodes = parseYamlContent(content, source.id);
      store.saveNodes(source.id, nodes);
      source.nodeCount = nodes.length;
    }
    source.lastUpdated = new Date().toISOString();
    return store.saveSource(source);
  });

  ipcMain.handle('proxy:deleteSource', (_e, id: string) => store.deleteSource(id));

  ipcMain.handle('proxy:updateSource', (_e, id: string, data: { name?: string; url?: string }) => {
    const sources = store.listSources();
    const source = sources.find(s => s.id === id);
    if (!source) throw new Error('订阅源不存在');
    if (data.name !== undefined) source.name = data.name;
    if (data.url !== undefined) source.url = data.url;
    return store.saveSource(source);
  });

  ipcMain.handle('proxy:nodes', (_e, sourceId?: string) => store.listNodes(sourceId));

  ipcMain.handle('proxy:testDelay', async (_e, nodeId: string) => {
    const nodes = store.listNodes();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return -1;
    try {
      // Pass rawYaml so mihomo can load the proxy even if backup file is missing
      return await testNodeDelay(node.sourceId, node.name, node.rawYaml);
    } catch (e) {
      // Mihomo not installed or failed to start — fall back to TCP ping
      console.warn('[IPC] testDelay mihomo unavailable, falling back to TCP ping:', (e as Error).message);
      return tcpPing(node.server, node.port);
    }
  });

  ipcMain.handle('proxy:testAllDelays', async (_e, sourceId: string) => {
    const nodes = store.listNodes(sourceId);
    if (nodes.length === 0) return {};
    try {
      return await testSourceDelays(sourceId, nodes);
    } catch (e) {
      console.error('[IPC] testAllDelays error:', e);
      return {};
    }
  });

  ipcMain.handle('proxy:saveNodeDelay', (_e, nodeId: string, delay: number) => {
    const node = store.getNode(nodeId);
    if (!node) return;
    node.delay = delay;
    store.updateNode(node);
  });

  ipcMain.handle('proxy:updateNodeYaml', (_e, nodeId: string, rawYaml: string) => {
    const node = store.getNode(nodeId);
    if (!node) throw new Error('节点不存在');
    const parsed = yaml.load(rawYaml) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') throw new Error('无效的 YAML 格式');
    if (!parsed['name']) throw new Error('YAML 缺少 name 字段');
    const updated: ProxyNode = {
      ...node,
      rawYaml,
      name: String(parsed['name']),
      type: String(parsed['type'] ?? node.type),
      server: String(parsed['server'] ?? node.server),
      port: Number(parsed['port'] ?? node.port),
    };
    return store.updateNode(updated);
  });

  // ── Mihomo ────────────────────────────────────────
  ipcMain.handle('mihomo:status', async () => {
    const installed = fs.existsSync(getMihomoPath());
    const version = installed ? await getInstalledVersion() : null;
    const dir = getMihomoDir();
    return { installed, version, dir };
  });

  ipcMain.handle('mihomo:checkUpdate', async () => {
    return checkLatestRelease();
  });

  ipcMain.handle('mihomo:download', async (event, downloadUrl: string) => {
    await downloadMihomo(downloadUrl, (pct) => {
      event.sender.send('mihomo:downloadProgress', pct);
    });
  });

  ipcMain.handle('mihomo:uninstall', () => {
    uninstallMihomo();
  });

  // ── Scripts ────────────────────────────────────────
  ipcMain.handle('script:list', () => store.listScripts());

  ipcMain.handle('script:create', (_e, name: string, content: string) => {
    const script: Script = {
      id: store.newId(),
      name,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return store.saveScript(script);
  });

  ipcMain.handle('script:update', (_e, id: string, data: Partial<Script>) => {
    const scripts = store.listScripts();
    const script = scripts.find(s => s.id === id);
    if (!script) throw new Error('脚本不存在');
    return store.saveScript({ ...script, ...data, updatedAt: new Date().toISOString() });
  });

  ipcMain.handle('script:delete', (_e, id: string) => store.deleteScript(id));

  ipcMain.handle('script:run', async (_e, envId: string, content: string) => {
    const runtimes = getAllRuntimes();
    if (!runtimes[envId]?.running) {
      throw new Error('环境未运行，请先启动该环境');
    }
    const client = getCdpClient(envId);
    if (!client) {
      throw new Error('CDP 尚未就绪，请稍后重试');
    }
    return client.runScript(content);
  });
  // ── Certificates ──────────────────────────────────

  ipcMain.handle('cert:list', () => store.listCerts());

  ipcMain.handle('cert:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: '导入根证书',
      properties: ['openFile'],
      filters: [
        { name: '证书文件', extensions: ['pem', 'crt', 'cer', 'der', 'cert'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const parsed = parseCertFile(filePath);
    const cert: TrustedCert = {
      id: store.newId(),
      name: parsed.suggestedName,
      sha256Fingerprint: parsed.sha256Fingerprint,
      sha1Hex: parsed.sha1Hex,
      spkiFingerprint: parsed.spkiFingerprint,
      subject: parsed.subject,
      addedAt: new Date().toISOString(),
    };
    store.saveCert(cert, parsed.pem);
    const trustResult = await addCertToOsTrust(store.getCertPemPath(cert.id), cert.name);
    return { cert, trustResult };
  });

  ipcMain.handle('cert:delete', async (_e, id: string) => {
    const cert = store.deleteCert(id);
    if (cert) {
      await removeCertFromOsTrust(cert.sha1Hex, cert.name);
    }
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('app:checkUpdate', async () => {
    const res = await net.fetch(
      'https://api.github.com/repos/taills/Mirage-Browser/releases/latest',
      { headers: { 'User-Agent': `MirageBrowser/${app.getVersion()}` } },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json() as { tag_name: string; html_url: string };
    return {
      latestVersion: data.tag_name.replace(/^v/, ''),
      downloadUrl: data.html_url,
    };
  });
}
