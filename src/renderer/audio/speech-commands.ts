import * as tf from '@tensorflow/tfjs'
import * as speechCommands from '@tensorflow-models/speech-commands'

export interface SpeechWakeWordOptions {
  probabilityThreshold?: number
  suppressionTimeMillis?: number
  agentName?: string
  wakeWords?: string[]
}

export class SpeechCommandsWakeWord {
  private recognizer: speechCommands.SpeechCommandRecognizer | null = null
  private transferRecognizer: speechCommands.TransferSpeechCommandRecognizer | null = null
  private isCustomModelTrained = false
  private isLegacyTwoClassModel = false
  private isListening = false
  private options: Required<SpeechWakeWordOptions>

  public onDetect: ((word: string, score: number) => void) | null = null
  public onAudioLevel: ((rms: number) => void) | null = null
  public onError: ((err: any) => void) | null = null

  constructor(options: SpeechWakeWordOptions = {}) {
    const agent = (options.agentName && options.agentName.trim()) || 'Jasper'
    this.options = {
      probabilityThreshold: options.probabilityThreshold ?? 0.85,
      suppressionTimeMillis: options.suppressionTimeMillis ?? 2500,
      agentName: agent,
      wakeWords: options.wakeWords ?? [agent.toLowerCase()]
    }
  }

  private getModelName(): string {
    const clean = (this.options.agentName || 'jasper')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '')
    return `jasper-transfer-${clean}`
  }

  private getOrCreateTransferRecognizer(modelKey: string): speechCommands.TransferSpeechCommandRecognizer {
    if (!this.recognizer) throw new Error('Recognizer base do TensorFlow.js não foi carregado.')
    const existing = (this.recognizer as any).transferRecognizers?.[modelKey]
    if (existing) {
      return existing
    }
    return this.recognizer.createTransfer(modelKey)
  }

  public async load(agentName?: string): Promise<void> {
    if (agentName) {
      this.options.agentName = agentName.trim()
      this.options.wakeWords = [agentName.toLowerCase().trim()]
    }

    console.log('[SpeechCommands] Inicializando motor.')

    // Initialize TensorFlow.js backend (WebGL or CPU)
    await tf.ready()

    if (!this.recognizer) {
      this.recognizer = speechCommands.create('BROWSER_FFT')
      await this.recognizer.ensureModelLoaded()
      console.log('[SpeechCommands] Modelo base TensorFlow.js pronto.')
    }

    // Check if custom transfer-learned model exists in IndexedDB for this agent
    const modelKey = this.getModelName()
    const transfer = this.getOrCreateTransferRecognizer(modelKey)
    this.transferRecognizer = transfer

    try {
      await transfer.load()
      const labels = transfer.wordLabels()
      // A safe transfer model must have negative speech samples (_other_) to avoid firing on any word
      if (labels.includes('_other_') && labels.length >= 3) {
        this.isCustomModelTrained = true
        this.isLegacyTwoClassModel = false
        console.log(`[SpeechCommands] Modelo personalizado de ${labels.length} classes carregado do IndexedDB.`)
      } else {
        this.isCustomModelTrained = false
        this.isLegacyTwoClassModel = true
        console.warn('[SpeechCommands] Modelo salvo possui apenas 2 classes. Calibração necessária para evitar falsos positivos.')
      }
    } catch {
      this.isCustomModelTrained = false
      this.isLegacyTwoClassModel = false
      console.log('[SpeechCommands] Nenhum modelo personalizado salvo ainda.')
    }
  }

  public isCustomModelActive(): boolean {
    return this.isCustomModelTrained
  }

  public isLegacyModel(): boolean {
    return this.isLegacyTwoClassModel
  }

  public hasNegativeSpeechSamples(): boolean {
    if (!this.transferRecognizer || !this.isCustomModelTrained) return false
    const labels = this.transferRecognizer.wordLabels()
    return labels.includes('_other_')
  }

  public getModelAgentName(): string {
    return this.options.agentName
  }

  public async start(): Promise<void> {
    if (!this.recognizer) {
      await this.load()
    }
    if (this.isListening) return

    const activeRecognizer = (this.isCustomModelTrained && this.transferRecognizer)
      ? this.transferRecognizer
      : this.recognizer!

    const words = activeRecognizer.wordLabels()

    try {
      await activeRecognizer.listen(
        async (result) => {
          const scores = result.scores as Float32Array
          let maxScore = 0
          let maxIndex = -1

          for (let i = 0; i < scores.length; i++) {
            if (scores[i] > maxScore) {
              maxScore = scores[i]
              maxIndex = i
            }
          }

          if (maxIndex >= 0) {
            const detectedWord = words[maxIndex]
            // Ignore background noise, unknown, and negative speech samples (_other_)
            if (
              detectedWord === '_background_noise_' ||
              detectedWord === '_unknown_' ||
              detectedWord === '_other_' ||
              detectedWord === '_other_speech_'
            ) {
              return
            }

            // Verify minimum probability threshold
            if (maxScore < this.options.probabilityThreshold) {
              return
            }

            // 1. If using the custom transfer model, match the specific trained agent name
            if (this.isCustomModelTrained && this.transferRecognizer) {
              const target = this.options.agentName.toLowerCase()
              if (detectedWord.toLowerCase() !== target) {
                return
              }
            } else {
              // 2. If using the base model, filter strictly by wakeWords (never 'go' or 'yes')
              const matches = this.options.wakeWords.some(
                (w) => w.toLowerCase() === detectedWord.toLowerCase()
              )
              if (!matches) {
                return
              }
            }

            console.log(
              `%c[SpeechCommands] Nome detectado: "${detectedWord}" (confiança: ${(maxScore * 100).toFixed(1)}%)`,
              'color: #00f0ff; font-weight: bold;'
            )
            this.onDetect?.(detectedWord, maxScore)
          }
        },
        {
          includeSpectrogram: false,
          probabilityThreshold: this.options.probabilityThreshold,
          suppressionTimeMillis: this.options.suppressionTimeMillis,
          overlapFactor: 0.25
        }
      )

      this.isListening = true
      console.log('[SpeechCommands] Escuta ativa por voz.')
    } catch (err: any) {
      console.error('[SpeechCommands] Erro ao iniciar listen():', err)
      this.onError?.(err)
      throw err
    }
  }

  public async stop(): Promise<void> {
    if (this.recognizer && this.recognizer.isListening()) {
      try {
        await this.recognizer.stopListening()
      } catch (e) {
        console.warn('[SpeechCommands] Erro ao parar recognizer:', e)
      }
    }
    if (this.transferRecognizer && this.transferRecognizer.isListening()) {
      try {
        await this.transferRecognizer.stopListening()
      } catch (e) {
        console.warn('[SpeechCommands] Erro ao parar transferRecognizer:', e)
      }
    }
    this.isListening = false
    console.log('[SpeechCommands] Escuta pausada.')
  }

  public resumeIfSuspended(): void {
    const activeRecognizer = (this.isCustomModelTrained && this.transferRecognizer)
      ? this.transferRecognizer
      : this.recognizer
    if (activeRecognizer && (activeRecognizer as any).audioDataExtractor?.audioContext?.state === 'suspended') {
      try {
        ;(activeRecognizer as any).audioDataExtractor.audioContext.resume()
      } catch {}
    }
  }

  public getIsListening(): boolean {
    return this.isListening
  }

  public getWordLabels(): string[] {
    const active = (this.isCustomModelTrained && this.transferRecognizer)
      ? this.transferRecognizer
      : this.recognizer
    return active?.wordLabels() || []
  }

  public getExampleCounts(): { [word: string]: number } {
    if (!this.transferRecognizer) return {}
    try {
      return this.transferRecognizer.countExamples() || {}
    } catch {
      return {}
    }
  }

  // Transfer Learning helpers for custom wake word ("Jasper" / "Jarvis")
  public async collectCustomSample(word: string): Promise<{ word: string; count: number; total: { [w: string]: number } }> {
    const wasListening = this.isListening
    await this.stop()

    if (!this.recognizer) {
      await this.load()
    }

    const modelKey = this.getModelName()
    this.transferRecognizer = this.getOrCreateTransferRecognizer(modelKey)

    // Ensure audio devices are released cleanly
    await new Promise((resolve) => setTimeout(resolve, 200))

    console.log('[SpeechCommands] Gravando amostra de 1 segundo.')
    await this.transferRecognizer.collectExample(word)
    const counts = this.transferRecognizer.countExamples()
    const count = counts[word] || 0
    console.log(`[SpeechCommands] Amostra capturada. Total: ${count}`)

    if (wasListening && this.isCustomModelTrained) {
      await this.start()
    }

    return { word, count, total: counts }
  }

  public async trainCustomModel(onProgress?: (epoch: number, loss: number) => void): Promise<void> {
    if (!this.transferRecognizer) throw new Error('Nenhum exemplo de áudio foi gravado ainda.')
    const counts = this.transferRecognizer.countExamples()
    const nameKey = this.options.agentName.toLowerCase()
    const nameCount = counts[nameKey] || 0
    const noiseCount = counts['_background_noise_'] || 0
    const otherCount = (counts['_other_'] || 0) + (counts['_other_speech_'] || 0)

    if (nameCount < 3 || noiseCount < 2 || otherCount < 2) {
      throw new Error(
        `Para treinar sem falsos positivos, é necessário gravar ao menos 3 amostras do nome "${this.options.agentName}", 2 de silêncio e 2 de outras palavras comuns.`
      )
    }

    const wasListening = this.isListening
    await this.stop()
    await new Promise((resolve) => setTimeout(resolve, 150))

    console.log('[SpeechCommands] Treinando modelo neural com 3 classes.')

    // Reset previous transfer model instances to avoid TypeError: Cannot set property 'trainable' of undefined
    const tr = this.transferRecognizer as any
    if (tr) {
      if (tr.model) {
        try {
          tr.model.dispose()
        } catch (e) {
          console.warn('[SpeechCommands] Aviso ao descartar modelo anterior:', e)
        }
        tr.model = null
      }
      tr.secondLastBaseDenseLayer = null
    }

    await this.transferRecognizer.train({
      epochs: 25,
      callback: {
        onEpochEnd: (epoch, logs) => {
          onProgress?.(epoch + 1, logs?.loss || 0)
        }
      }
    })

    await this.transferRecognizer.save()
    this.isCustomModelTrained = true
    this.isLegacyTwoClassModel = false
    console.log('[SpeechCommands] Modelo personalizado salvo no IndexedDB.')

    await this.start()
  }

  public async clearCustomModel(): Promise<void> {
    const wasListening = this.isListening
    await this.stop()

    const modelKey = this.getModelName()
    if (this.transferRecognizer) {
      try {
        this.transferRecognizer.clearExamples()
      } catch {}
      try {
        const tr = this.transferRecognizer as any
        if (tr.model) {
          tr.model.dispose()
          tr.model = null
        }
        tr.secondLastBaseDenseLayer = null
      } catch {}
    }
    this.isCustomModelTrained = false
    this.isLegacyTwoClassModel = false

    try {
      await speechCommands.deleteSavedTransferModel(modelKey)
    } catch {}

    console.log('[SpeechCommands] Modelo personalizado resetado.')

    if (wasListening && this.isCustomModelTrained) {
      await this.start()
    }
  }
}
