const overlay = document.getElementById('modal-overlay') as HTMLElement;
const modalWindow = document.getElementById('modal-window') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
const modalBody = document.getElementById('modal-body') as HTMLElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
const modalTitleBar = modalWindow.querySelector('.title-bar') as HTMLElement;

let currentResolve: ((value: unknown) => void) | null = null;

// 子窗口拖拽逻辑（基于 transform，不影响主窗口）
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragBaseX = 0;
let dragBaseY = 0;
let dragAccX = 0;
let dragAccY = 0;

modalTitleBar.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('.title-bar-controls')) return;
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragBaseX = dragAccX;
  dragBaseY = dragAccY;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  dragAccX = dragBaseX + (e.clientX - dragStartX);
  dragAccY = dragBaseY + (e.clientY - dragStartY);
  modalWindow.style.transform = `translate(${dragAccX}px, ${dragAccY}px)`;
});

document.addEventListener('mouseup', () => {
  dragging = false;
});

modalCloseBtn.addEventListener('click', () => close(null));
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) close(null);
});

function close(value: unknown): void {
  overlay.style.display = 'none';
  modalBody.innerHTML = '';
  currentResolve?.(value);
  currentResolve = null;
}

export function showModal<T>(title: string, buildContent: (body: HTMLElement, resolve: (v: T) => void) => void): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    currentResolve = resolve as (v: unknown) => void;
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    buildContent(modalBody, (v) => { close(v); });
    // 每次打开重置位置
    dragAccX = 0;
    dragAccY = 0;
    modalWindow.style.transform = '';
    overlay.style.display = 'flex';
    // Prevent the window from being too wide
    modalWindow.style.width = 'auto';
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return showModal<boolean>('确认', (body, resolve) => {
    body.innerHTML = `<div class="modal-form">
      <p style="margin-top:0">${escHtml(message)}</p>
      <div class="modal-footer">
        <button id="m-ok">确定</button>
        <button id="m-cancel">取消</button>
      </div>
    </div>`;
    body.querySelector('#m-ok')!.addEventListener('click', () => resolve(true));
    body.querySelector('#m-cancel')!.addEventListener('click', () => resolve(false));
  }).then(v => v ?? false);
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
