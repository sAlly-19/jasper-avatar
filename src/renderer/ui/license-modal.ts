import { showHudToast } from './toast'
import { updateStatusBadge } from './status-badge'
import type { LicenseInfo } from '@shared'

export class LicenseModal {
  private modalEl: HTMLElement | null = null
  private inputKeyEl: HTMLInputElement | null = null
  private btnActivateEl: HTMLButtonElement | null = null
  private btnCopyHwidEl: HTMLButtonElement | null = null
  private hwidTextEl: HTMLElement | null = null
  private feedbackEl: HTMLElement | null = null
  private btnCloseEl: HTMLElement | null = null
  private isMandatory = false
  private currentHwid = ''

  public init(): void {
    this.modalEl = document.getElementById('modal-license-activation')
    this.inputKeyEl = document.getElementById('input-license-key') as HTMLInputElement | null
    this.btnActivateEl = document.getElementById('btn-activate-license') as HTMLButtonElement | null
    this.btnCopyHwidEl = document.getElementById('btn-copy-hwid') as HTMLButtonElement | null
    this.hwidTextEl = document.getElementById('license-hwid-display')
    this.feedbackEl = document.getElementById('license-feedback-message')
    this.btnCloseEl = document.getElementById('btn-close-license-modal')

    if (!this.modalEl) return

    // Preenche o HWID da máquina
    window.electronAPI.getHwid().then((hw) => {
      this.currentHwid = hw.machineId
      if (this.hwidTextEl) {
        this.hwidTextEl.textContent = hw.machineId
      }
    }).catch(() => {})

    // Formatação automática da chave (JASPER-LT-XXXX-XXXX-XXXX)
    this.inputKeyEl?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      let val = target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
      target.value = val
    })

    // Botão de copiar HWID
    this.btnCopyHwidEl?.addEventListener('click', () => {
      if (this.currentHwid) {
        navigator.clipboard.writeText(this.currentHwid)
        showHudToast('Hardware ID', 'Hardware ID copiado com sucesso!', 'info', 3000)
      }
    })

    // Botão de ativar
    this.btnActivateEl?.addEventListener('click', () => {
      this.handleActivate()
    })

    // Submissão com Enter no input
    this.inputKeyEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.handleActivate()
      }
    })

    // Fechar modal (apenas se não for obrigatório)
    this.btnCloseEl?.addEventListener('click', () => {
      if (!this.isMandatory) {
        this.hide()
      }
    })
  }

  private async handleActivate(): Promise<void> {
    const rawKey = this.inputKeyEl?.value.trim().toUpperCase() || ''

    if (!rawKey) {
      this.showFeedback('Informe sua chave de licença vitalícia.', 'error')
      return
    }

    if (this.btnActivateEl) {
      this.btnActivateEl.disabled = true
      this.btnActivateEl.textContent = 'VALIDANDO LICENÇA...'
    }

    this.showFeedback('Conectando ao servidor seguro de autenticação...', 'info')

    try {
      const result = await window.electronAPI.activateLicense(rawKey)

      if (result.valid) {
        this.showFeedback(result.message || 'Licença ativada com sucesso nesta máquina!', 'success')
        showHudToast('Licença Ativada', 'Estação Jasper Desbloqueada com Sucesso!', 'info', 5000)
        updateStatusBadge('online', 'Jasper Pronto')

        setTimeout(() => {
          this.hide()
          // Tenta conectar ao Gemini se configurado
          window.electronAPI.connectGemini().catch(() => {})
        }, 1200)
      } else {
        this.showFeedback(result.message || 'Falha ao ativar licença.', 'error')
      }
    } catch (err: any) {
      this.showFeedback('Erro de rede: Não foi possível conectar ao servidor de validação.', 'error')
    } finally {
      if (this.btnActivateEl) {
        this.btnActivateEl.disabled = false
        this.btnActivateEl.textContent = 'ATIVAR LICENÇA'
      }
    }
  }

  private showFeedback(msg: string, type: 'error' | 'success' | 'info'): void {
    if (!this.feedbackEl) return
    this.feedbackEl.textContent = msg
    this.feedbackEl.className = `license-feedback ${type}`
    this.feedbackEl.style.display = 'block'
  }

  public show(mandatory = false): void {
    this.isMandatory = mandatory
    if (!this.modalEl) return

    if (this.btnCloseEl) {
      this.btnCloseEl.style.display = mandatory ? 'none' : 'block'
    }

    this.modalEl.classList.remove('hidden')
    this.modalEl.style.display = 'flex'
    this.inputKeyEl?.focus()
  }

  public hide(): void {
    if (!this.modalEl) return
    this.modalEl.classList.add('hidden')
    this.modalEl.style.display = 'none'
  }

  /**
   * Verifica o status da licença na inicialização do aplicativo
   */
  public async checkOnStartup(): Promise<LicenseInfo> {
    try {
      const info = await window.electronAPI.getLicenseStatus()

      if (!info.isLicensed) {
        console.warn('[LicenseModal] Estação sem licença ativa. Exibindo modal de ativação.')
        updateStatusBadge('error', 'Licença Pendente')
        this.show(true)
      } else {
        console.log(`[LicenseModal] Estação licenciada para ${info.clientName || 'Cliente'}.`)
      }

      return info
    } catch {
      return {
        isLicensed: false,
        status: 'unlicensed',
        currentHwid: ''
      }
    }
  }
}

export const licenseModal = new LicenseModal()
