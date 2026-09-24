import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import { reportGenerator } from '../src/main/autonomous/report-generator'
import { fileSummarizer } from '../src/main/autonomous/file-summarizer'
import { qrService } from '../src/main/autonomous/qr-service'
import { clipboardWatcher } from '../src/main/autonomous/clipboard-watcher'
import { executeSystemTool } from '../src/main/tools/system-tools'
import { SYSTEM_FUNCTION_DECLARATIONS } from '../src/main/tools/declarations'

test('Parte 2: Produtividade, Relatórios Executivos, Arquivos & QR Code', async (t) => {
  await t.test('SYSTEM_FUNCTION_DECLARATIONS inclui ferramentas da Parte 2', () => {
    const names = SYSTEM_FUNCTION_DECLARATIONS.map((d: any) => d.name)
    assert.ok(names.includes('generate_report_pdf'), 'generate_report_pdf deve estar declarado')
    assert.ok(names.includes('generate_spreadsheet'), 'generate_spreadsheet deve estar declarado')
    assert.ok(names.includes('generate_word_document'), 'generate_word_document deve estar declarado')
    assert.ok(names.includes('read_and_summarize_file'), 'read_and_summarize_file deve estar declarado')
    assert.ok(names.includes('summarize_clipboard'), 'summarize_clipboard deve estar declarado')
    assert.ok(names.includes('generate_qr_code'), 'generate_qr_code deve estar declarado')
  })

  await t.test('ReportGeneratorService: geração de PDF com printToPDF', async () => {
    const res = await reportGenerator.generatePdfReport(
      'Relatório de Desempenho Mensal',
      '<h2>Resumo Executivo</h2><p>As metas foram 100% atingidas.</p><table><tr><th>Item</th><th>Valor</th></tr><tr><td>Vendas</td><td>R$ 150.000</td></tr></table>',
      'teste_desempenho.pdf'
    )
    assert.equal(res.success, true)
    assert.ok(res.filePath, 'Deve retornar o caminho do arquivo gerado')
    const stat = await fs.stat(res.filePath!)
    assert.ok(stat.size > 0, 'O arquivo PDF gerado deve ter tamanho > 0')
  })

  await t.test('ReportGeneratorService: geração de planilha Excel (.xlsx) com exceljs', async () => {
    const columns = [
      { header: 'Produto', key: 'produto', width: 25 },
      { header: 'Quantidade', key: 'qtd', width: 15 },
      { header: 'Preço Unitário', key: 'preco', width: 18 }
    ]
    const rows = [
      { produto: 'Jasper Avatar Pro', qtd: 10, preco: 'R$ 197,00' },
      { produto: 'Módulo Visão Noturna', qtd: 5, preco: 'R$ 97,00' },
      { produto: 'Suporte VIP 24h', qtd: 1, preco: 'R$ 49,00' }
    ]

    const res = await reportGenerator.generateExcelSpreadsheet(
      'Faturamento e Licenças',
      columns,
      rows,
      'teste_faturamento.xlsx'
    )
    assert.equal(res.success, true)
    assert.ok(res.filePath, 'Deve retornar caminho do arquivo .xlsx')
    const stat = await fs.stat(res.filePath!)
    assert.ok(stat.size > 0, 'O arquivo .xlsx deve ter tamanho > 0')
  })

  await t.test('ReportGeneratorService: geração de documento Word (.docx) com docx', async () => {
    const sections = [
      { heading: 'Introdução ao Jasper', paragraph: 'O Jasper Avatar é um assistente de inteligência artificial autônomo com suporte multimodal e voz de baixa latência.' },
      { heading: 'Arquitetura de Segurança', paragraph: 'Todas as chaves de API e licenças utilizam criptografia de hardware Windows Data Protection API (DPAPI).' }
    ]

    const res = await reportGenerator.generateWordDocument(
      'Manual Oficial do Jasper',
      sections,
      'teste_manual.docx'
    )
    assert.equal(res.success, true)
    assert.ok(res.filePath, 'Deve retornar caminho do arquivo .docx')
    const stat = await fs.stat(res.filePath!)
    assert.ok(stat.size > 0, 'O arquivo .docx deve ter tamanho > 0')
  })

  await t.test('FileSummarizerService: leitura e análise de arquivo de texto local', async () => {
    // Criar arquivo temporário de teste
    const tempFile = path.join(app.getPath('documents'), 'teste_documento_jasper.txt')
    const sampleText = `Relatório de Auditoria Jasper\nData: 2026-09-21\nStatus: APROVADO\nToken Secreto: sk-1234567890abcdef1234567890\nLinha final do documento.` // secret-scan: allow
    await fs.writeFile(tempFile, sampleText, 'utf-8')

    const res = await fileSummarizer.readFileContent(tempFile)
    assert.equal(res.success, true)
    assert.equal(res.totalLines, 5)
    assert.ok(res.extractedText.includes('[REDACTED_SECRET_KEY]'), 'Chaves secretas devem ser sanitizadas')
    assert.ok(!res.extractedText.includes('sk-1234567890abcdef'), 'Chave crua não deve vazar')

    const analysis = await fileSummarizer.analyzeFile(tempFile)
    assert.match(analysis, /Análise do Arquivo/i)
    assert.match(analysis, /Status: APROVADO/i)

    // Arquivo inexistente
    const errRes = await fileSummarizer.readFileContent(path.join(app.getPath('documents'), 'arquivo_que_nao_existe_xyz.txt'))
    assert.equal(errRes.success, false)
    assert.ok(errRes.error)
  })

  await t.test('QrService: geração de QR Code em arquivo PNG e DataURL', async () => {
    // 1. Em arquivo PNG
    const resFile = await qrService.generateQrCode('https://jasper.ai/download', 'teste_qrcode.png', 'png')
    assert.equal(resFile.success, true)
    assert.ok(resFile.filePath)
    const stat = await fs.stat(resFile.filePath!)
    assert.ok(stat.size > 0, 'O arquivo PNG do QR Code deve existir')

    // 2. Em DataURL
    const resData = await qrService.generateQrCode('WIFI:T:WPA;S:MinhaRede;P:SenhaForte;;', undefined, 'dataUrl')
    assert.equal(resData.success, true)
    assert.ok(resData.dataUrl?.startsWith('data:image/png;base64,'))
  })

  await t.test('ClipboardWatcherService: resumo e diagnóstico do clipboard', async () => {
    const res = await clipboardWatcher.summarizeClipboard('summarize')
    assert.ok(typeof res === 'string' && res.length > 0)

    const resTrans = await clipboardWatcher.summarizeClipboard('translate')
    assert.match(resTrans, /Tradução|vazia/i)
  })

  await t.test('executeSystemTool: despacho integrado de ferramentas da Parte 2', async () => {
    // 1. generate_report_pdf
    const pdfMsg = await executeSystemTool('generate_report_pdf', {
      title: 'Auditoria de Segurança',
      contentHtml: '<p>Tudo 100% verificado.</p>'
    })
    assert.match(pdfMsg, /gerado com sucesso/i)

    // 2. generate_spreadsheet
    const sheetMsg = await executeSystemTool('generate_spreadsheet', {
      title: 'Tabela de Custos',
      columnsJson: JSON.stringify([{ header: 'Custo', key: 'c' }]),
      rowsJson: JSON.stringify([{ c: 'Zero' }])
    })
    assert.match(sheetMsg, /Planilha Excel/i)

    // 3. generate_word_document
    const docxMsg = await executeSystemTool('generate_word_document', {
      title: 'Proposta',
      sectionsJson: JSON.stringify([{ paragraph: 'Parágrafo de teste' }])
    })
    assert.match(docxMsg, /Documento Word/i)

    // 4. generate_qr_code
    const qrMsg = await executeSystemTool('generate_qr_code', { data: 'https://exemplo.com' })
    assert.match(qrMsg, /QR Code gerado/i)
  })
})

