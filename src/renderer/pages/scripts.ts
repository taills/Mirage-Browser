import type { Script } from '../../types';
import { showConfirm } from '../modal';
import { toast } from '../toast';
import * as statusBar from '../status-bar';

const api = window.api;

let scripts: Script[] = [];
let currentId: string | null = null;

const listEl = document.getElementById('scripts-list') as HTMLUListElement;
const nameInput = document.getElementById('script-name-input') as HTMLInputElement;
const editor = document.getElementById('script-editor') as HTMLTextAreaElement;
const runEnvSelect = document.getElementById('script-run-env') as HTMLSelectElement;

function render(): void {
  listEl.innerHTML = scripts.map(s => `
    <li class="${s.id === currentId ? 'active' : ''}" data-id="${s.id}">
      ${s.name || '未命名脚本'}
    </li>
  `).join('') || `<li style="color:#888;padding:8px;font-size:12px">暂无脚本</li>`;

  listEl.querySelectorAll<HTMLLIElement>('li[data-id]').forEach(li => {
    li.addEventListener('click', () => selectScript(li.dataset['id']!));
  });
}

function selectScript(id: string): void {
  currentId = id;
  const s = scripts.find(x => x.id === id);
  if (!s) return;
  nameInput.value = s.name;
  editor.value = s.content;
  showEditorToolbar();
  render();
}

function showEditorToolbar(): void {
  const toolbar = document.getElementById('script-editor-toolbar');
  if (toolbar) toolbar.style.display = '';
}

async function loadEnvs(): Promise<void> {
  const runtimes = await api.envStatusAll();
  const running = Object.values(runtimes).filter(r => r.running);
  const envs = await api.envList();
  runEnvSelect.innerHTML = `<option value="">选择运行环境</option>` + running.map(r => {
    const env = envs.find(e => e.id === r.envId);
    return `<option value="${r.envId}">${env?.name || r.envId}</option>`;
  }).join('');
}

export async function init(): Promise<void> {
  scripts = await api.scriptList();
  render();

  document.getElementById('btn-new-script')!.addEventListener('click', () => {
    currentId = null;
    nameInput.value = '';
    editor.value = '';
    showEditorToolbar();
    render();
  });

  document.getElementById('btn-save-script')!.addEventListener('click', async () => {
    const name = nameInput.value.trim() || '未命名脚本';
    const content = editor.value;
    if (currentId) {
      await api.scriptUpdate(currentId, { name, content });
      const idx = scripts.findIndex(s => s.id === currentId);
      if (idx >= 0) scripts[idx] = { ...scripts[idx]!, name, content };
    } else {
      const s = await api.scriptCreate(name, content);
      scripts.push(s);
      currentId = s.id;
      statusBar.updateScriptsCount(scripts.length);
    }
    render();
    toast('脚本已保存', 'success');
  });

  document.getElementById('btn-delete-script')!.addEventListener('click', async () => {
    if (!currentId) return;
    const s = scripts.find(x => x.id === currentId);
    const ok = await showConfirm(`确认删除脚本 "${s?.name || '未命名'}"？`);
    if (!ok) return;
    await api.scriptDelete(currentId);
    scripts = scripts.filter(x => x.id !== currentId);
    statusBar.updateScriptsCount(scripts.length);
    currentId = null;
    nameInput.value = '';
    editor.value = '';
    render();
    toast('已删除', 'info');
  });

  document.getElementById('btn-run-script')!.addEventListener('click', async () => {
    const envId = runEnvSelect.value;
    if (!envId) { toast('请先选择运行环境', 'error'); return; }
    try {
      await api.scriptRun(envId, editor.value);
      toast('脚本已执行', 'success');
    } catch (e: unknown) {
      toast(`执行失败: ${(e as Error).message}`, 'error');
    }
  });

  // Refresh running envs when tab is activated or dropdown is opened
  document.querySelector<HTMLElement>('[aria-controls="panel-scripts"]')?.addEventListener('click', loadEnvs);
  runEnvSelect.addEventListener('mousedown', loadEnvs);
  loadEnvs();
}
