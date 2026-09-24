import type { ReflexionCheckResult, RiskLevel, AutonomyNotification } from '@shared'
import { randomUUID } from 'node:crypto'

const CONFIRMATION_TTL_MS = 2 * 60 * 1000

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    )
  }
  return value
}

export class ReflexionEngine {
  private enabled: boolean = true
  private onNotification?: (notif: AutonomyNotification) => void
  private pendingConfirmations: Map<string, { toolName: string; args: Record<string, unknown>; expiresAt: number }> = new Map()
  private authorizedActions: Map<string, number> = new Map()

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setOnNotification(cb: (notif: AutonomyNotification) => void): void {
    this.onNotification = cb
  }

  private getActionSignature(toolName: string, args: Record<string, any>): string {
    return `${toolName}:${JSON.stringify(canonicalize(args || {}))}`
  }

  public preExecutionCheck(toolName: string, args: Record<string, any>): ReflexionCheckResult {
    if (!this.enabled) {
      return {
        allowed: true,
        riskLevel: 'SAFE',
        requiresConfirmation: false
      }
    }

    const safeArgs = args || {}
    const sig = this.getActionSignature(toolName, safeArgs)

    // If already authorized by user via confirmation modal/toast
    const authorizationExpiry = this.authorizedActions.get(sig)
    if (authorizationExpiry && authorizationExpiry > Date.now()) {
      this.authorizedActions.delete(sig)
      return {
        allowed: true,
        riskLevel: 'MODERATE',
        requiresConfirmation: false
      }
    }

    // Git Commit Check
    if (toolName === 'git_commit_changes') {
      const msg = String(safeArgs.message || '')
      const specificFiles = Array.isArray(safeArgs.files) ? safeArgs.files : []
      const fileNotice = specificFiles.length > 0
        ? `Arquivos a serem comitados: ${specificFiles.join(', ')}`
        : 'Todos os arquivos rastreados modificados'

      const confirmationId = randomUUID()
      const immutableArgs = structuredClone(canonicalize(safeArgs)) as Record<string, unknown>
      this.pendingConfirmations.set(confirmationId, {
        toolName,
        args: immutableArgs,
        expiresAt: Date.now() + CONFIRMATION_TTL_MS
      })

      const reason = `Operação de commit Git solicitada ("${msg}"). Alvo: ${fileNotice}.`

      if (this.onNotification) {
        this.onNotification({
          id: confirmationId,
          type: 'info',
          title: 'Git Watcher: Confirmação de Commit',
          message: `${reason} Confirme a gravação das alterações.`,
          timestamp: Date.now(),
          data: { confirmationId }
        })
      }

      return {
        allowed: false,
        riskLevel: 'MODERATE',
        reason,
        requiresConfirmation: true
      }
    }

    // 3. Folder Organization Check
    if (toolName === 'organize_directory') {
      const target = String(safeArgs.target || '').toLowerCase()
      if (target.includes('system32') || target.includes('windows') || target.includes('program files')) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: 'Organização em pastas de sistema do Windows é estritamente proibida.',
          requiresConfirmation: false
        }
      }
    }

    // 4. Webhook dispatch check
    if (toolName === 'trigger_webhook') {
      const url = String(safeArgs.webhookNameOrUrl || '')
      if (!/^https?:\/\//i.test(url) && !url.includes('-') && !url.includes('_')) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Destino de webhook inválido: "${url}". Deve ser uma URL HTTP válida ou nome de webhook cadastrado.`,
          requiresConfirmation: false
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'SAFE',
      requiresConfirmation: false
    }
  }

  public postExecutionCritique(toolName: string, output: string): { needsCorrection: boolean; critique?: string } {
    if (!this.enabled) return { needsCorrection: false }

    const lower = output.toLowerCase()
    if (
      lower.includes('syntaxerror') ||
      lower.includes('filenotfounderror') ||
      lower.includes('permission denied') ||
      lower.includes('tempo limite excedido')
    ) {
      return {
        needsCorrection: true,
        critique: `[Auto-Reflexão]: Falha detectada na ferramenta "${toolName}". Recomenda-se ajustar os parâmetros ou validar a sintaxe antes de responder ao usuário.`
      }
    }

    return { needsCorrection: false }
  }

  public confirmAction(confirmationId: string): boolean {
    const item = this.pendingConfirmations.get(confirmationId)
    if (!item) return false

    this.pendingConfirmations.delete(confirmationId)
    if (item.expiresAt <= Date.now()) return false

    const sig = this.getActionSignature(item.toolName, item.args)
    this.authorizedActions.set(sig, item.expiresAt)
    setTimeout(() => {
      if ((this.authorizedActions.get(sig) || 0) <= Date.now()) this.authorizedActions.delete(sig)
    }, CONFIRMATION_TTL_MS)
    console.log('[ReflexionEngine] User granted a one-time action authorization.')
    return true
  }
}

export const reflexionEngine = new ReflexionEngine()

