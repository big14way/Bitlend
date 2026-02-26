"use client";

import { useState, useEffect } from "react";
import { getAddress, getProfile, checkEligibility, formatUSDCx } from "@/lib/stacks";

export default function ProfilePage() {
  const [address, setAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const addr = getAddress();
    setAddress(addr);
    if (addr) loadProfile(addr);
  }, []);

  const loadProfile = async (addr: string) => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        getProfile(addr),
        checkEligibility(addr),
      ]);
      setProfile(p);
      setEligibility(e);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    setLoading(false);
  };

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Connect your wallet to view your credit profile.</p>
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    premium: "text-yellow-400",
    prime: "text-green-400",
    standard: "text-blue-400",
    micro: "text-gray-400",
    none: "text-red-400",
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Credit Profile</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
        <p className="font-mono text-sm">{address}</p>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading profile...</p>
      ) : profile ? (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Credit Score</p>
                <p className="text-4xl font-bold text-orange-500">
                  {Number(profile["credit-score"])}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Tier</p>
                <p
                  className={`text-2xl font-bold capitalize ${
                    tierColors[eligibility?.tier] || "text-white"
                  }`}
                >
                  {eligibility?.tier || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Max Loan Amount</p>
                <p className="text-xl font-semibold">
                  {eligibility
                    ? `${formatUSDCx(eligibility["max-loan-amount"])} USDCx`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Repayment Rate</p>
                <p className="text-xl font-semibold">
                  {Number(profile["repayment-rate"])}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Loan History</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {Number(profile["total-loans"])}
                </p>
                <p className="text-xs text-gray-400">Total Loans</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">
                  {Number(profile["total-defaulted"])}
                </p>
                <p className="text-xs text-gray-400">Defaults</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatUSDCx(profile["outstanding-debt"])}
                </p>
                <p className="text-xs text-gray-400">Outstanding Debt</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">No credit profile found.</p>
          <a
            href="/verify"
            className="bg-orange-600 hover:bg-orange-700 px-6 py-2 rounded-lg font-semibold transition inline-block"
          >
            Verify Identity to Get Started
          </a>
        </div>
      )}
    </div>
  );
}
