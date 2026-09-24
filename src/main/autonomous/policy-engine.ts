import path from 'path'
import { isPrivateOrLoopbackHost } from './webhook-manager'

export interface PolicyCheckResult {
  allowed: boolean
  riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  reason?: string
  requiresConfirmation?: boolean
}

const SYSTEM_PATH_BLACKLIST = [
  /[/\\]windows([/\\]|$)/i,
  /[/\\]system32([/\\]|$)/i,
  /[/\\]syswow64([/\\]|$)/i,
  /[/\\]program files([/\\]|$)/i,
  /[/\\]program files \(x86\)([/\\]|$)/i,
  /[/\\]appdata[/\\]local[/\\]microsoft([/\\]|$)/i
]

const SAFE_SMART_HOME_DOMAINS = new Set(['light', 'switch', 'climate'])

export class ToolPolicyEngine {
  /**
   * Validates if a file or directory path is safe and contained.
   */
  public validatePathContainment(targetPath: string, allowedBaseDir?: string): PolicyCheckResult {
    const normalized = path.resolve(targetPath)

    for (const sysPattern of SYSTEM_PATH_BLACKLIST) {
      if (sysPattern.test(normalized)) {
        return {
          allowed: false,
          riskLevel: 'CRITICAL',
          reason: `Acesso à pasta protegida do sistema operacional ("${normalized}") é estritamente proibido.`
        }
      }
    }

    if (allowedBaseDir) {
      const normalizedBase = path.resolve(allowedBaseDir)
      const relative = path.relative(normalizedBase, normalized)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Caminho fora do diretório delimitado ("${normalizedBase}"). Tentativa de traversal bloqueada.`
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'SAFE'
    }
  }

  /**
   * Validates Git operations.
   */
  public validateGitCommit(message: string, specificFiles?: string[]): PolicyCheckResult {
    const lower = message.toLowerCase()
    if (lower.includes('--force') || lower.includes('-f') || lower.includes('--amend')) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: 'Operações de commit destrutivo (--force, --amend) são bloqueadas pelo Policy Engine.',
        requiresConfirmation: true
      }
    }

    if (specificFiles && specificFiles.length > 0) {
      for (const file of specificFiles) {
        if (file.includes('..') || path.isAbsolute(file)) {
          return {
            allowed: false,
            riskLevel: 'HIGH',
            reason: `Arquivo inválido ou com escape de repositório: "${file}".`
          }
        }
        if (file.includes('.env') || file.includes('credentials') || file.includes('id_rsa')) {
          return {
            allowed: false,
            riskLevel: 'CRITICAL',
            reason: `Tentativa de comitar arquivo sensível ou credencial detectada: "${file}".`,
            requiresConfirmation: true
          }
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'MODERATE',
      requiresConfirmation: !specificFiles || specificFiles.length === 0
    }
  }

  /**
   * Validates Smart Home domain and service call.
   */
  public validateSmartHomeDomain(domain: string): PolicyCheckResult {
    const d = domain.toLowerCase().trim()
    if (!SAFE_SMART_HOME_DOMAINS.has(d)) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: `Domínio de automação "${d}" não está na allowlist segura. Acesso a trancas, alarmes e portões é bloqueado.`
      }
    }
    return {
      allowed: true,
      riskLevel: 'SAFE'
    }
  }

  /**
   * Validates URL for Headless Browser (preventing intranet scanning/SSRF).
   */
  public validateBrowserUrl(targetUrl: string): PolicyCheckResult {
    try {
      const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Protocolo "${parsed.protocol}" não suportado para navegação web.`
        }
      }
      if (isPrivateOrLoopbackHost(parsed.hostname)) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Acesso a endereços locais ou privados (${parsed.hostname}) pelo Headless Browser é bloqueado para prevenir SSRF interno.`
        }
      }
      return {
        allowed: true,
        riskLevel: 'SAFE'
      }
    } catch {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: `URL inválida para navegação: "${targetUrl}".`
      }
    }
  }
}

export const toolPolicyEngine = new ToolPolicyEngine()

