/**
 * @file main.cjs
 * Electron Desktop Application Main Process for 2048 Deluxe.
 */

const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('path');

// Maintain window reference to prevent garbage collection
let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 400,
    minHeight: 620,
    center: true,
    title: '2048 Deluxe',
    icon: iconPath,
    backgroundColor: '#faf8ef',
    autoHideMenuBar: true,
    show: false, // Wait until ready-to-show to prevent flash of white
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true
    }
  });

  // Remove default menu bar for clean native game interface
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock (prevent multiple concurrent game windows)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
