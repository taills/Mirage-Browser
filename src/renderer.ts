import 'xp.css';
import './index.css';
// global.d.ts provides window.api typings (ambient, no import needed)

import * as envsPage from './renderer/pages/envs';
import * as proxyPage from './renderer/pages/proxy';
import * as scriptsPage from './renderer/pages/scripts';
import * as settingsPage from './renderer/pages/settings';
import * as aboutPage from './renderer/pages/about';
import * as statusBar from './renderer/status-bar';

// ===== 标签页切换 =====
const tabs = document.querySelectorAll<HTMLElement>('#main-tabs button[role="tab"]');
const panels = document.querySelectorAll<HTMLElement>('article[role="tabpanel"]');

function activateTab(targetId: string): void {
  tabs.forEach(t => {
    const panelId = t.getAttribute('aria-controls');
    t.setAttribute('aria-selected', panelId === targetId ? 'true' : 'false');
  });
  panels.forEach(p => {
    if (p.id === targetId) p.removeAttribute('hidden');
    else p.setAttribute('hidden', '');
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = tab.getAttribute('aria-controls');
    if (targetId) activateTab(targetId);
  });
});

// ===== 窗口控制 =====
const btnMinimize = document.getElementById('btn-minimize');
const btnMaximize = document.getElementById('btn-maximize');
const btnClose    = document.getElementById('btn-close');

btnMinimize?.addEventListener('click', () => window.windowControls.minimize());
btnMaximize?.addEventListener('click', () => window.windowControls.maximize());
btnClose?.addEventListener('click',    () => window.windowControls.close());

// 最大化 ↔ 还原时切换按钮图标
window.windowControls.onMaximized((maximized) => {
  btnMaximize?.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
});

// ===== 初始化各页面 =====
async function bootstrap(): Promise<void> {
  envsPage.init();

  // 初始化其他页面
  await proxyPage.init();
  await scriptsPage.init();
  await settingsPage.init();
  aboutPage.init();

  // 初始化状态栏（时钟 + 版本号 + 初始计数）
  await statusBar.init();
  const [srcs, scrpts] = await Promise.all([
    window.api.proxySources(),
    window.api.scriptList(),
  ]);
  statusBar.updateSubsCount(srcs.length);
  statusBar.updateNodesCount(srcs.reduce((acc, s) => acc + s.nodeCount, 0));
  statusBar.updateScriptsCount(scrpts.length);

  // 加载环境列表
  await envsPage.loadEnvs();

  // 监听环境状态推送
  window.api.onEnvStatusUpdate((envId, runtime) => {
    envsPage.updateRuntime(envId, runtime);
  });
}

bootstrap().catch(console.error);

