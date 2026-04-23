#!/usr/bin/env python3
"""Build a safe local Firestore import preview from the PNB Excel workbooks.

The script never writes to Firebase. It produces a JSON file that an admin can
review in the web app's "PNB İçe Aktar" tab before committing to Firestore.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


PROJECT_ID = "pnb"
PROJECT_TITLE = "Pertev Naili Boratav Arşivi Dijitalleştirme"


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    replacements = {
        "ı": "i",
        "İ": "I",
        "ş": "s",
        "Ş": "S",
        "ğ": "g",
        "Ğ": "G",
        "ü": "u",
        "Ü": "U",
        "ö": "o",
        "Ö": "O",
        "ç": "c",
        "Ç": "C",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip().lower()


def slug(value: Any, fallback: str = "item") -> str:
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or fallback


def clean_string(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def to_number(value: Any) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def to_date(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, dt.datetime):
        return value.date().isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    return clean_string(value) or None


def split_people(value: Any) -> list[str]:
    text = clean_string(value)
    if not text:
        return []
    parts = re.split(r"[,;\n/&]+", text)
    return [clean_string(part) for part in parts if clean_string(part)]


def find_file(excel_dir: Path, *needles: str) -> Path:
    normalized_needles = [normalize_text(needle) for needle in needles]
    for path in excel_dir.glob("*.xlsx"):
        name = normalize_text(path.name)
        if all(needle in name for needle in normalized_needles):
            return path
    available = ", ".join(path.name for path in excel_dir.glob("*.xlsx"))
    raise FileNotFoundError(f"Could not find workbook matching {needles}. Available: {available}")


def rows_as_dicts(path: Path, sheet_name: str | None = None) -> list[dict[str, Any]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[sheet_name] if sheet_name else workbook.active
    rows = list(worksheet.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [clean_string(value) for value in rows[0]]
    normalized_headers = [normalize_text(header) for header in headers]
    result: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows[1:], start=2):
        if not any(clean_string(value) for value in row):
            continue
        record = {"_sourceRow": row_index}
        for header, normalized, value in zip(headers, normalized_headers, row):
            if not normalized:
                continue
            record[normalized] = value
            record[f"_label_{normalized}"] = header
        result.append(record)
    return result


def value(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        normalized = normalize_text(key)
        if normalized in record:
            return record[normalized]
    return None


def build_people(path: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], list[dict[str, str]]]:
    people: list[dict[str, Any]] = []
    seen: Counter[str] = Counter()
    rows = rows_as_dicts(path, "Sayfa1")
    for row in rows:
        full_name = clean_string(value(row, "paydaş", "paydas"))
        if not full_name:
            continue
        email = clean_string(value(row, "email")).lower()
        person = {
            "id": f"pnb-person-{slug(email or full_name)}",
            "projectId": PROJECT_ID,
            "fullName": full_name,
            "normalizedName": normalize_text(full_name),
            "email": email,
            "phone": clean_string(value(row, "telefon")),
            "profession": clean_string(value(row, "meslek")),
            "university": clean_string(value(row, "universite", "üniversite")),
            "educationDepartment": clean_string(value(row, "bölüm", "bolum")),
            "city": clean_string(value(row, "şehir", "sehir")),
            "foundationRole": clean_string(value(row, "tarih vakfındaki rolü", "tarih vakfindaki rolu")),
            "projectRole": clean_string(value(row, "projede rolü", "projede rolu")),
            "expectation": clean_string(value(row, "projeden beklentisi")),
            "power": to_number(value(row, "gücü (1-5)", "gucu (1-5)")),
            "interest": to_number(value(row, "ilgisi (1-5)")),
            "stakeholderLevel": clean_string(value(row, "güç/ilgi seviyesi", "guc/ilgi seviyesi")),
            "sourceRow": row["_sourceRow"],
        }
        seen[person["normalizedName"]] += 1
        people.append(person)
    by_name = {person["normalizedName"]: person for person in people}
    duplicates = [
        {"name": name, "count": count}
        for name, count in sorted(seen.items())
        if name and count > 1
    ]
    return people, by_name, duplicates


def build_availability(path: Path, people_by_name: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook["Sayfa1"]
    rows = list(worksheet.iter_rows(values_only=True))
    headers = [clean_string(value) for value in rows[0]]
    day_map = {
        "pztesi": "monday",
        "pazartesi": "monday",
        "sali": "tuesday",
        "salı": "tuesday",
        "cars": "wednesday",
        "carsamba": "wednesday",
        "çarş": "wednesday",
        "per": "thursday",
        "persembe": "thursday",
        "cuma": "friday",
    }
    availability: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows[1:], start=2):
        if not any(clean_string(cell) for cell in row):
            continue
        full_name = clean_string(row[0])
        if not full_name:
            continue
        normalized_name = normalize_text(full_name)
        matched_person = people_by_name.get(normalized_name)
        slots = []
        for col_index, cell in enumerate(row[3:13], start=3):
            if normalize_text(cell) != "x":
                continue
            label = headers[col_index] if col_index < len(headers) else f"slot-{col_index}"
            normalized_label = normalize_text(label)
            day = next((mapped for key, mapped in day_map.items() if key in normalized_label), "unknown")
            slot_no = "2" if "2" in normalized_label else "1"
            slots.append({"label": label, "day": day, "slot": slot_no})
        availability.append(
            {
                "id": f"pnb-availability-{slug(full_name)}",
                "projectId": PROJECT_ID,
                "personName": full_name,
                "normalizedName": normalized_name,
                "email": matched_person.get("email", "") if matched_person else "",
                "userUid": "",
                "topics": [clean_string(row[1]), clean_string(row[2])],
                "slots": slots,
                "slotCount": len(slots),
                "sourceRow": row_index,
            }
        )
    return availability


def build_archive_units(path: Path, people_by_name: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = rows_as_dicts(path)
    units: list[dict[str, Any]] = []
    used_ids: Counter[str] = Counter()
    for row in rows:
        source_code = clean_string(value(row, "kaynak kodu"))
        series_no = clean_string(value(row, "seri no"))
        box_no = clean_string(value(row, "kutu no"))
        base_id = f"pnb-{slug(source_code, 'source')}-{slug(series_no, 'series')}-{slug(box_no, 'box')}"
        used_ids[base_id] += 1
        unit_id = base_id if used_ids[base_id] == 1 else f"{base_id}-{used_ids[base_id]}"
        assigned_names = split_people(value(row, "atanan gönüllü(ler)", "atanan gonullu(ler)"))
        assigned_emails = []
        for name in assigned_names:
            person = people_by_name.get(normalize_text(name))
            if person and person.get("email"):
                assigned_emails.append(person["email"])
        units.append(
            {
                "id": unit_id,
                "projectId": PROJECT_ID,
                "projectTitle": PROJECT_TITLE,
                "title": f"PNB {source_code} / {series_no} - Kutu {box_no}",
                "sourceCode": source_code,
                "seriesNo": series_no,
                "boxNo": box_no,
                "fileCount": to_number(value(row, "dosya adedi")),
                "documentCount": to_number(value(row, "belge adedi")),
                "pageCount": to_number(value(row, "sayfa adedi")),
                "materialType": clean_string(value(row, "materyal türü", "materyal turu")),
                "notes": clean_string(value(row, "not")),
                "startDate": to_date(value(row, "başlangıç tarihi", "baslangic tarihi")),
                "updatedDate": to_date(value(row, "güncelleme tarihi", "guncelleme tarihi")),
                "endDate": to_date(value(row, "bitiş tarihi", "bitis tarihi")),
                "assignedNames": assigned_names,
                "assignedToEmails": sorted(set(assigned_emails)),
                "assignedToUids": [],
                "completedFileCount": to_number(value(row, "tamamlanan dosya")),
                "completedDocumentCount": to_number(value(row, "tamamlanan belge adedi")),
                "completedPageCount": to_number(value(row, "tamamlanan sayfa adedi")),
                "remainingFileCount": to_number(value(row, "kalan dosya")),
                "remainingDocumentCount": to_number(value(row, "kalan belge adedi")),
                "remainingPageCount": to_number(value(row, "kalan sayfa adedi")),
                "status": "assigned" if assigned_names else "not_started",
                "priority": "medium",
                "blockerNote": "",
                "dueDate": None,
                "latestReportAt": None,
                "sourceRow": row["_sourceRow"],
            }
        )
    return units


def build_communication_plans(path: Path) -> list[dict[str, Any]]:
    rows = rows_as_dicts(path)
    plans: list[dict[str, Any]] = []
    for row in rows:
        title = clean_string(value(row, "iletişim tipi", "iletisim tipi"))
        if not title:
            continue
        plans.append(
            {
                "id": f"pnb-communication-{slug(title)}",
                "projectId": PROJECT_ID,
                "title": title,
                "goal": clean_string(value(row, "iletişimin hedefi", "iletisimin hedefi")),
                "channel": clean_string(value(row, "ortam")),
                "frequency": clean_string(value(row, "sıklık", "siklik")),
                "meetingPlan": clean_string(value(row, "toplantı planı", "toplabtı planı", "toplabti plani")),
                "participants": clean_string(value(row, "katılımcılar", "katilimcilar")),
                "owner": clean_string(value(row, "sahibi")),
                "deliverables": clean_string(value(row, "teslimatlar")),
                "format": clean_string(value(row, "format")),
                "sourceRow": row["_sourceRow"],
            }
        )
    return plans


def build_preview(excel_dir: Path) -> dict[str, Any]:
    stakeholder_file = find_file(excel_dir, "paydas")
    availability_file = find_file(excel_dir, "gonullu", "zaman")
    work_plan_file = find_file(excel_dir, "is", "plani")
    communication_file = find_file(excel_dir, "iletisim", "matrisi")

    people, people_by_name, duplicate_names = build_people(stakeholder_file)
    availability = build_availability(availability_file, people_by_name)
    archive_units = build_archive_units(work_plan_file, people_by_name)
    communication_plans = build_communication_plans(communication_file)

    missing_emails = [
        {"name": person["fullName"], "sourceRow": person["sourceRow"]}
        for person in people
        if not person["email"]
    ]
    unmatched_availability = [
        {"name": item["personName"], "slotCount": item["slotCount"], "sourceRow": item["sourceRow"]}
        for item in availability
        if not item["email"]
    ]
    empty_assigned = [unit["id"] for unit in archive_units if not unit["assignedNames"]]

    summary = {
        "archiveUnits": len(archive_units),
        "fileCount": sum(unit["fileCount"] for unit in archive_units),
        "documentCount": sum(unit["documentCount"] for unit in archive_units),
        "pageCount": sum(unit["pageCount"] for unit in archive_units),
        "completedFileCount": sum(unit["completedFileCount"] for unit in archive_units),
        "completedDocumentCount": sum(unit["completedDocumentCount"] for unit in archive_units),
        "completedPageCount": sum(unit["completedPageCount"] for unit in archive_units),
        "people": len(people),
        "peopleWithEmail": sum(1 for person in people if person["email"]),
        "availabilityRows": len(availability),
        "availablePeople": sum(1 for item in availability if item["slotCount"] > 0),
        "availabilitySlotCount": sum(item["slotCount"] for item in availability),
        "communicationPlans": len(communication_plans),
    }

    return {
        "version": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "project": {"id": PROJECT_ID, "title": PROJECT_TITLE},
        "sourceFiles": {
            "stakeholders": stakeholder_file.name,
            "availability": availability_file.name,
            "workPlan": work_plan_file.name,
            "communication": communication_file.name,
        },
        "summary": summary,
        "archiveUnits": archive_units,
        "people": people,
        "availability": availability,
        "communicationPlans": communication_plans,
        "checks": {
            "missingEmails": missing_emails,
            "duplicateNames": duplicate_names,
            "unmatchedAvailabilityNames": unmatched_availability,
            "emptyAssignedArchiveUnits": empty_assigned,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a PNB Firebase import preview JSON.")
    parser.add_argument("--excel-dir", type=Path, default=Path(".."), help="Directory containing the four PNB Excel files.")
    parser.add_argument("--output", type=Path, default=Path("imports/pnb-import-preview.json"), help="Output JSON path.")
    args = parser.parse_args()

    preview = build_preview(args.excel_dir.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(preview, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.output}")
    print(json.dumps(preview["summary"], ensure_ascii=False, indent=2))
    checks = preview["checks"]
    print(
        "Checks: "
        f"{len(checks['missingEmails'])} missing emails, "
        f"{len(checks['duplicateNames'])} duplicate names, "
        f"{len(checks['unmatchedAvailabilityNames'])} unmatched availability rows, "
        f"{len(checks['emptyAssignedArchiveUnits'])} unassigned archive units."
    )


if __name__ == "__main__":
    main()
