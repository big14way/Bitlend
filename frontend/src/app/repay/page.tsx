"use client";

import { useState, useEffect } from "react";
import { getAddress, getLoan, repayInstallment, formatUSDCx } from "@/lib/stacks";

export default function RepayPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const [txResult, setTxResult] = useState<any>(null);

  useEffect(() => {
    const addr = getAddress();
    setAddress(addr);
    if (addr) loadLoan(addr);
  }, []);

  const loadLoan = async (addr: string) => {
    setLoading(true);
    try {
      const l = await getLoan(addr);
      setLoan(l);
    } catch (err) {
      console.error("Failed to load loan:", err);
    }
    setLoading(false);
  };

  const handleRepay = async () => {
    if (!loan) return;
    setRepaying(true);
    try {
      const result = await repayInstallment(
        Number(loan["installment-size"])
      );
      setTxResult(result);
      if (address) loadLoan(address);
    } catch (err) {
      console.error("Repayment failed:", err);
    }
    setRepaying(false);
  };

  if (!address) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Connect your wallet to manage repayments.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Loan Repayment</h1>
      <p className="text-gray-400 mb-8">
        View your active loan and make installment payments.
      </p>

      {loading ? (
        <p className="text-gray-400">Loading loan details...</p>
      ) : loan && loan.status !== undefined ? (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Active Loan</h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  loan.status === "active"
                    ? "bg-green-900 text-green-400"
                    : loan.status === "repaid"
                    ? "bg-blue-900 text-blue-400"
                    : "bg-red-900 text-red-400"
                }`}
              >
                {loan.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Principal</p>
                <p className="text-xl font-bold">
                  {formatUSDCx(loan["principal-amount"])} USDCx
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Owed</p>
                <p className="text-xl font-bold">
                  {formatUSDCx(loan["total-owed"])} USDCx
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Amount Repaid</p>
                <p className="text-xl font-bold text-green-400">
                  {formatUSDCx(loan["amount-repaid"])} USDCx
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Remaining</p>
                <p className="text-xl font-bold text-orange-400">
                  {formatUSDCx(
                    Number(loan["total-owed"]) - Number(loan["amount-repaid"])
                  )}{" "}
                  USDCx
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Payment Progress</span>
                <span>
                  {Number(loan["installments-paid"])} /{" "}
                  {Number(loan["installments-total"])} installments
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${
                      (Number(loan["installments-paid"]) /
                        Number(loan["installments-total"])) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {loan.status === "active" && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Next Installment</h3>
              <p className="text-2xl font-bold text-orange-500 mb-1">
                {formatUSDCx(loan["installment-size"])} USDCx
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Due at block #{Number(loan["due-block"])}
              </p>
              <button
                onClick={handleRepay}
                disabled={repaying}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 py-3 rounded-lg font-semibold transition"
              >
                {repaying ? "Processing..." : "Pay Installment"}
              </button>
            </div>
          )}

          {txResult && (
            <div className="bg-gray-900 border border-green-800 rounded-lg p-6">
              <p className="text-green-400 font-semibold">
                Payment submitted successfully!
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">No active loan found.</p>
          <a
            href="/apply"
            className="bg-orange-600 hover:bg-orange-700 px-6 py-2 rounded-lg font-semibold transition inline-block"
          >
            Apply for a Loan
          </a>
        </div>
      )}
    </div>
  );
}
