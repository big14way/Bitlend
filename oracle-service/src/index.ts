import "dotenv/config";
import express from "express";
import cors from "cors";
import { computeScore, sourcesToBitmask, type CreditSignals } from "./scoring.js";
import { submitScoreOnChain, getScoreOnChain } from "./stacks.js";
import { startVerification, extractSignals } from "./reclaim.js";
import { webhookRouter } from "./webhooks.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bitlend-oracle" });
});

// Start a Reclaim verification session
app.post("/api/start-verification", async (req, res) => {
  try {
    const { stacksAddress, providerIds } = req.body;

    if (!stacksAddress || !providerIds?.length) {
      res.status(400).json({ error: "stacksAddress and providerIds required" });
      return;
    }

    const session = await startVerification(providerIds);
    res.json({
      sessionId: session.sessionId,
      requestUrls: session.requestUrls,
      statusUrls: session.statusUrls,
    });
  } catch (error: any) {
    console.error("Error starting verification:", error);
    res.status(500).json({ error: error.message });
  }
});

// Submit verified proofs and compute + broadcast score
app.post("/api/submit-proof", async (req, res) => {
  try {
    const { stacksAddress, proofs } = req.body;

    if (!stacksAddress || !proofs?.length) {
      res.status(400).json({ error: "stacksAddress and proofs required" });
      return;
    }

    // Extract credit signals from proofs
    const { signals, sources } = extractSignals(proofs);

    // Compute credit score
    const scoreResult = computeScore(signals);
    const bitmask = sourcesToBitmask(sources);

    // Submit score on-chain
    let txid = "";
    try {
      txid = await submitScoreOnChain(stacksAddress, scoreResult.score, bitmask);
    } catch (chainError: any) {
      console.error("On-chain submission failed:", chainError);
      // Return score even if on-chain fails (for demo purposes)
    }

    res.json({
      score: scoreResult.score,
      tier: scoreResult.tier,
      maxLoanAmount: scoreResult.maxLoanAmount,
      eligible: scoreResult.eligible,
      breakdown: scoreResult.breakdown,
      verifiedSources: bitmask,
      txid,
    });
  } catch (error: any) {
    console.error("Error submitting proof:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check existing on-chain score
app.get("/api/check-score/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const result = await getScoreOnChain(address);
    res.json(result);
  } catch (error: any) {
    console.error("Error checking score:", error);
    res.status(500).json({ error: error.message });
  }
});

// Demo endpoint: submit a score directly (for testing without Reclaim)
app.post("/api/demo/submit-score", async (req, res) => {
  try {
    const { stacksAddress, signals } = req.body as {
      stacksAddress: string;
      signals: CreditSignals;
    };

    if (!stacksAddress) {
      res.status(400).json({ error: "stacksAddress required" });
      return;
    }

    const scoreResult = computeScore(signals || {});
    const sources: string[] = [];
    if (signals?.mpesaIncome) sources.push("mpesa");
    if (signals?.bvnVerified) sources.push("bvn");
    if (signals?.bankBalance) sources.push("bank");
    if (signals?.walletAge) sources.push("wallet");
    const bitmask = sourcesToBitmask(sources);

    let txid = "";
    try {
      txid = await submitScoreOnChain(stacksAddress, scoreResult.score, bitmask);
    } catch (chainError: any) {
      console.error("On-chain submission failed:", chainError);
    }

    res.json({
      score: scoreResult.score,
      tier: scoreResult.tier,
      maxLoanAmount: scoreResult.maxLoanAmount,
      eligible: scoreResult.eligible,
      breakdown: scoreResult.breakdown,
      txid,
    });
  } catch (error: any) {
    console.error("Error in demo submit:", error);
    res.status(500).json({ error: error.message });
  }
});

// Chainhook webhook routes
app.use("/webhooks", webhookRouter);

app.listen(PORT, () => {
  console.log(`BitLend Oracle Service running on port ${PORT}`);
  console.log(`Network: ${process.env.STACKS_NETWORK || "testnet"}`);
});
