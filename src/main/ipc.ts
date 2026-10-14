import { BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron'
import { addToQueue, cancelDownload, fetchInfo, getYtdlpVersion, updateYtdlp } from './downloader'
import { getSettings, saveSettings, getValue, addHistory, removeHistory, clearHistory } from './settings'

export function registerIpcHandlers(): void {
  ipcMain.handle('download:fetch-info', async (_event, url: string, playlist: boolean) => {
    return fetchInfo(url, playlist)
  })

  ipcMain.handle('ytdlp:version', async () => getYtdlpVersion())

  ipcMain.handle('ytdlp:update', async () => updateYtdlp())

  ipcMain.handle('clipboard:read', async () => clipboard.readText())

  ipcMain.handle('download:start', async (_event, item) => {
    await addToQueue(item)
    return { id: item.id }
  })

  ipcMain.handle('download:cancel', async (_event, id: string) => {
    cancelDownload(id)
    return { success: true }
  })

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    return shell.openPath(filePath)
  })

  ipcMain.handle('file:show-in-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
    return { success: true }
  })

  ipcMain.handle('history:get', async () => getValue('history'))

  // Every change is broadcast so all windows show the same list
  const broadcast = (history: unknown[]) => {
    BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send('history:changed', history))
    return history
  }

  ipcMain.handle('history:add', async (_event, entry: { id: string }) => broadcast(await addHistory(entry)))

  ipcMain.handle('history:remove', async (_event, id: string) => broadcast(await removeHistory(id)))

  ipcMain.handle('history:clear', async () => broadcast(await clearHistory()))

  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:save', async (_event, settings) => {
    await saveSettings(settings)
    return { success: true }
  })

  ipcMain.handle('folder:select', async (event) => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Download Folder'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })
}
