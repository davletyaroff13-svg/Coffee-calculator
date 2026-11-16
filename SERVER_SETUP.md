# Optional Coffee Control backend

The frontend remains usable locally without this service. This backend has been implemented and tested on loopback, but no production instance is provisioned. Do not claim that cloud synchronization or AI is already active for the user.

## Operator configuration

Use Node.js 22 or newer on a server selected by the owner. Keep the data directory on persistent storage outside the public static website and outside Git. Only the static `dist/` directory belongs on GitHub Pages. Never upload the backend data directory or environment values to Pages.

| Environment variable | Purpose |
| --- | --- |
| `SYNC_SETUP_TOKEN` | Required operator setup secret, at least 24 random characters. Needed only to create a new encrypted space. Generate and store it privately on the server. |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, for example `https://davletyaroff13-svg.github.io`. Paths are not included. |
| `DATA_DIRECTORY` | Persistent directory for encrypted workspace records and AI usage counters. Default: `./coffee-data`. |
| `HOST`, `PORT` | Bind address and port. Defaults: `127.0.0.1:8787`; keep behind an HTTPS reverse proxy. |
| `AI_URL` | Optional full HTTPS Chat Completions endpoint, such as `https://api.openai.com/v1/chat/completions`, or an approved compatible provider. No default provider. |
| `AI_MODEL` | Exact model identifier available to the chosen provider/account. No default model. |
| `AI_API_KEY` | Server-only provider secret. Never enter it in the frontend or commit it to Git. |
| `AI_DAILY_LIMIT` | Maximum requests per space per UTC day, default 100, persisted with the encrypted space record. Also set the provider account's spending limit. Failed upstream requests consume a request slot. |

Configure values using the host's secret/environment settings, then run:

```sh
npm test
npm run server
```

Expose the service through an HTTPS reverse proxy with a valid certificate, request-size limit at or below 9 MB, and no request-body/header logging. Keep the application bound to loopback. Give the service account exclusive access to the data directory. Back up that directory separately. The backend intentionally does not serve the frontend.

The server itself does not log prompts, pairing secrets, or authorization headers. Hosting and proxy logging must be reviewed separately. The application does not promise legal compliance for an unreviewed host/provider configuration.

## First device

1. In **Мои данные → Автоматическая синхронизация и AI**, enter the chosen HTTPS server origin and operator setup token.
2. Create the encrypted space. The setup token is used once and is not stored by the app.
3. Show the pairing code and transfer it privately to the owner's other device. The code is a bearer secret that grants decryption of the whole workspace. It is stored locally on paired devices and is excluded from normal data backups.

## Additional device

Paste the pairing code, preview the remote copy, and explicitly restore it. The app first downloads the current local workspace as a recovery copy. Polling then runs every 30 seconds while the page is open. Keep a private copy of the pairing code; there is no password-reset account or server-side decryption recovery.

Edits on both devices cause a conflict, not an automatic overwrite. Download the local backup, preview the remote copy, and choose which full workspace to adopt. Record-by-record merging is not implemented. Disconnect stops future polls; an already submitted request can still finish.

## AI

The local rules-based assistant remains available without a provider. When a provider is configured and the device is paired, prepare a prompt, review its financial/menu contents, and click **Отправить запрос в AI**. The dialog names the server and provider and mentions potential API costs. Only this explicit request sends plaintext cafe information to them. The response is advisory and never writes to stock, sales, recipes, or prices.

Protocol reference: [Chat Completions](https://developers.openai.com/api/reference/resources/chat). Provider compatibility and the selected model's response behavior must be tested with the actual account before release.
