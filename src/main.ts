import { app, BrowserWindow, ipcMain, screen, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initStore } from './main/store';
import { registerHandlers, setStatusCallback } from './main/ipc-handlers';
import { closeAll } from './main/chrome-manager';
import { stopAllMihomo } from './main/mihomo-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
// 手动记录最大化前的窗口位置/尺寸，用于还原（比 isMaximized() 在 macOS 上更可靠）
let savedBounds: Electron.Rectangle | null = null;

// IPC window control handlers — registered once, reference mainWindow via closure
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (savedBounds) {
    // 还原到最大化前的尺寸
    mainWindow.setBounds(savedBounds, true);
    savedBounds = null;
    mainWindow.webContents.send('window:maximized', false);
  } else {
    // 保存当前尺寸，再铺满工作区（排除 Dock/任务栏）
    savedBounds = mainWindow.getBounds();
    const { workArea } = screen.getDisplayMatching(savedBounds);
    mainWindow.setBounds(workArea, true);
    mainWindow.webContents.send('window:maximized', true);
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // 隐藏系统标题栏
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
};

app.on('ready', async () => {
  // 在 macOS 上申请摄像头和麦克风权限，确保启动的 Chrome 进程可访问这些设备
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('camera');
    await systemPreferences.askForMediaAccess('microphone');
  }

  initStore();
  registerHandlers();
  createWindow();
  setStatusCallback((envId, runtime) => {
    mainWindow?.webContents.send('env:statusUpdate', { envId, runtime });
  });
});

app.on('window-all-closed', () => {
  stopAllMihomo();
  closeAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
