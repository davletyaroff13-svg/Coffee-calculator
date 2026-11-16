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
- Local rule-based insights and an optional generated prompt that the user can copy into an AI chat. No AI request is sent unless the user connects their own configured backend and explicitly sends a previewed prompt.
- Quota failure leaves in-memory state unchanged; stale-tab writes are rejected; storage events refresh other tabs on the same browser/origin. This is not distributed synchronization or automatic conflict merging.

## Server capabilities implemented, not deployed

- Optional self-hosted Node HTTP service: no user registration. The first device creates a random encrypted space using an operator setup token; subsequent devices pair with a secret code.
- AES-GCM client-side encrypted snapshots. Only a derived authentication token is transmitted; the server does not receive the encryption secret. The bearer token hash is stored with the encrypted payload.
- Conditional writes, serialized durable file replacement, exact CORS allowlist, bounded payloads, per-IP/per-space rate limits, space quota, and durable daily AI request counts.
- Automatic push/pull every 30 seconds while a connected page is open. Concurrent edits pause automatic writes and retain both versions; the UI can preview and explicitly adopt the remote copy. Disconnect leaves local records intact. This is whole-workspace synchronization, not record merging or background processing while the page is closed.
- Optional AI gateway using a configured Chat Completions-compatible HTTPS endpoint. API keys remain in server environment variables. The UI previews the exact prompt and asks before sending it to the server/provider. Model output is rendered as text and cannot change the workspace.
- Two simulated devices were tested against the real local HTTP server for push/pull, conflict pause, preview/adoption, and disconnection. The external AI endpoint was mocked; no paid provider calls were made.

## Remaining release scope

1. **Production infrastructure configuration.** No server, HTTPS endpoint, storage location, operator setup token, or paid AI provider has been provisioned. See [SERVER_SETUP.md](SERVER_SETUP.md). Do not deploy this backend to a public host or enable data transfer by default. User approval of infrastructure, costs, and data destinations is still needed.
2. **Live provider and deployed-device validation.** A real configured AI response, cross-device operation through the chosen HTTPS server, and recovery through that production endpoint remain unverified.
3. **Real iPhone/Safari verification.** Pending. The responsive layout was inspected in Chrome at desktop and at a 390 px iframe viewport. This is not a physical iPhone/Safari or WebKit compatibility test.
4. **Final release publication.** Do not publish a partial 5.0 or intermediate 4.x release. Keep the existing Pages site on `main` until these final checks are complete.

## Develop and check

Requires modern Node.js and a modern browser with secure-context Web Crypto support. There are no npm dependencies.

```sh
npm test
npm run build
```

Serve the repository or `dist/` over HTTP(S). ES modules do not reliably work by opening `index.html` as a `file://` URL. Existing GitHub Pages can serve root `index.html` and `src/` when the complete release is ready; deployment configuration is not changed in this branch.

The current browser UI imports `workspace.js`, `analytics.js`, `csv.js`, `transfer.js`, and the finance/catalog modules. Older inventory/sales-ledger modules remain for compatibility tests and are not the new workspace's runtime path. The obsolete stock UI has been removed.

## Validation recorded

- `npm test`: 33 passing tests covering financial/inventory primitives, migration, immutable sale snapshots, cancellation, loss and packaging quantities, inventory guards, isolated cafes, bad imports, persistence failure, stale-tab writes, Moscow date boundaries, history demand, CSV parsing, encrypted roundtrip, wrong password and tampering.
- Browser: insufficient-stock sale rejected; initial balances saved; actual sale depleted exact quantities; recipe composition and price changed without rewriting actual analytics; second cafe started without stock or sales; catalog search/addition; scenario calculation; encrypted download/open/decrypt/full restore; actual CSV preview and import; repeat import rejected without further stock depletion; duplicate form IDs corrected and checked.
- Responsive stock layout at a 390 px iframe viewport: document scroll width matched client width (375 px after scrollbar), no horizontal document overflow.

Backend checks establish local HTTP synchronization and a mocked AI protocol, not operation on a production server, a live AI model, or native iPhone support.
