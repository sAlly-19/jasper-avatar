import type { ReflexionCheckResult, RiskLevel, AutonomyNotification } from '@shared'

const DANGEROUS_CODE_PATTERNS = [
  /rmdir\s+\/s/i,
  /rm\s+-rf/i,
  /shutil\.rmtree/i,
  /os\.remove/i,
  /os\.unlink/i,
  /drop\s+database/i,
  /drop\s+table/i,
  /format\s+[c-z]:/i,
  /while\s+True:\s*pass/i,
  /while\s*\(\s*true\s*\)\s*\{\s*\}/i,
  /process\.env\.(GOOGLE_API_KEY|GEMINI_API_KEY|PASSWORD|SECRET)/i,
  /os\.environ\[['"](GOOGLE_API_KEY|PASSWORD|SECRET)['"]\]/i
]

export class ReflexionEngine {
  private enabled: boolean = true
  private onNotification?: (notif: AutonomyNotification) => void
  private pendingConfirmations: Map<string, { toolName: string; args: any; timestamp: number }> = new Map()
  private authorizedActions: Set<string> = new Set()

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
    return `${toolName}:${JSON.stringify(args || {})}`
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
    if (this.authorizedActions.has(sig)) {
      this.authorizedActions.delete(sig)
      return {
        allowed: true,
        riskLevel: 'MODERATE',
        requiresConfirmation: false
      }
    }

    // 1. Code Execution Check
    if (toolName === 'execute_code') {
      const code = String(safeArgs.code || '')

      for (const pattern of DANGEROUS_CODE_PATTERNS) {
        if (pattern.test(code)) {
          const confirmationId = `conf-${Date.now()}`
          this.pendingConfirmations.set(confirmationId, { toolName, args: safeArgs, timestamp: Date.now() })

          const reason = `O código contém instruções potencialmente destrutivas ou de alto risco (${pattern.source}).`

          if (this.onNotification) {
            this.onNotification({
              id: confirmationId,
              type: 'warning',
              title: 'Auto-Reflexão: Bloqueio de Segurança',
              message: `${reason} Deseja autorizar a execução?`,
              timestamp: Date.now(),
              data: { confirmationId, toolName, args: safeArgs }
            })
          }

          return {
            allowed: false,
            riskLevel: 'HIGH',
            reason,
            requiresConfirmation: true
          }
        }
      }

      return {
        allowed: true,
        riskLevel: 'MODERATE',
        requiresConfirmation: false
      }
    }

    // 2. Git Commit Check
    if (toolName === 'git_commit_changes') {
      const msg = String(safeArgs.message || '')
      const specificFiles = Array.isArray(safeArgs.files) ? safeArgs.files : []
      const fileNotice = specificFiles.length > 0
        ? `Arquivos a serem comitados: ${specificFiles.join(', ')}`
        : 'Todos os arquivos rastreados modificados'

      const confirmationId = `conf-git-${Date.now()}`
      this.pendingConfirmations.set(confirmationId, { toolName, args: safeArgs, timestamp: Date.now() })

      const reason = `Operação de commit Git solicitada ("${msg}"). Alvo: ${fileNotice}.`

      if (this.onNotification) {
        this.onNotification({
          id: confirmationId,
          type: 'info',
          title: 'Git Watcher: Confirmação de Commit',
          message: `${reason} Confirme a gravação das alterações.`,
          timestamp: Date.now(),
          data: { confirmationId, toolName, args: safeArgs }
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
    if (item) {
      this.pendingConfirmations.delete(confirmationId)
      const sig = this.getActionSignature(item.toolName, item.args || {})
      this.authorizedActions.add(sig)
      // Auto-expire authorization after 2 minutes
      setTimeout(() => this.authorizedActions.delete(sig), 120000)
      console.log(`[ReflexionEngine] Action authorized by user: ${sig}`)
      return true
    }
    return false
  }
}

export const reflexionEngine = new ReflexionEngine()

