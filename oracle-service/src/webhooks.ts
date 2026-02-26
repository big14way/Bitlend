// Chainhook V2 webhook handlers for monitoring on-chain events
import { Router, Request, Response } from "express";

const router = Router();

// Verify webhook authorization
function verifyWebhook(req: Request): boolean {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.WEBHOOK_SECRET;
  if (!expectedToken) return true; // Skip auth if not configured
  return authHeader === `Bearer ${expectedToken}`;
}

// Active loans tracking (in-memory for MVP, use DB in production)
const activeLoans = new Map<
  string,
  { borrower: string; dueBlock: number; installmentsPaid: number }
>();

// Webhook: new loan created
router.post("/loan-created", (req: Request, res: Response) => {
  if (!verifyWebhook(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = req.body;
    console.log("[Chainhook] Loan created event:", JSON.stringify(payload));

    // Extract loan data from Chainhook payload
    const transactions = payload?.apply?.[0]?.transactions || [];
    for (const tx of transactions) {
      if (tx.metadata?.success) {
        const borrower = tx.metadata?.sender;
        if (borrower) {
          activeLoans.set(borrower, {
            borrower,
            dueBlock: 0, // Will be updated from contract state
            installmentsPaid: 0,
          });
          console.log(`[Chainhook] Tracking new loan for ${borrower}`);
        }
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("[Chainhook] Error processing loan-created:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Webhook: block monitor for overdue payment detection
router.post("/block", (req: Request, res: Response) => {
  if (!verifyWebhook(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = req.body;
    const blockHeight =
      payload?.apply?.[0]?.block_identifier?.index || 0;

    console.log(`[Chainhook] New block: ${blockHeight}`);

    // Check active loans for overdue payments
    for (const [borrower, loan] of activeLoans) {
      if (loan.dueBlock > 0 && blockHeight > loan.dueBlock + 2016) {
        // 2 installments overdue (2016 blocks per period)
        console.log(
          `[Chainhook] OVERDUE: ${borrower} is 2+ installments behind at block ${blockHeight}`
        );
        // In production: call mark-default on-chain
        // For MVP: log the event
      }
    }

    res.json({ status: "ok", blockHeight });
  } catch (error) {
    console.error("[Chainhook] Error processing block:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as webhookRouter, activeLoans };
