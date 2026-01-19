/**
 * Market Verification Agent
 * 
 * Specialized agent for finding and verifying cross-platform market matches.
 * Uses LLM semantic analysis to detect resolution criteria misalignments.
 */

import {
  searchKalshiMarkets,
  searchPolymarketMarkets,
  verifyMarketPair,
  findMatchingMarkets,
} from './tools';
import type {
  VerificationAgentResult,
  MatchedPairResult,
  QuickVerifyResult,
  ArbitrageOpportunity,
} from './types';

/**
 * Run the verification agent to find and verify cross-platform market matches
 */
export async function runVerificationAgent(topic: string): Promise<VerificationAgentResult> {
  // Step 1: Search markets on both platforms
  const [kalshiResult, polymarketResult] = await Promise.all([
    searchKalshiMarkets.execute({ query: topic, status: 'open', limit: 20 }, {} as any),
    searchPolymarketMarkets.execute({ query: topic, active: true, limit: 20 }, {} as any),
  ]);
  
  const kalshiMarkets = kalshiResult.markets || [];
  const polymarketMarkets = polymarketResult.markets || [];
  
  if (kalshiMarkets.length === 0 && polymarketMarkets.length === 0) {
    return {
      topic,
      timestamp: new Date().toISOString(),
      matchedPairs: [],
      summary: `No markets found for topic: "${topic}"`,
      statistics: {
        marketsScanned: { kalshi: 0, polymarket: 0 },
        matchesFound: 0,
        safeToTrade: 0,
        proceedWithCaution: 0,
        avoid: 0,
        needsReview: 0,
      },
    };
  }
  
  // Step 2: Find matching pairs
  const matchResult = await findMatchingMarkets.execute({
    topic,
    kalshiMarkets: kalshiMarkets.map((m: any) => ({
      ticker: m.ticker,
      title: m.title,
      category: m.category,
      expirationTime: m.expirationTime,
    })),
    polymarketMarkets: polymarketMarkets.map((m: any) => ({
      id: m.id,
      question: m.question,
      category: m.category,
      endDate: m.endDate,
    })),
    minSimilarity: 0.6,
  }, {} as any);
  
  const potentialMatches = matchResult.matches || [];
  
  // Step 3: Verify each potential match
  const matchedPairs: MatchedPairResult[] = [];
  
  for (const match of potentialMatches.slice(0, 5)) {
    const kalshiMarket = kalshiMarkets.find((m: any) => m.ticker === match.kalshiMarket?.ticker);
    const polyMarket = polymarketMarkets.find((m: any) => m.id === match.polymarketMarket?.id);
    
    if (!kalshiMarket || !polyMarket) continue;
    
    const verifyResult = await verifyMarketPair.execute({
      kalshiMarket: {
        marketId: kalshiMarket.ticker,
        question: kalshiMarket.title,
        description: kalshiMarket.subtitle,
        category: kalshiMarket.category,
        resolutionDate: kalshiMarket.expirationTime,
      },
      polymarketMarket: {
        marketId: polyMarket.id,
        question: polyMarket.question,
        description: polyMarket.description,
        category: polyMarket.category,
        resolutionDate: polyMarket.endDate,
      },
    }, {} as any);
    
    if (verifyResult.success && verifyResult.verification) {
      const priceSpread = Math.abs(
        (kalshiMarket.yesPrice || 0.5) - (polyMarket.outcomes?.[0]?.price || 0.5)
      ) * 100;
      
      matchedPairs.push({
        kalshi: {
          ticker: kalshiMarket.ticker,
          question: kalshiMarket.title,
          price: kalshiMarket.yesPrice,
        },
        polymarket: {
          id: polyMarket.id,
          question: polyMarket.question,
          price: polyMarket.outcomes?.[0]?.price,
        },
        verification: {
          isMatch: verifyResult.verification.isMatch,
          matchConfidence: verifyResult.verification.matchConfidence,
          riskLevel: verifyResult.verification.riskLevel,
          recommendation: verifyResult.verification.recommendation,
          misalignments: verifyResult.verification.misalignments.map((m: any) => ({
            type: m.type,
            severity: m.severity,
            description: m.description,
          })),
        },
        priceSpread,
        arbitrageOpportunity: verifyResult.verification.recommendation === 'SAFE_TO_TRADE' && priceSpread > 3,
      });
    }
  }
  
  // Calculate statistics
  const stats = {
    marketsScanned: {
      kalshi: kalshiMarkets.length,
      polymarket: polymarketMarkets.length,
    },
    matchesFound: matchedPairs.length,
    safeToTrade: matchedPairs.filter(p => p.verification.recommendation === 'SAFE_TO_TRADE').length,
    proceedWithCaution: matchedPairs.filter(p => p.verification.recommendation === 'PROCEED_WITH_CAUTION').length,
    avoid: matchedPairs.filter(p => p.verification.recommendation === 'AVOID').length,
    needsReview: matchedPairs.filter(p => p.verification.recommendation === 'MANUAL_REVIEW').length,
  };
  
  // Generate summary
  const arbOpportunities = matchedPairs.filter(p => p.arbitrageOpportunity);
  let summary = `Found ${matchedPairs.length} potential market matches for "${topic}". `;
  
  if (arbOpportunities.length > 0) {
    summary += `🎯 ${arbOpportunities.length} verified arbitrage opportunities with >3¢ spread. `;
    const bestOpp = arbOpportunities.sort((a, b) => (b.priceSpread || 0) - (a.priceSpread || 0))[0];
    if (bestOpp) {
      summary += `Best: ${bestOpp.kalshi.ticker} vs ${bestOpp.polymarket.id} (${Math.round(bestOpp.priceSpread || 0)}¢ spread).`;
    }
  } else if (stats.safeToTrade > 0) {
    summary += `${stats.safeToTrade} pairs verified safe but spreads are tight.`;
  } else if (matchedPairs.length > 0) {
    summary += `⚠️ All matches have resolution criteria differences - review carefully.`;
  } else {
    summary += 'No equivalent market pairs found.';
  }
  
  return {
    topic,
    timestamp: new Date().toISOString(),
    matchedPairs,
    summary,
    statistics: stats,
  };
}

/**
 * Quick verification for a specific market pair
 */
export async function quickVerify(
  kalshiTicker: string,
  polymarketId: string
): Promise<QuickVerifyResult> {
  const [kalshiResult, polymarketResult] = await Promise.all([
    searchKalshiMarkets.execute({ query: kalshiTicker, status: 'open', limit: 5 }, {} as any),
    searchPolymarketMarkets.execute({ query: polymarketId, active: true, limit: 5 }, {} as any),
  ]);
  
  const kalshiMarket = kalshiResult.markets?.find((m: any) => 
    m.ticker === kalshiTicker || m.title.toLowerCase().includes(kalshiTicker.toLowerCase())
  );
  const polyMarket = polymarketResult.markets?.find((m: any) => 
    m.id === polymarketId || m.question.toLowerCase().includes(polymarketId.toLowerCase())
  );
  
  if (!kalshiMarket || !polyMarket) {
    return {
      verified: false,
      confidence: 0,
      recommendation: 'Markets not found',
    };
  }
  
  const result = await verifyMarketPair.execute({
    kalshiMarket: {
      marketId: kalshiMarket.ticker,
      question: kalshiMarket.title,
      category: kalshiMarket.category,
    },
    polymarketMarket: {
      marketId: polyMarket.id,
      question: polyMarket.question,
      category: polyMarket.category,
    },
  }, {} as any);
  
  if (!result.success) {
    return {
      verified: false,
      confidence: 0,
      recommendation: 'Verification failed',
    };
  }
  
  return {
    verified: result.verification?.isMatch || false,
    confidence: result.verification?.matchConfidence || 0,
    recommendation: result.verification?.recommendation || 'UNKNOWN',
    topMisalignment: result.verification?.misalignments?.[0]?.description,
  };
}

/**
 * Get all verified arbitrage opportunities for a topic
 */
export async function getVerifiedArbitrageOpportunities(topic: string): Promise<{
  opportunities: ArbitrageOpportunity[];
  summary: string;
}> {
  const result = await runVerificationAgent(topic);
  
  const opportunities = result.matchedPairs
    .filter(p => p.verification.recommendation === 'SAFE_TO_TRADE' || p.verification.recommendation === 'PROCEED_WITH_CAUTION')
    .map(p => ({
      kalshiTicker: p.kalshi.ticker,
      polymarketId: p.polymarket.id,
      kalshiPrice: p.kalshi.price || 0.5,
      polymarketPrice: p.polymarket.price || 0.5,
      spread: p.priceSpread || 0,
      verified: p.verification.isMatch,
      recommendation: p.verification.recommendation,
    }))
    .sort((a, b) => b.spread - a.spread);
  
  return {
    opportunities,
    summary: result.summary,
  };
}
