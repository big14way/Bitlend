"use client";

import { useState, useEffect } from "react";
import {
  getAddress,
  checkEligibility,
  applyForLoan,
  mintTestTokens,
  formatUSDCx,
} from "@/lib/stacks";

export default function ApplyPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [txResult, setTxResult] = useState<any>(null);

  useEffect(() => {
    const addr = getAddress();
    setAddress(addr);
    if (addr) loadEligibility(addr);
  }, []);

  const loadEligibility = async (addr: string) => {
    setLoading(true);
    try {
      const e = await checkEligibility(addr);
      setEligibility(e);
    } catch (err) {
      console.error("Failed to check eligibility:", err);
    }
    setLoading(false);
  };

  const handleApply = async () => {
    if (!eligibility) return;
    setApplying(true);
    try {
      const result = await applyForLoan(
        Number(eligibility["max-loan-amount"])
      );
      setTxResult(result);
    } catch (err) {
      console.error("Loan application failed:", err);
    }
    setApplying(false);
  };

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Connect your wallet to apply for a loan.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Apply for Loan</h1>
      <p className="text-gray-400 mb-8">
        Borrow USDCx based on your credit score. No BTC collateral needed.
      </p>

      {loading ? (
        <p className="text-gray-400">Checking eligibility...</p>
      ) : eligibility ? (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Your Eligibility</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p
                  className={`text-xl font-bold ${
                    eligibility.eligible ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {eligibility.eligible ? "Eligible" : "Not Eligible"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Tier</p>
                <p className="text-xl font-bold capitalize">
                  {eligibility.tier}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Loan Amount</p>
                <p className="text-2xl font-bold text-orange-500">
                  {formatUSDCx(eligibility["max-loan-amount"])} USDCx
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Interest Rate</p>
                <p className="text-xl font-bold">
                  {eligibility.tier === "prime" || eligibility.tier === "premium"
                    ? "4%"
                    : "5%"}{" "}
                  flat
                </p>
              </div>
            </div>
          </div>

          {eligibility.eligible && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Loan Terms</h3>
              <ul className="text-sm text-gray-400 space-y-1 mb-4">
                <li>
                  - 4 equal installments, each due every ~2 weeks (2016 blocks)
                </li>
                <li>
                  - Interest split: 80% to vault depositors, 20% to protocol
                </li>
                <li>- Repayment improves your on-chain credit score</li>
                <li>- Default is recorded permanently on Bitcoin via Stacks</li>
              </ul>
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 py-3 rounded-lg font-semibold transition"
              >
                {applying
                  ? "Submitting..."
                  : `Borrow ${formatUSDCx(
                      eligibility["max-loan-amount"]
                    )} USDCx`}
              </button>
            </div>
          )}

          {txResult && (
            <div className="bg-gray-900 border border-green-800 rounded-lg p-6">
              <p className="text-green-400 font-semibold">
                Loan application submitted!
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Check your wallet for the transaction confirmation.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">
            No credit profile found. Verify your identity first.
          </p>
          <a
            href="/verify"
            className="bg-orange-600 hover:bg-orange-700 px-6 py-2 rounded-lg font-semibold transition inline-block"
          >
            Get Verified
          </a>
        </div>
      )}
    </div>
  );
}
