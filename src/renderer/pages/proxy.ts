import type { ProxySource, ProxyNode } from '../../types';
import { showModal } from '../modal';
import { toast } from '../toast';
import * as statusBar from '../status-bar';

const api = window.api;

let sources: ProxySource[] = [];
let currentSourceId = '';
let currentNodes: ProxyNode[] = [];
let sortByDelay: 'asc' | 'desc' | null = null;

const sourcesTbody = document.getElementById('sources-tbody') as HTMLTableSectionElement;
const nodesTbody = document.getElementById('nodes-tbody') as HTMLTableSectionElement;
const nodesTitle = document.getElementById('nodes-source-title') as HTMLElement;
const nodesCount = document.getElementById('nodes-count') as HTMLElement;
const btnTestAll = document.getElementById('btn-test-all') as HTMLButtonElement;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatUpdated(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function renderDelayBadge(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms < 0) return '<span style="color:#cc0000">超时</span>';
  if (ms < 200) return `<span style="color:#008000">${ms}ms</span>`;
  if (ms < 500) return `<span style="color:#cc7700">${ms}ms</span>`;
  return `<span style="color:#cc0000">${ms}ms</span>`;
}

function getSortedNodes(): ProxyNode[] {
  if (!sortByDelay) return [...currentNodes];
  return [...currentNodes].sort((a, b) => {
    const toVal = (ms?: number) => ms === undefined ? 99999 : ms < 0 ? 99998 : ms;
    return sortByDelay === 'asc' ? toVal(a.delay) - toVal(b.delay) : toVal(b.delay) - toVal(a.delay);
  });
}

function renderNodes(): void {
  const th = document.getElementById('nodes-delay-th');
  if (th) th.textContent = sortByDelay === 'asc' ? '延迟 ↑' : sortByDelay === 'desc' ? '延迟 ↓' : '延迟 ⇅';

  const nodes = getSortedNodes();
  if (nodes.length === 0) {
    nodesTbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:12px">没有节点</td></tr>`;
    return;
  }
  nodesTbody.innerHTML = nodes.map(n => `
    <tr>
      <td title="${escHtml(n.name)}">${escHtml(n.name)}</td>
      <td>${escHtml(n.type)}</td>
      <td>${escHtml(n.server)}</td>
      <td>${n.port}</td>
      <td class="delay-cell" data-id="${escHtml(n.id)}">${renderDelayBadge(n.delay)}</td>
      <td class="node-action-cell">
        <button class="btn-icon btn-edit-node" data-id="${escHtml(n.id)}" title="编辑节点配置">✎</button>
        <button class="btn-icon btn-test-node" data-id="${escHtml(n.id)}" title="测速">⟳</button>
      </td>
    </tr>
  `).join('');

  nodesTbody.querySelectorAll<HTMLButtonElement>('.btn-test-node').forEach(btn => {
    btn.addEventListener('click', () => testNodeDelay(btn.dataset['id']!));
  });
  nodesTbody.querySelectorAll<HTMLButtonElement>('.btn-edit-node').forEach(btn => {
    btn.addEventListener('click', () => editNode(btn.dataset['id']!));
  });
}

function renderSources(): void {
  if (sources.length === 0) {
    sourcesTbody.innerHTML = `<tr class="empty-row"><td colspan="4" style="text-align:center;padding:12px">暂无订阅源</td></tr>`;
    return;
  }
  sourcesTbody.innerHTML = sources.map(s => `
    <tr class="${s.id === currentSourceId ? 'selected' : ''}" data-id="${escHtml(s.id)}" style="cursor:pointer">
      <td title="${escHtml(s.name)}">${escHtml(s.name)}</td>
      <td>${s.nodeCount}</td>
      <td>${formatUpdated(s.lastUpdated)}</td>
      <td class="src-action-cell">
        <button class="btn-icon btn-edit-src" data-id="${escHtml(s.id)}" title="编辑名称和订阅地址">✎</button>
        <button class="btn-icon btn-refresh-src" data-id="${escHtml(s.id)}" title="刷新订阅">⟳</button>
        <button class="btn-icon btn-del-src btn-danger" data-id="${escHtml(s.id)}" title="删除">✕</button>
      </td>
    </tr>
  `).join('');

  sourcesTbody.querySelectorAll<HTMLTableRowElement>('tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      loadNodes(row.dataset['id']!);
    });
  });
  sourcesTbody.querySelectorAll<HTMLButtonElement>('.btn-edit-src').forEach(btn => {
    btn.addEventListener('click', () => editSource(btn.dataset['id']!));
  });
  sourcesTbody.querySelectorAll<HTMLButtonElement>('.btn-refresh-src').forEach(btn => {
    btn.addEventListener('click', () => refreshSource(btn.dataset['id']!));
  });
  sourcesTbody.querySelectorAll<HTMLButtonElement>('.btn-del-src').forEach(btn => {
    btn.addEventListener('click', () => deleteSource(btn.dataset['id']!));
  });
}

async function loadNodes(sourceId: string): Promise<void> {
  currentSourceId = sourceId;
  sortByDelay = null; // reset sort when switching source
  const src = sources.find(s => s.id === sourceId);
  nodesTitle.textContent = src ? `节点列表 — ${src.name}` : '节点列表';
  renderSources(); // refresh selection
  btnTestAll.disabled = false;

  const nodes: ProxyNode[] = await api.proxyNodes(sourceId);
  currentNodes = nodes;
  nodesCount.textContent = `(${nodes.length} 个节点)`;
  renderNodes();
}

async function testNodeDelay(nodeId: string): Promise<void> {
  const cell = nodesTbody.querySelector<HTMLElement>(`.delay-cell[data-id="${nodeId}"]`);
  if (cell) cell.innerHTML = '<span style="color:#888">测速中...</span>';
  const ms = await api.proxyTestDelay(nodeId);
  if (cell) cell.innerHTML = renderDelayBadge(ms);
  const node = currentNodes.find(n => n.id === nodeId);
  if (node) {
    node.delay = ms;
    void api.proxySaveNodeDelay(nodeId, ms); // persist to store, best-effort
  }
}

async function testAllDelays(): Promise<void> {
  if (!currentSourceId) return;
  btnTestAll.disabled = true;
  btnTestAll.textContent = '测速中...';
  // Show all as pending
  nodesTbody.querySelectorAll<HTMLElement>('.delay-cell').forEach(cell => {
    cell.innerHTML = '<span style="color:#888">测速中...</span>';
  });
  try {
    const results = await api.proxyTestAllDelays(currentSourceId);
    currentNodes.forEach(node => {
      const ms = results[node.name];
      node.delay = ms;
    });
    // Re-render with sort applied, then persist all delays
    renderNodes();
    currentNodes.forEach(node => {
      if (node.delay !== undefined) {
        void api.proxySaveNodeDelay(node.id, node.delay); // persist, best-effort
      }
    });
  } catch (e) {
    toast(`测速失败: ${(e as Error).message}`, 'error');
  } finally {
    btnTestAll.disabled = false;
    btnTestAll.textContent = '一键测速';
  }
}

async function refreshSource(id: string): Promise<void> {
  try {
    toast('正在刷新...', 'info', 1500);
    const updated = await api.proxyRefreshSource(id);
    const idx = sources.findIndex(s => s.id === id);
    if (idx >= 0) sources[idx] = updated;
    renderSources();
    if (currentSourceId === id) loadNodes(id);
    statusBar.updateNodesCount(sources.reduce((acc, s) => acc + s.nodeCount, 0));
    toast(`已刷新，共 ${updated.nodeCount} 个节点`, 'success');
  } catch (e: unknown) {
    toast(`刷新失败: ${(e as Error).message}`, 'error');
  }
}

async function editSource(id: string): Promise<void> {
  const src = sources.find(s => s.id === id);
  if (!src) return;
  interface EditData { name: string; url: string }
  const result = await showModal<EditData>('编辑订阅源', (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <div class="field-row-stacked"><label>名称</label><input id="m-name" type="text" value="${escHtml(src.name)}" style="width:320px" /></div>
      ${src.type === 'subscription' ? `<div class="field-row-stacked"><label>订阅地址</label><input id="m-url" type="text" value="${escHtml(src.url)}" style="width:320px" /></div>` : ''}
      <div class="modal-footer"><button id="m-ok">保存</button><button id="m-cancel">取消</button></div>
    </div>`;
    body.querySelector('#m-ok')!.addEventListener('click', () => {
      const name = (body.querySelector<HTMLInputElement>('#m-name')!).value.trim();
      if (!name) { alert('名称不能为空'); return; }
      const urlEl = body.querySelector<HTMLInputElement>('#m-url');
      resolve({ name, url: urlEl ? urlEl.value.trim() : src.url });
    });
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(null as unknown as EditData));
  });
  if (!result) return;
  try {
    const patch: { name?: string; url?: string } = {};
    if (result.name !== src.name) patch.name = result.name;
    if (result.url !== src.url) patch.url = result.url;
    if (Object.keys(patch).length === 0) return;
    const updated = await api.proxyUpdateSource(id, patch);
    const idx = sources.findIndex(s => s.id === id);
    if (idx >= 0) sources[idx] = updated;
    renderSources();
    toast('已保存', 'success');
  } catch (e: unknown) {
    toast(`保存失败: ${(e as Error).message}`, 'error');
  }
}

async function deleteSource(id: string): Promise<void> {
  await api.proxyDeleteSource(id);
  sources = sources.filter(s => s.id !== id);
  if (currentSourceId === id) {
    currentSourceId = '';
    currentNodes = [];
    btnTestAll.disabled = true;
    nodesTbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:12px">选择左侧订阅源查看节点</td></tr>`;
    nodesTitle.textContent = '节点列表';
    nodesCount.textContent = '';
  }
  renderSources();
  statusBar.updateSubsCount(sources.length);
  statusBar.updateNodesCount(sources.reduce((acc, s) => acc + s.nodeCount, 0));
  toast('已删除', 'info');
}

async function editNode(nodeId: string): Promise<void> {
  const node = currentNodes.find(n => n.id === nodeId);
  if (!node) return;
  interface EditResult { rawYaml: string }
  const result = await showModal<EditResult>(`编辑节点 — ${node.name}`, (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <p style="margin:0 0 6px;color:#666;font-size:12px">修改节点的 YAML 配置，保存后自动更新名称、类型、服务器等字段</p>
      <textarea id="m-yaml" rows="14" style="width:420px;font-family:monospace;font-size:12px;resize:vertical">${escHtml(node.rawYaml)}</textarea>
      <div class="modal-footer"><button id="m-ok">保存</button><button id="m-cancel">取消</button></div>
    </div>`;
    body.querySelector('#m-ok')!.addEventListener('click', () => {
      const rawYaml = (body.querySelector<HTMLTextAreaElement>('#m-yaml')!).value.trim();
      if (!rawYaml) { alert('YAML 不能为空'); return; }
      resolve({ rawYaml });
    });
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(null as unknown as EditResult));
  });
  if (!result) return;
  try {
    const updated = await api.proxyUpdateNodeYaml(nodeId, result.rawYaml);
    const idx = currentNodes.findIndex(n => n.id === nodeId);
    if (idx >= 0) currentNodes[idx] = updated;
    renderNodes();
    toast('节点已更新', 'success');
  } catch (e: unknown) {
    toast(`保存失败: ${(e as Error).message}`, 'error');
  }
}

async function showAddSubDialog(): Promise<void> {
  interface SubData { url: string; name: string }
  const result = await showModal<SubData>('添加订阅', (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <div class="field-row-stacked"><label>订阅地址 (URL)</label><input id="m-url" type="text" placeholder="https://..." style="width:340px" /></div>
      <div class="field-row-stacked"><label>名称 (可选)</label><input id="m-name" type="text" placeholder="留空则自动取域名" /></div>
      <div class="modal-footer"><button id="m-ok">添加</button><button id="m-cancel">取消</button></div>
    </div>`;
    body.querySelector('#m-ok')!.addEventListener('click', () => {
      const url = (body.querySelector<HTMLInputElement>('#m-url')!).value.trim();
      if (!url) { alert('请填写订阅地址'); return; }
      resolve({ url, name: (body.querySelector<HTMLInputElement>('#m-name')!).value.trim() });
    });
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(null as unknown as SubData));
  });
  if (!result) return;
  try {
    toast('正在添加并拉取订阅...', 'info', 3000);
    const src = await api.proxyAddSub(result.url, result.name);
    sources.push(src);
    renderSources();
    statusBar.updateSubsCount(sources.length);
    statusBar.updateNodesCount(sources.reduce((acc, s) => acc + s.nodeCount, 0));
    toast(`订阅已添加，共 ${src.nodeCount} 个节点`, 'success');
  } catch (e: unknown) {
    toast(`添加失败: ${(e as Error).message}`, 'error');
  }
}

export async function init(): Promise<void> {
  document.getElementById('btn-add-sub')!.addEventListener('click', showAddSubDialog);
  document.getElementById('btn-import-file')!.addEventListener('click', async () => {
    const src = await api.proxyImportFile();
    if (!src) return;
    sources.push(src);
    renderSources();
    statusBar.updateSubsCount(sources.length);
    statusBar.updateNodesCount(sources.reduce((acc, s) => acc + s.nodeCount, 0));
    toast(`已导入 ${src.nodeCount} 个节点`, 'success');
  });
  btnTestAll.addEventListener('click', testAllDelays);

  // Sort by delay on column header click
  document.getElementById('nodes-delay-th')?.addEventListener('click', () => {
    if (sortByDelay === null) sortByDelay = 'asc';
    else if (sortByDelay === 'asc') sortByDelay = 'desc';
    else sortByDelay = null;
    renderNodes();
  });

  sources = await api.proxySources();
  renderSources();
}
