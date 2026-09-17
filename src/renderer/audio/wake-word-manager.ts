import { SpeechCommandsWakeWord } from './speech-commands'
import { playWakeChime } from './audio-cues'
import { updateStatusBadge } from '../ui/status-badge'

export interface WakeWordManagerOptions {
  getAgentName: () => string
  getIsWakeWordEnabled: () => boolean
  onWakeTriggered: () => void
  onTrainerUIUpdate?: () => void
}

export class WakeWordManager {
  private engine: SpeechCommandsWakeWord | null = null
  private fallbackRecognizer: any = null
  private isRunning = false
  private isPhoneticFallbackActive = false
  private options: WakeWordManagerOptions

  constructor(options: WakeWordManagerOptions) {
    this.options = options
    this.setupAutoplayFix()
  }

  private setupAutoplayFix(): void {
    window.addEventListener('click', () => this.engine?.resumeIfSuspended())
    window.addEventListener('keydown', () => this.engine?.resumeIfSuspended())
  }

  public getEngine(): SpeechCommandsWakeWord | null {
    return this.engine
  }

  public getIsRunning(): boolean {
    return this.isRunning
  }

  public getCalibrationStatus(): { isCalibrated: boolean; mode: 'custom-tf' | 'phonetic-fallback' | 'disabled' } {
    if (!this.options.getIsWakeWordEnabled()) {
      return { isCalibrated: false, mode: 'disabled' }
    }
    const isCalibrated = this.engine?.isCustomModelActive() || false
    return {
      isCalibrated,
      mode: isCalibrated ? 'custom-tf' : 'phonetic-fallback'
    }
  }

  public async init(): Promise<void> {
    await this.stopAll()

    if (!this.options.getIsWakeWordEnabled()) {
      console.log('[WakeWord] Wake word detection disabled by user.')
      this.options.onTrainerUIUpdate?.()
      return
    }

    const agentName = this.options.getAgentName()
    try {
      console.log(`[WakeWord] Inicializando TensorFlow.js para o agente "${agentName}"...`)

      this.engine = new SpeechCommandsWakeWord({
        probabilityThreshold: 0.70,
        suppressionTimeMillis: 2000,
        agentName
      })

      await this.engine.load(agentName)

      if (this.engine.isCustomModelActive()) {
        // Calibrated custom TensorFlow model is present
        this.engine.onDetect = (word: string, score: number) => {
          console.log(`[WakeWord] [TF Custom] Nome detectado: "${word}" (confiança: ${score.toFixed(2)})!`)
          playWakeChime()
          updateStatusBadge('listening', `${agentName} Ouvindo...`)
          this.options.onWakeTriggered()
        }

        this.engine.onError = (err: any) => {
          console.warn('[WakeWord] Erro no Speech Commands:', err)
        }

        await this.engine.start()
        this.isRunning = true
        this.isPhoneticFallbackActive = false
        console.log(`[WakeWord] TensorFlow.js Speech Commands ATIVO (Modelo Calibrado)!`)
      } else {
        // Clean installation / uncalibrated: start Web Speech API phonetic fallback
        console.log(`[WakeWord] Modelo TF não calibrado ainda. Ativando fallback fonético para "${agentName}"...`)
        this.startPhoneticFallback(agentName)
      }
    } catch (err: any) {
      console.warn('[WakeWord] Falha ao iniciar motor TF. Tentando fallback fonético:', err?.message || err)
      this.startPhoneticFallback(agentName)
    }

    this.options.onTrainerUIUpdate?.()
  }

  private startPhoneticFallback(agentName: string): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('[WakeWord] Web Speech API não suportada neste ambiente.')
      this.isRunning = false
      return
    }

    try {
      this.fallbackRecognizer = new SpeechRecognition()
      this.fallbackRecognizer.continuous = true
      this.fallbackRecognizer.interimResults = true
      this.fallbackRecognizer.lang = 'pt-BR'

      const target = agentName.toLowerCase().trim()

      this.fallbackRecognizer.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript?.toLowerCase() || ''
          if (transcript.includes(target) || (target === 'jasper' && (transcript.includes('jaspe') || transcript.includes('iásper')))) {
            console.log(`[WakeWord] [Fallback Fonético] Nome "${agentName}" detectado na fala: "${transcript}"`)
            playWakeChime()
            updateStatusBadge('listening', `${agentName} Ouvindo...`)
            this.options.onWakeTriggered()
            break
          }
        }
      }

      this.fallbackRecognizer.onerror = (err: any) => {
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          console.warn('[WakeWord] Fallback fonético em nuvem (Web Speech API) indisponível no Electron. Calibre a Wake Word nas configurações para ativação offline via TensorFlow.js local.')
          this.isPhoneticFallbackActive = false
          this.isRunning = false
          try {
            this.fallbackRecognizer?.abort()
          } catch {}
          this.options.onTrainerUIUpdate?.()
          return
        }
        // Ignore aborted errors when user is speaking or mic is toggled
        if (err.error !== 'aborted') {
          console.warn('[WakeWord] Erro no fallback fonético:', err.error)
        }
      }

      this.fallbackRecognizer.onend = () => {
        // Auto restart only if still supposed to be running and active
        if (this.isRunning && this.isPhoneticFallbackActive) {
          try {
            this.fallbackRecognizer?.start()
          } catch {}
        }
      }

      this.fallbackRecognizer.start()
      this.isRunning = true
      this.isPhoneticFallbackActive = true
      console.log(`[WakeWord] Fallback Fonético ATIVO para "${agentName}" (pronto para ativação inicial sem calibração)!`)
    } catch (err) {
      console.warn('[WakeWord] Não foi possível iniciar o fallback fonético:', err)
      this.isRunning = false
    }
  }

  private async stopAll(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.stop()
      } catch {}
      this.engine = null
    }

    if (this.fallbackRecognizer) {
      try {
        this.fallbackRecognizer.onend = null
        this.fallbackRecognizer.stop()
      } catch {}
      this.fallbackRecognizer = null
    }

    this.isRunning = false
    this.isPhoneticFallbackActive = false
  }

  public async pause(): Promise<void> {
    if (this.engine && this.isRunning && !this.isPhoneticFallbackActive) {
      try {
        await this.engine.stop()
      } catch {}
    } else if (this.fallbackRecognizer && this.isRunning && this.isPhoneticFallbackActive) {
      try {
        this.fallbackRecognizer.stop()
      } catch {}
    }
    this.isRunning = false
  }

  public async resume(isMicRecording: boolean): Promise<void> {
    if (!this.options.getIsWakeWordEnabled() || isMicRecording) return

    if (this.engine && this.engine.isCustomModelActive() && !this.isRunning) {
      try {
        await this.engine.start()
        this.isRunning = true
      } catch {}
    } else if (this.isPhoneticFallbackActive && this.fallbackRecognizer && !this.isRunning) {
      try {
        this.fallbackRecognizer.start()
        this.isRunning = true
      } catch {}
    } else if (!this.engine && !this.fallbackRecognizer) {
      await this.init()
    }
  }
}

