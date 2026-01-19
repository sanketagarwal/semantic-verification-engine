/**
 * Semantic Verification Engine - Tool Exports
 * 
 * Market APIs: Uses Replay Labs WebSocket infrastructure + direct venue APIs for discovery
 * Verification: LLM-powered semantic comparison of market resolution criteria
 */

// ═══════════════════════════════════════════════════════════════
// MARKET DATA TOOLS (via Replay Labs + Venue APIs)
// ═══════════════════════════════════════════════════════════════

export {
  // Replay Labs WebSocket tools
  listWebSocketVenues,
  buildWebSocketPayload,
  
  // Market discovery
  searchKalshiMarkets,
  searchPolymarketMarkets,
  
  // Orderbook streaming configs
  getKalshiOrderbook,
  getPolymarketOrderbook,
  
  // Crypto data (Coinbase via Replay Labs)
  getOHLCV,
  getIndicators,
  listReplays,
} from './market-apis';

// ═══════════════════════════════════════════════════════════════
// SEMANTIC VERIFICATION TOOLS
// ═══════════════════════════════════════════════════════════════

export {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  getVerifiedPairs,
} from './verification';

// ═══════════════════════════════════════════════════════════════
// TOOL COLLECTIONS (for use with AI SDK)
// ═══════════════════════════════════════════════════════════════

import {
  listWebSocketVenues,
  buildWebSocketPayload,
  searchKalshiMarkets,
  searchPolymarketMarkets,
  getKalshiOrderbook,
  getPolymarketOrderbook,
  getOHLCV,
  getIndicators,
  listReplays,
} from './market-apis';

import {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  getVerifiedPairs,
} from './verification';

/**
 * All tools for market data access
 */
export const marketDataTools = {
  listWebSocketVenues,
  buildWebSocketPayload,
  searchKalshiMarkets,
  searchPolymarketMarkets,
  getKalshiOrderbook,
  getPolymarketOrderbook,
  getOHLCV,
  getIndicators,
  listReplays,
};

/**
 * All tools for semantic verification
 */
export const verificationTools = {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  getVerifiedPairs,
};

/**
 * Complete toolset for verification agent
 */
export const allTools = {
  ...marketDataTools,
  ...verificationTools,
};
