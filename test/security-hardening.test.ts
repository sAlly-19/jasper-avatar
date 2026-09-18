import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

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

describe('Suíte de Testes de Integração com Classes e Módulos Reais', () => {

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
  })

  // 2. Central ToolPolicyEngine & Sandboxing
  describe('ToolPolicyEngine (Políticas Zero-Trust Reais)', () => {
    test('bloqueia código Python perigoso com subprocessos, ctypes e traversal', () => {
      const r1 = toolPolicyEngine.validateCode('python', 'import subprocess; subprocess.Popen(["calc"])')
      assert.equal(r1.allowed, false)
      assert.equal(r1.riskLevel, 'HIGH')

      const r2 = toolPolicyEngine.validateCode('python', 'import os; os.system("dir")')
      assert.equal(r2.allowed, false)

      const r3 = toolPolicyEngine.validateCode('python', 'import ctypes; ctypes.cdll.LoadLibrary("kernel32")')
      assert.equal(r3.allowed, false)

      const r4 = toolPolicyEngine.validateCode('python', 'x = eval("__import__(\'os\')")')
      assert.equal(r4.allowed, false)
    })

    test('permite código matemático/científico legítimo em Python', () => {
      const safe = toolPolicyEngine.validateCode('python', 'import math\ndef calc(n):\n    return math.sqrt(n)\nprint(calc(16))')
      assert.equal(safe.allowed, true)
      assert.equal(safe.riskLevel, 'SAFE')
    })

    test('bloqueia código Node.js com child_process, worker_threads e eval', () => {
      const r1 = toolPolicyEngine.validateCode('javascript', 'const { exec } = require("child_process"); exec("calc");')
      assert.equal(r1.allowed, false)

      const r2 = toolPolicyEngine.validateCode('javascript', 'eval("process.exit(1)")')
      assert.equal(r2.allowed, false)
    })

    test('bloqueia execução de shell / bash arbitrário', () => {
      const r = toolPolicyEngine.validateCode('bash', 'rm -rf /')
      assert.equal(r.allowed, false)
      assert.equal(r.riskLevel, 'CRITICAL')
    })

    test('bloqueia acesso a diretórios de sistema do Windows', () => {
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\Windows\\System32\\cmd.exe').allowed, false)
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\Program Files\\app\\config.json').allowed, false)
    })

    test('valida contenção de caminhos e bloqueia directory traversal', () => {
      const base = 'C:\\temp\\sandbox'
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\temp\\sandbox\\out.txt', base).allowed, true)
      assert.equal(toolPolicyEngine.validatePathContainment('C:\\temp\\sandbox\\..\\secret.key', base).allowed, false)
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
  })

  // 4. SmartHomeService & Zero-Trust Domain Policy
  describe('SmartHomeService (Allowlist de Domínios Real)', () => {
    test('permite eletrodomésticos seguros (light, climate, switch)', async () => {
      const service = new SmartHomeService()
      const res = await service.executeCommand('light', 'turn_on', 'light.sala')
      assert.equal(res.success, true)
      assert.ok(res.message.includes('Simulado') || res.message.includes('sucesso'))
    })

    test('bloqueia expressamente domínios de segurança física (lock, alarm, garage)', async () => {
      const service = new SmartHomeService()
      const lockRes = await service.executeCommand('lock', 'unlock', 'lock.porta_entrada')
      assert.equal(lockRes.success, false)
      assert.ok(lockRes.message.includes('SEGURANÇA BLOQUEADA'))

      const alarmRes = await service.executeCommand('alarm_control_panel', 'disarm', 'alarm.casa')
      assert.equal(alarmRes.success, false)
      assert.ok(alarmRes.message.includes('SEGURANÇA BLOQUEADA'))
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
      const check = engine.preExecutionCheck('git_commit_changes', {
        message: 'feat: nova funcionalidade',
        files: ['src/app.ts']
      })
      assert.equal(check.allowed, false)
      assert.equal(check.requiresConfirmation, true)
      assert.ok(check.reason?.includes('Operação de commit Git solicitada'))
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
      assert.ok(wakeWordManagerSrc.includes('[TensorFlow]'))

      const speechCommandsSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/speech-commands.ts'),
        'utf-8'
      )
      // Confirma a correção essencial para o "Erro no treinamento"
      assert.ok(speechCommandsSrc.includes('tr.secondLastBaseDenseLayer = null'))
      assert.ok(speechCommandsSrc.includes('tr.model = null'))
      assert.ok(speechCommandsSrc.includes('tr.model.dispose()'))
    })

    test('speech-commands implementa modelo neural de 3 classes com amostras negativas e threshold de 0.85', () => {
      const speechCommandsSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/audio/speech-commands.ts'),
        'utf-8'
      )
      // Confirma filtro explícito de fala comum / amostras negativas
      assert.ok(speechCommandsSrc.includes("detectedWord === '_other_'"))
      assert.ok(speechCommandsSrc.includes("detectedWord === '_background_noise_'"))

      // Confirma hiperparâmetros anti-falso-positivo
      assert.ok(speechCommandsSrc.includes('probabilityThreshold: options.probabilityThreshold ?? 0.85'))
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

    test('Gemini Live client utiliza o modelo oficial gemini-3.1-flash-live-preview', () => {
      const liveClientSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/main/gemini-live.ts'),
        'utf-8'
      )
      assert.ok(liveClientSrc.includes('gemini-3.1-flash-live-preview'))
    })
  })
})

