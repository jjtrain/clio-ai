import { db } from "@/lib/db";
import * as openai from "@/lib/integrations/openai";
import * as aiRouter from "@/lib/ai-router";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

function chunkText(text: string, targetTokens = 500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const approxTokens = (current + para).length / 4;
    if (approxTokens > targetTokens && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, 2000)];
}

export async function embedDocument(documentId: string) {
  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  // Delete existing embeddings
  await db.documentEmbedding.deleteMany({ where: { documentId } });
  // In production, extract text from the document file. For now use name/filename as placeholder.
  const textContent = `Document: ${doc.name}. File: ${doc.filename}. Type: ${doc.mimeType}.`;
  const chunks = chunkText(textContent);
  const embeddings = await openai.createEmbeddingBatch(chunks);
  let totalTokens = 0;
  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings.find((e: any) => e.index === i);
    if (!emb) continue;
    const chunkTokens = Math.ceil(chunks[i].length / 4);
    totalTokens += chunkTokens;
    await db.documentEmbedding.create({
      data: {
        documentId, matterId: doc.matterId, chunkIndex: i, chunkText: chunks[i],
        chunkTokens, embedding: JSON.stringify(emb.embedding),
        embeddingModel: "text-embedding-3-small", embeddingDimensions: emb.embedding.length,
        metadata: JSON.stringify({ fileName: doc.filename, documentType: doc.mimeType }),
      },
    });
  }
  return { chunksCreated: chunks.length, totalTokens };
}

export async function embedMatterDocuments(matterId: string) {
  const docs = await db.document.findMany({ where: { matterId } });
  let queued = 0;
  for (const doc of docs) {
    const existing = await db.documentEmbedding.count({ where: { documentId: doc.id } });
    if (existing === 0) { await embedDocument(doc.id); queued++; }
  }
  return { queued, total: docs.length };
}

export async function searchDocuments(params: { query: string; matterId?: string; topK?: number; minSimilarity?: number }) {
  const start = Date.now();
  const queryResult = await openai.createEmbedding({ input: params.query, feature: "semantic_search", matterId: params.matterId });
  const queryEmbedding = queryResult.embeddings[0]?.embedding;
  if (!queryEmbedding) return { results: [], searchTimeMs: Date.now() - start };

  const where: any = {};
  if (params.matterId) where.matterId = params.matterId;
  const allEmbeddings = await db.documentEmbedding.findMany({ where, include: { document: true } });

  const scored = allEmbeddings.map(emb => {
    const docEmb = JSON.parse(emb.embedding) as number[];
    const similarity = cosineSimilarity(queryEmbedding, docEmb);
    return { ...emb, similarity };
  }).filter(r => r.similarity >= (params.minSimilarity || 0.3)).sort((a, b) => b.similarity - a.similarity).slice(0, params.topK || 10);

  const results = scored.map(r => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return { documentId: r.documentId, documentName: r.document?.name || meta.fileName, chunkIndex: r.chunkIndex, chunkText: r.chunkText, similarity: Math.round(r.similarity * 1000) / 1000, pageNumber: meta.pageNumber, matterId: r.matterId };
  });

  const searchTimeMs = Date.now() - start;
  await db.semanticSearchResult.create({ data: { query: params.query, queryEmbedding: JSON.stringify(queryEmbedding), matterId: params.matterId, results: JSON.stringify(results), resultCount: results.length, searchTimeMs } });
  return { results, searchTimeMs };
}

export async function searchAcrossMatters(query: string, matterIds: string[], topK = 10) {
  const allResults: any[] = [];
  for (const matterId of matterIds) {
    const { results } = await searchDocuments({ query, matterId, topK: Math.ceil(topK / matterIds.length) });
    allResults.push(...results.map(r => ({ ...r, matterId })));
  }
  return allResults.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

export async function findSimilarDocuments(documentId: string, matterId?: string) {
  const embeddings = await db.documentEmbedding.findMany({ where: { documentId }, take: 1 });
  if (embeddings.length === 0) { await embedDocument(documentId); return findSimilarDocuments(documentId, matterId); }
  const docEmb = JSON.parse(embeddings[0].embedding) as number[];
  const where: any = { documentId: { not: documentId } };
  if (matterId) where.matterId = matterId;
  const others = await db.documentEmbedding.findMany({ where, include: { document: true } });
  const scored = others.map(emb => ({ ...emb, similarity: cosineSimilarity(docEmb, JSON.parse(emb.embedding)) }))
    .sort((a, b) => b.similarity - a.similarity);
  // Group by document, take best chunk per doc
  const seen = new Set<string>();
  const unique = scored.filter(r => { if (seen.has(r.documentId)) return false; seen.add(r.documentId); return true; }).slice(0, 10);
  return unique.map(r => ({ documentId: r.documentId, documentName: r.document?.name, similarity: Math.round(r.similarity * 1000) / 1000, matterId: r.matterId }));
}

export async function answerFromDocuments(params: { question: string; matterId: string }) {
  const { results } = await searchDocuments({ query: params.question, matterId: params.matterId, topK: 5 });
  if (results.length === 0) return { answer: "No relevant documents found to answer this question.", citations: [] };
  const context = results.map((r, i) => `[${i + 1}] From "${r.documentName}" (similarity: ${(r.similarity * 100).toFixed(1)}%):\n${r.chunkText}`).join("\n\n");
  const result = await aiRouter.complete({
    feature: "rag_answer", matterId: params.matterId,
    systemPrompt: "You are a legal assistant. Answer the question based ONLY on the provided document excerpts. Cite which document each piece of information comes from using [N] notation. If the answer isn't in the documents, say so clearly.",
    userPrompt: `Document excerpts:\n\n${context}\n\nQuestion: ${params.question}`,
  });
  return { answer: result.content, citations: results.map(r => ({ documentId: r.documentId, documentName: r.documentName, similarity: r.similarity })), provider: result.provider, model: result.model };
}

export async function summarizeDocumentCollection(matterId: string) {
  const embeddings = await db.documentEmbedding.findMany({ where: { matterId }, include: { document: true }, orderBy: { chunkIndex: "asc" } });
  if (embeddings.length === 0) return { summary: "No documents have been embedded for this matter yet.", documentsCount: 0 };
  const docSummary = embeddings.reduce((acc: Record<string, string[]>, emb) => {
    const name = emb.document?.name || "Unknown";
    if (!acc[name]) acc[name] = [];
    acc[name].push(emb.chunkText.slice(0, 200));
    return acc;
  }, {});
  const context = Object.entries(docSummary).map(([name, chunks]) => `"${name}": ${chunks.join(" ... ").slice(0, 500)}`).join("\n");
  const result = await aiRouter.complete({
    feature: "collection_summary", matterId,
    systemPrompt: "You are a legal assistant. Summarize this collection of case documents: types of documents present, key themes, chronology of events, gaps in documentation. Be concise.",
    userPrompt: `Documents in this matter:\n${context}`,
  });
  return { summary: result.content, documentsCount: Object.keys(docSummary).length, chunksCount: embeddings.length };
}

export async function deleteDocumentEmbeddings(documentId: string) {
  const count = await db.documentEmbedding.count({ where: { documentId } });
  await db.documentEmbedding.deleteMany({ where: { documentId } });
  return { deleted: count };
}

export async function getEmbeddingStats(matterId?: string) {
  const where = matterId ? { matterId } : {};
  const count = await db.documentEmbedding.count({ where });
  const docs = await db.documentEmbedding.groupBy({ by: ["documentId"], where });
  const totalTokens = await db.documentEmbedding.aggregate({ where, _sum: { chunkTokens: true } });
  const latest = await db.documentEmbedding.findFirst({ where, orderBy: { createdAt: "desc" } });
  return { documentsEmbedded: docs.length, totalChunks: count, totalTokens: totalTokens._sum.chunkTokens || 0, lastEmbeddedAt: latest?.createdAt };
}
