import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import type { ScheduledTask, AutonomyNotification } from '@shared'

export class CronEngineService {
  private isEnabled: boolean = true
  private timer: NodeJS.Timeout | null = null
  private tasks: ScheduledTask[] = []
  private onTaskTriggered?: (notification: AutonomyNotification) => void

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
    this.loadTasks()
  }

  private getFilePath(): string {
    return join(app.getPath('userData'), 'jasper-schedules.json')
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      this.start()
    } else {
      this.stop()
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  public setOnTaskTriggered(cb: (notification: AutonomyNotification) => void): void {
    this.onTaskTriggered = cb
  }

  private loadTasks(): void {
    try {
      const p = this.getFilePath()
      if (fs.existsSync(p)) {
        this.tasks = JSON.parse(fs.readFileSync(p, 'utf-8'))
      }
    } catch (err) {
      console.warn('[CronEngine] Error reading schedules:', err)
      this.tasks = []
    }
  }

  private saveTasks(): void {
    try {
      const p = this.getFilePath()
      fs.writeFileSync(p, JSON.stringify(this.tasks, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[CronEngine] Error saving schedules:', err)
    }
  }

  public start(): void {
    if (this.timer) return
    this.check()
    this.timer = setInterval(() => this.check(), 10000)
    console.log('[CronEngine] Service started (checking every 10s)')
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[CronEngine] Service stopped')
    }
  }

  public addTask(title: string, minutesFromNow: number, recurrence: 'once' | 'daily' | 'hourly' = 'once', description?: string): ScheduledTask {
    const dueTimestamp = Date.now() + Math.max(1, minutesFromNow) * 60 * 1000
    const task: ScheduledTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      description,
      dueTimestamp,
      recurrence,
      completed: false,
      createdAt: Date.now()
    }
    this.tasks.push(task)
    this.saveTasks()
    console.log(`[CronEngine] Scheduled task '${title}' for ${new Date(dueTimestamp).toLocaleTimeString()}`)
    return task
  }

  public getTasks(): ScheduledTask[] {
    return [...this.tasks]
  }

  public removeTask(id: string): boolean {
    const prevLen = this.tasks.length
    this.tasks = this.tasks.filter((t) => t.id !== id)
    if (this.tasks.length !== prevLen) {
      this.saveTasks()
      return true
    }
    return false
  }

  public clearCompleted(): void {
    this.tasks = this.tasks.filter((t) => !t.completed)
    this.saveTasks()
  }

  private check(): void {
    if (!this.isEnabled) return

    const now = Date.now()
    let changed = false

    for (const task of this.tasks) {
      if (!task.completed && task.dueTimestamp <= now) {
        // Trigger notification
        const notification: AutonomyNotification = {
          id: `reminder-${task.id}`,
          type: 'reminder',
          title: '⏰ Lembrete Agendado',
          message: task.title + (task.description ? `: ${task.description}` : ''),
          timestamp: now,
          data: { task }
        }
        this.onTaskTriggered?.(notification)

        if (task.recurrence === 'daily') {
          while (task.dueTimestamp <= now) {
            task.dueTimestamp += 24 * 60 * 60 * 1000
          }
        } else if (task.recurrence === 'hourly') {
          while (task.dueTimestamp <= now) {
            task.dueTimestamp += 60 * 60 * 1000
          }
        } else {
          task.completed = true
        }
        changed = true
      }
    }

    if (changed) {
      this.saveTasks()
    }
  }
}

export const cronEngine = new CronEngineService()

