// Stacks blockchain interaction for oracle score submission
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  standardPrincipalCV,
  fetchCallReadOnlyFunction,
  cvToValue,
} from "@stacks/transactions";
import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

const isTestnet = process.env.STACKS_NETWORK !== "mainnet";
const network = isTestnet ? STACKS_TESTNET : STACKS_MAINNET;

function getContractAddress(): string {
  const addr = process.env.ORACLE_CONTRACT_ADDRESS;
  if (!addr) throw new Error("ORACLE_CONTRACT_ADDRESS not set");
  return addr;
}

function getOracleKey(): string {
  const key = process.env.ORACLE_PRIVATE_KEY;
  if (!key) throw new Error("ORACLE_PRIVATE_KEY not set");
  return key;
}

export async function submitScoreOnChain(
  recipientAddress: string,
  score: number,
  verifiedSources: number
): Promise<string> {
  const contractAddress = getContractAddress();

  const tx = await makeContractCall({
    contractAddress,
    contractName: "credit-oracle",
    functionName: "submit-score",
    functionArgs: [
      standardPrincipalCV(recipientAddress),
      uintCV(score),
      uintCV(verifiedSources),
    ],
    senderKey: getOracleKey(),
    network,
  });

  const result = await broadcastTransaction({ transaction: tx, network });

  if ("error" in result) {
    throw new Error(`Broadcast failed: ${result.error} - ${result.reason}`);
  }

  return result.txid;
}

export async function getScoreOnChain(address: string): Promise<{
  score: number;
  tier: string;
  maxLoanAmount: number;
  eligible: boolean;
}> {
  const contractAddress = getContractAddress();

  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName: "credit-oracle",
    functionName: "check-eligibility",
    functionArgs: [standardPrincipalCV(address)],
    network,
    senderAddress: address,
  });

  const value = cvToValue(result) as {
    eligible: boolean;
    "max-loan-amount": bigint;
    tier: string;
  };

  const scoreResult = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName: "credit-oracle",
    functionName: "get-score",
    functionArgs: [standardPrincipalCV(address)],
    network,
    senderAddress: address,
  });

  const score = Number(cvToValue(scoreResult));

  return {
    score,
    tier: value.tier,
    maxLoanAmount: Number(value["max-loan-amount"]),
    eligible: value.eligible,
  };
}
