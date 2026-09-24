import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import type { SemanticMemoryItem } from '@shared'
import { atomicWriteJsonSync, readJsonFileSync } from '../utils/atomic-json'

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela', 'para', 'pra', 'com', 'sem',
  'e', 'ou', 'mas', 'que', 'se', 'ja', 'quando', 'onde', 'como', 'quem', 'qual',
  'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'meu', 'minha', 'seu', 'sua',
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are'
])
const MEMORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export class SemanticMemoryService {
  private isEnabled: boolean = true
  private memories: SemanticMemoryItem[] = []

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
    this.loadMemories()
  }

  private getFilePath(): string {
    return join(app.getPath('userData'), 'jasper-semantic-memory.json')
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private loadMemories(): void {
    try {
      const p = this.getFilePath()
      if (fs.existsSync(p)) {
        const parsed = readJsonFileSync<unknown>(p)
        const allMemories: SemanticMemoryItem[] = Array.isArray(parsed) ? parsed : []
        const cutoff = Date.now() - MEMORY_RETENTION_MS
        this.memories = allMemories.filter((memory) => Number.isFinite(memory.updatedAt) && memory.updatedAt >= cutoff)
        if (this.memories.length !== allMemories.length) this.saveMemories()
      }
    } catch (err) {
      console.warn('[SemanticMemory] Error loading memory:', err)
      this.memories = []
    }
  }

  private saveMemories(): void {
    try {
      const p = this.getFilePath()
      atomicWriteJsonSync(p, this.memories)
    } catch (err) {
      console.warn('[SemanticMemory] Error saving memory:', err)
    }
  }

  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  }

  public addMemory(content: string, category: 'fact' | 'preference' | 'conversation_summary' | 'task' = 'fact'): SemanticMemoryItem {
    const tokens = this.tokenize(content)
    const existing = this.memories.find((m) => m.content.toLowerCase().trim() === content.toLowerCase().trim())
    if (existing) {
      existing.updatedAt = Date.now()
      existing.tokens = tokens
      this.saveMemories()
      return existing
    }

    const item: SemanticMemoryItem = {
      id: `mem-${randomUUID()}`,
      content: content.trim(),
      category,
      tokens,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.memories.push(item)
    this.saveMemories()
    console.log('[SemanticMemory] Memory added.')
    return item
  }

  public search(query: string, limit: number = 5, minScore: number = 0.12): { item: SemanticMemoryItem; score: number }[] {
    const queryTokens = this.tokenize(query)
    if (queryTokens.length === 0 || this.memories.length === 0) return []

    // Calculate Document Frequency for each term in the corpus
    const df: Record<string, number> = {}
    const totalDocs = this.memories.length

    for (const mem of this.memories) {
      const uniqueWords = new Set(mem.tokens)
      for (const w of uniqueWords) {
        df[w] = (df[w] || 0) + 1
      }
    }

    const idf = (term: string): number => {
      const count = df[term] || 0
      return Math.log((totalDocs + 1) / (count + 1)) + 1
    }

    // Query TF-IDF vector
    const queryTf: Record<string, number> = {}
    for (const token of queryTokens) {
      queryTf[token] = (queryTf[token] || 0) + 1
    }

    const scored = this.memories.map((mem) => {
      // Memory TF-IDF vector
      const memTf: Record<string, number> = {}
      for (const token of mem.tokens) {
        memTf[token] = (memTf[token] || 0) + 1
      }

      // Cosine Similarity between Query and Document
      let dotProduct = 0
      let queryNormSq = 0
      let memNormSq = 0

      const allTerms = new Set([...queryTokens, ...mem.tokens])
      for (const term of allTerms) {
        const termIdf = idf(term)
        const qVal = (queryTf[term] || 0) * termIdf
        const mVal = (memTf[term] || 0) * termIdf

        dotProduct += qVal * mVal
        queryNormSq += qVal * qVal
        memNormSq += mVal * mVal
      }

      const score = queryNormSq > 0 && memNormSq > 0 ? dotProduct / (Math.sqrt(queryNormSq) * Math.sqrt(memNormSq)) : 0
      return { item: mem, score }
    })

    return scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  public getAll(): SemanticMemoryItem[] {
    return [...this.memories]
  }

  public remove(id: string): boolean {
    const prevLen = this.memories.length
    this.memories = this.memories.filter((m) => m.id !== id)
    if (this.memories.length !== prevLen) {
      this.saveMemories()
      return true
    }
    return false
  }

  public clear(): void {
    this.memories = []
    this.saveMemories()
  }
}

export const semanticMemory = new SemanticMemoryService()

