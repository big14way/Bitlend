"use client";

import { useState, useEffect } from "react";
import {
  getAddress,
  getVaultStats,
  getUserShares,
  depositToVault,
  withdrawFromVault,
  mintTestTokens,
  formatUSDCx,
} from "@/lib/stacks";

export default function VaultPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [shares, setShares] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    const addr = getAddress();
    setAddress(addr);
    loadData(addr);
  }, []);

  const loadData = async (addr: string | null) => {
    setLoading(true);
    try {
      const s = await getVaultStats();
      setStats(s);
      if (addr) {
        const userShares = await getUserShares(addr);
        setShares(Number(userShares));
      }
    } catch (err) {
      console.error("Failed to load vault data:", err);
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    const amount = Math.floor(parseFloat(depositAmount) * 1_000_000);
    if (!amount || amount <= 0) return;
    setTxStatus("depositing");
    try {
      await depositToVault(amount);
      setTxStatus("deposited");
      setDepositAmount("");
      loadData(address);
    } catch (err) {
      console.error("Deposit failed:", err);
      setTxStatus(null);
    }
  };

  const handleWithdraw = async () => {
    const sharesToWithdraw = Math.floor(
      parseFloat(withdrawShares) * 1_000_000
    );
    if (!sharesToWithdraw || sharesToWithdraw <= 0) return;
    setTxStatus("withdrawing");
    try {
      await withdrawFromVault(sharesToWithdraw);
      setTxStatus("withdrawn");
      setWithdrawShares("");
      loadData(address);
    } catch (err) {
      console.error("Withdrawal failed:", err);
      setTxStatus(null);
    }
  };

  const handleFaucet = async () => {
    setTxStatus("minting");
    try {
      await mintTestTokens();
      setTxStatus("minted");
    } catch (err) {
      console.error("Faucet failed:", err);
      setTxStatus(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Lending Vault</h1>
      <p className="text-gray-400 mb-8">
        Deposit USDCx to earn yield from borrower interest payments. Withdraw
        anytime with your proportional share of vault earnings.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4">Vault Statistics</h3>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-orange-500">
                {formatUSDCx(stats["total-deposits"])}
              </p>
              <p className="text-xs text-gray-400">Total Deposits (USDCx)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatUSDCx(stats["total-shares"])}
              </p>
              <p className="text-xs text-gray-400">Total Shares</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">
                {formatUSDCx(stats["total-interest-collected"])}
              </p>
              <p className="text-xs text-gray-400">Interest Collected</p>
            </div>
          </div>
        ) : null}
      </div>

      {address && (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Your Position</h3>
              <p className="text-sm text-gray-400">
                {formatUSDCx(shares)} shares
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Deposit USDCx
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount (e.g. 100)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={txStatus === "depositing"}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition"
                  >
                    Deposit
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Withdraw (shares)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Shares to withdraw"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={txStatus === "withdrawing"}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Testnet Faucet</h3>
            <p className="text-sm text-gray-400 mb-3">
              Mint 1,000 mock USDCx to your wallet for testing.
            </p>
            <button
              onClick={handleFaucet}
              disabled={txStatus === "minting"}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition"
            >
              {txStatus === "minting" ? "Minting..." : "Get Test USDCx"}
            </button>
          </div>
        </>
      )}

      {txStatus && txStatus !== "depositing" && txStatus !== "withdrawing" && txStatus !== "minting" && (
        <div className="mt-4 bg-gray-900 border border-green-800 rounded-lg p-4">
          <p className="text-green-400 text-sm font-semibold">
            Transaction submitted. Check your wallet for confirmation.
          </p>
        </div>
      )}
    </div>
  );
}
