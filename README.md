# BitLend - Bitcoin-Native Credit Protocol

**The first uncollateralized BNPL and credit layer on Bitcoin, powered by zkTLS underwriting, with credit history permanently settled on Bitcoin L1 through Stacks.**

Every loan origination, repayment, and default in BitLend is recorded on the Stacks blockchain and finalized on Bitcoin L1 - creating the most permanent, trust-minimized credit history possible. Unlike collateralized protocols like Zest or Granite, BitLend enables the 1.4B unbanked globally to access DeFi credit using their existing financial histories (Mpesa, mobile money, bank accounts, government IDs) without requiring BTC collateral.

## Why Stacks / Why This Can Only Exist on Bitcoin

- **Bitcoin-settled credit history**: Every loan and repayment is finalized on Bitcoin L1 via Proof of Transfer - the most permanent ledger on earth
- **Clarity's decidability**: Lenders can audit exact contract behavior before depositing. No bytecode surprises, no reentrancy, no oracle manipulation
- **sBTC integration path**: Borrowers with BTC holdings get higher credit tiers by soft-pledging sBTC balance (future milestone)
- **USDCx on Bitcoin rails**: Loans denominated in Circle's native USDC on Stacks via xReserve - real dollar liquidity without leaving the Bitcoin ecosystem

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Bitcoin L1 (Finality)       │
                    └───────────────┬─────────────────────┘
                                    │ PoT Settlement
                    ┌───────────────┴─────────────────────┐
                    │         Stacks L2 Blockchain         │
                    │                                       │
                    │  ┌──────────────┐ ┌───────────────┐  │
                    │  │credit-identity│ │ credit-oracle │  │
                    │  │  (SIP-009)   │ │  (scoring)    │  │
                    │  │  Soulbound   │ │               │  │
                    │  └──────┬───────┘ └───────┬───────┘  │
                    │         │                 │           │
                    │  ┌──────┴─────────────────┴───────┐  │
                    │  │         loan-vault              │  │
                    │  │  (LP deposits, loans, repay)   │  │
                    │  └──────────────┬─────────────────┘  │
                    │                 │                     │
                    │  ┌──────────────┴─────────────────┐  │
                    │  │     mock-usdcx (SIP-010)       │  │
                    │  │  (testnet) / USDCx (mainnet)   │  │
                    │  └────────────────────────────────┘  │
                    └──────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────┴──────┐   ┌─────────┴──────┐   ┌──────────┴─────┐
    │  Oracle Service │   │   Frontend     │   │  Chainhooks V2 │
    │  (Node.js)     │   │  (Next.js)     │   │  (Webhooks)    │
    │                │   │                │   │                │
    │ Reclaim zkTLS  │   │ @stacks/connect│   │ Block monitor  │
    │ Score compute  │   │ v8 API         │   │ Loan tracking  │
    │ TX broadcast   │   │ Post-conditions│   │ Default detect │
    └────────────────┘   └────────────────┘   └────────────────┘
```

## Testnet Deployment

All contracts are live on Stacks testnet (Clarity 4, epoch 3.3), deployed under [`ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS`](https://explorer.hiro.so/address/ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS?chain=testnet):

| Contract | Testnet Address | Explorer |
|---|---|---|
| `credit-identity` | `ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS.credit-identity` | [View](https://explorer.hiro.so/txid/4f9779ab4cb8d8a3d28a5fda60922e4181920547a0ac615dc3872cd7e09864da?chain=testnet) |
| `credit-oracle` | `ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS.credit-oracle` | [View](https://explorer.hiro.so/txid/1a3ef0349495de4c82436b9c3380dd3690274e68c6a71a6214512f9a8c131366?chain=testnet) |
| `loan-vault` | `ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS.loan-vault` | [View](https://explorer.hiro.so/txid/291b44c3876c34957ff7a16e35483e12563ac65f055aacb3717e04505aaa6437?chain=testnet) |
| `mock-usdcx` | `ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS.mock-usdcx` | [View](https://explorer.hiro.so/txid/873168faaec39e4a9a34f7e500b50d805cc121a942563721f20221daac1b1f6f?chain=testnet) |

## Smart Contracts

| Contract | Description | Key Functions |
|---|---|---|
| `credit-identity.clar` | SIP-009 soulbound NFT credit profile | `mint-profile`, `update-profile`, `update-debt` |
| `credit-oracle.clar` | Bridge between off-chain proofs and on-chain scores | `submit-score`, `check-eligibility` |
| `loan-vault.clar` | LP vault, loan origination, repayments | `deposit`, `withdraw`, `apply-for-loan`, `repay-installment` |
| `mock-usdcx.clar` | SIP-010 test token (testnet only) | `faucet`, `transfer` |

### Credit Score Tiers

| Tier | Score Range | Max Loan | Interest Rate |
|---|---|---|---|
| Premium | 850-1000 | 5,000 USDCx | 4% flat |
| Prime | 700-849 | 2,000 USDCx | 4% flat |
| Standard | 550-699 | 500 USDCx | 5% flat |
| Micro | 400-549 | 100 USDCx | 5% flat |
| Ineligible | 0-399 | - | - |

### Loan Terms
- 4 equal installments, each due every 2,016 blocks (~2 weeks)
- Interest split: 80% to vault depositors, 20% to protocol treasury
- Full repayment improves on-chain credit score
- Default is recorded permanently on Bitcoin via Stacks

## Project Structure

```
Bitlend/
├── contracts/                    # Clarinet project (Clarity smart contracts)
│   ├── credit-identity.clar     # Soulbound credit NFT
│   ├── credit-oracle.clar       # Score oracle
│   ├── loan-vault.clar          # Lending vault
│   └── mock-usdcx.clar          # Test token
├── tests/                        # Clarinet SDK TypeScript tests
│   ├── credit-identity.test.ts
│   ├── credit-oracle.test.ts
│   ├── loan-vault.test.ts
│   └── integration.test.ts      # Full loan lifecycle test
├── oracle-service/               # Node.js underwriting backend
│   └── src/
│       ├── index.ts              # Express API server
│       ├── scoring.ts            # Credit scoring algorithm
│       ├── reclaim.ts            # Reclaim Protocol zkTLS integration
│       ├── stacks.ts             # Stacks TX broadcast
│       └── webhooks.ts           # Chainhook V2 handlers
├── frontend/                     # Next.js 16 app
│   └── src/
│       ├── app/                  # Pages (home, profile, verify, apply, repay, vault)
│       └── lib/                  # Stacks connect v8 helpers, API client
├── Clarinet.toml
└── README.md
```

## Quick Start

### Prerequisites
- [Clarinet](https://docs.hiro.so/clarinet/getting-started) v3.x+
- Node.js 18+
- A Stacks wallet (Leather or Xverse)

### 1. Run Smart Contract Tests

```bash
# From project root
npm install
clarinet check          # Verify all contracts compile
clarinet test           # Run all 46 tests
```

### 2. Start Oracle Service

```bash
cd oracle-service
npm install
cp .env.example .env    # Edit with your keys
npm run dev
```

### 3. Start Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Edit with contract address
npm run dev
```

### 4. Use Mock USDCx (Testnet)

The `mock-usdcx.clar` contract provides a faucet for testing:
- Visit the Vault page and click "Get Test USDCx"
- Each faucet call mints 1,000 USDCx to your wallet

For real USDCx on testnet, bridge USDC from Ethereum Sepolia via [xReserve](https://docs.stacks.co/more-guides/bridging-usdcx).

## Test Results

All 46 tests passing across 5 test files:

```
 ✓ tests/integration.test.ts (3 tests)
 ✓ tests/loan-vault.test.ts (15 tests)
 ✓ tests/credit-oracle.test.ts (15 tests)
 ✓ tests/credit-identity.test.ts (12 tests)
 ✓ tests/mock-usdcx.test.ts (1 test)

 Test Files  5 passed (5)
      Tests  46 passed (46)
```

### Test Coverage
- **credit-identity**: Minting, soulbound transfer blocking, oracle-only updates, vault-only debt updates, SIP-009 compliance
- **credit-oracle**: Score submission, tier eligibility boundaries (399=declined, 400=eligible), authorization checks
- **loan-vault**: LP deposits/withdrawals, loan origination with eligibility checks, repayment with interest distribution, default handling
- **integration**: Full loan lifecycle (score → loan → 4 repayments → LP withdraws with yield), default scenario, multi-LP deposits

## Scoring Algorithm

Credit scores (0-1000) are computed from zkTLS-verified signals via Reclaim Protocol:

| Signal | Weight | Source |
|---|---|---|
| On-chain repayment history | 250 | Stacks blockchain |
| Mpesa income regularity | 200 | zkTLS proof |
| Bank balance stability | 180 | zkTLS proof |
| BVN/NIN government ID | 120 | zkTLS proof |
| Wallet age on-chain | 100 | Stacks blockchain |

## Technology Stack

| Component | Technology |
|---|---|
| Smart Contracts | Clarity (Stacks L2, Bitcoin finality) |
| Token Standard | SIP-010 (USDCx) |
| NFT Standard | SIP-009 (Soulbound credit profile) |
| Testing | Clarinet SDK + Vitest |
| Off-chain Oracle | Node.js + Express + TypeScript |
| Identity Verification | Reclaim Protocol SDK v4.x (zkTLS) |
| Event Monitoring | Chainhooks V2 (Hiro Platform) |
| Frontend | Next.js 16 + @stacks/connect v8 |
| Deployment | Stacks Testnet → Mainnet |

## Grant Milestones

### Milestone 1 (Week 2)
- [x] All 4 contracts deployed to testnet (`ST2Q9M3TPDVB37VN1BW68SHARPF77Q4ZJ4XVZZBXS`) - Clarity 4
- [x] `clarinet test` passing 100% (46/46 tests)

### Milestone 2 (Week 4)
- [ ] Oracle service live with Reclaim proof flow
- [ ] First testnet loan originated end-to-end

### Milestone 3 (Week 6)
- [ ] Frontend deployed on Vercel
- [ ] Demo video: full loan cycle (connect → verify → borrow → repay)

## Future Roadmap

- **sBTC Credit Enhancement**: Soft-pledge sBTC balance to boost credit tier (no custody transfer)
- **Cross-chain Credit Portability**: Export Bitcoin-settled credit scores to other chains
- **Institutional LP Pools**: Segregated vaults with different risk/return profiles
- **Governance**: Protocol governance via credit profile NFT holders

## License

MIT
