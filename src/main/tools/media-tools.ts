import { shell } from 'electron'
import { securityBroker } from '../services/security-broker'

async function confirmAndOpen(url: string, detail: string): Promise<boolean> {
  const approved = await securityBroker.confirmOperation({
    title: 'Abrir aplicativo externo',
    message: 'O Jasper solicitou a abertura de um destino externo.',
    detail,
    confirmLabel: 'Abrir',
    risk: 'common'
  })
  if (!approved) return false
  await shell.openExternal(url)
  return true
}

/**
 * Executes media & web tools (search, music playback, opening links)
 */
export async function executeMediaTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'search_web': {
      const query = args.query || ''
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      const opened = await confirmAndOpen(url, `Pesquisa no Google: ${String(query).slice(0, 200)}`)
      return opened ? 'Pesquisa aberta no navegador após sua confirmação.' : 'A abertura da pesquisa foi cancelada.'
    }

    case 'open_link': {
      let targetUrl = (args.url || '').trim()
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`
      }
      let parsed: URL
      try {
        parsed = new URL(targetUrl)
      } catch {
        return 'O link informado é inválido.'
      }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || targetUrl.length > 2048) {
        return 'O link foi bloqueado: apenas URLs HTTPS sem credenciais são permitidas.'
      }
      const opened = await confirmAndOpen(parsed.toString(), `Site: ${parsed.hostname}`)
      return opened ? 'Link aberto no navegador após sua confirmação.' : 'A abertura do link foi cancelada.'
    }

    case 'play_music': {
      const query = args.songName || args.query || ''
      const platform = (args.platform || 'spotify').toLowerCase()

      if (platform === 'youtube') {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        const opened = await confirmAndOpen(url, `Pesquisa no YouTube: ${String(query).slice(0, 200)}`)
        return opened ? 'Pesquisa musical aberta no YouTube.' : 'A abertura do YouTube foi cancelada.'
      } else {
        const spotifyUri = `spotify:search:${encodeURIComponent(query)}`
        try {
          const opened = await confirmAndOpen(spotifyUri, `Pesquisa no Spotify: ${String(query).slice(0, 200)}`)
          return opened ? 'Pesquisa musical aberta no Spotify.' : 'A abertura do Spotify foi cancelada.'
        } catch {
          const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          const opened = await confirmAndOpen(ytUrl, `Pesquisa no YouTube: ${String(query).slice(0, 200)}`)
          return opened ? 'Pesquisa musical aberta no YouTube.' : 'A abertura do YouTube foi cancelada.'
        }
      }
    }

    default:
      return `Ferramenta ${name} não reconhecida.`
  }
}

