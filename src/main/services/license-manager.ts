import { configStore } from '../config/config-store'
import { getHardwareInfo } from './hwid'
import type { LicenseValidationResult, LicenseInfo } from '@shared'

// Configurações do Firebase Firestore (REST API v1 sem necessidade de Cloud Functions)
const DEFAULT_FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'jasper-avatar'
const DEFAULT_FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyBkvZHEAr0Vn32I6Qcr4TW958L5nhHSx_0'

/**
 * Converte a estrutura de campos tipados do Firestore REST API em objeto plano
 */
function parseFirestoreFields(fields: Record<string, any> = {}): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'object') continue
    if (val.stringValue !== undefined) result[key] = val.stringValue
    else if (val.integerValue !== undefined) result[key] = Number(val.integerValue)
    else if (val.doubleValue !== undefined) result[key] = Number(val.doubleValue)
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue
    else if (val.nullValue !== undefined) result[key] = null
    else if (val.timestampValue !== undefined) result[key] = val.timestampValue
    else result[key] = val
  }
  return result
}

export class LicenseManager {
  private projectId: string = DEFAULT_FIREBASE_PROJECT
  private apiKey: string = DEFAULT_FIREBASE_API_KEY
  private customBaseUrl: string | null = null

  public setCustomBaseUrl(url: string | null): void {
    this.customBaseUrl = url
  }

  public setProjectId(id: string): void {
    this.projectId = id
  }

  public setApiKey(key: string): void {
    this.apiKey = key
  }

  public validateKeyFormat(key: string): boolean {
    if (!key || typeof key !== 'string') return false
    const pattern = /^(JASPER-LT|JSPR-V1)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i
    return pattern.test(key.trim())
  }

  /**
   * Valida a licença e aplica a restrição de máquina única (Node-Locking) diretamente no Google Firestore.
   * Não depende de Cloud Functions ou servidores intermediários.
   */
  public async activateLicense(key: string): Promise<LicenseValidationResult> {
    const cleanKey = key.trim().toUpperCase()

    if (!this.validateKeyFormat(cleanKey)) {
      return {
        valid: false,
        error: 'INVALID_FORMAT',
        message: 'Formato de chave inválido. Padrão esperado: JASPER-LT-XXXX-XXXX-XXXX'
      }
    }

    const hw = getHardwareInfo()
    const now = new Date().toISOString()

    // URL do documento no Firestore
    const baseUrl =
      this.customBaseUrl ||
      `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/licenses`
    const docUrl = `${baseUrl}/${cleanKey}?key=${this.apiKey}`

    try {
      // 1. Consulta direta do documento da chave no Firestore
      const getRes = await fetch(docUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      })

      if (getRes.status === 404) {
        configStore.updateConfig({ licenseStatus: 'unlicensed' })
        return {
          valid: false,
          error: 'LICENSE_NOT_FOUND',
          message: 'Chave de licença inexistente ou incorreta.'
        }
      }

      if (getRes.status === 403) {
        configStore.updateConfig({ licenseStatus: 'disabled' })
        return {
          valid: false,
          error: 'PERMISSION_DENIED',
          message: 'Acesso negado pelas regras de segurança da licença.'
        }
      }

      if (!getRes.ok) {
        return {
          valid: false,
          error: 'SERVER_ERROR',
          message: `Falha ao consultar banco de dados (HTTP ${getRes.status}).`
        }
      }

      const docData = await getRes.json()
      const fields = parseFirestoreFields(docData.fields)

      const status = fields.status || 'active'
      const clientName = fields.name || 'Cliente Autorizado'
      const clientEmail = fields.email || ''
      const boundHwid = fields.machineId || null
      const boundMachineName = fields.machineName || null

      // 2. Verificação de suspensão / revogação
      if (status === 'disabled') {
        configStore.updateConfig({ licenseStatus: 'disabled' })
        return {
          valid: false,
          error: 'LICENSE_DISABLED',
          message: 'Esta licença foi temporariamente suspensa pelo administrador.'
        }
      }

      if (status === 'revoked') {
        configStore.updateConfig({ licenseStatus: 'revoked' })
        return {
          valid: false,
          error: 'LICENSE_REVOKED',
          message: 'Esta licença foi permanentemente revogada pelo administrador.'
        }
      }

      // 4. CASO A: Primeira Ativação (Node-Locking) -> Vincula a máquina atual
      if (!boundHwid) {
        const patchUrl = `${baseUrl}/${cleanKey}?updateMask.fieldPaths=machineId&updateMask.fieldPaths=machineName&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=lastClientVersion&key=${this.apiKey}`
        const patchBody = {
          fields: {
            machineId: { stringValue: hw.machineId },
            machineName: { stringValue: hw.machineName || 'Computador Pessoal' },
            activatedAt: { stringValue: now },
            lastSeenAt: { stringValue: now },
            lastClientVersion: { stringValue: '1.0.0' }
          }
        }

        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
          signal: AbortSignal.timeout(8000)
        })

        if (!patchRes.ok) {
          const errData = await patchRes.json().catch(() => ({}))
          console.warn('[LicenseManager] Falha ao vincular HWID no Firestore:', patchRes.status, errData)
          return {
            valid: false,
            error: 'ACTIVATION_FAILED',
            message: 'Não foi possível vincular o hardware da máquina ao registro da licença.'
          }
        }

        configStore.updateConfig({
          licenseKey: cleanKey,
          licenseStatus: 'active',
          licenseClientName: clientName,
          licenseClientEmail: clientEmail,
          licenseMachineId: hw.machineId,
          licenseActivatedAt: now,
          licenseLastCheckedAt: now
        })

        console.log(`[LicenseManager] Licença vinculada e ativada com sucesso nesta máquina para ${clientName}!`)
        return {
          valid: true,
          status: 'ACTIVATED',
          message: `Licença vinculada e ativada com sucesso nesta máquina (${hw.machineName})!`,
          client: { name: clientName, email: clientEmail },
          machineId: hw.machineId,
          activatedAt: now
        }
      }

      // 5. CASO B: Mesma Máquina -> Atualiza heartbeat (lastSeenAt)
      if (boundHwid === hw.machineId) {
        const heartbeatUrl = `${baseUrl}/${cleanKey}?updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=machineName&updateMask.fieldPaths=lastClientVersion&key=${this.apiKey}`
        const heartbeatBody = {
          fields: {
            lastSeenAt: { stringValue: now },
            machineName: { stringValue: hw.machineName || boundMachineName || 'Computador Pessoal' },
            lastClientVersion: { stringValue: '1.0.0' }
          }
        }

        fetch(heartbeatUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(heartbeatBody),
          signal: AbortSignal.timeout(8000)
        }).catch((err) => console.warn('[LicenseManager] Falha ao registrar heartbeat:', err.message))

        configStore.updateConfig({
          licenseKey: cleanKey,
          licenseStatus: 'active',
          licenseClientName: clientName,
          licenseClientEmail: clientEmail,
          licenseMachineId: hw.machineId,
          licenseActivatedAt: fields.activatedAt || now,
          licenseLastCheckedAt: now
        })

        console.log(`[LicenseManager] Licença ativa e autorizada nesta máquina (${clientName}).`)
        return {
          valid: true,
          status: 'ACTIVE',
          message: 'Licença ativa e autorizada nesta máquina.',
          client: { name: clientName, email: clientEmail },
          machineId: hw.machineId,
          lastSeenAt: now
        }
      }

      // 6. CASO C: Máquina Diferente -> Bloqueio estrito (Node-Locking)
      configStore.updateConfig({ licenseStatus: 'disabled' })
      console.warn(`[LicenseManager] [NODE-LOCKING] Tentativa de uso em máquina diferente. Vinculada a "${boundMachineName}".`)
      return {
        valid: false,
        error: 'MACHINE_MISMATCH',
        message: `Esta licença é exclusiva e já está vinculada a outro computador ("${boundMachineName || 'Dispositivo Anterior'}"). Para transferir o acesso, solicite a liberação ao administrador.`
      }

    } catch (err: any) {
      console.warn('[LicenseManager] Erro de comunicação com o Firestore:', err.message)
      return {
        valid: false,
        error: 'NETWORK_ERROR',
        message: 'Não foi possível comunicar com o banco de dados do Jasper. Verifique sua conexão com a internet.'
      }
    }
  }

  /**
   * Verifica a licença atualmente salva no computador (Boot ou Check Periódico)
   */
  public async verifyCurrentLicense(): Promise<LicenseValidationResult> {
    const cfg = configStore.getConfig()
    const hw = getHardwareInfo()

    if (!cfg.licenseKey) {
      return {
        valid: false,
        error: 'NO_LICENSE',
        message: 'Nenhuma chave de licença ativa configurada nesta estação.'
      }
    }

    // Se a máquina salva localmente não bater com o hardware físico atual (ex: clonagem de disco/config)
    if (cfg.licenseMachineId && cfg.licenseMachineId !== hw.machineId) {
      configStore.updateConfig({ licenseStatus: 'disabled' })
      return {
        valid: false,
        error: 'MACHINE_MISMATCH',
        message: 'O hardware atual não corresponde à máquina originalmente vinculada a esta licença.'
      }
    }

    const result = await this.activateLicense(cfg.licenseKey)

    // Tolerância offline máxima de 24 horas: se o servidor estiver temporariamente inacessível
    // e a estação foi ativada/verificada com sucesso dentro das últimas 24 horas, permite acesso
    if (!result.valid && (result.error === 'NETWORK_ERROR' || result.error === 'SERVER_ERROR')) {
      if (cfg.licenseStatus === 'active' && cfg.licenseLastCheckedAt) {
        const diffMs = Date.now() - new Date(cfg.licenseLastCheckedAt).getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours <= 24) {
          console.log('[LicenseManager] Modo offline temporário autorizado (dentro da janela de 24h).')
          return {
            valid: true,
            status: 'ACTIVE',
            message: 'Licença válida em modo offline temporário (janela de 24h).'
          }
        } else {
          console.warn('[LicenseManager] Limite de 24 horas sem conexão atingido. Acesso suspenso.')
          configStore.updateConfig({ licenseStatus: 'disabled' })
          const expiredResult: LicenseValidationResult = {
            valid: false,
            error: 'EXPIRED_24H',
            message: 'É necessária a verificação de acesso a cada 24 horas. Conecte-se à internet para continuar usando o Jasper.'
          }
          this.notifyRevoked(expiredResult)
          return expiredResult
        }
      }
    }

    // Se o resultado for inválido (revogada, suspensa ou mismatch), notifica os listeners
    if (!result.valid) {
      this.notifyRevoked(result)
    }

    return result
  }

  private revocationListeners: Array<(result: LicenseValidationResult) => void> = []

  public onRevoked(listener: (result: LicenseValidationResult) => void): () => void {
    this.revocationListeners.push(listener)
    return () => {
      this.revocationListeners = this.revocationListeners.filter((l) => l !== listener)
    }
  }

  public notifyRevoked(result: LicenseValidationResult): void {
    for (const listener of this.revocationListeners) {
      try {
        listener(result)
      } catch (err) {
        console.error('[LicenseManager] Erro no listener de revogação:', err)
      }
    }
  }

  /**
   * Executa a checagem periódica de 24 horas com o Firestore.
   * Se a chave foi revogada, desativada ou se a máquina não confere, bloqueia imediatamente.
   */
  public async checkAccess24h(force = false): Promise<LicenseValidationResult> {
    const cfg = configStore.getConfig()
    if (!cfg.licenseKey) {
      const res: LicenseValidationResult = {
        valid: false,
        error: 'NO_LICENSE',
        message: 'Nenhuma chave de licença ativa configurada nesta estação.'
      }
      this.notifyRevoked(res)
      return res
    }

    if (!force && cfg.licenseLastCheckedAt) {
      const diffMs = Date.now() - new Date(cfg.licenseLastCheckedAt).getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours < 24 && cfg.licenseStatus === 'active') {
        return {
          valid: true,
          status: 'ACTIVE',
          message: 'Licença verificada recentemente (menos de 24 horas).'
        }
      }
    }

    console.log('[LicenseManager] Executando verificação de acesso das 24 horas com o Firestore...')
    return this.verifyCurrentLicense()
  }

  /**
   * Retorna resumo público da licença para a UI
   */
  public getLicenseInfo(): LicenseInfo {
    const cfg = configStore.getConfig()
    const hw = getHardwareInfo()

    const isLicensed = Boolean(cfg.licenseKey && cfg.licenseStatus === 'active')
    const keyMasked = cfg.licenseKey
      ? `${cfg.licenseKey.slice(0, 10)}...${cfg.licenseKey.slice(-4)}`
      : undefined

    return {
      isLicensed,
      status: cfg.licenseStatus || 'unlicensed',
      keyMasked,
      clientName: cfg.licenseClientName,
      clientEmail: cfg.licenseClientEmail,
      machineId: cfg.licenseMachineId,
      currentHwid: hw.machineId,
      activatedAt: cfg.licenseActivatedAt,
      lastSeenAt: cfg.licenseLastCheckedAt
    }
  }
}

export const licenseManager = new LicenseManager()
