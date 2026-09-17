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
  private isRunning = false
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

  public async init(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.stop()
      } catch (e) {
        console.warn('[WakeWord] Cleanup previous instance:', e)
      }
      this.engine = null
      this.isRunning = false
    }

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

      this.engine.onDetect = (word: string, score: number) => {
        console.log(`[WakeWord] Nome detectado: "${word}" (confiança: ${score.toFixed(2)})! Ativando ${agentName}...`)
        playWakeChime()
        updateStatusBadge('listening', `${agentName} Ouvindo...`)
        this.options.onWakeTriggered()
      }

      this.engine.onError = (err: any) => {
        console.warn('[WakeWord] Erro no Speech Commands:', err)
      }

      await this.engine.start()
      this.isRunning = true
      console.log(`[WakeWord] TensorFlow.js Speech Commands ATIVO e escutando por "${agentName}"!`)
    } catch (err: any) {
      console.warn('[WakeWord] Erro ao iniciar Speech Commands:', err?.message || err)
      this.isRunning = false
    }

    this.options.onTrainerUIUpdate?.()
  }

  public async pause(): Promise<void> {
    if (this.engine && this.isRunning) {
      try {
        await this.engine.stop()
        this.isRunning = false
        console.log('[WakeWord] TensorFlow.js Speech Commands pausado (gravação ativa).')
      } catch (e) {
        console.warn('[WakeWord] Erro ao pausar Speech Commands:', e)
      }
    }
  }

  public async resume(isMicRecording: boolean): Promise<void> {
    if (!this.options.getIsWakeWordEnabled() || isMicRecording) return

    if (this.engine && !this.isRunning) {
      try {
        await this.engine.start()
        this.isRunning = true
        console.log('[WakeWord] TensorFlow.js Speech Commands retomado.')
      } catch (e) {
        console.warn('[WakeWord] Erro ao retomar Speech Commands:', e)
      }
    } else if (!this.engine) {
      await this.init()
    }
  }
}

