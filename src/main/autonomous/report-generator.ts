import { BrowserWindow, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import ExcelJS from 'exceljs'
import * as docx from 'docx'
import { configStore } from '../config/config-store'

export interface ReportGenerationResult {
  success: boolean
  filePath?: string
  message: string
}

export interface ExcelColumn {
  header: string
  key: string
  width?: number
}

export interface WordSection {
  heading?: string
  paragraph: string
}

function safeOutputName(requestedName: string | undefined, fallback: string, extension: string): string {
  const source = requestedName?.trim() || fallback
  const base = path.basename(source, path.extname(source))
  const normalized = base
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)

  return `${normalized || `jasper_${Date.now()}`}.${extension}`
}

export class ReportGeneratorService {
  private isEnabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Resolves the target directory configured by the user or falls back to Documents/Jasper_Relatorios
   */
  public async getTargetDirectory(): Promise<string> {
    const cfg = configStore.getConfig()
    let target = cfg.folderDefaultTarget?.trim()

    if (target) {
      const lower = target.toLowerCase()
      if (lower === 'downloads' || lower === 'download') {
        target = app.getPath('downloads')
      } else if (lower === 'desktop' || lower === 'area de trabalho') {
        target = app.getPath('desktop')
      } else if (lower === 'documents' || lower === 'documentos') {
        target = app.getPath('documents')
      }
    }

    if (!target) {
      target = path.join(os.homedir(), 'Documents', 'Jasper_Relatorios')
    }

    target = path.resolve(target)

    try {
      await fs.mkdir(target, { recursive: true })
    } catch {
      target = path.join(os.tmpdir(), 'Jasper_Relatorios')
      await fs.mkdir(target, { recursive: true })
    }

    return target
  }

  /**
   * Generates a high-resolution executive PDF report using Electron's native webContents.printToPDF()
   */
  public async generatePdfReport(
    title: string,
    contentHtml: string,
    fileName?: string
  ): Promise<ReportGenerationResult> {
    const targetDir = await this.getTargetDirectory()
    const cleanTitle = title.trim() || 'Relatorio_Executivo'
    const safeName = safeOutputName(fileName, `${cleanTitle}_${Date.now()}`, 'pdf')
    const finalPath = path.join(targetDir, safeName)

    const dateStr = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
  <style>
    @page { margin: 20mm; size: A4 portrait; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand span {
      color: #0284c7;
    }
    .meta {
      font-size: 11px;
      color: #64748b;
      text-align: right;
    }
    h1 {
      color: #0f172a;
      font-size: 22px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .content {
      font-size: 13px;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12px;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">JASPER <span>AVATAR</span></div>
    <div class="meta">
      Gerado automaticamente por I.A.<br>
      ${dateStr}
    </div>
  </div>
  <div class="badge">RELATÓRIO OFICIAL</div>
  <h1>${cleanTitle}</h1>
  <div class="content">
    ${contentHtml}
  </div>
  <div class="footer">
    Documento confidencial gerado pelo Jasper Avatar HUD - Todos os direitos reservados.
  </div>
</body>
</html>`

    let win: BrowserWindow | null = null
    try {
      win = new BrowserWindow({
        show: false,
        width: 1200,
        height: 900,
        webPreferences: {
          sandbox: true,
          javascript: false,
          webSecurity: true,
          allowRunningInsecureContent: false
        }
      })

      // SEC-06: Block network/file subrequests to prevent SSRF and local file leaks via <img> or @import
      win.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        if (details.url.startsWith('data:')) {
          callback({ cancel: false })
        } else {
          callback({ cancel: true })
        }
      })

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`
      await win.loadURL(dataUrl)

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        }
      })

      await fs.writeFile(finalPath, pdfBuffer)

      return {
        success: true,
        filePath: finalPath,
        message: `Relatório em PDF "${safeName}" gerado com sucesso e salvo em: ${finalPath}`
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao gerar relatório PDF: ${err.message}`
      }
    } finally {
      if (win && !win.isDestroyed()) {
        try {
          win.destroy()
        } catch {}
      }
    }
  }

  /**
   * Generates a styled Excel spreadsheet (.xlsx) using exceljs
   */
  public async generateExcelSpreadsheet(
    title: string,
    columns: ExcelColumn[],
    rows: Array<Record<string, any>>,
    fileName?: string
  ): Promise<ReportGenerationResult> {
    try {
      const targetDir = await this.getTargetDirectory()
      const cleanTitle = title.trim() || 'Planilha_Jasper'
      const safeName = safeOutputName(fileName, `${cleanTitle}_${Date.now()}`, 'xlsx')
      const finalPath = path.join(targetDir, safeName)

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Jasper Avatar AI'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet(cleanTitle.slice(0, 30))

      // Setup columns
      sheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || Math.max(15, col.header.length + 5)
      }))

      // Header row styling
      const headerRow = sheet.getRow(1)
      headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0284C7' } // Sky blue 600
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 24

      // Add data rows
      rows.forEach((row, idx) => {
        const addedRow = sheet.addRow(row)
        addedRow.height = 20
        addedRow.alignment = { vertical: 'middle' }

        // Alternate row fill
        if (idx % 2 === 1) {
          addedRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          }
        }

        // Add thin border to each cell
        addedRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }
        })
      })

      await workbook.xlsx.writeFile(finalPath)

      return {
        success: true,
        filePath: finalPath,
        message: `Planilha Excel "${safeName}" gerada com ${rows.length} linhas e salva em: ${finalPath}`
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao gerar planilha Excel: ${err.message}`
      }
    }
  }

  /**
   * Generates a formatted Word document (.docx) using docx
   */
  public async generateWordDocument(
    title: string,
    sections: WordSection[],
    fileName?: string
  ): Promise<ReportGenerationResult> {
    try {
      const targetDir = await this.getTargetDirectory()
      const cleanTitle = title.trim() || 'Documento_Jasper'
      const safeName = safeOutputName(fileName, `${cleanTitle}_${Date.now()}`, 'docx')
      const finalPath = path.join(targetDir, safeName)

      const docParagraphs: docx.Paragraph[] = []

      // Title
      docParagraphs.push(
        new docx.Paragraph({
          text: cleanTitle,
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        })
      )

      // Meta date
      docParagraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: `Gerado automaticamente pelo Jasper Avatar em ${new Date().toLocaleDateString('pt-BR')}`,
              italics: true,
              color: '64748B',
              size: 18
            })
          ],
          spacing: { after: 300 }
        })
      )

      // Sections
      for (const sec of sections) {
        if (sec.heading) {
          docParagraphs.push(
            new docx.Paragraph({
              text: sec.heading,
              heading: docx.HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 120 }
            })
          )
        }

        docParagraphs.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: sec.paragraph,
                size: 22,
                color: '334155'
              })
            ],
            spacing: { after: 200 },
            alignment: docx.AlignmentType.JUSTIFIED
          })
        )
      }

      const doc = new docx.Document({
        sections: [
          {
            properties: {},
            children: docParagraphs
          }
        ]
      })

      const buffer = await docx.Packer.toBuffer(doc)
      await fs.writeFile(finalPath, buffer)

      return {
        success: true,
        filePath: finalPath,
        message: `Documento Word "${safeName}" criado com sucesso e salvo em: ${finalPath}`
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao gerar documento Word: ${err.message}`
      }
    }
  }
}

export const reportGenerator = new ReportGeneratorService()

