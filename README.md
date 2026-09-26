# n8n-nodes-tvarka-sign

Connect [TVARKA Sign](https://tvarka.pro) to your document and CRM workflows in [n8n](https://n8n.io).

Upload a document, request qualified electronic signatures, follow progress, and download the result. The signer completes the TVARKA ceremony using their own supported electronic identity. Creating a request does not itself sign a document.

## Installation

On self-hosted n8n, install `n8n-nodes-tvarka-sign` through **Settings → Community Nodes**. Follow the [n8n community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

n8n Cloud installation requires n8n verification of this package. Publishing on npm does not mean the package is verified or available in Cloud.

## Credentials

1. Sign in to [TVARKA Sign](https://sign.tvarka.pro/), select your company and open **Settings → API key**.
2. Create a **TVARKA Sign API** credential in n8n and enter your key. Keys are sent as bearer tokens only to `https://sign-api.tvarka.pro`.
3. Use **Test credential** to perform a read-only signing-list request.

Production keys start with `tsk_live_`. Existing `tsk_test_` keys use the same API host and select the sandbox. Due Diligence and ATK credentials are separate and cannot be used here. See [API access guidance](https://sign-api.tvarka.pro/docs#keys).

The node requires an active TVARKA Sign workspace and the API access of the named user. Production signatures are billed by TVARKA under the workspace's pricing; n8n charges are separate.

## Operations

| Resource | Operation | Result |
| --- | --- | --- |
| File | Upload | Upload binary data, up to 100 MB, and receive a reusable `fileToken` |
| Signing | Create Signing | Request signatures and receive status and ceremony links |
| Signing | Get Signing | Read current status and signer details |
| Signing | Get Many | Retrieve signing requests, optionally filtered by status, with cursor pagination |
| Signing | Download Document | Return the latest available document as n8n binary data |
| Signing | Cancel Signing | Retract unused invitations; collected signatures remain intact |
| Signing | Remind Signer | Ask TVARKA to send a reminder to an existing signer |

## First workflow

1. Obtain a file from your storage, CRM or another n8n node as binary data. Keep its filename extension.
2. Add **TVARKA Sign → File → Upload**, using the binary field `data` (or your source field).
3. Add **Signing → Create Signing**. Map the returned `fileToken`, provide the document filename, title and one or more signer emails.
4. Supply a stable **Idempotency Key**, such as `contract:123:revision:2`. Use the same key and identical request when retrying an uncertain outcome. A changed document or signer list requires a new business request key.
5. Choose **Return Ceremony Links** to distribute links yourself, or **Email Invitations** to have TVARKA send invitations. This is an explicit choice; the default returns links.
6. Poll **Get Signing** with a Wait node. Download when `status` is `completed`. Stop for `declined`, `cancelled`, `expired` or `failed`.
7. Connect **Download Document** to your storage or CRM node. Its binary output defaults to `data`; JSON also contains `signingId`, `fileName`, `sha256` and `sandbox`.

The included [example workflow](examples/request-and-download.json) demonstrates steps 3–6 using an already-uploaded file token. Import it, choose your credentials, and replace all example input values before executing. It uses email invitations explicitly, polls every five minutes while the order is pending, and stops on other terminal outcomes. Connect the binary output to your preferred storage provider. Long-running polling consumes n8n executions according to your plan.

A download can be available after only one participant signs. Always check for `completed` if your business process requires every signature. Sandbox downloads are marked `sandbox: true` and must not be treated as signed production documents.

## Supported documents and limits

- PDF documents; appendable ASiC-E (`.asice`, `.sce`, `.bdoc`) and already-signed ADOC-family containers (`.adoc`, `.bedoc`, `.cedoc`, `.gedoc`, `.ggedoc`) for countersigning.
- Multipart upload supports 100,000,000 bytes. Reusable uploads expire after seven days. Each signing receives its own copy.
- One to twenty signers; parallel or sequential order; expiry from 1 to 30 days.
- Signing methods and workspace entitlements are enforced by TVARKA. This initial connector uses hosted ceremonies; it does not initiate headless phone signatures.
- Server-side validation remains authoritative. Keep n8n execution access and retention appropriate for documents and private ceremony links.

## Errors and retries

API failures appear as node errors. n8n's Continue On Fail option returns an error item and preserves input pairing. The connector does not silently retry mutations or follow redirects. For rate limits or temporary API failures, use a bounded retry policy; preserve the create idempotency key. Upload retries can create another temporary file, so keep the returned token once received.

## Development

Requires Node.js 24 and npm.

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run dev
```

There are no runtime dependencies beyond the n8n workflow peer dependency. Tests exercise the compiled node, request bodies, multipart binary preservation, pagination, downloads, failure handling and item pairing with mocked API transport. They do not claim a real eID signature or production end-to-end acceptance.

GitHub Actions builds and tests the package and publishes tagged releases with npm provenance. Publishing requires npm owner access and either an initial publishing credential or an established trusted publisher. See [RELEASING.md](RELEASING.md).

## Support and license

[API documentation](https://sign-api.tvarka.pro/docs) · [TVARKA](https://tvarka.pro) · [Issues](https://github.com/mkiskis/n8n-nodes-tvarka-sign/issues) · info@tvarka.pro

MIT. The license applies to this connector; use of the TVARKA service is governed by TVARKA's terms.
