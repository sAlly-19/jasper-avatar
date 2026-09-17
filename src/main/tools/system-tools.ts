import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { addFact } from '../memory'
import { evaluateMathExpression } from './math-evaluator'

interface AppConfig {
  cmd: string
  args?: string[]
}

const ALLOWED_APPS: Record<string, AppConfig> = {
  calculadora: { cmd: 'calc.exe' },
  calc: { cmd: 'calc.exe' },
  calculator: { cmd: 'calc.exe' },
  notepad: { cmd: 'notepad.exe' },
  'bloco de notas': { cmd: 'notepad.exe' },
  explorer: { cmd: 'explorer.exe' },
  arquivos: { cmd: 'explorer.exe' },
  cmd: { cmd: 'cmd.exe' },
  terminal: { cmd: 'wt.exe' },
  powershell: { cmd: 'powershell.exe' },
  vscode: { cmd: 'code.cmd' },
  code: { cmd: 'code.cmd' }
}

async function getUniqueDestination(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let dest = path.join(dir, fileName)
  let counter = 1

  while (true) {
    try {
      await fs.access(dest)
      dest = path.join(dir, `${base} (${counter})${ext}`)
      counter++
    } catch {
      return dest
    }
  }
}

export async function executeSystemTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'open_app': {
      const app = (args.appName || '').toLowerCase().trim()
      const config = ALLOWED_APPS[app]

      if (!config) {
        const allowedList = Object.keys(ALLOWED_APPS).slice(0, 8).join(', ')
        return `Por segurança, o aplicativo "${app}" não está na lista de execução direta. Aplicativos autorizados: ${allowedList}.`
      }

      return new Promise((resolve) => {
        try {
          const child = spawn(config.cmd, config.args || [], {
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32'
          })
          let resolved = false
          child.on('error', (err) => {
            if (!resolved) {
              resolved = true
              resolve(`Não foi possível iniciar o aplicativo ${app}: ${err.message}`)
            }
          })
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              child.unref()
              resolve(`Aplicativo ${app} aberto com sucesso.`)
            }
          }, 300)
        } catch (err: any) {
          resolve(`Erro ao iniciar aplicativo ${app}: ${err.message}`)
        }
      })
    }

    case 'calculate': {
      const expr = (args.expression || '').trim()
      if (!expr) {
        return 'Nenhuma expressão informada para cálculo.'
      }
      try {
        const result = evaluateMathExpression(expr)
        const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '')
        return `O resultado do cálculo de ${expr} é ${formatted}.`
      } catch (err: any) {
        return `Erro ao calcular a expressão "${expr}": ${err.message}`
      }
    }

    case 'organize_folder': {
      const folderAlias = (args.targetFolder || 'downloads').toLowerCase().trim()
      const home = os.homedir()
      let targetDir = path.join(home, 'Downloads')
      if (folderAlias.includes('desktop') || folderAlias.includes('área de trabalho')) {
        targetDir = path.join(home, 'Desktop')
      } else if (folderAlias.includes('documentos') || folderAlias.includes('documents')) {
        targetDir = path.join(home, 'Documents')
      }

      try {
        await fs.access(targetDir)
      } catch {
        return `Diretório não encontrado: ${targetDir}`
      }

      try {
        const entries = await fs.readdir(targetDir, { withFileTypes: true })
        let count = 0

        for (const entry of entries) {
          if (!entry.isFile()) continue
          const ext = path.extname(entry.name).toLowerCase().replace('.', '')
          if (!ext) continue

          let category = 'Outros'
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
            category = 'Imagens'
          } else if (['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'txt', 'csv'].includes(ext)) {
            category = 'Documentos'
          } else if (['exe', 'msi', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            category = 'Instaladores_Compactados'
          } else if (['mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac'].includes(ext)) {
            category = 'Midia'
          }

          try {
            const catDir = path.join(targetDir, category)
            await fs.mkdir(catDir, { recursive: true })

            const sourcePath = path.join(targetDir, entry.name)
            const targetPath = await getUniqueDestination(catDir, entry.name)
            await fs.rename(sourcePath, targetPath)
            count++
          } catch (fileErr: any) {
            console.warn(`[SystemTools] Não foi possível mover arquivo "${entry.name}":`, fileErr.message)
          }
        }

        return `Sucesso: Organizei ${count} arquivos na pasta ${path.basename(targetDir)} em categorias seguras sem perda de dados.`
      } catch (err: any) {
        return `Falha ao organizar pasta: ${err.message}`
      }
    }

    case 'remember_fact': {
      const fact = (args.fact || '').trim()
      if (!fact) return 'Nenhum fato fornecido para memorização.'
      return addFact(fact)
    }

    default:
      return `Ferramenta ${name} não reconhecida.`
  }
}

