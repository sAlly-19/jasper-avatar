import { BrowserWindow } from 'electron'
import type { BrowserScrapeResult } from '@shared'

export class HeadlessBrowser {
  private enabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public async browse(
    targetUrl: string,
    options: {
      extractType?: 'text' | 'html' | 'markdown' | 'screenshot'
      timeoutMs?: number
    } = {}
  ): Promise<BrowserScrapeResult> {
    if (!this.enabled) {
      return {
        success: false,
        url: targetUrl,
        title: '',
        content: '',
        error: 'Navegador Headless desativado nas configurações.'
      }
    }

    let formattedUrl = targetUrl.trim()
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`
    }

    const timeoutMs = options.timeoutMs || 25000
    const extractType = options.extractType || 'text'

    let win: BrowserWindow | null = null

    try {
      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        backgroundColor: '#ffffff',
        webPreferences: {
          sandbox: true,
          javascript: true,
          contextIsolation: true,
          webSecurity: true
        }
      })

      win.webContents.setAudioMuted(true)

      // Timeout safety
      let timer: NodeJS.Timeout | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tempo limite de ${timeoutMs / 1000}s excedido ao carregar ${formattedUrl}`)), timeoutMs)
      })

      // Load URL
      const loadPromise = win.loadURL(formattedUrl, {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 HUD-AI/1.0'
      })

      try {
        await Promise.race([loadPromise, timeoutPromise])
      } finally {
        if (timer) clearTimeout(timer)
      }

      // Wait a short moment for dynamic SPAs to settle
      await new Promise((r) => setTimeout(r, 1200))

      const title = win.webContents.getTitle() || ''

      let screenshotBase64: string | undefined
      if (extractType === 'screenshot') {
        const image = await win.webContents.capturePage()
        screenshotBase64 = image.toDataURL()
      }

      // Execute in-page extraction script
      const extractedContent: string = await win.webContents.executeJavaScript(`
        (() => {
          try {
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const clone = document.body ? document.body.cloneNode(true) : null;
            if (!clone) return metaDesc || 'Sem conteúdo legível.';

            const tagsToRemove = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'nav', 'footer'];
            tagsToRemove.forEach(tag => {
              clone.querySelectorAll(tag).forEach(el => el.remove());
            });

            // Extract headings and paragraphs
            const headings = Array.from(clone.querySelectorAll('h1, h2, h3'))
              .map(h => h.textContent ? h.textContent.trim() : '')
              .filter(Boolean)
              .slice(0, 8);

            let rawText = clone.innerText || clone.textContent || '';
            rawText = rawText.replace(/\\s+/g, ' ').trim();
            const textSample = rawText.slice(0, 3500);

            let result = '';
            if (metaDesc) {
              result += 'Descrição: ' + metaDesc + '\\n\\n';
            }
            if (headings.length > 0) {
              result += 'Tópicos Principais:\\n- ' + headings.join('\\n- ') + '\\n\\n';
            }
            result += 'Conteúdo:\\n' + textSample;
            return result;
          } catch (e) {
            return 'Erro ao extrair conteúdo da página: ' + e.message;
          }
        })()
      `)

      return {
        success: true,
        url: formattedUrl,
        title,
        content: extractedContent,
        screenshotBase64
      }
    } catch (err: any) {
      return {
        success: false,
        url: formattedUrl,
        title: '',
        content: '',
        error: err.message || 'Erro desconhecido ao navegar'
      }
    } finally {
      if (win && !win.isDestroyed()) {
        try {
          win.destroy()
        } catch {}
      }
    }
  }
}

export const headlessBrowser = new HeadlessBrowser()

