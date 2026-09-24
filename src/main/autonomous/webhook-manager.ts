import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import dns from 'dns'
import http from 'http'
import https from 'https'
import net from 'net'
import type { WebhookConfig, WebhookTriggerResult } from '@shared'
import { atomicWriteJsonSync, readJsonFileSync } from '../utils/atomic-json'

const MAX_WEBHOOK_PAYLOAD_BYTES = 256 * 1024
const MAX_WEBHOOK_RESPONSE_BYTES = 64 * 1024
const FORBIDDEN_WEBHOOK_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

interface PinnedResponse {
  status: number
  ok: boolean
  location?: string
  preview: string
}

export function isPrivateOrLoopbackIP(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '0.0.0.0' || cleanIp === '::') {
    return true
  }

  if (cleanIp.startsWith('::ffff:')) {
    return isPrivateOrLoopbackIP(cleanIp.slice('::ffff:'.length))
  }

  // Cloud metadata services
  if (cleanIp === '169.254.169.254' || cleanIp.startsWith('169.254.')) {
    return true
  }

  // IPv6 unique-local (fc00::/7) or link-local (fe80::/10)
  if (/^(fc|fd)/.test(cleanIp) || /^fe[89ab]/.test(cleanIp) || cleanIp.startsWith('ff')) {
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

function validateWebhookConfig(config: WebhookConfig): WebhookConfig {
  const name = config.name?.trim()
  if (!name || name.length > 80 || !/^[\p{L}\p{N}_.-]+$/u.test(name)) {
    throw new Error('Nome de webhook inválido.')
  }

  const parsed = new URL(config.url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Webhooks exigem HTTPS e não aceitam credenciais na URL.')
  }

  const method = config.method || 'POST'
  if (!['GET', 'POST', 'PUT'].includes(method)) throw new Error('Método de webhook inválido.')

  const headers: Record<string, string> = {}
  const entries = Object.entries(config.headers || {})
  if (entries.length > 20) throw new Error('Quantidade de cabeçalhos excede o limite.')
  for (const [rawName, rawValue] of entries) {
    const headerName = rawName.trim()
    const headerValue = String(rawValue)
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName) || FORBIDDEN_WEBHOOK_HEADERS.has(headerName.toLowerCase())) {
      throw new Error('Cabeçalho de webhook não permitido.')
    }
    if (headerValue.length > 2048 || /[\r\n]/.test(headerValue)) throw new Error('Valor de cabeçalho inválido.')
    headers[headerName] = headerValue
  }

  return {
    name,
    url: parsed.toString(),
    method,
    headers,
    description: config.description?.trim().slice(0, 300)
  }
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

async function requestPinned(
  target: URL,
  method: 'POST' | 'GET' | 'PUT',
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal
): Promise<PinnedResponse> {
  const check = await resolveAndCheckSSRF(target.hostname)
  if (!check.isSafe || check.resolvedIps.length === 0) {
    throw new Error(`[SSRF Bloqueado] ${check.reason || 'Destino sem endereço público válido.'}`)
  }

  const pinnedIp = check.resolvedIps[0]
  const family = net.isIP(pinnedIp)
  if (!family) throw new Error('Falha ao validar o endereço do webhook.')

  return await new Promise<PinnedResponse>((resolve, reject) => {
    const transport = target.protocol === 'https:' ? https : http
    let settled = false
    const finish = (error?: Error, result?: PinnedResponse): void => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(result!)
    }

    const request = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method,
      headers,
      signal,
      servername: target.hostname,
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, pinnedIp, family)
      }) as any
    }, (response) => {
      const chunks: Buffer[] = []
      let totalBytes = 0
      response.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
        if (totalBytes <= MAX_WEBHOOK_RESPONSE_BYTES) chunks.push(Buffer.from(chunk))
        if (totalBytes > MAX_WEBHOOK_RESPONSE_BYTES) {
          complete()
          response.destroy()
        }
      })
      const complete = (): void => finish(undefined, {
        status: response.statusCode || 0,
        ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
        location: response.headers.location,
        preview: Buffer.concat(chunks).toString('utf-8').slice(0, 1000)
      })
      response.on('end', complete)
      response.on('close', complete)
    })
    request.on('error', (error) => finish(error))
    if (body) request.write(body)
    request.end()
  })
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
        const arr = readJsonFileSync<WebhookConfig[]>(this.storageFile)
        if (Array.isArray(arr)) {
          for (const webhook of arr) {
            try {
              const validated = validateWebhookConfig(webhook)
              this.webhooks.set(validated.name.toLowerCase(), validated)
            } catch {
              console.warn('[WebhookManager] Configuração inválida ignorada.')
            }
          }
        }
      } else {
        this.saveWebhooks()
      }
    } catch (err) {
      console.warn('[WebhookManager] Error loading webhooks:', err)
    }
  }

  private saveWebhooks(): void {
    try {
      const arr = Array.from(this.webhooks.values())
      atomicWriteJsonSync(this.storageFile, arr)
    } catch (err) {
      console.warn('[WebhookManager] Error saving webhooks:', err)
    }
  }

  public listWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values())
  }

  public registerWebhook(config: WebhookConfig): void {
    const validated = validateWebhookConfig(config)
    this.webhooks.set(validated.name.toLowerCase(), validated)
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

    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        return {
          success: false,
          status: 0,
          responseBody: '',
          executionTimeMs: 0,
          error: '[SSRF Bloqueado] Webhooks exigem HTTPS e não aceitam credenciais na URL.'
        }
      }

      const check = await resolveAndCheckSSRF(parsed.hostname)
      if (!check.isSafe) {
        return {
          success: false,
          status: 0,
          responseBody: '',
          executionTimeMs: 0,
          error: `[SSRF Bloqueado] ${check.reason}`
        }
      }
    } catch {
      return {
        success: false,
        status: 0,
        responseBody: '',
        executionTimeMs: 0,
        error: 'URL inválida para disparo de webhook.'
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Jasper-AI-HUD/2.0',
      ...(registered?.headers || {})
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {

      let body: string | undefined
      if (method !== 'GET') {
        body = JSON.stringify({
          ...payload,
          _jasperTimestamp: Date.now(),
          _source: 'Jasper AI HUD'
        })
        if (Buffer.byteLength(body, 'utf-8') > MAX_WEBHOOK_PAYLOAD_BYTES) {
          throw new Error('Payload do webhook excede 256 KB.')
        }
        headers['Content-Length'] = String(Buffer.byteLength(body, 'utf-8'))
      }

      let currentUrl = new URL(targetUrl)
      let response: PinnedResponse | undefined
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        response = await requestPinned(currentUrl, method, headers, body, controller.signal)
        if (response.status < 300 || response.status >= 400) break

        const location = response.location
        if (!location) throw new Error('Redirecionamento sem cabeçalho Location.')
        if (redirectCount === 3) throw new Error('Limite de redirecionamentos excedido.')

        const nextUrl = new URL(location, currentUrl)
        if (nextUrl.protocol !== 'https:' || nextUrl.username || nextUrl.password) {
          throw new Error('Redirecionamento de webhook não permitido.')
        }
        if (nextUrl.origin !== currentUrl.origin) {
          throw new Error('Redirecionamento para outra origem bloqueado para proteger credenciais.')
        }
        currentUrl = nextUrl
      }

      if (!response) throw new Error('Webhook não retornou uma resposta.')

      const executionTimeMs = Date.now() - start
      return {
        success: response.ok,
        status: response.status,
        responseBody: response.preview,
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
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const webhookManager = new WebhookManager()
