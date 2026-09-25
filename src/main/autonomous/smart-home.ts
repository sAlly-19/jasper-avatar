import type { SmartHomeEntity, SmartHomeActionResult } from '@shared'
import { securityBroker } from '../services/security-broker'

const ALLOWED_SERVICES: Record<string, ReadonlySet<string>> = {
  light: new Set(['turn_on', 'turn_off', 'toggle']),
  switch: new Set(['turn_on', 'turn_off', 'toggle']),
  climate: new Set(['turn_on', 'turn_off', 'set_temperature', 'set_hvac_mode']),
  fan: new Set(['turn_on', 'turn_off', 'toggle', 'set_percentage']),
  media_player: new Set([
    'turn_on', 'turn_off', 'media_play', 'media_pause', 'media_stop',
    'media_next_track', 'media_previous_track', 'volume_set'
  ])
}

const BLOCKED_DOMAINS = new Set(['lock', 'alarm_control_panel', 'cover', 'garage', 'camera'])
const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.azure.internal',
  'metadata.aws.internal'
])

function validateBaseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim())
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
    if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.hostname.toLowerCase().endsWith('.internal')) return null
    parsed.pathname = '/'
    parsed.search = ''
    parsed.hash = ''
    return parsed
  } catch {
    return null
  }
}

function validateServiceData(domain: string, service: string, data: Record<string, unknown>): Record<string, unknown> | null {
  const keys = Object.keys(data)
  if (keys.length > 8 || keys.some((key) => !/^[a-z][a-z0-9_]{0,40}$/i.test(key))) return null

  const allowedKeys = new Set<string>()
  if (domain === 'light' && service === 'turn_on') {
    ;['brightness', 'brightness_pct', 'color_temp_kelvin', 'rgb_color', 'transition'].forEach((key) => allowedKeys.add(key))
  } else if (domain === 'climate' && service === 'set_temperature') {
    ;['temperature', 'target_temp_high', 'target_temp_low', 'hvac_mode'].forEach((key) => allowedKeys.add(key))
  } else if (domain === 'climate' && service === 'set_hvac_mode') {
    allowedKeys.add('hvac_mode')
  } else if (domain === 'fan' && service === 'set_percentage') {
    allowedKeys.add('percentage')
  } else if (domain === 'media_player' && service === 'volume_set') {
    allowedKeys.add('volume_level')
  }
  if (keys.some((key) => !allowedKeys.has(key))) return null

  const numericRanges: Record<string, [number, number]> = {
    brightness: [0, 255], brightness_pct: [0, 100], color_temp_kelvin: [1000, 12000],
    transition: [0, 300], temperature: [5, 40], target_temp_high: [5, 40],
    target_temp_low: [5, 40], percentage: [0, 100], volume_level: [0, 1]
  }
  for (const [key, [min, max]] of Object.entries(numericRanges)) {
    if (key in data && (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < min || data[key] > max)) {
      return null
    }
  }
  if ('rgb_color' in data && (!Array.isArray(data.rgb_color) || data.rgb_color.length !== 3 || data.rgb_color.some(
    (value) => !Number.isInteger(value) || value < 0 || value > 255
  ))) return null
  if ('hvac_mode' in data && (typeof data.hvac_mode !== 'string' || !['off', 'heat', 'cool', 'auto', 'dry', 'fan_only'].includes(data.hvac_mode))) {
    return null
  }
  return data
}

export class SmartHomeService {
  private enabled = true
  private baseUrl = process.env.HASS_URL || 'http://homeassistant.local:8123'
  private token = process.env.HASS_TOKEN || ''

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setConfig(url: string, token: string): void {
    if (url !== undefined) this.baseUrl = url.trim().replace(/\/$/, '')
    if (token !== undefined) this.token = token.trim()
  }

  private getConfiguredUrl(): URL | null {
    return this.token ? validateBaseUrl(this.baseUrl) : null
  }

  private async request(pathname: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
    const base = this.getConfiguredUrl()
    if (!base) throw new Error('NOT_CONFIGURED')
    const target = new URL(pathname, base)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(target, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...init.headers
        }
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  public async testConnection(url?: string, token?: string): Promise<{ success: boolean; message: string }> {
    const previousUrl = this.baseUrl
    const previousToken = this.token
    if (url !== undefined || token !== undefined) this.setConfig(url ?? this.baseUrl, token ?? this.token)
    try {
      if (!this.token) return { success: false, message: 'Token de Acesso nao informado.' }
      if (!validateBaseUrl(this.baseUrl)) return { success: false, message: 'URL do Home Assistant invalida ou bloqueada.' }
      const response = await this.request('/api/')
      return response.ok
        ? { success: true, message: 'Conectado com sucesso ao Home Assistant.' }
        : { success: false, message: `Home Assistant retornou erro HTTP ${response.status}.` }
    } catch (error) {
      return { success: false, message: `Falha na conexao: ${error instanceof Error ? error.message : 'Servidor inacessivel'}` }
    } finally {
      if (url !== undefined || token !== undefined) {
        this.baseUrl = previousUrl
        this.token = previousToken
      }
    }
  }

  public async getEntities(filterDomain?: string): Promise<SmartHomeEntity[]> {
    if (!this.enabled || !this.getConfiguredUrl()) return []
    const normalizedFilter = filterDomain?.toLowerCase().trim()
    if (normalizedFilter && !ALLOWED_SERVICES[normalizedFilter]) return []

    try {
      const response = await this.request('/api/states')
      if (!response.ok) return []
      const body: unknown = await response.json()
      if (!Array.isArray(body)) return []
      return body.slice(0, 1000).flatMap((item): SmartHomeEntity[] => {
        if (!item || typeof item !== 'object') return []
        const candidate = item as Record<string, unknown>
        if (typeof candidate.entity_id !== 'string' || typeof candidate.state !== 'string') return []
        const domain = candidate.entity_id.split('.')[0]
        if (!ALLOWED_SERVICES[domain] || (normalizedFilter && domain !== normalizedFilter)) return []
        const attributes = candidate.attributes && typeof candidate.attributes === 'object'
          ? candidate.attributes as Record<string, unknown>
          : {}
        return [{
          entityId: candidate.entity_id,
          domain,
          friendlyName: typeof attributes.friendly_name === 'string' ? attributes.friendly_name.slice(0, 200) : candidate.entity_id,
          state: candidate.state.slice(0, 100),
          attributes
        }]
      })
    } catch (error) {
      console.warn('[SmartHome] Home Assistant indisponivel:', error instanceof Error ? error.message : 'erro desconhecido')
      return []
    }
  }

  public async executeCommand(
    domain: string,
    service: string,
    entityId: string,
    serviceData: Record<string, unknown> = {}
  ): Promise<SmartHomeActionResult> {
    const cleanDomain = String(domain || '').toLowerCase().trim()
    const cleanService = String(service || '').toLowerCase().trim()
    const cleanEntity = String(entityId || '').toLowerCase().trim()
    const action = `${cleanDomain}.${cleanService}`
    const fail = (message: string, error?: string): SmartHomeActionResult => ({
      success: false, entityId: cleanEntity, action, message, error
    })

    if (!this.enabled) return fail('Servico de Casa Inteligente desativado nas configuracoes.', 'DISABLED')
    if (BLOCKED_DOMAINS.has(cleanDomain)) return fail('Dominio de seguranca fisica bloqueado por politica.', 'BLOCKED_DOMAIN')
    if (!ALLOWED_SERVICES[cleanDomain]) return fail('Dominio de dispositivo nao permitido.', 'INVALID_DOMAIN')
    if (!ALLOWED_SERVICES[cleanDomain].has(cleanService)) return fail('Servico nao permitido para este dominio.', 'INVALID_SERVICE')
    if (!new RegExp(`^${cleanDomain}\\.[a-z0-9_]{1,100}$`).test(cleanEntity)) {
      return fail('Identificador da entidade invalido ou de outro dominio.', 'INVALID_ENTITY')
    }
    const cleanData = validateServiceData(cleanDomain, cleanService, serviceData)
    if (!cleanData) return fail('Parametros do servico invalidos ou fora dos limites.', 'INVALID_SERVICE_DATA')
    if (!this.getConfiguredUrl()) return fail('Home Assistant nao configurado. Nenhum comando foi executado.', 'NOT_CONFIGURED')

    const approved = await securityBroker.confirmOperation({
      title: 'Autorizar comando residencial',
      message: `Executar ${cleanService} em ${cleanEntity}?`,
      detail: `Home Assistant: ${validateBaseUrl(this.baseUrl)?.host || 'nao configurado'}. Cada comando exige autorizacao individual.`,
      confirmLabel: 'Executar comando',
      risk: 'mandatory'
    })
    if (!approved) return fail('Comando cancelado pelo usuario.', 'USER_CANCELLED')

    try {
      const response = await this.request(`/api/services/${cleanDomain}/${cleanService}`, {
        method: 'POST',
        body: JSON.stringify({ entity_id: cleanEntity, ...cleanData })
      })
      if (!response.ok) return fail(`Home Assistant retornou erro HTTP ${response.status}.`, 'UPSTREAM_ERROR')
      return {
        success: true,
        entityId: cleanEntity,
        action,
        message: `Comando ${action} executado em ${cleanEntity}.`
      }
    } catch (error) {
      return fail(`Falha ao conectar no Home Assistant: ${error instanceof Error ? error.message : 'erro desconhecido'}`, 'NETWORK_ERROR')
    }
  }
}

export const smartHome = new SmartHomeService()
