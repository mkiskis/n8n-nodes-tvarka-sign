# Release procedure

1. Run `npm ci --ignore-scripts`, `npm run lint`, `npm test`, and `npm pack --dry-run --ignore-scripts`.
2. Review the package contents. Never commit `.npmrc`, API credentials, test profiles or customer documents.
3. Commit and push to the public repository `mkiskis/n8n-nodes-tvarka-sign`.
4. For the first release, an npm owner must configure the publishing authentication. Prefer trusted publishing when the package exists. If a bootstrap token is needed, the owner creates it, restricts its permissions and lifetime, and places it directly in the repository Actions secret `NPM_TOKEN`. Do not send it in chat.
5. Push a version tag such as `v0.1.0`, or run the Publish workflow on the reviewed commit. The workflow lints, tests and publishes with provenance through GitHub Actions.
6. After bootstrap, configure npm's trusted publisher for owner `mkiskis`, repository `n8n-nodes-tvarka-sign`, workflow `publish.yml`; remove the temporary repository secret and revoke the bootstrap token once a trusted-publisher release succeeds.
7. Verify the npm version, tarball, repository link and provenance. Submit the real package URL in the n8n Creator Portal. Assert author and official-representative status only for the authorized TVARKA owner account.

A submitted node is not yet a verified node. Cloud installation and integration-directory discovery remain subject to n8n review.
