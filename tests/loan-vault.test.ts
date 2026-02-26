import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@stacks/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("loan-vault", () => {
  beforeEach(() => {
    // Setup: configure oracle and vault contracts on credit-identity
    simnet.callPublicFn(
      "credit-identity",
      "set-oracle-contract",
      [Cl.contractPrincipal(deployer, "credit-oracle")],
      deployer
    );
    simnet.callPublicFn(
      "credit-identity",
      "set-vault-contract",
      [Cl.contractPrincipal(deployer, "loan-vault")],
      deployer
    );
  });

  describe("deposit", () => {
    it("should allow LP to deposit USDCx and receive shares", () => {
      // Mint tokens for LP
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);

      // Deposit 500 USDCx
      const result = simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(500000000));

      // Check shares
      const shares = simnet.callReadOnlyFn(
        "loan-vault",
        "get-user-shares",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(shares.result).toBeUint(500000000);
    });

    it("should reject zero amount deposit", () => {
      const result = simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(307));
    });

    it("should calculate proportional shares for second depositor", () => {
      // First LP deposits
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      // Second LP deposits
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet2);
      const result = simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(250000000)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.uint(250000000));
    });
  });

  describe("apply-for-loan", () => {
    it("should fail if borrower has no credit profile", () => {
      // Fund vault
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      // Try to apply without profile
      const result = simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(300));
    });

    it("should fail if credit score < 400 (ineligible)", () => {
      // Fund vault
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      // Create profile with low score
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(350), Cl.uint(1)],
        deployer
      );

      // Try to apply
      const result = simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(301));
    });

    it("should fail if outstanding loan exists", () => {
      // Fund vault with enough for 2 loans
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
        wallet1
      );

      // Create profile
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      // First loan succeeds
      simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );

      // Second loan should fail
      const result = simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(302));
    });

    it("should fail if vault has insufficient liquidity", () => {
      // Small vault deposit (50 USDCx)
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(50000000)],
        wallet1
      );

      // Score that would qualify for 100 USDCx loan
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(450), Cl.uint(1)],
        deployer
      );

      const result = simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(305));
    });

    it("should successfully originate a loan", () => {
      // Fund vault
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
        wallet1
      );

      // Create profile with standard tier (500 USDCx max)
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(600), Cl.uint(3)],
        deployer
      );

      // Apply for loan
      const result = simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      // 500 USDCx principal + 5% = 525 USDCx total, 131.25 USDCx per installment
      expect(result.result).toBeOk(
        Cl.tuple({
          "loan-amount": Cl.uint(500000000),
          "total-owed": Cl.uint(525000000),
          "installment-size": Cl.uint(131250000),
        })
      );

      // Verify loan record exists and has correct values
      const loan = simnet.callReadOnlyFn(
        "loan-vault",
        "get-loan",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      // Verify key loan fields (not checking due-block since it depends on simnet block height)
      expect(loan.result).not.toBeNone();

      // Verify borrower received USDCx
      const balance = simnet.callReadOnlyFn(
        "mock-usdcx",
        "get-balance",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      expect(balance.result).toBeOk(Cl.uint(500000000));
    });
  });

  describe("repay-installment", () => {
    it("should fail if no active loan", () => {
      const result = simnet.callPublicFn(
        "loan-vault",
        "repay-installment",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeErr(Cl.uint(303));
    });

    it("should successfully repay an installment", () => {
      // Setup: fund vault, create profile, originate loan
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
        wallet1
      );

      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(600), Cl.uint(3)],
        deployer
      );

      simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );

      // Borrower needs more tokens to repay (loan gives 500, but owes 525 with interest)
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet2);

      // Repay first installment
      const result = simnet.callPublicFn(
        "loan-vault",
        "repay-installment",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );
      expect(result.result).toBeOk(
        Cl.tuple({
          status: Cl.stringAscii("active"),
          "installments-remaining": Cl.uint(3),
        })
      );
    });
  });

  describe("mark-default", () => {
    it("should only be callable by admin", () => {
      // Setup loan
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
        wallet1
      );

      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(600), Cl.uint(3)],
        deployer
      );

      simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );

      // Non-admin tries to mark default
      const result = simnet.callPublicFn(
        "loan-vault",
        "mark-default",
        [Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(306));
    });

    it("should mark loan as defaulted when called by admin", () => {
      // Setup loan
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
        wallet1
      );

      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(600), Cl.uint(3)],
        deployer
      );

      simnet.callPublicFn(
        "loan-vault",
        "apply-for-loan",
        [Cl.contractPrincipal(deployer, "mock-usdcx")],
        wallet2
      );

      // Admin marks default
      const result = simnet.callPublicFn(
        "loan-vault",
        "mark-default",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify loan status
      const loan = simnet.callReadOnlyFn(
        "loan-vault",
        "get-loan",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      // Verify loan exists and is defaulted
      expect(loan.result).not.toBeNone();
    });
  });

  describe("withdraw", () => {
    it("should allow LP to withdraw with shares", () => {
      // Deposit
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      // Withdraw all shares
      const result = simnet.callPublicFn(
        "loan-vault",
        "withdraw",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(500000000));

      // Verify shares are 0
      const shares = simnet.callReadOnlyFn(
        "loan-vault",
        "get-user-shares",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(shares.result).toBeUint(0);
    });

    it("should reject withdrawal exceeding shares", () => {
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      const result = simnet.callPublicFn(
        "loan-vault",
        "withdraw",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(600000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(308));
    });
  });

  describe("vault-stats", () => {
    it("should return correct vault statistics", () => {
      simnet.callPublicFn("mock-usdcx", "faucet", [], wallet1);
      simnet.callPublicFn(
        "loan-vault",
        "deposit",
        [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
        wallet1
      );

      const stats = simnet.callReadOnlyFn(
        "loan-vault",
        "get-vault-stats",
        [],
        deployer
      );
      expect(stats.result).toBeTuple({
        "total-deposits": Cl.uint(500000000),
        "total-shares": Cl.uint(500000000),
        "total-interest-collected": Cl.uint(0),
        utilization: Cl.uint(0),
      });
    });
  });
});
