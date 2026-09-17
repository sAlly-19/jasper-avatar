import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import type { MemoryItem, JasperMemory } from '@shared'

export type { MemoryItem, JasperMemory }

const defaultMemory: JasperMemory = {
  userName: '',
  userPreferences: [],
  facts: []
}

export function getMemoryFilePath(): string {
  return join(app.getPath('userData'), 'jasper-memory.json')
}

export function loadMemory(): JasperMemory {
  try {
    const memPath = getMemoryFilePath()
    if (fs.existsSync(memPath)) {
      const data = JSON.parse(fs.readFileSync(memPath, 'utf-8'))
      return {
        userName: data.userName || '',
        userPreferences: Array.isArray(data.userPreferences) ? data.userPreferences : [],
        facts: Array.isArray(data.facts) ? data.facts : []
      }
    }
  } catch (err) {
    console.warn('[Memory] Error reading jasper-memory.json:', err)
  }
  return { ...defaultMemory }
}

export function saveMemory(memory: JasperMemory): void {
  try {
    const memPath = getMemoryFilePath()
    fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), 'utf-8')
    console.log('[Memory] Saved memory successfully to', memPath)
  } catch (err) {
    console.warn('[Memory] Error writing to jasper-memory.json:', err)
  }
}

export function addFact(fact: string): string {
  const mem = loadMemory()
  const cleanFact = fact.trim()
  if (!cleanFact) return 'Fato vazio.'

  // Prevent exact duplicates
  if (!mem.facts.some((f) => f.fact.toLowerCase() === cleanFact.toLowerCase())) {
    mem.facts.push({
      id: Date.now().toString(),
      fact: cleanFact,
      createdAt: new Date().toISOString()
    })
    saveMemory(mem)
    return `Fato memorizado com sucesso: "${cleanFact}".`
  }
  return `Já me lembrava disso: "${cleanFact}".`
}

export function getMemorySummary(): string {
  const mem = loadMemory()
  const parts: string[] = []

  if (mem.userName) {
    parts.push(`Nome do usuário: ${mem.userName}.`)
  }
  if (mem.userPreferences.length > 0) {
    parts.push(`Preferências: ${mem.userPreferences.join(', ')}.`)
  }
  if (mem.facts.length > 0) {
    parts.push(`Fatos memorizados: ${mem.facts.map((f) => f.fact).join(' | ')}.`)
  }

  return parts.length > 0 ? parts.join(' ') : 'Nenhum detalhe prévio gravado.'
}

