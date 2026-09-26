# Security

Report vulnerabilities privately to info@tvarka.pro. Do not include API keys, signer identities or documents in public issues.

This node sends requests only to https://sign-api.tvarka.pro and does not follow redirects. Credentials are stored by n8n. Use a dedicated TVARKA workspace user and rotate/revoke access through TVARKA when appropriate.

Workflow inputs and outputs can contain documents, participant emails and private ceremony links. Configure n8n execution retention and access controls accordingly. Do not expose a workflow containing these values as a public template.
