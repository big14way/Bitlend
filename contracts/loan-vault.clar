;; loan-vault.clar
;; Lending vault for the BitLend protocol.
;; Manages LP deposits, loan origination, repayments, and defaults.

(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NO-PROFILE (err u300))
(define-constant ERR-INELIGIBLE (err u301))
(define-constant ERR-LOAN-EXISTS (err u302))
(define-constant ERR-NO-LOAN (err u303))
(define-constant ERR-LOAN-REPAID (err u304))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u305))
(define-constant ERR-NOT-ADMIN (err u306))
(define-constant ERR-ZERO-AMOUNT (err u307))
(define-constant ERR-INSUFFICIENT-SHARES (err u308))

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant INSTALLMENTS u4)
(define-constant BLOCKS-PER-PERIOD u2016)

;; Data vars
(define-data-var total-shares uint u0)
(define-data-var total-deposits uint u0)
(define-data-var treasury-address principal tx-sender)
(define-data-var total-interest-collected uint u0)

;; LP shares tracking
(define-map lp-shares principal uint)

;; Active loans
(define-map loans principal {
  principal-amount: uint,
  interest-amount: uint,
  total-owed: uint,
  amount-repaid: uint,
  installments-total: uint,
  installments-paid: uint,
  installment-size: uint,
  due-block: uint,
  status: (string-ascii 10)
})

;; Admin: set treasury address
(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-ADMIN)
    (var-set treasury-address new-treasury)
    (ok true)
  )
)

;; ---- LP Functions ----

;; LP deposits USDCx into the vault, receives proportional shares
(define-public (deposit (token <ft-trait>) (amount uint))
  (let (
    (current-shares (var-get total-shares))
    (current-deposits (var-get total-deposits))
    (new-shares (if (is-eq current-shares u0)
      amount
      (/ (* amount current-shares) current-deposits)
    ))
    (user-existing-shares (default-to u0 (map-get? lp-shares tx-sender)))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    ;; Transfer USDCx from user to this contract
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    ;; Update state
    (var-set total-shares (+ current-shares new-shares))
    (var-set total-deposits (+ current-deposits amount))
    (map-set lp-shares tx-sender (+ user-existing-shares new-shares))
    (ok new-shares)
  )
)

;; LP withdraws by burning shares, receives proportional USDCx + yield
(define-public (withdraw (token <ft-trait>) (shares uint))
  (let (
    (caller tx-sender)
    (user-shares (default-to u0 (map-get? lp-shares caller)))
    (current-shares (var-get total-shares))
    (current-deposits (var-get total-deposits))
    (withdraw-amount (/ (* shares current-deposits) current-shares))
  )
    (asserts! (> shares u0) ERR-ZERO-AMOUNT)
    (asserts! (<= shares user-shares) ERR-INSUFFICIENT-SHARES)
    (asserts! (<= withdraw-amount current-deposits) ERR-INSUFFICIENT-LIQUIDITY)
    ;; Transfer USDCx from contract to user
    (try! (as-contract (contract-call? token transfer withdraw-amount tx-sender caller none)))
    ;; Update state
    (var-set total-shares (- current-shares shares))
    (var-set total-deposits (- current-deposits withdraw-amount))
    (map-set lp-shares caller (- user-shares shares))
    (ok withdraw-amount)
  )
)

;; ---- Loan Functions ----

;; Calculate interest rate based on tier
(define-private (get-interest-rate (tier (string-ascii 10)))
  (if (or (is-eq tier "prime") (is-eq tier "premium"))
    u4
    u5
  )
)

;; Apply for a loan - checks eligibility via credit-oracle
(define-public (apply-for-loan (token <ft-trait>))
  (let (
    (caller tx-sender)
    (eligibility (contract-call? .credit-oracle check-eligibility caller))
    (eligible (get eligible eligibility))
    (max-amount (get max-loan-amount eligibility))
    (tier (get tier eligibility))
    (interest-rate (get-interest-rate tier))
    (interest-amount (/ (* max-amount interest-rate) u100))
    (total-owed (+ max-amount interest-amount))
    (installment-size (/ total-owed INSTALLMENTS))
    (current-deposits (var-get total-deposits))
  )
    ;; Check borrower has a profile
    (asserts! (contract-call? .credit-identity has-profile caller) ERR-NO-PROFILE)
    ;; Check eligibility
    (asserts! eligible ERR-INELIGIBLE)
    ;; Check no existing active loan
    (asserts! (is-none (get-active-loan caller)) ERR-LOAN-EXISTS)
    ;; Check vault has enough liquidity
    (asserts! (>= current-deposits max-amount) ERR-INSUFFICIENT-LIQUIDITY)
    ;; Transfer USDCx from vault to borrower
    (try! (as-contract (contract-call? token transfer max-amount tx-sender caller none)))
    ;; Update vault deposits
    (var-set total-deposits (- current-deposits max-amount))
    ;; Create loan record
    (map-set loans caller {
      principal-amount: max-amount,
      interest-amount: interest-amount,
      total-owed: total-owed,
      amount-repaid: u0,
      installments-total: INSTALLMENTS,
      installments-paid: u0,
      installment-size: installment-size,
      due-block: (+ block-height BLOCKS-PER-PERIOD),
      status: "active"
    })
    ;; Update credit identity with outstanding debt and record loan
    (try! (contract-call? .credit-identity update-debt caller total-owed))
    (try! (contract-call? .credit-identity record-loan caller))
    (ok { loan-amount: max-amount, total-owed: total-owed, installment-size: installment-size })
  )
)

;; Repay one installment
(define-public (repay-installment (token <ft-trait>))
  (let (
    (caller tx-sender)
    (loan (unwrap! (map-get? loans caller) ERR-NO-LOAN))
    (status (get status loan))
    (installment (get installment-size loan))
    (paid (get installments-paid loan))
    (total-installments (get installments-total loan))
    (amount-repaid (get amount-repaid loan))
    (total-owed (get total-owed loan))
    (principal-amount (get principal-amount loan))
    (new-paid (+ paid u1))
    (new-amount-repaid (+ amount-repaid installment))
    ;; Interest portion of this installment
    (interest-per-installment (/ (get interest-amount loan) INSTALLMENTS))
    (principal-per-installment (- installment interest-per-installment))
    ;; Interest split: 80% to vault, 20% to treasury
    (vault-interest (/ (* interest-per-installment u80) u100))
    (treasury-interest (- interest-per-installment vault-interest))
  )
    (asserts! (is-eq status "active") ERR-LOAN-REPAID)
    (asserts! (< paid total-installments) ERR-LOAN-REPAID)
    ;; Transfer installment from borrower to contract
    (try! (contract-call? token transfer installment caller (as-contract tx-sender) none))
    ;; Add principal portion + vault interest back to deposits
    (var-set total-deposits (+ (var-get total-deposits) (+ principal-per-installment vault-interest)))
    ;; Track treasury interest
    (var-set total-interest-collected (+ (var-get total-interest-collected) treasury-interest))
    ;; Update loan status
    (if (is-eq new-paid total-installments)
      (begin
        ;; Loan fully repaid
        (map-set loans caller (merge loan {
          amount-repaid: new-amount-repaid,
          installments-paid: new-paid,
          status: "repaid"
        }))
        ;; Update credit identity - clear debt and record repayment
        (try! (contract-call? .credit-identity update-debt caller u0))
        (try! (contract-call? .credit-identity record-repayment caller))
        (ok { status: "repaid", installments-remaining: u0 })
      )
      (begin
        ;; Partial repayment
        (map-set loans caller (merge loan {
          amount-repaid: new-amount-repaid,
          installments-paid: new-paid,
          due-block: (+ block-height BLOCKS-PER-PERIOD)
        }))
        ;; Update outstanding debt on credit identity
        (try! (contract-call? .credit-identity update-debt caller (- total-owed new-amount-repaid)))
        (ok { status: "active", installments-remaining: (- total-installments new-paid) })
      )
    )
  )
)

;; Mark a loan as defaulted - admin only, after missed payments
(define-public (mark-default (borrower principal))
  (let (
    (loan (unwrap! (map-get? loans borrower) ERR-NO-LOAN))
    (status (get status loan))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-ADMIN)
    (asserts! (is-eq status "active") ERR-LOAN-REPAID)
    ;; Mark loan as defaulted
    (map-set loans borrower (merge loan {
      status: "defaulted"
    }))
    ;; Update credit identity - clear debt and record default
    (try! (contract-call? .credit-identity update-debt borrower u0))
    (try! (contract-call? .credit-identity record-default borrower))
    (ok true)
  )
)

;; ---- Read-only functions ----

(define-read-only (get-loan (address principal))
  (map-get? loans address)
)

(define-private (get-active-loan (address principal))
  (match (map-get? loans address)
    loan (if (is-eq (get status loan) "active")
      (some loan)
      none
    )
    none
  )
)

(define-read-only (get-vault-stats)
  {
    total-deposits: (var-get total-deposits),
    total-shares: (var-get total-shares),
    total-interest-collected: (var-get total-interest-collected),
    utilization: (if (> (var-get total-deposits) u0)
      u0
      u0
    )
  }
)

(define-read-only (get-user-shares (address principal))
  (default-to u0 (map-get? lp-shares address))
)
