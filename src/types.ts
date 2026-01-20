/**
 * Type definitions for the Semantic Verification Engine
 */

// ═══════════════════════════════════════════════════════════════
// EMBEDDING TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Embedding metadata stored with market data
 */
export interface EmbeddingMetadata {
  /** The embedding vector (1536 dimensions for text-embedding-3-small) */
  vector: number[];
  /** Model used to generate embedding */
  model: string;
  /** Text that was embedded (usually the question) */
  sourceText: string;
  /** When the embedding was generated */
  generatedAt: string;
}

/**
 * Market with cached embedding
 */
export interface MarketWithEmbedding {
  id: string;
  venue: 'KALSHI' | 'POLYMARKET';
  question: string;
  description?: string;
  /** Cached embedding for fast similarity comparison */
  embedding?: EmbeddingMetadata;
}

// ═══════════════════════════════════════════════════════════════
// MARKET TYPES
// ═══════════════════════════════════════════════════════════════

export interface MarketResolutionCriteria {
  platform: 'kalshi' | 'polymarket';
  marketId: string;
  question: string;
  description?: string;
  resolutionSource?: string;
  resolutionDate?: string;
  rules?: string[];
  category?: string;
  /** Cached embedding for fast similarity comparison */
  embedding?: EmbeddingMetadata;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  expirationTime: string;
  lastTradeTime?: string;
  /** Cached embedding for fast similarity comparison */
  embedding?: EmbeddingMetadata;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  category: string;
  endDate: string;
  outcomes: {
    name: string;
    price: number;
  }[];
  volume: number;
  liquidity: number;
  active: boolean;
  /** Cached embedding for fast similarity comparison */
  embedding?: EmbeddingMetadata;
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION TYPES
// ═══════════════════════════════════════════════════════════════

export type MisalignmentType = 
  | 'RESOLUTION_DATE' 
  | 'RESOLUTION_SOURCE' 
  | 'SCOPE' 
  | 'THRESHOLD' 
  | 'DEFINITION' 
  | 'EDGE_CASE';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Recommendation = 
  | 'SAFE_TO_TRADE' 
  | 'PROCEED_WITH_CAUTION' 
  | 'AVOID' 
  | 'MANUAL_REVIEW';

export interface Misalignment {
  type: MisalignmentType;
  severity: Severity;
  description: string;
  kalshiValue?: string;
  polymarketValue?: string;
  potentialImpact: string;
}

export interface DetailedAnalysis {
  questionMatch: boolean;
  dateMatch: boolean;
  sourceMatch: boolean;
  rulesMatch: boolean;
  scopeMatch: boolean;
}

export interface VerificationResult {
  isMatch: boolean;
  matchConfidence: number;
  semanticSimilarity: number;
  misalignments: Misalignment[];
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  reasoning: string;
  detailedAnalysis: DetailedAnalysis;
}

export interface MarketPairMatch {
  kalshiMarket: MarketResolutionCriteria;
  polymarketMarket: MarketResolutionCriteria;
  verification: VerificationResult;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// VERIFIED PAIRS REGISTRY
// ═══════════════════════════════════════════════════════════════

export type VerificationStatus = 'VERIFIED_MATCH' | 'NEEDS_REVIEW' | 'KNOWN_MISMATCH';

export interface VerifiedMarketPair {
  id: string;
  name: string;
  kalshi: {
    ticker: string;
    question: string;
  };
  polymarket: {
    conditionId: string;
    question: string;
  };
  lastVerified: string;
  verificationStatus: VerificationStatus;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// AGENT RESULT TYPES
// ═══════════════════════════════════════════════════════════════

export interface MatchedPairResult {
  kalshi: {
    ticker: string;
    question: string;
    price?: number;
  };
  polymarket: {
    id: string;
    question: string;
    price?: number;
  };
  verification: {
    isMatch: boolean;
    matchConfidence: number;
    riskLevel: string;
    recommendation: string;
    misalignments: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  };
  priceSpread?: number;
  arbitrageOpportunity: boolean;
}

export interface VerificationAgentResult {
  topic: string;
  timestamp: string;
  matchedPairs: MatchedPairResult[];
  summary: string;
  statistics: {
    marketsScanned: {
      kalshi: number;
      polymarket: number;
    };
    matchesFound: number;
    safeToTrade: number;
    proceedWithCaution: number;
    avoid: number;
    needsReview: number;
  };
}

export interface QuickVerifyResult {
  verified: boolean;
  confidence: number;
  recommendation: string;
  topMisalignment?: string;
}

export interface ArbitrageOpportunity {
  kalshiTicker: string;
  polymarketId: string;
  kalshiPrice: number;
  polymarketPrice: number;
  spread: number;
  verified: boolean;
  recommendation: string;
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION REPORT
// ═══════════════════════════════════════════════════════════════

export interface VerificationReport {
  reportId: string;
  generatedAt: string;
  markets: {
    kalshi: string;
    polymarket: string;
    priceSpread: string;
  };
  assessment: {
    isEquivalent: boolean;
    confidence: string;
    semanticSimilarity: string;
    riskLevel: RiskLevel;
    recommendation: Recommendation;
  };
  misalignmentSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  misalignments: Array<Misalignment & { emoji: string }>;
  tradingGuidance: string[];
  aiReasoning: string;
}
