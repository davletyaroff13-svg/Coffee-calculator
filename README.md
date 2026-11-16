# Coffee Control 5.0 — development build

Continue in `develop/coffee-control-5`. Do not merge or publish as a completed 5.0 release until the remaining scope below is resolved. The existing GitHub Pages deployment stays on `main`.

## Implemented

- Financial forecasts, acquiring fees, configurable fixed costs, contribution margin, break-even portions per working day, and clearly labelled hypothetical tax on positive profit.
- Recipe constructor, 42-drink reference catalog with search/category filters, ingredient pricing, packaging, loss factors, and scaled recipe copies. Losses apply to grams/ml, not pieces.
- Separate actual sales and forecast quantities. Each actual sale snapshots recipe composition, price, cost, and acquiring fee; editing or deleting recipes does not rewrite history.
- Inventory opening balances, minimums, receipts, writeoffs, stocktaking adjustments, negative-stock guards, movement history, and reversible erroneous sales.
- Actual date-range analytics in Moscow time, revenue series, menu contribution and ABC classification. Days without records count as zero. Cancellation removes the original sale from all historical reports; it is not a fiscal refund.
- Purchasing from planned demand or recorded demand over completed calendar days, lead/safety days, stock coverage, cost estimates, and spreadsheet-safe CSV export.
- CSV preview, quoted cells, duplicate row aggregation, unknown-name reporting, atomic application, exact-file duplicate prevention, and separate plan/actual modes.
- Independent cafes with optional menu copying and a cross-cafe financial summary.
- One validated local workspace containing every cafe and journal. Migration retains both legacy localStorage keys. Invalid migration stops without overwriting source data. Existing draft sales can only be snapshotted using the current legacy recipe at migration time; earlier compositions were not recorded and cannot be reconstructed.
- Full JSON backup/restore, separate-cafe import of old model files, explicit restore preview, automatic pre-restore/pre-reset download, AES-GCM encrypted manual file transfer, PBKDF2 key derivation. Passwords and encryption keys are not persisted.
- Local rule-based insights and an optional generated prompt that the user can copy into an AI chat. No AI request is sent from the application.
- Quota failure leaves in-memory state unchanged; stale-tab writes are rejected; storage events refresh other tabs on the same browser/origin. This is not distributed synchronization or automatic conflict merging.

## Remaining release scope

1. **Automatic synchronization between different devices.** Not implemented. The encrypted file transfer is manual. The agreed privacy requirements exclude registering users or collecting their cafe data on a shared server. Before a cloud implementation, choose an approved storage/account model, encryption, conflict handling, hosting location, and operating cost. No server/provider credentials are configured.
2. **Integrated generative AI.** Not implemented. The local advisor is deterministic and explicitly labelled. A real integration needs a chosen on-device model or an approved backend/provider and a decision about which cafe data may be sent. Never put provider keys in a static frontend.
3. **Real iPhone/Safari verification.** Pending. The responsive layout was inspected in Chrome at desktop and at a 390 px iframe viewport. This is not a physical iPhone/Safari or WebKit compatibility test.
4. **Final release validation and publication.** Blocked on the scope above. No intermediate 4.x or partial 5.0 release should be published.

## Develop and check

Requires modern Node.js and a modern browser with secure-context Web Crypto support. There are no npm dependencies.

```sh
npm test
npm run build
```

Serve the repository or `dist/` over HTTP(S). ES modules do not reliably work by opening `index.html` as a `file://` URL. Existing GitHub Pages can serve root `index.html` and `src/` when the complete release is ready; deployment configuration is not changed in this branch.

The current browser UI imports `workspace.js`, `analytics.js`, `csv.js`, `transfer.js`, and the finance/catalog modules. Older inventory/sales-ledger modules remain for compatibility tests and are not the new workspace's runtime path. The obsolete stock UI has been removed.

## Validation recorded

- `npm test`: 22 passing tests covering financial/inventory primitives, migration, immutable sale snapshots, cancellation, loss and packaging quantities, inventory guards, isolated cafes, bad imports, persistence failure, stale-tab writes, Moscow date boundaries, history demand, CSV parsing, encrypted roundtrip, wrong password and tampering.
- Browser: insufficient-stock sale rejected; initial balances saved; actual sale depleted exact quantities; recipe composition and price changed without rewriting actual analytics; second cafe started without stock or sales; catalog search/addition; scenario calculation; encrypted download/open/decrypt/full restore; actual CSV preview and import; repeat import rejected without further stock depletion; duplicate form IDs corrected and checked.
- Responsive stock layout at a 390 px iframe viewport: document scroll width matched client width (375 px after scrollbar), no horizontal document overflow.

These checks do not establish cloud synchronization, generative AI operation, or native iPhone support.
