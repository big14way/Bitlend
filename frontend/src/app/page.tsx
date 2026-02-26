"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { connectWallet, disconnectWallet, getAddress } from "@/lib/stacks";

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setAddress(getAddress());
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectWallet();
      setAddress(getAddress());
    } catch (e) {
      console.error("Connection failed:", e);
    }
    setConnecting(false);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setAddress(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="mb-8">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-orange-500">Bitcoin-Native</span> Credit
          Protocol
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          The first uncollateralized BNPL and credit layer on Bitcoin. Powered by
          zkTLS underwriting, with credit history permanently settled on Bitcoin
          L1 through Stacks.
        </p>
      </div>

      <div className="mb-12">
        {address ? (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-6 py-4">
              <p className="text-sm text-gray-400">Connected Wallet</p>
              <p className="font-mono text-sm text-green-400">
                {address.slice(0, 8)}...{address.slice(-8)}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                href="/verify"
                className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Get Credit Score
              </Link>
              <Link
                href="/apply"
                className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Apply for Loan
              </Link>
              <button
                onClick={handleDisconnect}
                className="text-gray-500 hover:text-gray-300 px-4 py-3 transition text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-8 py-4 rounded-lg text-lg font-semibold transition"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">
            No Collateral Needed
          </h3>
          <p className="text-gray-400 text-sm">
            Borrow USDCx using your verified financial history from Mpesa, bank
            accounts, and government IDs - no BTC collateral required.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">
            Bitcoin-Settled History
          </h3>
          <p className="text-gray-400 text-sm">
            Every loan and repayment is finalized on Bitcoin L1 via Stacks -
            the most permanent, trust-minimized credit record possible.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">
            Earn Yield on USDCx
          </h3>
          <p className="text-gray-400 text-sm">
            Deposit USDCx into the lending vault and earn yield from borrower
            interest payments - all auditable on-chain in Clarity.
          </p>
        </div>
      </div>
    </div>
  );
}
