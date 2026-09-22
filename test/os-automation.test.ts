import test from 'node:test'
import assert from 'node:assert/strict'
import { processManager } from '../src/main/autonomous/process-manager'
import { mediaController } from '../src/main/autonomous/media-controller'
import { uiAutomation } from '../src/main/autonomous/ui-automation'
import { systemHealth } from '../src/main/autonomous/system-health'
import { executeSystemTool } from '../src/main/tools/system-tools'
import { SYSTEM_FUNCTION_DECLARATIONS } from '../src/main/tools/declarations'

test('Parte 1: Automação do Sistema Operacional, Processos & Hardware', async (t) => {
  await t.test('SYSTEM_FUNCTION_DECLARATIONS inclui novas ferramentas de SO e Hardware', () => {
    const names = SYSTEM_FUNCTION_DECLARATIONS.map((d: any) => d.name)
    assert.ok(names.includes('search_program'), 'search_program deve estar declarado')
    assert.ok(names.includes('close_program'), 'close_program deve estar declarado')
    assert.ok(names.includes('list_processes'), 'list_processes deve estar declarado')
    assert.ok(names.includes('control_media_volume'), 'control_media_volume deve estar declarado')
    assert.ok(names.includes('automate_ui'), 'automate_ui deve estar declarado')
    assert.ok(names.includes('get_detailed_hardware_stats'), 'get_detailed_hardware_stats deve estar declarado')
  })

  await t.test('ProcessManagerService: validação de segurança e bloqueio de injeção', async () => {
    const res1 = await processManager.launchProgram('calc; dir')
    assert.equal(res1.success, false)
    assert.match(res1.message, /caracteres inválidos/i)

    const res2 = await processManager.launchProgram('notepad | whoami')
    assert.equal(res2.success, false)
    assert.match(res2.message, /caracteres inválidos/i)

    const res3 = await processManager.launchProgram('calc & calc')
    assert.equal(res3.success, false)
    assert.match(res3.message, /caracteres inválidos/i)
  })

  await t.test('ProcessManagerService: proteção contra encerramento de processos críticos', async () => {
    const resExplorer = await processManager.terminateProgram('explorer.exe')
    assert.equal(resExplorer.success, false)
    assert.match(resExplorer.message, /crítico para o sistema operacional/i)

    const resSvchost = await processManager.terminateProgram('svchost')
    assert.equal(resSvchost.success, false)
    assert.match(resSvchost.message, /crítico para o sistema operacional/i)

    const resElectron = await processManager.terminateProgram('electron')
    assert.equal(resElectron.success, false)
    assert.match(resElectron.message, /crítico para o sistema operacional/i)
  })

  await t.test('ProcessManagerService: busca de programas instalados via StartApps', async () => {
    const results = await processManager.searchPrograms('calc', 5)
    assert.ok(Array.isArray(results), 'Resultado deve ser um array')
    assert.ok(results.length > 0, 'Deve encontrar a calculadora do Windows')
    assert.match(results[0].name, /calculadora|calc/i)
  })

  await t.test('ProcessManagerService: listagem de processos ativos', async () => {
    const procs = await processManager.listRunningProcesses(5)
    assert.ok(Array.isArray(procs), 'Deve retornar lista de processos')
    assert.ok(procs.length > 0, 'Deve retornar ao menos 1 processo')
    assert.ok(typeof procs[0].name === 'string')
    assert.ok(typeof procs[0].pid === 'number')
    assert.ok(procs[0].memoryMb >= 0)
  })

  await t.test('MediaControllerService: comandos de áudio e mídia', async () => {
    const resMute = await mediaController.executeCommand('mute')
    assert.ok(resMute.includes('alternado com sucesso') || resMute.includes('VOLUME_MUTE_OK'))

    const resUnknown = await mediaController.executeCommand('acao_inexistente')
    assert.match(resUnknown, /desconhecido/i)
  })

  await t.test('UIAutomationService: tratamento de parâmetros obrigatórios', async () => {
    const inspectRes = await uiAutomation.inspectWindow('')
    assert.ok(inspectRes.error, 'Deve retornar erro quando o título da janela estiver vazio')

    const clickRes = await uiAutomation.clickElement('', '')
    assert.equal(clickRes.success, false)

    const textRes = await uiAutomation.setElementText('', '', '')
    assert.equal(textRes.success, false)
  })

  await t.test('SystemHealthService: diagnóstico detalhado com systeminformation', async () => {
    const detailed = await systemHealth.getDetailedHardwareStats()
    assert.ok(detailed.cpu.cores > 0, 'CPU deve reportar núcleos > 0')
    assert.ok(detailed.cpu.brand.length > 0, 'CPU deve ter marca identificada')
    assert.ok(detailed.memory.totalGb > 0, 'Memória total deve ser > 0')
    assert.ok(detailed.memory.usagePercent >= 0 && detailed.memory.usagePercent <= 100)
    assert.ok(Array.isArray(detailed.disks), 'Discos deve ser um array')
    assert.ok(detailed.disks.length > 0, 'Deve identificar ao menos 1 disco')
    assert.ok(detailed.osInfo.distro.length > 0, 'Deve identificar a distribuição/versão do OS')
  })

  await t.test('executeSystemTool: integração das ferramentas pelo dispatcher', async () => {
    // 1. search_program
    const searchOut = await executeSystemTool('search_program', { query: 'calc' })
    assert.match(searchOut, /calculadora|calc/i)

    // 2. list_processes
    const procOut = await executeSystemTool('list_processes', { limit: 3 })
    assert.match(procOut, /processos ativos/i)

    // 3. control_media_volume
    const mediaOut = await executeSystemTool('control_media_volume', { command: 'mute' })
    assert.ok(typeof mediaOut === 'string' && mediaOut.length > 0)

    // 4. get_detailed_hardware_stats
    const hwOut = await executeSystemTool('get_detailed_hardware_stats', {})
    assert.match(hwOut, /Processador:/i)
    assert.match(hwOut, /Memória RAM:/i)
    assert.match(hwOut, /Discos e Armazenamento:/i)

    // 5. close_program com proteção
    const closeOut = await executeSystemTool('close_program', { programName: 'explorer' })
    assert.match(closeOut, /crítico para o sistema operacional/i)
  })
})

