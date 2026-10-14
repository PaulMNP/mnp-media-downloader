import { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { installBinaries } from './binaries'
import { autoUpdateYtdlp, queueFromClipboard } from './downloader'

// Keep using the original data folder (settings + history). Without this,
// Electron would pick a folder from productName, which an older, unrelated
// app with the same name already uses.
app.setPath('userData', join(app.getPath('appData'), 'mnp-media-downloader'))

let tray: Tray | null = null

function showWindow() {
  const win = BrowserWindow.getAllWindows()[0] || createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// Menu bar icon: download whatever link is on the clipboard without opening the window
function createTray() {
  const iconDir = app.isPackaged ? join(process.resourcesPath, 'tray') : join(app.getAppPath(), 'resources', 'tray')
  const icon = nativeImage.createFromPath(join(iconDir, 'trayTemplate.png'))
  icon.setTemplateImage(true)
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
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#121110',
    titleBarStyle: 'hiddenInset',
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

app.whenReady().then(() => {
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
