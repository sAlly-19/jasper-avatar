import { clipboard } from 'electron'
import type { AutonomyNotification } from '@shared'

export type ClipboardContentType = 'error_trace' | 'url' | 'json' | 'code' | 'text'

export interface ClipboardAnalysis {
  text: string
  type: ClipboardContentType
  summary: string
  timestamp: number
}

export function redactSecrets(text: string): string {
  return text
    .replace(/\bAIzaSy[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_SECRET_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9_.-]{20,}\b/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\bpassword\s*[:=]\s*["'][^"']+["']/gi, 'password: "[REDACTED]"')
}

export class ClipboardWatcherService {
  private isEnabled: boolean = true
  private pollIntervalMs: number = 1500
  private timer: NodeJS.Timeout | null = null
  private lastClipboardText: string = ''
  private onInterestingContent?: (notification: AutonomyNotification) => void

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      this.start()
    } else {
      this.stop()
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  public setOnInterestingContent(cb: (notification: AutonomyNotification) => void): void {
    this.onInterestingContent = cb
  }

  public start(): void {
    if (this.timer) return
    this.lastClipboardText = clipboard.readText().trim()
    this.timer = setInterval(() => this.check(), this.pollIntervalMs)
    console.log('[ClipboardWatcher] Service started')
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[ClipboardWatcher] Service stopped')
    }
  }

  public readClipboard(): string {
    return redactSecrets(clipboard.readText())
  }

  public analyzeText(text: string): ClipboardAnalysis {
    const sanitized = redactSecrets(text.trim())
    const trimmed = sanitized

    // 1. Error or Stack Trace
    const errorRegex = /(Exception|Error:|Traceback \(most recent call last\)|NullReferenceException|TypeError|ReferenceError|SyntaxError|UnhandledPromiseRejection|FATAL|panic:)/i
    if (errorRegex.test(trimmed)) {
      const firstLine = trimmed.split('\n')[0].slice(0, 100)
      return {
        text: trimmed,
        type: 'error_trace',
        summary: `Erro copiado: ${firstLine}`,
        timestamp: Date.now()
      }
    }

    // 2. Web URL
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed)
        return {
          text: trimmed,
          type: 'url',
          summary: `Link copiado: ${parsed.hostname}`,
          timestamp: Date.now()
        }
      } catch {}
    }

    // 3. JSON Payload
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed)
        return {
          text: trimmed,
          type: 'json',
          summary: `Objeto JSON válido copiado (${trimmed.length} caracteres)`,
          timestamp: Date.now()
        }
      } catch {}
    }

    // 4. Source code snippet
    if (/(import\s+.*from|const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+|def\s+\w+\(|public\s+static\s+void|async\s+function)/.test(trimmed)) {
      return {
        text: trimmed,
        type: 'code',
        summary: `Trecho de código copiado (${trimmed.split('\n').length} linhas)`,
        timestamp: Date.now()
      }
    }

    return {
      text: trimmed,
      type: 'text',
      summary: `Texto copiado (${trimmed.length} caracteres)`,
      timestamp: Date.now()
    }
  }

  private check(): void {
    if (!this.isEnabled) return

    try {
      const currentText = clipboard.readText().trim()
      if (!currentText || currentText === this.lastClipboardText) return

      this.lastClipboardText = currentText

      // Only notify if content is interesting (e.g. error trace, url, or json)
      const analysis = this.analyzeText(currentText)
      if (analysis.type === 'error_trace' || analysis.type === 'url') {
        const notification: AutonomyNotification = {
          id: `clip-${Date.now()}`,
          type: 'clipboard',
          title: analysis.type === 'error_trace' ? 'Erro Copiado no Clipboard' : 'Link Detectado',
          message: analysis.summary,
          timestamp: Date.now(),
          data: { analysis }
        }
        this.onInterestingContent?.(notification)
      }
    } catch (err) {
      console.warn('[ClipboardWatcher] Check error:', err)
    }
  }
}

export const clipboardWatcher = new ClipboardWatcherService()

