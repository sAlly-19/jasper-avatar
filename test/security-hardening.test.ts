import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

// Real production imports
import {
  isPrivateOrLoopbackHost,
  isPrivateOrLoopbackIP,
  resolveAndCheckSSRF,
  WebhookManager
} from '../src/main/autonomous/webhook-manager'
import { toolPolicyEngine, ToolPolicyEngine } from '../src/main/autonomous/policy-engine'
import { redactSecrets, ClipboardWatcherService } from '../src/main/autonomous/clipboard-watcher'
import { SmartHomeService } from '../src/main/autonomous/smart-home'
import { KnowledgeGraphService } from '../src/main/autonomous/knowledge-graph'
import { buildMorphCacheMap } from '../src/renderer/scene/avatar'
import { GitWatcher } from '../src/main/autonomous/git-watcher'
import { ReflexionEngine } from '../src/main/autonomous/reflexion-engine'
import http from 'node:http'
import { webcrypto } from 'node:crypto'
import { getHardwareInfo } from '../src/main/services/hwid'
import { DEFAULT_LICENSE_API_URL, licenseManager, LicenseManager } from '../src/main/services/license-manager'
import { configStore } from '../src/main/config/config-store'
import { isTrustedRendererUrl } from '../src/main/utils/trusted-renderer'
import { requiresConfirmation, securityBroker } from '../src/main/services/security-broker'

describe('Suíte de Testes de Integração com Classes e Módulos Reais', () => {

  describe('Origem confiável do renderer', () => {
    test('aceita somente o host do protocolo app em produção', () => {
      assert.equal(isTrustedRendererUrl('app://jasper/index.html'), true)
      assert.equal(isTrustedRendererUrl('app://evil/index.html'), false)
      assert.equal(isTrustedRendererUrl('file:///tmp/index.html'), false)
      assert.equal(isTrustedRendererUrl('https://jasper/index.html'), false)
    })

    test('aceita somente a origem do servidor configurado em desenvolvimento', () => {
      const developmentUrl = 'http://127.0.0.1:5173/'
      assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/settings', developmentUrl), true)
      assert.equal(isTrustedRendererUrl('http://127.0.0.1:5174/', developmentUrl), false)
      assert.equal(isTrustedRendererUrl('https://127.0.0.1:5173/', developmentUrl), false)
    })
  })

  // 1. WebhookManager & SSRF / DNS Rebinding
  describe('WebhookManager & SSRF / DNS Rebinding (Módulo Real)', () => {
    test('isPrivateOrLoopbackHost bloqueia loopback e metadados de nuvem', () => {
      assert.equal(isPrivateOrLoopbackHost('localhost'), true)
      assert.equal(isPrivateOrLoopbackHost('127.0.0.1'), true)
      assert.equal(isPrivateOrLoopbackHost('::1'), true)
      assert.equal(isPrivateOrLoopbackHost('0.0.0.0'), true)
      assert.equal(isPrivateOrLoopbackHost('169.254.169.254'), true)
    })

    test('isPrivateOrLoopbackIP bloqueia faixas privadas RFC1918 e CGNAT', () => {
      assert.equal(isPrivateOrLoopbackIP('10.0.0.1'), true)
      assert.equal(isPrivateOrLoopbackIP('172.16.0.1'), true)
      assert.equal(isPrivateOrLoopbackIP('172.31.255.255'), true)
      assert.equal(isPrivateOrLoopbackIP('192.168.1.1'), true)
      assert.equal(isPrivateOrLoopbackIP('100.64.0.1'), true) // CGNAT
      assert.equal(isPrivateOrLoopbackIP('::ffff:127.0.0.1'), true)
      assert.equal(isPrivateOrLoopbackIP('::ffff:192.168.1.1'), true)
      assert.equal(isPrivateOrLoopbackIP('ff02::1'), true)
      assert.equal(isPrivateOrLoopbackIP('8.8.8.8'), false)
      assert.equal(isPrivateOrLoopbackIP('1.1.1.1'), false)
    })

    test('resolveAndCheckSSRF detecta hosts que resolvem para loopback', async () => {
      const result = await resolveAndCheckSSRF('127.0.0.1')
      assert.equal(result.isSafe, false)
      assert.ok(result.reason?.includes('loopback ou privado'))
    })

    test('WebhookManager gerencia registro e bloqueia SSRF não cadastrado', async () => {
      const manager = new WebhookManager()
      manager.registerWebhook({
        name: 'test-hook',
        url: 'https://httpbin.org/post',
        method: 'POST',
        description: 'Webhook de teste'
      })

      const list = manager.listWebhooks()
      assert.ok(list.some((w) => w.name === 'test-hook'))

      // Disparo para localhost não cadastrado deve ser barrado por SSRF
      const ssrfRes = await manager.triggerWebhook('http://127.0.0.1:9999/admin')
      assert.equal(ssrfRes.success, false)
      assert.ok(ssrfRes.error?.includes('SSRF Bloqueado'))

      manager.removeWebhook('test-hook')
      assert.ok(!manager.listWebhooks().some((w) => w.name === 'test-hook'))
    })

    test('WebhookManager exige HTTPS e bloqueia cabeçalhos de transporte', () => {
      const manager = new WebhookManager()
      assert.throws(() => manager.registerWebhook({
        name: 'insecure-hook',
        url: 'http://example.com/hook',
        method: 'POST'
      }), /HTTPS/)
      assert.throws(() => manager.registerWebhook({
        name: 'host-override',
        url: 'https://example.com/hook',
        method: 'POST',
        headers: { Host: '127.0.0.1' }
      }), /Cabeçalho/)
    })
  })

  // 2. Central ToolPolicyEngine & Sandboxing
  describe('ToolPolicyEngine (Políticas Zero-Trust Reais)', () => {
    test('bloqueia acesso a diretórios de sistema do Windows', () => {
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\Windows\\System32\\cmd.exe').allowed, false)
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\Program Files\\app\\config.json').allowed, false)
    })

    test('valida contenção de caminhos e bloqueia directory traversal', () => {
      const base = 'C:\\temp\\sandbox'
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\temp\\sandbox\\out.txt', base).allowed, true)
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\temp\\sandbox\\..\\secret.key', base).allowed, false)
    })

    test('gerenciador de processos não usa shell ou cmd /c', () => {
      const source = fs.readFileSync(path.join(process.cwd(), 'src/main/autonomous/process-manager.ts'), 'utf-8')
      assert.equal(source.includes('shell: true'), false)
      assert.equal(/cmd(?:\.exe)?[^\n]*\/c/i.test(source), false)
      const gitWatcherSource = fs.readFileSync(path.join(process.cwd(), 'src/main/autonomous/git-watcher.ts'), 'utf-8')
      assert.equal(gitWatcherSource.includes('shell: true'), false)
      assert.equal(gitWatcherSource.includes('customCommand'), false)
    })
  })

  // 3. ClipboardWatcher & Secret Redaction
  describe('ClipboardWatcher (Redação de Segredos Real)', () => {
    test('redige Google Gemini API keys reais', () => {
      const text = 'Erro ao usar AIzaSyB1234567890123456789012345678901 na conexão'
      const sanitized = redactSecrets(text)
      assert.ok(!sanitized.includes('AIzaSyB'))
      assert.ok(sanitized.includes('[REDACTED_API_KEY]'))
    })

    test('redige Bearer Tokens e senhas no clipboard', () => {
      const text = 'Authorization: Bearer mySecretToken123456789012345'
      const sanitized = redactSecrets(text)
      assert.ok(sanitized.includes('Bearer [REDACTED_TOKEN]'))
    })

    test('redige JWT, tokens GitHub, chaves AWS e chaves privadas', () => {
      const text = [
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature_value_123456789',
        'ghp_abcdefghijklmnopqrstuvwxyz123456',
        'AKIAABCDEFGHIJKLMNOP', // secret-scan: allow
        '-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----' // secret-scan: allow
      ].join('\n')
      const sanitized = redactSecrets(text)
      assert.ok(sanitized.includes('[REDACTED_JWT]'))
      assert.ok(sanitized.includes('[REDACTED_GITHUB_TOKEN]'))
      assert.ok(sanitized.includes('[REDACTED_AWS_ACCESS_KEY]'))
      assert.ok(sanitized.includes('[REDACTED_PRIVATE_KEY]'))
      assert.equal(sanitized.includes('secret-material'), false)
    })
  })

  // 4. SmartHomeService & Zero-Trust Domain Policy
  describe('SmartHomeService (Allowlist de Domínios Real)', () => {
    test('não simula sucesso sem Home Assistant configurado', async () => {
      const service = new SmartHomeService()
      const res = await service.executeCommand('light', 'turn_on', 'light.sala')
      assert.equal(res.success, false)
      assert.equal(res.error, 'NOT_CONFIGURED')
    })

    test('bloqueia expressamente domínios de segurança física (lock, alarm, garage)', async () => {
      const service = new SmartHomeService()
      const lockRes = await service.executeCommand('lock', 'unlock', 'lock.porta_entrada')
      assert.equal(lockRes.success, false)
      assert.equal(lockRes.error, 'BLOCKED_DOMAIN')

      const alarmRes = await service.executeCommand('alarm_control_panel', 'disarm', 'alarm.casa')
      assert.equal(alarmRes.success, false)
      assert.equal(alarmRes.error, 'BLOCKED_DOMAIN')
    })

    test('rejeita serviços e entidades fora da allowlist', async () => {
      const service = new SmartHomeService()
      assert.equal((await service.executeCommand('light', 'unlock', 'light.sala')).error, 'INVALID_SERVICE')
      assert.equal((await service.executeCommand('light', 'turn_on', 'switch.sala')).error, 'INVALID_ENTITY')
    })
  })

  describe('SecurityBroker (contenção de arquivos do usuário)', () => {
    test('aplica os três modos sem liberar ações obrigatoriamente protegidas', () => {
      assert.equal(requiresConfirmation('strict', 'common'), true)
      assert.equal(requiresConfirmation('strict', 'elevated'), true)
      assert.equal(requiresConfirmation('common', 'common'), false)
      assert.equal(requiresConfirmation('common', 'elevated'), true)
      assert.equal(requiresConfirmation('all', 'common'), false)
      assert.equal(requiresConfirmation('all', 'elevated'), false)
      assert.equal(requiresConfirmation('all', 'mandatory'), true)
    })

    test('permite arquivo em Documentos e rejeita caminho externo', () => {
      const allowedFile = path.join(app.getPath('documents'), 'broker-test.txt')
      fs.writeFileSync(allowedFile, 'ok', 'utf-8')
      try {
        assert.equal(securityBroker.resolveUserPath(allowedFile).allowed, true)
        assert.equal(securityBroker.resolveUserPath(path.join(os.tmpdir(), 'fora-do-perimetro.txt')).allowed, false)
        assert.equal(securityBroker.resolveUserPath('..\\segredo.txt').allowed, false)
      } finally {
        fs.rmSync(allowedFile, { force: true })
      }
    })

    test('rejeita link simbólico ou junction mesmo dentro de Documentos', () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jasper-outside-'))
      const linkPath = path.join(app.getPath('documents'), `jasper-link-${Date.now()}`)
      try {
        fs.symlinkSync(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
        assert.equal(securityBroker.resolveUserPath(linkPath).allowed, false)
      } finally {
        fs.rmSync(linkPath, { recursive: true, force: true })
        fs.rmSync(outsideDir, { recursive: true, force: true })
      }
    })
  })

  // 5. KnowledgeGraphService & Gravação Atômica
  describe('KnowledgeGraphService (Grafo e Gravação Atômica Real)', () => {
    test('adiciona nós, relações e persiste atomicamente', () => {
      const kg = new KnowledgeGraphService()
      const node = kg.addEntity('TypeScript', 'Technology', { version: '5.7' })
      assert.equal(node.label, 'TypeScript')

      const edge = kg.addRelation('user', 'estuda', 'TypeScript')
      assert.equal(edge.relation, 'estuda')

      const query = kg.queryEntity('TypeScript')
      assert.ok(query.entity !== undefined)
      assert.equal(query.entity?.label, 'TypeScript')
    })
  })

  // 6. Avatar 3D Morph Target O(1) Mapping
  describe('Avatar 3D Morph Target O(1) Cache Real', () => {
    test('buildMorphCacheMap mapeia variações ARKit Left/Right e caixa alta/baixa', () => {
      const dict = {
        mouthSmile_L: 0,
        mouthSmile_R: 1,
        eyeBlinkLeft: 2,
        eyeBlinkRight: 3,
        jawOpen: 4
      }

      const cache = buildMorphCacheMap(dict)

      assert.equal(cache.get('mouthSmile_L'), 0)
      assert.equal(cache.get('mouthSmileLeft'), 0)
      assert.equal(cache.get('mouthsmileleft'), 0)
      assert.equal(cache.get('eyeBlinkLeft'), 2)
      assert.equal(cache.get('eyeBlink_L'), 2)
      assert.equal(cache.get('jawopen'), 4)
    })
  })

  // 7. GitWatcher & Reflexion Commit Safety
  describe('GitWatcher & Reflexion Guard (Segurança de Commit Real)', () => {
    test('Policy Engine valida commit com arquivos específicos e rejeita vazamentos', () => {
      const safe = toolPolicyEngine.validateGitCommit('feat: adicionar suporte', ['src/index.ts'])
      assert.equal(safe.allowed, true)
      assert.equal(safe.requiresConfirmation, false)

      const sensitive = toolPolicyEngine.validateGitCommit('chore: salvar dados', ['.env'])
      assert.equal(sensitive.allowed, false)
      assert.equal(sensitive.riskLevel, 'CRITICAL')

      const traversal = toolPolicyEngine.validateGitCommit('chore: salvar dados', ['../../etc/passwd'])
      assert.equal(traversal.allowed, false)
    })

    test('ReflexionEngine intercepta commit e exige confirmação prévia', () => {
      const engine = new ReflexionEngine()
      let confirmationId = ''
      engine.setOnNotification((notification) => {
        confirmationId = String(notification.data?.confirmationId || '')
      })
      const check = engine.preExecutionCheck('git_commit_changes', {
        message: 'feat: nova funcionalidade',
        files: ['src/app.ts']
      })
      assert.equal(check.allowed, false)
      assert.equal(check.requiresConfirmation, true)
      assert.ok(check.reason?.includes('Operação de commit Git solicitada'))
      assert.match(confirmationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      assert.equal(engine.confirmAction(confirmationId), true)
      assert.equal(engine.confirmAction(confirmationId), false, 'token de confirmação não pode ser reutilizado')

      const authorized = engine.preExecutionCheck('git_commit_changes', {
        files: ['src/app.ts'],
        message: 'feat: nova funcionalidade'
      })
      assert.equal(authorized.allowed, true, 'autorização deve aceitar os mesmos parâmetros em ordem canônica')

      const replay = engine.preExecutionCheck('git_commit_changes', {
        message: 'feat: nova funcionalidade',
        files: ['src/app.ts']
      })
      assert.equal(replay.allowed, false, 'autorização deve ser consumida em uma única operação')
    })
  })

  // 8. WakeWordManager & Chamada de Agente Exclusiva via TensorFlow
  describe('WakeWordManager & Chamada de Agente Exclusiva via TensorFlow', () => {
    test('código fonte de wake-word-manager e speech-commands não possui referências a Web Speech API', () => {
      const wakeWordManagerSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/wake-word-manager.ts'),
        'utf-8'
      )
      // Garante remoção completa do Web Speech API / fallback fonético
      assert.equal(wakeWordManagerSrc.includes('SpeechRecognition'), false)
      assert.equal(wakeWordManagerSrc.includes('webkitSpeechRecognition'), false)
      assert.equal(wakeWordManagerSrc.includes('startPhoneticFallback'), false)
      assert.equal(wakeWordManagerSrc.includes('isPhoneticFallbackActive'), false)

      // Garante modo exclusivo TensorFlow
      assert.ok(wakeWordManagerSrc.includes("mode: isCalibrated ? 'tensorflow' : 'disabled'"))
      assert.ok(wakeWordManagerSrc.includes('syncRunningState'))
      assert.ok(wakeWordManagerSrc.includes("import { SpeechCommandsWakeWord } from './speech-commands'"))
      assert.ok(wakeWordManagerSrc.includes('new SpeechCommandsWakeWord({'))

      const speechCommandsSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/speech-commands.ts'),
        'utf-8'
      )
      assert.equal(speechCommandsSrc.includes('tr.secondLastBaseDenseLayer = null'), false)
      assert.ok(speechCommandsSrc.includes('./speech-model/model.json'))
    })

    test('speech-commands implementa modelo neural de 3 classes com amostras negativas e threshold de 0.90', () => {
      const speechCommandsSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/speech-commands.ts'),
        'utf-8'
      )
      // Confirma filtro explícito de fala comum / amostras negativas
      assert.ok(speechCommandsSrc.includes("detectedWord === '_other_'"))
      assert.ok(speechCommandsSrc.includes("detectedWord === '_background_noise_'"))

      // Confirma hiperparâmetros anti-falso-positivo
      assert.ok(speechCommandsSrc.includes('probabilityThreshold: options.probabilityThreshold ?? 0.90'))
      assert.ok(speechCommandsSrc.includes('overlapFactor: 0.25'))
      assert.ok(speechCommandsSrc.includes('hasNegativeSpeechSamples()'))
      assert.ok(speechCommandsSrc.includes('isLegacyModel()'))
      assert.ok(speechCommandsSrc.includes('labels.includes(\'_other_\')'))
    })

    test('wake-trainer-ui e index.html exigem calibração de 3 classes (nome, silêncio e outras palavras)', () => {
      const trainerUiSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/ui/wake-trainer-ui.ts'),
        'utf-8'
      )
      const indexHtmlSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/index.html'),
        'utf-8'
      )

      // Confirma que a UI exige 3 classes para habilitar treinamento
      assert.ok(trainerUiSrc.includes('nameCount >= 3 && noiseCount >= 2 && otherCount >= 2'))
      assert.ok(trainerUiSrc.includes("engine.collectCustomSample('_other_')"))
      assert.ok(trainerUiSrc.includes('btnSampleOther'))
      assert.ok(trainerUiSrc.includes('countOtherSamples'))

      // Confirma elementos correspondentes no HTML
      assert.ok(indexHtmlSrc.includes('id="btn-sample-other"'))
      assert.ok(indexHtmlSrc.includes('id="count-other-samples"'))
      assert.ok(indexHtmlSrc.includes('Gravar Outras Palavras'))
    })
  })

  // 9. Modo Chamada Contínuo & Zero-Latency Audio Pipeline
  describe('Modo Chamada Contínuo & Zero-Latency Audio Pipeline', () => {
    test('MicRecorder possui suporte nativo a Modo Chamada Full-Duplex e timeout de 30s', () => {
      const micRecorderSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/mic-recorder.ts'),
        'utf-8'
      )
      assert.ok(micRecorderSrc.includes('CALL_INACTIVITY_TIMEOUT_MS = 30000'))
      assert.ok(micRecorderSrc.includes('onCallInactivityTimeout: (() => void) | null = null'))
      assert.ok(micRecorderSrc.includes('notifyAssistantActivity()'))
      assert.ok(micRecorderSrc.includes('getRemainingInactivitySeconds()'))
      assert.ok(micRecorderSrc.includes('SPEECH_RMS_THRESHOLD = 0.025'))
      assert.ok(micRecorderSrc.includes('MIN_SPEECH_CHUNKS = 18'))
      assert.ok(micRecorderSrc.includes('Full-Duplex'))
    })

    test('main.ts implementa Modo Chamada Full-Duplex, saudação proativa e barge-in', () => {
      const mainSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/main.ts'),
        'utf-8'
      )
      // Presença das funções de controle do Modo Chamada
      assert.ok(mainSrc.includes('async function enterCallMode(withGreeting = true)'))
      assert.ok(mainSrc.includes('async function exitCallMode()'))
      assert.ok(mainSrc.includes('enterCallMode(true)'))

      // Saudação proativa em português
      assert.ok(mainSrc.includes('O usuário acabou de chamar você. Cumprimente-o com elegância e brevidade em português e pergunte o que deseja.'))

      // Hook de interrupção (Barge-in) e inatividade
      assert.ok(mainSrc.includes('Barge-in: Interrupção por voz detectada'))
      assert.ok(mainSrc.includes('micRecorder.onCallInactivityTimeout = () => {'))
    })

    test('AudioPlayer gerencia fontes de áudio com desconexão imediata e callback de término', () => {
      const audioPlayerSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/audio-player.ts'),
        'utf-8'
      )
      assert.ok(audioPlayerSrc.includes('public onPlaybackEnded: (() => void) | null = null'))
      assert.ok(audioPlayerSrc.includes('source.disconnect()'))
      assert.ok(audioPlayerSrc.includes('this.onPlaybackEnded?.()'))
    })

    test('Gemini Live client utiliza o modelo Live oficial gemini-3.8-live', () => {
      const liveClientSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/main/gemini-live.ts'),
        'utf-8'
      )
      assert.ok(liveClientSrc.includes('gemini-3.8-live'))
    })

    test('preserva modelos Live suportados ao salvar a configuracao e aposenta modelos descontinuados', () => {
      const previous = configStore.getConfig().model
      try {
        for (const model of ['gemini-3.8-live', 'gemini-2.5-flash-native-audio-preview-12-2025']) {
          assert.equal(configStore.updateConfig({ model }).model, model)
        }
        assert.equal(configStore.updateConfig({ model: 'gemini-2.0-flash-exp' }).model, 'gemini-3.8-live')
        assert.equal(configStore.updateConfig({ model: 'gemini-2.0-flash-live-001' }).model, 'gemini-3.8-live')
      } finally {
        configStore.updateConfig({ model: previous })
      }
    })
  })

  // 11. Sistema de Licenciamento Criptográfico & Node-Locking (Módulo Real)
  describe('Sistema de Licenciamento Criptográfico & Node-Locking (Módulo Real)', () => {
    test('getHardwareInfo gera identificador único estável no formato HWID-XXXX-XXXX-XXXX', () => {
      const hw1 = getHardwareInfo()
      assert.ok(hw1.machineId)
      assert.match(hw1.machineId, /^HWID-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/)
      assert.ok(hw1.machineName.length > 0)
      assert.ok(hw1.platform.length > 0)

      // Verificação de determinismo
      const hw2 = getHardwareInfo()
      assert.equal(hw1.machineId, hw2.machineId)
    })

    test('LicenseManager aceita apenas o formato atual de chaves aleatórias', () => {
      assert.equal(DEFAULT_LICENSE_API_URL, 'https://jasper-api-production.jasper-avatar.workers.dev')
      assert.equal(licenseManager.validateKeyFormat('JASPER-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2-34'), true)
      assert.equal(licenseManager.validateKeyFormat('jasper-abcde-fghjk-lmnpq-rstuv-wxyz2-34'), true)
      assert.equal(licenseManager.validateKeyFormat('JASPER-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2-35'), false)
      assert.equal(licenseManager.validateKeyFormat('JASPER-LT-ZJV8-DVLK-942B'), false)
      assert.equal(licenseManager.validateKeyFormat('JSPR-V1-ABCD-1234-EF56'), false)
      assert.equal(licenseManager.validateKeyFormat('JASPER-INVALID-KEY'), false)
      assert.equal(licenseManager.validateKeyFormat(''), false)
      assert.equal(licenseManager.validateKeyFormat(null as any), false)
    })

    test('LicenseManager valida lease Ed25519 do Worker e renova por heartbeat', async () => {
      const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair
      const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
      let activationBody: any = null

      const signLease = async (installationId: string, machineHash: string): Promise<{ token: string; expiresAt: string }> => {
        const now = Math.floor(Date.now() / 1000)
        const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url')
        const payload = Buffer.from(JSON.stringify({
          iss: 'jasper-license-api',
          aud: 'jasper-avatar-desktop',
          installationId,
          machineHash,
          iat: now,
          exp: now + (72 * 60 * 60)
        })).toString('base64url')
        const signature = await webcrypto.subtle.sign(
          { name: 'Ed25519' },
          pair.privateKey,
          Buffer.from(`${header}.${payload}`, 'utf-8')
        )
        return {
          token: `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`,
          expiresAt: new Date((now + (72 * 60 * 60)) * 1000).toISOString()
        }
      }

      const readJsonBody = (req: http.IncomingMessage): Promise<any> => new Promise((resolve) => {
        let raw = ''
        req.on('data', chunk => { raw += chunk })
        req.on('end', () => resolve(JSON.parse(raw || '{}')))
      })

      const server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET' && req.url === '/v1/licenses/public-key') {
          res.end(JSON.stringify({ key: publicJwk }))
          return
        }
        if (req.method === 'POST' && req.url === '/v1/licenses/activate') {
          activationBody = await readJsonBody(req)
          res.end(JSON.stringify({
            status: 'active',
            deviceId: 'device-test-1',
            deviceSecret: 'device-secret-test-value',
            lease: await signLease(activationBody.installationId, activationBody.machineHash)
          }))
          return
        }
        if (req.method === 'POST' && req.url === '/v1/licenses/heartbeat') {
          await readJsonBody(req)
          res.end(JSON.stringify({
            status: 'active',
            lease: await signLease(activationBody.installationId, activationBody.machineHash)
          }))
          return
        }
        res.statusCode = 404
        res.end(JSON.stringify({ error: { code: 'not_found' } }))
      })

      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
      const address = server.address() as { port: number }
      const manager = new LicenseManager()
      manager.setCustomBaseUrl(`http://127.0.0.1:${address.port}`)
      configStore.updateConfig({
        licenseKey: '',
        licenseStatus: 'unlicensed',
        licenseMachineId: '',
        licenseInstallationId: '',
        licenseDeviceId: '',
        licenseDeviceSecret: '',
        licenseLeaseToken: '',
        licenseLeaseExpiresAt: '',
        licensePublicJwk: ''
      })

      try {
        const activated = await manager.activateLicense('JASPER-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2-34')
        assert.equal(activated.valid, true)
        assert.equal(activated.status, 'ACTIVATED')
        assert.equal(configStore.getConfig().licenseStatus, 'active')
        assert.ok(configStore.getConfig().licenseLeaseToken?.includes('.'))

        const renewed = await manager.verifyCurrentLicense()
        assert.equal(renewed.valid, true)
        assert.equal(renewed.status, 'ACTIVE')
        assert.equal(manager.getLicenseInfo().isLicensed, true)
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    })

    test('LicenseManager não aceita chaves de desenvolvimento em modo offline (modo dev removido)', async () => {
      const manager = new LicenseManager()
      manager.setCustomBaseUrl('http://127.0.0.1:59999/non-existent')

      // Sem atalho DEV: uma chave sintaticamente válida ainda precisa do servidor.
      const devResult = await manager.activateLicense('JASPER-ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2-34')
      assert.equal(devResult.valid, false)
      assert.equal(devResult.error, 'NETWORK_ERROR')
    })

    test('LicenseManager checkAccess24h e onRevoked notificam quando licença é suspensa ou revogada', async () => {
      const manager = new LicenseManager()
      let revocationNotified = false
      manager.onRevoked(() => {
        revocationNotified = true
      })

      // Simula licença sem chave configurada
      configStore.updateConfig({ licenseKey: '', licenseStatus: 'unlicensed' })
      const res = await manager.checkAccess24h(true)
      assert.equal(res.valid, false)
      assert.equal(revocationNotified, true)
    })

    test('UI e arquivos fonte contêm elementos e proteções de licenciamento obrigatórias e onboarding Gemini', () => {
      const htmlSrc = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf-8')
      assert.ok(htmlSrc.includes('id="modal-license-activation"'))
      assert.ok(htmlSrc.includes('id="step-license-activation"'))
      assert.ok(htmlSrc.includes('id="step-gemini-onboarding"'))
      assert.ok(htmlSrc.includes('id="gemini-key-masked-display"'))
      assert.ok(htmlSrc.includes('id="input-onboarding-gemini-key"'))
      assert.ok(htmlSrc.includes('id="tab-license"'))
      assert.ok(htmlSrc.includes('id="input-license-key"'))
      assert.ok(htmlSrc.includes('id="tab-btn-activate-key"'))

      const ipcSrc = fs.readFileSync(path.join(process.cwd(), 'src/main/ipc/register-ipc.ts'), 'utf-8')
      assert.ok(ipcSrc.includes('cfg.licenseStatus !== \'active\''))
      assert.ok(ipcSrc.includes('LICENSE_GET_STATUS'))
      assert.ok(ipcSrc.includes('LICENSE_ACTIVATE'))
      assert.ok(ipcSrc.includes('LICENSE_GET_HWID'))

      const mainSrc = fs.readFileSync(path.join(process.cwd(), 'src/renderer/main.ts'), 'utf-8')
      assert.ok(mainSrc.includes('licenseModal.checkOnStartup()'))
      assert.ok(mainSrc.includes('!lic.isLicensed'))
      assert.ok(mainSrc.includes('onLicenseRevoked'))
    })
  })
})

