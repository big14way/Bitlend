;; mock-usdcx.clar
;; A mock SIP-010 fungible token for testing the BitLend protocol.
;; Implements full SIP-010 trait with a public faucet function.

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token mock-usdcx)

(define-constant ERR-NOT-AUTHORIZED (err u100))

(define-constant CONTRACT-OWNER tx-sender)

(define-data-var token-uri (optional (string-utf8 256)) (some u"https://bitlend.io/mock-usdcx.json"))

;; SIP-010 Functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? mock-usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock USDCx")
)

(define-read-only (get-symbol)
  (ok "mUSDCx")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-usdcx account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-usdcx))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; Faucet - anyone can mint 1000 USDCx to themselves for testing
(define-public (faucet)
  (ft-mint? mock-usdcx u1000000000 tx-sender)
)

;; Admin mint - contract owner can mint to any address
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ft-mint? mock-usdcx amount recipient)
  )
)
