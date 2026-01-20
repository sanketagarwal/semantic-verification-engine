/**
 * Embedding Cache System
 * 
 * Caches embeddings on market metadata to avoid redundant API calls.
 * 
 * Features:
 * - In-memory cache with optional file persistence
 * - Auto-generates embeddings for new markets
 * - Batch embedding generation for efficiency
 * - Uses cached embeddings for similarity comparisons
 */

import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import type { EmbeddingMetadata, MarketWithEmbedding } from '../types';
import { cosineSimilarity } from './embeddings';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CACHE_FILE_PATH = process.env.EMBEDDING_CACHE_PATH || '.embedding-cache.json';

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY CACHE
// ═══════════════════════════════════════════════════════════════

interface CacheEntry {
  embedding: EmbeddingMetadata;
  venue: 'KALSHI' | 'POLYMARKET';
}

// In-memory cache: marketId -> embedding
const embeddingCache = new Map<string, CacheEntry>();

// Stats for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  generated: 0,
};

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get embedding for a market, using cache if available
 */
export async function getEmbedding(
  marketId: string,
  question: string,
  venue: 'KALSHI' | 'POLYMARKET'
): Promise<EmbeddingMetadata> {
  // Check cache first
  const cached = embeddingCache.get(marketId);
  if (cached) {
    cacheStats.hits++;
    return cached.embedding;
  }
  
  // Generate new embedding
  cacheStats.misses++;
  const embedding = await generateEmbeddingForText(question);
  
  // Store in cache
  embeddingCache.set(marketId, { embedding, venue });
  cacheStats.generated++;
  
  return embedding;
}

/**
 * Generate embedding for text
 */
async function generateEmbeddingForText(text: string): Promise<EmbeddingMetadata> {
  const result = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  
  return {
    vector: result.embedding,
    model: EMBEDDING_MODEL,
    sourceText: text,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Batch generate embeddings for multiple markets
 */
export async function batchGenerateEmbeddings(
  markets: Array<{ id: string; question: string; venue: 'KALSHI' | 'POLYMARKET' }>
): Promise<Map<string, EmbeddingMetadata>> {
  // Filter out already cached markets
  const uncached = markets.filter(m => !embeddingCache.has(m.id));
  
  if (uncached.length === 0) {
    // All cached, return from cache
    const results = new Map<string, EmbeddingMetadata>();
    markets.forEach(m => {
      const cached = embeddingCache.get(m.id);
      if (cached) results.set(m.id, cached.embedding);
    });
    cacheStats.hits += markets.length;
    return results;
  }
  
  // Generate embeddings for uncached markets
  const texts = uncached.map(m => m.question);
  const result = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  
  // Store in cache
  const results = new Map<string, EmbeddingMetadata>();
  uncached.forEach((market, i) => {
    const embedding: EmbeddingMetadata = {
      vector: result.embeddings[i],
      model: EMBEDDING_MODEL,
      sourceText: market.question,
      generatedAt: new Date().toISOString(),
    };
    embeddingCache.set(market.id, { embedding, venue: market.venue });
    results.set(market.id, embedding);
    cacheStats.generated++;
  });
  
  // Also include already cached ones
  markets.forEach(m => {
    if (!results.has(m.id)) {
      const cached = embeddingCache.get(m.id);
      if (cached) {
        results.set(m.id, cached.embedding);
        cacheStats.hits++;
      }
    }
  });
  
  return results;
}

/**
 * Compare two markets using cached embeddings
 */
export async function compareMarketsWithCache(
  market1: { id: string; question: string; venue: 'KALSHI' | 'POLYMARKET' },
  market2: { id: string; question: string; venue: 'KALSHI' | 'POLYMARKET' }
): Promise<{
  similarity: number;
  market1Cached: boolean;
  market2Cached: boolean;
}> {
  const market1Cached = embeddingCache.has(market1.id);
  const market2Cached = embeddingCache.has(market2.id);
  
  const [emb1, emb2] = await Promise.all([
    getEmbedding(market1.id, market1.question, market1.venue),
    getEmbedding(market2.id, market2.question, market2.venue),
  ]);
  
  return {
    similarity: cosineSimilarity(emb1.vector, emb2.vector),
    market1Cached,
    market2Cached,
  };
}

/**
 * Find most similar markets to a source market from a list
 */
export async function findSimilarFromCache(
  source: { id: string; question: string; venue: 'KALSHI' | 'POLYMARKET' },
  candidates: Array<{ id: string; question: string; venue: 'KALSHI' | 'POLYMARKET' }>,
  options: { topK?: number; minSimilarity?: number } = {}
): Promise<Array<{
  market: typeof candidates[0];
  similarity: number;
  fromCache: boolean;
}>> {
  const { topK = 5, minSimilarity = 0.5 } = options;
  
  // Get source embedding
  const sourceEmb = await getEmbedding(source.id, source.question, source.venue);
  
  // Batch get candidate embeddings
  const candidateEmbeddings = await batchGenerateEmbeddings(candidates);
  
  // Calculate similarities
  const results = candidates.map(market => {
    const emb = candidateEmbeddings.get(market.id);
    if (!emb) return null;
    
    return {
      market,
      similarity: cosineSimilarity(sourceEmb.vector, emb.vector),
      fromCache: embeddingCache.has(market.id),
    };
  })
  .filter((r): r is NonNullable<typeof r> => r !== null && r.similarity >= minSimilarity)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, topK);
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE (Optional)
// ═══════════════════════════════════════════════════════════════

/**
 * Save cache to file
 */
export function saveCacheToFile(path: string = CACHE_FILE_PATH): void {
  const data: Record<string, CacheEntry> = {};
  embeddingCache.forEach((value, key) => {
    data[key] = value;
  });
  
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`💾 Saved ${embeddingCache.size} embeddings to ${path}`);
}

/**
 * Load cache from file
 */
export function loadCacheFromFile(path: string = CACHE_FILE_PATH): boolean {
  if (!existsSync(path)) {
    return false;
  }
  
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, CacheEntry>;
    Object.entries(data).forEach(([key, value]) => {
      embeddingCache.set(key, value);
    });
    console.log(`📂 Loaded ${embeddingCache.size} embeddings from ${path}`);
    return true;
  } catch (error) {
    console.error('Failed to load embedding cache:', error);
    return false;
  }
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  embeddingCache.clear();
  cacheStats = { hits: 0, misses: 0, generated: 0 };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  generated: number;
  hitRate: string;
} {
  const total = cacheStats.hits + cacheStats.misses;
  return {
    size: embeddingCache.size,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    generated: cacheStats.generated,
    hitRate: total > 0 ? `${((cacheStats.hits / total) * 100).toFixed(1)}%` : '0%',
  };
}

/**
 * Check if a market is cached
 */
export function isCached(marketId: string): boolean {
  return embeddingCache.has(marketId);
}

/**
 * Get all cached market IDs
 */
export function getCachedMarketIds(): string[] {
  return Array.from(embeddingCache.keys());
}

// ═══════════════════════════════════════════════════════════════
// ENRICHMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Enrich a market object with its embedding
 */
export async function enrichMarketWithEmbedding<T extends { id?: string; ticker?: string; question?: string; title?: string }>(
  market: T,
  venue: 'KALSHI' | 'POLYMARKET'
): Promise<T & { embedding: EmbeddingMetadata }> {
  const id = market.id || market.ticker || '';
  const question = market.question || market.title || '';
  
  const embedding = await getEmbedding(id, question, venue);
  
  return {
    ...market,
    embedding,
  };
}

/**
 * Enrich multiple markets with embeddings
 */
export async function enrichMarketsWithEmbeddings<T extends { id?: string; ticker?: string; question?: string; title?: string }>(
  markets: T[],
  venue: 'KALSHI' | 'POLYMARKET'
): Promise<Array<T & { embedding: EmbeddingMetadata }>> {
  // Prepare market data
  const marketData = markets.map(m => ({
    id: m.id || m.ticker || '',
    question: m.question || m.title || '',
    venue,
  }));
  
  // Batch generate embeddings
  const embeddings = await batchGenerateEmbeddings(marketData);
  
  // Enrich markets
  return markets.map(market => {
    const id = market.id || market.ticker || '';
    const embedding = embeddings.get(id);
    
    return {
      ...market,
      embedding: embedding || {
        vector: [],
        model: EMBEDDING_MODEL,
        sourceText: market.question || market.title || '',
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
