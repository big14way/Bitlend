import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@stacks/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("credit-oracle", () => {
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

  describe("set-oracle-address", () => {
    it("should allow contract owner to set oracle address", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "set-oracle-address",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should reject non-owner setting oracle address", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "set-oracle-address",
        [Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100));
    });
  });

  describe("submit-score", () => {
    it("should create profile and set score for new user", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(750), Cl.uint(5)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify score
      const score = simnet.callReadOnlyFn(
        "credit-oracle",
        "get-score",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(score.result).toBeUint(750);
    });

    it("should update score for existing user", () => {
      // First submission
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      // Update
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(750), Cl.uint(7)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      const score = simnet.callReadOnlyFn(
        "credit-oracle",
        "get-score",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(score.result).toBeUint(750);
    });

    it("should reject score > 1000", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(1001), Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeErr(Cl.uint(200));
    });

    it("should reject non-oracle caller", () => {
      // Set a specific oracle address
      simnet.callPublicFn(
        "credit-oracle",
        "set-oracle-address",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );

      // wallet1 should not be able to submit
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100));
    });

    it("should accept score of exactly 1000", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(1000), Cl.uint(15)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should accept score of 0", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(0), Cl.uint(0)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("check-eligibility", () => {
    it("should return ineligible for score < 400", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(399), Cl.uint(1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(false),
        "max-loan-amount": Cl.uint(0),
        tier: Cl.stringAscii("none"),
      });
    });

    it("should return micro tier for score 400-549", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(400), Cl.uint(1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(true),
        "max-loan-amount": Cl.uint(100000000),
        tier: Cl.stringAscii("micro"),
      });
    });

    it("should return standard tier for score 550-699", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(600), Cl.uint(3)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(true),
        "max-loan-amount": Cl.uint(500000000),
        tier: Cl.stringAscii("standard"),
      });
    });

    it("should return prime tier for score 700-849", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(750), Cl.uint(7)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(true),
        "max-loan-amount": Cl.uint(2000000000),
        tier: Cl.stringAscii("prime"),
      });
    });

    it("should return premium tier for score 850+", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(900), Cl.uint(15)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(true),
        "max-loan-amount": Cl.uint(5000000000),
        tier: Cl.stringAscii("premium"),
      });
    });

    it("should return ineligible for address without profile", () => {
      const result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(false),
        "max-loan-amount": Cl.uint(0),
        tier: Cl.stringAscii("none"),
      });
    });

    it("boundary: score 399 is declined, 400 is eligible", () => {
      // 399 - declined
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(399), Cl.uint(1)],
        deployer
      );
      let result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(false),
        "max-loan-amount": Cl.uint(0),
        tier: Cl.stringAscii("none"),
      });

      // 400 - eligible
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet2), Cl.uint(400), Cl.uint(1)],
        deployer
      );
      result = simnet.callReadOnlyFn(
        "credit-oracle",
        "check-eligibility",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      expect(result.result).toBeTuple({
        eligible: Cl.bool(true),
        "max-loan-amount": Cl.uint(100000000),
        tier: Cl.stringAscii("micro"),
      });
    });
  });
});
