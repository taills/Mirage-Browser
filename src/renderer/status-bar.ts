// 状态栏模块：时钟、订阅数、节点数、脚本数、版本号

const subsEl    = document.getElementById('status-subs')    as HTMLElement;
const nodesEl   = document.getElementById('status-nodes')   as HTMLElement;
const scriptsEl = document.getElementById('status-scripts') as HTMLElement;
const versionEl = document.getElementById('status-version') as HTMLElement;
const timeEl    = document.getElementById('status-time')    as HTMLElement;

function updateTime(): void {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const HH   = String(now.getHours()).padStart(2, '0');
  const ii   = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  timeEl.textContent = `${yyyy}-${mm}-${dd} ${HH}:${ii}:${ss}`;
}

export function updateSubsCount(count: number): void {
  subsEl.textContent = `订阅: ${count}`;
}

export function updateNodesCount(count: number): void {
  nodesEl.textContent = `节点: ${count}`;
}

export function updateScriptsCount(count: number): void {
  scriptsEl.textContent = `脚本: ${count}`;
}

export async function init(): Promise<void> {
  const version = await window.api.appVersion();
  versionEl.textContent = `v${version}`;
  updateTime();
  setInterval(updateTime, 1000);
}
