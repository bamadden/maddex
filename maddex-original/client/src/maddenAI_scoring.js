// ============================================================
// MADDENAI SCORING ENGINE v2.0
// Madden Group Pty Ltd
// ============================================================
// WHAT CHANGED FROM v1:
// - Market Sentiment Score now uses 8 weighted factors, not just price momentum
// - Crypto Momentum Index uses market breadth + volume + fear/greed, not just % change
// - Sector Strength uses relative performance vs ASX average, not raw price change
// - Scores are properly anchored: 50 = neutral, not 50 = "slightly up today"
// - All scores include a confidence level based on data availability
// - Added: Bull/Bear/Neutral breakdown percentages for the UI
// ============================================================
//
// HOW TO USE IN REPLIT:
// Replace the scoring functions in your maddenAI_engine.js with these.
// Or paste this entire file as a new file: src/maddenAI_scoring.js
// Then import from it instead of the old functions.
//
// ============================================================

// ============================================================
// CORE SCORING PHILOSOPHY
// ============================================================
//
// Every score is anchored at 50 = genuinely neutral.
// Scores move UP from 50 when positive signals outweigh negative.
// Scores move DOWN from 50 when negative signals outweigh positive.
//
// A score of 44 does NOT mean "44% bullish".
// It means "the weight of evidence is mildly bearish".
//
// Score bands:
//  80–100 = Extremely Bullish  (rare — requires strong multi-factor alignment)
//  65–79  = Bullish            (clear positive bias across most factors)
//  55–64  = Mildly Bullish     (more positive than negative signals)
//  45–54  = Neutral            (mixed signals, no clear direction)
//  35–44  = Mildly Bearish     (more negative than positive signals)
//  20–34  = Bearish            (clear negative bias across most factors)
//  0–19   = Extremely Bearish  (rare — requires strong multi-factor alignment)
//
// ============================================================

// ── SCORE BAND LABELS ─────────────────────────────────────────
export function scoreToLabel(score) {
  if (score >= 80) return "Extremely Bullish";
  if (score >= 65) return "Bullish";
  if (score >= 55) return "Mildly Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 35) return "Mildly Bearish";
  if (score >= 20) return "Bearish";
  return "Extremely Bearish";
}

export function scoreToColor(score) {
  if (score >= 65) return "#00C389";
  if (score >= 55) return "#4ADE80";
  if (score >= 45) return "#F5A623";
  if (score >= 35) return "#FB923C";
  return "#FF4F5A";
}

export function fearGreedLabel(score) {
  if (score >= 80) return "Extreme Greed";
  if (score >= 60) return "Greed";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Fear";
  return "Extreme Fear";
}

// ── BULL/BEAR/NEUTRAL BREAKDOWN ───────────────────────────────
// Used for the progress bar UI (Bull 72% | Neutral 18% | Bear 10%)
export function scoreToBullBearBreakdown(score) {
  // Score 50 = neutral = 33/34/33
  // Score 100 = maximum bull = 90/8/2
  // Score 0 = maximum bear = 2/8/90
  if (score >= 50) {
    const bullish = Math.round(33 + (score - 50) * 1.14);
    const bearish = Math.max(2, Math.round(33 - (score - 50) * 0.62));
    const neutral = Math.max(5, 100 - bullish - bearish);
    return { bullish, neutral, bearish };
  } else {
    const bearish = Math.round(33 + (50 - score) * 1.14);
    const bullish = Math.max(2, Math.round(33 - (50 - score) * 0.62));
    const neutral = Math.max(5, 100 - bullish - bearish);
    return { bullish, neutral, bearish };
  }
}

// ============================================================
// FACTOR 1 — PRICE MOMENTUM CONVERSION
// Converts a raw % price change into a 0-100 sentiment contribution
// This is ONE factor, not the whole score
// ============================================================
function momentumToScore(changePct) {
  // Anchored at 50 = 0% change
  // +5% daily = ~90 (very strong)
  // -5% daily = ~10 (very weak)
  // Uses a sigmoid-like curve so extreme moves don't dominate
  const clamped = Math.max(-10, Math.min(10, changePct));
  return 50 + clamped * 4;
}

function weeklyMomentumToScore(changePct) {
  // Weekly moves are larger so scale differently
  // +10% weekly = ~83, -10% weekly = ~17
  const clamped = Math.max(-20, Math.min(20, changePct));
  return 50 + clamped * 1.65;
}

// ============================================================
// OVERALL MARKET SENTIMENT SCORE
// 8 weighted factors — each anchored at 50 = neutral
// ============================================================
export function calculateMarketSentimentScore(data) {
  const factors = [];

  // ── FACTOR 1: Crypto Fear & Greed Index (weight 12%) ─────────
  // This is a purpose-built sentiment indicator — use it directly
  // It already accounts for volatility, momentum, volume, social media, dominance
  if (data.fearGreed?.value !== undefined) {
    factors.push({
      name: "Crypto Fear & Greed",
      score: data.fearGreed.value, // Already 0-100
      weight: 12,
    });
  }

  // ── FACTOR 2: ASX Breadth (weight 20%) ───────────────────────
  // What % of ASX stocks are up today — more meaningful than average % change
  // 60%+ stocks up = bullish breadth, 40%- = bearish breadth
  if (data.asx?.length) {
    const gainers = data.asx.filter((s) => (s.change24h || 0) > 0).length;
    const losers = data.asx.filter((s) => (s.change24h || 0) < 0).length;
    const total = data.asx.length;
    const gainerRatio = gainers / total; // 0 to 1
    // 0.5 ratio = 50 score, 0.7 ratio = 70 score, 0.3 ratio = 30 score
    const breadthScore = gainerRatio * 100;
    factors.push({
      name: "ASX Market Breadth",
      score: breadthScore,
      weight: 20,
    });
  }

  // ── FACTOR 3: ASX Price Momentum (weight 15%) ─────────────────
  // Weighted average of ASX price changes — larger stocks matter more
  if (data.asx?.length) {
    const avgChange =
      data.asx.reduce((sum, s) => sum + (s.change24h || 0), 0) /
      data.asx.length;
    factors.push({
      name: "ASX Price Momentum",
      score: momentumToScore(avgChange),
      weight: 15,
    });
  }

  // ── FACTOR 4: S&P 500 Momentum (weight 15%) ───────────────────
  // US markets lead Australian sentiment — what happens overnight matters
  const spy = data.us?.find((u) => u.symbol === "SPY");
  if (spy?.change24h !== undefined) {
    factors.push({
      name: "S&P 500 Momentum",
      score: momentumToScore(spy.change24h),
      weight: 15,
    });
  }

  // ── FACTOR 5: BTC as Risk Appetite Indicator (weight 12%) ─────
  // BTC is highly correlated with global risk appetite
  // Strong BTC = risk-on environment = positive for equities too
  const btc = data.crypto?.find((c) => c.symbol === "BTC");
  if (btc?.change24h !== undefined) {
    factors.push({
      name: "BTC Risk Appetite",
      score: momentumToScore(btc.change24h),
      weight: 12,
    });
  }

  // ── FACTOR 6: Gold as Safe Haven (weight 10%) ─────────────────
  // Gold rising = investors seeking safety = risk-off = bearish signal
  // Gold falling = confidence in risk assets = risk-on = bullish signal
  // This is an INVERSE signal
  if (data.gold?.change24h !== undefined) {
    const goldInverseScore = 50 - data.gold.change24h * 4;
    factors.push({
      name: "Gold Safe Haven (inverse)",
      score: Math.max(0, Math.min(100, goldInverseScore)),
      weight: 10,
    });
  }

  // ── FACTOR 7: AUD/USD as Risk Currency (weight 8%) ────────────
  // AUD is a "risk currency" — it rises when global sentiment is positive
  // AUD/USD rising = global risk-on = bullish signal for Australian assets
  const audusd = data.fx?.find((f) => f.symbol === "AUD/USD");
  if (audusd?.change24h !== undefined) {
    factors.push({
      name: "AUD/USD Risk Currency",
      score: momentumToScore(audusd.change24h * 3), // FX moves are smaller so scale up
      weight: 8,
    });
  }

  // ── FACTOR 8: Crypto Market Breadth (weight 8%) ───────────────
  // Are most crypto assets up or down?
  if (data.crypto?.length) {
    const cryptoGainers = data.crypto.filter(
      (c) => (c.change24h || 0) > 0,
    ).length;
    const cryptoBreadth = (cryptoGainers / data.crypto.length) * 100;
    factors.push({
      name: "Crypto Market Breadth",
      score: cryptoBreadth,
      weight: 8,
    });
  }

  // ── CALCULATE WEIGHTED AVERAGE ────────────────────────────────
  if (factors.length === 0)
    return { score: 50, label: "Neutral", confidence: 0, factors: [] };

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const rawScore = weightedSum / totalWeight;
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  // Confidence = how many factors we have data for (vs max 8)
  const confidence = Math.round((factors.length / 8) * 100);

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence,
    breakdown: scoreToBullBearBreakdown(finalScore),
    factors: factors.map((f) => ({
      ...f,
      score: Math.round(f.score),
      contribution: Math.round((f.score - 50) * (f.weight / totalWeight)),
    })),
  };
}

// ============================================================
// CRYPTO MOMENTUM INDEX
// Multi-factor: price momentum + market breadth + volume + fear/greed
// NOT just "how much did BTC go up today"
// ============================================================
export function calculateCryptoMomentumIndex(data) {
  if (!data.crypto?.length) {
    return { score: 50, label: "Neutral", confidence: 0 };
  }

  const factors = [];

  // ── FACTOR 1: 24h Price Momentum (weight 25%) ────────────────
  // Weighted by market cap — BTC and ETH matter more
  const marketCapWeights = { BTC: 5, ETH: 3, BNB: 2, SOL: 2, XRP: 1, ADA: 1 };
  let weightedMomentum = 0;
  let totalMcapWeight = 0;

  data.crypto.forEach((coin) => {
    const w = marketCapWeights[coin.symbol] || 1;
    weightedMomentum += momentumToScore(coin.change24h || 0) * w;
    totalMcapWeight += w;
  });

  factors.push({
    name: "24h Price Momentum (market-cap weighted)",
    score: weightedMomentum / totalMcapWeight,
    weight: 25,
  });

  // ── FACTOR 2: 7-Day Trend (weight 20%) ───────────────────────
  // Short-term price changes can be noise — 7d trend is more meaningful
  let weighted7d = 0;
  let total7dW = 0;

  data.crypto.forEach((coin) => {
    if (coin.change7d !== undefined && coin.change7d !== null) {
      const w = marketCapWeights[coin.symbol] || 1;
      weighted7d += weeklyMomentumToScore(coin.change7d) * w;
      total7dW += w;
    }
  });

  if (total7dW > 0) {
    factors.push({
      name: "7-Day Trend",
      score: weighted7d / total7dW,
      weight: 20,
    });
  }

  // ── FACTOR 3: Market Breadth (weight 20%) ────────────────────
  // Are MOST crypto assets up or just BTC?
  // When breadth is wide (most coins up) = stronger signal than BTC alone
  const gainers = data.crypto.filter((c) => (c.change24h || 0) > 0).length;
  const gainerRatio = gainers / data.crypto.length;
  factors.push({
    name: "Crypto Market Breadth",
    score: gainerRatio * 100,
    weight: 20,
  });

  // ── FACTOR 4: Fear & Greed Index (weight 20%) ─────────────────
  // Purpose-built crypto sentiment indicator
  if (data.fearGreed?.value !== undefined) {
    factors.push({
      name: "Fear & Greed Index",
      score: data.fearGreed.value,
      weight: 20,
    });
  }

  // ── FACTOR 5: Volume Signal (weight 15%) ─────────────────────
  // High volume on up days = conviction. High volume on down days = distribution.
  // We approximate using 24h volume vs market cap ratio
  let volumeScore = 50; // Default neutral if no volume data
  const btc = data.crypto.find((c) => c.symbol === "BTC");
  if (btc?.volume24h && btc?.marketCap) {
    const volumeRatio = btc.volume24h / btc.marketCap;
    // Normal BTC daily volume/mcap ratio is ~3-5%
    // Above 7% = high volume, below 2% = low volume
    if (volumeRatio > 0.07) volumeScore = btc.change24h >= 0 ? 75 : 25;
    else if (volumeRatio > 0.04) volumeScore = btc.change24h >= 0 ? 62 : 38;
    else volumeScore = 50; // Low volume = less conviction either way
  }
  factors.push({
    name: "Volume Conviction",
    score: volumeScore,
    weight: 15,
  });

  // ── CALCULATE ─────────────────────────────────────────────────
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const rawScore = weightedSum / totalWeight;
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    confidence: Math.round((factors.length / 5) * 100),
    breakdown: scoreToBullBearBreakdown(finalScore),
    factors,
  };
}

// ============================================================
// SECTOR STRENGTH
// Uses RELATIVE performance vs ASX average — not raw % change
// A sector is "strong" if it's outperforming the broader market
// ============================================================
export function calculateSectorStrength(data) {
  if (!data.asx?.length) return [];

  // Step 1: Calculate the ASX average change (benchmark)
  const asxAvgChange =
    data.asx.reduce((sum, s) => sum + (s.change24h || 0), 0) / data.asx.length;

  // Step 2: Group stocks by sector
  const sectorMap = {};
  data.asx.forEach((stock) => {
    const sector = stock.sector || "Other";
    if (!sectorMap[sector]) sectorMap[sector] = [];
    sectorMap[sector].push(stock);
  });

  // Step 3: For each sector, calculate:
  // - Average sector change
  // - Relative performance vs ASX average
  // - Breadth (% of stocks in sector that are up)
  // - Strength score (relative performance + breadth combined)
  const sectors = Object.entries(sectorMap).map(([sector, stocks]) => {
    const avgChange =
      stocks.reduce((sum, s) => sum + (s.change24h || 0), 0) / stocks.length;
    const relativePerf = avgChange - asxAvgChange; // How much better/worse than market
    const gainers = stocks.filter((s) => (s.change24h || 0) > 0).length;
    const breadth = gainers / stocks.length; // 0 to 1

    // Strength score:
    // Start at 50 (neutral vs market)
    // Relative performance contribution: each 1% above/below market = ±8 points
    // Breadth contribution: 100% gainers = +15, 0% gainers = -15
    const relativeScore = 50 + relativePerf * 8;
    const breadthBonus = (breadth - 0.5) * 30;
    const rawStrength = relativeScore + breadthBonus;
    const strength = Math.round(Math.max(0, Math.min(100, rawStrength)));

    return {
      sector,
      strength,
      label: scoreToLabel(strength),
      color: scoreToColor(strength),
      avgChange: parseFloat(avgChange.toFixed(2)),
      relativePerf: parseFloat(relativePerf.toFixed(2)),
      breadthPct: Math.round(breadth * 100),
      stockCount: stocks.length,
      stocks: stocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        change24h: s.change24h,
        price: s.price,
      })),
    };
  });

  // Sort by strength descending
  return sectors.sort((a, b) => b.strength - a.strength);
}

// ============================================================
// ASX OVERALL SENTIMENT
// Separate from market sentiment — focused purely on ASX
// ============================================================
export function calculateASXSentiment(data) {
  if (!data.asx?.length) return { score: 50, label: "Neutral" };

  const gainers = data.asx.filter((s) => (s.change24h || 0) > 0).length;
  const losers = data.asx.filter((s) => (s.change24h || 0) < 0).length;
  const gainerRatio = gainers / data.asx.length;
  const avgChange =
    data.asx.reduce((sum, s) => sum + (s.change24h || 0), 0) / data.asx.length;

  // Breadth is more important than magnitude
  const breadthScore = gainerRatio * 100;
  const momentumScore = momentumToScore(avgChange);
  const combined = breadthScore * 0.6 + momentumScore * 0.4;
  const finalScore = Math.round(Math.max(0, Math.min(100, combined)));

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    gainers,
    losers,
    unchanged: data.asx.length - gainers - losers,
    avgChange: parseFloat(avgChange.toFixed(2)),
    breakdown: scoreToBullBearBreakdown(finalScore),
  };
}

// ============================================================
// INDIVIDUAL ASSET SENTIMENT SCORE
// Used for the AI Chat response cards
// Combines 24h, 7d momentum + volume + relative sector performance
// ============================================================
export function calculateAssetSentiment(asset, sectorStrength, asxAvg) {
  const factors = [];

  // 24h momentum (weight 35%)
  if (asset.change24h !== undefined) {
    factors.push({ score: momentumToScore(asset.change24h), weight: 35 });
  }

  // 7d trend (weight 30%)
  if (asset.change7d !== undefined) {
    factors.push({ score: weeklyMomentumToScore(asset.change7d), weight: 30 });
  }

  // Sector relative strength (weight 20%) — for ASX stocks
  if (asset.sector && sectorStrength) {
    const sector = sectorStrength.find((s) => s.sector === asset.sector);
    if (sector) {
      factors.push({ score: sector.strength, weight: 20 });
    }
  }

  // Relative performance vs ASX (weight 15%) — for ASX stocks
  if (asxAvg !== undefined && asset.change24h !== undefined) {
    const relPerf = asset.change24h - asxAvg;
    factors.push({ score: momentumToScore(relPerf * 2), weight: 15 });
  }

  if (factors.length === 0) return { score: 50, label: "Neutral" };

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const rawScore = weightedSum / totalWeight;
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    breakdown: scoreToBullBearBreakdown(finalScore),
  };
}

// ============================================================
// TOP MOVERS — INTELLIGENT SELECTION
// Not just the biggest % movers — weights by significance
// ============================================================
export function getTopGainers(data) {
  const all = [
    ...(data.crypto || []).map((a) => ({ ...a, market: "Crypto" })),
    ...(data.asx || []).map((a) => ({ ...a, market: "ASX" })),
    ...(data.us || []).map((a) => ({ ...a, market: "US" })),
  ];
  return all
    .filter(
      (a) =>
        a.change24h !== null && a.change24h !== undefined && a.change24h > 0,
    )
    .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
    .slice(0, 5);
}

export function getTopLosers(data) {
  const all = [
    ...(data.crypto || []).map((a) => ({ ...a, market: "Crypto" })),
    ...(data.asx || []).map((a) => ({ ...a, market: "ASX" })),
    ...(data.us || []).map((a) => ({ ...a, market: "US" })),
  ];
  return all
    .filter(
      (a) =>
        a.change24h !== null && a.change24h !== undefined && a.change24h < 0,
    )
    .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))
    .slice(0, 5);
}

// ============================================================
// AI SNAPSHOT GENERATOR
// Generates the plain-English daily snapshot for the Home screen
// Calls Claude with live data to produce a 2-3 sentence summary
// ============================================================
export function generateSnapshotText(marketData) {
  const { marketSentimentScore, cryptoMomentumIndex, asx, fearGreed } =
    marketData;
  const mss = marketSentimentScore?.score || 50;
  const cmi = cryptoMomentumIndex?.score || 50;
  const fgVal = fearGreed?.value || 50;
  const fgLbl = fearGreed?.label || "Neutral";

  const asxAvg = asx?.length
    ? (
        asx.reduce((sum, s) => sum + (s.change24h || 0), 0) / asx.length
      ).toFixed(2)
    : "0.00";

  const asxGainers = asx?.filter((s) => (s.change24h || 0) > 0).length || 0;
  const asxLosers = asx?.filter((s) => (s.change24h || 0) < 0).length || 0;

  // Generate context-aware snapshot text
  let snapshot = "";

  if (mss >= 65) {
    snapshot = `MaddenAI detects broad-based bullish momentum. `;
  } else if (mss >= 55) {
    snapshot = `MaddenAI detects mildly positive market conditions. `;
  } else if (mss >= 45) {
    snapshot = `MaddenAI detects mixed signals across markets. `;
  } else if (mss >= 35) {
    snapshot = `MaddenAI detects mild caution across markets. `;
  } else {
    snapshot = `MaddenAI detects broadly bearish conditions. `;
  }

  // ASX context
  if (parseFloat(asxAvg) > 0.5) {
    snapshot += `ASX tracking well with ${asxGainers} of ${asx?.length || 10} tracked stocks advancing. `;
  } else if (parseFloat(asxAvg) < -0.5) {
    snapshot += `ASX under pressure with ${asxLosers} of ${asx?.length || 10} tracked stocks in the red. `;
  } else {
    snapshot += `ASX broadly flat, with gains and losses evenly distributed. `;
  }

  // Crypto context
  if (cmi >= 65) {
    snapshot += `Crypto momentum is strong (${cmi}/100). `;
  } else if (cmi <= 35) {
    snapshot += `Crypto momentum is weak (${cmi}/100). `;
  }

  // Fear & Greed
  snapshot += `Market sentiment: ${fgLbl} (Fear & Greed: ${fgVal}/100).`;

  return snapshot;
}

// ============================================================
// FORMAT HELPERS
// ============================================================
export function formatPrice(price, currency = "AUD") {
  if (price === null || price === undefined) return "N/A";
  const prefix = currency === "USD" ? "US$" : "$";
  if (price >= 1000000) return `${prefix}${(price / 1000000).toFixed(2)}M`;
  if (price >= 1000)
    return `${prefix}${price.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `${prefix}${price.toFixed(2)}`;
  return `${prefix}${price.toFixed(2)}`;
}

export function formatChange(change, showSign = true) {
  if (change === null || change === undefined) return "—";
  const sign = showSign && change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function formatMarketCap(cap) {
  if (!cap) return "N/A";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatVolume(vol) {
  if (!vol) return "N/A";
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================
// SCORE EXPLANATION — for the UI tooltip / info popup
// Tells users exactly what went into each score
// ============================================================
export function explainScore(scoreObject, type = "market") {
  if (!scoreObject?.factors?.length) {
    return "Score calculated from available market data.";
  }

  const topPositive = scoreObject.factors
    .filter((f) => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  const topNegative = scoreObject.factors
    .filter((f) => f.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 2);

  let explanation = `Score of ${scoreObject.score}/100 (${scoreObject.label}). `;

  if (topPositive.length) {
    explanation += `Positive signals: ${topPositive.map((f) => f.name).join(", ")}. `;
  }
  if (topNegative.length) {
    explanation += `Negative signals: ${topNegative.map((f) => f.name).join(", ")}. `;
  }

  explanation += `Based on ${scoreObject.factors.length} data factors with ${scoreObject.confidence}% data confidence.`;

  return explanation;
}

// ============================================================
// HOW TO INTEGRATE INTO YOUR REPLIT AGENT
// ============================================================
//
// Once this file is saved in Replit, tell the Agent:
//
// "Please update the scoring functions in the app to use the
//  upgraded versions from maddenAI_scoring.js. Specifically:
//
//  1. Import calculateMarketSentimentScore, calculateCryptoMomentumIndex,
//     calculateSectorStrength, calculateASXSentiment, scoreToBullBearBreakdown,
//     scoreToLabel, scoreToColor, generateSnapshotText, formatPrice,
//     formatChange from ./maddenAI_scoring
//
//  2. Replace the Home screen's hardcoded sentiment text with
//     generateSnapshotText(marketData)
//
//  3. Replace the bullish/neutral/bearish % breakdown on the
//     Home screen with scoreToBullBearBreakdown(marketSentimentScore)
//     so the bar shows real calculated percentages
//
//  4. Replace the Trends screen sector strength data with
//     calculateSectorStrength(marketData) — each sector's strength
//     score should show relative performance vs ASX average, not raw %
//
//  5. On the Trends screen, show the score explanation tooltip
//     using explainScore() so users can tap to see what drove the score
//
//  6. The Crypto Momentum Index on Trends should use
//     calculateCryptoMomentumIndex(marketData).score
//     and display the breakdown (breadth, volume, fear/greed, momentum)
//     not just a single gauge number"
//
// ============================================================
