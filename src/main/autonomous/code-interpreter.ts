import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import type { CodeExecutionResult } from '@shared'

export class CodeInterpreter {
  private enabled: boolean = true
  private sandboxDir: string

  constructor() {
    this.sandboxDir = join(app.getPath('userData'), 'sandbox')
    this.ensureSandboxDir()
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public getSandboxDir(): string {
    this.ensureSandboxDir()
    return this.sandboxDir
  }

  private ensureSandboxDir(): void {
    try {
      if (!fs.existsSync(this.sandboxDir)) {
        fs.mkdirSync(this.sandboxDir, { recursive: true })
        console.log('[CodeInterpreter] Created sandbox directory at:', this.sandboxDir)
      }
    } catch (err) {
      console.error('[CodeInterpreter] Failed to create sandbox directory:', err)
    }
  }

  public listSandboxFiles(): string[] {
    this.ensureSandboxDir()
    try {
      return fs.readdirSync(this.sandboxDir)
    } catch {
      return []
    }
  }

  public clearSandbox(): void {
    this.ensureSandboxDir()
    try {
      const files = fs.readdirSync(this.sandboxDir)
      for (const file of files) {
        const p = join(this.sandboxDir, file)
        const stat = fs.statSync(p)
        if (stat.isFile()) {
          fs.unlinkSync(p)
        }
      }
      console.log('[CodeInterpreter] Sandbox cleared successfully.')
    } catch (err) {
      console.warn('[CodeInterpreter] Error clearing sandbox:', err)
    }
  }

  public async execute(
    language: 'python' | 'javascript' | 'bash',
    code: string,
    timeoutMs: number = 30000
  ): Promise<CodeExecutionResult> {
    if (!this.enabled) {
      return {
        success: false,
        language,
        stdout: '',
        stderr: 'O interpretador de código está desativado nas configurações.',
        executionTimeMs: 0,
        generatedFiles: [],
        error: 'Serviço desativado'
      }
    }

    this.ensureSandboxDir()
    const startTime = Date.now()
    const beforeFiles = new Set(this.listSandboxFiles())

    const ext = language === 'python' ? 'py' : 'js'
    const scriptFileName = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`
    const scriptPath = join(this.sandboxDir, scriptFileName)

    try {
      fs.writeFileSync(scriptPath, code, 'utf-8')
    } catch (err: any) {
      return {
        success: false,
        language,
        stdout: '',
        stderr: `Erro ao gravar script no sandbox: ${err.message}`,
        executionTimeMs: 0,
        generatedFiles: [],
        error: err.message
      }
    }

    const command = language === 'python' ? 'python' : 'node'
    const args = language === 'python' ? ['-u', scriptFileName] : [scriptFileName]

    return new Promise<CodeExecutionResult>((resolve) => {
      execFile(
        command,
        args,
        {
          cwd: this.sandboxDir,
          timeout: timeoutMs,
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true
        },
        (error, stdout, stderr) => {
          const executionTimeMs = Date.now() - startTime

          // Cleanup the temporary script
          try {
            if (fs.existsSync(scriptPath)) {
              fs.unlinkSync(scriptPath)
            }
          } catch {}

          // Detect any newly created files in sandbox
          const currentFiles = this.listSandboxFiles()
          const generatedFiles = currentFiles.filter((f) => !beforeFiles.has(f) && f !== scriptFileName)

          if (error) {
            const timedOut = error.killed && error.signal === 'SIGTERM'
            const errorMsg = timedOut
              ? `Execução interrompida por tempo limite (${timeoutMs / 1000}s excedidos).`
              : error.message

            return resolve({
              success: false,
              language,
              stdout: stdout?.toString() || '',
              stderr: (stderr?.toString() || '') + (errorMsg ? `\n[Erro]: ${errorMsg}` : ''),
              executionTimeMs,
              generatedFiles,
              error: errorMsg
            })
          }

          resolve({
            success: true,
            language,
            stdout: stdout?.toString() || '',
            stderr: stderr?.toString() || '',
            executionTimeMs,
            generatedFiles
          })
        }
      )
    })
  }
}

export const codeInterpreter = new CodeInterpreter()

