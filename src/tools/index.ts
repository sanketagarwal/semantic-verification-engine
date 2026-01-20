/**
 * Semantic Verification Engine - Tool Exports
 * 
 * Market APIs: All data via Replay Labs API
 * LLM: Vercel AI Gateway for OpenAI
 * Embeddings: text-embedding-3-small for fast similarity
 */

// ═══════════════════════════════════════════════════════════════
// MARKET DATA TOOLS (via Replay Labs)
// ═══════════════════════════════════════════════════════════════

export {
  // Unified market search
  searchMarkets,
  searchKalshiMarkets,
  searchPolymarketMarkets,
  
  // Semantic & similarity search
  semanticSearchMarkets,
  findOverlapMarkets,
  findSimilarMarkets,
  
  // Single market details
  getMarket,
  getKalshiMarket,
  getPolymarketMarket,
  
  // WebSocket config
  listWebSocketVenues,
  buildWebSocketPayload,
} from './market-apis';

// ═══════════════════════════════════════════════════════════════
// SEMANTIC VERIFICATION TOOLS (via Vercel AI Gateway)
// ═══════════════════════════════════════════════════════════════

export {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  quickSimilarityScore,
} from './verification';

// ═══════════════════════════════════════════════════════════════
// EMBEDDING TOOLS (text-embedding-3-small via Vercel AI Gateway)
// ═══════════════════════════════════════════════════════════════

export {
  // Core embedding functions
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  
  // Similarity tools
  calculateEmbeddingSimilarity,
  batchEmbeddingSimilarity,
  
  // Smart verification (embeddings + LLM)
  smartVerifyPair,
  findBestMatches,
} from './embeddings';

// ═══════════════════════════════════════════════════════════════
// EMBEDDING CACHE (for faster repeated comparisons)
// ═══════════════════════════════════════════════════════════════

export {
  // Core cache operations
  getEmbedding,
  batchGenerateEmbeddings,
  compareMarketsWithCache,
  findSimilarFromCache,
  
  // Cache management
  getCacheStats,
  clearCache,
  isCached,
  getCachedMarketIds,
  
  // Persistence
  saveCacheToFile,
  loadCacheFromFile,
  
  // Market enrichment
  enrichMarketWithEmbedding,
  enrichMarketsWithEmbeddings,
} from './embedding-cache';

// ═══════════════════════════════════════════════════════════════
// TOOL COLLECTIONS (for use with AI SDK)
// ═══════════════════════════════════════════════════════════════

import {
  searchMarkets,
  searchKalshiMarkets,
  searchPolymarketMarkets,
  semanticSearchMarkets,
  findOverlapMarkets,
  findSimilarMarkets,
  getMarket,
  getKalshiMarket,
  getPolymarketMarket,
  listWebSocketVenues,
  buildWebSocketPayload,
} from './market-apis';

import {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
} from './verification';

import {
  generateEmbedding,
  generateEmbeddings,
  calculateEmbeddingSimilarity,
  batchEmbeddingSimilarity,
  smartVerifyPair,
  findBestMatches,
} from './embeddings';

import {
  getEmbedding,
  batchGenerateEmbeddings,
  compareMarketsWithCache,
  findSimilarFromCache,
  getCacheStats,
  clearCache,
  isCached,
  getCachedMarketIds,
  saveCacheToFile,
  loadCacheFromFile,
  enrichMarketWithEmbedding,
  enrichMarketsWithEmbeddings,
} from './embedding-cache';

/**
 * All tools for market data access via Replay Labs
 */
export const marketDataTools = {
  searchMarkets,
  searchKalshiMarkets,
  searchPolymarketMarkets,
  semanticSearchMarkets,
  findOverlapMarkets,
  findSimilarMarkets,
  getMarket,
  getKalshiMarket,
  getPolymarketMarket,
  listWebSocketVenues,
  buildWebSocketPayload,
};

/**
 * All tools for semantic verification via Vercel AI Gateway
 */
export const verificationTools = {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
};

/**
 * Embedding-based tools for fast similarity matching
 */
export const embeddingTools = {
  generateEmbedding,
  generateEmbeddings,
  calculateEmbeddingSimilarity,
  batchEmbeddingSimilarity,
  smartVerifyPair,
  findBestMatches,
};

/**
 * Embedding cache for storing embeddings on market metadata
 */
export const embeddingCacheTools = {
  getEmbedding,
  batchGenerateEmbeddings,
  compareMarketsWithCache,
  findSimilarFromCache,
  getCacheStats,
  clearCache,
  isCached,
  getCachedMarketIds,
  saveCacheToFile,
  loadCacheFromFile,
  enrichMarketWithEmbedding,
  enrichMarketsWithEmbeddings,
};

/**
 * Complete toolset for verification agent
 */
export const allTools = {
  ...marketDataTools,
  ...verificationTools,
  ...embeddingTools,
  ...embeddingCacheTools,
};
