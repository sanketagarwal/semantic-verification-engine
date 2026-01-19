# 🔬 Semantic Verification Engine

> **LLM-powered cross-platform prediction market verification**
> 
> Detects resolution criteria misalignments between Kalshi and Polymarket to prevent arbitrage losses from rule ambiguity.

[![npm version](https://img.shields.io/npm/v/semantic-verification-engine.svg)](https://www.npmjs.com/package/semantic-verification-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## 🎯 The Problem

Cross-platform prediction market arbitrage is risky because **markets that appear identical may resolve differently**:

| Platform | Question | Price |
|----------|----------|-------|
| Kalshi | "Will the Fed cut rates in January 2026?" | 72¢ |
| Polymarket | "Will the Federal Reserve cut interest rates in January 2026?" | 68¢ |

**Looks like a 4¢ arbitrage opportunity!** But wait...

- 📅 **Date Mismatch**: Kalshi resolves at market close on 1/31, Polymarket at 11:59 PM UTC
- 📰 **Source Difference**: Kalshi uses FOMC statement, Polymarket uses Federal Reserve website
- 📏 **Threshold Ambiguity**: What if the Fed holds rates steady at a meeting vs. between meetings?

**This engine prevents costly mistakes by using LLMs to semantically compare resolution criteria.**

---

## ✨ Features

- 🤖 **LLM-Powered Analysis** - GPT-4o compares resolution criteria semantically
- 🔍 **6 Misalignment Types** - Date, Source, Scope, Threshold, Definition, Edge Cases
- 📊 **Risk Scoring** - LOW / MEDIUM / HIGH / CRITICAL risk levels
- 💡 **Trading Recommendations** - SAFE_TO_TRADE, PROCEED_WITH_CAUTION, AVOID, MANUAL_REVIEW
- ⚡ **Fast Batch Processing** - Quick similarity scoring for filtering
- 🛠️ **CLI + Library** - Use as command-line tool or import in your code

---

## 📦 Installation

```bash
# npm
npm install semantic-verification-engine

# pnpm
pnpm add semantic-verification-engine

# yarn
yarn add semantic-verification-engine
```

### Environment Setup

Create a `.env` file:

```env
# Required: OpenAI API key for LLM semantic analysis
OPENAI_API_KEY=sk-your-openai-key-here

# Required: Replay Labs API key for all market data
REPLAY_LABS_API_KEY=your-replay-labs-api-key

# Optional: Replay Labs API base URL
REPLAY_LABS_BASE_URL=https://api.replaylabs.io

# Optional: Use specific model (default: openai/gpt-4o)
AI_MODEL=openai/gpt-4o
```

---

## 🚀 Quick Start

### CLI Usage

```bash
# Verify markets by topic
npx verify-markets --topic "Fed rates"

# Verify a specific pair
npx verify-markets pair --kalshi "FED-26JAN-T4.50" --polymarket "fed-rate-jan-2026"

# Run demo
npx verify-markets demo
```

### Library Usage

```typescript
import { runVerificationAgent, quickVerify } from 'semantic-verification-engine';

// Full verification for a topic
const result = await runVerificationAgent('Fed rates');

console.log(`Found ${result.matchedPairs.length} market pairs`);
console.log(`Safe to trade: ${result.statistics.safeToTrade}`);
console.log(`Should avoid: ${result.statistics.avoid}`);

// Iterate through matched pairs
for (const pair of result.matchedPairs) {
  console.log(`
    Kalshi: ${pair.kalshi.ticker} @ ${pair.kalshi.price}
    Polymarket: ${pair.polymarket.id} @ ${pair.polymarket.price}
    Spread: ${pair.priceSpread}¢
    Recommendation: ${pair.verification.recommendation}
    Misalignments: ${pair.verification.misalignments.length}
  `);
}
```

---

## 📖 API Reference

### `runVerificationAgent(topic: string)`

Full workflow: searches both platforms, finds matches, and verifies each pair.

```typescript
const result = await runVerificationAgent('Bitcoin');

// Returns:
{
  topic: 'Bitcoin',
  timestamp: '2026-01-19T...',
  matchedPairs: [...],
  summary: 'Found 3 potential market matches...',
  statistics: {
    marketsScanned: { kalshi: 15, polymarket: 20 },
    matchesFound: 3,
    safeToTrade: 1,
    proceedWithCaution: 1,
    avoid: 1,
    needsReview: 0
  }
}
```

### `quickVerify(kalshiTicker, polymarketId)`

Fast verification for a specific pair.

```typescript
const check = await quickVerify('BTC-26JAN-100K', 'btc-100k-jan-2026');

// Returns:
{
  verified: true,
  confidence: 0.85,
  recommendation: 'PROCEED_WITH_CAUTION',
  topMisalignment: 'Polymarket uses "reach" while Kalshi uses "above" - edge case at exact threshold'
}
```

### `getVerifiedArbitrageOpportunities(topic)`

Returns only verified safe opportunities sorted by spread.

```typescript
const { opportunities, summary } = await getVerifiedArbitrageOpportunities('inflation');

for (const opp of opportunities) {
  console.log(`${opp.kalshiTicker} vs ${opp.polymarketId}: ${opp.spread}¢ spread`);
}
```

### Tool Functions

For more granular control, use the individual tools:

```typescript
import { 
  verifyMarketPair,      // LLM verification of a single pair
  findMatchingMarkets,   // Semantic search for matches
  batchVerifyMarkets,    // Quick batch verification
  generateVerificationReport,  // Detailed report generation
  searchKalshiMarkets,   // Search Kalshi
  searchPolymarketMarkets,    // Search Polymarket
} from 'semantic-verification-engine';
```

---

## 🔍 Misalignment Types

The engine detects 6 types of resolution criteria misalignments:

| Type | Icon | Description | Example |
|------|------|-------------|---------|
| `RESOLUTION_DATE` | 📅 | Different resolution timing | "by Jan 31" vs "on Jan 31" |
| `RESOLUTION_SOURCE` | 📰 | Different data sources | BLS website vs press release |
| `SCOPE` | 🌍 | Geographic/coverage differences | US-only vs global |
| `THRESHOLD` | 📏 | Numeric threshold differences | ">3%" vs "≥3%" |
| `DEFINITION` | 📖 | Term/concept definitions | "recession" definition varies |
| `EDGE_CASE` | ⚠️ | Handling of special scenarios | Ties, delays, cancellations |

### Severity Levels

- **LOW**: Minor wording differences, unlikely to affect outcome
- **MEDIUM**: Notable differences that could matter in edge cases
- **HIGH**: Significant differences with material impact risk
- **CRITICAL**: Markets may resolve differently - avoid trading

---

## 📊 Output Examples

### CLI Output

```
╔═══════════════════════════════════════════════════════════════════════╗
║  🔬 SEMANTIC VERIFICATION ENGINE                                      ║
║  LLM-powered cross-platform market verification                       ║
╚═══════════════════════════════════════════════════════════════════════╝

🔍 TOPIC:
   "Fed rates"

✔ Verification complete in 3245ms

📊 VERIFICATION STATISTICS:
────────────────────────────────────────────────────────────────
   Markets Scanned:  5 Kalshi, 5 Polymarket
   Matches Found:    2
   Safe to Trade:    1
   Proceed Caution:  1
   Avoid:            0
   Needs Review:     0

🎯 MATCHED MARKET PAIRS:

┌────────────────────────────────────────────────────────────────────────┐
│ 1. ✅ SAFE TO TRADE                                                    │
│ Confidence: 92% | Risk: LOW | Spread: 4¢                              │
├────────────────────────────────────────────────────────────────────────┤
│ KALSHI:
│   Ticker: FED-26JAN-T4.50
│   Will the Fed cut rates in January 2026?
│   Price: 72¢
│
│ POLYMARKET:
│   ID: fed-rate-jan-2026
│   Will the Federal Reserve cut interest rates in January 2026?
│   Price: 68¢
├────────────────────────────────────────────────────────────────────────┤
│ 💰 ARBITRAGE OPPORTUNITY DETECTED!                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### JSON Response

```json
{
  "matchedPairs": [{
    "kalshi": {
      "ticker": "FED-26JAN-T4.50",
      "question": "Will the Fed cut rates in January 2026?",
      "price": 0.72
    },
    "polymarket": {
      "id": "fed-rate-jan-2026", 
      "question": "Will the Federal Reserve cut interest rates in January 2026?",
      "price": 0.68
    },
    "verification": {
      "isMatch": true,
      "matchConfidence": 0.92,
      "riskLevel": "LOW",
      "recommendation": "SAFE_TO_TRADE",
      "misalignments": []
    },
    "priceSpread": 4,
    "arbitrageOpportunity": true
  }]
}
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verification Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. MARKET DATA (via Replay Labs)                               │
│     ├─> GET /api/kalshi/markets                                 │
│     ├─> GET /api/polymarket/markets                             │
│     └─> GET /api/matched-pairs (pre-matched registry)           │
│                                                                 │
│  2. SEMANTIC MATCHING                                           │
│     └─> LLM finds candidate pairs by topic similarity           │
│                                                                 │
│  3. DEEP VERIFICATION                                           │
│     └─> LLM compares resolution criteria:                       │
│         - Question semantics                                    │
│         - Resolution timing                                     │
│         - Data sources                                          │
│         - Threshold definitions                                 │
│         - Edge case handling                                    │
│                                                                 │
│  4. RECOMMENDATION                                              │
│     └─> SAFE_TO_TRADE | CAUTION | AVOID | REVIEW                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
  Replay Labs API ──> Kalshi + Polymarket Data ──> LLM Analysis ──> Recommendations
```

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

---

## 📁 Project Structure

```
semantic-verification-engine/
├── src/
│   ├── index.ts           # Main exports
│   ├── agent.ts           # Verification agent
│   ├── cli.ts             # CLI entry point
│   ├── types.ts           # TypeScript types
│   └── tools/
│       ├── index.ts       # Tool exports
│       ├── verification.ts # Core verification tools
│       └── market-apis.ts  # Kalshi/Polymarket APIs
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | OpenAI API key for LLM semantic analysis |
| `REPLAY_LABS_API_KEY` | ✅ Yes | Replay Labs API key for all market data |
| `REPLAY_LABS_BASE_URL` | No | Replay Labs API URL (default: `https://api.replaylabs.io`) |
| `AI_MODEL` | No | LLM model to use (default: `openai/gpt-4o`) |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © Sanket Agarwal

---

## 🙏 Acknowledgments

- Built with [Vercel AI SDK](https://sdk.vercel.ai/)
- Market data via [Replay Labs](https://replaylabs.io) unified API
- Data sourced from [Kalshi](https://kalshi.com) and [Polymarket](https://polymarket.com)

---

<p align="center">
  <b>Made with ❤️ for the prediction market arbitrage community</b>
</p>
