import type { SmartHomeEntity, SmartHomeActionResult } from '@shared'

const ALLOWED_DOMAINS = new Set(['light', 'switch', 'climate', 'fan', 'media_player'])
const BLOCKED_DOMAINS = new Set(['lock', 'alarm_control_panel', 'cover', 'garage', 'camera'])

export class SmartHomeService {
  private enabled: boolean = true
  private baseUrl: string = process.env.HASS_URL || 'http://homeassistant.local:8123'
  private token: string = process.env.HASS_TOKEN || ''

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setConfig(url: string, token: string): void {
    if (url) this.baseUrl = url.trim().replace(/\/$/, '')
    if (token !== undefined) this.token = token.trim()
  }

  public async testConnection(url?: string, token?: string): Promise<{ success: boolean; message: string }> {
    const targetUrl = (url || this.baseUrl).trim().replace(/\/$/, '')
    const targetToken = token !== undefined ? token.trim() : this.token

    if (!targetUrl) {
      return { success: false, message: 'URL do Home Assistant não informada.' }
    }
    if (!targetToken) {
      return { success: false, message: 'Token de Acesso não informado.' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)

      const res = await fetch(`${targetUrl}/api/`, {
        headers: {
          Authorization: `Bearer ${targetToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (res.ok) {
        const data: any = await res.json()
        return {
          success: true,
          message: `Conectado com sucesso ao Home Assistant! (${data.message || 'API ativa'})`
        }
      } else {
        return {
          success: false,
          message: `Home Assistant retornou erro HTTP ${res.status}: ${res.statusText}`
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Falha na conexão: ${err.message || 'Servidor inacessível'}`
      }
    }
  }

  public async getEntities(filterDomain?: string): Promise<SmartHomeEntity[]> {
    if (!this.enabled) return []

    // If Home Assistant token is configured, fetch live states
    if (this.token) {
      try {
        const res = await fetch(`${this.baseUrl}/api/states`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        })

        if (res.ok) {
          const raw: any[] = await res.json()
          let list = raw.map((item) => ({
            entityId: item.entity_id,
            domain: item.entity_id.split('.')[0],
            friendlyName: item.attributes?.friendly_name || item.entity_id,
            state: item.state,
            attributes: item.attributes
          }))

          // Apply security filter to hide blocked/sensitive domains
          list = list.filter((e) => !BLOCKED_DOMAINS.has(e.domain))

          if (filterDomain) {
            list = list.filter((e) => e.domain === filterDomain)
          }
          return list
        }
      } catch (err) {
        console.warn('[SmartHome] Error connecting to Home Assistant API:', err)
      }
    }

    // Default mock devices for immediate out-of-the-box readiness
    const sampleDevices: SmartHomeEntity[] = [
      {
        entityId: 'light.escritorio_principal',
        domain: 'light',
        friendlyName: 'Luz do Escritório',
        state: 'on',
        attributes: { brightness: 255, color_mode: 'rgb' }
      },
      {
        entityId: 'climate.ar_condicionado',
        domain: 'climate',
        friendlyName: 'Ar Condicionado',
        state: 'cool',
        attributes: { temperature: 22, current_temperature: 24 }
      },
      {
        entityId: 'switch.tomada_computador',
        domain: 'switch',
        friendlyName: 'Tomada do Setup',
        state: 'on'
      }
    ]

    return filterDomain ? sampleDevices.filter((e) => e.domain === filterDomain) : sampleDevices
  }

  public async executeCommand(
    domain: string,
    service: string,
    entityId: string,
    serviceData: Record<string, any> = {}
  ): Promise<SmartHomeActionResult> {
    if (!this.enabled) {
      return {
        success: false,
        entityId,
        action: `${domain}.${service}`,
        message: 'Serviço de Casa Inteligente desativado nas configurações.'
      }
    }

    const cleanDomain = domain.toLowerCase().trim()
    const cleanService = service.toLowerCase().trim()
    const cleanEntity = entityId.trim()

    // 1. Security Check: Block dangerous physical access domains
    if (BLOCKED_DOMAINS.has(cleanDomain)) {
      return {
        success: false,
        entityId: cleanEntity,
        action: `${cleanDomain}.${cleanService}`,
        message: `[SEGURANÇA BLOQUEADA] O domínio "${cleanDomain}" controla acessos físicos (portas/travas/garagens) e está restrito por política Zero-Trust.`
      }
    }

    // 2. Security Check: Enforce allowed domains
    if (!ALLOWED_DOMAINS.has(cleanDomain)) {
      return {
        success: false,
        entityId: cleanEntity,
        action: `${cleanDomain}.${cleanService}`,
        message: `[DOMÍNIO NÃO PERMITIDO] Somente os domínios [${Array.from(ALLOWED_DOMAINS).join(', ')}] são autorizados.`
      }
    }

    // 3. If live token is present, dispatch to Home Assistant
    if (this.token) {
      try {
        const res = await fetch(`${this.baseUrl}/api/services/${cleanDomain}/${cleanService}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entity_id: cleanEntity,
            ...serviceData
          })
        })

        if (res.ok) {
          return {
            success: true,
            entityId: cleanEntity,
            action: `${cleanDomain}.${cleanService}`,
            message: `[EXECUTED] Comando executado no Home Assistant: ${cleanEntity} -> ${cleanService}`
          }
        } else {
          return {
            success: false,
            entityId: cleanEntity,
            action: `${cleanDomain}.${cleanService}`,
            message: `Home Assistant retornou erro ${res.status}: ${res.statusText}`
          }
        }
      } catch (err: any) {
        return {
          success: false,
          entityId: cleanEntity,
          action: `${cleanDomain}.${cleanService}`,
          message: `Falha ao conectar no Home Assistant: ${err.message}`
        }
      }
    }

    // 4. Simulated response with transparent feedback
    const friendlyAction =
      cleanService === 'turn_on' ? 'ligado' : cleanService === 'turn_off' ? 'desligado' : cleanService
    return {
      success: true,
      entityId: cleanEntity,
      action: `${cleanDomain}.${cleanService}`,
      message: `[SIMULATED] Dispositivo "${cleanEntity}" foi ${friendlyAction} com sucesso em modo de demonstração local (sem Home Assistant conectado).`
    }
  }
}

export const smartHome = new SmartHomeService()
