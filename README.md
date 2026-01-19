# Semantic Verification Engine

> **LLM-powered semantic verification for prediction market arbitrage**

This engine compares resolution criteria between Kalshi and Polymarket markets to detect technical misalignments that could cause bad trades due to rule ambiguity.

## 🎯 The Problem

When trading across prediction market platforms, seemingly identical markets can have **subtle differences** in their resolution criteria that cause them to resolve differently:

- **Different expiration times**: One market closes at midnight UTC, another at midnight EST
- **Different data sources**: One uses BLS data, another uses Fed reports
- **Scope differences**: "US recession" vs "North American recession"
- **Threshold ambiguity**: "Above 3%" vs "at or above 3%"

## ✨ The Solution

Our fine-tuned LLM models:
1. **Semantically match** markets across platforms
2. **Compare resolution criteria** to detect misalignments
3. **Classify risk levels** (LOW → CRITICAL)
4. **Generate recommendations** (SAFE_TO_TRADE, PROCEED_WITH_CAUTION, AVOID, MANUAL_REVIEW)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Sources                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Kalshi API  │  │ Polymarket   │  │    Replay Labs       │   │
│  │  (Discovery) │  │ Gamma API    │  │    WebSocket         │   │
│  │              │  │ (Discovery)  │  │    (Real-time data)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Semantic Verification Engine                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Market Discovery    → Find markets on both platforms        │
│  2. Semantic Matching   → Match equivalent markets              │
│  3. Criteria Extraction → Parse resolution rules                │
│  4. LLM Verification    → Compare criteria, detect misalignment │
│  5. Risk Assessment     → Classify and recommend                │
└─────────────────────────────────────────────────────────────────┘
```

## 🔌 Data Sources

### Replay Labs API (Primary)
Real-time market data streaming via WebSocket:
- **Kalshi**: Orderbook snapshots, deltas, ticker, trades
- **Polymarket**: Price book, trades, last trade price, ticker
- **Coinbase**: OHLCV, indicators, orderbook (crypto reference data)

### Venue APIs (Discovery)
- **Kalshi API**: Market search and metadata
- **Polymarket Gamma API**: Market search and metadata

## 📦 Installation

```bash
npm install semantic-verification-engine
```

## ⚙️ Configuration

```bash
# .env file
OPENAI_API_KEY=sk-...           # Required for LLM verification
REPLAY_LABS_API_KEY=rl-...      # Required for real-time data
KALSHI_API_KEY=...              # Optional, enhances discovery
KALSHI_USE_DEMO=false           # Set true for demo environment
```

## 🚀 Quick Start

### As a Library

```typescript
import { 
  runVerificationAgent, 
  quickVerify,
  getVerifiedArbitrageOpportunities 
} from 'semantic-verification-engine';

// Full verification workflow for a topic
const result = await runVerificationAgent('Fed interest rates');

console.log(result.summary);
console.log(`Found ${result.matchedPairs.length} verified pairs`);

// Quick verification of a known pair
const verification = await quickVerify(
  'FED-26JAN-T4.50',  // Kalshi ticker
  'fed-rate-jan-2026' // Polymarket ID
);

console.log(`Verified: ${verification.verified}`);
console.log(`Recommendation: ${verification.recommendation}`);

// Get all safe arbitrage opportunities
const opportunities = await getVerifiedArbitrageOpportunities('Fed rates');

opportunities.forEach(opp => {
  console.log(`
    Kalshi ${opp.kalshiTicker}: ${opp.kalshiPrice}
    Polymarket ${opp.polymarketId}: ${opp.polymarketPrice}
    Spread: ${(opp.spread * 100).toFixed(1)}%
    Safe: ${opp.verified}
  `);
});
```

### Using Individual Tools

```typescript
import { 
  searchKalshiMarkets,
  searchPolymarketMarkets,
  verifyMarketPair,
  buildWebSocketPayload,
} from 'semantic-verification-engine';

// Search markets
const kalshiMarkets = await searchKalshiMarkets.execute({ 
  query: 'recession',
  limit: 10 
});

const polyMarkets = await searchPolymarketMarkets.execute({ 
  query: 'recession',
  limit: 10 
});

// Verify a pair
const result = await verifyMarketPair.execute({
  kalshiMarket: {
    platform: 'kalshi',
    marketId: 'RECESSION-26',
    question: 'Will there be a US recession in 2026?',
    resolutionSource: 'NBER',
    resolutionDate: '2026-12-31',
  },
  polymarketMarket: {
    platform: 'polymarket',
    marketId: 'recession-2026',
    question: 'Will the US enter a recession in 2026?',
    resolutionSource: 'NBER official dating',
    resolutionDate: '2026-12-31',
  }
});

console.log(`Match: ${result.isMatch}`);
console.log(`Confidence: ${(result.matchConfidence * 100).toFixed(0)}%`);
console.log(`Risk: ${result.riskLevel}`);
console.log(`Recommendation: ${result.recommendation}`);

// Get WebSocket config for real-time data
const wsConfig = await buildWebSocketPayload.execute({
  venue: 'KALSHI',
  channels: ['orderbook_delta'],
  markets: ['RECESSION-26'],
});

console.log(`Connect to: ${wsConfig.wsUrl}`);
console.log(`Subscribe with:`, wsConfig.subscribePayloads);
```

### CLI Usage

```bash
# Verify markets for a topic
npx svc verify "Fed rates"

# Quick verification of a specific pair
npx svc verify --kalshi FED-26JAN-T4.50 --polymarket fed-rate-jan-2026

# Get arbitrage opportunities
npx svc arbitrage "recession"

# List WebSocket venues
npx svc venues
```

## 📊 Misalignment Types

| Type | Description | Example |
|------|-------------|---------|
| `RESOLUTION_DATE` | Different expiration/resolution times | Jan 31 vs Feb 1 |
| `RESOLUTION_SOURCE` | Different data sources for resolution | BLS vs Fed data |
| `SCOPE` | Geographic or demographic differences | US vs North America |
| `THRESHOLD` | Numeric threshold differences | "above 3%" vs "≥3%" |
| `DEFINITION` | Core concept defined differently | "recession" definitions |
| `EDGE_CASE` | Edge cases handled differently | Holiday adjustments |

## 🚦 Risk Levels & Recommendations

| Risk Level | Recommendation | Action |
|------------|----------------|--------|
| `LOW` | `SAFE_TO_TRADE` | Execute arbitrage with confidence |
| `MEDIUM` | `PROCEED_WITH_CAUTION` | Trade with smaller position sizes |
| `HIGH` | `AVOID` | Do not trade this pair |
| `CRITICAL` | `MANUAL_REVIEW` | Requires human verification |

## 🔧 Available Tools

### Market Discovery
- `searchKalshiMarkets` - Search Kalshi markets by keyword
- `searchPolymarketMarkets` - Search Polymarket markets by keyword

### Real-Time Data (via Replay Labs)
- `listWebSocketVenues` - List available WebSocket venues
- `buildWebSocketPayload` - Build WS connection config for venue
- `getKalshiOrderbook` - Get Kalshi orderbook WS config
- `getPolymarketOrderbook` - Get Polymarket orderbook WS config
- `getOHLCV` - Get OHLCV candles (Coinbase)
- `getIndicators` - Get computed indicators (RSI, MACD, etc.)
- `listReplays` - List available market data time ranges

### Verification
- `verifyMarketPair` - LLM-powered verification of market pair
- `findMatchingMarkets` - Find semantically matching markets
- `generateVerificationReport` - Generate detailed verification report
- `batchVerifyMarkets` - Batch verification of multiple pairs
- `getVerifiedPairs` - Get pre-verified market pairs

## 📋 Example Output

```typescript
const result = await runVerificationAgent('Bitcoin price');

// result.matchedPairs[0]:
{
  kalshi: {
    ticker: 'BTC-26JAN-100K',
    question: 'Will Bitcoin be above $100,000 by end of January 2026?',
    price: 0.62
  },
  polymarket: {
    id: 'btc-100k-jan-2026',
    question: 'Will Bitcoin reach $100,000 by January 31, 2026?',
    price: 0.58
  },
  verification: {
    isMatch: true,
    matchConfidence: 0.92,
    riskLevel: 'MEDIUM',
    recommendation: 'PROCEED_WITH_CAUTION',
    misalignments: [
      {
        type: 'THRESHOLD',
        severity: 'MEDIUM',
        description: '"above $100,000" vs "reach $100,000" - unclear if exactly $100k qualifies'
      }
    ]
  },
  priceSpread: 0.04,
  arbitrageOpportunity: true
}
```

## 🔗 WebSocket Data Streaming

Real-time data is available via Replay Labs WebSocket:

```typescript
import { buildWebSocketPayload } from 'semantic-verification-engine';

// Get WebSocket config
const config = await buildWebSocketPayload.execute({
  venue: 'KALSHI',
  channels: ['orderbook_delta', 'ticker'],
  markets: ['FED-26JAN-T4.50'],
});

// Connect to WebSocket
const ws = new WebSocket(config.wsUrl);

ws.onopen = () => {
  // Send subscribe payloads
  config.subscribePayloads.forEach(payload => {
    ws.send(JSON.stringify(payload));
  });
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle orderbook/ticker updates
  console.log('Market update:', data);
};
```

### Available Channels

| Venue | Channels |
|-------|----------|
| KALSHI | `orderbook_delta`, `ticker`, `trade` |
| POLYMARKET | `price_book`, `trade`, `last_trade_price`, `ticker` |

## 🧪 Development

```bash
# Clone and install
git clone https://github.com/yourusername/semantic-verification-engine.git
cd semantic-verification-engine
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

---

Built for safe prediction market arbitrage 🎯
