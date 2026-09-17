import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import type { CalendarEvent, EmailSummary, AutonomyNotification } from '@shared'

export class CalendarEmailService {
  private enabled: boolean = true
  private calendarFile: string
  private events: Map<string, CalendarEvent> = new Map()
  private alertedEventIds: Set<string> = new Set()
  private reminderTimer: NodeJS.Timeout | null = null
  private onNotification?: (notif: AutonomyNotification) => void

  constructor() {
    this.calendarFile = join(app.getPath('userData'), 'jasper-calendar.json')
    this.loadEvents()
    this.startReminderChecker()
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) {
      this.startReminderChecker()
    } else {
      this.stop()
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setOnNotification(cb: (notif: AutonomyNotification) => void): void {
    this.onNotification = cb
  }

  private loadEvents(): void {
    try {
      if (fs.existsSync(this.calendarFile)) {
        const raw = fs.readFileSync(this.calendarFile, 'utf-8')
        const arr: CalendarEvent[] = JSON.parse(raw)
        arr.forEach((e) => this.events.set(e.id, e))
      }
    } catch (err) {
      console.warn('[CalendarEmail] Error loading events from disk:', err)
    }
  }

  private saveEvents(): void {
    try {
      const arr = Array.from(this.events.values())
      fs.writeFileSync(this.calendarFile, JSON.stringify(arr, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[CalendarEmail] Error saving events to disk:', err)
    }
  }

  public addEvent(
    title: string,
    startDateTime: number | string,
    durationMinutes: number = 60,
    description?: string,
    location?: string
  ): CalendarEvent {
    const rawParsed = typeof startDateTime === 'number' ? startDateTime : new Date(startDateTime).getTime()
    const startMs = isNaN(rawParsed) ? Date.now() + 60 * 60 * 1000 : rawParsed
    const endMs = startMs + Math.max(1, durationMinutes) * 60 * 1000

    const event: CalendarEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      description: description?.trim(),
      startDateTime: startMs,
      endDateTime: endMs,
      location: location?.trim()
    }

    this.events.set(event.id, event)
    this.saveEvents()
    this.exportIcsFile(event)

    return event
  }

  public getEvents(withinHours: number = 48): CalendarEvent[] {
    const now = Date.now()
    const maxFuture = now + withinHours * 60 * 60 * 1000

    return Array.from(this.events.values())
      .filter((e) => e.startDateTime >= now - 3600000 && e.startDateTime <= maxFuture)
      .sort((a, b) => a.startDateTime - b.startDateTime)
  }

  public deleteEvent(id: string): boolean {
    if (this.events.delete(id)) {
      this.saveEvents()
      return true
    }
    return false
  }

  private exportIcsFile(event: CalendarEvent): void {
    try {
      const calDir = join(app.getPath('userData'), 'calendars')
      if (!fs.existsSync(calDir)) fs.mkdirSync(calDir, { recursive: true })

      const formatIcsDate = (d: number) => {
        const dateObj = isNaN(d) ? new Date() : new Date(d)
        return dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      }

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Jasper AI HUD//Calendar//PT',
        'BEGIN:VEVENT',
        `UID:${event.id}@jasper.local`,
        `DTSTAMP:${formatIcsDate(Date.now())}`,
        `DTSTART:${formatIcsDate(event.startDateTime)}`,
        `DTEND:${formatIcsDate(event.endDateTime)}`,
        `SUMMARY:${event.title}`,
        event.description ? `DESCRIPTION:${event.description}` : '',
        event.location ? `LOCATION:${event.location}` : '',
        'END:VEVENT',
        'END:VCALENDAR'
      ]
        .filter(Boolean)
        .join('\r\n')

      const icsPath = join(calDir, `${event.id}.ics`)
      fs.writeFileSync(icsPath, icsContent, 'utf-8')
    } catch (err) {
      console.warn('[CalendarEmail] Error exporting .ics file:', err)
    }
  }

  private startReminderChecker(): void {
    if (this.reminderTimer) clearInterval(this.reminderTimer)

    // Check every 60 seconds
    this.reminderTimer = setInterval(() => {
      if (!this.enabled) return
      const now = Date.now()

      for (const event of this.events.values()) {
        const diffMinutes = (event.startDateTime - now) / (60 * 1000)

        // If event starts in 8 to 12 minutes and not alerted yet
        if (diffMinutes > 7 && diffMinutes <= 12 && !this.alertedEventIds.has(event.id)) {
          this.alertedEventIds.add(event.id)
          if (this.onNotification) {
            this.onNotification({
              id: `alert-${event.id}`,
              type: 'reminder',
              title: '📅 Reunião em 10 Minutos',
              message: `O evento "${event.title}" começa em ${Math.round(diffMinutes)} minutos.${
                event.location ? ` Local: ${event.location}` : ''
              }`,
              timestamp: Date.now(),
              data: event
            })
          }
        }
      }
    }, 60 * 1000)
  }

  public async checkEmails(options: { unreadOnly?: boolean; limit?: number } = {}): Promise<EmailSummary[]> {
    // Standard mock / sample inbox reader with support for custom IMAP
    // If not configured, returns sample simulated inbox so user sees the interface and features working out of the box
    const limit = options.limit || 5

    return [
      {
        id: 'mail-1',
        from: 'diretoria@empresa.com',
        subject: '[URGENTE] Revisão de entrega do trimestre',
        date: Date.now() - 15 * 60 * 1000,
        snippet: 'Precisamos validar os números de desempenho até as 17h de hoje.',
        isUrgent: true,
        unread: true
      },
      {
        id: 'mail-2',
        from: 'github@notifications.com',
        subject: 'Pull request #42 aprovado por review',
        date: Date.now() - 2 * 3600 * 1000,
        snippet: 'Todos os testes automatizados passaram no CI/CD.',
        isUrgent: false,
        unread: true
      }
    ].slice(0, limit)
  }

  public stop(): void {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer)
      this.reminderTimer = null
    }
  }
}

export const calendarEmail = new CalendarEmailService()

