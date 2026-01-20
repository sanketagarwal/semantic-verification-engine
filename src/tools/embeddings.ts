/**
 * Embedding-based Verification Tools
 * 
 * Uses OpenAI text-embedding-3-small via Vercel AI Gateway for:
 * - Fast similarity scoring (10x cheaper than GPT-4o)
 * - Pre-filtering before LLM verification
 * - Batch processing of market pairs
 * 
 * Cost: ~$0.00002 per embedding vs ~$0.01-0.03 for GPT-4o verification
 */

import { tool, embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// VERCEL AI GATEWAY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

// Use text-embedding-3-small for cost efficiency
// Dimensions: 1536, Cost: $0.00002 per 1K tokens
const EMBEDDING_MODEL = 'text-embedding-3-small';

// ═══════════════════════════════════════════════════════════════
// COSINE SIMILARITY
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ═══════════════════════════════════════════════════════════════
// EMBEDDING TOOLS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate embedding for a single text
 */
export const generateEmbedding = tool({
  description: 'Generate a vector embedding for text using OpenAI text-embedding-3-small',
  parameters: z.object({
    text: z.string().describe('Text to embed'),
  }),
  execute: async ({ text }) => {
    try {
      const result = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: text,
      });
      
      return {
        success: true,
        embedding: result.embedding,
        dimensions: result.embedding.length,
        usage: result.usage,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Generate embeddings for multiple texts in batch
 */
export const generateEmbeddings = tool({
  description: 'Generate vector embeddings for multiple texts in a single API call',
  parameters: z.object({
    texts: z.array(z.string()).max(100).describe('Texts to embed (max 100)'),
  }),
  execute: async ({ texts }) => {
    try {
      const result = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: texts,
      });
      
      return {
        success: true,
        embeddings: result.embeddings,
        count: result.embeddings.length,
        dimensions: result.embeddings[0]?.length || 0,
        usage: result.usage,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Calculate embedding similarity between two market questions
 * This is the FAST pre-filter before GPT-4o verification
 * 
 * Supports cached embeddings when market IDs are provided
 */
export const calculateEmbeddingSimilarity = tool({
  description: `Calculate semantic similarity between two texts using embeddings.
    Much faster and cheaper than LLM comparison (~$0.00004 vs ~$0.02).
    Use this to pre-filter market pairs before full GPT-4o verification.
    If marketId is provided, embeddings will be cached for future reuse.`,
  parameters: z.object({
    text1: z.string().describe('First text (e.g., Kalshi market question)'),
    text2: z.string().describe('Second text (e.g., Polymarket question)'),
    market1Id: z.string().optional().describe('Optional market ID for caching'),
    market2Id: z.string().optional().describe('Optional market ID for caching'),
    market1Venue: z.enum(['KALSHI', 'POLYMARKET']).optional(),
    market2Venue: z.enum(['KALSHI', 'POLYMARKET']).optional(),
  }),
  execute: async ({ text1, text2, market1Id, market2Id, market1Venue, market2Venue }) => {
    try {
      let emb1Vector: number[];
      let emb2Vector: number[];
      let usedCache1 = false;
      let usedCache2 = false;
      
      // Use cache if market IDs provided
      if (market1Id && market1Venue) {
        const { getEmbedding, isCached } = await import('./embedding-cache');
        usedCache1 = isCached(market1Id);
        const emb1 = await getEmbedding(market1Id, text1, market1Venue);
        emb1Vector = emb1.vector;
      } else {
        const result = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: text1 });
        emb1Vector = result.embedding;
      }
      
      if (market2Id && market2Venue) {
        const { getEmbedding, isCached } = await import('./embedding-cache');
        usedCache2 = isCached(market2Id);
        const emb2 = await getEmbedding(market2Id, text2, market2Venue);
        emb2Vector = emb2.vector;
      } else {
        const result = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: text2 });
        emb2Vector = result.embedding;
      }
      
      const similarity = cosineSimilarity(emb1Vector, emb2Vector);
      
      // Categorize the similarity
      let category: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
      let recommendation: string;
      
      if (similarity >= 0.85) {
        category = 'HIGH';
        recommendation = 'Likely same market - proceed to LLM verification';
      } else if (similarity >= 0.70) {
        category = 'MEDIUM';
        recommendation = 'Possibly same market - LLM verification recommended';
      } else if (similarity >= 0.50) {
        category = 'LOW';
        recommendation = 'Unlikely same market - verify only if spread is large';
      } else {
        category = 'NONE';
        recommendation = 'Different markets - skip LLM verification';
      }
      
      return {
        success: true,
        similarity,
        similarityPercent: `${(similarity * 100).toFixed(1)}%`,
        category,
        recommendation,
        shouldVerifyWithLLM: similarity >= 0.65,
        estimatedCostSaved: similarity < 0.65 ? '$0.02' : '$0.00',
        cacheInfo: {
          market1FromCache: usedCache1,
          market2FromCache: usedCache2,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Batch compare multiple market pairs using embeddings
 * Returns pairs sorted by similarity, with recommendation for LLM verification
 */
export const batchEmbeddingSimilarity = tool({
  description: `Compare multiple market pairs using embeddings in batch.
    Efficiently processes many pairs and returns them sorted by similarity.
    Use this to find the best matching pairs before expensive LLM verification.`,
  parameters: z.object({
    pairs: z.array(z.object({
      id: z.string().describe('Unique identifier for this pair'),
      kalshiQuestion: z.string().describe('Kalshi market question'),
      polymarketQuestion: z.string().describe('Polymarket question'),
    })).max(50).describe('Market pairs to compare (max 50)'),
    minSimilarity: z.number().min(0).max(1).optional().describe('Minimum similarity to include (default: 0.5)'),
  }),
  execute: async ({ pairs, minSimilarity = 0.5 }) => {
    try {
      // Collect all texts for batch embedding
      const allTexts = pairs.flatMap(p => [p.kalshiQuestion, p.polymarketQuestion]);
      
      // Generate all embeddings in one API call
      const result = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: allTexts,
      });
      
      // Calculate similarities
      const results = pairs.map((pair, i) => {
        const emb1 = result.embeddings[i * 2];
        const emb2 = result.embeddings[i * 2 + 1];
        const similarity = cosineSimilarity(emb1, emb2);
        
        return {
          id: pair.id,
          kalshiQuestion: pair.kalshiQuestion,
          polymarketQuestion: pair.polymarketQuestion,
          similarity,
          similarityPercent: `${(similarity * 100).toFixed(1)}%`,
          shouldVerifyWithLLM: similarity >= 0.65,
        };
      });
      
      // Filter and sort by similarity
      const filtered = results
        .filter(r => r.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity);
      
      return {
        success: true,
        results: filtered,
        summary: {
          totalPairs: pairs.length,
          aboveThreshold: filtered.length,
          highSimilarity: filtered.filter(r => r.similarity >= 0.85).length,
          mediumSimilarity: filtered.filter(r => r.similarity >= 0.70 && r.similarity < 0.85).length,
          lowSimilarity: filtered.filter(r => r.similarity >= 0.50 && r.similarity < 0.70).length,
          needLLMVerification: filtered.filter(r => r.shouldVerifyWithLLM).length,
        },
        usage: result.usage,
        estimatedCostSaved: `$${((pairs.length - filtered.filter(r => r.shouldVerifyWithLLM).length) * 0.02).toFixed(2)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Smart verification that uses embeddings first, then LLM only if needed
 * Now with caching support!
 */
export const smartVerifyPair = tool({
  description: `Intelligently verify a market pair using embeddings first, then LLM if similarity is high enough.
    Saves ~$0.02 per pair when similarity is below threshold.
    Embeddings are cached by market ID for faster subsequent comparisons.
    
    Flow:
    1. Check cache for existing embeddings
    2. Calculate embedding similarity (~$0.00004 if not cached, FREE if cached)
    3. If similarity < 0.65: Return "UNLIKELY_MATCH" (skip LLM)
    4. If similarity >= 0.65: Call LLM for full verification (~$0.02)`,
  parameters: z.object({
    kalshiMarket: z.object({
      marketId: z.string(),
      question: z.string(),
      description: z.string().optional(),
      resolutionDate: z.string().optional(),
    }),
    polymarketMarket: z.object({
      marketId: z.string(),
      question: z.string(),
      description: z.string().optional(),
      resolutionDate: z.string().optional(),
    }),
    similarityThreshold: z.number().min(0).max(1).optional().describe('Minimum embedding similarity to proceed to LLM (default: 0.65)'),
    skipLLM: z.boolean().optional().describe('If true, only return embedding similarity without LLM verification'),
  }),
  execute: async ({ kalshiMarket, polymarketMarket, similarityThreshold = 0.65, skipLLM = false }) => {
    try {
      // Step 1: Calculate embedding similarity using cache
      const { getEmbedding, isCached } = await import('./embedding-cache');
      
      const kalshiWasCached = isCached(kalshiMarket.marketId);
      const polymarketWasCached = isCached(polymarketMarket.marketId);
      
      const [emb1, emb2] = await Promise.all([
        getEmbedding(kalshiMarket.marketId, kalshiMarket.question, 'KALSHI'),
        getEmbedding(polymarketMarket.marketId, polymarketMarket.question, 'POLYMARKET'),
      ]);
      
      const embeddingSimilarity = cosineSimilarity(emb1.vector, emb2.vector);
      
      // Step 2: Decide whether to proceed to LLM
      if (embeddingSimilarity < similarityThreshold || skipLLM) {
        return {
          success: true,
          method: 'embedding_only',
          embeddingSimilarity,
          embeddingSimilarityPercent: `${(embeddingSimilarity * 100).toFixed(1)}%`,
          recommendation: embeddingSimilarity < 0.5 ? 'UNLIKELY_MATCH' : 'POSSIBLE_MATCH',
          shouldTrade: false,
          reasoning: embeddingSimilarity < similarityThreshold 
            ? `Embedding similarity (${(embeddingSimilarity * 100).toFixed(1)}%) below threshold (${(similarityThreshold * 100).toFixed(0)}%) - LLM verification skipped`
            : 'LLM verification skipped by request',
          costSaved: '$0.02',
          cacheInfo: {
            kalshiFromCache: kalshiWasCached,
            polymarketFromCache: polymarketWasCached,
            embeddingCostSaved: (kalshiWasCached ? '$0.00002' : '$0') + ' + ' + (polymarketWasCached ? '$0.00002' : '$0'),
          },
          kalshiMarket,
          polymarketMarket,
        };
      }
      
      // Step 3: Proceed to LLM verification (import dynamically to avoid circular deps)
      const { verifyMarketPair } = await import('./verification');
      
      const llmResult = await verifyMarketPair.execute({
        kalshiMarket,
        polymarketMarket,
      });
      
      if (!llmResult.success) {
        return {
          success: false,
          method: 'llm_failed',
          embeddingSimilarity,
          error: llmResult.error,
        };
      }
      
      return {
        success: true,
        method: 'embedding_plus_llm',
        embeddingSimilarity,
        embeddingSimilarityPercent: `${(embeddingSimilarity * 100).toFixed(1)}%`,
        verification: llmResult.verification,
        recommendation: llmResult.verification?.recommendation,
        shouldTrade: llmResult.verification?.recommendation === 'SAFE_TO_TRADE',
        reasoning: llmResult.verification?.reasoning,
        misalignments: llmResult.verification?.misalignments,
        cacheInfo: {
          kalshiFromCache: kalshiWasCached,
          polymarketFromCache: polymarketWasCached,
        },
        kalshiMarket,
        polymarketMarket,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Find best matching markets from a list using embeddings
 */
export const findBestMatches = tool({
  description: `Given a source market, find the best matching markets from a list using embeddings.
    Returns matches sorted by similarity score.`,
  parameters: z.object({
    sourceQuestion: z.string().describe('The source market question to match against'),
    candidateMarkets: z.array(z.object({
      id: z.string(),
      question: z.string(),
      venue: z.string().optional(),
    })).max(100).describe('Candidate markets to search through'),
    topK: z.number().min(1).max(20).optional().describe('Number of top matches to return (default: 5)'),
    minSimilarity: z.number().min(0).max(1).optional().describe('Minimum similarity threshold (default: 0.5)'),
  }),
  execute: async ({ sourceQuestion, candidateMarkets, topK = 5, minSimilarity = 0.5 }) => {
    try {
      // Generate source embedding
      const sourceEmb = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: sourceQuestion,
      });
      
      // Generate candidate embeddings in batch
      const candidateResult = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: candidateMarkets.map(m => m.question),
      });
      
      // Calculate similarities and rank
      const matches = candidateMarkets
        .map((market, i) => ({
          ...market,
          similarity: cosineSimilarity(sourceEmb.embedding, candidateResult.embeddings[i]),
        }))
        .filter(m => m.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(m => ({
          ...m,
          similarityPercent: `${(m.similarity * 100).toFixed(1)}%`,
          shouldVerifyWithLLM: m.similarity >= 0.65,
        }));
      
      return {
        success: true,
        sourceQuestion,
        matches,
        totalCandidates: candidateMarkets.length,
        matchesFound: matches.length,
        usage: {
          sourceTokens: sourceEmb.usage?.tokens || 0,
          candidateTokens: candidateResult.usage?.tokens || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});
