import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared'
import { configStore } from './config/config-store'
import { createMainWindow, safeSend } from './windows/main-window'
import { registerIpcHandlers } from './ipc/register-ipc'
import { GeminiLiveClient, setGlobalGeminiClient } from './gemini-live'
import { autonomyCoordinator } from './autonomous'

let geminiClient: GeminiLiveClient | null = null

function initGeminiClient(): GeminiLiveClient {
  const cfg = configStore.getConfig()

  const client = new GeminiLiveClient({
    apiKey: cfg.apiKey,
    voiceName: cfg.voiceName,
    model: cfg.model,
    enableSystemTools: cfg.enableSystemTools,
    enableMediaTools: cfg.enableMediaTools,
    agentName: cfg.agentName
  })

  client.onAudio = (base64Audio: string): void => {
    safeSend(IPC_CHANNELS.GEMINI_AUDIO_CHUNK, base64Audio)
  }

  client.onInterrupted = (): void => {
    safeSend(IPC_CHANNELS.GEMINI_INTERRUPTED)
  }

  client.onTurnComplete = (): void => {
    safeSend(IPC_CHANNELS.GEMINI_TURN_COMPLETE)
  }

  client.onText = (text: string): void => {
    safeSend(IPC_CHANNELS.GEMINI_TEXT_CHUNK, text)
  }

  client.onStatus = (status, message): void => {
    safeSend(IPC_CHANNELS.GEMINI_STATUS, status, message)
  }

  // Auto-connect if API key is present
  if (cfg.apiKey && cfg.apiKey.trim().length > 0) {
    setTimeout(() => {
      client.connect().catch((err) => {
        console.warn('[Main] Auto-connect to Gemini Live failed:', err.message)
      })
    }, 1500)
  }

  return client
}

app.whenReady().then(() => {
  configStore.initialize()
  geminiClient = initGeminiClient()
  setGlobalGeminiClient(geminiClient)
  registerIpcHandlers(() => geminiClient)
  createMainWindow()
  autonomyCoordinator.init()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  autonomyCoordinator.stopAll()
  geminiClient?.disconnect()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
