"use client";

import { connect, disconnect, request } from "@stacks/connect";
import { Cl, Pc, fetchCallReadOnlyFunction, cvToValue } from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "testnet";

// Helper: build contract id string "ADDRESS.contract-name"
function contractId(name: string): `${string}.${string}` {
  return `${CONTRACT_ADDRESS}.${name}` as `${string}.${string}`;
}

// Wallet connection
export async function connectWallet() {
  const response = await connect();
  return response;
}

export function disconnectWallet() {
  disconnect();
}

// Get the connected STX address from localStorage
export function getAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const data = JSON.parse(localStorage.getItem("stacks-session") || "{}");
    return data?.addresses?.stx?.[0]?.address ?? null;
  } catch {
    return null;
  }
}

// Read-only contract calls
export async function checkEligibility(address: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: "credit-oracle",
    functionName: "check-eligibility",
    functionArgs: [Cl.standardPrincipal(address)],
    network: STACKS_TESTNET,
    senderAddress: address,
  });
  return cvToValue(result);
}

export async function getProfile(address: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: "credit-identity",
    functionName: "get-profile",
    functionArgs: [Cl.standardPrincipal(address)],
    network: STACKS_TESTNET,
    senderAddress: address,
  });
  return cvToValue(result);
}

export async function getLoan(address: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: "loan-vault",
    functionName: "get-loan",
    functionArgs: [Cl.standardPrincipal(address)],
    network: STACKS_TESTNET,
    senderAddress: address,
  });
  return cvToValue(result);
}

export async function getVaultStats() {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: "loan-vault",
    functionName: "get-vault-stats",
    functionArgs: [],
    network: STACKS_TESTNET,
    senderAddress: CONTRACT_ADDRESS,
  });
  return cvToValue(result);
}

export async function getUserShares(address: string) {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: "loan-vault",
    functionName: "get-user-shares",
    functionArgs: [Cl.standardPrincipal(address)],
    network: STACKS_TESTNET,
    senderAddress: address,
  });
  return cvToValue(result);
}

// Contract write calls using @stacks/connect v8 request() API
export async function applyForLoan(loanAmount: number) {
  const response = await request("stx_callContract", {
    contract: contractId("loan-vault"),
    functionName: "apply-for-loan",
    functionArgs: [Cl.contractPrincipal(CONTRACT_ADDRESS, "mock-usdcx")],
    postConditions: [
      Pc.principal(contractId("loan-vault"))
        .willSendLte(loanAmount)
        .ft(contractId("mock-usdcx"), "mock-usdcx"),
    ],
    network: NETWORK,
  });
  return response;
}

export async function repayInstallment(installmentAmount: number) {
  const address = getAddress();
  if (!address) throw new Error("Wallet not connected");

  const response = await request("stx_callContract", {
    contract: contractId("loan-vault"),
    functionName: "repay-installment",
    functionArgs: [Cl.contractPrincipal(CONTRACT_ADDRESS, "mock-usdcx")],
    postConditions: [
      Pc.principal(address)
        .willSendEq(installmentAmount)
        .ft(contractId("mock-usdcx"), "mock-usdcx"),
    ],
    network: NETWORK,
  });
  return response;
}

export async function depositToVault(amount: number) {
  const address = getAddress();
  if (!address) throw new Error("Wallet not connected");

  const response = await request("stx_callContract", {
    contract: contractId("loan-vault"),
    functionName: "deposit",
    functionArgs: [
      Cl.contractPrincipal(CONTRACT_ADDRESS, "mock-usdcx"),
      Cl.uint(amount),
    ],
    postConditions: [
      Pc.principal(address)
        .willSendEq(amount)
        .ft(contractId("mock-usdcx"), "mock-usdcx"),
    ],
    network: NETWORK,
  });
  return response;
}

export async function withdrawFromVault(shares: number) {
  const response = await request("stx_callContract", {
    contract: contractId("loan-vault"),
    functionName: "withdraw",
    functionArgs: [
      Cl.contractPrincipal(CONTRACT_ADDRESS, "mock-usdcx"),
      Cl.uint(shares),
    ],
    network: NETWORK,
  });
  return response;
}

export async function mintTestTokens() {
  const response = await request("stx_callContract", {
    contract: contractId("mock-usdcx"),
    functionName: "faucet",
    functionArgs: [],
    network: NETWORK,
  });
  return response;
}

// Format micro-USDCx to human readable
export function formatUSDCx(microAmount: number | bigint): string {
  return (Number(microAmount) / 1_000_000).toFixed(2);
}
