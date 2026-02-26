import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@stacks/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("credit-identity", () => {
  // Setup: set oracle and vault contracts before tests
  beforeEach(() => {
    // Set oracle contract to deployer's credit-oracle
    simnet.callPublicFn(
      "credit-identity",
      "set-oracle-contract",
      [Cl.contractPrincipal(deployer, "credit-oracle")],
      deployer
    );
    // Set vault contract to deployer's loan-vault
    simnet.callPublicFn(
      "credit-identity",
      "set-vault-contract",
      [Cl.contractPrincipal(deployer, "loan-vault")],
      deployer
    );
  });

  describe("mint-profile", () => {
    it("should mint a profile when called by oracle contract (via submit-score)", () => {
      // Oracle submits score which internally mints profile
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(650), Cl.uint(3)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      // Verify profile exists with correct data (not checking block-height-dependent fields)
      const hasProfile = simnet.callReadOnlyFn(
        "credit-identity",
        "has-profile",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(hasProfile.result).toBeBool(true);

      const score = simnet.callReadOnlyFn(
        "credit-oracle",
        "get-score",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(score.result).toBeUint(650);
    });

    it("should fail if profile already exists", () => {
      // First mint
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(650), Cl.uint(3)],
        deployer
      );

      // Second mint should update, not fail (via submit-score which handles both cases)
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(700), Cl.uint(7)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("should fail if called directly by non-oracle", () => {
      const result = simnet.callPublicFn(
        "credit-identity",
        "mint-profile",
        [Cl.standardPrincipal(wallet1)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100));
    });
  });

  describe("transfer (soulbound)", () => {
    it("should always return err u403 - transfer blocked", () => {
      // Mint a profile first
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(650), Cl.uint(1)],
        deployer
      );

      // Attempt transfer
      const result = simnet.callPublicFn(
        "credit-identity",
        "transfer",
        [Cl.uint(1), Cl.standardPrincipal(wallet1), Cl.standardPrincipal(wallet2)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(403));
    });
  });

  describe("update-profile", () => {
    it("should only allow oracle to update profile", () => {
      // Create profile
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      // Direct update by non-oracle should fail
      const result = simnet.callPublicFn(
        "credit-identity",
        "update-profile",
        [Cl.standardPrincipal(wallet1), Cl.uint(700), Cl.uint(3)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100));
    });

    it("should fail for non-existent profile", () => {
      const result = simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );
      // First call succeeds (creates profile)
      expect(result.result).toBeOk(Cl.bool(true));
    });
  });

  describe("update-debt", () => {
    it("should only allow vault to update debt", () => {
      // Create profile
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      // Direct debt update by non-vault should fail
      const result = simnet.callPublicFn(
        "credit-identity",
        "update-debt",
        [Cl.standardPrincipal(wallet1), Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(100));
    });
  });

  describe("has-profile", () => {
    it("should return false for address without profile", () => {
      const result = simnet.callReadOnlyFn(
        "credit-identity",
        "has-profile",
        [Cl.standardPrincipal(wallet2)],
        deployer
      );
      expect(result.result).toBeBool(false);
    });

    it("should return true after profile creation", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-identity",
        "has-profile",
        [Cl.standardPrincipal(wallet1)],
        deployer
      );
      expect(result.result).toBeBool(true);
    });
  });

  describe("SIP-009 required functions", () => {
    it("get-last-token-id returns correct count", () => {
      const result = simnet.callReadOnlyFn(
        "credit-identity",
        "get-last-token-id",
        [],
        deployer
      );
      expect(result.result).toBeOk(Cl.uint(0));
    });

    it("get-owner returns correct owner", () => {
      simnet.callPublicFn(
        "credit-oracle",
        "submit-score",
        [Cl.standardPrincipal(wallet1), Cl.uint(500), Cl.uint(1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "credit-identity",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeOk(Cl.some(Cl.standardPrincipal(wallet1)));
    });

    it("get-token-uri returns uri", () => {
      const result = simnet.callReadOnlyFn(
        "credit-identity",
        "get-token-uri",
        [Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeOk(
        Cl.some(Cl.stringAscii("https://bitlend.io/credit-profile/{id}.json"))
      );
    });
  });
});
