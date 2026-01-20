/**
 * Semantic Verification Engine - Tool Exports
 * 
 * Market APIs: All data via Replay Labs API
 * LLM: Vercel AI Gateway for OpenAI
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
 * Complete toolset for verification agent
 */
export const allTools = {
  ...marketDataTools,
  ...verificationTools,
};
