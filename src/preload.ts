// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig, Environment, ProxySource, ProxyNode, Script, EnvRuntime, TrustedCert,
} from './types';

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),
  onMaximized: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event, maximized: boolean) => {
      callback(maximized);
    });
  },
});

contextBridge.exposeInMainWorld('api', {
  // Settings
  settingsGet: (): Promise<AppConfig> => ipcRenderer.invoke('settings:get'),
  settingsSave: (config: AppConfig): Promise<void> => ipcRenderer.invoke('settings:save', config),

  // Environments
  envList: (): Promise<Environment[]> => ipcRenderer.invoke('env:list'),
  envCreate: (data: { name: string; count?: number; fpOverride?: import('./types').FingerprintOverride; homePage?: string; notes?: string; proxyMode?: '' | 'simple' | 'mihomo'; proxySimple?: string; proxySourceId?: string; proxyNodeId?: string }): Promise<Environment | Environment[]> =>
    ipcRenderer.invoke('env:create', data),
  envUpdate: (id: string, data: Partial<Environment>): Promise<Environment> =>
    ipcRenderer.invoke('env:update', id, data),
  envDelete: (id: string): Promise<void> => ipcRenderer.invoke('env:delete', id),
  envLaunch: (id: string): Promise<EnvRuntime> => ipcRenderer.invoke('env:launch', id),
  envClose: (id: string): Promise<EnvRuntime> => ipcRenderer.invoke('env:close', id),
  envStatusAll: (): Promise<Record<string, EnvRuntime>> => ipcRenderer.invoke('env:statusAll'),
  envRegenerateFP: (id: string): Promise<Environment> => ipcRenderer.invoke('env:regenerateFP', id),

  // Proxy
  proxySources: (): Promise<ProxySource[]> => ipcRenderer.invoke('proxy:sources'),
  proxyAddSub: (url: string, name: string): Promise<ProxySource> => ipcRenderer.invoke('proxy:addSub', url, name),
  proxyImportFile: (): Promise<ProxySource | null> => ipcRenderer.invoke('proxy:importFile'),
  proxyRefreshSource: (id: string): Promise<ProxySource> => ipcRenderer.invoke('proxy:refreshSource', id),
  proxyDeleteSource: (id: string): Promise<void> => ipcRenderer.invoke('proxy:deleteSource', id),
  proxyUpdateSource: (id: string, data: { name?: string; url?: string }): Promise<ProxySource> =>
    ipcRenderer.invoke('proxy:updateSource', id, data),
  proxyNodes: (sourceId?: string): Promise<ProxyNode[]> => ipcRenderer.invoke('proxy:nodes', sourceId),
  proxyTestDelay: (nodeId: string): Promise<number> => ipcRenderer.invoke('proxy:testDelay', nodeId),
  proxyTestAllDelays: (sourceId: string): Promise<Record<string, number>> =>
    ipcRenderer.invoke('proxy:testAllDelays', sourceId),
  proxySaveNodeDelay: (nodeId: string, delay: number): Promise<void> =>
    ipcRenderer.invoke('proxy:saveNodeDelay', nodeId, delay),
  proxyUpdateNodeYaml: (nodeId: string, rawYaml: string): Promise<ProxyNode> =>
    ipcRenderer.invoke('proxy:updateNodeYaml', nodeId, rawYaml),

  // Mihomo
  mihomoStatus: (): Promise<{ installed: boolean; version: string | null; dir: string }> =>
    ipcRenderer.invoke('mihomo:status'),
  mihomoCheckUpdate: (): Promise<{ version: string; downloadUrl: string }> =>
    ipcRenderer.invoke('mihomo:checkUpdate'),
  mihomoDownload: (downloadUrl: string): Promise<void> =>
    ipcRenderer.invoke('mihomo:download', downloadUrl),
  mihomoUninstall: (): Promise<void> => ipcRenderer.invoke('mihomo:uninstall'),
  onMihomoProgress: (cb: (pct: number) => void) => {
    ipcRenderer.on('mihomo:downloadProgress', (_e, pct: number) => cb(pct));
  },

  // Scripts
  scriptList: (): Promise<Script[]> => ipcRenderer.invoke('script:list'),
  scriptCreate: (name: string, content: string): Promise<Script> =>
    ipcRenderer.invoke('script:create', name, content),
  scriptUpdate: (id: string, data: Partial<Script>): Promise<Script> =>
    ipcRenderer.invoke('script:update', id, data),
  scriptDelete: (id: string): Promise<void> => ipcRenderer.invoke('script:delete', id),
  scriptRun: (envId: string, content: string): Promise<{ success: boolean; result: unknown }> =>
    ipcRenderer.invoke('script:run', envId, content),

  // App
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  appCheckUpdate: (): Promise<{ latestVersion: string; downloadUrl: string }> =>
    ipcRenderer.invoke('app:checkUpdate'),

  // Status push events
  onEnvStatusUpdate: (cb: (envId: string, runtime: EnvRuntime) => void) => {
    ipcRenderer.on('env:statusUpdate', (_e, payload: { envId: string; runtime: EnvRuntime }) => {
      cb(payload.envId, payload.runtime);
    });
  },

  // Certificates
  certList: (): Promise<TrustedCert[]> => ipcRenderer.invoke('cert:list'),
  certImport: (): Promise<{ cert: TrustedCert; trustResult: { success: boolean; error?: string } } | null> =>
    ipcRenderer.invoke('cert:import'),
  certDelete: (id: string): Promise<void> => ipcRenderer.invoke('cert:delete', id),
});
