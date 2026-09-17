import { DOM } from './dom'
import { WakeWordManager } from '../audio/wake-word-manager'
import { playTone, playWakeChime } from '../audio/audio-cues'
import { MicRecorder } from '../audio/mic-recorder'

export interface WakeTrainerOptions {
  getAgentName: () => string
  wakeWordManager: WakeWordManager
  micRecorder: MicRecorder
}

export class WakeTrainerUI {
  private options: WakeTrainerOptions

  constructor(options: WakeTrainerOptions) {
    this.options = options
    this.setupListeners()
  }

  public updateUI(): void {
    const currentAgentName = this.options.getAgentName()
    const engine = this.options.wakeWordManager.getEngine()

    const lblAgentNames = document.querySelectorAll('.lbl-agent-target-name')
    lblAgentNames.forEach((el) => {
      el.textContent = currentAgentName
    })

    const isCustomActive = engine?.isCustomModelActive() || false
    const {
      badgeModelState,
      wakeStatusTitle,
      wakeStatusDesc,
      wakeStatusIcon,
      countNameSamples,
      countNoiseSamples,
      btnTrainCustomModel
    } = DOM

    const counts = engine?.getExampleCounts() || {}
    const nameKey = currentAgentName.toLowerCase()
    const nameCount = counts[nameKey] || 0
    const noiseCount = counts['_background_noise_'] || 0

    if (countNameSamples) countNameSamples.textContent = String(nameCount)
    if (countNoiseSamples) countNoiseSamples.textContent = String(noiseCount)

    if (btnTrainCustomModel) {
      const ready = nameCount >= 3 && noiseCount >= 2
      btnTrainCustomModel.disabled = !ready
      btnTrainCustomModel.style.opacity = ready ? '1' : '0.5'
      btnTrainCustomModel.style.cursor = ready ? 'pointer' : 'not-allowed'
    }

    if (isCustomActive) {
      if (badgeModelState) {
        badgeModelState.textContent = 'Calibrado & Ativo'
        badgeModelState.style.background = 'rgba(0, 255, 136, 0.15)'
        badgeModelState.style.color = '#00ff88'
        badgeModelState.style.borderColor = 'rgba(0, 255, 136, 0.3)'
      }
      if (wakeStatusTitle) {
        wakeStatusTitle.innerHTML = `Motor Neural Ativo para: <span class="lbl-agent-target-name">${currentAgentName}</span>`
      }
      if (wakeStatusDesc) {
        wakeStatusDesc.textContent = `Pronto! Diga "${currentAgentName}" no microfone para ativar o assistente. (Executado 100% localmente)`
      }
      if (wakeStatusIcon) wakeStatusIcon.textContent = '✅'
    } else {
      if (badgeModelState) {
        badgeModelState.textContent = 'Pendente de Calibração'
        badgeModelState.style.background = 'rgba(255, 170, 0, 0.15)'
        badgeModelState.style.color = '#ffaa00'
        badgeModelState.style.borderColor = 'rgba(255, 170, 0, 0.3)'
      }
      if (wakeStatusTitle) {
        wakeStatusTitle.innerHTML = `Calibração de Voz para: <span class="lbl-agent-target-name">${currentAgentName}</span>`
      }
      if (wakeStatusDesc) {
        wakeStatusDesc.textContent = `Grave 3 amostras rápidas dizendo "${currentAgentName}" e 2 de silêncio para a IA aprender sua voz e responder ao seu chamado.`
      }
      if (wakeStatusIcon) wakeStatusIcon.textContent = '⚡'
    }
  }

  private setupListeners(): void {
    const {
      btnSampleName,
      btnSampleNoise,
      btnTrainCustomModel,
      btnResetCustomModel,
      trainerFeedback,
      btnMic,
      micStatusLabel
    } = DOM

    const stopMicIfRecording = (): void => {
      if (this.options.micRecorder.isRecording()) {
        this.options.micRecorder.stop()
        btnMic.classList.remove('active')
        if (micStatusLabel) micStatusLabel.textContent = 'Pressione para falar'
      }
    }

    btnSampleName?.addEventListener('click', async () => {
      stopMicIfRecording()
      await this.options.wakeWordManager.pause()

      let engine = this.options.wakeWordManager.getEngine()
      if (!engine) {
        await this.options.wakeWordManager.init()
        engine = this.options.wakeWordManager.getEngine()
      }
      if (!engine) return

      const currentAgentName = this.options.getAgentName()
      const targetName = currentAgentName.toLowerCase().trim()

      try {
        btnSampleName.disabled = true
        if (btnSampleNoise) btnSampleNoise.disabled = true
        playTone(880, 0.12)
        if (trainerFeedback) {
          trainerFeedback.textContent = `🔴 Gravando... Diga claramente "${currentAgentName}" agora!`
          trainerFeedback.style.color = 'var(--accent-cyan)'
        }
        btnSampleName.textContent = '🔴 Gravando...'

        const result = await engine.collectCustomSample(targetName)

        playTone(523.25, 0.15)
        if (trainerFeedback) {
          trainerFeedback.textContent = `✅ Amostra de "${currentAgentName}" gravada com sucesso! (${result.count}/3)`
          trainerFeedback.style.color = '#00ff88'
        }
        this.updateUI()
      } catch (err: any) {
        console.error('[WakeTrainer] Erro ao gravar amostra:', err)
        if (trainerFeedback) {
          trainerFeedback.textContent = `Erro ao gravar: ${err?.message || err}`
          trainerFeedback.style.color = '#ff6666'
        }
      } finally {
        btnSampleName.disabled = false
        btnSampleName.innerHTML = `🎙️ Gravar "<span class="lbl-agent-target-name">${currentAgentName}</span>"`
        if (btnSampleNoise) btnSampleNoise.disabled = false
      }
    })

    btnSampleNoise?.addEventListener('click', async () => {
      stopMicIfRecording()
      await this.options.wakeWordManager.pause()

      let engine = this.options.wakeWordManager.getEngine()
      if (!engine) {
        await this.options.wakeWordManager.init()
        engine = this.options.wakeWordManager.getEngine()
      }
      if (!engine) return

      try {
        btnSampleNoise.disabled = true
        if (btnSampleName) btnSampleName.disabled = true
        playTone(659.25, 0.12)
        if (trainerFeedback) {
          trainerFeedback.textContent = '🤫 Gravando ruído ambiente... Fique em silêncio por 1 segundo.'
          trainerFeedback.style.color = 'var(--accent-cyan)'
        }
        btnSampleNoise.textContent = '🤫 Gravando...'

        const result = await engine.collectCustomSample('_background_noise_')

        playTone(523.25, 0.15)
        if (trainerFeedback) {
          trainerFeedback.textContent = `✅ Silêncio capturado com sucesso! (${result.count}/2)`
          trainerFeedback.style.color = '#00ff88'
        }
        this.updateUI()
      } catch (err: any) {
        console.error('[WakeTrainer] Erro ao gravar silêncio:', err)
        if (trainerFeedback) {
          trainerFeedback.textContent = `Erro ao gravar: ${err?.message || err}`
          trainerFeedback.style.color = '#ff6666'
        }
      } finally {
        btnSampleNoise.disabled = false
        btnSampleNoise.textContent = '🤫 Gravar Silêncio'
        if (btnSampleName) btnSampleName.disabled = false
      }
    })

    btnTrainCustomModel?.addEventListener('click', async () => {
      const engine = this.options.wakeWordManager.getEngine()
      if (!engine) return
      const currentAgentName = this.options.getAgentName()

      try {
        btnTrainCustomModel.disabled = true
        if (trainerFeedback) {
          trainerFeedback.textContent = `⚡ Compilando e treinando modelo neural local para "${currentAgentName}"...`
          trainerFeedback.style.color = 'var(--accent-cyan)'
        }

        await engine.trainCustomModel((epoch, loss) => {
          if (trainerFeedback) {
            trainerFeedback.textContent = `Treinando época ${epoch}/25 (perda: ${loss.toFixed(3)})...`
          }
        })

        playWakeChime()
        if (trainerFeedback) {
          trainerFeedback.textContent = `🎉 Sucesso! O assistente agora responde exclusivamente ao nome "${currentAgentName}".`
          trainerFeedback.style.color = '#00ff88'
        }
        this.updateUI()
      } catch (err: any) {
        if (trainerFeedback) {
          trainerFeedback.textContent = `Erro no treinamento: ${err?.message || err}`
          trainerFeedback.style.color = '#ff6666'
        }
      } finally {
        this.updateUI()
      }
    })

    btnResetCustomModel?.addEventListener('click', async () => {
      const engine = this.options.wakeWordManager.getEngine()
      if (!engine) return
      const currentAgentName = this.options.getAgentName()

      if (confirm(`Deseja resetar as amostras e a calibração de voz para "${currentAgentName}"?`)) {
        await engine.clearCustomModel()
        if (trainerFeedback) {
          trainerFeedback.textContent = 'Calibração resetada com sucesso.'
          trainerFeedback.style.color = 'var(--text-dim)'
        }
        this.updateUI()
      }
    })
  }
}

