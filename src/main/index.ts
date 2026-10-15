import { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { installBinaries } from './binaries'
import { autoUpdateYtdlp, queueFromClipboard } from './downloader'

// Keep using the original data folder (settings + history). Without this,
// Electron would pick a folder from productName, which an older, unrelated
// app with the same name already uses.
// MNP_USER_DATA lets you run with a separate, empty data folder (testing, screenshots).
app.setPath('userData', process.env.MNP_USER_DATA || join(app.getPath('appData'), 'mnp-media-downloader'))

const isWin = process.platform === 'win32'
let tray: Tray | null = null

function showWindow() {
  const win = BrowserWindow.getAllWindows()[0] || createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// Menu bar icon (system tray on Windows): download whatever link is on the
// clipboard without opening the window
function createTray() {
  const iconDir = app.isPackaged ? join(process.resourcesPath, 'tray') : join(app.getAppPath(), 'resources', 'tray')
  // Mac: black template image the system recolors. Windows: the app icon,
  // since the taskbar can be light or dark.
  const icon = nativeImage.createFromPath(join(iconDir, isWin ? 'tray-win.png' : 'trayTemplate.png'))
  if (!isWin) icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('MNP Media Downloader')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Download Copied Link',
        click: async () => {
          const url = await queueFromClipboard()
          if (!url) new Notification({ title: 'No link copied', body: 'Copy a video link first, then try again.' }).show()
        }
      },
      { label: 'Open MNP Media Downloader', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ])
  )
  // Windows convention: clicking the tray icon opens the app
  if (isWin) tray.on('click', showWindow)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#121110',
    // Our own title bar. On Windows the minimize/maximize/close buttons are
    // drawn over its right end, in the app's colors.
    titleBarStyle: isWin ? 'hidden' : 'hiddenInset',
    ...(isWin && { titleBarOverlay: { color: '#121110', symbolColor: '#ede9e2', height: 52 } }),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['MAIN_WINDOW_VITE_DEV_SERVER_URL']) {
    win.loadURL(process.env['MAIN_WINDOW_VITE_DEV_SERVER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// One copy at a time: opening the app again just brings the window forward.
// (The lock lives in the data folder, so test copies using MNP_USER_DATA can still run.)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', showWindow)
}

// Lets Windows show the app's name and icon on notifications
if (isWin) app.setAppUserModelId('com.mnp.mediadownloader')

app.whenReady().then(() => {
  if (!gotLock) return
  // No File/Edit/View menu bar on Windows (copy/paste still work in text boxes)
  if (isWin) Menu.setApplicationMenu(null)
  installBinaries()
  registerIpcHandlers()
  createWindow()
  createTray()
  autoUpdateYtdlp()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
