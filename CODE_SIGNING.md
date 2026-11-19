# Code Signing Policy

This page states how Multi-AI Chat Desktop release artifacts are signed on
Windows, as required by the SignPath Foundation free open-source program.

## Who signs, and as whom

- Windows release artifacts are signed by **SignPath Foundation** through its
  free code-signing program for open-source projects. The Authenticode
  certificate is issued to SignPath Foundation, not to this project or its
  maintainer, so the publisher name shown by Windows SmartScreen and the
  installer is **"SignPath Foundation"**.
- The private key never leaves SignPath. It is stored on SignPath's hardware
  security module; this repository holds no certificate, private key, or
  `.pfx` file.
- Signing is wired into the Release workflow
  (`.github/workflows/release.yml`) with the official SignPath GitHub Action
  (`signpath/github-action-submit-signing-request`). No release artifact is
  ever signed on a maintainer's local machine.

## What is signed

Each Windows release signs two files:

| File | Signed? | Notes |
| --- | --- | --- |
| NSIS setup exe (`*_x64-setup.exe`) | Yes | The file users download and run. |
| App exe inside the portable `.zip` | Yes | Signed before the zip is packed. |

One known limitation: the NSIS installer embeds the app exe at build time,
before signing happens, so the exe *inside* the installer is unsigned. The
installer itself — the file Windows SmartScreen checks on download — is
signed. The portable zip's exe is signed in full.

macOS and Linux artifacts are unaffected by this policy: the macOS DMG stays
ad-hoc signed (see `README.md`), and the Linux AppImage is unsigned.

## Only CI builds from this repository are signed

- Signing requests are submitted only by the Release workflow, which runs on
  GitHub-hosted runners (`windows-latest`) from a pushed `v*` tag.
- SignPath origin verification is enabled: SignPath checks that the artifact
  was built by this repository's workflow and that all jobs leading up to the
  signing request ran on GitHub-hosted runners. Artifacts built anywhere else
  (a local machine, a fork, a re-run of an old build) are not signed.
- The SignPath GitHub App must be installed on this repository so SignPath
  can verify build origin from the audit log.

## Approval and failure behavior

- Every signing request needs **one manual approval** in SignPath by the
  `release-signing` policy approver (the maintainer). A Windows release
  therefore asks for **two approvals** — one for the app exe, one for the
  NSIS installer — and the approver gets an email for each.
- Each request waits up to 30 minutes for approval. If approval does not
  arrive in time, or signing fails for any other reason, the workflow ships
  the **unsigned** files instead of blocking the release. A failed signature
  check likewise keeps the unsigned build. Signing is never a reason for a
  release to be missing.
- Without the `SIGNPATH_API_TOKEN` repository secret, all signing steps are
  skipped and releases ship unsigned, exactly as they did before signing was
  introduced.

## Setup (one time, after the Foundation approves the project)

In this repository's **Settings → Secrets and variables → Actions**:

| Type | Name | Value (filled in after approval) |
| --- | --- | --- |
| Secret | `SIGNPATH_API_TOKEN` | API token of the CI user that may submit signing requests |
| Variable | `SIGNPATH_ORGANIZATION_ID` | SignPath organization ID |
| Variable | `SIGNPATH_PROJECT_SLUG` | SignPath project slug for this repository |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | Signing policy slug, normally `release-signing` |

In the SignPath web app, the project's **default artifact configuration**
must be an Authenticode configuration for `.exe` files; the workflow relies
on the default and does not select a configuration per file.

## What signing does and does not promise

- Signing removes the **"Unknown publisher"** warning: Windows can verify
  who published the file.
- SmartScreen also weighs download reputation. A newly signed publisher
  identity can still trigger a warning until enough downloads have built
  reputation; the shared SignPath Foundation certificate already carries
  reputation from other open-source projects, so warnings should fade faster
  than with a brand-new certificate. Signing is not a guarantee that no
  Windows machine will ever show a prompt.
- Signing proves origin and integrity at signing time. It does not change
  what the app does, and it is unrelated to the in-app provider adapters.

## Verifying a release

On Windows, check any downloaded installer or portable exe with:

```powershell
(Get-AuthenticodeSignature -FilePath .\Multi-AI.Chat.Desktop_*_x64-setup.exe).Status
(Get-AuthenticodeSignature -FilePath .\Multi-AI.Chat.Desktop_*_x64-setup.exe).SignerCertificate.Subject
```

`Status` should be `Valid` and the subject should name SignPath Foundation.
