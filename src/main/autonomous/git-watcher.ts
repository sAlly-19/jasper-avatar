import { execFile } from 'child_process'
import { join } from 'path'
import fs from 'fs'
import type { GitStatusResult, AutonomyNotification } from '@shared'

export class GitWatcher {
  private enabled: boolean = true
  private defaultRepoPath: string = process.cwd()
  private timer: NodeJS.Timeout | null = null
  private onNotification?: (notif: AutonomyNotification) => void

  constructor() {
    this.startPeriodicCheck()
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) {
      this.startPeriodicCheck()
    } else {
      this.stop()
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setOnNotification(cb: (notif: AutonomyNotification) => void): void {
    this.onNotification = cb
  }

  public setDefaultRepoPath(repoPath: string): void {
    this.defaultRepoPath = repoPath
  }

  private execGit(args: string[], cwd: string = this.defaultRepoPath): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      execFile('git', args, { cwd, windowsHide: true }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout ? stdout.trim() : '',
          stderr: stderr ? stderr.trim() : '',
          code: err ? (err as any).code || 1 : 0
        })
      })
    })
  }

  public async checkRepo(repoPath: string = this.defaultRepoPath): Promise<GitStatusResult> {
    if (!this.enabled) {
      return {
        isGit: false,
        branch: '',
        modifiedFiles: [],
        untrackedFiles: [],
        deletedFiles: [],
        lastCommit: '',
        changesSummary: 'Git Watcher está desativado nas configurações.'
      }
    }

    const isInsideWorkTree = await this.execGit(['rev-parse', '--is-inside-work-tree'], repoPath)
    if (isInsideWorkTree.code !== 0 || isInsideWorkTree.stdout !== 'true') {
      return {
        isGit: false,
        branch: '',
        modifiedFiles: [],
        untrackedFiles: [],
        deletedFiles: [],
        lastCommit: '',
        changesSummary: `O diretório "${repoPath}" não é um repositório Git válido.`
      }
    }

    const branchRes = await this.execGit(['branch', '--show-current'], repoPath)
    const branch = branchRes.stdout || 'main'

    const logRes = await this.execGit(['log', '-1', '--pretty=format:%h - %s (%cr)'], repoPath)
    const lastCommit = logRes.stdout || 'Nenhum commit ainda'

    const statusRes = await this.execGit(['status', '--porcelain'], repoPath)
    const lines = statusRes.stdout ? statusRes.stdout.split('\n').map((l) => l.trim()).filter(Boolean) : []

    const modifiedFiles: string[] = []
    const untrackedFiles: string[] = []
    const deletedFiles: string[] = []

    for (const line of lines) {
      const code = line.slice(0, 2).trim()
      const filePath = line.slice(3).trim()
      if (code === '??') {
        untrackedFiles.push(filePath)
      } else if (code === 'D') {
        deletedFiles.push(filePath)
      } else {
        modifiedFiles.push(filePath)
      }
    }

    const totalChanges = modifiedFiles.length + untrackedFiles.length + deletedFiles.length
    let changesSummary = ''
    if (totalChanges === 0) {
      changesSummary = `Repositório limpo na branch "${branch}". Sem alterações pendentes.`
    } else {
      changesSummary = `Branch "${branch}": ${modifiedFiles.length} arquivos modificados, ${untrackedFiles.length} novos, ${deletedFiles.length} excluídos.`
    }

    const suggestedCommitMessage = this.generateSemanticCommitMessage(modifiedFiles, untrackedFiles, deletedFiles)

    return {
      isGit: true,
      branch,
      modifiedFiles,
      untrackedFiles,
      deletedFiles,
      lastCommit,
      changesSummary,
      suggestedCommitMessage: totalChanges > 0 ? suggestedCommitMessage : undefined
    }
  }

  public async suggestCommit(repoPath: string = this.defaultRepoPath): Promise<{
    suggestion: string
    diffSummary: string
    branch: string
  }> {
    const status = await this.checkRepo(repoPath)
    if (!status.isGit) {
      return {
        suggestion: '',
        diffSummary: 'Não é um repositório Git.',
        branch: ''
      }
    }

    const diffStat = await this.execGit(['diff', '--stat'], repoPath)
    const cachedStat = await this.execGit(['diff', '--cached', '--stat'], repoPath)
    const combinedDiff = (cachedStat.stdout ? `Staged:\n${cachedStat.stdout}\n\n` : '') + (diffStat.stdout || 'Nenhum diff detalhado.')

    return {
      suggestion: status.suggestedCommitMessage || 'chore: atualizações gerais no projeto',
      diffSummary: combinedDiff,
      branch: status.branch
    }
  }

  public async commitChanges(message: string, repoPath: string = this.defaultRepoPath): Promise<{ success: boolean; output: string }> {
    if (!message || !message.trim()) {
      return { success: false, output: 'Mensagem de commit não informada.' }
    }

    const addRes = await this.execGit(['add', '-A'], repoPath)
    if (addRes.code !== 0) {
      return { success: false, output: `Falha ao executar git add: ${addRes.stderr}` }
    }

    const commitRes = await this.execGit(['commit', '-m', message], repoPath)
    if (commitRes.code !== 0) {
      return { success: false, output: `Falha ao executar git commit: ${commitRes.stderr}` }
    }

    return { success: true, output: commitRes.stdout }
  }

  public async runTests(repoPath: string = this.defaultRepoPath, customCommand?: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const packageJsonPath = join(repoPath, 'package.json')
      const isNodeProject = fs.existsSync(packageJsonPath)
      const command = customCommand || (isNodeProject ? 'npm' : 'pytest')
      const args = customCommand ? [] : isNodeProject ? ['test'] : []

      execFile(command, args, { cwd: repoPath, timeout: 60000, windowsHide: true, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
        const out = (stdout ? stdout.toString() : '') + (stderr ? '\n' + stderr.toString() : '')
        resolve({
          success: !err,
          output: out.trim() || (err ? err.message : 'Testes executados com sucesso.')
        })
      })
    })
  }

  private generateSemanticCommitMessage(modified: string[], untracked: string[], deleted: string[]): string {
    const all = [...modified, ...untracked]

    // Documentation check
    if (all.every((f) => f.endsWith('.md') || f.includes('docs/'))) {
      return 'docs: atualizar documentação e guias do projeto'
    }

    // Testing check
    if (all.every((f) => f.includes('test') || f.includes('spec'))) {
      return 'test: adicionar e atualizar suíte de testes unitários'
    }

    // Bug fixes or styles
    if (all.some((f) => f.includes('fix') || f.includes('bug'))) {
      return 'fix: corrigir inconsistências e ajustar comportamento'
    }

    // UI / Style
    if (all.every((f) => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.html'))) {
      return 'style: aprimorar layout e estilos visuais da interface'
    }

    // Feature additions
    if (untracked.length > 0) {
      const primary = untracked[0].split(/[/\\]/).pop() || 'componentes'
      return `feat: implementar novo recurso em ${primary}`
    }

    if (deleted.length > 0 && modified.length === 0) {
      return 'chore: remover arquivos e módulos depreciados'
    }

    const firstMod = modified[0]?.split(/[/\\]/).pop() || 'módulos'
    return `feat: atualizar e aprimorar ${firstMod}`
  }

  private startPeriodicCheck(): void {
    if (this.timer) clearInterval(this.timer)
    // Check every 15 minutes in background
    this.timer = setInterval(async () => {
      if (!this.enabled) return
      try {
        const status = await this.checkRepo()
        const total = status.modifiedFiles.length + status.untrackedFiles.length
        if (total > 5 && this.onNotification) {
          this.onNotification({
            id: `git-${Date.now()}`,
            type: 'info',
            title: 'Git Watcher: Arquivos Pendentes',
            message: `Detectei ${total} arquivos alterados na branch "${status.branch}". Deseja que eu elabore um commit semântico?`,
            timestamp: Date.now(),
            data: status
          })
        }
      } catch {}
    }, 15 * 60 * 1000)
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

export const gitWatcher = new GitWatcher()

