import { execFile } from 'child_process'
import { resolvePowerShellScript } from './script-path'
import { securityBroker } from '../services/security-broker'

export class MediaControllerService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private getScriptPath(): string {
    return resolvePowerShellScript('media-control.ps1')
  }

  private async executeAction(action: string, value: number = 0): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath()
      execFile(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', action, '-Value', String(value)],
        { timeout: 4000, windowsHide: true },
        (error, stdout) => {
          if (error) {
            return resolve({ success: false, message: `Erro ao controlar mídia (${action}): ${error.message}` })
          }
          const out = (stdout || '').trim()
          resolve({ success: true, message: out })
        }
      )
    })
  }

  public async volumeUp(percentDelta: number = 10): Promise<{ success: boolean; message: string }> {
    const steps = Math.max(1, Math.round(percentDelta / 2))
    const res = await this.executeAction('volume-up', steps)
    return { success: res.success, message: `Volume aumentado em aproximadamente ${percentDelta}%.` }
  }

  public async volumeDown(percentDelta: number = 10): Promise<{ success: boolean; message: string }> {
    const steps = Math.max(1, Math.round(percentDelta / 2))
    const res = await this.executeAction('volume-down', steps)
    return { success: res.success, message: `Volume diminuído em aproximadamente ${percentDelta}%.` }
  }

  public async toggleMute(): Promise<{ success: boolean; message: string }> {
    const res = await this.executeAction('mute')
    return { success: res.success, message: 'Estado de áudio/mudo alternado com sucesso.' }
  }

  public async playPause(): Promise<{ success: boolean; message: string }> {
    const res = await this.executeAction('play-pause')
    return { success: res.success, message: 'Comando de reprodução/pausa executado.' }
  }

  public async nextTrack(): Promise<{ success: boolean; message: string }> {
    const res = await this.executeAction('next')
    return { success: res.success, message: 'Avançado para a próxima faixa.' }
  }

  public async previousTrack(): Promise<{ success: boolean; message: string }> {
    const res = await this.executeAction('prev')
    return { success: res.success, message: 'Retornado para a faixa anterior.' }
  }

  public async stop(): Promise<{ success: boolean; message: string }> {
    const res = await this.executeAction('stop')
    return { success: res.success, message: 'Reprodução de mídia interrompida.' }
  }

  public async executeCommand(command: string, value?: number): Promise<string> {
    const cmd = command.toLowerCase().trim()
    const approved = await securityBroker.confirmOperation({
      title: 'Controlar mídia',
      message: 'O Jasper quer alterar a reprodução ou o volume do computador.',
      detail: `Comando solicitado: ${cmd}${value === undefined ? '' : ` (${value})`}.`,
      confirmLabel: 'Executar',
      risk: 'common'
    })
    if (!approved) return 'Comando de mídia cancelado pelo usuário.'

    switch (cmd) {
      case 'volume_up':
      case 'aumentar_volume':
        return (await this.volumeUp(value || 10)).message

      case 'volume_down':
      case 'abaixar_volume':
      case 'diminuir_volume':
        return (await this.volumeDown(value || 10)).message

      case 'mute':
      case 'mutar':
      case 'desmutar':
        return (await this.toggleMute()).message

      case 'play_pause':
      case 'play':
      case 'pause':
      case 'pausar':
      case 'tocar':
        return (await this.playPause()).message

      case 'next':
      case 'proxima':
      case 'avancar':
        return (await this.nextTrack()).message

      case 'prev':
      case 'previous':
      case 'anterior':
      case 'voltar':
        return (await this.previousTrack()).message

      case 'stop':
      case 'parar':
        return (await this.stop()).message

      default:
        return `Comando de mídia desconhecido: "${command}". Comandos disponíveis: volume_up, volume_down, mute, play_pause, next, prev, stop.`
    }
  }
}

export const mediaController = new MediaControllerService()

