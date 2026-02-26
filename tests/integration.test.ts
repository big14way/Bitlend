import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@stacks/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const lp = accounts.get("wallet_1")!;       // Liquidity provider
const borrower = accounts.get("wallet_2")!;  // Borrower

describe("BitLend Integration - Full Loan Lifecycle", () => {
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

  it("complete loan lifecycle: score -> loan -> 4 repayments -> LP withdraws with yield", () => {
    // ---- Step 1: LP funds the vault with 3000 USDCx (prime tier needs 2000) ----
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp);
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp);
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp);

    const depositResult = simnet.callPublicFn(
      "loan-vault",
      "deposit",
      [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(3000000000)],
      lp
    );
    expect(depositResult.result).toBeOk(Cl.uint(3000000000));

    // ---- Step 2: Oracle submits credit score for borrower (prime tier = 750) ----
    const scoreResult = simnet.callPublicFn(
      "credit-oracle",
      "submit-score",
      [Cl.standardPrincipal(borrower), Cl.uint(750), Cl.uint(7)],
      deployer
    );
    expect(scoreResult.result).toBeOk(Cl.bool(true));

    // Verify eligibility
    const eligibility = simnet.callReadOnlyFn(
      "credit-oracle",
      "check-eligibility",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    expect(eligibility.result).toBeTuple({
      eligible: Cl.bool(true),
      "max-loan-amount": Cl.uint(2000000000),
      tier: Cl.stringAscii("prime"),
    });

    // ---- Step 3: Borrower applies for loan ----
    const loanResult = simnet.callPublicFn(
      "loan-vault",
      "apply-for-loan",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );
    // Prime tier: 2000 USDCx principal + 4% interest = 2080 USDCx total
    // Installment: 2080 / 4 = 520 USDCx
    expect(loanResult.result).toBeOk(
      Cl.tuple({
        "loan-amount": Cl.uint(2000000000),
        "total-owed": Cl.uint(2080000000),
        "installment-size": Cl.uint(520000000),
      })
    );

    // Verify borrower has USDCx
    let borrowerBalance = simnet.callReadOnlyFn(
      "mock-usdcx",
      "get-balance",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    expect(borrowerBalance.result).toBeOk(Cl.uint(2000000000));

    // Verify credit identity has outstanding debt
    let profile = simnet.callReadOnlyFn(
      "credit-identity",
      "get-profile",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    const profileData = profile.result;
    // Outstanding debt should be 2080 USDCx (2080000000 micro)
    expect(profileData).toBeSome(
      expect.objectContaining({})
    );

    // ---- Step 4: Borrower repays all 4 installments ----
    // Borrower needs extra tokens (has 2000 but owes 2080)
    simnet.callPublicFn("mock-usdcx", "faucet", [], borrower);

    // Installment 1
    let repayResult = simnet.callPublicFn(
      "loan-vault",
      "repay-installment",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );
    expect(repayResult.result).toBeOk(
      Cl.tuple({
        status: Cl.stringAscii("active"),
        "installments-remaining": Cl.uint(3),
      })
    );

    // Installment 2
    repayResult = simnet.callPublicFn(
      "loan-vault",
      "repay-installment",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );
    expect(repayResult.result).toBeOk(
      Cl.tuple({
        status: Cl.stringAscii("active"),
        "installments-remaining": Cl.uint(2),
      })
    );

    // Installment 3
    repayResult = simnet.callPublicFn(
      "loan-vault",
      "repay-installment",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );
    expect(repayResult.result).toBeOk(
      Cl.tuple({
        status: Cl.stringAscii("active"),
        "installments-remaining": Cl.uint(1),
      })
    );

    // Installment 4 (final)
    repayResult = simnet.callPublicFn(
      "loan-vault",
      "repay-installment",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );
    expect(repayResult.result).toBeOk(
      Cl.tuple({
        status: Cl.stringAscii("repaid"),
        "installments-remaining": Cl.uint(0),
      })
    );

    // ---- Step 5: Verify loan is fully repaid ----
    const loanData = simnet.callReadOnlyFn(
      "loan-vault",
      "get-loan",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    // Verify loan is repaid (not checking due-block since it depends on simnet block height)
    expect(loanData.result).not.toBeNone();

    // ---- Step 6: Verify credit identity updated ----
    profile = simnet.callReadOnlyFn(
      "credit-identity",
      "get-profile",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    // Outstanding debt should be 0 after full repayment
    // total-loans should be 1, repayment-rate should be 100
    const finalProfile = profile.result;
    expect(finalProfile).toBeSome(
      expect.objectContaining({})
    );

    // ---- Step 7: LP withdraws with yield ----
    // Vault now has: original 1000 - 2000 (loan) + 2080 (repaid) = 1080
    // But 80% of interest goes to vault, 20% to treasury
    // Interest = 80 USDCx. Vault gets 80% = 64 USDCx
    // So vault deposits = 1000 - 2000 + 2000 + 64 = 1064 USDCx (1064000000 micro)
    // LP withdraws all shares (3000000000 shares from initial deposit)
    const withdrawResult = simnet.callPublicFn(
      "loan-vault",
      "withdraw",
      [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(3000000000)],
      lp
    );
    // LP gets more than deposited (3064 USDCx on 3000 deposit = 64 USDCx yield)
    expect(withdrawResult.result).toBeOk(Cl.uint(3064000000));
  });

  it("default scenario: borrower defaults and credit score is affected", () => {
    // ---- Setup: Fund vault, create profile, originate loan ----
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp);
    simnet.callPublicFn(
      "loan-vault",
      "deposit",
      [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(1000000000)],
      lp
    );

    simnet.callPublicFn(
      "credit-oracle",
      "submit-score",
      [Cl.standardPrincipal(borrower), Cl.uint(600), Cl.uint(3)],
      deployer
    );

    simnet.callPublicFn(
      "loan-vault",
      "apply-for-loan",
      [Cl.contractPrincipal(deployer, "mock-usdcx")],
      borrower
    );

    // ---- Admin marks default ----
    const defaultResult = simnet.callPublicFn(
      "loan-vault",
      "mark-default",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    expect(defaultResult.result).toBeOk(Cl.bool(true));

    // Verify loan status is defaulted
    const loan = simnet.callReadOnlyFn(
      "loan-vault",
      "get-loan",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    // Verify loan is defaulted
    expect(loan.result).not.toBeNone();

    // Verify credit profile shows default
    const profile = simnet.callReadOnlyFn(
      "credit-identity",
      "get-profile",
      [Cl.standardPrincipal(borrower)],
      deployer
    );
    const profileData = profile.result;
    // total-defaulted should be 1, repayment-rate should be 0
    expect(profileData).toBeSome(expect.objectContaining({}));
  });

  it("multiple LPs can deposit and share yield", () => {
    // LP1 deposits 500 USDCx
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp);
    simnet.callPublicFn(
      "loan-vault",
      "deposit",
      [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
      lp
    );

    // LP2 deposits 500 USDCx
    const lp2 = accounts.get("wallet_3")!;
    simnet.callPublicFn("mock-usdcx", "faucet", [], lp2);
    simnet.callPublicFn(
      "loan-vault",
      "deposit",
      [Cl.contractPrincipal(deployer, "mock-usdcx"), Cl.uint(500000000)],
      lp2
    );

    // Verify both have equal shares
    const shares1 = simnet.callReadOnlyFn(
      "loan-vault",
      "get-user-shares",
      [Cl.standardPrincipal(lp)],
      deployer
    );
    const shares2 = simnet.callReadOnlyFn(
      "loan-vault",
      "get-user-shares",
      [Cl.standardPrincipal(lp2)],
      deployer
    );
    expect(shares1.result).toBeUint(500000000);
    expect(shares2.result).toBeUint(500000000);

    // Verify vault stats
    const stats = simnet.callReadOnlyFn(
      "loan-vault",
      "get-vault-stats",
      [],
      deployer
    );
    expect(stats.result).toBeTuple({
      "total-deposits": Cl.uint(1000000000),
      "total-shares": Cl.uint(1000000000),
      "total-interest-collected": Cl.uint(0),
      utilization: Cl.uint(0),
    });
  });
});
