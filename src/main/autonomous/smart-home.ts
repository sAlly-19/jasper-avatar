import type { SmartHomeEntity, SmartHomeActionResult } from '@shared'

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
    if (token) this.token = token.trim()
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

    // If live token is present, dispatch to Home Assistant
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
            message: `Comando executado no Home Assistant: ${cleanEntity} -> ${cleanService}`
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

    // Simulated response with feedback
    const friendlyAction =
      cleanService === 'turn_on' ? 'ligado' : cleanService === 'turn_off' ? 'desligado' : cleanService
    return {
      success: true,
      entityId: cleanEntity,
      action: `${cleanDomain}.${cleanService}`,
      message: `[Simulação Smart Home]: Dispositivo "${cleanEntity}" foi ${friendlyAction} com sucesso.`
    }
  }
}

export const smartHome = new SmartHomeService()

