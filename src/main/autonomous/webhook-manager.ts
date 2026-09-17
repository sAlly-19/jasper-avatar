import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import type { WebhookConfig, WebhookTriggerResult } from '@shared'

export class WebhookManager {
  private enabled: boolean = true
  private storageFile: string
  private webhooks: Map<string, WebhookConfig> = new Map()

  constructor() {
    this.storageFile = join(app.getPath('userData'), 'jasper-webhooks.json')
    this.loadWebhooks()
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  private loadWebhooks(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8')
        const arr: WebhookConfig[] = JSON.parse(raw)
        arr.forEach((w) => this.webhooks.set(w.name.toLowerCase(), w))
      } else {
        // Pre-populate with sample entries
        const defaults: WebhookConfig[] = [
          {
            name: 'n8n-fluxo',
            url: 'http://localhost:5678/webhook/jasper',
            method: 'POST',
            description: 'Webhook local do n8n para automação de tarefas'
          },
          {
            name: 'slack-canal',
            url: 'https://hooks.slack.com/services/sample/webhook',
            method: 'POST',
            description: 'Notificação para o canal do Slack'
          }
        ]
        defaults.forEach((w) => this.webhooks.set(w.name.toLowerCase(), w))
        this.saveWebhooks()
      }
    } catch (err) {
      console.warn('[WebhookManager] Error loading webhooks:', err)
    }
  }

  private saveWebhooks(): void {
    try {
      const arr = Array.from(this.webhooks.values())
      fs.writeFileSync(this.storageFile, JSON.stringify(arr, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[WebhookManager] Error saving webhooks:', err)
    }
  }

  public listWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values())
  }

  public registerWebhook(config: WebhookConfig): void {
    this.webhooks.set(config.name.toLowerCase(), config)
    this.saveWebhooks()
  }

  public removeWebhook(name: string): boolean {
    if (this.webhooks.delete(name.toLowerCase())) {
      this.saveWebhooks()
      return true
    }
    return false
  }

  public async triggerWebhook(
    nameOrUrl: string,
    payload: Record<string, any> = {},
    customMethod?: 'POST' | 'GET' | 'PUT'
  ): Promise<WebhookTriggerResult> {
    if (!this.enabled) {
      return {
        success: false,
        status: 0,
        responseBody: '',
        executionTimeMs: 0,
        error: 'Disparador de Webhooks desativado nas configurações.'
      }
    }

    const start = Date.now()
    const lowerName = nameOrUrl.toLowerCase().trim()
    const registered = this.webhooks.get(lowerName)

    const targetUrl = registered ? registered.url : nameOrUrl
    const method = customMethod || (registered?.method || 'POST')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Jasper-AI-HUD/2.0',
      ...(registered?.headers || {})
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const options: RequestInit = {
        method,
        headers,
        signal: controller.signal
      }

      if (method !== 'GET') {
        options.body = JSON.stringify({
          ...payload,
          _jasperTimestamp: Date.now(),
          _source: 'Jasper AI HUD'
        })
      }

      const response = await fetch(targetUrl, options)
      clearTimeout(timeout)

      const executionTimeMs = Date.now() - start
      const text = await response.text()

      return {
        success: response.ok,
        status: response.status,
        responseBody: text.slice(0, 1000),
        executionTimeMs
      }
    } catch (err: any) {
      return {
        success: false,
        status: 0,
        responseBody: '',
        executionTimeMs: Date.now() - start,
        error: err.message || 'Falha ao disparar webhook'
      }
    }
  }
}

export const webhookManager = new WebhookManager()

