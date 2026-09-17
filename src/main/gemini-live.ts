import WebSocket from 'ws'
import {
  SYSTEM_FUNCTION_DECLARATIONS,
  MEDIA_FUNCTION_DECLARATIONS,
  AUTONOMY_FUNCTION_DECLARATIONS,
  executeSystemTool,
  executeMediaTool,
  executeAutonomyTool
} from './tools'
import { getMemorySummary } from './memory'
import type { GeminiLiveOptions, GeminiStatus } from '@shared'

export type StatusCallback = (status: GeminiStatus, message?: string) => void
export type AudioCallback = (base64Audio: string) => void
export type TextCallback = (text: string) => void
export type EmptyCallback = () => void

export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private apiKey: string
  private voiceName: string
  private model: string
  private enableSystemTools: boolean = true
  private enableMediaTools: boolean = true
  private agentName: string = 'Jasper'
  private isConnecting: boolean = false
  private isConnected: boolean = false
  private intentionalDisconnect: boolean = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5

  public onStatus: StatusCallback | null = null
  public onAudio: AudioCallback | null = null
  public onText: TextCallback | null = null
  public onInterrupted: EmptyCallback | null = null
  public onTurnComplete: EmptyCallback | null = null

  constructor(options: GeminiLiveOptions) {
    this.apiKey = options.apiKey
    this.voiceName = options.voiceName || 'Charon'
    this.model = options.model || 'gemini-2.5-flash-native-audio-latest'
    if (options.enableSystemTools !== undefined) this.enableSystemTools = options.enableSystemTools
    if (options.enableMediaTools !== undefined) this.enableMediaTools = options.enableMediaTools
    if (options.agentName) this.agentName = options.agentName
  }

  public updateConfig(
    apiKey?: string,
    voiceName?: string,
    model?: string,
    enableSystemTools?: boolean,
    enableMediaTools?: boolean,
    agentName?: string
  ): void {
    if (apiKey) this.apiKey = apiKey
    if (voiceName) this.voiceName = voiceName
    if (model) this.model = model
    if (enableSystemTools !== undefined) this.enableSystemTools = enableSystemTools
    if (enableMediaTools !== undefined) this.enableMediaTools = enableMediaTools
    if (agentName) this.agentName = agentName
  }

  public getStatus(): { isConnected: boolean; isConnecting: boolean } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting
    }
  }

  public connect(
    customKey?: string,
    customVoice?: string,
    customModel?: string,
    customSystemTools?: boolean,
    customMediaTools?: boolean,
    customAgentName?: string
  ): Promise<void> {
    if (customKey) this.apiKey = customKey
    if (customVoice) this.voiceName = customVoice
    if (customModel) this.model = customModel
    if (customSystemTools !== undefined) this.enableSystemTools = customSystemTools
    if (customMediaTools !== undefined) this.enableMediaTools = customMediaTools
    if (customAgentName) this.agentName = customAgentName

    if (!this.apiKey || this.apiKey.trim() === '') {
      const err = 'GOOGLE_API_KEY não configurada. Defina no .env ou nas configurações.'
      this.onStatus?.('error', err)
      return Promise.reject(new Error(err))
    }

    this.intentionalDisconnect = false
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.disconnect()
      this.intentionalDisconnect = false
    }

    this.isConnecting = true
    this.onStatus?.('connecting', 'Conectando ao Gemini Multimodal Live...')

    return new Promise((resolve, reject) => {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey.trim()}`

      try {
        this.ws = new WebSocket(url)
      } catch (err: any) {
        this.isConnecting = false
        this.onStatus?.('error', err.message)
        return reject(err)
      }

      this.ws.on('open', () => {
        console.log('[GeminiLive] WebSocket connected. Sending initial setup payload...')
        this.isConnecting = false
        this.isConnected = true
        this.reconnectAttempts = 0
        const activeName = this.agentName || 'Jasper'
        this.onStatus?.('connected', `${activeName} Online`)

        // Build active function declarations based on user configuration
        const decls: any[] = []
        if (this.enableSystemTools) {
          decls.push(...SYSTEM_FUNCTION_DECLARATIONS)
        }
        if (this.enableMediaTools) {
          decls.push(...MEDIA_FUNCTION_DECLARATIONS)
        }
        decls.push(...AUTONOMY_FUNCTION_DECLARATIONS)

        const modelPath = this.model.startsWith('models/') ? this.model : `models/${this.model}`
        const memoryContext = getMemorySummary()

        // Send setup handshake
        const setupMessage: any = {
          setup: {
            model: modelPath,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: this.voiceName
                  }
                }
              }
            },
            systemInstruction: {
              parts: [
                {
                  text: `Você é ${activeName}, uma inteligência artificial assistente pessoal de elite inspirada no JARVIS.

DIRETRIZ MÁXIMA E INVIOLÁVEL DE IDIOMA:
- Você deve responder e se comunicar SEMPRE E EXCLUSIVAMENTE em Português do Brasil (pt-BR), tanto por voz quanto por texto.
- NUNCA responda em inglês ou qualquer outro idioma (a menos que o usuário solicite expressamente uma tradução para o inglês).
- Todas as suas falas, saudações, explicações, transcrições e confirmações de ferramentas DEVEM ser 100% em português brasileiro fluente, polido e natural.
- Se o usuário disser "olá", "oi", "bom dia" ou qualquer cumprimento, responda com uma saudação concisa, elegante e prestativa em português (ex: "Olá! Como posso ajudar você?", "Às ordens. Em que posso ser útil?").

PERSONALIDADE & CONDUTA:
- Responda de forma concisa, educada, elegante, segura e direta (1 a 3 frases por resposta em diálogos normais de voz).
- Evite delongas ou prolixidade desnecessária, pois você é um assistente de voz em tempo real.
- Você tem acesso a ferramentas de sistema (abrir programas, organizar pastas), mídia (YouTube, Spotify, busca web), matemática e memória de longo prazo (remember_fact). Use-as proativamente quando o usuário solicitar.

Contexto e Memória de Longo Prazo do Usuário:
${memoryContext}`
                }
              ]
            }
          }
        }

        if (decls.length > 0) {
          setupMessage.setup.tools = [{ functionDeclarations: decls }]
        }

        this.ws?.send(JSON.stringify(setupMessage))
        resolve()
      })

      this.ws.on('message', async (data: WebSocket.RawData) => {
        await this.handleMessage(data)
      })

      this.ws.on('error', (error: Error) => {
        console.error('[GeminiLive] WebSocket error:', error.message)
        this.isConnecting = false
        this.onStatus?.('error', error.message)
        reject(error)
      })

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`[GeminiLive] WebSocket closed: ${code} - ${reason.toString()}`)
        this.isConnecting = false
        this.isConnected = false
        this.ws = null

        // Tentar reconectar caso a desconexão não tenha sido intencional
        if (!this.intentionalDisconnect && this.apiKey && this.apiKey.trim().length > 0) {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            const delay = Math.min(1500 * Math.pow(1.8, this.reconnectAttempts - 1), 12000)
            const delaySec = Math.round(delay / 1000)
            this.onStatus?.(
              'connecting',
              `Reconectando em ${delaySec}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            )
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch((err) => {
                console.warn('[GeminiLive] Tentativa de reconexão falhou:', err.message)
              })
            }, delay)
            return
          }
        }

        this.onStatus?.('disconnected', 'Conexão encerrada')
      })
    })
  }

  private async handleMessage(data: WebSocket.RawData): Promise<void> {
    try {
      const text = data.toString('utf-8')
      const message = JSON.parse(text)

      // Check for errors from server
      if (message.error) {
        console.error('[GeminiLive] Server error payload:', message.error)
        this.onStatus?.('error', message.error.message || 'Erro da API Gemini')
        return
      }

      // Check for setup confirmation
      if (message.setupComplete) {
        console.log('[GeminiLive] Session setup confirmed by server.')
        this.onStatus?.('connected', 'Jasper Pronto')
      }

      // Check for Tool Calls from model
      if (message.toolCall && Array.isArray(message.toolCall.functionCalls)) {
        console.log('[GeminiLive] Received toolCall request:', JSON.stringify(message.toolCall))
        this.onStatus?.('speaking', 'Executando comando...')

        const functionResponses: any[] = []
        for (const call of message.toolCall.functionCalls) {
          let output = ''
          try {
            if (this.enableSystemTools && SYSTEM_FUNCTION_DECLARATIONS.some((d) => d.name === call.name)) {
              output = await executeSystemTool(call.name, call.args || {})
            } else if (this.enableMediaTools && MEDIA_FUNCTION_DECLARATIONS.some((d) => d.name === call.name)) {
              output = await executeMediaTool(call.name, call.args || {})
            } else if (AUTONOMY_FUNCTION_DECLARATIONS.some((d) => d.name === call.name)) {
              output = await executeAutonomyTool(call.name, call.args || {})
            } else {
              output = `A ferramenta ${call.name} não está ativada nas configurações do sistema.`
            }
          } catch (err: any) {
            output = `Erro ao executar ${call.name}: ${err.message}`
          }

          functionResponses.push({
            id: call.id,
            name: call.name,
            response: { output }
          })
        }

        const toolResponsePayload = {
          toolResponse: {
            functionResponses
          }
        }

        this.ws?.send(JSON.stringify(toolResponsePayload))
        console.log('[GeminiLive] Dispatched toolResponse:', JSON.stringify(toolResponsePayload))
      }

      // 1. Server content response
      if (message.serverContent) {
        const sc = message.serverContent

        // Interruption detected by Gemini
        if (sc.interrupted) {
          console.log('[GeminiLive] Model speech interrupted by user.')
          this.onInterrupted?.()
        }

        // Model generated turn parts
        if (sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
          this.onStatus?.('speaking')
          for (const part of sc.modelTurn.parts) {
            // Audio data
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/pcm')) {
              this.onAudio?.(part.inlineData.data)
            }
            // Text transcription
            if (part.text) {
              if ((part as any).thought) {
                // Ignore internal model thought reasoning from public spoken subtitles
                continue
              }
              this.onText?.(part.text)
            }
          }
        }

        // Turn complete
        if (sc.turnComplete) {
          this.onTurnComplete?.()
          this.onStatus?.('listening')
        }
      }
    } catch (err: any) {
      console.error('[GeminiLive] Error parsing incoming message:', err)
    }
  }

  public sendAudioChunk(chunk: ArrayBuffer | Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const base64Data = Buffer.isBuffer(chunk)
        ? chunk.toString('base64')
        : Buffer.from(chunk).toString('base64')
      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          ]
        }
      }

      this.ws.send(JSON.stringify(message))
    } catch (err) {
      console.error('[GeminiLive] Error sending audio chunk:', err)
    }
  }

  public sendAudioStreamEnd(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const message = {
        realtimeInput: {
          audioStreamEnd: true
        }
      }
      this.ws.send(JSON.stringify(message))
      console.log('[GeminiLive] Sent audioStreamEnd: immediate turn finalization requested.')
    } catch (err) {
      console.error('[GeminiLive] Error sending audioStreamEnd:', err)
    }
  }

  public sendTextPrompt(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GeminiLive] Cannot send text prompt, WebSocket is not open.')
      return
    }

    try {
      const message = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      }
      this.ws.send(JSON.stringify(message))
      console.log('[GeminiLive] Sent text prompt:', text)
    } catch (err) {
      console.error('[GeminiLive] Error sending text prompt:', err)
    }
  }

  public disconnect(): void {
    this.intentionalDisconnect = true
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.reconnectAttempts = 0

    if (this.ws) {
      try {
        this.ws.close()
      } catch (err) {
        // ignore
      }
      this.ws = null
    }
    this.isConnecting = false
    this.isConnected = false
    this.onStatus?.('disconnected', 'Desconectado')
  }
}

