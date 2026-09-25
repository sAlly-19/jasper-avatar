export type AudioLevelCallback = (level: number) => void

export class MicRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private silentGain: GainNode | null = null

  private recording: boolean = false
  private isCallMode: boolean = false

  // 100ms buffering at 16kHz (1600 samples = 3200 bytes)
  // Continuous real-time streaming to Gemini Live
  // 40 ms at 16 kHz keeps Live API turns responsive without excessive IPC overhead.
  private static readonly BUFFER_SAMPLES = 640
  private pcmBuffer = new Int16Array(MicRecorder.BUFFER_SAMPLES)
  private bufferOffset = 0

  // Voice Activity & 30s Inactivity Tracking
  private hasSpoken = false
  private speechFramesCount = 0
  private lastActivityTimestamp = 0

  // VAD Tuning Parameters
  // Noise threshold: frames below this RMS are considered ambient noise (typing, fan, AC)
  private static readonly SPEECH_RMS_THRESHOLD = 0.025
  // Requires at least ~150ms of sustained speech energy to confirm real speech
  private static readonly MIN_SPEECH_CHUNKS = 18
  // 30s inactivity in Call Mode (ignoring ambient noise)
  private static readonly CALL_INACTIVITY_TIMEOUT_MS = 30000

  public onAudioLevel: AudioLevelCallback | null = null
  public onCallInactivityTimeout: (() => void) | null = null

  public isRecording(): boolean {
    return this.recording
  }

  public getIsCallMode(): boolean {
    return this.isCallMode
  }

  public setCallMode(val: boolean): void {
    this.isCallMode = val
  }

  /**
   * Resets the inactivity clock when the assistant is active (speaking or receiving chunks)
   */
  public notifyAssistantActivity(): void {
    this.lastActivityTimestamp = Date.now()
  }

  /**
   * Returns remaining seconds until 30s inactivity timeout
   */
  public getRemainingInactivitySeconds(): number {
    if (!this.isCallMode || !this.recording) {
      return 30
    }
    const elapsed = Date.now() - this.lastActivityTimestamp
    return Math.max(0, Math.ceil((MicRecorder.CALL_INACTIVITY_TIMEOUT_MS - elapsed) / 1000))
  }

  private async ensurePipeline(): Promise<void> {
    if (
      this.audioContext &&
      this.audioContext.state !== 'closed' &&
      this.mediaStream &&
      this.mediaStream.active &&
      this.sourceNode &&
      this.workletNode
    ) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      return
    }

    this.cleanupNodes()

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

    try {
      await this.audioContext.audioWorklet.addModule(workletUrl)
    } finally {
      URL.revokeObjectURL(workletUrl)
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet-processor')

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.handleWorkletAudio(event.data)
    }

    this.sourceNode.connect(this.workletNode)
    // Connect to a silent gain destination to keep the Web Audio processing graph active
    this.silentGain = this.audioContext.createGain()
    this.silentGain.gain.value = 0
    this.workletNode.connect(this.silentGain)
    this.silentGain.connect(this.audioContext.destination)
  }

  private handleWorkletAudio(inputData: Float32Array): void {
    if (!this.recording) {
      return
    }
    if (!inputData || inputData.length === 0) return

    // 1. Calculate RMS energy for visualizer & client-side speech detection
    let sum = 0
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]))
      sum += s * s

      // Convert Float32 [-1, 1] to Int16 PCM little-endian
      const pcmVal = s < 0 ? s * 0x8000 : s * 0x7fff
      this.pcmBuffer[this.bufferOffset++] = pcmVal

      // Continuous full-duplex streaming: dispatch 40 ms PCM frames to Gemini Live.
      if (this.bufferOffset >= MicRecorder.BUFFER_SAMPLES) {
        window.electronAPI.sendAudioChunk(this.pcmBuffer.buffer.slice(0))
        this.bufferOffset = 0
      }
    }

    const rms = Math.sqrt(sum / inputData.length)
    this.onAudioLevel?.(Math.min(1, rms * 4))

    const now = Date.now()

    // 2. Filter ambient noise and detect sustained human speech
    if (rms >= MicRecorder.SPEECH_RMS_THRESHOLD) {
      this.speechFramesCount++
      if (this.speechFramesCount >= MicRecorder.MIN_SPEECH_CHUNKS) {
        this.hasSpoken = true
        // Real human speech confirmed: reset 30s inactivity timeout
        this.lastActivityTimestamp = now
      }
    } else {
      // Ambient noise or brief transient: decrement speech frame count
      if (this.speechFramesCount > 0 && !this.hasSpoken) {
        this.speechFramesCount--
      }
    }

    // 3. 30-second Inactivity Timeout in Call Mode (ignoring ambient noise)
    if (this.isCallMode) {
      const elapsed = now - this.lastActivityTimestamp
      if (elapsed >= MicRecorder.CALL_INACTIVITY_TIMEOUT_MS) {
        console.log(`[MicRecorder] Inatividade de ${MicRecorder.CALL_INACTIVITY_TIMEOUT_MS / 1000}s em Modo Chamada. Encerrando chamada...`)
        this.flushRemainingBuffer()
        this.onCallInactivityTimeout?.()
        this.stop()
      }
    }
  }

  public async start(callMode = true): Promise<void> {
    this.isCallMode = callMode
    this.bufferOffset = 0
    this.hasSpoken = false
    this.speechFramesCount = 0
    this.lastActivityTimestamp = Date.now()

    try {
      await this.ensurePipeline()
      this.recording = true
      console.log(`[MicRecorder] Microfone Full-Duplex ativado (Streaming contínuo, VAD no servidor).`)
    } catch (err) {
      console.error('[MicRecorder] Falha ao iniciar gravação:', err)
      this.stop()
      throw err
    }
  }

  public pauseForTurn(): void {
    // In Full-Duplex Gemini Live, streaming is continuous.
    // Flushes buffer without closing pipeline.
    this.flushRemainingBuffer()
    this.hasSpoken = false
    this.speechFramesCount = 0
  }

  public async resumeOrStart(callMode = true): Promise<void> {
    this.isCallMode = callMode
    this.bufferOffset = 0
    this.hasSpoken = false
    this.speechFramesCount = 0
    this.lastActivityTimestamp = Date.now()

    if (
      this.mediaStream &&
      this.mediaStream.active &&
      this.audioContext &&
      this.audioContext.state !== 'closed'
    ) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      this.recording = true
      console.log('[MicRecorder] Microfone Full-Duplex mantido ativo.')
    } else {
      await this.start(callMode)
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
    this.isCallMode = false
    this.hasSpoken = false
    this.speechFramesCount = 0

    this.cleanupNodes()
    this.onAudioLevel?.(0)
    console.log('[MicRecorder] Microfone finalizado e recursos liberados.')
  }

  private cleanupNodes(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {}
      this.sourceNode = null
    }

    if (this.workletNode) {
      try {
        this.workletNode.disconnect()
      } catch {}
      this.workletNode = null
    }

    if (this.silentGain) {
      try {
        this.silentGain.disconnect()
      } catch {}
      this.silentGain = null
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop())
      } catch {}
      this.mediaStream = null
    }

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch {}
      this.audioContext = null
    }
  }
}
