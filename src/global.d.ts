import type {
  AppConfig, Environment, ProxySource, ProxyNode, Script, EnvRuntime, TrustedCert
} from './types';

declare global {
  interface Window {
    windowControls: {
      minimize(): void;
      maximize(): void;
      close(): void;
      onMaximized(cb: (maximized: boolean) => void): void;
    };
    api: {
      // Settings
      settingsGet(): Promise<AppConfig>;
      settingsSave(config: AppConfig): Promise<void>;
      // Environments
      envList(): Promise<Environment[]>;
      envCreate(data: { name: string; count?: number; homePage?: string; fpOverride?: import('./types').FingerprintOverride; notes?: string; proxyMode?: '' | 'simple' | 'mihomo'; proxySimple?: string; proxySourceId?: string; proxyNodeId?: string }): Promise<Environment | Environment[]>;
      envUpdate(id: string, data: Partial<Environment>): Promise<Environment>;
      envDelete(id: string): Promise<void>;
      envLaunch(id: string): Promise<EnvRuntime>;
      envClose(id: string): Promise<EnvRuntime>;
      envStatusAll(): Promise<Record<string, EnvRuntime>>;
      envRegenerateFP(id: string): Promise<Environment>;
      // Proxy
      proxySources(): Promise<ProxySource[]>;
      proxyAddSub(url: string, name: string): Promise<ProxySource>;
      proxyImportFile(): Promise<ProxySource | null>;
      proxyRefreshSource(id: string): Promise<ProxySource>;
      proxyDeleteSource(id: string): Promise<void>;
      proxyUpdateSource(id: string, data: { name?: string; url?: string }): Promise<ProxySource>;
      proxyNodes(sourceId?: string): Promise<ProxyNode[]>;
      proxyTestDelay(nodeId: string): Promise<number>;
      proxyTestAllDelays(sourceId: string): Promise<Record<string, number>>;
      proxySaveNodeDelay(nodeId: string, delay: number): Promise<void>;
      proxyUpdateNodeYaml(nodeId: string, rawYaml: string): Promise<ProxyNode>;
      // Mihomo
      mihomoStatus(): Promise<{ installed: boolean; version: string | null; dir: string }>;
      mihomoCheckUpdate(): Promise<{ version: string; downloadUrl: string }>;
      mihomoDownload(downloadUrl: string): Promise<void>;
      mihomoUninstall(): Promise<void>;
      onMihomoProgress(cb: (pct: number) => void): void;
      // Scripts
      scriptList(): Promise<Script[]>;
      scriptCreate(name: string, content: string): Promise<Script>;
      scriptUpdate(id: string, data: Partial<Script>): Promise<Script>;
      scriptDelete(id: string): Promise<void>;
      scriptRun(envId: string, content: string): Promise<{ success: boolean; result: unknown }>;
      // Certificates
      certList(): Promise<TrustedCert[]>;
      certImport(): Promise<{ cert: TrustedCert; trustResult: { success: boolean; error?: string } } | null>;
      certDelete(id: string): Promise<void>;
      // App
      appVersion(): Promise<string>;
      appCheckUpdate(): Promise<{ latestVersion: string; downloadUrl: string }>;
      // Events
      onEnvStatusUpdate(cb: (envId: string, runtime: EnvRuntime) => void): void;
    };
  }
}

export {};
