# Semantic Verification Engine

> **Prevent bad arbitrage trades by detecting hidden differences in prediction market rules**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Full Demo](#full-demo)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Examples](#examples)
- [Architecture](#architecture)

---

## The Problem

You see "Will Bitcoin reach $100k?" on both Kalshi and Polymarket with different prices:
- **Kalshi:** 62¢ YES
- **Polymarket:** 58¢ YES

"Free money!" you think. Buy YES on Polymarket at 58¢, sell YES on Kalshi at 62¢. 4% profit!

**But wait.** Look closer:

| Platform | Question | End Date | Threshold |
|----------|----------|----------|-----------|
| Kalshi | "Will Bitcoin be **above** $100k by **Feb 1**?" | Feb 1, 2026 | > $100,000 |
| Polymarket | "Will Bitcoin **reach** $100k by **Dec 31**?" | Dec 31, 2026 | ≥ $100,000 |

**These are NOT the same market!**

- Different end dates (10 months apart)
- Different thresholds ("above" vs "reach")
- One could resolve YES, the other NO

**This tool catches these differences before you trade.**

---

## The Solution

This engine does two things:

### 1. 🔗 MATCHING
Find similar markets across Kalshi and Polymarket using AI-powered semantic search.

### 2. ✅ VERIFICATION  
Use GPT-4o to compare resolution criteria and detect misalignments.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   INPUT: "I want to arbitrage Bitcoin $100k markets"            │
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │   SEARCH    │ -> │    MATCH    │ -> │   VERIFY    │        │
│   │             │    │             │    │             │        │
│   │ Find markets│    │ 83% similar │    │ GPT-4o says │        │
│   │ on both     │    │ Kalshi mkt  │    │ "AVOID -    │        │
│   │ platforms   │    │ found!      │    │ diff dates" │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│   OUTPUT: "AVOID - Resolution dates differ by 10 months"        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      REPLAY LABS API                            │
│            https://replay-lab-delta.preview.recall.network      │
│                                                                 │
│   ┌──────────────────┐  ┌──────────────────┐                   │
│   │  /api/markets/   │  │  /api/markets/   │                   │
│   │  search          │  │  semantic-search │                   │
│   │                  │  │                  │                   │
│   │  Text keyword    │  │  AI vector       │                   │
│   │  search          │  │  similarity      │                   │
│   └────────┬─────────┘  └────────┬─────────┘                   │
│            │                     │                              │
│            └──────────┬──────────┘                              │
│                       ▼                                         │
│            ┌──────────────────┐                                 │
│            │  /api/markets/   │                                 │
│            │  overlap         │                                 │
│            │                  │                                 │
│            │  Cross-venue     │                                 │
│            │  matching        │                                 │
│            └────────┬─────────┘                                 │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL AI GATEWAY                            │
│              https://ai-gateway.vercel.sh/v1                    │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                      GPT-4o                          │     │
│   │                                                      │     │
│   │   Compare resolution criteria:                       │     │
│   │   - Resolution dates match?                          │     │
│   │   - Thresholds identical?                            │     │
│   │   - Data sources same?                               │     │
│   │   - Edge cases handled equally?                      │     │
│   │                                                      │     │
│   │   Output: SAFE_TO_TRADE | PROCEED_WITH_CAUTION |     │     │
│   │           AVOID | MANUAL_REVIEW                      │     │
│   └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Misalignment Types Detected

| Type | Description | Example | Severity |
|------|-------------|---------|----------|
| `RESOLUTION_DATE` | Different end times | Jan 31 vs Feb 1 | HIGH |
| `RESOLUTION_SOURCE` | Different data sources | BLS vs Fed data | HIGH |
| `THRESHOLD` | Different numeric cutoffs | "above 3%" vs "≥3%" | MEDIUM |
| `SCOPE` | Different geographic/demographic | US vs Global | HIGH |
| `DEFINITION` | Core concept differs | Different "recession" definitions | CRITICAL |
| `EDGE_CASE` | Edge cases handled differently | What if on a holiday? | MEDIUM |

### Recommendations

| Risk Level | Recommendation | What To Do |
|------------|----------------|------------|
| LOW | `SAFE_TO_TRADE` | Go ahead! Markets are equivalent |
| MEDIUM | `PROCEED_WITH_CAUTION` | Trade with smaller size |
| HIGH | `AVOID` | Don't trade this pair |
| CRITICAL | `MANUAL_REVIEW` | Needs human verification |

---

## Installation

```bash
npm install semantic-verification-engine
```

Or clone the repo:

```bash
git clone https://github.com/sanketagarwal/semantic-verification-engine.git
cd semantic-verification-engine
npm install
```

---

## Quick Start

### 1. Set Environment Variables

```bash
# Required
export REPLAY_LABS_API_KEY="rn_your_key_here"
export AI_GATEWAY_API_KEY="vck_your_key_here"

# Or create .env file
cat > .env << EOF
REPLAY_LABS_API_KEY=rn_your_key_here
AI_GATEWAY_API_KEY=vck_your_key_here
EOF
```

### 2. Search for Markets

```typescript
import { searchMarkets } from 'semantic-verification-engine';

const results = await searchMarkets.execute({ 
  query: "Bitcoin 100k" 
});

console.log(results.markets);
// [
//   { venue: "KALSHI", question: "Will Bitcoin be above $100k...", id: "KXBTC..." },
//   { venue: "POLYMARKET", question: "Will Bitcoin reach $100k...", id: "0x..." }
// ]
```

### 3. Find Matching Markets

```typescript
import { findOverlapMarkets } from 'semantic-verification-engine';

// Given a Polymarket market, find similar Kalshi markets
const overlaps = await findOverlapMarkets.execute({
  venue: "POLYMARKET",
  venuePk: "0xdaa4866bae18be58c5a79d2aeeffd035ec78f1bb49dbd88f72993997778a990f",
  limit: 5
});

console.log(overlaps.overlaps);
// [
//   { market: { venue: "KALSHI", question: "...", id: "KXBTC..." }, similarityScore: 0.83 },
//   { market: { venue: "KALSHI", question: "...", id: "KXBTC..." }, similarityScore: 0.82 }
// ]
```

### 4. Verify a Market Pair

```typescript
import { verifyMarketPair } from 'semantic-verification-engine';

const verification = await verifyMarketPair.execute({
  kalshiMarket: {
    marketId: "KXBTCMAX100-26-JAN",
    question: "Will Bitcoin be above $100000 by February 1, 2026?",
    resolutionDate: "2026-02-01"
  },
  polymarketMarket: {
    marketId: "0xdaa4866...",
    question: "Will Bitcoin reach $100,000 by December 31, 2026?",
    resolutionDate: "2026-12-31"
  }
});

console.log(verification.verification);
// {
//   isMatch: false,
//   matchConfidence: 0.60,
//   riskLevel: "HIGH",
//   recommendation: "AVOID",
//   misalignments: [
//     { type: "RESOLUTION_DATE", severity: "HIGH", description: "..." }
//   ]
// }
```

---

## Full Demo

Here's a complete example that runs through the entire flow:

```typescript
import 'dotenv/config';
import { 
  semanticSearchMarkets, 
  findOverlapMarkets 
} from 'semantic-verification-engine/tools/market-apis';
import { verifyMarketPair } from 'semantic-verification-engine/tools/verification';

async function findArbitrageOpportunities(topic: string) {
  console.log(`🔍 Searching for "${topic}" markets...\n`);
  
  // Step 1: Semantic search
  const search = await semanticSearchMarkets.execute({
    query: topic,
    limit: 10
  });
  
  if (!search.success) {
    throw new Error(`Search failed: ${search.error}`);
  }
  
  console.log(`Found ${search.total} markets\n`);
  
  // Step 2: Find Polymarket markets and their Kalshi overlaps
  const polyMarkets = search.markets.filter(m => m.venue === 'POLYMARKET');
  
  for (const polyMarket of polyMarkets.slice(0, 3)) {
    console.log(`\n📊 Polymarket: "${polyMarket.question}"`);
    
    const overlaps = await findOverlapMarkets.execute({
      venue: 'POLYMARKET',
      venuePk: polyMarket.id,
      limit: 3
    });
    
    if (!overlaps.success || !overlaps.overlaps?.length) {
      console.log('   No Kalshi matches found');
      continue;
    }
    
    // Step 3: Verify each potential match
    for (const overlap of overlaps.overlaps) {
      console.log(`\n   🔗 Kalshi: "${overlap.market.question}"`);
      console.log(`      Match Score: ${(overlap.similarityScore * 100).toFixed(0)}%`);
      
      const verification = await verifyMarketPair.execute({
        kalshiMarket: {
          marketId: overlap.market.id,
          question: overlap.market.question || ''
        },
        polymarketMarket: {
          marketId: polyMarket.id,
          question: polyMarket.question || ''
        }
      });
      
      if (verification.success) {
        const v = verification.verification;
        console.log(`      ✓ Risk: ${v.riskLevel}`);
        console.log(`      ✓ Recommendation: ${v.recommendation}`);
        
        if (v.misalignments?.length > 0) {
          console.log(`      ⚠️ Issues:`);
          v.misalignments.forEach(m => {
            console.log(`         - [${m.severity}] ${m.type}: ${m.description}`);
          });
        }
      }
    }
  }
}

// Run it!
findArbitrageOpportunities("Will Bitcoin reach $100,000");
```

### Demo Output

```
╔════════════════════════════════════════════════════════════╗
║          FULL ARBITRAGE VERIFICATION DEMO                  ║
╚════════════════════════════════════════════════════════════╝

STEP 1: Semantic Search for "Bitcoin $100,000"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 4 markets:

POLYMARKET:
  1. Will Bitcoin reach $100,000 by December 31, 2026?
     Similarity: 65%

  2. Will Bitcoin hit $80k or $100k first?
     Similarity: 65%

STEP 2: Find Kalshi Overlaps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: "Will Bitcoin reach $100,000 by December 31, 2026?"

Found 5 potential Kalshi matches:
  1. "Will Bitcoin be above $100000 by February 1, 2026?"
     Match Score: 83%

  2. "Will Bitcoin be above $100000 by April 1st, 2026?"
     Match Score: 82%

STEP 3: LLM Verification
━━━━━━━━━━━━━━━━━━━━━━━━━

Comparing:
  📊 Polymarket: "Will Bitcoin reach $100,000 by December 31, 2026?"
  📊 Kalshi:     "Will Bitcoin be above $100000 by February 1, 2026?"

┌────────────────────────────────────────────────────────┐
│                  VERIFICATION RESULT                   │
├────────────────────────────────────────────────────────┤
│  Is Match:       NO ❌                                 │
│  Confidence:     60%                                   │
│  Risk Level:     HIGH                                  │
│  Recommendation: AVOID                                 │
└────────────────────────────────────────────────────────┘

⚠️  MISALIGNMENTS DETECTED:

  1. [HIGH] RESOLUTION_DATE
     Kalshi resolves on February 1, 2026, while Polymarket 
     resolves on December 31, 2026.

  2. [MEDIUM] THRESHOLD
     Kalshi specifies 'above $100000', while Polymarket 
     uses 'reach $100,000'.
```

---

## API Reference

### Market Discovery Tools

#### `searchMarkets`
Search markets across all venues by keyword.

```typescript
await searchMarkets.execute({
  query: string,       // Search query
  venue?: 'KALSHI' | 'POLYMARKET',  // Optional venue filter
  active?: boolean,    // Only active markets (default: true)
  limit?: number       // Max results (default: 20)
})
```

#### `searchKalshiMarkets`
Search only Kalshi markets.

```typescript
await searchKalshiMarkets.execute({
  query: string,
  active?: boolean,
  limit?: number
})
```

#### `searchPolymarketMarkets`
Search only Polymarket markets.

```typescript
await searchPolymarketMarkets.execute({
  query: string,
  active?: boolean,
  limit?: number
})
```

#### `semanticSearchMarkets`
AI-powered semantic search using vector similarity.

```typescript
await semanticSearchMarkets.execute({
  query: string,       // Natural language query
  venue?: 'KALSHI' | 'POLYMARKET',
  active?: boolean,
  limit?: number,
  minScore?: number    // Minimum similarity (0-1)
})
```

### Market Matching Tools

#### `findOverlapMarkets` ⭐
Find cross-venue market matches. **This is the key tool for arbitrage!**

```typescript
await findOverlapMarkets.execute({
  venue: 'KALSHI' | 'POLYMARKET',  // Source venue
  venuePk: string,                  // Market ID
  targetVenue?: 'KALSHI' | 'POLYMARKET',  // Target (default: opposite)
  limit?: number,
  minScore?: number
})
```

#### `findSimilarMarkets`
Find similar markets within or across venues.

```typescript
await findSimilarMarkets.execute({
  venue: 'KALSHI' | 'POLYMARKET',
  venuePk: string,
  active?: boolean,
  limit?: number,
  minScore?: number
})
```

### Verification Tools

#### `verifyMarketPair` ⭐
LLM-powered verification of market equivalence. **This catches the dangerous misalignments!**

```typescript
await verifyMarketPair.execute({
  kalshiMarket: {
    marketId: string,
    question: string,
    description?: string,
    resolutionSource?: string,
    resolutionDate?: string,
    rules?: string[]
  },
  polymarketMarket: {
    marketId: string,
    question: string,
    description?: string,
    resolutionSource?: string,
    resolutionDate?: string,
    rules?: string[]
  }
})
```

Returns:
```typescript
{
  success: boolean,
  verification: {
    isMatch: boolean,
    matchConfidence: number,      // 0-1
    semanticSimilarity: number,   // 0-1
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    recommendation: 'SAFE_TO_TRADE' | 'PROCEED_WITH_CAUTION' | 'AVOID' | 'MANUAL_REVIEW',
    misalignments: Array<{
      type: string,
      severity: string,
      description: string,
      potentialImpact: string
    }>,
    reasoning: string
  }
}
```

#### `batchVerifyMarkets`
Quick batch verification of multiple pairs.

```typescript
await batchVerifyMarkets.execute({
  pairs: Array<{
    kalshi: { marketId: string, question: string },
    polymarket: { marketId: string, question: string }
  }>
})
```

### Single Market Tools

#### `getKalshiMarket`
Get a single Kalshi market with current prices.

```typescript
await getKalshiMarket.execute({
  ticker: string,
  freshnessMs?: number  // Price freshness (default: 5000)
})
```

#### `getPolymarketMarket`
Get a single Polymarket market with current prices.

```typescript
await getPolymarketMarket.execute({
  conditionId: string,
  freshnessMs?: number
})
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPLAY_LABS_API_KEY` | ✅ | Replay Labs API key - **ALL market data** (Kalshi + Polymarket) |
| `AI_GATEWAY_API_KEY` | ✅ | Vercel AI Gateway key for GPT-4o verification |
| `REPLAY_LABS_BASE_URL` | ⬜ | Override API URL (default: `https://replay-lab-delta.preview.recall.network`) |
| `AI_MODEL` | ⬜ | Override model (default: `gpt-4o`) |

> **Note:** No direct Kalshi or Polymarket API keys needed! All market data comes from Replay Labs.

---

## Examples

### Example 1: Find Safe Arbitrage Opportunities

```typescript
import { semanticSearchMarkets, findOverlapMarkets, verifyMarketPair } from 'semantic-verification-engine';

async function findSafeArbitrage(topic: string) {
  // Search
  const markets = await semanticSearchMarkets.execute({ query: topic });
  
  // Find overlaps
  const polyMarket = markets.markets.find(m => m.venue === 'POLYMARKET');
  if (!polyMarket) return null;
  
  const overlaps = await findOverlapMarkets.execute({
    venue: 'POLYMARKET',
    venuePk: polyMarket.id
  });
  
  // Verify and filter to safe only
  const safeOpportunities = [];
  
  for (const overlap of overlaps.overlaps || []) {
    const result = await verifyMarketPair.execute({
      kalshiMarket: { marketId: overlap.market.id, question: overlap.market.question },
      polymarketMarket: { marketId: polyMarket.id, question: polyMarket.question }
    });
    
    if (result.verification?.recommendation === 'SAFE_TO_TRADE') {
      safeOpportunities.push({
        kalshi: overlap.market,
        polymarket: polyMarket,
        confidence: result.verification.matchConfidence
      });
    }
  }
  
  return safeOpportunities;
}
```

### Example 2: Verify a Known Pair

```typescript
const result = await verifyMarketPair.execute({
  kalshiMarket: {
    marketId: 'FED-RATE-JAN26',
    question: 'Will the Fed cut rates in January 2026?',
    resolutionDate: '2026-01-31',
    resolutionSource: 'Federal Reserve FOMC announcement'
  },
  polymarketMarket: {
    marketId: 'fed-jan-2026',
    question: 'Will the Federal Reserve cut interest rates in January 2026?',
    resolutionDate: '2026-01-31',
    resolutionSource: 'FOMC meeting outcome'
  }
});

if (result.verification.recommendation === 'SAFE_TO_TRADE') {
  console.log('✅ Safe to arbitrage!');
} else {
  console.log('⚠️ Not safe:', result.verification.misalignments);
}
```

---

## Architecture

```
semantic-verification-engine/
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # TypeScript interfaces
│   ├── tools/
│   │   ├── market-apis.ts # Replay Labs API tools
│   │   ├── verification.ts # LLM verification tools
│   │   └── index.ts       # Tool exports
│   └── cli.ts             # CLI entry point
├── .env                   # Environment variables
├── package.json
└── README.md
```

### Dependencies

- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider for AI SDK
- `zod` - Schema validation
- `dotenv` - Environment variables
- `chalk`, `ora`, `commander` - CLI utilities

---

## License

MIT

---

## Contributing

Contributions welcome! Please open an issue or PR.

---

**Built to make prediction market arbitrage safer** 🎯
