import { app, BrowserWindow, net, protocol } from 'electron'
import { isAbsolute, relative, resolve } from 'path'
import { pathToFileURL } from 'url'
import { IPC_CHANNELS } from '@shared'
import { configStore } from './config/config-store'
import { createMainWindow, safeSend } from './windows/main-window'
import { registerIpcHandlers } from './ipc/register-ipc'
import { GeminiLiveClient, setGlobalGeminiClient } from './gemini-live'
import { autonomyCoordinator } from './autonomous'
import { licenseManager } from './services/license-manager'
import { updateManager } from './services/update-manager'

let geminiClient: GeminiLiveClient | null = null
let licenseCheckTimer: NodeJS.Timeout | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

function registerAppProtocol(): void {
  const rendererRoot = resolve(__dirname, '../renderer')
  protocol.handle('app', (request) => {
    try {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      const requestedPath = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html'
      const targetPath = resolve(rendererRoot, requestedPath)
      const relativePath = relative(rendererRoot, targetPath)
      if (relativePath.startsWith('..') || relativePath.includes('\0') || isAbsolute(relativePath)) {
        return new Response('Forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(targetPath).toString())
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}

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

  return client
}

app.whenReady().then(() => {
  registerAppProtocol()
  configStore.initialize()

  // Listener para bloqueio imediato se a licença for revogada ou suspensa
  licenseManager.onRevoked((result) => {
    console.warn('[Main] Licença revogada ou suspensa. Bloqueando acesso do usuário:', result.message)
    try {
      geminiClient?.disconnect()
    } catch {}
    try {
      autonomyCoordinator.stopAll()
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
  updateManager.initialize()

  if (licenseManager.getLicenseInfo().isLicensed) {
    autonomyCoordinator.init()
  }

  // Verificação inicial do lease no boot da aplicação.
  setTimeout(() => {
    licenseManager.checkAccess24h().then((res) => {
      if (res.valid) {
        autonomyCoordinator.init()
      }
    }).catch((err) => {
      console.warn('[Main] Erro na verificação inicial de licença:', err.message)
    })
  }, 3000)

  // Verificação periódica online; o lease assinado limita o modo offline a 72 horas.
  licenseCheckTimer = setInterval(() => {
    licenseManager.checkAccess24h().then((res) => {
      if (res.valid) {
        autonomyCoordinator.init()
      }
    }).catch((err) => {
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
  updateManager.dispose()
  geminiClient?.disconnect()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
