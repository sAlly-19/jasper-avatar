import fs from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import { screenAwareness } from './screen-awareness'
import { redactSecrets } from './clipboard-watcher'

export interface OcrResult {
  success: boolean
  text: string
  confidence: number
  linesCount: number
  message: string
  error?: string
}

function getTesseract(): any {
  try {
    const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url)
    const t = req('tesseract.js')
    return t?.default || t
  } catch {
    return null
  }
}

export class OcrService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Recognizes text from an image buffer or file path
   */
  public async recognize(
    imageInput: Buffer | string,
    languages: string = 'eng+por'
  ): Promise<OcrResult> {
    const tesseract = getTesseract()
    if (!tesseract || typeof tesseract.recognize !== 'function') {
      return {
        success: false,
        text: '',
        confidence: 0,
        linesCount: 0,
        message: 'Motor Tesseract.js não disponível.',
        error: 'Tesseract engine unavailable'
      }
    }

    try {
      let bufferToProcess: Buffer

      if (typeof imageInput === 'string') {
        const cleanPath = path.resolve(imageInput.trim())
        bufferToProcess = await fs.readFile(cleanPath)
      } else {
        bufferToProcess = imageInput
      }

      const { data } = await tesseract.recognize(bufferToProcess, languages, {
        logger: () => {} // Silent
      })

      const rawText = data?.text || ''
      const sanitized = redactSecrets(rawText.trim())
      const lines = sanitized.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
      const confidence = Math.round(data?.confidence || 0)

      return {
        success: true,
        text: sanitized,
        confidence,
        linesCount: lines.length,
        message: `OCR concluído com sucesso (${confidence}% de confiança, ${lines.length} linhas extraídas).`
      }
    } catch (err: any) {
      return {
        success: false,
        text: '',
        confidence: 0,
        linesCount: 0,
        message: `Falha no reconhecimento de texto OCR: ${err.message}`,
        error: err.message
      }
    }
  }

  /**
   * Captures the primary screen and runs local OCR extraction
   */
  public async recognizeScreen(languages: string = 'eng+por'): Promise<OcrResult> {
    try {
      const cap = await screenAwareness.captureScreen()
      if (!cap.success || !cap.base64Image) {
        return {
          success: false,
          text: '',
          confidence: 0,
          linesCount: 0,
          message: `Falha ao capturar tela para OCR: ${cap.error || 'Erro desconhecido'}`,
          error: cap.error
        }
      }

      const buffer = Buffer.from(cap.base64Image, 'base64')
      return await this.recognize(buffer, languages)
    } catch (err: any) {
      return {
        success: false,
        text: '',
        confidence: 0,
        linesCount: 0,
        message: `Erro na captura/OCR da tela: ${err.message}`,
        error: err.message
      }
    }
  }
}

export const ocrService = new OcrService()

