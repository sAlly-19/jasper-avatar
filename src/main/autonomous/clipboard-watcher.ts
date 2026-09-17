import { clipboard } from 'electron'
import type { AutonomyNotification } from '@shared'

export type ClipboardContentType = 'error_trace' | 'url' | 'json' | 'code' | 'text'

export interface ClipboardAnalysis {
  text: string
  type: ClipboardContentType
  summary: string
  timestamp: number
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
    return clipboard.readText()
  }

  public analyzeText(text: string): ClipboardAnalysis {
    const trimmed = text.trim()

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
          title: analysis.type === 'error_trace' ? '⚠️ Erro Copiado no Clipboard' : '🔗 Link Detectado',
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

