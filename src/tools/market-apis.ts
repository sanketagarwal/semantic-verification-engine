/**
 * Market API Tools via Replay Labs
 * 
 * Uses Replay Labs WebSocket infrastructure for Kalshi/Polymarket data.
 * Market discovery uses direct venue APIs, data streaming via Replay Labs WS.
 * 
 * API Spec: Based on Replay Labs OpenAPI 3.0.3
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { KalshiMarket, PolymarketMarket } from '../types';

// ═══════════════════════════════════════════════════════════════
// REPLAY LABS API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const REPLAY_LABS_API_KEY = process.env.REPLAY_LABS_API_KEY;
const REPLAY_LABS_BASE_URL = process.env.REPLAY_LABS_BASE_URL || 'https://replay-lab-delta.preview.recall.network';

// Venue WebSocket endpoints (from /api/ws/venues)
type Venue = 'KALSHI' | 'POLYMARKET' | 'COINBASE_EXCHANGE' | 'HYPERLIQUID_PERP';
type Environment = 'mainnet' | 'testnet' | 'demo';

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
// REPLAY LABS WEBSOCKET TOOLS
// ═══════════════════════════════════════════════════════════════

/**
 * List available WebSocket venues
 * GET /api/ws/venues
 */
export const listWebSocketVenues = tool({
  description: 'List available WebSocket venues from Replay Labs (KALSHI, POLYMARKET, COINBASE_EXCHANGE, HYPERLIQUID_PERP)',
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

/**
 * Build WebSocket subscribe payloads for a venue
 * POST /api/ws/connect
 */
export const buildWebSocketPayload = tool({
  description: 'Build WebSocket connection details and subscribe payloads for Kalshi or Polymarket',
  parameters: z.object({
    venue: z.enum(['KALSHI', 'POLYMARKET', 'COINBASE_EXCHANGE', 'HYPERLIQUID_PERP']),
    channels: z.array(z.string()).optional().describe('Channels to subscribe to'),
    markets: z.array(z.string()).optional().describe('Market tickers to subscribe to'),
    environment: z.enum(['mainnet', 'testnet', 'demo']).optional(),
  }),
  execute: async ({ venue, channels, markets, environment }) => {
    try {
      const data = await replayLabsFetch('/api/ws/connect', {
        method: 'POST',
        body: JSON.stringify({
          venue,
          channels,
          environment,
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
// KALSHI MARKET DISCOVERY (Direct API + Replay Labs WS for data)
// ═══════════════════════════════════════════════════════════════

const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_BASE_URL = process.env.KALSHI_USE_DEMO === 'true' 
  ? 'https://demo-api.kalshi.co/trade-api/v2'
  : 'https://trading-api.kalshi.com/trade-api/v2';

/**
 * Search Kalshi markets
 * Uses Kalshi API for discovery, Replay Labs WS for real-time data
 */
export const searchKalshiMarkets = tool({
  description: `Search Kalshi prediction markets by keyword.
    Returns markets with prices, volume, and liquidity.
    Real-time data available via Replay Labs WebSocket.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "inflation")'),
    status: z.enum(['open', 'closed', 'settled', 'all']).default('open'),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async ({ query, status, limit }) => {
    // Try Kalshi API if key available
    if (KALSHI_API_KEY) {
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

        if (response.ok) {
          const data = await response.json();
          const queryLower = query.toLowerCase();
          const filtered = (data.markets || [])
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
            source: 'kalshi-api',
            note: 'Use Replay Labs WebSocket for real-time orderbook data',
          };
        }
      } catch (e) {
        // Fall through to mock
      }
    }

    // Fallback to mock data
    return getMockKalshiMarkets(query, limit);
  },
});

/**
 * Get Kalshi orderbook via Replay Labs WebSocket config
 */
export const getKalshiOrderbook = tool({
  description: 'Get WebSocket configuration for Kalshi orderbook streaming via Replay Labs',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
  }),
  execute: async ({ ticker }) => {
    try {
      // Build WS payload for orderbook channel
      const wsConfig = await replayLabsFetch('/api/ws/connect', {
        method: 'POST',
        body: JSON.stringify({
          venue: 'KALSHI',
          channels: ['orderbook_delta'],
          channelsConfig: { markets: [ticker] },
        }),
      });

      return {
        success: true,
        ticker,
        websocket: {
          url: wsConfig.wsUrl,
          authMode: wsConfig.authMode,
          subscribePayload: wsConfig.subscribePayloads?.[0],
          messageSchema: 'KalshiOrderbookSnapshotMessage | KalshiOrderbookDeltaMessage',
        },
        source: 'replay-labs/kalshi',
        note: 'Connect to WebSocket and subscribe for real-time orderbook updates',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// POLYMARKET MARKET DISCOVERY
// ═══════════════════════════════════════════════════════════════

const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com';

/**
 * Search Polymarket markets
 * Uses Polymarket Gamma API for discovery, Replay Labs WS for real-time data
 */
export const searchPolymarketMarkets = tool({
  description: `Search Polymarket prediction markets by keyword.
    Returns markets with prices, volume, and liquidity.
    Real-time data available via Replay Labs WebSocket.`,
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

      if (response.ok) {
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
          source: 'polymarket-gamma',
          note: 'Use Replay Labs WebSocket for real-time orderbook data',
        };
      }
    } catch (e) {
      // Fall through to mock
    }

    return getMockPolymarketMarkets(query, limit);
  },
});

/**
 * Get Polymarket orderbook via Replay Labs WebSocket config
 */
export const getPolymarketOrderbook = tool({
  description: 'Get WebSocket configuration for Polymarket orderbook streaming via Replay Labs',
  parameters: z.object({
    tokenId: z.string().describe('Polymarket token ID'),
  }),
  execute: async ({ tokenId }) => {
    try {
      const wsConfig = await replayLabsFetch('/api/ws/connect', {
        method: 'POST',
        body: JSON.stringify({
          venue: 'POLYMARKET',
          channels: ['price_book'],
          assets: [tokenId],
        }),
      });

      return {
        success: true,
        tokenId,
        websocket: {
          url: wsConfig.wsUrl,
          authMode: wsConfig.authMode,
          subscribePayload: wsConfig.subscribePayloads?.[0],
          messageSchema: 'PolymarketPriceBookMessage',
        },
        source: 'replay-labs/polymarket',
        note: 'Connect to WebSocket and subscribe for real-time price book updates',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// REPLAY LABS REST ENDPOINTS (Crypto/Coinbase data)
// ═══════════════════════════════════════════════════════════════

/**
 * Get OHLCV candles from Replay Labs
 * GET /api/ohlcv/{symbolId}
 */
export const getOHLCV = tool({
  description: 'Get OHLCV candles for Coinbase trading pairs via Replay Labs',
  parameters: z.object({
    symbolId: z.string().describe('Coinbase symbol (e.g., COINBASE_SPOT_BTC_USD)'),
    timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']).default('1h'),
    limit: z.number().min(1).max(1000).default(100),
    from: z.string().optional().describe('Start time (ISO 8601)'),
    to: z.string().optional().describe('End time (ISO 8601)'),
  }),
  execute: async ({ symbolId, timeframe, limit, from, to }) => {
    try {
      const params = new URLSearchParams({
        timeframe,
        limit: limit.toString(),
        ...(from && { from }),
        ...(to && { to }),
      });

      const data = await replayLabsFetch(`/api/ohlcv/${symbolId}?${params}`);
      return {
        success: true,
        symbol_id: data.symbol_id,
        timeframe: data.timeframe,
        candles: data.candles,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

/**
 * Get computed indicators from Replay Labs
 * GET /api/indicators/{symbolId}
 */
export const getIndicators = tool({
  description: 'Get OHLCV with computed indicators (RSI, MACD, BBW, etc.) via Replay Labs',
  parameters: z.object({
    symbolId: z.string().describe('Coinbase symbol (e.g., COINBASE_SPOT_BTC_USD)'),
    timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']).default('1h'),
    limit: z.number().min(1).max(1000).default(20),
    indicators: z.string().optional().describe('Comma-separated indicators (rsi,macd,bbw,atr,etc.)'),
  }),
  execute: async ({ symbolId, timeframe, limit, indicators }) => {
    try {
      const params = new URLSearchParams({
        timeframe,
        limit: limit.toString(),
        ...(indicators && { indicators }),
      });

      const data = await replayLabsFetch(`/api/indicators/${symbolId}?${params}`);
      return {
        success: true,
        ...data,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

/**
 * List available replay data
 * GET /api/replays
 */
export const listReplays = tool({
  description: 'List available market data time ranges from Replay Labs',
  parameters: z.object({}),
  execute: async () => {
    try {
      const data = await replayLabsFetch('/api/replays');
      return {
        success: true,
        symbols: data.symbols,
        capabilities: data.capabilities,
        source: 'replay-labs',
      };
    } catch (error) {
      return { success: false, error: String(error) };
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
    price: m.outcomePrices?.[i] ? parseFloat(m.outcomePrices[i]) : 0.5,
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

// ═══════════════════════════════════════════════════════════════
// MOCK DATA (for development/demo when APIs unavailable)
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
    source: 'mock',
    note: 'Using mock data - set KALSHI_API_KEY for live data',
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
    source: 'mock',
    note: 'Using mock data - Polymarket Gamma API may be rate limited',
  };
}
