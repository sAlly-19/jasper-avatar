import { desktopCapturer } from 'electron'
import { securityBroker } from '../services/security-broker'

export class ScreenAwarenessService {
  private isEnabled: boolean = true
  private lastCaptureTime: number = 0
  private cachedThumbnail: string | null = null

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Captures the primary display screen using Electron's desktopCapturer.
   * Returns a base64 encoded JPEG thumbnail suitable for Gemini multimodal input.
   */
  public async captureScreen(): Promise<{
    success: boolean
    base64Image?: string
    width?: number
    height?: number
    timestamp?: number
    error?: string
  }> {
    if (!this.isEnabled) {
      return { success: false, error: 'O serviço de Visão de Tela está desativado nas configurações.' }
    }

    try {
      const approved = await securityBroker.confirmOperation({
        title: 'Autorizar captura de tela',
        message: 'O Jasper solicitou uma captura da tela principal.',
        detail: 'A imagem será enviada ao Gemini para responder à solicitação atual. Autorize somente se não houver informações sensíveis visíveis.',
        confirmLabel: 'Capturar e enviar'
      })
      if (!approved) {
        return { success: false, error: 'Captura de tela cancelada pelo usuário.' }
      }

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 }
      })

      if (!sources || sources.length === 0) {
        return { success: false, error: 'Nenhuma tela detectada para captura.' }
      }

      // Pick the primary display (usually first source)
      const primarySource = sources[0]
      const img = primarySource.thumbnail
      const size = img.getSize()

      // Convert to JPEG buffer and base64
      const jpegBuffer = img.toJPEG(75)
      const base64Image = jpegBuffer.toString('base64')
      this.cachedThumbnail = `data:image/jpeg;base64,${base64Image}`
      this.lastCaptureTime = Date.now()

      console.log(`[ScreenAwareness] Captured primary display (${size.width}x${size.height}, ${Math.round(jpegBuffer.length / 1024)} KB)`)

      return {
        success: true,
        base64Image,
        width: size.width,
        height: size.height,
        timestamp: this.lastCaptureTime
      }
    } catch (err: any) {
      console.error('[ScreenAwareness] Error capturing screen:', err)
      return { success: false, error: `Falha na captura de tela: ${err.message}` }
    }
  }

  public getLastCachedThumbnail(): string | null {
    return this.cachedThumbnail
  }
}

export const screenAwareness = new ScreenAwarenessService()

