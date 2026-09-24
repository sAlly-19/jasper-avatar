import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import { createRequire } from 'module'
import { redactSecrets } from './clipboard-watcher'
import { securityBroker } from '../services/security-broker'

export interface FileSummaryResult {
  success: boolean
  filePath: string
  fileName: string
  extension: string
  fileSizeBytes: number
  totalLines: number
  characterCount: number
  contentPreview: string
  extractedText: string
  error?: string
}

function getPdfParser(): any {
  try {
    const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url)
    const p = req('pdf-parse')
    return typeof p === 'function' ? p : (p?.default || p)
  } catch {
    return null
  }
}

export class FileSummarizerService {
  private isEnabled: boolean = true
  private maxCharacters: number = 15000

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Reads and extracts raw text from a local file (.pdf, .docx, .txt, .md, .csv, .json, etc.)
   */
  public async readFileContent(filePath: string): Promise<FileSummaryResult> {
    const pathDecision = securityBroker.resolveUserPath(filePath)
    const cleanPath = pathDecision.resolvedPath || path.resolve(filePath.trim())

    if (!pathDecision.allowed || !pathDecision.resolvedPath) {
      return {
        success: false,
        filePath: cleanPath,
        fileName: path.basename(cleanPath),
        extension: path.extname(cleanPath),
        fileSizeBytes: 0,
        totalLines: 0,
        characterCount: 0,
        contentPreview: '',
        extractedText: '',
        error: pathDecision.reason || 'Acesso ao arquivo não autorizado.'
      }
    }

    try {
      const stats = await fs.stat(cleanPath)
      if (!stats.isFile()) {
        return {
          success: false,
          filePath: cleanPath,
          fileName: path.basename(cleanPath),
          extension: path.extname(cleanPath),
          fileSizeBytes: 0,
          totalLines: 0,
          characterCount: 0,
          contentPreview: '',
          extractedText: '',
          error: 'O caminho especificado não é um arquivo válido.'
        }
      }

      const ext = path.extname(cleanPath).toLowerCase()
      let rawText = ''

      if (ext === '.pdf') {
        const buffer = await fs.readFile(cleanPath)
        const pdfParse = getPdfParser()
        if (pdfParse) {
          const parsed = await pdfParse(buffer)
          rawText = parsed.text || ''
        } else {
          rawText = '[AVISO]: Módulo pdf-parse não disponível no ambiente.'
        }
      } else if (ext === '.docx') {
        const buffer = await fs.readFile(cleanPath)
        const result = await mammoth.extractRawText({ buffer })
        rawText = result.value || ''
      } else {
        // Text-based files (.txt, .md, .csv, .json, .log, .ts, .js, .py, etc.)
        rawText = await fs.readFile(cleanPath, 'utf-8')
      }

      const sanitized = redactSecrets(rawText)
      const lines = sanitized.split(/\r?\n/)
      const totalLines = lines.length
      const characterCount = sanitized.length

      const previewLength = Math.min(this.maxCharacters, sanitized.length)
      const truncated = sanitized.length > this.maxCharacters
      const contentPreview = sanitized.slice(0, previewLength) + (truncated ? '\n... [CONTEÚDO TRUNCADO DEVIDO AO LIMITE DE CONTEXTO]' : '')

      return {
        success: true,
        filePath: cleanPath,
        fileName: path.basename(cleanPath),
        extension: ext,
        fileSizeBytes: stats.size,
        totalLines,
        characterCount,
        contentPreview,
        extractedText: sanitized
      }
    } catch (err: any) {
      return {
        success: false,
        filePath: cleanPath,
        fileName: path.basename(cleanPath),
        extension: path.extname(cleanPath),
        fileSizeBytes: 0,
        totalLines: 0,
        characterCount: 0,
        contentPreview: '',
        extractedText: '',
        error: `Erro ao ler arquivo: ${err.message}`
      }
    }
  }

  /**
   * Generates a structured executive analysis of a local file
   */
  public async analyzeFile(filePath: string): Promise<string> {
    const res = await this.readFileContent(filePath)
    if (!res.success) {
      return `Não foi possível analisar o arquivo: ${res.error}`
    }

    const sizeKb = (res.fileSizeBytes / 1024).toFixed(1)
    const linesSample = res.contentPreview.slice(0, 1200)

    return `Análise do Arquivo "${res.fileName}":
- Tipo: ${res.extension.toUpperCase() || 'Arquivo de Texto'}
- Tamanho: ${sizeKb} KB (${res.characterCount} caracteres, ~${res.totalLines} linhas)
- Caminho: \`${res.filePath}\`

Trecho do Conteúdo:
"""
${linesSample}
"""

Pronto para sintetizar ou responder perguntas específicas sobre o conteúdo deste documento.`
  }
}

export const fileSummarizer = new FileSummarizerService()

