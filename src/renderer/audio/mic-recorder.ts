export type AudioLevelCallback = (level: number) => void

export class MicRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private recording: boolean = false

  // 100ms buffering at 16kHz (1600 samples = 3200 bytes)
  // Reduces IPC and WebSocket packet flood by over 92%
  private static readonly BUFFER_SAMPLES = 1600
  private pcmBuffer = new Int16Array(MicRecorder.BUFFER_SAMPLES)
  private bufferOffset = 0

  // Intelligent Client-Side Voice Activity Detection (VAD)
  private hasSpoken = false
  private lastSpeechTimestamp = 0
  private recordingStartTimestamp = 0
  private isFinalizingTurn = false

  // VAD Tuning Parameters
  private static readonly SPEECH_RMS_THRESHOLD = 0.02
  private static readonly SILENCE_TIMEOUT_MS = 800 // 800ms silence after speech triggers turn finalization
  private static readonly NO_SPEECH_TIMEOUT_MS = 7000 // 7s without speaking auto-closes mic

  public onAudioLevel: AudioLevelCallback | null = null
  public onSpeechEnd: (() => void) | null = null
  public onSpeechTimeout: (() => void) | null = null

  public isRecording(): boolean {
    return this.recording
  }

  public async start(): Promise<void> {
    if (this.recording) return

    try {
      this.bufferOffset = 0
      this.hasSpoken = false
      this.isFinalizingTurn = false
      this.lastSpeechTimestamp = 0
      this.recordingStartTimestamp = Date.now()

      // Request mic stream with recommended parameters for Gemini Live
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      // AudioContext forced to 16kHz for Gemini PCM specification
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Inline AudioWorkletProcessor to stream PCM chunks without separate bundle issues
      const workletCode = `
        class PCMWorkletProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input && input[0] && input[0].length > 0) {
              this.port.postMessage(input[0]);
            }
            return true;
          }
        }
        registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
      `
      const blob = new Blob([workletCode], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)

      await this.audioContext.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet-processor')

      this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!this.recording || this.isFinalizingTurn) return
        const inputData = event.data
        if (!inputData || inputData.length === 0) return

        // 1. Calculate RMS energy for visualizer & client-side VAD
        let sum = 0
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          sum += s * s

          // Convert Float32 [-1, 1] to Int16 PCM little-endian
          const pcmVal = s < 0 ? s * 0x8000 : s * 0x7fff
          this.pcmBuffer[this.bufferOffset++] = pcmVal

          // When buffer reaches 100ms (1600 samples), dispatch to Gemini Live
          if (this.bufferOffset >= MicRecorder.BUFFER_SAMPLES) {
            window.electronAPI.sendAudioChunk(this.pcmBuffer.buffer.slice(0))
            this.bufferOffset = 0
          }
        }

        const rms = Math.sqrt(sum / inputData.length)
        this.onAudioLevel?.(Math.min(1, rms * 4))

        // 2. Client-Side Voice Activity Detection (VAD) Logic
        const now = Date.now()

        if (rms >= MicRecorder.SPEECH_RMS_THRESHOLD) {
          this.hasSpoken = true
          this.lastSpeechTimestamp = now
        }

        if (this.hasSpoken) {
          const silenceDuration = now - this.lastSpeechTimestamp
          if (silenceDuration >= MicRecorder.SILENCE_TIMEOUT_MS) {
            this.isFinalizingTurn = true
            this.flushRemainingBuffer()
            console.log(`[MicRecorder] Silêncio de ${silenceDuration}ms detectado após fala. Finalizando turno...`)
            window.electronAPI.sendAudioStreamEnd()
            this.onSpeechEnd?.()
            this.stop()
          }
        } else {
          // If no speech is detected within timeout, auto-stop
          const waitDuration = now - this.recordingStartTimestamp
          if (waitDuration >= MicRecorder.NO_SPEECH_TIMEOUT_MS) {
            this.isFinalizingTurn = true
            console.log('[MicRecorder] Nenhuma fala detectada no período inicial. Pausando microfone.')
            this.onSpeechTimeout?.()
            this.stop()
          }
        }
      }

      this.sourceNode.connect(this.workletNode)
      // Connect to a silent destination to keep the pipeline active
      const silentGain = this.audioContext.createGain()
      silentGain.gain.value = 0
      this.workletNode.connect(silentGain)
      silentGain.connect(this.audioContext.destination)

      this.recording = true
      console.log('[MicRecorder] Recording started at 16kHz PCM (buffered 100ms chunks + VAD ativo).')
    } catch (err) {
      console.error('[MicRecorder] Failed to start recording:', err)
      this.stop()
      throw err
    }
  }

  private flushRemainingBuffer(): void {
    if (this.bufferOffset > 0) {
      const slice = this.pcmBuffer.slice(0, this.bufferOffset)
      window.electronAPI.sendAudioChunk(slice.buffer)
      this.bufferOffset = 0
    }
  }

  public stop(): void {
    if (this.recording) {
      this.flushRemainingBuffer()
    }
    this.recording = false
    this.hasSpoken = false
    this.isFinalizingTurn = false

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.onAudioLevel?.(0)
    console.log('[MicRecorder] Recording stopped.')
  }
}
