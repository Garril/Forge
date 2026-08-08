const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const fsAsync = require('fs').promises;
const { spawn } = require('child_process');
const net = require('net');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.development' });

let mainWindow = null;
let serverProcess = null;

const SERVER_PORT = Number(process.env.PORT || 5888);
const getServerRoot = () => app.isPackaged
  ? path.join(process.resourcesPath, 'forge-server')
  : path.resolve(__dirname, '../../forge-server');
const isServerAvailable = () => new Promise(resolve => {
  const socket = net.createConnection({ host: '127.0.0.1', port: SERVER_PORT });
  const finish = available => {
    socket.destroy();
    resolve(available);
  };
  socket.setTimeout(800);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});
const startForgeServer = async () => {
  if (await isServerAvailable()) return true;
  const serverRoot = getServerRoot();
  const serverEntry = path.join(serverRoot, 'src', 'app.js');
  if (!fs.existsSync(serverEntry)) {
    console.error(`Forge Server entry not found: ${serverEntry}`);
    return false;
  }
  const nodeCommand = process.execPath;
  serverProcess = spawn(nodeCommand, [serverEntry], {
    cwd: serverRoot,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    windowsHide: true,
    stdio: 'ignore'
  });
  serverProcess.once('error', error => console.error('Failed to start Forge Server:', error.message));
  serverProcess.once('exit', (code, signal) => {
    if (serverProcess) console.error(`Forge Server exited: code=${code}, signal=${signal || 'none'}`);
    serverProcess = null;
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isServerAvailable()) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error('Forge Server did not become available on port', SERVER_PORT);
  return false;
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Forge',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e222d',
      symbolColor: '#ffffff',
      height: 30
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
  });

  mainWindow.setMenu(null); // 隐藏顶部原生菜单栏

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
  });

  mainWindow.webContents && mainWindow.webContents.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r') || (input.meta && input.key.toLowerCase() === 'r')) {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    }
  });

  if (process.env.NODE_ENV === 'development') {
    // 等待 Vite 服务器就绪
    const waitForVite = async () => {
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await mainWindow.loadURL('http://localhost:5173');
          // mainWindow.webContents.openDevTools();
          return;
        } catch (err) {
          console.log(`Waiting for Vite server... (${i + 1}/${maxAttempts})`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      console.error('Failed to connect to Vite server');
    };
    waitForVite();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(async () => {
  const serverStarted = await startForgeServer();
  if (!serverStarted) console.warn('Forge Server is unavailable; API requests may fail.');
  createWindow();

  // 快捷键锁屏事件支持
  // NOTE: 此处为默认快捷键，后续前端加载完配置后可通过IPC更新这个快捷键
  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('lock-screen');
    }
  });

  // 读取目录内容（带文件大小和内存检测）
  ipcMain.handle('read-directory', async (event, dirPath, options = {}) => {
    try {
      const { checkMemory = false, memoryThreshold = 300 * 1024 * 1024 } = options;
      const dirents = await fsAsync.readdir(dirPath, { withFileTypes: true });
      
      let files = [];
      let totalImageSize = 0;
      let exceededThreshold = false;
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'];
      
      for (const dirent of dirents) {
        const filePath = path.join(dirPath, dirent.name);
        const ext = path.extname(dirent.name).toLowerCase();
        const isImage = imageExts.includes(ext);
        
        let size = 0;
        if (!dirent.isDirectory()) {
          try {
            const stats = await fsAsync.stat(filePath);
            size = stats.size;
          } catch (e) {
            // 忽略无法获取大小的文件
          }
        }
        
        // 检测内存：如果是图片且需要检测内存
        if (checkMemory && isImage && !exceededThreshold) {
          totalImageSize += size;
          if (totalImageSize > memoryThreshold) {
            exceededThreshold = true;
          }
        }
        
        files.push({
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          path: filePath,
          size: size,
          isImage: isImage
        });
      }
      
      return { 
        success: true, 
        data: files,
        memoryExceeded: exceededThreshold,
        totalImageSize: totalImageSize
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 重命名文件
  ipcMain.handle('batch-rename', async (event, { dirPath, renameConfig, selectedFiles }) => {
    try {
      const { type, customPrefix, customSuffix } = renameConfig;
      let results = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const oldPath = file.path;
        const ext = path.extname(file.name);
        const nameWithoutExt = path.basename(file.name, ext);
        
        let newName = file.name;
        const indexStr = String(i + 1).padStart(2, '0');

        if (type === 'prefix') {
          newName = `${customPrefix}${file.name}`;
        } else if (type === 'suffix') {
          newName = `${nameWithoutExt}${customSuffix}${ext}`;
        } else if (type === 'sequence') {
          newName = `${indexStr}${ext}`;
        } else if (type === 'prefix-sequence') {
          newName = `${customPrefix}-${indexStr}${ext}`;
        }

        const newPath = path.join(dirPath, newName);
        
        // 检查目标文件是否已存在
        if (await fsAsync.access(newPath).then(() => true).catch(() => false)) {
          if (oldPath !== newPath) {
            throw new Error(`目标文件已存在: ${newName}`);
          }
        }
        
        await fsAsync.rename(oldPath, newPath);
        results.push({ old: file.name, new: newName });
      }
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 显示确认框
  ipcMain.handle('show-confirm-dialog', async (event, options) => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['确认', '取消'],
      title: options.title || '确认操作',
      message: options.message || '请确认您的操作',
      detail: options.detail || ''
    });
    return response === 0;
  });

  ipcMain.handle('show-system-notification', async (event, options = {}) => {
    const { Notification } = require('electron');
    if (!Notification.isSupported()) return { success: false, message: '系统不支持通知' };
    const notification = new Notification({
      title: options.title || 'Forge',
      body: options.body || ''
    });
    notification.show();
    return { success: true };
  });

  // 单个文件重命名
  ipcMain.handle('rename-file', async (event, { oldPath, newName }) => {
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      
      // 检查目标文件是否已存在
      if (await fsAsync.access(newPath).then(() => true).catch(() => false)) {
        if (oldPath !== newPath) {
          throw new Error(`目标文件已存在: ${newName}`);
        }
      }
      
      await fsAsync.rename(oldPath, newPath);
      return { success: true, newPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 重命名文件 V2（按选中顺序）
  ipcMain.handle('batch-rename-v2', async (event, { dirPath, renameList }) => {
    try {
      let results = [];
      for (const item of renameList) {
        const newPath = path.join(dirPath, item.newName);
        
        // 检查目标文件是否已存在
        if (await fsAsync.access(newPath).then(() => true).catch(() => false)) {
          if (item.oldPath !== newPath) {
            throw new Error(`目标文件已存在: ${item.newName}`);
          }
        }
        
        await fsAsync.rename(item.oldPath, newPath);
        results.push({ old: path.basename(item.oldPath), new: item.newName });
      }
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-in-folder', async (event, targetPath) => {
    if (!targetPath) return { success: false, message: '缺少文件路径' };
    const { shell } = require('electron');
    const resolvedPath = path.resolve(targetPath);
    try {
      const stats = await fsAsync.stat(resolvedPath);
      if (stats.isDirectory()) await shell.openPath(resolvedPath);
      else shell.showItemInFolder(resolvedPath);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });


});

// 监听动态更新锁屏快捷键
ipcMain.handle('update-lock-shortcut', (event, oldShortcut, newShortcut) => {
  if (oldShortcut) {
    globalShortcut.unregister(oldShortcut);
  }
  if (newShortcut) {
    globalShortcut.register(newShortcut, () => {
      if (mainWindow) {
        mainWindow.webContents.send('lock-screen');
      }
    });
  }
  return true;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

