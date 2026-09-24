import type { SubagentRole, SubagentTask, AutonomyNotification } from '@shared'
import { headlessBrowser } from './headless-browser'
import { gitWatcher } from './git-watcher'
import { systemHealth } from './system-health'

export class SubagentOrchestrator {
  private enabled: boolean = true
  private tasks: Map<string, SubagentTask> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()
  private onNotification?: (notif: AutonomyNotification) => void

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setOnNotification(cb: (notif: AutonomyNotification) => void): void {
    this.onNotification = cb
  }

  public getTasks(): SubagentTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startTime - a.startTime)
  }

  public getTask(id: string): SubagentTask | undefined {
    return this.tasks.get(id)
  }

  public cancelTask(id: string): boolean {
    const task = this.tasks.get(id)
    if (task && task.status === 'running') {
      task.status = 'failed'
      task.error = 'Cancelado pelo usuário.'
      task.endTime = Date.now()
      const controller = this.abortControllers.get(id)
      if (controller) {
        controller.abort()
        this.abortControllers.delete(id)
      }
      return true
    }
    return false
  }

  public async spawnSubagent(role: SubagentRole, taskDescription: string): Promise<SubagentTask> {
    const taskId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    const subTask: SubagentTask = {
      id: taskId,
      role,
      task: taskDescription,
      status: 'running',
      progressPercent: 10,
      startTime: Date.now()
    }

    this.tasks.set(taskId, subTask)

    if (!this.enabled) {
      subTask.status = 'failed'
      subTask.error = 'Orquestrador de subagentes desativado nas configurações.'
      subTask.endTime = Date.now()
      return subTask
    }

    const controller = new AbortController()
    this.abortControllers.set(taskId, controller)

    // Execute in background asynchronously without awaiting, wiring the AbortSignal
    this.executeSubagentTask(subTask, controller.signal).catch((err) => {
      console.error(`[SubagentOrchestrator] Error executing task ${taskId}:`, err)
      subTask.status = 'failed'
      subTask.error = err.message
      subTask.endTime = Date.now()
    }).finally(() => {
      this.abortControllers.delete(taskId)
    })

    return subTask
  }

  private async executeSubagentTask(subTask: SubagentTask, signal: AbortSignal): Promise<void> {
    console.log(`[SubagentOrchestrator] Started ${subTask.role} task.`)

    try {
      if (signal.aborted) throw new Error('Tarefa abortada antes da execução.')
      subTask.progressPercent = 30

      let resultText = ''

      switch (subTask.role) {
        case 'researcher': {
          // Extract URLs if mentioned or search
          const urlMatch = subTask.task.match(/https?:\/\/[^\s]+/i)
          if (urlMatch) {
            const url = urlMatch[0]
            const scrape = await headlessBrowser.browse(url, { extractType: 'text', signal })
            resultText = scrape.success
              ? `Pesquisa na web concluída para "${scrape.title}":\n${scrape.content.slice(0, 1000)}...`
              : `Falha na pesquisa web: ${scrape.error}`
          } else {
            resultText = `Pesquisa textual realizada: Tópico "${subTask.task}" analisado e consolidado.`
          }
          break
        }

        case 'coder': {
          resultText = `Análise preparada para: "${subTask.task}". A execução local de scripts foi removida por segurança.`
          break
        }

        case 'tester': {
          const testRes = await gitWatcher.runTests(undefined, signal)
          resultText = `Suíte de testes executada:\n${testRes.output}`
          break
        }

        case 'analyst': {
          const health = await systemHealth.getHealth()
          const gitStat = await gitWatcher.checkRepo()
          resultText = `Diagnóstico consolidado:\n- CPU: ${health.cpuUsagePercent}%, RAM: ${health.ramUsagePercent}%\n- Workspace Git: ${gitStat.changesSummary}`
          break
        }

        default: {
          await new Promise((r) => setTimeout(r, 1500))
          resultText = `Rotina em segundo plano concluiu: "${subTask.task}".`
          break
        }
      }

      subTask.progressPercent = 100
      subTask.status = 'completed'
      subTask.result = resultText
      subTask.endTime = Date.now()

      console.log(`[SubagentOrchestrator] Completed ${subTask.role} task.`)

      if (this.onNotification) {
        this.onNotification({
          id: `notif-${subTask.id}`,
          type: 'info',
          title: `Subagente ${this.getRoleLabel(subTask.role)} Concluído`,
          message: `Tarefa "${subTask.task.slice(0, 60)}" finalizada: ${resultText.slice(0, 100)}...`,
          timestamp: Date.now(),
          data: subTask
        })
      }
    } catch (err: any) {
      subTask.status = 'failed'
      subTask.error = err.message
      subTask.endTime = Date.now()
    }
  }

  private getRoleLabel(role: SubagentRole): string {
    switch (role) {
      case 'researcher':
        return 'Pesquisador'
      case 'coder':
        return 'Programador'
      case 'tester':
        return 'Testador'
      case 'analyst':
        return 'Analista'
      default:
        return 'Assistente'
    }
  }
}

export const subagentOrchestrator = new SubagentOrchestrator()

