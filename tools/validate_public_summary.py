#!/usr/bin/env python3
"""Validate the generated public Sayim Defteri summary or snapshot."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from audit_public_dashboard import TR_WEEKDAYS, is_unsafe_public_identifier


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "_audit" / "output" / "public_summary_from_excel.json"
DEFAULT_SNAPSHOT = ROOT / "js" / "snapshot.js"


def load_snapshot(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.TVF_PUBLIC_DATA\s*=\s*(\{.*?\})\s*;\s*window\.__SNAPSHOT__", text, re.S)
    if match:
        return json.loads(match.group(1))
    match = re.search(r"window\.__SNAPSHOT__\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not match:
        raise ValueError(f"Could not extract JSON from {path}")
    obj = json.loads(match.group(1))
    return obj.get("data") or obj


def load_payload(path: Path) -> dict:
    if path.suffix == ".js":
        return load_snapshot(path)
    obj = json.loads(path.read_text(encoding="utf-8"))
    if "publicSummary" in obj and "latestActivity" in obj:
        return obj
    if "publicSummary" in obj:
        return {"publicSummary": obj["publicSummary"], "latestActivity": obj.get("latestActivity", [])}
    raise ValueError(f"{path} does not contain a publicSummary")


def validate(payload: dict) -> list[str]:
    summary = payload["publicSummary"]
    latest = payload.get("latestActivity") or []
    totals = summary["totals"]
    by_day = summary.get("byDay") or []
    by_material = summary.get("byMaterial") or []
    by_volunteer = summary.get("byVolunteer") or []
    errors: list[str] = []

    if sum(day.get("records", 0) for day in by_day) != totals.get("records"):
        errors.append("sum(byDay.records) != totals.records")
    if sum(row.get("count", 0) for row in by_material) != totals.get("records"):
        errors.append("sum(byMaterial.count) != totals.records")

    for day in by_day:
        parsed = date.fromisoformat(day["dateISO"])
        if day.get("weekdayTR") != TR_WEEKDAYS[parsed.weekday()]:
            errors.append(f"weekday label mismatch for {day['dateISO']}")
        if day.get("records", 0) > 0 and day.get("volunteersCount", 0) == 0:
            errors.append(f"{day['dateISO']} has records but 0 volunteers")

    busiest = max(by_day, key=lambda item: item.get("records", 0), default=None)
    highlighted = (summary.get("highlights") or {}).get("busiestDay") or {}
    if busiest and highlighted and busiest.get("dateISO") != highlighted.get("dateISO"):
        errors.append("busiest day highlight does not match byDay max")

    if summary.get("source", {}).get("recordsAreFullAggregate") is not True:
        errors.append("summary is not marked as full aggregate")
    if latest and len(latest) <= totals.get("records", 0) and summary.get("source", {}).get("latestActivityCap") != 50:
        errors.append("latestActivity cap metadata missing")

    pages_done = totals.get("pagesDone") or 0
    pages_target = totals.get("pagesTarget") or 0
    if pages_target and pages_done > pages_target:
        errors.append("pagesDone > pagesTarget")
    expected = round((pages_done / pages_target) * 100, 1) if pages_target else 0
    if totals.get("progressPercent") != expected:
        errors.append("progressPercent is not mathematically correct")

    for row in by_volunteer:
        label = row.get("label") or ""
        if is_unsafe_public_identifier(label):
            errors.append(f"unsafe public volunteer label: {label}")
        if re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", label):
            errors.append(f"email-like volunteer label: {label}")

    for box in summary.get("byBox") or []:
        if box.get("pageRows", 0) > 0 and box.get("done") is None:
            errors.append(f"active box has page rows but no done count: {box.get('label')}")
        target = box.get("target")
        if target:
            expected_box_pct = round((min(box.get("done", 0), target) / target) * 100, 1)
            if box.get("percent") != expected_box_pct:
                errors.append(f"box percent mismatch: {box.get('label')}")

    text = json.dumps(payload, ensure_ascii=False)
    if re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text):
        errors.append("payload contains an email-like value")
    if re.search(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", text):
        errors.append("payload contains a UUID-like value")
    if re.search(r"\b[0-9a-fA-F]{16,}\b", text):
        errors.append("payload contains a long hex-like value")
    if re.search(r'"volunteerToken"\s*:', text):
        errors.append("payload exposes volunteerToken")
    if re.search(r"sheet_[a-z0-9_]*row\d+", text, re.I):
        errors.append("payload exposes raw sheet row identifiers")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, help="JSON output or js/snapshot.js")
    parser.add_argument("--snapshot", action="store_true", help="Validate js/snapshot.js")
    args = parser.parse_args()

    path = args.path or (DEFAULT_SNAPSHOT if args.snapshot else DEFAULT_JSON)
    payload = load_payload(path)
    errors = validate(payload)
    print(f"Validated: {path}")
    if errors:
      print("Validation: FAIL")
      for error in errors:
          print(f"- {error}")
      return 1
    print("Validation: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
