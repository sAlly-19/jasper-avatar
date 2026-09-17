import path from 'path'
import { isPrivateOrLoopbackHost } from './webhook-manager'

export interface PolicyCheckResult {
  allowed: boolean
  riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  reason?: string
  requiresConfirmation?: boolean
}

// Static AST / Regex banned patterns for Code Interpreter
const BANNED_PYTHON_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\b(subprocess|ctypes|pty|socket)\b/i, description: 'Módulos de baixo nível de rede ou criação de subprocessos' },
  { pattern: /\bos\.(system|popen|spawn|fork|exec|kill)\b/i, description: 'Chamadas diretas de execução de comandos do sistema operacional (os.*)' },
  { pattern: /\bshutil\.(rmtree|move)\b/i, description: 'Exclusão ou movimentação de diretórios inteiros via shutil' },
  { pattern: /\b(eval|exec)\s*\(/i, description: 'Execução dinâmica de strings arbitrárias (eval/exec)' },
  { pattern: /__import__\s*\(/i, description: 'Importação dinâmica obscura (__import__)' },
  { pattern: /\bos\.(remove|unlink)\b/i, description: 'Exclusão direta de arquivos fora de controle' },
  { pattern: /\b(\.\.[/\\]|[A-Za-z]:[/\\](windows|winnt|system32|program files))/i, description: 'Tentativa de escape do diretório sandbox ou acesso a pastas do sistema' }
]

const BANNED_NODE_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /\b(child_process|worker_threads|cluster)\b/i, description: 'Criação de novos processos filhos ou threads em Node.js' },
  { pattern: /\b(eval|Function)\s*\(/i, description: 'Geração e execução dinâmica de código a partir de strings' },
  { pattern: /\bprocess\.(exit|kill|abort)\b/i, description: 'Interrupção forçada do processo hospedeiro' },
  { pattern: /\bfs\.(rmSync|rmdirSync|unlinkSync)\b/i, description: 'Exclusão síncrona não contida de arquivos do sistema' },
  { pattern: /\b(net|dgram)\b/i, description: 'Criação de sockets TCP/UDP de baixo nível' },
  { pattern: /\b(\.\.[/\\]|[A-Za-z]:[/\\](windows|winnt|system32|program files))/i, description: 'Tentativa de escape de diretório ou acesso ao sistema Windows' }
]

const SYSTEM_PATH_BLACKLIST = [
  /[/\\]windows([/\\]|$)/i,
  /[/\\]system32([/\\]|$)/i,
  /[/\\]syswow64([/\\]|$)/i,
  /[/\\]program files([/\\]|$)/i,
  /[/\\]program files \(x86\)([/\\]|$)/i,
  /[/\\]appdata[/\\]local[/\\]microsoft([/\\]|$)/i
]

const SAFE_SMART_HOME_DOMAINS = new Set(['light', 'switch', 'climate'])

export class ToolPolicyEngine {
  /**
   * Static scan for arbitrary code execution in CodeInterpreter.
   */
  public validateCode(language: 'python' | 'javascript' | 'bash', code: string): PolicyCheckResult {
    if (language === 'bash') {
      return {
        allowed: false,
        riskLevel: 'CRITICAL',
        reason: 'Execução direta de shell/bash arbitrário é estritamente bloqueada pelo Zero-Trust Policy Engine.',
        requiresConfirmation: true
      }
    }

    const patterns = language === 'python' ? BANNED_PYTHON_PATTERNS : BANNED_NODE_PATTERNS

    for (const { pattern, description } of patterns) {
      if (pattern.test(code)) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Padrão de código perigoso detectado: ${description}.`,
          requiresConfirmation: true
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'SAFE',
      requiresConfirmation: false
    }
  }

  /**
   * Validates if a file or directory path is safe and contained.
   */
  public validatePathContainment(targetPath: string, allowedBaseDir?: string): PolicyCheckResult {
    const normalized = path.resolve(targetPath)

    for (const sysPattern of SYSTEM_PATH_BLACKLIST) {
      if (sysPattern.test(normalized)) {
        return {
          allowed: false,
          riskLevel: 'CRITICAL',
          reason: `Acesso à pasta protegida do sistema operacional ("${normalized}") é estritamente proibido.`
        }
      }
    }

    if (allowedBaseDir) {
      const normalizedBase = path.resolve(allowedBaseDir)
      const relative = path.relative(normalizedBase, normalized)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Caminho fora do diretório delimitado ("${normalizedBase}"). Tentativa de traversal bloqueada.`
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'SAFE'
    }
  }

  /**
   * Validates Git operations.
   */
  public validateGitCommit(message: string, specificFiles?: string[]): PolicyCheckResult {
    const lower = message.toLowerCase()
    if (lower.includes('--force') || lower.includes('-f') || lower.includes('--amend')) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: 'Operações de commit destrutivo (--force, --amend) são bloqueadas pelo Policy Engine.',
        requiresConfirmation: true
      }
    }

    if (specificFiles && specificFiles.length > 0) {
      for (const file of specificFiles) {
        if (file.includes('..') || path.isAbsolute(file)) {
          return {
            allowed: false,
            riskLevel: 'HIGH',
            reason: `Arquivo inválido ou com escape de repositório: "${file}".`
          }
        }
        if (file.includes('.env') || file.includes('credentials') || file.includes('id_rsa')) {
          return {
            allowed: false,
            riskLevel: 'CRITICAL',
            reason: `Tentativa de comitar arquivo sensível ou credencial detectada: "${file}".`,
            requiresConfirmation: true
          }
        }
      }
    }

    return {
      allowed: true,
      riskLevel: 'MODERATE',
      requiresConfirmation: !specificFiles || specificFiles.length === 0
    }
  }

  /**
   * Validates Smart Home domain and service call.
   */
  public validateSmartHomeDomain(domain: string): PolicyCheckResult {
    const d = domain.toLowerCase().trim()
    if (!SAFE_SMART_HOME_DOMAINS.has(d)) {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: `Domínio de automação "${d}" não está na allowlist segura. Acesso a trancas, alarmes e portões é bloqueado.`
      }
    }
    return {
      allowed: true,
      riskLevel: 'SAFE'
    }
  }

  /**
   * Validates URL for Headless Browser (preventing intranet scanning/SSRF).
   */
  public validateBrowserUrl(targetUrl: string): PolicyCheckResult {
    try {
      const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Protocolo "${parsed.protocol}" não suportado para navegação web.`
        }
      }
      if (isPrivateOrLoopbackHost(parsed.hostname)) {
        return {
          allowed: false,
          riskLevel: 'HIGH',
          reason: `Acesso a endereços locais ou privados (${parsed.hostname}) pelo Headless Browser é bloqueado para prevenir SSRF interno.`
        }
      }
      return {
        allowed: true,
        riskLevel: 'SAFE'
      }
    } catch {
      return {
        allowed: false,
        riskLevel: 'HIGH',
        reason: `URL inválida para navegação: "${targetUrl}".`
      }
    }
  }
}

export const toolPolicyEngine = new ToolPolicyEngine()
