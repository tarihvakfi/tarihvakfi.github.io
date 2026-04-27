#!/usr/bin/env python3
"""Find archiveUnits left over from the assignment era.

Background:
The volunteer flow used to push work via assignedToUids / assignedToEmails.
Prompts A–D moved everyone to a report-first model. Some archive units may
still carry assignment metadata even though no one ever wrote a report against
them — we don't auto-clear those. This script lists candidates so an admin can
decide manually whether to clear the assignedTo* fields.

What counts as a leftover:
- archiveUnits with at least one entry in assignedToUids or assignedToEmails
- AND no reports doc references the unit (neither archiveUnitId nor unitId)

The script never writes to Firestore. It writes a markdown report at
tools/assignment_leftovers.md.

Setup (run once on the maintainer's laptop):
    pip install firebase-admin
    # download a service-account JSON from
    #   Firebase Console → Project Settings → Service accounts
    export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

Run:
    python tools/find_assignment_leftovers.py

Optional flags:
    --project pnb       Filter to a single projectId (default: all)
    --limit  500        Cap on archive units inspected (default: 1000)
    --output tools/assignment_leftovers.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("firebase-admin not installed. Run: pip install firebase-admin", file=sys.stderr)
    sys.exit(1)


def init_firebase() -> firestore.Client:
    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path:
            print(
                "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at a service-account JSON.",
                file=sys.stderr,
            )
            sys.exit(2)
        firebase_admin.initialize_app(credentials.Certificate(cred_path))
    return firestore.client()


def fmt_when(value) -> str:
    if not value:
        return "—"
    if isinstance(value, dt.datetime):
        return value.strftime("%Y-%m-%d")
    return str(value)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--project", default=None, help="Filter to a single projectId.")
    ap.add_argument("--limit", type=int, default=1000, help="Cap on archive units inspected.")
    ap.add_argument(
        "--output",
        default="tools/assignment_leftovers.md",
        help="Path to write the markdown report (relative to repo root).",
    )
    args = ap.parse_args()

    db = init_firebase()

    # Step 1: collect candidate archiveUnits.
    units_ref = db.collection("archiveUnits")
    if args.project:
        query = units_ref.where("projectId", "==", args.project).limit(args.limit)
    else:
        query = units_ref.limit(args.limit)

    candidates: list[dict] = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        uids = data.get("assignedToUids") or []
        emails = data.get("assignedToEmails") or []
        if not uids and not emails:
            continue
        candidates.append({"id": doc.id, **data})

    if not candidates:
        write_report(args.output, project=args.project, leftovers=[], total_inspected=0)
        print(f"No assigned units found. Wrote {args.output}.")
        return 0

    # Step 2: for each candidate, check if any report references it.
    # We query the reports collection for archiveUnitId == id and for
    # unitId == id (the report-first schema). A single matching report is
    # enough to disqualify the unit from the leftovers list.
    reports_ref = db.collection("reports")
    leftovers: list[dict] = []
    for unit in candidates:
        uid = unit["id"]
        has_report = False
        for field in ("archiveUnitId", "unitId"):
            try:
                hit = next(reports_ref.where(field, "==", uid).limit(1).stream(), None)
            except Exception as err:  # noqa: BLE001
                print(f"Warning: reports query for {field}={uid} failed: {err}", file=sys.stderr)
                hit = None
            if hit:
                has_report = True
                break
        if not has_report:
            leftovers.append(unit)

    write_report(
        args.output,
        project=args.project,
        leftovers=leftovers,
        total_inspected=len(candidates),
    )
    print(f"{len(leftovers)} leftover(s) found across {len(candidates)} assigned unit(s). Wrote {args.output}.")
    return 0


def write_report(path: str, *, project: str | None, leftovers: list[dict], total_inspected: int) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    lines: list[str] = []
    lines.append("# Assignment-era leftovers")
    lines.append("")
    lines.append(f"_Generated: {now}_")
    if project:
        lines.append(f"_Project filter: `{project}`_")
    lines.append("")
    lines.append("These archive units still carry `assignedToUids` or `assignedToEmails` set,")
    lines.append("but no `reports` doc references them (neither `archiveUnitId` nor `unitId`).")
    lines.append("They are candidates for clearing the assignedTo fields — review manually.")
    lines.append("")
    lines.append(f"- Inspected (assigned units): **{total_inspected}**")
    lines.append(f"- Leftovers (no report): **{len(leftovers)}**")
    lines.append("")
    if not leftovers:
        lines.append("_No leftovers detected. Nothing to do._")
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    lines.append("| # | Unit id | sourceIdentifier | Status | Assigned uids | Assigned emails | Last activity |")
    lines.append("| - | --- | --- | --- | --- | --- | --- |")
    for idx, unit in enumerate(leftovers, start=1):
        uid = unit.get("id", "")
        ident = unit.get("sourceIdentifier") or unit.get("title") or "(no identifier)"
        status = unit.get("status") or "—"
        uids = ", ".join(unit.get("assignedToUids") or []) or "—"
        emails = ", ".join(unit.get("assignedToEmails") or []) or "—"
        when = fmt_when(unit.get("lastActivityAt") or unit.get("latestReportAt") or unit.get("updatedAt"))
        lines.append(
            f"| {idx} | `{uid}` | {ident} | {status} | {uids} | {emails} | {when} |"
        )
    lines.append("")
    lines.append("## Suggested next step")
    lines.append("")
    lines.append("If you decide to clear: open Firestore Console, find the unit by id, and delete")
    lines.append("the `assignedToUids` and `assignedToEmails` fields. Do not delete the unit doc.")
    lines.append("")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
