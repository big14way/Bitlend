// Credit scoring algorithm for BitLend protocol
// Weights sum to 1000 (max score)

export interface CreditSignals {
  mpesaIncome?: number;       // monthly avg in USD equivalent
  bvnVerified?: boolean;      // BVN/NIN government ID verified
  bankBalance?: number;       // avg balance USD
  walletAge?: number;         // days since first on-chain tx
  repaymentHistory?: number;  // 0-250 from on-chain record
}

export interface ScoreResult {
  score: number;
  tier: string;
  maxLoanAmount: number;      // in micro-USDCx (6 decimals)
  eligible: boolean;
  breakdown: Record<string, number>;
}

export function computeScore(signals: CreditSignals): ScoreResult {
  let score = 0;
  const breakdown: Record<string, number> = {};

  // On-chain repayment history (weight: 250)
  const repaymentPoints = signals.repaymentHistory ?? 0;
  breakdown.repaymentHistory = repaymentPoints;
  score += repaymentPoints;

  // Mpesa income regularity (weight: 200)
  if (signals.mpesaIncome) {
    let incomePoints = 0;
    if (signals.mpesaIncome > 1000) incomePoints = 200;
    else if (signals.mpesaIncome > 500) incomePoints = 150;
    else if (signals.mpesaIncome > 200) incomePoints = 100;
    else incomePoints = 50;
    breakdown.mpesaIncome = incomePoints;
    score += incomePoints;
  }

  // Bank balance stability (weight: 180)
  if (signals.bankBalance) {
    const balancePoints = Math.min(180, Math.floor(signals.bankBalance / 100) * 10);
    breakdown.bankBalance = balancePoints;
    score += balancePoints;
  }

  // BVN/NIN government ID verification (weight: 120)
  if (signals.bvnVerified) {
    breakdown.bvnVerified = 120;
    score += 120;
  }

  // Wallet age on-chain (weight: 100)
  if (signals.walletAge) {
    const agePoints = Math.min(100, Math.floor(signals.walletAge / 30) * 10);
    breakdown.walletAge = agePoints;
    score += agePoints;
  }

  score = Math.min(1000, score);

  const { tier, maxLoanAmount, eligible } = getTier(score);

  return { score, tier, maxLoanAmount, eligible, breakdown };
}

function getTier(score: number): { tier: string; maxLoanAmount: number; eligible: boolean } {
  if (score >= 850) return { tier: "premium", maxLoanAmount: 5000000000, eligible: true };
  if (score >= 700) return { tier: "prime", maxLoanAmount: 2000000000, eligible: true };
  if (score >= 550) return { tier: "standard", maxLoanAmount: 500000000, eligible: true };
  if (score >= 400) return { tier: "micro", maxLoanAmount: 100000000, eligible: true };
  return { tier: "none", maxLoanAmount: 0, eligible: false };
}

// Convert verified source bitmask from proof types
export function sourcesToBitmask(sources: string[]): number {
  let mask = 0;
  if (sources.includes("bank")) mask |= 1;       // bit 0
  if (sources.includes("mpesa")) mask |= 2;      // bit 1
  if (sources.includes("bvn")) mask |= 4;        // bit 2
  if (sources.includes("wallet")) mask |= 8;     // bit 3
  return mask;
}
