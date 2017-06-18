'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
const config = require('./config');

const app = electron.app;

require('electron-debug')();
require('electron-dl')();
require('electron-context-menu')();

let mainWindow;
let isQuitting = false;

function createMainWindow() {
  const lastWindowState = config.get('lastWindowState');
  const win = new electron.BrowserWindow({
    title: app.getName(),
    show: false,
    x: lastWindowState.x,
    y: lastWindowState.y,
    width: lastWindowState.width,
    height: lastWindowState.height,
    icon: process.platform === 'linux' && path.join(__dirname, 'static', 'Icon.png'),
    minWidth: 400,
    minHeight: 200,
    titleBarStyle: 'hidden-inset',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'browser.js'),
      plugins: true
    }
  });

  if (process.platform === 'darwin') {
    win.setSheetOffset(40);
  }

  win.loadURL('https://trello.com/');

  win.on('close', e => {
    if (isQuitting) {
      if (!mainWindow.isFullScreen()) {
        config.set('lastWindowState', mainWindow.getBounds());
      }
    } else {
      e.preventDefault();

      if (process.platform === 'darwin') {
        app.hide();
      } else {
        app.quit();
      }
    }
  });

  return win;
}

app.on('ready', () => {
  mainWindow = createMainWindow();
  const page = mainWindow.webContents;

  page.on('dom-ready', () => {
    page.insertCSS(fs.readFileSync(path.join(__dirname, 'browser.css'), 'utf8'));
    mainWindow.show();
  });

  page.on('new-window', (e, url) => {
    e.preventDefault();
    electron.shell.openExternal(url);
  });

  mainWindow.webContents.session.on('will-download', (event, item) => {
    const totalBytes = item.getTotalBytes();

    item.on('updated', () => {
      mainWindow.setProgressBar(item.getReceivedBytes() / totalBytes);
    });

    item.on('done', (e, state) => {
      mainWindow.setProgressBar(-1);

      if (state === 'interrupted') {
        electron.Dialog.showErrorBox('Download error', 'The download was interrupted');
      }
    });
  });

  const template = [{
    label: 'Application',
    submenu: [
      {label: 'About Application', selector: 'orderFrontStandardAboutPanel:'},
      {type: 'separator'},
      {
        label: 'Quit', accelerator: 'Command+Q', click: () => {
          app.quit();
        }
      }
    ]
  }, {
    label: 'Edit',
    submenu: [
      {label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:'},
      {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:'},
      {type: 'separator'},
      {label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:'},
      {label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:'},
      {label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:'},
      {label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:'}
    ]
  }
  ];

  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  mainWindow.show();
});

app.on('before-quit', () => {
  isQuitting = true;
});
