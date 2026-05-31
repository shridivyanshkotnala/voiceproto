import fs from 'fs/promises'
import { KnowledgeDocument } from '../models/knowledgeDocument.model.js'
import { loadDocument } from './documentLoader.service.js'
import { chunkDocument } from './chunking.service.js'
import { generateEmbedding } from './embedding.service.js'
import { storeChunks } from './vectorStore.service.js'
import { retrieveRelevantContext } from './retrieval.service.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

// Handles knowledge document ingestion and embedding storage.
// Input: uploaded file, sessionId
// Output: document record and chunk count
export async function ingestKnowledgeDocument({ file, sessionId }) {
  let document = null

  try {
    const { content, documentName, documentType, fileSize } = await loadDocument(file)

    document = await KnowledgeDocument.create({
      documentName,
      documentType,
      fileSize,
      status: 'processing',
      chunkCount: 0,
    })

    const chunks = chunkDocument(content)
    console.info(
      `[knowledge-ingest] documentId=${document._id} name="${documentName}" chunks=${chunks.length}`,
    )

    const chunkDocs = []
    for (const chunk of chunks) {
      console.info(
        `[knowledge-ingest] embedding chunk=${chunk.chunkIndex + 1}/${chunks.length} documentId=${document._id}`,
      )
      const { embedding, usage, model } = await generateEmbedding(chunk.chunkText)
      const inputTokens = usage.prompt_tokens || usage.total_tokens || 0
      const outputTokens = usage.completion_tokens || 0
      const usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

      await saveUsageRecord({
        organizationId: 'default',
        sessionId: sessionId || 'anonymous',
        feature: 'rag_retrieval',
        model,
        inputTokens: usageSummary.inputTokens,
        outputTokens: usageSummary.outputTokens,
        totalTokens: usageSummary.totalTokens,
        estimatedCost: usageSummary.estimatedCost,
        requestType: 'embedding',
      })

      chunkDocs.push({
        documentId: document._id,
        documentName,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        embedding,
        metadata: {
          documentType,
          source: documentName,
        },
      })
    }

    await storeChunks(chunkDocs)

    document.status = 'processed'
    document.chunkCount = chunkDocs.length
    await document.save()

    console.info(
      `[knowledge-ingest] completed documentId=${document._id} chunks=${chunkDocs.length}`,
    )
    return document
  } catch (error) {
    if (document) {
      document.status = 'failed'
      await document.save().catch(() => null)
    }
    const errorMessage = error?.message || 'Unknown ingestion error'
    console.error(
      `[knowledge-ingest] failed documentId=${document?._id || 'n/a'} reason="${errorMessage}"`,
    )
    throw error
  } finally {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => null)
    }
  }
}

// Runs semantic search against stored knowledge chunks.
// Input: query, topK, sessionId
// Output: matches + usage
export async function searchKnowledge({ query, topK, sessionId }) {
  return retrieveRelevantContext({ query, topK, sessionId })
}

// Returns knowledge collection statistics.
// Input: none
// Output: totals for documents/chunks
export async function getKnowledgeStats() {
  const totalDocuments = await KnowledgeDocument.countDocuments()
  const totalChunks = await (await import('../models/knowledgeChunk.model.js')).KnowledgeChunk.countDocuments()

  return {
    totalDocuments,
    totalChunks,
    totalEmbeddings: totalChunks,
  }
}
