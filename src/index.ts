/**
 * Semantic Verification Engine
 * 
 * LLM-powered cross-platform prediction market verification.
 * Detects resolution criteria misalignments between Kalshi and Polymarket.
 * 
 * @example
 * ```typescript
 * import { runVerificationAgent, quickVerify } from 'semantic-verification-engine';
 * 
 * // Full topic-based verification
 * const result = await runVerificationAgent('Fed rates');
 * console.log(result.matchedPairs);
 * 
 * // Quick single-pair verification
 * const check = await quickVerify('FED-26JAN-T4.50', 'fed-rate-jan-2026');
 * console.log(check.recommendation);
 * ```
 */

// Agent exports
export {
  runVerificationAgent,
  quickVerify,
  getVerifiedArbitrageOpportunities,
} from './agent';

// Tool exports
export {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  quickSimilarityScore,
  // Replay Labs market APIs
  searchKalshiMarkets,
  getKalshiOrderbook,
  getKalshiMarketDetails,
  searchPolymarketMarkets,
  getPolymarketOrderbook,
  getPolymarketSpreads,
  getMatchedMarketPairs,
} from './tools';

// Type exports
export type {
  // Market types
  MarketResolutionCriteria,
  KalshiMarket,
  PolymarketMarket,
  
  // Verification types
  MisalignmentType,
  Severity,
  RiskLevel,
  Recommendation,
  Misalignment,
  DetailedAnalysis,
  VerificationResult,
  MarketPairMatch,
  
  // Registry types
  VerificationStatus,
  VerifiedMarketPair,
  
  // Agent result types
  MatchedPairResult,
  VerificationAgentResult,
  QuickVerifyResult,
  ArbitrageOpportunity,
  
  // Report types
  VerificationReport,
} from './types';

// Version
export const VERSION = '1.0.0';
