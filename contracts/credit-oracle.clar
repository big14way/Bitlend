;; credit-oracle.clar
;; Receives score updates from off-chain underwriting engine.
;; Acts as the bridge between Reclaim zkTLS proofs and on-chain credit profiles.

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-SCORE-OUT-OF-RANGE (err u200))
(define-constant ERR-INELIGIBLE (err u201))

;; Constants
(define-constant CONTRACT-OWNER tx-sender)

;; Oracle address - the backend service that submits scores
(define-data-var oracle-address principal tx-sender)

;; Admin: set oracle address (call after deploy with backend wallet address)
(define-public (set-oracle-address (new-oracle principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set oracle-address new-oracle)
    (ok true)
  )
)

;; Submit a credit score for a user
;; If user has no profile, mints one first, then updates score
(define-public (submit-score (recipient principal) (score uint) (verified-sources uint))
  (begin
    (asserts! (is-eq tx-sender (var-get oracle-address)) ERR-NOT-AUTHORIZED)
    (asserts! (<= score u1000) ERR-SCORE-OUT-OF-RANGE)
    ;; Mint profile if it doesn't exist yet
    (if (not (contract-call? .credit-identity has-profile recipient))
      (begin
        (try! (contract-call? .credit-identity mint-profile recipient))
        (try! (contract-call? .credit-identity update-profile recipient score verified-sources))
        (ok true)
      )
      (begin
        (try! (contract-call? .credit-identity update-profile recipient score verified-sources))
        (ok true)
      )
    )
  )
)

;; Update outstanding debt - called by vault contract
(define-public (update-outstanding-debt (recipient principal) (new-debt uint))
  (begin
    (asserts! (is-eq contract-caller .loan-vault) ERR-NOT-AUTHORIZED)
    (try! (contract-call? .credit-identity update-debt recipient new-debt))
    (ok true)
  )
)

;; Read-only: get credit score
(define-read-only (get-score (address principal))
  (match (contract-call? .credit-identity get-profile address)
    profile (get credit-score profile)
    u0
  )
)

;; Read-only: check eligibility and return tier info
(define-read-only (check-eligibility (address principal))
  (let (
    (score (get-score address))
  )
    (if (>= score u850)
      { eligible: true, max-loan-amount: u5000000000, tier: "premium" }
      (if (>= score u700)
        { eligible: true, max-loan-amount: u2000000000, tier: "prime" }
        (if (>= score u550)
          { eligible: true, max-loan-amount: u500000000, tier: "standard" }
          (if (>= score u400)
            { eligible: true, max-loan-amount: u100000000, tier: "micro" }
            { eligible: false, max-loan-amount: u0, tier: "none" }
          )
        )
      )
    )
  )
)
