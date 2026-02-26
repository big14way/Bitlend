"use client";

import { useState, useEffect } from "react";
import { getAddress } from "@/lib/stacks";
import { demoSubmitScore } from "@/lib/api";

export default function VerifyPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [signals, setSignals] = useState({
    mpesaIncome: 800,
    bvnVerified: true,
    bankBalance: 500,
    walletAge: 180,
  });

  useEffect(() => {
    setAddress(getAddress());
  }, []);

  const handleDemoVerify = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await demoSubmitScore(address, signals);
      setResult(res);
    } catch (err) {
      console.error("Verification failed:", err);
    }
    setLoading(false);
  };

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Connect your wallet to start verification.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Identity Verification</h1>
      <p className="text-gray-400 mb-8">
        Verify your financial history using zkTLS proofs from Reclaim Protocol.
        Your data stays private - only the verified score goes on-chain.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4">Demo Mode - Simulate Verification Signals</h3>
        <p className="text-xs text-gray-500 mb-4">
          In production, these values come from zkTLS proofs via Reclaim Protocol.
          For demo, adjust the sliders to simulate different financial profiles.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 flex justify-between">
              <span>Monthly Mpesa Income (USD)</span>
              <span className="text-white">${signals.mpesaIncome}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2000}
              step={50}
              value={signals.mpesaIncome}
              onChange={(e) =>
                setSignals({ ...signals, mpesaIncome: Number(e.target.value) })
              }
              className="w-full accent-orange-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 flex justify-between">
              <span>Bank Balance (USD)</span>
              <span className="text-white">${signals.bankBalance}</span>
            </label>
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={signals.bankBalance}
              onChange={(e) =>
                setSignals({ ...signals, bankBalance: Number(e.target.value) })
              }
              className="w-full accent-orange-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 flex justify-between">
              <span>Wallet Age (days)</span>
              <span className="text-white">{signals.walletAge} days</span>
            </label>
            <input
              type="range"
              min={0}
              max={730}
              step={30}
              value={signals.walletAge}
              onChange={(e) =>
                setSignals({ ...signals, walletAge: Number(e.target.value) })
              }
              className="w-full accent-orange-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="bvn"
              checked={signals.bvnVerified}
              onChange={(e) =>
                setSignals({ ...signals, bvnVerified: e.target.checked })
              }
              className="accent-orange-500"
            />
            <label htmlFor="bvn" className="text-sm text-gray-400">
              BVN / National ID Verified
            </label>
          </div>
        </div>

        <button
          onClick={handleDemoVerify}
          disabled={loading}
          className="mt-6 w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 py-3 rounded-lg font-semibold transition"
        >
          {loading ? "Computing Score..." : "Submit Verification"}
        </button>
      </div>

      {result && (
        <div className="bg-gray-900 border border-green-800 rounded-lg p-6">
          <h3 className="font-semibold text-green-400 mb-4">
            Score Computed Successfully
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Credit Score</p>
              <p className="text-3xl font-bold text-orange-500">
                {result.score}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Tier</p>
              <p className="text-xl font-bold capitalize">{result.tier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Max Loan</p>
              <p className="text-xl font-semibold">
                {(result.maxLoanAmount / 1_000_000).toFixed(0)} USDCx
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Eligible</p>
              <p
                className={`text-xl font-semibold ${
                  result.eligible ? "text-green-400" : "text-red-400"
                }`}
              >
                {result.eligible ? "Yes" : "No"}
              </p>
            </div>
          </div>
          {result.txid && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400">On-chain TX</p>
              <p className="font-mono text-xs text-green-400 break-all">
                {result.txid}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
