export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private nextPlayTime: number = 0
  private activeSources: AudioBufferSourceNode[] = []
  private isSpeaking: boolean = false
  private drainTimeout: any = null
  public onSpeakingChange: ((speaking: boolean) => void) | null = null
  public onPlaybackEnded: (() => void) | null = null

  constructor() {
    // AudioContext will be initialized on user interaction or first playback
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.15
      this.analyser.connect(this.audioContext.destination)
      this.nextPlayTime = this.audioContext.currentTime
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    return this.audioContext
  }

  public getAnalyser(): AnalyserNode | null {
    this.ensureContext()
    return this.analyser
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking
  }

  /**
   * Enqueues a base64 encoded 24kHz Linear PCM 16-bit audio chunk from Gemini
   */
  public enqueueAudioChunk(base64Data: string): void {
    const ctx = this.ensureContext()

    // 1. Decode base64 to binary
    const binaryString = atob(base64Data)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 2. Convert Int16 little-endian samples to Float32 [-1.0, 1.0]
    const sampleCount = Math.floor(bytes.byteLength / 2)
    if (sampleCount === 0) return

    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount)
    const float32 = new Float32Array(sampleCount)

    for (let i = 0; i < sampleCount; i++) {
      const val = int16[i]
      float32[i] = val < 0 ? val / 0x8000 : val / 0x7fff
    }

    // 3. Create AudioBuffer at 24000 Hz
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.copyToChannel(float32, 0)

    // 4. Create and route SourceNode through Analyser for lip-sync & visualizer
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    if (this.analyser) {
      source.connect(this.analyser)
    } else {
      source.connect(ctx.destination)
    }

    // Clear any pending drain timeout
    if (this.drainTimeout) {
      clearTimeout(this.drainTimeout)
      this.drainTimeout = null
    }

    // 5. Schedule gapless continuous playback with drift compensation
    const now = ctx.currentTime
    // If there was a silence gap or nextPlayTime is in the past, realign to now
    if (now > this.nextPlayTime + 0.08) {
      this.nextPlayTime = now
    }
    const startTime = Math.max(now, this.nextPlayTime)
    source.start(startTime)
    this.nextPlayTime = startTime + audioBuffer.duration

    this.activeSources.push(source)
    this.setSpeaking(true)

    source.onended = (): void => {
      try {
        source.disconnect()
      } catch {}
      source.onended = null

      const index = this.activeSources.indexOf(source)
      if (index !== -1) {
        this.activeSources.splice(index, 1)
      }
      if (this.activeSources.length === 0) {
        if (this.drainTimeout) clearTimeout(this.drainTimeout)
        this.drainTimeout = setTimeout(() => {
          if (this.activeSources.length === 0) {
            this.setSpeaking(false)
            this.onPlaybackEnded?.()
          }
        }, 80)
      }
    }
  }

  private setSpeaking(val: boolean): void {
    if (this.isSpeaking !== val) {
      this.isSpeaking = val
      this.onSpeakingChange?.(val)
    }
  }

  /**
   * Immediately stops all currently playing and queued audio (called on user interrupt)
   */
  public stopAll(): void {
    if (this.drainTimeout) {
      clearTimeout(this.drainTimeout)
      this.drainTimeout = null
    }
    for (const source of this.activeSources) {
      try {
        source.stop()
        source.disconnect()
        source.onended = null
      } catch {
        // Source might already have stopped
      }
    }
    this.activeSources = []
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime
    }
    this.setSpeaking(false)
  }
}
