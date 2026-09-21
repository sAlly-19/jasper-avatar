import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared'
import { configStore } from './config/config-store'
import { createMainWindow, safeSend } from './windows/main-window'
import { registerIpcHandlers } from './ipc/register-ipc'
import { GeminiLiveClient, setGlobalGeminiClient } from './gemini-live'
import { autonomyCoordinator } from './autonomous'
import { licenseManager } from './services/license-manager'

let geminiClient: GeminiLiveClient | null = null
let licenseCheckTimer: NodeJS.Timeout | null = null

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

  // Auto-connect if API key is present and station is licensed
  if (cfg.apiKey && cfg.apiKey.trim().length > 0 && cfg.licenseStatus === 'active') {
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

  // Listener para bloqueio imediato se a licença for revogada ou suspensa
  licenseManager.onRevoked((result) => {
    console.warn('[Main] Licença revogada ou suspensa. Bloqueando acesso do usuário:', result.message)
    try {
      geminiClient?.disconnect()
    } catch {}
    safeSend(IPC_CHANNELS.LICENSE_REVOKED, {
      status: result.error || 'disabled',
      message: result.message || 'Sua licença foi desativada ou revogada pelo administrador.'
    })
  })

  geminiClient = initGeminiClient()
  setGlobalGeminiClient(geminiClient)
  registerIpcHandlers(() => geminiClient)
  createMainWindow()
  autonomyCoordinator.init()

  // Verificação inicial de 24 horas no boot da aplicação
  setTimeout(() => {
    licenseManager.checkAccess24h().catch((err) => {
      console.warn('[Main] Erro na verificação inicial de licença:', err.message)
    })
  }, 3000)

  // Verificação periódica a cada 1 hora para inspecionar o limite de 24 horas
  licenseCheckTimer = setInterval(() => {
    licenseManager.checkAccess24h().catch((err) => {
      console.warn('[Main] Erro no check periódico de licença:', err.message)
    })
  }, 60 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (licenseCheckTimer) {
    clearInterval(licenseCheckTimer)
    licenseCheckTimer = null
  }
  autonomyCoordinator.stopAll()
  geminiClient?.disconnect()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
