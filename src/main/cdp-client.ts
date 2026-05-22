import WebSocket from 'ws';
import http from 'node:http';
import type { FingerprintConfig } from '../types';
import { buildFingerprintScript, getPlatformVersionForUserAgentData } from './fingerprint';

interface CdpMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
  sessionId?: string;
}

interface CdpTargetInfo {
  targetId: string;
  type: string;
  url?: string;
}

interface PendingCmd {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class CdpClient {
  private ws: WebSocket | null = null;
  private cmdId = 0;
  private pending = new Map<number, PendingCmd>();
  private pageSessions: string[] = [];
  private fingerprintedSessions = new Set<string>();

  constructor(
    private debugPort: number,
    private fingerprint: FingerprintConfig,
    private userAgent: string,
  ) {}

  async connect(): Promise<void> {
    const url = await this.getWebSocketUrl();
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.on('open', async () => {
        try {
          await this.startSession();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      this.ws.on('message', (data) => {
        try {
          this.handleMessage(JSON.parse(data.toString()) as CdpMessage);
        } catch { /* ignore parse errors */ }
      });
      this.ws.on('error', reject);
      this.ws.on('close', () => {
        this.pending.forEach(p => {
          clearTimeout(p.timer);
          p.reject(new Error('WebSocket closed'));
        });
        this.pending.clear();
      });
    });
  }

  private getWebSocketUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${this.debugPort}/json/version`, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const info = JSON.parse(data) as { webSocketDebuggerUrl: string };
            resolve(info.webSocketDebuggerUrl);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('DevTools HTTP timeout')); });
    });
  }

  private async startSession(): Promise<void> {
    // Enable Target auto-attach to intercept new pages
    await this.send('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    });

    // Attach to existing pages and apply fingerprint immediately.
    await this.attachExistingPageTargets();
  }

  private async attachExistingPageTargets(): Promise<void> {
    const result = await this.send('Target.getTargets', {}) as { targetInfos?: CdpTargetInfo[] };
    const targets = result.targetInfos ?? [];
    for (const target of targets) {
      if (target.type !== 'page') continue;
      try {
        const attached = await this.send('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: true,
        }) as { sessionId?: string };
        const sessionId = attached.sessionId;
        if (!sessionId) continue;
        await this.applyFingerprint(sessionId);
        if (target.url && !target.url.startsWith('chrome://') && !target.url.startsWith('devtools://')) {
          await this.send('Page.reload', { ignoreCache: true }, sessionId).catch(() => { /* best-effort */ });
        }
      } catch {
        // best-effort attach for already-open pages
      }
    }
  }

  private handleMessage(msg: CdpMessage): void {
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
    } else if (msg.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = msg.params as { sessionId: string; targetInfo: { type: string } };
      if (targetInfo?.type === 'page' && !this.pageSessions.includes(sessionId)) {
        this.pageSessions.push(sessionId);
      }
      // Apply fingerprint to newly attached target
      this.applyFingerprint(sessionId).catch(() => { /* best-effort */ });
    } else if (msg.method === 'Target.detachedFromTarget') {
      const { sessionId } = msg.params as { sessionId: string };
      this.pageSessions = this.pageSessions.filter(s => s !== sessionId);
      this.fingerprintedSessions.delete(sessionId);
    }
  }

  private send(method: string, params: unknown = {}, sessionId?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }
      const id = ++this.cmdId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      const msg: CdpMessage = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.ws.send(JSON.stringify(msg));
    });
  }

  private async applyFingerprint(sessionId: string | undefined): Promise<void> {
    if (sessionId && this.fingerprintedSessions.has(sessionId)) {
      return;
    }
    if (sessionId) {
      this.fingerprintedSessions.add(sessionId);
    }

    const fp = this.fingerprint;
    const send = (method: string, params: unknown) =>
      this.send(method, params, sessionId).catch(() => { /* best-effort */ });
    const scriptSource = buildFingerprintScript(fp, this.userAgent);

    // Map navigator.platform → userAgentData.platform
    const uaDataPlatform = fp.platform === 'Win32'    ? 'Windows'
      : fp.platform === 'MacIntel'                    ? 'macOS'
      : fp.platform === 'iPhone'                      ? 'iOS'
      : fp.platform?.startsWith('Linux')              ? 'Linux'
      : 'Windows';
    const uaDataPlatformVersion = getPlatformVersionForUserAgentData(fp.platform);
    const isMobile = fp.maxTouchPoints > 0;

    await send('Runtime.enable', {});
    await send('Page.enable', {});
    await send('Network.enable', {});
    await send('Emulation.setUserAgentOverride', {
      userAgent: this.userAgent,
      acceptLanguage: fp.language,
      platform: fp.platform ?? 'Win32',
      userAgentMetadata: {
        platform:        uaDataPlatform,
        platformVersion: uaDataPlatformVersion,
        architecture:    fp.architecture ?? 'x86',
        model:           '',
        mobile:          isMobile,
        bitness:         '64',
        wow64:           false,
      },
    });
    // 通过 CDP 在浏览器层覆盖 screen.width / screen.height / devicePixelRatio
    // dontSetVisibleSize:true 保证不改变 Electron 窗口实际尺寸
    await send('Emulation.setDeviceMetricsOverride', {
      width:             fp.screenWidth,
      height:            fp.screenHeight,
      deviceScaleFactor: fp.devicePixelRatio ?? 1,
      mobile:            isMobile,
      screenWidth:       fp.screenWidth,
      screenHeight:      fp.screenHeight,
      dontSetVisibleSize: true,
    });
    await send('Emulation.setTimezoneOverride', { timezoneId: fp.timezone });
    await send('Emulation.setGeolocationOverride', {
      latitude: fp.latitude,
      longitude: fp.longitude,
      accuracy: 10,
    });
    await send('Network.setExtraHTTPHeaders', {
      headers: { 'Accept-Language': fp.language },
    });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: scriptSource,
    });
    await send('Runtime.evaluate', {
      expression: scriptSource,
      returnByValue: true,
      awaitPromise: false,
    });

    if (sessionId) {
      await send('Runtime.runIfWaitingForDebugger', {}).catch(() => { /* best-effort */ });
    }
  }

  async runScript(expression: string): Promise<{ result: unknown; exceptionMessage?: string }> {
    const sessionId = this.pageSessions[this.pageSessions.length - 1];
    if (!sessionId) {
      throw new Error('没有可用的页面会话，请确认 Chrome 已打开页面');
    }
    const raw = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    }, sessionId) as {
      result: { type: string; value?: unknown; description?: string };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    };

    if (raw.exceptionDetails) {
      const msg = raw.exceptionDetails.exception?.description
        ?? raw.exceptionDetails.text
        ?? 'Script threw an exception';
      throw new Error(msg);
    }

    return { result: raw.result.value ?? raw.result.description ?? null };
  }

  close(): void {
    this.pending.forEach(p => {
      clearTimeout(p.timer);
      p.reject(new Error('Client closed'));
    });
    this.pending.clear();
    this.ws?.close();
    this.ws = null;
  }
}
