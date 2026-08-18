---
name: release
description: Use when shipping a new version of totoPDF to the Chrome Web Store, bumping the extension version, or preparing a store update
---

# Releasing totoPDF

Every published version goes through Chrome Web Store review. The mechanics
are easy and the tests catch most mistakes. What the tests cannot catch is
the part that costs you users: a permission change that disables the
extension for everyone who already installed it, and dashboard fields that
silently go stale because the package changed and the listing did not.

**The deliverable of a release is not the zip. It is the zip plus a handoff
that tells the human exactly what to do in the dashboard.** A release that
ends at "upload the zip" is unfinished.

## Pre-flight

1. **Start from a clean tree on a feature branch.** Never release from a
   dirty tree — you cannot tell what shipped.
2. **Bump the version in BOTH `public/manifest.json` and `package.json`.**
   `test/unit/manifest.test.ts` fails if they drift. The store refuses a
   re-upload whose version did not increase, so a drift is a failed
   submission.
3. `npm test` and `npm run typecheck` — both green.
4. `npm run test:e2e` — 5/5. Needs `npm run build` and
   `npx vite-node test/fixtures/generate.ts` first.
5. `npm run package` — writes `totopdf-<version>.zip`.
6. **Verify the zip you are about to hand over** (§Verify). Building it is
   not the same as checking it.
7. **Delete stale zips** from previous versions so the human cannot upload
   the wrong one.

## The permission gate

**Before anything else, diff the manifest's `permissions` and
`host_permissions` against the published version.** If either changed, stop
and tell the human these three things before continuing:

- **Every existing user's extension is disabled until they individually
  re-approve the new permission.** Chrome does not auto-accept an added
  permission. Users who never click the prompt are lost. This is the single
  most expensive consequence of a release and it is invisible from the repo.
- **Review gets slower.** Permission changes drop out of the fast lane for
  routine updates and back into deeper scrutiny. For reference, the first
  submission — no broad host permission — took four days (2026-08-14 to
  2026-08-18).
- **`file:///*` currently clears the "broad host permissions" warning.**
  Confirmed on submission 2026-08-14: with `<all_urls>` the dashboard warned
  the extension might need in-depth review; with `file:///*` no warning
  appeared. Widening the host permission gives that warning back.

If a permission was added, also check it is actually *used* by code in this
checkout. An unused permission is a routine rejection reason. Say so plainly
if you cannot find the code that needs it.

## Verify

Check the artifact, not the build log:

```bash
node -e "
const fs=require('fs');
const b=fs.readFileSync('totopdf-<version>.zip');
let i=0,n=[];
while((i=b.indexOf(Buffer.from([0x50,0x4b,3,4]),i))!==-1){const l=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28);n.push(b.subarray(i+30,i+30+l).toString());i+=30+l+e+b.readUInt32LE(i+18);}
const m=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));
console.log('entries', n.length, '| manifest at root:', n.includes('manifest.json'));
console.log('version', m.version, '| permissions', JSON.stringify(m.permissions));
console.log('host_permissions', JSON.stringify(m.host_permissions));
console.log('default_locale', m.default_locale);
"
```

`manifest.json` must be at the archive root, not nested under `dist/`. A
nested manifest is rejected at upload.

## Work out the dashboard delta

The human has to re-paste any field whose source text changed. Derive this
from the diff — do not guess, and do not assume "no changes".

| If this changed in the diff | They must re-paste |
|---|---|
| `src/i18n/*.json` `extensionName` | nothing — the title is read-only, taken from the package |
| `src/i18n/*.json` `extensionDescription` | nothing — the summary is read-only too |
| `docs/store/listing.md` detailed description | Descripción, per listing language |
| `docs/store/listing.md` permission justifications | the justification box for each changed permission |
| a new permission in the manifest | its new justification box, which will not exist until the package is uploaded |
| `PRIVACY.md` | nothing to paste; the URL is unchanged and the content is live on push |

Fields the dashboard derives from the package (title, summary) change by
themselves once the new zip is uploaded. Fields typed into the dashboard do
not.

## REQUIRED: the handoff

End every release by producing exactly this, with every section filled in.
An empty section means you did not check — go and check.

```
Version:      <old> -> <new>
Package:      totopdf-<new>.zip (<n> entries, manifest at root, verified)
Permissions:  <unchanged | the exact diff>
Tests:        unit <n>/<n>, typecheck clean, e2e <n>/<n>

Re-paste in the dashboard:
  <each field, or "nothing — no listing source changed">

Before you upload:
  <permission consequences if any, or omit this section entirely>

Then: upload the zip, submit for review.
```

State the permission consequences in that block, not only in prose above it.
The human reads the handoff.

## Common mistakes

| Mistake | Why it costs you |
|---|---|
| Ending at "upload the zip" | The human uploads a package requesting a permission with no justification in the dashboard, and gets rejected. |
| Not mentioning the re-consent consequence | Existing users are silently disabled. Nothing in the repo reveals this. |
| Building the zip without checking it | A nested `manifest.json` or a wrong version is only discovered at upload. |
| Leaving the previous version's zip in place | Two zips, and the human picks the wrong one. |
| Editing README or docs claims to match a premise you were told | Verify or leave it. This project distinguishes observed from inferred; a release is not the moment to blur that. |
| Adding a permission with no code using it | Routine rejection reason. |

## Not your job

You cannot reach the Chrome Web Store. Do not claim a version is published —
submitted and published are different states, and review sits between them.
Do not push to git unless asked.
