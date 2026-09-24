import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import type { ScheduledTask, AutonomyNotification } from '@shared'
import { atomicWriteJsonSync, readJsonFileSync } from '../utils/atomic-json'

const COMPLETED_TASK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

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
        const parsed = readJsonFileSync<ScheduledTask[]>(p)
        const cutoff = Date.now() - COMPLETED_TASK_RETENTION_MS
        this.tasks = Array.isArray(parsed)
          ? parsed.filter((task) => !task.completed || task.dueTimestamp >= cutoff)
          : []
        if (this.tasks.length !== parsed.length) this.saveTasks()
      }
    } catch (err) {
      console.warn('[CronEngine] Error reading schedules:', err)
      this.tasks = []
    }
  }

  private saveTasks(): void {
    try {
      const p = this.getFilePath()
      atomicWriteJsonSync(p, this.tasks)
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
      id: `task-${randomUUID()}`,
      title,
      description,
      dueTimestamp,
      recurrence,
      completed: false,
      createdAt: Date.now()
    }
    this.tasks.push(task)
    this.saveTasks()
    console.log('[CronEngine] Task scheduled.')
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
          title: 'Lembrete Agendado',
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

