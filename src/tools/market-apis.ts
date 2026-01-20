/**
 * Market API Tools via Replay Labs
 * 
 * All market discovery and data comes from Replay Labs API.
 * Base URL: https://replay-lab-delta.preview.recall.network
 * 
 * Key Endpoints:
 * - /api/markets/search - Text search across venues
 * - /api/markets/semantic-search - Vector semantic search
 * - /api/markets/overlap - Cross-venue market matching
 * - /api/markets/{venue}/{id} - Single market with prices
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { KalshiMarket, PolymarketMarket } from '../types';

// ═══════════════════════════════════════════════════════════════
// REPLAY LABS API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const REPLAY_LABS_API_KEY = process.env.REPLAY_LABS_API_KEY;
const REPLAY_LABS_BASE_URL = process.env.REPLAY_LABS_BASE_URL || 'https://replay-lab-delta.preview.recall.network';

type Venue = 'KALSHI' | 'POLYMARKET' | 'HYPERLIQUID_PERP' | 'HYPERLIQUID_SPOT' | 'COINBASE' | 'AERODROME';
type PredictionVenue = 'KALSHI' | 'POLYMARKET';

interface ReplayLabsMarket {
  venue: Venue;
  id: string;
  canonicalId: string;
  marketType: string;
  symbol?: string;
  question?: string;
  outcomes?: string[];
  prices?: Record<string, number>;
  isOpen: boolean;
  isBinary?: boolean;
  volume24h?: number;
  metadata?: Record<string, any>;
}

interface SemanticSearchResult {
  market: ReplayLabsMarket;
  score: number;
}

async function replayLabsFetch(endpoint: string, options: RequestInit = {}) {
  if (!REPLAY_LABS_API_KEY) {
    throw new Error('REPLAY_LABS_API_KEY is required');
  }

  const response = await fetch(`${REPLAY_LABS_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'x-api-key': REPLAY_LABS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replay Labs API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// MARKET SEARCH (Text Search)
// GET /api/markets/search
// ═══════════════════════════════════════════════════════════════

export const searchMarkets = tool({
  description: `Search markets across Kalshi and Polymarket by keyword.
    Uses Replay Labs unified market search API.
    Returns markets with question, outcomes, and status.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "Bitcoin", "election")'),
    venue: z.enum(['KALSHI', 'POLYMARKET']).optional().describe('Filter by venue'),
    active: z.boolean().optional().describe('Only return active/open markets'),
    limit: z.number().min(1).max(100).optional().describe('Max results'),
  }),
  execute: async ({ query, venue, active = true, limit = 20 }) => {
    try {
      const params = new URLSearchParams({
        q: query,
        active: String(active),
        limit: String(limit),
      });
      if (venue) params.append('venue', venue);

      const data = await replayLabsFetch(`/api/markets/search?${params}`);

      return {
        success: true,
        markets: data.markets,
        total: data.total,
        hasMore: data.hasMore,
        query,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

/**
 * Search Kalshi markets specifically
 */
export const searchKalshiMarkets = tool({
  description: 'Search Kalshi prediction markets via Replay Labs',
  parameters: z.object({
    query: z.string().describe('Search query'),
    active: z.boolean().optional().describe('Only active markets'),
    limit: z.number().min(1).max(50).optional().describe('Max results'),
  }),
  execute: async ({ query, active = true, limit = 10 }) => {
    try {
      const params = new URLSearchParams({
        q: query,
        venue: 'KALSHI',
        active: String(active),
        limit: String(limit),
      });

      const data = await replayLabsFetch(`/api/markets/search?${params}`);

      return {
        success: true,
        markets: data.markets.map(formatAsKalshiMarket),
        total: data.total,
        query,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

/**
 * Search Polymarket markets specifically
 */
export const searchPolymarketMarkets = tool({
  description: 'Search Polymarket prediction markets via Replay Labs',
  parameters: z.object({
    query: z.string().describe('Search query'),
    active: z.boolean().optional().describe('Only active markets'),
    limit: z.number().min(1).max(50).optional().describe('Max results'),
  }),
  execute: async ({ query, active = true, limit = 10 }) => {
    try {
      const params = new URLSearchParams({
        q: query,
        venue: 'POLYMARKET',
        active: String(active),
        limit: String(limit),
      });

      const data = await replayLabsFetch(`/api/markets/search?${params}`);

      return {
        success: true,
        markets: data.markets.map(formatAsPolymarketMarket),
        total: data.total,
        query,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// SEMANTIC SEARCH (Vector-based)
// GET /api/markets/semantic-search
// ═══════════════════════════════════════════════════════════════

export const semanticSearchMarkets = tool({
  description: `Semantic search across Polymarket and Kalshi using vector similarity.
    Better for natural language queries like "Will Homer Simpson announce Presidential run?"
    Returns markets with similarity scores.`,
  parameters: z.object({
    query: z.string().describe('Natural language query'),
    venue: z.enum(['KALSHI', 'POLYMARKET']).optional(),
    active: z.boolean().optional().describe('Only active markets'),
    limit: z.number().min(1).max(100).optional().describe('Max results'),
    minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score'),
  }),
  execute: async ({ query, venue, active = true, limit = 10, minScore }) => {
    try {
      const params = new URLSearchParams({
        q: query,
        active: String(active),
        limit: String(limit),
      });
      if (venue) params.append('venue', venue);
      if (minScore !== undefined) params.append('minScore', String(minScore));

      const data = await replayLabsFetch(`/api/markets/semantic-search?${params}`);

      return {
        success: true,
        markets: data.markets.map((r: SemanticSearchResult) => ({
          ...r.market,
          similarityScore: r.score,
        })),
        total: data.total,
        hasMore: data.hasMore,
        query,
        source: 'replay-labs/semantic',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// CROSS-VENUE OVERLAP (Market Matching)
// GET /api/markets/overlap
// ═══════════════════════════════════════════════════════════════

export const findOverlapMarkets = tool({
  description: `Find cross-venue overlap candidates between Polymarket and Kalshi.
    Given a market on one venue, finds similar markets on the other venue.
    Perfect for finding arbitrage opportunities!`,
  parameters: z.object({
    venue: z.enum(['KALSHI', 'POLYMARKET']).describe('Source venue'),
    venuePk: z.string().describe('Market ID on source venue'),
    targetVenue: z.enum(['KALSHI', 'POLYMARKET']).optional().describe('Target venue (defaults to opposite)'),
    limit: z.number().min(1).max(100).optional().describe('Max results'),
    minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score'),
  }),
  execute: async ({ venue, venuePk, targetVenue, limit = 5, minScore }) => {
    try {
      const params = new URLSearchParams({
        venue,
        venuePk,
        limit: String(limit),
      });
      if (targetVenue) params.append('targetVenue', targetVenue);
      if (minScore !== undefined) params.append('minScore', String(minScore));

      const data = await replayLabsFetch(`/api/markets/overlap?${params}`);

      return {
        success: true,
        sourceVenue: venue,
        sourceMarketId: venuePk,
        overlaps: data.markets.map((r: SemanticSearchResult) => ({
          market: r.market,
          similarityScore: r.score,
        })),
        total: data.total,
        hasMore: data.hasMore,
        source: 'replay-labs/overlap',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// SIMILAR MARKETS (Within/Across Venues)
// GET /api/markets/similar
// ═══════════════════════════════════════════════════════════════

export const findSimilarMarkets = tool({
  description: 'Find markets similar to an existing market using vector similarity',
  parameters: z.object({
    venue: z.enum(['KALSHI', 'POLYMARKET']).describe('Source venue'),
    venuePk: z.string().describe('Market ID'),
    active: z.boolean().optional().describe('Only active markets'),
    limit: z.number().min(1).max(100).optional().describe('Max results'),
    minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score'),
  }),
  execute: async ({ venue, venuePk, active = true, limit = 5, minScore }) => {
    try {
      const params = new URLSearchParams({
        venue,
        venuePk,
        active: String(active),
        limit: String(limit),
      });
      if (minScore !== undefined) params.append('minScore', String(minScore));

      const data = await replayLabsFetch(`/api/markets/similar?${params}`);

      return {
        success: true,
        sourceVenue: venue,
        sourceMarketId: venuePk,
        similar: data.markets.map((r: SemanticSearchResult) => ({
          market: r.market,
          similarityScore: r.score,
        })),
        total: data.total,
        source: 'replay-labs/similar',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// SINGLE MARKET DETAILS
// GET /api/markets/{venue}/{identifier}
// ═══════════════════════════════════════════════════════════════

export const getMarket = tool({
  description: 'Get a single market with current prices by venue and ID',
  parameters: z.object({
    venue: z.enum(['KALSHI', 'POLYMARKET']).describe('Market venue'),
    identifier: z.string().describe('Market ID (ticker for Kalshi, condition ID for Polymarket)'),
    freshnessMs: z.number().optional().describe('Price freshness window in ms (for JIIT quotes)'),
  }),
  execute: async ({ venue, identifier, freshnessMs }) => {
    try {
      const params = freshnessMs ? `?freshness_ms=${freshnessMs}` : '';
      const data = await replayLabsFetch(`/api/markets/${venue}/${identifier}${params}`);

      return {
        success: true,
        market: data.market,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

export const getKalshiMarket = tool({
  description: 'Get a Kalshi market by ticker with current prices',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
    freshnessMs: z.number().optional().describe('Price freshness in ms'),
  }),
  execute: async ({ ticker, freshnessMs = 5000 }) => {
    try {
      const data = await replayLabsFetch(`/api/markets/KALSHI/${ticker}?freshness_ms=${freshnessMs}`);
      return {
        success: true,
        market: formatAsKalshiMarket(data.market),
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

export const getPolymarketMarket = tool({
  description: 'Get a Polymarket market by condition ID with current prices',
  parameters: z.object({
    conditionId: z.string().describe('Polymarket condition ID'),
    freshnessMs: z.number().optional().describe('Price freshness in ms'),
  }),
  execute: async ({ conditionId, freshnessMs = 5000 }) => {
    try {
      const data = await replayLabsFetch(`/api/markets/POLYMARKET/${conditionId}?freshness_ms=${freshnessMs}`);
      return {
        success: true,
        market: formatAsPolymarketMarket(data.market),
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const listWebSocketVenues = tool({
  description: 'List available WebSocket venues for real-time data streaming',
  parameters: z.object({}),
  execute: async () => {
    try {
      const data = await replayLabsFetch('/api/ws/venues');
      return {
        success: true,
        venues: data.venues,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

export const buildWebSocketPayload = tool({
  description: 'Build WebSocket connection config for real-time market data',
  parameters: z.object({
    venue: z.enum(['KALSHI', 'POLYMARKET', 'COINBASE_EXCHANGE', 'HYPERLIQUID_PERP']),
    channels: z.array(z.string()).optional(),
    markets: z.array(z.string()).optional(),
  }),
  execute: async ({ venue, channels, markets }) => {
    try {
      const data = await replayLabsFetch('/api/ws/connect', {
        method: 'POST',
        body: JSON.stringify({
          venue,
          channels,
          channelsConfig: markets ? { markets } : undefined,
        }),
      });

      return {
        success: true,
        wsUrl: data.wsUrl,
        authMode: data.authMode,
        subscribePayloads: data.subscribePayloads,
        messageSchemas: data.messageSchemas,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════

function formatAsKalshiMarket(m: any): KalshiMarket {
  // Handle both raw API response and ReplayLabsMarket format
  const yesPrice = m.prices?.['Yes'] ?? m.prices?.['yes'] ?? 0.5;
  return {
    ticker: m.id || m.ticker || '',
    title: m.question || m.symbol || m.id || '',
    subtitle: m.metadata?.subtitle || m.description || '',
    category: m.metadata?.category || m.metadata?.seriesTicker || 'General',
    status: m.isOpen ? 'open' : (m.metadata?.status || 'unknown'),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume: m.volume24h || m.volume || 0,
    liquidity: m.metadata?.liquidity || 0,
    expirationTime: m.closeTime || m.metadata?.expirationTime || m.metadata?.endDate || '',
    lastTradeTime: m.metadata?.lastTradeTime,
  };
}

function formatAsPolymarketMarket(m: any): PolymarketMarket {
  // Handle both raw API response and ReplayLabsMarket format
  const outcomes = (m.outcomes || ['Yes', 'No']).map((name: string, i: number) => ({
    name,
    price: m.prices?.[name] ?? (i === 0 ? 0.5 : 0.5),
  }));

  return {
    id: m.id || m.conditionId || '',
    question: m.question || m.symbol || m.id || '',
    description: m.metadata?.description || m.description || '',
    category: m.metadata?.category || 'General',
    endDate: m.closeTime || m.metadata?.endDate || m.metadata?.expirationTime || '',
    outcomes,
    volume: m.volume24h || m.volume || 0,
    liquidity: m.metadata?.liquidity || 0,
    active: m.isOpen !== false,
  };
}
