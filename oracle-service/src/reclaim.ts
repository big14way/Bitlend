// Reclaim Protocol v4.x integration for zkTLS proof verification
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { CreditSignals } from "./scoring.js";

// Provider IDs (configure in .env)
const MPESA_PROVIDER_ID = process.env.MPESA_PROVIDER_ID || "";
const BVN_PROVIDER_ID = process.env.BVN_PROVIDER_ID || "";

interface VerificationSession {
  sessionId: string;
  requestUrls: Record<string, string>;
  statusUrls: Record<string, string>;
}

// Initialize a verification session with requested proof types
export async function startVerification(
  providerIds: string[]
): Promise<VerificationSession> {
  const appId = process.env.RECLAIM_APP_ID;
  const appSecret = process.env.RECLAIM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("RECLAIM_APP_ID and RECLAIM_APP_SECRET must be set");
  }

  const requestUrls: Record<string, string> = {};
  const statusUrls: Record<string, string> = {};

  for (const providerId of providerIds) {
    const proofRequest = await ReclaimProofRequest.init(
      appId,
      appSecret,
      providerId
    );

    const requestUrl = await proofRequest.getRequestUrl();
    const statusUrl = proofRequest.getStatusUrl();

    requestUrls[providerId] = requestUrl;
    statusUrls[providerId] = statusUrl;
  }

  const sessionId = crypto.randomUUID();

  return { sessionId, requestUrls, statusUrls };
}

// Extract credit signals from verified Reclaim proofs
export function extractSignals(proofs: any[]): {
  signals: CreditSignals;
  sources: string[];
} {
  const signals: CreditSignals = {};
  const sources: string[] = [];

  for (const proof of proofs) {
    try {
      const context = JSON.parse(proof.claimData?.context || "{}");
      const providerId = proof.claimData?.provider || "";

      // Mpesa income proof
      if (
        providerId.includes("mpesa") ||
        context.extractedParameters?.provider === "mpesa"
      ) {
        const income = parseFloat(
          context.extractedParameters?.monthlyIncome ||
            context.extractedParameters?.amount ||
            "0"
        );
        signals.mpesaIncome = income;
        sources.push("mpesa");
      }

      // BVN/NIN verification proof
      if (
        providerId.includes("bvn") ||
        providerId.includes("nin") ||
        context.extractedParameters?.provider === "bvn"
      ) {
        signals.bvnVerified = true;
        sources.push("bvn");
      }

      // Bank balance proof
      if (
        providerId.includes("bank") ||
        context.extractedParameters?.provider === "bank"
      ) {
        const balance = parseFloat(
          context.extractedParameters?.balance || "0"
        );
        signals.bankBalance = balance;
        sources.push("bank");
      }
    } catch (e) {
      console.error("Failed to parse proof:", e);
    }
  }

  return { signals, sources };
}
