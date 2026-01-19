/**
 * Market API Tools via Replay Labs
 * 
 * All market data is fetched through Replay Labs unified API.
 * Replay Labs aggregates Kalshi and Polymarket data.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { KalshiMarket, PolymarketMarket } from '../types';

// ═══════════════════════════════════════════════════════════════
// REPLAY LABS API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const REPLAY_LABS_API_KEY = process.env.REPLAY_LABS_API_KEY;
const REPLAY_LABS_BASE_URL = process.env.REPLAY_LABS_BASE_URL || 'https://api.replaylabs.io';

async function replayLabsFetch(endpoint: string, options: RequestInit = {}) {
  if (!REPLAY_LABS_API_KEY) {
    throw new Error('REPLAY_LABS_API_KEY is required');
  }

  const response = await fetch(`${REPLAY_LABS_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${REPLAY_LABS_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Replay Labs API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// KALSHI TOOLS (via Replay Labs)
// ═══════════════════════════════════════════════════════════════

/**
 * Search Kalshi markets via Replay Labs
 */
export const searchKalshiMarkets = tool({
  description: `Search Kalshi prediction markets via Replay Labs API.
    Returns markets with current prices, volume, and liquidity.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "inflation", "election")'),
    status: z.enum(['open', 'closed', 'settled', 'all']).default('open'),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async ({ query, status, limit }) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(status !== 'all' && { status }),
      });

      const data = await replayLabsFetch(`/api/kalshi/markets?${params}`);
      
      const queryLower = query.toLowerCase();
      const filtered = (data.markets || data || [])
        .filter((m: any) => 
          m.title?.toLowerCase().includes(queryLower) ||
          m.subtitle?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower) ||
          m.ticker?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatKalshiMarket),
        query,
        count: filtered.length,
        source: 'replay-labs/kalshi',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        markets: [],
        query,
        count: 0,
        source: 'replay-labs/kalshi',
      };
    }
  },
});

/**
 * Get orderbook for a specific Kalshi market via Replay Labs
 */
export const getKalshiOrderbook = tool({
  description: 'Get the orderbook (bids/asks) for a specific Kalshi market ticker via Replay Labs.',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
  }),
  execute: async ({ ticker }) => {
    try {
      const data = await replayLabsFetch(`/api/kalshi/markets/${ticker}/orderbook`);
      
      const bids = (data.orderbook?.yes || data.bids || []).map((o: any) => ({ 
        price: (o.price || o.p) / 100, 
        quantity: o.count || o.q || o.quantity
      }));
      const asks = (data.orderbook?.no || data.asks || []).map((o: any) => ({ 
        price: (100 - (o.price || o.p)) / 100, 
        quantity: o.count || o.q || o.quantity
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        success: true,
        orderbook: { 
          ticker, 
          bids, 
          asks, 
          spread: bestAsk - bestBid, 
          midPrice: (bestBid + bestAsk) / 2 
        },
        source: 'replay-labs/kalshi',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        source: 'replay-labs/kalshi',
      };
    }
  },
});

/**
 * Get detailed Kalshi market info via Replay Labs
 */
export const getKalshiMarketDetails = tool({
  description: 'Get detailed information about a specific Kalshi market via Replay Labs.',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
  }),
  execute: async ({ ticker }) => {
    try {
      const data = await replayLabsFetch(`/api/kalshi/markets/${ticker}`);
      
      return {
        success: true,
        market: formatKalshiMarket(data.market || data),
        source: 'replay-labs/kalshi',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        source: 'replay-labs/kalshi',
      };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// POLYMARKET TOOLS (via Replay Labs)
// ═══════════════════════════════════════════════════════════════

/**
 * Search Polymarket markets via Replay Labs
 */
export const searchPolymarketMarkets = tool({
  description: `Search Polymarket prediction markets via Replay Labs API.
    Returns markets with current prices, volume, and liquidity.`,
  parameters: z.object({
    query: z.string().describe('Search query'),
    active: z.boolean().default(true),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async ({ query, active, limit }) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        active: active.toString(),
      });

      const data = await replayLabsFetch(`/api/polymarket/markets?${params}`);
      
      const queryLower = query.toLowerCase();
      const filtered = (data.markets || data || [])
        .filter((m: any) => 
          m.question?.toLowerCase().includes(queryLower) ||
          m.description?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower) ||
          m.title?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatPolymarketMarket),
        query,
        count: filtered.length,
        source: 'replay-labs/polymarket',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        markets: [],
        query,
        count: 0,
        source: 'replay-labs/polymarket',
      };
    }
  },
});

/**
 * Get Polymarket orderbook/spreads via Replay Labs
 */
export const getPolymarketOrderbook = tool({
  description: 'Get orderbook and spreads for a Polymarket token via Replay Labs.',
  parameters: z.object({
    tokenId: z.string().describe('Polymarket token ID'),
  }),
  execute: async ({ tokenId }) => {
    try {
      const data = await replayLabsFetch(`/api/polymarket/clob/book?token_id=${tokenId}`);
      
      const bids = (data.bids || []).slice(0, 5).map((b: any) => ({
        price: parseFloat(b.price || b.p),
        size: parseFloat(b.size || b.s),
      }));
      
      const asks = (data.asks || []).slice(0, 5).map((a: any) => ({
        price: parseFloat(a.price || a.p),
        size: parseFloat(a.size || a.s),
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        success: true,
        orderbook: {
          tokenId,
          bids,
          asks,
          spread: bestAsk - bestBid,
          midPrice: (bestBid + bestAsk) / 2,
        },
        source: 'replay-labs/polymarket',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        source: 'replay-labs/polymarket',
      };
    }
  },
});

/**
 * Get spreads for multiple Polymarket tokens via Replay Labs
 */
export const getPolymarketSpreads = tool({
  description: 'Get spreads for multiple Polymarket tokens in one call via Replay Labs.',
  parameters: z.object({
    tokenIds: z.array(z.string()).describe('Array of Polymarket token IDs'),
  }),
  execute: async ({ tokenIds }) => {
    try {
      const data = await replayLabsFetch('/api/polymarket/clob/spreads', {
        method: 'POST',
        body: JSON.stringify(tokenIds.map(token_id => ({ token_id }))),
      });

      return {
        success: true,
        spreads: data,
        source: 'replay-labs/polymarket',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        source: 'replay-labs/polymarket',
      };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// CROSS-PLATFORM TOOLS (via Replay Labs)
// ═══════════════════════════════════════════════════════════════

/**
 * Get matched market pairs from Replay Labs registry
 */
export const getMatchedMarketPairs = tool({
  description: 'Get pre-matched market pairs between Kalshi and Polymarket from Replay Labs.',
  parameters: z.object({
    category: z.string().optional().describe('Filter by category'),
    activeOnly: z.boolean().default(true).describe('Only return active markets'),
  }),
  execute: async ({ category, activeOnly }) => {
    try {
      const params = new URLSearchParams({
        ...(category && { category }),
        active: activeOnly.toString(),
      });

      const data = await replayLabsFetch(`/api/matched-pairs?${params}`);

      return {
        success: true,
        pairs: data.pairs || data || [],
        count: (data.pairs || data || []).length,
        source: 'replay-labs',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        pairs: [],
        source: 'replay-labs',
      };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════════════════════

function formatKalshiMarket(m: any): KalshiMarket {
  return {
    ticker: m.ticker,
    title: m.title || m.ticker,
    subtitle: m.subtitle,
    category: m.category || 'unknown',
    status: m.status || 'open',
    yesPrice: (m.yes_bid || m.yes_price || m.last_price || 50) / 100,
    noPrice: 1 - (m.yes_bid || m.yes_price || m.last_price || 50) / 100,
    volume: m.volume || 0,
    liquidity: m.open_interest || m.liquidity || 0,
    expirationTime: m.expiration_time || m.close_time,
    lastTradeTime: m.last_trade_time,
  };
}

function formatPolymarketMarket(m: any): PolymarketMarket {
  const outcomes = (m.outcomes || ['Yes', 'No']).map((name: string, i: number) => ({
    name,
    price: m.outcomePrices?.[i] ? parseFloat(m.outcomePrices[i]) : 
           m.outcome_prices?.[i] ? parseFloat(m.outcome_prices[i]) : 0.5,
  }));

  return {
    id: m.id || m.condition_id || m.conditionId,
    question: m.question || m.title,
    description: m.description,
    category: m.category || 'General',
    endDate: m.end_date_iso || m.endDate || m.end_date,
    outcomes,
    volume: parseFloat(m.volume || m.volumeNum || '0'),
    liquidity: parseFloat(m.liquidity || m.liquidityNum || '0'),
    active: m.active !== false && m.closed !== true,
  };
}
