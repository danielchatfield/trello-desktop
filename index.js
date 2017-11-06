'use strict';
const path = require('path');
const fs = require('fs');
const electron = require('electron');
const config = require('./config');

const app = electron.app;
const appDir = path.dirname(require.main.filename);

require('electron-debug')();
require('electron-dl')();
require('electron-context-menu')();

let mainWindow;

let isQuitting = false;
let canForceQuit = config.get('minimizeWhenExiting');
let canLaunchAtStartup = config.get('launchAtStartup');

let isWindowShown = true;
const windowVisibility = {
  visible: true,
  hidden: false
};

let sysTray = null;
let sysTrayContextMenu = null;

// System tray template
const sysTrayContextMenuTemplate = [
  {
    label: 'Setting',
    submenu: [
      {
        label: 'Minimize window when exiting',
        type: 'checkbox',
        checked: !canForceQuit,
        click: item => {
          canForceQuit = !canForceQuit;
          item.checked = !canForceQuit;
          config.set('minimizeWhenExiting', canForceQuit);
        }
      },
      {
        label: 'Launch at startup',
        type: 'checkbox',
        checked: canLaunchAtStartup,
        click: item => {
          canLaunchAtStartup = !canLaunchAtStartup;
          item.checked = canLaunchAtStartup;
          setForStartup(canLaunchAtStartup);
          config.set('launchAtStartup', canLaunchAtStartup);
        }
      }
    ]
  },
  {
    // MenuItem: miHideWindow
    label: 'Hide window',
    type: 'normal',
    visible: true,
    click: () => {
      changeWindowVisiblity(windowVisibility.hidden);
    }
  },
  {
    // MenuItem: miShowWindow
    label: 'Show widnow',
    type: 'normal',
    visible: false,
    click: () => {
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
      } else if (canForceQuit) {
        app.quit();
      } else {
        win.hide();
        changeWindowVisiblity(windowVisibility.hidden);
      }
    }
  });

  setForStartup(canLaunchAtStartup);

  return win;
}

function changeWindowVisiblity(isShown) {
  if (isWindowShown === isShown) {
    return;
  }

  isWindowShown = isShown;
  mainWindow.visible = isShown;
  // MenuItem: miHideWindow
  sysTrayContextMenu.items[1].visible = isWindowShown;
  // MenuItem: miShowWindow
  sysTrayContextMenu.items[2].visible = !isWindowShown;

  if (isShown) {
    mainWindow.show();
  } else {
    mainWindow.hide();
  }
}

// Setting for launching app at startup
function setForStartup(canAutoLaunch) {
  app.setLoginItemSettings({
    openAtLogin: canAutoLaunch,
    path: process.execPath,
    args: [
      appDir
    ]
  });
}

function checkSingleInstance() {
  const isSecondInstance = app.makeSingleInstance(() => {
    if (mainWindow) {
      if (!mainWindow.visible) {
        mainWindow.restore();
        changeWindowVisiblity(windowVisibility.visible);
      }
      mainWindow.focus();
    }
  });
  return isSecondInstance;
}

// Make sure there is only one instance of this app
if (checkSingleInstance()) {
  app.exit();
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
  const iconPath = path.join(__dirname, 'static/Icon.ico');
  sysTray = new electron.Tray(iconPath);
  sysTrayContextMenu = electron.Menu.buildFromTemplate(sysTrayContextMenuTemplate);
  sysTray.setToolTip('Trello desktop app');
  sysTray.setContextMenu(sysTrayContextMenu);

  sysTray.on('click', () => {
    if (!mainWindow.visible) {
      mainWindow.restore();
      changeWindowVisiblity(windowVisibility.visible);
    }
  });
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
