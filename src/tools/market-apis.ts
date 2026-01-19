/**
 * Market API Tools
 * 
 * Tools for fetching market data from Kalshi and Polymarket
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { KalshiMarket, PolymarketMarket } from '../types';

// ═══════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_BASE_URL = process.env.KALSHI_USE_DEMO === 'true' 
  ? 'https://demo-api.kalshi.co/trade-api/v2'
  : 'https://trading-api.kalshi.com/trade-api/v2';

const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com';

// ═══════════════════════════════════════════════════════════════
// KALSHI TOOLS
// ═══════════════════════════════════════════════════════════════

/**
 * Search Kalshi markets by keyword/topic
 */
export const searchKalshiMarkets = tool({
  description: `Search Kalshi prediction markets by keyword or topic.
    Returns markets with current prices, volume, and liquidity.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "inflation", "election")'),
    status: z.enum(['open', 'closed', 'settled', 'all']).default('open'),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async ({ query, status, limit }) => {
    if (!KALSHI_API_KEY) {
      return getMockKalshiMarkets(query, limit);
    }

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(status !== 'all' && { status }),
      });

      const response = await fetch(`${KALSHI_BASE_URL}/markets?${params}`, {
        headers: {
          'Authorization': `Bearer ${KALSHI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
      }

      const data = await response.json();
      const queryLower = query.toLowerCase();
      const filtered = (data.markets || [])
        .filter((m: any) => 
          m.title?.toLowerCase().includes(queryLower) ||
          m.subtitle?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatKalshiMarket),
        query,
        count: filtered.length,
        source: 'kalshi',
      };
    } catch (error) {
      return getMockKalshiMarkets(query, limit);
    }
  },
});

/**
 * Get orderbook for a specific Kalshi market
 */
export const getKalshiOrderbook = tool({
  description: 'Get the orderbook (bids/asks) for a specific Kalshi market ticker.',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
  }),
  execute: async ({ ticker }) => {
    if (!KALSHI_API_KEY) {
      return getMockOrderbook(ticker);
    }

    try {
      const response = await fetch(`${KALSHI_BASE_URL}/markets/${ticker}/orderbook`, {
        headers: { 'Authorization': `Bearer ${KALSHI_API_KEY}` },
      });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
      }

      const data = await response.json();
      const bids = (data.orderbook?.yes || []).map((o: any) => ({ 
        price: o.price / 100, 
        quantity: o.count 
      }));
      const asks = (data.orderbook?.no || []).map((o: any) => ({ 
        price: (100 - o.price) / 100, 
        quantity: o.count 
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        success: true,
        orderbook: { ticker, bids, asks, spread: bestAsk - bestBid, midPrice: (bestBid + bestAsk) / 2 },
      };
    } catch (error) {
      return getMockOrderbook(ticker);
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// POLYMARKET TOOLS
// ═══════════════════════════════════════════════════════════════

/**
 * Search Polymarket markets by keyword/topic
 */
export const searchPolymarketMarkets = tool({
  description: `Search Polymarket prediction markets by keyword or topic.
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

      const response = await fetch(`${POLYMARKET_GAMMA_URL}/markets?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return getMockPolymarketMarkets(query, limit);
      }

      const data = await response.json();
      const queryLower = query.toLowerCase();
      const filtered = (data || [])
        .filter((m: any) => 
          m.question?.toLowerCase().includes(queryLower) ||
          m.description?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatPolymarketMarket),
        query,
        count: filtered.length,
        source: 'polymarket',
      };
    } catch (error) {
      return getMockPolymarketMarkets(query, limit);
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
    yesPrice: (m.yes_bid || m.last_price || 50) / 100,
    noPrice: 1 - (m.yes_bid || m.last_price || 50) / 100,
    volume: m.volume || 0,
    liquidity: m.open_interest || 0,
    expirationTime: m.expiration_time || m.close_time,
    lastTradeTime: m.last_trade_time,
  };
}

function formatPolymarketMarket(m: any): PolymarketMarket {
  const outcomes = (m.outcomes || ['Yes', 'No']).map((name: string, i: number) => ({
    name,
    price: m.outcomePrices?.[i] ? parseFloat(m.outcomePrices[i]) : 0.5,
  }));

  return {
    id: m.id || m.condition_id,
    question: m.question || m.title,
    description: m.description,
    category: m.category || 'General',
    endDate: m.end_date_iso || m.endDate,
    outcomes,
    volume: parseFloat(m.volume || m.volumeNum || '0'),
    liquidity: parseFloat(m.liquidity || m.liquidityNum || '0'),
    active: m.active !== false && m.closed !== true,
  };
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA (for development/demo)
// ═══════════════════════════════════════════════════════════════

function getMockKalshiMarkets(query: string, limit: number) {
  const mockMarkets: KalshiMarket[] = [
    {
      ticker: 'FED-26JAN-T4.50',
      title: 'Will the Fed cut rates in January 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.72,
      noPrice: 0.28,
      volume: 450000,
      liquidity: 125000,
      expirationTime: '2026-01-31T23:59:59Z',
    },
    {
      ticker: 'INFLATION-26Q1-A3',
      title: 'Will CPI inflation be above 3% in Q1 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.45,
      noPrice: 0.55,
      volume: 280000,
      liquidity: 85000,
      expirationTime: '2026-04-15T23:59:59Z',
    },
    {
      ticker: 'BTC-26JAN-100K',
      title: 'Will Bitcoin be above $100,000 by end of January 2026?',
      category: 'Crypto',
      status: 'open',
      yesPrice: 0.62,
      noPrice: 0.38,
      volume: 890000,
      liquidity: 230000,
      expirationTime: '2026-01-31T23:59:59Z',
    },
    {
      ticker: 'RECESSION-26',
      title: 'Will there be a US recession in 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.28,
      noPrice: 0.72,
      volume: 520000,
      liquidity: 145000,
      expirationTime: '2026-12-31T23:59:59Z',
    },
  ];

  const queryLower = query.toLowerCase();
  const filtered = mockMarkets.filter(m => 
    m.title.toLowerCase().includes(queryLower) ||
    m.category.toLowerCase().includes(queryLower) ||
    m.ticker.toLowerCase().includes(queryLower)
  );

  return {
    success: true,
    markets: filtered.slice(0, limit),
    query,
    count: filtered.length,
    source: 'kalshi-mock',
  };
}

function getMockPolymarketMarkets(query: string, limit: number) {
  const mockMarkets: PolymarketMarket[] = [
    {
      id: 'fed-rate-jan-2026',
      question: 'Will the Federal Reserve cut interest rates in January 2026?',
      description: 'Resolves YES if the Fed announces a rate cut at the January 2026 FOMC meeting.',
      category: 'Economics',
      endDate: '2026-01-31T23:59:59Z',
      outcomes: [{ name: 'Yes', price: 0.68 }, { name: 'No', price: 0.32 }],
      volume: 1250000,
      liquidity: 340000,
      active: true,
    },
    {
      id: 'btc-100k-jan-2026',
      question: 'Will Bitcoin reach $100,000 by January 31, 2026?',
      category: 'Crypto',
      endDate: '2026-01-31T23:59:59Z',
      outcomes: [{ name: 'Yes', price: 0.58 }, { name: 'No', price: 0.42 }],
      volume: 2800000,
      liquidity: 890000,
      active: true,
    },
    {
      id: 'inflation-3pct-q1-2026',
      question: 'Will US CPI inflation be above 3% in Q1 2026?',
      category: 'Economics',
      endDate: '2026-04-15T23:59:59Z',
      outcomes: [{ name: 'Yes', price: 0.42 }, { name: 'No', price: 0.58 }],
      volume: 560000,
      liquidity: 180000,
      active: true,
    },
    {
      id: 'recession-2026',
      question: 'Will the US enter a recession in 2026?',
      category: 'Economics',
      endDate: '2026-12-31T23:59:59Z',
      outcomes: [{ name: 'Yes', price: 0.25 }, { name: 'No', price: 0.75 }],
      volume: 1890000,
      liquidity: 450000,
      active: true,
    },
  ];

  const queryLower = query.toLowerCase();
  const filtered = mockMarkets.filter(m =>
    m.question.toLowerCase().includes(queryLower) ||
    m.category.toLowerCase().includes(queryLower) ||
    m.description?.toLowerCase().includes(queryLower)
  );

  return {
    success: true,
    markets: filtered.slice(0, limit),
    query,
    count: filtered.length,
    source: 'polymarket-mock',
  };
}

function getMockOrderbook(ticker: string) {
  return {
    success: true,
    orderbook: {
      ticker,
      bids: [
        { price: 0.71, quantity: 500 },
        { price: 0.70, quantity: 1200 },
        { price: 0.69, quantity: 800 },
      ],
      asks: [
        { price: 0.73, quantity: 450 },
        { price: 0.74, quantity: 900 },
        { price: 0.75, quantity: 1100 },
      ],
      spread: 0.02,
      midPrice: 0.72,
    },
  };
}
