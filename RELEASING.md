# Release procedure

1. Run `npm ci --ignore-scripts`, `npm run lint`, `npm test`, and `npm pack --dry-run --ignore-scripts`.
2. Review the package contents. Never commit `.npmrc`, API credentials, test profiles or customer documents.
3. Commit and push to the public repository `mkiskis/n8n-nodes-tvarka-sign`.
4. The initial 0.1.0 package was published interactively with owner 2FA. Configure the package trusted publisher for owner `mkiskis`, repository `n8n-nodes-tvarka-sign`, workflow `publish.yml`, allowing direct publication. The workflow uses OIDC and needs no npm token secret.
5. Push a version tag such as `v0.1.0`, or run the Publish workflow on the reviewed commit. The workflow lints, tests and publishes with provenance through GitHub Actions.
6. Keep the trusted publisher configuration aligned with the repository and workflow filename. Review and revoke any obsolete bootstrap credentials after a trusted-publisher release succeeds.
7. Verify the npm version, tarball, repository link and provenance. Submit the real package URL in the n8n Creator Portal. Assert author and official-representative status only for the authorized TVARKA owner account.

A submitted node is not yet a verified node. Cloud installation and integration-directory discovery remain subject to n8n review.
