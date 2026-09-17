import { shell } from 'electron'

/**
 * Executes media & web tools (search, music playback, opening links)
 */
export async function executeMediaTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'search_web': {
      const query = args.query || ''
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      await shell.openExternal(url)
      return `Realizei a pesquisa no Google por: "${query}" e abri o navegador.`
    }

    case 'open_link': {
      let targetUrl = (args.url || '').trim()
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`
      }
      await shell.openExternal(targetUrl)
      return `Abri o link ${targetUrl} no navegador.`
    }

    case 'play_music': {
      const query = args.songName || args.query || ''
      const platform = (args.platform || 'spotify').toLowerCase()

      if (platform === 'youtube') {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        await shell.openExternal(url)
        return `Buscando e tocando "${query}" no YouTube.`
      } else {
        const spotifyUri = `spotify:search:${encodeURIComponent(query)}`
        try {
          await shell.openExternal(spotifyUri)
          return `Abrindo e tocando "${query}" no Spotify.`
        } catch {
          const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          await shell.openExternal(ytUrl)
          return `Tocando "${query}" no YouTube.`
        }
      }
    }

    default:
      return `Ferramenta ${name} não reconhecida.`
  }
}

