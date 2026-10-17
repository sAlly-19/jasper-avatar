import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { nativeImage } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { reportGenerator } from './report-generator'
import { securityBroker } from '../services/security-broker'

export interface QrGenerationResult {
  success: boolean
  filePath?: string
  dataUrl?: string
  message: string
}

export class QrService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Generates a QR Code image and saves it to the user's reports directory
   */
  public async generateQrCode(
    data: string,
    fileName?: string,
    format: 'png' | 'dataUrl' = 'png'
  ): Promise<QrGenerationResult> {
    if (!data || !data.trim()) {
      return { success: false, message: 'Nenhum dado informado para gerar o QR Code.' }
    }

    const cleanData = data.trim()

    try {
      // Always generate dataUrl for display in renderer UI
      const dataUrl = await QRCode.toDataURL(cleanData, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a', // Slate 900
          light: '#ffffff'
        }
      })

      if (format === 'dataUrl') {
        return {
          success: true,
          dataUrl,
          message: 'QR Code gerado com sucesso em formato DataURL.'
        }
      }

      const targetDir = await reportGenerator.getTargetDirectory()
      const requestedBase = path.basename(fileName?.trim() || `qrcode_${Date.now()}`, path.extname(fileName?.trim() || ''))
      const normalizedBase = requestedBase
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100)
      const safeName = `${normalizedBase || `qrcode_${Date.now()}`}.png`
      const finalPath = path.join(targetDir, safeName)

      const buffer = await QRCode.toBuffer(cleanData, {
        width: 500,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })

      await fs.writeFile(finalPath, buffer)

      return {
        success: true,
        filePath: finalPath,
        dataUrl,
        message: `QR Code gerado e salvo com sucesso em: ${finalPath}`
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao gerar QR Code: ${err.message}`
      }
    }
  }

  /**
   * Reads and decodes a QR Code from an image file
   */
  public async readQrCode(imagePath: string): Promise<{ success: boolean; data?: string; message: string }> {
    const userPathCheck = securityBroker.resolveUserPath(imagePath)
    if (!userPathCheck.allowed || !userPathCheck.resolvedPath) {
      return { success: false, message: userPathCheck.reason || 'Caminho de imagem não autorizado.' }
    }
    const cleanPath = userPathCheck.resolvedPath

    try {
      const stat = await fs.stat(cleanPath)
      if (!stat.isFile() || stat.size > 20 * 1024 * 1024) {
        return { success: false, message: 'A imagem deve ser um arquivo de até 20 MB.' }
      }

      const image = nativeImage.createFromPath(cleanPath)
      if (image.isEmpty()) {
        return { success: false, message: 'O arquivo não contém uma imagem compatível.' }
      }

      const { width, height } = image.getSize()
      if (width < 1 || height < 1 || width * height > 25_000_000) {
        return { success: false, message: 'A imagem excede o limite de 25 megapixels.' }
      }

      const bgra = image.toBitmap()
      const rgba = new Uint8ClampedArray(bgra.length)
      for (let index = 0; index < bgra.length; index += 4) {
        rgba[index] = bgra[index + 2]
        rgba[index + 1] = bgra[index + 1]
        rgba[index + 2] = bgra[index]
        rgba[index + 3] = bgra[index + 3]
      }

      const decoded = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' })
      if (!decoded?.data) {
        return { success: false, message: 'Nenhum QR Code legível foi encontrado na imagem.' }
      }

      return {
        success: true,
        data: decoded.data,
        message: `QR Code lido com sucesso em "${path.basename(cleanPath)}".`
      }
    } catch {
      return {
        success: false,
        message: `Arquivo de imagem "${cleanPath}" não encontrado.`
      }
    }
  }
}

export const qrService = new QrService()

