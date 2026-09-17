import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import tls from 'tls'
import { configStore } from '../config/config-store'
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
              title: 'Reunião em 10 Minutos',
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
    const limit = options.limit || 5
    const unreadOnly = options.unreadOnly ?? true

    // Retrieve configured IMAP settings from configStore
    const cfg = configStore.getConfig()
    if (!cfg.emailUser || !cfg.emailPassword || !cfg.emailImapHost) {
      return [
        {
          id: 'unconfigured-notice',
          from: 'sistema@jasper.ai',
          subject: '[REQUER CONFIGURAÇÃO] Servidor IMAP não configurado',
          date: Date.now(),
          snippet: 'Abra as configurações do Jasper e preencha o Host IMAP, Usuário e Senha de App para sincronizar seus e-mails reais.',
          isUrgent: false,
          unread: true
        }
      ]
    }

    try {
      return await this.fetchRealImapEmails(
        cfg.emailImapHost,
        cfg.emailImapPort || 993,
        cfg.emailUser,
        cfg.emailPassword,
        limit,
        unreadOnly
      )
    } catch (err: any) {
      console.warn('[CalendarEmail] Erro ao buscar e-mails via IMAP:', err.message)
      return [
        {
          id: 'error-notice',
          from: 'sistema@jasper.ai',
          subject: `[ERRO IMAP] Falha na conexão com ${cfg.emailImapHost}`,
          date: Date.now(),
          snippet: `Não foi possível conectar ao servidor IMAP: ${err.message}`,
          isUrgent: true,
          unread: true
        }
      ]
    }
  }

  private fetchRealImapEmails(
    host: string,
    port: number,
    user: string,
    pass: string,
    limit: number,
    unreadOnly: boolean
  ): Promise<EmailSummary[]> {
    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host,
          port: port || 993,
          servername: host,
          timeout: 15000,
          rejectUnauthorized: true
        },
        () => {
          console.log(`[CalendarEmail] Conexão TLS estabelecida com ${host}:${port}`)
        }
      )

      let state: 'GREETING' | 'LOGIN' | 'SELECT' | 'SEARCH' | 'FETCH' | 'LOGOUT' = 'GREETING'
      let buffer = ''
      let tagCounter = 1
      const nextTag = () => `A${(tagCounter++).toString().padStart(3, '0')}`
      let currentTag = ''
      const results: EmailSummary[] = []
      let emailIds: string[] = []

      const sendCmd = (cmd: string) => {
        currentTag = nextTag()
        socket.write(`${currentTag} ${cmd}\r\n`)
      }

      const finish = () => {
        try {
          socket.write(`A999 LOGOUT\r\n`)
        } catch {}
        try {
          socket.end()
        } catch {}
        resolve(results)
      }

      socket.on('data', (data) => {
        buffer += data.toString('utf-8')
        const lines = buffer.split('\r\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (state === 'GREETING' && line.startsWith('* OK')) {
            state = 'LOGIN'
            sendCmd(`LOGIN "${user.replace(/"/g, '\\"')}" "${pass.replace(/"/g, '\\"')}"`)
          } else if (state === 'LOGIN' && line.startsWith(`${currentTag} OK`)) {
            state = 'SELECT'
            sendCmd(`SELECT INBOX`)
          } else if (state === 'LOGIN' && line.startsWith(`${currentTag} NO`)) {
            console.warn('[CalendarEmail] Falha de autenticação IMAP:', line)
            finish()
          } else if (state === 'SELECT' && line.startsWith(`${currentTag} OK`)) {
            state = 'SEARCH'
            const searchCriteria = unreadOnly ? 'UNSEEN' : 'ALL'
            sendCmd(`SEARCH ${searchCriteria}`)
          } else if (state === 'SEARCH' && line.startsWith('* SEARCH')) {
            const parts = line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean)
            emailIds = parts.slice(-limit) // Get latest N emails
          } else if (state === 'SEARCH' && line.startsWith(`${currentTag} OK`)) {
            if (emailIds.length === 0) {
              finish()
              return
            }
            state = 'FETCH'
            const idSeq = emailIds.join(',')
            sendCmd(`FETCH ${idSeq} (BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)] FLAGS)`)
          } else if (state === 'FETCH') {
            if (line.startsWith(`${currentTag} OK`)) {
              finish()
              return
            }
            if (line.toLowerCase().startsWith('subject:')) {
              const subj = line.slice(8).trim()
              results.push({
                id: `mail-${Date.now()}-${results.length}`,
                from: 'Carregando...',
                subject: subj,
                date: Date.now(),
                snippet: subj,
                unread: true,
                isUrgent: /urgente|urgent|importante|alerta/i.test(subj)
              })
            } else if (line.toLowerCase().startsWith('from:') && results.length > 0) {
              results[results.length - 1].from = line.slice(5).trim()
            }
          }
        }
      })

      socket.on('error', (err) => {
        console.warn('[CalendarEmail] Erro no socket IMAP TLS:', err.message)
        finish()
      })

      socket.on('timeout', () => {
        console.warn('[CalendarEmail] Timeout na conexão IMAP TLS.')
        socket.destroy()
        finish()
      })
    })
  }

  public stop(): void {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer)
      this.reminderTimer = null
    }
  }
}

export const calendarEmail = new CalendarEmailService()

