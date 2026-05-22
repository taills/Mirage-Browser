const container = document.getElementById('toast-container') as HTMLElement;

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000): void {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => { el.remove(); }, 450);
  }, duration);
}
