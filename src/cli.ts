#!/usr/bin/env node
/**
 * CLI for Semantic Verification Engine
 * 
 * Usage:
 *   npx verify-markets --topic "Fed rates"
 *   npx verify-markets verify --topic "Bitcoin"
 *   npx verify-markets pair --kalshi "FED-26JAN" --polymarket "fed-rate"
 */

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runVerificationAgent, quickVerify } from './agent';

const program = new Command();

program
  .name('verify-markets')
  .description('🔬 Semantic Verification Engine - Compare prediction markets across platforms')
  .version('1.0.0');

// Main verify command
program
  .command('verify', { isDefault: true })
  .description('Verify market equivalence between Kalshi and Polymarket')
  .option('-t, --topic <text>', 'Topic to search and verify')
  .action(async (options) => {
    printHeader();
    
    if (options.topic) {
      await verifyMarkets(options.topic);
    } else {
      console.log(chalk.yellow('No topic provided. Running demo with "Fed rates"...\n'));
      await verifyMarkets('Fed rates');
    }
  });

// Pair verification command
program
  .command('pair')
  .description('Verify a specific market pair')
  .requiredOption('-k, --kalshi <ticker>', 'Kalshi market ticker')
  .requiredOption('-p, --polymarket <id>', 'Polymarket condition ID')
  .action(async (options) => {
    printHeader();
    await verifyPair(options.kalshi, options.polymarket);
  });

// Demo command
program
  .command('demo')
  .description('Run demo verification with sample markets')
  .action(async () => {
    printHeader();
    console.log(chalk.cyan('Running demo verifications...\n'));
    
    const topics = ['Fed rates', 'Bitcoin', 'inflation'];
    for (const topic of topics) {
      console.log(chalk.magenta(`\n═══ Topic: ${topic} ═══\n`));
      await verifyMarkets(topic);
    }
  });

function printHeader() {
  console.log(chalk.magenta.bold(`
╔═══════════════════════════════════════════════════════════════════════╗
║  🔬 SEMANTIC VERIFICATION ENGINE                                      ║
║  LLM-powered cross-platform market verification                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`));
}

async function verifyMarkets(topic: string) {
  console.log(chalk.white.bold('🔍 TOPIC:'));
  console.log(chalk.white(`   "${topic}"\n`));

  const spinner = ora('Searching and verifying markets...').start();

  try {
    const startTime = Date.now();
    const result = await runVerificationAgent(topic);
    const duration = Date.now() - startTime;

    spinner.succeed(`Verification complete in ${duration}ms`);

    // Statistics
    console.log(chalk.magenta.bold('\n📊 VERIFICATION STATISTICS:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`   Markets Scanned:  ${chalk.cyan(result.statistics.marketsScanned.kalshi)} Kalshi, ${chalk.hex('#9945FF')(result.statistics.marketsScanned.polymarket)} Polymarket`);
    console.log(`   Matches Found:    ${chalk.white.bold(result.statistics.matchesFound)}`);
    console.log(`   Safe to Trade:    ${chalk.green.bold(result.statistics.safeToTrade)}`);
    console.log(`   Proceed Caution:  ${chalk.yellow.bold(result.statistics.proceedWithCaution)}`);
    console.log(`   Avoid:            ${chalk.red.bold(result.statistics.avoid)}`);
    console.log(`   Needs Review:     ${chalk.blue.bold(result.statistics.needsReview)}`);

    // Market Pairs
    if (result.matchedPairs.length > 0) {
      console.log(chalk.magenta.bold('\n🎯 MATCHED MARKET PAIRS:\n'));

      result.matchedPairs.forEach((pair, index) => {
        const recColor = pair.verification.recommendation === 'SAFE_TO_TRADE' ? chalk.green :
                        pair.verification.recommendation === 'PROCEED_WITH_CAUTION' ? chalk.yellow :
                        pair.verification.recommendation === 'AVOID' ? chalk.red : chalk.blue;
        const recIcon = pair.verification.recommendation === 'SAFE_TO_TRADE' ? '✅' :
                       pair.verification.recommendation === 'PROCEED_WITH_CAUTION' ? '⚠️' :
                       pair.verification.recommendation === 'AVOID' ? '🚫' : '🔍';

        console.log(chalk.magenta(`┌${'─'.repeat(72)}┐`));
        console.log(chalk.magenta(`│ ${chalk.bold(`${index + 1}. ${recIcon} ${pair.verification.recommendation.replace(/_/g, ' ')}`).padEnd(80)} │`));
        console.log(chalk.magenta(`│ ${chalk.gray(`Confidence: ${Math.round(pair.verification.matchConfidence * 100)}% | Risk: ${pair.verification.riskLevel} | Spread: ${Math.round(pair.priceSpread || 0)}¢`).padEnd(70)} │`));
        console.log(chalk.magenta(`├${'─'.repeat(72)}┤`));
        
        console.log(chalk.magenta(`│ ${chalk.cyan('KALSHI:')}`));
        console.log(chalk.magenta(`│   ${chalk.gray(`Ticker: ${pair.kalshi.ticker}`)}`));
        console.log(chalk.magenta(`│   ${chalk.white(pair.kalshi.question.slice(0, 68))}`));
        if (pair.kalshi.price !== undefined) {
          console.log(chalk.magenta(`│   ${chalk.green(`Price: ${Math.round(pair.kalshi.price * 100)}¢`)}`));
        }
        
        console.log(chalk.magenta(`│`));
        console.log(chalk.magenta(`│ ${chalk.hex('#9945FF')('POLYMARKET:')}`));
        console.log(chalk.magenta(`│   ${chalk.gray(`ID: ${pair.polymarket.id.slice(0, 40)}`)}`));
        console.log(chalk.magenta(`│   ${chalk.white(pair.polymarket.question.slice(0, 68))}`));
        if (pair.polymarket.price !== undefined) {
          console.log(chalk.magenta(`│   ${chalk.green(`Price: ${Math.round(pair.polymarket.price * 100)}¢`)}`));
        }

        if (pair.verification.misalignments.length > 0) {
          console.log(chalk.magenta(`├${'─'.repeat(72)}┤`));
          console.log(chalk.magenta(`│ ${chalk.yellow('⚠️ MISALIGNMENTS:')}`));
          pair.verification.misalignments.slice(0, 3).forEach(m => {
            const sevColor = m.severity === 'CRITICAL' ? chalk.red : 
                            m.severity === 'HIGH' ? chalk.hex('#FF6600') :
                            m.severity === 'MEDIUM' ? chalk.yellow : chalk.gray;
            const icons: Record<string, string> = {
              'RESOLUTION_DATE': '📅',
              'RESOLUTION_SOURCE': '📰',
              'SCOPE': '🌍',
              'THRESHOLD': '📏',
              'DEFINITION': '📖',
              'EDGE_CASE': '⚠️',
            };
            const icon = icons[m.type] || '❓';
            console.log(chalk.magenta(`│   ${icon} ${sevColor(`[${m.severity}]`)} ${m.description.slice(0, 55)}`));
          });
        }

        if (pair.arbitrageOpportunity) {
          console.log(chalk.magenta(`├${'─'.repeat(72)}┤`));
          console.log(chalk.magenta(`│ ${chalk.green.bold('💰 ARBITRAGE OPPORTUNITY DETECTED!')}`));
        }

        console.log(chalk.magenta(`└${'─'.repeat(72)}┘\n`));
      });
    } else {
      console.log(chalk.yellow('\n   No matching market pairs found.\n'));
    }

    // Summary
    console.log(chalk.white.bold('📝 SUMMARY:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`   ${result.summary}\n`);

  } catch (error) {
    spinner.fail('Verification failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.yellow('\nMake sure your OPENAI_API_KEY is configured in .env'));
  }
}

async function verifyPair(kalshiTicker: string, polymarketId: string) {
  console.log(chalk.white.bold('🔍 VERIFYING PAIR:'));
  console.log(chalk.cyan(`   Kalshi:     ${kalshiTicker}`));
  console.log(chalk.hex('#9945FF')(`   Polymarket: ${polymarketId}\n`));

  const spinner = ora('Verifying market pair...').start();

  try {
    const result = await quickVerify(kalshiTicker, polymarketId);
    spinner.succeed('Verification complete');

    console.log(chalk.white.bold('\n📊 RESULT:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const recColor = result.recommendation === 'SAFE_TO_TRADE' ? chalk.green :
                    result.recommendation === 'PROCEED_WITH_CAUTION' ? chalk.yellow :
                    result.recommendation === 'AVOID' ? chalk.red : chalk.blue;
    const recIcon = result.recommendation === 'SAFE_TO_TRADE' ? '✅' :
                   result.recommendation === 'PROCEED_WITH_CAUTION' ? '⚠️' :
                   result.recommendation === 'AVOID' ? '🚫' : '🔍';

    console.log(`   Verified:       ${result.verified ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`   Confidence:     ${chalk.white(Math.round(result.confidence * 100) + '%')}`);
    console.log(`   Recommendation: ${recIcon} ${recColor(result.recommendation)}`);
    
    if (result.topMisalignment) {
      console.log(`   Top Issue:      ${chalk.yellow(result.topMisalignment)}`);
    }
    
    console.log();
  } catch (error) {
    spinner.fail('Verification failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

program.parse();
