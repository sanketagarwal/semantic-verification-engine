/**
 * Export all verification tools
 */

export {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  quickSimilarityScore,
} from './verification';

// Market APIs via Replay Labs
export {
  searchKalshiMarkets,
  getKalshiOrderbook,
  getKalshiMarketDetails,
  searchPolymarketMarkets,
  getPolymarketOrderbook,
  getPolymarketSpreads,
  getMatchedMarketPairs,
} from './market-apis';
