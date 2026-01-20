# Semantic Verification Engine

> **Stop bad arbitrage trades before they happen.**

A tool that compares prediction markets across Kalshi and Polymarket to find:
1. Which markets are actually the same question
2. Hidden differences in their rules that could make you lose money

## 🎯 What It Does (Simply)

**Problem:** You see "Will Bitcoin hit $100k?" on both Kalshi and Polymarket with different prices. Free money, right?

**Not always.** The markets might have:
- Different end dates (one ends Jan 31, other ends Feb 1)
- Different rules ("above $100k" vs "at or above $100k")
- Different data sources (Coinbase price vs CoinGecko)

**This tool catches those differences before you trade.**

## 🔧 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    REPLAY LABS API                          │
│         https://replay-lab-delta.preview.recall.network     │
│                                                             │
│   /api/markets/search      → Find markets by keyword        │
│   /api/markets/semantic-search → AI-powered market search   │
│   /api/markets/overlap     → Find matching pairs!           │
│   /api/markets/{venue}/{id} → Get prices                    │
└────────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              SEMANTIC VERIFICATION ENGINE                   │
│              (Vercel AI Gateway + GPT-4o)                   │
│                                                             │
│   1. Find matching markets across Kalshi & Polymarket       │
│   2. Compare their resolution rules with LLM                │
│   3. Detect misalignments (dates, thresholds, sources)      │
│   4. Give trading recommendation                            │
└─────────────────────────────────────────────────────────────┘
```

## ⚡ Quick Start

```bash
# Install
npm install semantic-verification-engine

# Set up environment
export REPLAY_LABS_API_KEY="rn_your_key_here"
export AI_GATEWAY_API_KEY="your_vercel_ai_key"  # or OPENAI_API_KEY

# Run
npx verify-markets verify "Bitcoin $100k"
```

## 📦 Usage

### Find Matching Markets

```typescript
import { findOverlapMarkets } from 'semantic-verification-engine';

// Given a Polymarket market, find similar Kalshi markets
const result = await findOverlapMarkets.execute({
  venue: 'POLYMARKET',
  venuePk: '0xabc123...',  // Your Polymarket condition ID
  limit: 5,
});

// Returns matching Kalshi markets with similarity scores
result.overlaps.forEach(match => {
  console.log(`${match.market.question} - ${match.similarityScore * 100}% similar`);
});
```

### Verify a Market Pair

```typescript
import { verifyMarketPair } from 'semantic-verification-engine';

const result = await verifyMarketPair.execute({
  kalshiMarket: {
    marketId: 'BTC-100K-JAN26',
    question: 'Will Bitcoin be above $100,000 on January 31, 2026?',
    resolutionDate: '2026-01-31',
  },
  polymarketMarket: {
    marketId: '0xabc123',
    question: 'Will Bitcoin reach $100,000 by January 31, 2026?',
    resolutionDate: '2026-01-31',
  },
});

console.log(result.verification);
// {
//   isMatch: true,
//   matchConfidence: 0.85,
//   riskLevel: 'MEDIUM',
//   recommendation: 'PROCEED_WITH_CAUTION',
//   misalignments: [
//     {
//       type: 'THRESHOLD',
//       severity: 'MEDIUM',
//       description: '"above $100k" vs "reach $100k" - unclear if exactly $100k qualifies'
//     }
//   ]
// }
```

### Semantic Search

```typescript
import { semanticSearchMarkets } from 'semantic-verification-engine';

// Natural language search
const result = await semanticSearchMarkets.execute({
  query: 'Will there be a recession in the US next year?',
  limit: 10,
});

// Returns markets ranked by semantic similarity
```

## 🚦 What It Tells You

| Recommendation | What It Means |
|----------------|---------------|
| `SAFE_TO_TRADE` | Markets are equivalent, go for it |
| `PROCEED_WITH_CAUTION` | Minor differences, use smaller size |
| `AVOID` | Significant differences, don't trade |
| `MANUAL_REVIEW` | Too ambiguous, check manually |

| Misalignment Type | Example |
|-------------------|---------|
| `RESOLUTION_DATE` | Jan 31 vs Feb 1 |
| `RESOLUTION_SOURCE` | BLS data vs Fed report |
| `THRESHOLD` | "above 3%" vs "at or above 3%" |
| `SCOPE` | "US recession" vs "global recession" |
| `DEFINITION` | Different definition of "recession" |
| `EDGE_CASE` | What happens on holidays? |

## 🔑 Environment Variables

```bash
# Required
REPLAY_LABS_API_KEY=rn_xxx    # Replay Labs API key

# One of these for LLM (Vercel AI Gateway preferred)
AI_GATEWAY_API_KEY=xxx        # Vercel AI Gateway key
OPENAI_API_KEY=sk-xxx         # Direct OpenAI (fallback)

# Optional
AI_MODEL=gpt-4o               # Model to use (default: gpt-4o)
```

## 📚 All Available Tools

### Market Discovery (via Replay Labs)
- `searchMarkets` - Text search across all venues
- `searchKalshiMarkets` - Search Kalshi only
- `searchPolymarketMarkets` - Search Polymarket only
- `semanticSearchMarkets` - AI-powered semantic search
- `findOverlapMarkets` - Find cross-venue matches ⭐
- `findSimilarMarkets` - Find similar markets
- `getMarket` - Get single market with prices
- `getKalshiMarket` - Get Kalshi market details
- `getPolymarketMarket` - Get Polymarket details

### Verification (via Vercel AI Gateway)
- `verifyMarketPair` - Full LLM verification ⭐
- `findMatchingMarkets` - Match markets from lists
- `generateVerificationReport` - Detailed report
- `batchVerifyMarkets` - Quick batch check

### WebSocket (Real-time data)
- `listWebSocketVenues` - Available WS venues
- `buildWebSocketPayload` - Build WS connection

## 🔗 API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/markets/search` | Text search markets |
| `GET /api/markets/semantic-search` | Vector semantic search |
| `GET /api/markets/overlap` | Cross-venue matching |
| `GET /api/markets/similar` | Similar market discovery |
| `GET /api/markets/{venue}/{id}` | Single market + prices |
| `GET /api/ws/venues` | WebSocket venue list |
| `POST /api/ws/connect` | WebSocket config |

All endpoints at: `https://replay-lab-delta.preview.recall.network`

## 📄 License

MIT

---

Built to make prediction market arbitrage safer 🎯
