import * as THREE from 'three'
import { createScene } from './scene/lights-camera'
import { AvatarController } from './scene/avatar'
import { AudioPlayer } from './audio/audio-player'
import { LipSyncAnalyzer } from './audio/lip-sync'
import { MicRecorder } from './audio/mic-recorder'
import { DOM } from './ui/dom'
import { updateStatusBadge, applyAgentName, getCurrentAgentName } from './ui/status-badge'
import { AudioVisualizer } from './audio/audio-visualizer'
import { OfflineHandler } from './offline/offline-handler'
import { initChatDrawer } from './ui/chat-drawer'
import { WakeWordManager } from './audio/wake-word-manager'
import { WakeTrainerUI } from './ui/wake-trainer-ui'
import { SettingsModal } from './ui/settings-modal'
import { NeuralBackground } from './scene/neural-background'
import { showHudToast } from './ui/toast'
import { initModuleInfoModal } from './ui/module-info-modal'

// Audio & 3D Core instances
const audioPlayer = new AudioPlayer()
const lipSync = new LipSyncAnalyzer()
const micRecorder = new MicRecorder()
const audioVisualizer = new AudioVisualizer()
const offlineHandler = new OfflineHandler()

let avatar: AvatarController | null = null
let currentMicLevel = 0
let transcriptFadeTimeout: any = null
let isWakeWordEnabled = true
let isBloomEnabled = true
let isConnected = false

// Forward declarations for circular references
let wakeTrainerUI: WakeTrainerUI
let wakeWordManager: WakeWordManager

wakeWordManager = new WakeWordManager({
  getAgentName: () => getCurrentAgentName(),
  getIsWakeWordEnabled: () => isWakeWordEnabled,
  onWakeTriggered: () => {
    if (!micRecorder.isRecording()) {
      DOM.btnMic.click()
    }
  },
  onTrainerUIUpdate: () => wakeTrainerUI?.updateUI()
})

wakeTrainerUI = new WakeTrainerUI({
  getAgentName: () => getCurrentAgentName(),
  wakeWordManager,
  micRecorder
})

async function init(): Promise<void> {
  console.log('[Jasper] Initializing 3D HUD Assistant...')

  // 1. Scene, Camera, Bloom & Lighting
  const sceneCtx = createScene(DOM.canvasContainer)
  const { scene, renderer, controls, render, setBloomEnabled } = sceneCtx

  // 1b. Dynamic 3D Neural Background
  const neuralBackground = new NeuralBackground(scene)

  // 2. Avatar Controller
  avatar = new AvatarController(scene, renderer)
  offlineHandler.setAvatar(avatar)

  try {
    updateStatusBadge('connecting', 'Carregando Avatar 3D...')
    await avatar.loadModel('/models/facecap.glb')
    updateStatusBadge('connected', 'Avatar Pronto')
  } catch (err) {
    console.error('[Jasper] Model load error:', err)
    updateStatusBadge('error', 'Erro ao carregar modelo')
  }

  // 3. Connect LipSync to AudioPlayer
  const analyser = audioPlayer.getAnalyser()
  if (analyser) {
    lipSync.setAnalyser(analyser)
  }

  // 4. Render Loop at 60 FPS
  const clock = new THREE.Clock()
  function animate(): void {
    requestAnimationFrame(animate)

    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    controls.update()
    const lipSyncTargets = lipSync.update()

    neuralBackground.update(delta, elapsed, audioPlayer.getIsSpeaking())

    if (avatar) {
      avatar.update(delta, elapsed, lipSyncTargets)
    }

    audioVisualizer.draw(
      audioPlayer.getAnalyser(),
      audioPlayer.getIsSpeaking(),
      micRecorder.isRecording(),
      currentMicLevel
    )

    render()
  }
  animate()

  // 5. Initialize UI Subsystems
  initChatDrawer({
    getIsConnected: () => isConnected,
    getAgentName: () => getCurrentAgentName(),
    offlineHandler
  })

  new SettingsModal({
    getAgentName: () => getCurrentAgentName(),
    setAgentName: (name) => applyAgentName(name, () => wakeTrainerUI.updateUI()),
    getAvatar: () => avatar,
    setBloomEnabled,
    setNeuralBgEnabled: (enabled) => neuralBackground.setVisible(enabled),
    setEyeTrackingEnabled: (enabled) => avatar?.setEyeTrackingEnabled(enabled),
    setIsWakeWordEnabled: (val) => { isWakeWordEnabled = val },
    reinitWakeWord: async () => { await wakeWordManager.init() },
    wakeTrainerUI
  })

  initModuleInfoModal()

  // Window Controls & Fullscreen
  const updateFullscreenUI = (isFs: boolean): void => {
    // Hide action bar / complete header when in fullscreen mode (F12)
    const titlebar = document.getElementById('titlebar')
    if (titlebar) {
      titlebar.classList.toggle('hidden', isFs)
    }
    DOM.app?.classList.toggle('is-fullscreen', isFs)

    const iconEnter = document.getElementById('icon-fs-enter')
    const iconExit = document.getElementById('icon-fs-exit')
    if (iconEnter && iconExit) {
      iconEnter.classList.toggle('hidden', isFs)
      iconExit.classList.toggle('hidden', !isFs)
    }
    if (DOM.btnFullscreen) {
      DOM.btnFullscreen.title = isFs ? 'Sair da Tela Cheia (F12)' : 'Tela Cheia (F12)'
      DOM.btnFullscreen.classList.toggle('active', isFs)
    }
    if (DOM.btnSettingsFullscreen) {
      DOM.btnSettingsFullscreen.textContent = isFs ? 'Sair da Tela Cheia (F12)' : 'Alternar Tela Cheia (F12)'
    }

    // Trigger window resize so Three.js 3D viewport smoothly updates bounds
    window.dispatchEvent(new Event('resize'))
  }

  DOM.btnFullscreen?.addEventListener('click', async () => {
    const isFs = await window.electronAPI.toggleFullscreen()
    updateFullscreenUI(isFs)
  })
  DOM.btnSettingsFullscreen?.addEventListener('click', async () => {
    const isFs = await window.electronAPI.toggleFullscreen()
    updateFullscreenUI(isFs)
  })
  DOM.btnMinimize?.addEventListener('click', () => window.electronAPI.windowMinimize())
  DOM.btnMaximize?.addEventListener('click', () => window.electronAPI.windowMaximize())
  DOM.btnClose?.addEventListener('click', () => window.electronAPI.windowClose())
  DOM.btnPip?.addEventListener('click', async () => { await window.electronAPI.togglePip() })

  // Global F12 shortcut listener in renderer
  window.addEventListener('keydown', async (e) => {
    if (e.key === 'F12') {
      e.preventDefault()
      const isFs = await window.electronAPI.toggleFullscreen()
      updateFullscreenUI(isFs)
    }
  })

  // 6. Load Initial Persisted Config
  const initialConfig = await window.electronAPI.getConfig()
  if (initialConfig.agentName) {
    applyAgentName(initialConfig.agentName, () => wakeTrainerUI.updateUI())
  }
  isWakeWordEnabled = initialConfig.enableWakeWord !== false
  isBloomEnabled = initialConfig.enableBloom !== false
  setBloomEnabled(isBloomEnabled)
  neuralBackground.setVisible(initialConfig.enableNeuralBg !== false)
  avatar?.setEyeTrackingEnabled(initialConfig.enableEyeTracking !== false)
  isConnected = initialConfig.isConnected

  if (!initialConfig.hasFullKey) {
    updateStatusBadge('disconnected', 'Configure a API Key')
  }

  // 7. Setup Electron IPC Listeners
  window.electronAPI.onAudioChunk((base64Audio) => {
    updateStatusBadge('speaking', `${getCurrentAgentName()} Falando...`)
    audioPlayer.enqueueAudioChunk(base64Audio)
  })

  window.electronAPI.onInterrupted(() => {
    audioPlayer.stopAll()
    lipSync.reset()
    DOM.transcriptBox.classList.add('hidden')
  })

  window.electronAPI.onTurnComplete(() => {
    updateStatusBadge('connected', `${getCurrentAgentName()} Pronto`)
    if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Pressione para falar'
    DOM.btnMic.classList.remove('active')
    if (isWakeWordEnabled) {
      wakeWordManager.resume(micRecorder.isRecording())
    }
  })

  window.electronAPI.onTextChunk((text) => {
    // Strip internal reasoning or thinking headers like "**Crafting a Polite Greeting** ..."
    let cleanText = text.replace(/^\*\*.*?\*\*\s*/s, '').trim()
    if (!cleanText) {
      cleanText = text.trim()
    }

    DOM.transcriptText.textContent = cleanText
    DOM.transcriptBox.classList.remove('hidden')

    if (transcriptFadeTimeout) clearTimeout(transcriptFadeTimeout)
    transcriptFadeTimeout = setTimeout(() => {
      DOM.transcriptBox.classList.add('hidden')
    }, 9000)
  })

  window.electronAPI.onStatusChange((status, message) => {
    if (status === 'connected') {
      isConnected = true
      updateStatusBadge('connected', message || `${getCurrentAgentName()} Online`)
    } else if (status === 'connecting') {
      isConnected = false
      updateStatusBadge('connecting', message || 'Conectando ao Gemini...')
    } else if (status === 'speaking') {
      updateStatusBadge('speaking', `${getCurrentAgentName()} Falando...`)
    } else if (status === 'listening') {
      updateStatusBadge('listening', `${getCurrentAgentName()} Ouvindo...`)
    } else if (status === 'disconnected') {
      isConnected = false
      updateStatusBadge('disconnected', 'Desconectado')
    } else if (status === 'error') {
      isConnected = false
      updateStatusBadge('error', message || 'Verifique API Key')
    }
  })

  window.electronAPI.onAgentNameUpdated((name) => {
    applyAgentName(name, () => wakeTrainerUI.updateUI())
  })

  window.electronAPI.onPipChange((isPip) => {
    if (isPip) {
      DOM.app?.classList.add('mini-hud')
      DOM.btnPip?.classList.add('active')
    } else {
      DOM.app?.classList.remove('mini-hud')
      DOM.btnPip?.classList.remove('active')
    }
  })

  window.electronAPI.onFullscreenChange((isFs) => {
    updateFullscreenUI(isFs)
  })

  // 7b. Autonomy Proactive Events Listener
  window.electronAPI.onAutonomyNotification((notif) => {
    let action: { label: string; onClick: () => void } | undefined
    let duration = 7000

    if (notif.data?.confirmationId) {
      duration = 25000
      action = {
        label: 'Autorizar Execução',
        onClick: async () => {
          await window.electronAPI.confirmReflexionAction(notif.data.confirmationId)
          showHudToast('Autorizado', 'Comando autorizado com sucesso. Você pode solicitar a execução novamente.', 'info', 5000)
        }
      }
    }

    showHudToast(notif.title, notif.message, notif.type, duration, action)
    console.log(`[HUD] Received autonomy notification: ${notif.title}`)
  })

  // 8. Mic Recording Feedback & VAD Handlers
  micRecorder.onAudioLevel = (level) => {
    currentMicLevel = level
  }

  micRecorder.onSpeechEnd = () => {
    DOM.btnMic.classList.remove('active')
    if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Aguardando resposta...'
    updateStatusBadge('connecting', `${getCurrentAgentName()} Processando...`)
  }

  micRecorder.onSpeechTimeout = () => {
    DOM.btnMic.classList.remove('active')
    if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Pressione para falar'
    updateStatusBadge('connected', `${getCurrentAgentName()} Online`)
    if (isWakeWordEnabled) {
      wakeWordManager.resume(micRecorder.isRecording())
    }
  }

  DOM.btnMic.addEventListener('click', async () => {
    if (micRecorder.isRecording()) {
      micRecorder.stop()
      DOM.btnMic.classList.remove('active')
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Pressione para falar'
      updateStatusBadge('connected', `${getCurrentAgentName()} Online`)
      if (isWakeWordEnabled) {
        await wakeWordManager.resume(micRecorder.isRecording())
      }
    } else {
      try {
        await wakeWordManager.pause()
        await micRecorder.start()
        DOM.btnMic.classList.add('active')
        if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Gravando áudio...'
        updateStatusBadge('listening', `${getCurrentAgentName()} Ouvindo...`)
      } catch (err: any) {
        alert('Não foi possível acessar o microfone: ' + err.message)
        if (isWakeWordEnabled) await wakeWordManager.resume(micRecorder.isRecording())
      }
    }
  })

  // 9. Initialize Wake Word Engine
  await wakeWordManager.init()
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error)
})
