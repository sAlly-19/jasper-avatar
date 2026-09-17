import { app, BrowserWindow, shell, screen, session } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { IPC_CHANNELS } from '@shared'

let mainWindow: BrowserWindow | null = null
let isPipMode = false
let normalBounds = { x: 100, y: 100, width: 1100, height: 860 }

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function safeSend(channel: string, ...args: any[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 860,
    minWidth: 800,
    minHeight: 650,
    show: false,
    frame: false, // Frameless HUD / Jarvis design
    titleBarStyle: 'hidden',
    backgroundColor: '#070b12',
    webPreferences: {
      preload: fs.existsSync(join(__dirname, '../preload/index.mjs'))
        ? join(__dirname, '../preload/index.mjs')
        : join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Auto-grant media (microphone) permissions to the renderer window
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true)
    }
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })

  // Forward renderer console logs to terminal and disk log file
  const runtimeLogPath = join(app.getPath('userData'), 'jasper-runtime.log')
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const formatted = `[Renderer] [L${level}] ${message} (${sourceId}:${line})`
    console.log(formatted)
    try {
      fs.appendFileSync(runtimeLogPath, `[${new Date().toISOString()}] ${formatted}\n`)
    } catch {}
  })

  // Press F12 to toggle Fullscreen; Ctrl+Shift+I to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12') {
        event.preventDefault()
        toggleFullScreenMode()
      } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow?.webContents.toggleDevTools()
      }
    }
  })

  // Synchronize fullscreen events to renderer
  mainWindow.on('enter-full-screen', () => {
    safeSend(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGE, true)
  })
  mainWindow.on('leave-full-screen', () => {
    safeSend(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGE, false)
  })

  // Load renderer via Vite HMR or built index.html
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Automatic screenshot capture for visual verification when requested via CLI
  if (process.argv.includes('--capture-screenshot')) {
    setTimeout(async () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const image = await mainWindow.webContents.capturePage()
          const outDir = process.env.SCREENSHOT_OUT_DIR || app.getPath('temp')
          const outPath = join(outDir, 'app_screenshot.png')
          fs.writeFileSync(outPath, image.toPNG())
          console.log('[Capture] Screenshot saved successfully to', outPath)
          app.quit()
        }
      } catch (err) {
        console.error('[Capture] Error capturing page screenshot:', err)
        app.quit()
      }
    }, 4500)
  }

  return mainWindow
}

export function togglePipMode(): boolean {
  if (!mainWindow) return false

  isPipMode = !isPipMode
  if (isPipMode) {
    normalBounds = mainWindow.getBounds()
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setMinimumSize(280, 360)
    const primaryDisplay = screen.getPrimaryDisplay()
    const { workArea } = primaryDisplay
    const pipWidth = 320
    const pipHeight = 440
    const pipX = workArea.x + workArea.width - pipWidth - 24
    const pipY = workArea.y + workArea.height - pipHeight - 24
    mainWindow.setBounds({ x: pipX, y: pipY, width: pipWidth, height: pipHeight }, true)
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setMinimumSize(800, 650)
    mainWindow.setBounds(normalBounds, true)
  }

  safeSend(IPC_CHANNELS.WINDOW_PIP_CHANGE, isPipMode)
  return isPipMode
}

export function minimizeWindow(): void {
  mainWindow?.minimize()
}

export function maximizeWindow(): void {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
}

export function toggleFullScreenMode(): boolean {
  if (!mainWindow) return false

  const nextState = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(nextState)
  safeSend(IPC_CHANNELS.WINDOW_FULLSCREEN_CHANGE, nextState)
  return nextState
}

export function closeWindow(): void {
  mainWindow?.close()
}

