# Assignment-era leftovers

_This file is a placeholder. Run the detection script to populate it with live data._

## Purpose

The volunteer flow used to push work via `assignedToUids` / `assignedToEmails`
on `archiveUnits`. Prompts A–D moved everyone to a report-first model; some
archive units may still carry stale assignment metadata even though no one ever
wrote a report against them. This file lists candidates so an admin can decide
manually whether to clear the `assignedTo*` fields.

## How to populate this file

```bash
pip install firebase-admin
# Firebase Console → Project Settings → Service accounts → "Generate new private key"
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
python tools/find_assignment_leftovers.py
```

Optional flags:

| Flag | Default | Notes |
| --- | --- | --- |
| `--project` | _all projects_ | Filter to a single projectId, e.g. `--project pnb` |
| `--limit` | `1000` | Cap on archive units inspected |
| `--output` | `tools/assignment_leftovers.md` | Where to write the report |

## Detection rule

A unit is a leftover if **both** are true:

1. `assignedToUids` or `assignedToEmails` is non-empty.
2. No doc in the `reports` collection references the unit by `archiveUnitId`
   _or_ `unitId`.

## Manual triage

For each leftover the script lists, decide one of:

- **Keep** — assignment is intentional (coordinator queued the work, volunteer
  hasn't started yet). Do nothing.
- **Clear** — open Firestore Console, find the unit by id, delete the
  `assignedToUids` and `assignedToEmails` fields. The unit doc itself stays.

We do not auto-clear because the report-first model still allows a coordinator
to pre-attach a name as a hint. Only stale rows from the old assignment era
are noise.
