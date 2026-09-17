import { app } from 'electron'
import { join, extname, basename } from 'path'
import fs from 'fs'
import crypto from 'crypto'
import type { FolderScanResult, FolderOrganizeResult, DuplicateFileGroup, OldInstallerItem } from '@shared'

const CATEGORIES: Record<string, string[]> = {
  'Documentos': ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.txt', '.csv', '.odt', '.rtf'],
  'Imagens': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'],
  'Instaladores': ['.exe', '.msi', '.dmg', '.pkg', '.iso', '.appimage'],
  'Arquivos Comprimidos': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  'Videos e Musicas': ['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav', '.flac', '.ogg', '.m4a'],
  'Scripts e Codigos': ['.py', '.js', '.ts', '.html', '.css', '.json', '.sql', '.sh', '.bat', '.ps1']
}

export class FolderOrganizer {
  private enabled: boolean = true

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public resolveTargetDir(target: string): string {
    const lower = target.toLowerCase().trim()
    if (lower === 'downloads' || lower === 'download') {
      return app.getPath('downloads')
    }
    if (lower === 'desktop' || lower === 'área de trabalho' || lower === 'area de trabalho') {
      return app.getPath('desktop')
    }
    // If it's an absolute path that exists
    if (fs.existsSync(target)) {
      return target
    }
    return app.getPath('downloads')
  }

  private calculateFileHash(filePath: string, size: number): string | null {
    let fd: number | null = null
    try {
      // For quick duplicate detection, hash up to 512KB + file size
      const maxRead = Math.min(size, 512 * 1024)
      const buffer = Buffer.alloc(maxRead)
      fd = fs.openSync(filePath, 'r')
      fs.readSync(fd, buffer, 0, maxRead, 0)

      const hash = crypto.createHash('md5')
      hash.update(buffer)
      hash.update(size.toString())
      return hash.digest('hex')
    } catch {
      return null
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd)
        } catch {}
      }
    }
  }

  public async scanDuplicatesAndOldFiles(target: string = 'downloads'): Promise<FolderScanResult> {
    const dir = this.resolveTargetDir(target)

    if (!this.enabled) {
      return {
        target: dir,
        totalFilesScanned: 0,
        duplicates: [],
        oldInstallers: [],
        totalReclaimableBytes: 0,
        summary: 'Organizador de pastas desativado nas configurações.'
      }
    }

    try {
      const items = fs.readdirSync(dir)
      const hashMap: Map<string, { files: string[]; size: number }> = new Map()
      const oldInstallers: OldInstallerItem[] = []
      let scannedCount = 0

      const now = Date.now()
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      for (const item of items) {
        // Skip hidden files, system files, shortcuts
        if (item.startsWith('.') || item.endsWith('.ini') || item.endsWith('.lnk')) continue
        const fullPath = join(dir, item)

        let stat: fs.Stats
        try {
          stat = fs.statSync(fullPath)
        } catch {
          continue
        }

        if (!stat.isFile()) continue
        scannedCount++

        const ext = extname(item).toLowerCase()

        // 1. Check for old installers
        if (['.exe', '.msi'].includes(ext)) {
          const ageMs = now - stat.mtimeMs
          if (ageMs > thirtyDaysMs) {
            oldInstallers.push({
              name: item,
              path: fullPath,
              daysOld: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
              sizeMb: Math.round((stat.size / (1024 * 1024)) * 10) / 10
            })
          }
        }

        // 2. Hash for duplicates (skip 0-byte files)
        if (stat.size > 0) {
          const hash = this.calculateFileHash(fullPath, stat.size)
          if (hash) {
            const existing = hashMap.get(hash)
            if (existing) {
              existing.files.push(fullPath)
            } else {
              hashMap.set(hash, { files: [fullPath], size: stat.size })
            }
          }
        }
      }

      const duplicates: DuplicateFileGroup[] = []
      let totalReclaimableBytes = 0

      for (const [hash, entry] of hashMap.entries()) {
        if (entry.files.length > 1) {
          duplicates.push({
            hash,
            files: entry.files,
            sizeBytes: entry.size
          })
          totalReclaimableBytes += entry.size * (entry.files.length - 1)
        }
      }

      for (const inst of oldInstallers) {
        totalReclaimableBytes += inst.sizeMb * 1024 * 1024
      }

      const reclaimMb = Math.round(totalReclaimableBytes / (1024 * 1024))
      const summary = `Varredura concluída em "${basename(dir)}": ${scannedCount} arquivos analisados. ` +
        `${duplicates.length} grupos de arquivos duplicados e ${oldInstallers.length} instaladores antigos detectados. ` +
        `Espaço recuperável estimado: ~${reclaimMb} MB.`

      return {
        target: dir,
        totalFilesScanned: scannedCount,
        duplicates,
        oldInstallers,
        totalReclaimableBytes,
        summary
      }
    } catch (err: any) {
      return {
        target: dir,
        totalFilesScanned: 0,
        duplicates: [],
        oldInstallers: [],
        totalReclaimableBytes: 0,
        summary: `Erro ao escanear pasta: ${err.message}`
      }
    }
  }

  public async organizeDirectory(target: string = 'downloads', dryRun: boolean = true): Promise<FolderOrganizeResult> {
    const dir = this.resolveTargetDir(target)

    if (!this.enabled) {
      return {
        success: false,
        dryRun,
        targetDir: dir,
        movedFiles: [],
        summary: 'Organizador de pastas desativado nas configurações.'
      }
    }

    try {
      const items = fs.readdirSync(dir)
      const movedFiles: Array<{ from: string; to: string; category: string }> = []
      const categoryNames = Object.keys(CATEGORIES)

      for (const item of items) {
        if (item.startsWith('.') || item.endsWith('.ini') || item.endsWith('.lnk')) continue
        // Don't move already created category folders
        if (categoryNames.includes(item)) continue

        const fullPath = join(dir, item)
        let stat: fs.Stats
        try {
          stat = fs.statSync(fullPath)
        } catch {
          continue
        }

        if (!stat.isFile()) continue

        const ext = extname(item).toLowerCase()
        let matchedCategory: string | null = null

        for (const [cat, extensions] of Object.entries(CATEGORIES)) {
          if (extensions.includes(ext)) {
            matchedCategory = cat
            break
          }
        }

        if (!matchedCategory) {
          // If no specific extension category, skip or leave in place
          continue
        }

        const targetCategoryDir = join(dir, matchedCategory)
        let targetFilePath = join(targetCategoryDir, item)

        if (!dryRun) {
          try {
            if (!fs.existsSync(targetCategoryDir)) {
              fs.mkdirSync(targetCategoryDir, { recursive: true })
            }

            // Handle name collision
            let counter = 1
            const nameWithoutExt = basename(item, ext)
            while (fs.existsSync(targetFilePath)) {
              targetFilePath = join(targetCategoryDir, `${nameWithoutExt} (${counter})${ext}`)
              counter++
            }

            fs.renameSync(fullPath, targetFilePath)
          } catch (fileErr: any) {
            console.warn(`[FolderOrganizer] Não foi possível mover arquivo "${item}":`, fileErr.message)
            continue
          }
        }

        movedFiles.push({
          from: item,
          to: `${matchedCategory}/${basename(targetFilePath)}`,
          category: matchedCategory
        })
      }

      const actionDesc = dryRun ? 'Simulação de organização' : 'Organização'
      const summary = `${actionDesc} em "${basename(dir)}": ${movedFiles.length} arquivos ${dryRun ? 'serão organizados' : 'foram movidos com sucesso'} para pastas categorizadas.`

      return {
        success: true,
        dryRun,
        targetDir: dir,
        movedFiles,
        summary
      }
    } catch (err: any) {
      return {
        success: false,
        dryRun,
        targetDir: dir,
        movedFiles: [],
        summary: `Erro ao organizar diretório: ${err.message}`
      }
    }
  }
}

export const folderOrganizer = new FolderOrganizer()

