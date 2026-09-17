import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import dns from 'dns'
import type { WebhookConfig, WebhookTriggerResult } from '@shared'

export function isPrivateOrLoopbackIP(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase()
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '0.0.0.0' || cleanIp === '::') {
    return true
  }

  // Cloud metadata services
  if (cleanIp === '169.254.169.254' || cleanIp.startsWith('169.254.')) {
    return true
  }

  // IPv6 unique-local (fc00::/7) or link-local (fe80::/10)
  if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd') || cleanIp.startsWith('fe80:')) {
    return true
  }

  // IPv4 Private subnets
  const ipParts = cleanIp.split('.').map(Number)
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    // 0.0.0.0/8
    if (ipParts[0] === 0) return true
    // 10.0.0.0/8
    if (ipParts[0] === 10) return true
    // 172.16.0.0/12
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true
    // 192.168.0.0/16
    if (ipParts[0] === 192 && ipParts[1] === 168) return true
    // 127.0.0.0/8
    if (ipParts[0] === 127) return true
    // 100.64.0.0/10 (CGNAT)
    if (ipParts[0] === 100 && ipParts[1] >= 64 && ipParts[1] <= 127) return true
    // 224.0.0.0/4 (Multicast)
    if (ipParts[0] >= 224) return true
  }

  return false
}

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true
  }

  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true
  }

  return isPrivateOrLoopbackIP(host)
}

export async function resolveAndCheckSSRF(hostname: string): Promise<{ isSafe: boolean; resolvedIps: string[]; reason?: string }> {
  if (isPrivateOrLoopbackHost(hostname)) {
    return { isSafe: false, resolvedIps: [hostname], reason: `Hostname loopback ou privado detectado: "${hostname}".` }
  }

  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true })
    const resolvedIps = lookupResults.map((r) => r.address)

    for (const res of lookupResults) {
      if (isPrivateOrLoopbackIP(res.address)) {
        return {
          isSafe: false,
          resolvedIps,
          reason: `DNS Rebinding detectado: O hostname "${hostname}" resolve para o endereço IP privado/local "${res.address}".`
        }
      }
    }

    return { isSafe: true, resolvedIps }
  } catch (err: any) {
    return { isSafe: false, resolvedIps: [], reason: `Falha ao resolver DNS do host "${hostname}": ${err.message}` }
  }
}

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
        // Pre-populate with legitimate public sample only (no auto-seeded localhost)
        const defaults: WebhookConfig[] = [
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

    // SSRF Validation
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          success: false,
          status: 0,
          responseBody: '',
          executionTimeMs: 0,
          error: `[SSRF Bloqueado] Protocolo não suportado: "${parsed.protocol}". Apenas http e https são permitidos.`
        }
      }

      // If it's not a pre-registered endpoint saved explicitly by the user, perform real DNS resolution to block DNS rebinding
      if (!registered) {
        const check = await resolveAndCheckSSRF(parsed.hostname)
        if (!check.isSafe) {
          return {
            success: false,
            status: 0,
            responseBody: '',
            executionTimeMs: 0,
            error: `[SSRF Bloqueado] ${check.reason} Requisições para redes locais só são permitidas para Webhooks pré-cadastrados nas configurações.`
          }
        }
      }
    } catch (urlErr: any) {
      return {
        success: false,
        status: 0,
        responseBody: '',
        executionTimeMs: 0,
        error: `URL inválida para disparo de Webhook: "${targetUrl}".`
      }
    }

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
