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
let canForceQuit = config.get('minimizeWhenExit');
let isLaunchAtStartup = config.get('launchAtStartup');
let exeName = path.basename(process.execPath);
let appDir = path.dirname(require.main.filename);

let isWindowShown = true;
let windowVisibility = {
  'visible': true,
  'hidden': false
}

let sysTray = null;
let sysTrayContextMenu = null;

// System tray template
let sysTrayContextMenuTemplate = [
  {
    label: 'Setting',
    submenu: [
      {
        label: 'Minimize window when exiting',
        type: 'checkbox',
        checked: !canForceQuit,
        click: (item, BrowserWindow) => {
          canForceQuit = !canForceQuit;
          item.checked = !canForceQuit;
          config.set('minimizeWhenExit', canForceQuit);
        }
      },
      {
        label: 'Launch at startup',
        type: 'checkbox',
        checked: isLaunchAtStartup,
        click: (item, BrowserWindow) => {
          isLaunchAtStartup = !isLaunchAtStartup;
          item.checked = isLaunchAtStartup;
          setForStartup(isLaunchAtStartup);
          config.set('launchAtStartup', isLaunchAtStartup);
        }
      }
    ]
  }, 
  {
    // miHideWindow
    label: 'Hide window', 
    type: 'normal', 
    visible: true,
    click: (item, BrowserWindow) => {
      changeWindowVisiblity(windowVisibility.hidden);
    }
  }, 
  {
    // miShowWindow
    label: 'Show widnow',
    type: 'normal', 
    visible: false,
    click: (item, BrowserWindow) => {
      changeWindowVisiblity(windowVisibility.visible);
    }
  },
  {
    label: 'Close',
    type: 'normal',
    visible: true,
    click: () => {
      app.quit();
    }
  }
];

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
        if (!canForceQuit) {
          win.hide();
          changeWindowVisiblity(windowVisibility.hidden);
        } else {
          app.quit();
        }
      }
    }
  });

  setForStartup(isLaunchAtStartup);

  return win;
}

function changeWindowVisiblity (isShown) {
  if (isWindowShown == isShown) return;

  isWindowShown = isShown;
  mainWindow.visible = isShown;
  console.log(mainWindow.visible);
  // miHideWindow
  sysTrayContextMenu.items[1].visible = isWindowShown;
  // miShowWindow
  sysTrayContextMenu.items[2].visible = !isWindowShown;

  if (isShown) {
    mainWindow.show();
  } else {
    mainWindow.hide();
  }
}

// Setting for launching app at startup
function setForStartup (canAutoLaunch) {
  app.setLoginItemSettings({
    openAtLogin: canAutoLaunch,
    path: process.execPath,
    args: [
      appDir
    ]
  });
}

// App events
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

  // System tray
  try {
    let iconPath = path.join(__dirname, 'static/Icon.ico')
    sysTray = new electron.Tray(iconPath);
    sysTrayContextMenu = electron.Menu.buildFromTemplate(sysTrayContextMenuTemplate);
    sysTray.setToolTip('Trello!');
    sysTray.setContextMenu(sysTrayContextMenu);

    sysTray.on('double-click', () => {
      if (!mainWindow.visible) {
        mainWindow.restore();
        changeWindowVisiblity(windowVisibility.visible);
      }
    });
  }
  catch (err) {
    electron.dialog.showMessageBox(err);
  }
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
