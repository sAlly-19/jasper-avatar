import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import type { KnowledgeNode, KnowledgeEdge, KnowledgeGraphData } from '@shared'
import { atomicWriteJsonSync, readJsonFileSync } from '../utils/atomic-json'

const GRAPH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const PERMANENT_NODE_IDS = new Set(['user', 'jasper'])

export class KnowledgeGraphService {
  private isEnabled: boolean = true
  private data: KnowledgeGraphData = { nodes: [], edges: [] }

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled
    this.loadGraph()
  }

  private getFilePath(): string {
    return join(app.getPath('userData'), 'jasper-knowledge-graph.json')
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  public getIsEnabled(): boolean {
    return this.isEnabled
  }

  private loadGraph(): void {
    try {
      const p = this.getFilePath()
      if (fs.existsSync(p)) {
        const parsed = readJsonFileSync<KnowledgeGraphData>(p)
        const cutoff = Date.now() - GRAPH_RETENTION_MS
        const nodes = Array.isArray(parsed.nodes)
          ? parsed.nodes.filter((node) => PERMANENT_NODE_IDS.has(node.id) || node.createdAt >= cutoff)
          : []
        const nodeIds = new Set(nodes.map((node) => node.id))
        const edges = Array.isArray(parsed.edges)
          ? parsed.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && (edge.id === 'e1' || edge.createdAt >= cutoff))
          : []
        this.data = { nodes, edges }
        if (nodes.length !== parsed.nodes?.length || edges.length !== parsed.edges?.length) this.saveGraph()
      } else {
        // Initialize with core user/agent entities
        this.initDefaultGraph()
      }
    } catch (err) {
      console.warn('[KnowledgeGraph] Error loading graph:', err)
      this.initDefaultGraph()
    }
  }

  private initDefaultGraph(): void {
    this.data = {
      nodes: [
        { id: 'user', label: 'Comandante', type: 'Person', createdAt: Date.now() },
        { id: 'jasper', label: 'Jasper', type: 'Concept', properties: { role: 'AI HUD Assistant' }, createdAt: Date.now() }
      ],
      edges: [
        { id: 'e1', source: 'jasper', target: 'user', relation: 'assiste', createdAt: Date.now() }
      ]
    }
    this.saveGraph()
  }

  private saveGraph(): void {
    try {
      const p = this.getFilePath()
      atomicWriteJsonSync(p, this.data)
    } catch (err) {
      console.warn('[KnowledgeGraph] Error saving graph:', err)
    }
  }

  private normalizeId(str: string): string {
    return str.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_')
  }

  public addEntity(label: string, type: KnowledgeNode['type'] = 'Concept', properties?: Record<string, any>): KnowledgeNode {
    const id = this.normalizeId(label)
    let node = this.data.nodes.find((n) => n.id === id)
    if (!node) {
      node = {
        id,
        label: label.trim(),
        type,
        properties: properties || {},
        createdAt: Date.now()
      }
      this.data.nodes.push(node)
      this.saveGraph()
      console.log(`[KnowledgeGraph] Added entity of type ${type}.`)
    } else if (properties) {
      node.properties = { ...node.properties, ...properties }
      this.saveGraph()
    }
    return node
  }

  public addRelation(sourceLabel: string, relation: string, targetLabel: string, weight: number = 1): KnowledgeEdge {
    const sourceNode = this.addEntity(sourceLabel)
    const targetNode = this.addEntity(targetLabel)
    const edgeId = `${sourceNode.id}-${this.normalizeId(relation)}-${targetNode.id}`

    let edge = this.data.edges.find((e) => e.id === edgeId)
    if (!edge) {
      edge = {
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        relation: relation.trim(),
        weight,
        createdAt: Date.now()
      }
      this.data.edges.push(edge)
      this.saveGraph()
      console.log('[KnowledgeGraph] Added relation.')
    }
    return edge
  }

  public queryEntity(query: string): {
    entity?: KnowledgeNode
    outgoing: { relation: string; target: KnowledgeNode }[]
    incoming: { relation: string; source: KnowledgeNode }[]
    summaryText: string
  } {
    const norm = this.normalizeId(query)
    const entity = this.data.nodes.find((n) => n.id === norm || n.label.toLowerCase().includes(query.toLowerCase()))

    if (!entity) {
      return {
        outgoing: [],
        incoming: [],
        summaryText: `Nenhuma entidade encontrada no grafo para "${query}".`
      }
    }

    const outgoing = this.data.edges
      .filter((e) => e.source === entity.id)
      .map((e) => {
        const target = this.data.nodes.find((n) => n.id === e.target)
        return target ? { relation: e.relation, target } : null
      })
      .filter(Boolean) as { relation: string; target: KnowledgeNode }[]

    const incoming = this.data.edges
      .filter((e) => e.target === entity.id)
      .map((e) => {
        const source = this.data.nodes.find((n) => n.id === e.source)
        return source ? { relation: e.relation, source } : null
      })
      .filter(Boolean) as { relation: string; source: KnowledgeNode }[]

    const outLines = outgoing.map((o) => `→ ${o.relation} → ${o.target.label} (${o.target.type})`)
    const inLines = incoming.map((i) => `← ${i.relation} ← ${i.source.label} (${i.source.type})`)
    const summaryText = `[Grafo: ${entity.label} (${entity.type})]\n${[...outLines, ...inLines].join('\n') || 'Sem conexões adicionais.'}`

    return {
      entity,
      outgoing,
      incoming,
      summaryText
    }
  }

  public getGraphData(): KnowledgeGraphData {
    return { ...this.data }
  }

  public clear(): void {
    this.initDefaultGraph()
  }
}

export const knowledgeGraph = new KnowledgeGraphService()

