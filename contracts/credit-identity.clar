;; credit-identity.clar
;; SIP-009 Soulbound NFT for credit profiles.
;; One profile per principal. Transfer is blocked (soulbound).

(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-non-fungible-token credit-profile uint)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-EXISTS (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-TRANSFER-BLOCKED (err u403))

;; Contract references - set to deployer at init
(define-constant CONTRACT-OWNER tx-sender)
(define-data-var oracle-contract principal tx-sender)
(define-data-var vault-contract principal tx-sender)

;; Token ID counter
(define-data-var last-token-id uint u0)

;; Profile data map
(define-map profiles principal {
  token-id: uint,
  credit-score: uint,
  total-loans: uint,
  total-defaulted: uint,
  repayment-rate: uint,
  outstanding-debt: uint,
  verified-sources: uint,
  last-updated: uint
})

;; Reverse lookup: token-id -> owner
(define-map token-owners uint principal)

;; Admin functions

(define-public (set-oracle-contract (oracle principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set oracle-contract oracle)
    (ok true)
  )
)

(define-public (set-vault-contract (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set vault-contract vault)
    (ok true)
  )
)

;; SIP-009 required functions

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-owner (id uint))
  (ok (map-get? token-owners id))
)

(define-read-only (get-token-uri (id uint))
  (ok (some "https://bitlend.io/credit-profile/{id}.json"))
)

;; Transfer is BLOCKED - soulbound token
(define-public (transfer (id uint) (sender principal) (recipient principal))
  ERR-TRANSFER-BLOCKED
)

;; Mint a new credit profile - only callable by oracle contract
(define-public (mint-profile (recipient principal))
  (let (
    (new-id (+ (var-get last-token-id) u1))
  )
    (asserts! (is-eq contract-caller (var-get oracle-contract)) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? profiles recipient)) ERR-ALREADY-EXISTS)
    (try! (nft-mint? credit-profile new-id recipient))
    (var-set last-token-id new-id)
    (map-set token-owners new-id recipient)
    (map-set profiles recipient {
      token-id: new-id,
      credit-score: u0,
      total-loans: u0,
      total-defaulted: u0,
      repayment-rate: u100,
      outstanding-debt: u0,
      verified-sources: u0,
      last-updated: block-height
    })
    (ok new-id)
  )
)

;; Update profile score and sources - only callable by oracle contract
(define-public (update-profile (recipient principal) (score uint) (sources uint))
  (let (
    (profile (unwrap! (map-get? profiles recipient) ERR-NOT-FOUND))
  )
    (asserts! (is-eq contract-caller (var-get oracle-contract)) ERR-NOT-AUTHORIZED)
    (map-set profiles recipient (merge profile {
      credit-score: score,
      verified-sources: sources,
      last-updated: block-height
    }))
    (ok true)
  )
)

;; Update outstanding debt - only callable by vault contract
(define-public (update-debt (recipient principal) (new-debt uint))
  (let (
    (profile (unwrap! (map-get? profiles recipient) ERR-NOT-FOUND))
  )
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-AUTHORIZED)
    (map-set profiles recipient (merge profile {
      outstanding-debt: new-debt,
      last-updated: block-height
    }))
    (ok true)
  )
)

;; Record loan origination - only callable by vault contract
(define-public (record-loan (recipient principal))
  (let (
    (profile (unwrap! (map-get? profiles recipient) ERR-NOT-FOUND))
  )
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-AUTHORIZED)
    (map-set profiles recipient (merge profile {
      total-loans: (+ (get total-loans profile) u1),
      last-updated: block-height
    }))
    (ok true)
  )
)

;; Record loan repayment completion - only callable by vault contract
(define-public (record-repayment (recipient principal))
  (let (
    (profile (unwrap! (map-get? profiles recipient) ERR-NOT-FOUND))
    (total (get total-loans profile))
    (defaulted (get total-defaulted profile))
    (new-rate (if (> total u0)
      (/ (* (- total defaulted) u100) total)
      u100))
  )
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-AUTHORIZED)
    (map-set profiles recipient (merge profile {
      repayment-rate: new-rate,
      last-updated: block-height
    }))
    (ok true)
  )
)

;; Record default - only callable by vault contract
(define-public (record-default (recipient principal))
  (let (
    (profile (unwrap! (map-get? profiles recipient) ERR-NOT-FOUND))
    (total (get total-loans profile))
    (new-defaulted (+ (get total-defaulted profile) u1))
    (new-rate (if (> total u0)
      (/ (* (- total new-defaulted) u100) total)
      u0))
  )
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-AUTHORIZED)
    (map-set profiles recipient (merge profile {
      total-defaulted: new-defaulted,
      repayment-rate: new-rate,
      last-updated: block-height
    }))
    (ok true)
  )
)

;; Read-only functions

(define-read-only (get-profile (address principal))
  (map-get? profiles address)
)

(define-read-only (has-profile (address principal))
  (is-some (map-get? profiles address))
)
