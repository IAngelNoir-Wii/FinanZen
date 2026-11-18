# Security Specification — FinanZen Firestore Rules

## 1. Data Invariants
1. **Strict Multi-Tenant Ownership**: Every user document `/users/{userId}` and all subcollection documents (`transactions`, `loans`, `loanPayments`, `debts`, `debtPayments`) can only be read, queried, created, updated, or deleted by the authenticated, email-verified owner whose `request.auth.uid == userId` and `data.ownerId == request.auth.uid`.
2. **Master Gate Relational Integrity**: No subcollection document (`transactions`, `loans`, `loanPayments`, `debts`, `debtPayments`) can exist without an existing parent `/users/{userId}` profile belonging to the owner (`exists(...)` on create, `get(...)` owner check).
3. **Referential Integrity for Payments**:
   - A `LoanPayment` cannot be created unless the referenced parent `ThirdPartyLoan` (`/users/{userId}/loans/{loanId}`) exists and belongs to the user.
   - A `DebtPayment` cannot be created unless the referenced parent `OwnDebt` (`/users/{userId}/debts/{debtId}`) exists and belongs to the user.
4. **Immutability & Temporal Integrity**:
   - `ownerId` and `createdAt` are immutable after creation.
   - `createdAt` must equal `request.time` on creation; `updatedAt` must equal `request.time` on creation and updates.
5. **Bounded Types & Anti-Resource Exhaustion**:
   - All document IDs (`userId`, `transactionId`, `loanId`, `paymentId`, `debtId`) must satisfy `^[a-zA-Z0-9_\\-]+$` and length `<= 128`.
   - Every string and list has explicit upper-bound `.size()` limits.
   - Numeric monetary amounts must be non-negative (`>= 0`, and `> 0` for transaction/payment amounts).
   - Strict `keys().hasAll(...) && keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update prevent shadow/ghost fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Unauthenticated user attempting `getDoc` or `setDoc` on `/users/user123/transactions/tx1`.
2. **Unverified Email Spoofing**: Authenticated user with `email_verified: false` attempting to create `/users/{uid}`.
3. **Cross-Tenant Ownership Spoofing**: User A (`uidA`) attempting to create `/users/uidB/transactions/tx1` with `ownerId: "uidA"`.
4. **Foreign `ownerId` Injection**: User A attempting to create `/users/uidA/transactions/tx1` with `ownerId: "uidB"`.
5. **Ghost / Shadow Field Injection**: User A creating a transaction with valid fields plus `"isAdmin": true` or `"ghostField": "hack"`.
6. **Client Timestamp Forgery**: User A creating a transaction with a backdated client timestamp `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
7. **Orphaned Loan Payment**: User A creating `/users/uidA/loanPayments/pay1` referencing a nonexistent `loanId: "nonexistent_loan"`.
8. **Orphaned Debt Payment**: User A creating `/users/uidA/debtPayments/dpay1` referencing a nonexistent `debtId: "nonexistent_debt"`.
9. **ID Poisoning / Oversized Path ID**: User A attempting to create a transaction with a 200-character invalid ID or special characters (`../../admin`).
10. **Immutable Field Tampering**: User A attempting to update `createdAt` or `ownerId` on an existing `OwnDebt` document.
11. **Value Poisoning / Type Mismatch**: User A attempting to update `amount` on a `Transaction` with a string `"1000"` or negative number `-500`, or setting `description` to a 2000-character string.
12. **Blanket Collection Scraping (`list` without owner match)**: User A attempting to `list` `/users/uidB/transactions` or `/users` root collection.
