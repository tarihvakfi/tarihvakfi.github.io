#!/usr/bin/env python3
"""Audit and build the public Sayim Defteri summary from the Excel export.

The public dashboard must not derive operational totals from a capped feed.
This script mirrors the public Apps Script aggregation closely enough to:

* inspect the workbook structure;
* write a privacy-safe Markdown audit report;
* optionally refresh js/snapshot.js from the local workbook; and
* validate the generated public summary/snapshot.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "_audit" / "input"
REPORT_PATH = ROOT / "_audit" / "public_dashboard_audit.md"
SNAPSHOT_PATH = ROOT / "js" / "snapshot.js"
PROJECT_ID = "pnb"
PUBLIC_TZ = timezone(timedelta(hours=3))

TR_WEEKDAYS = [
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
]
TR_MONTHS = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
]


def ascii_fold(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("ı", "i").replace("İ", "I")
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


TR_MONTH_LOOKUP = {
    ascii_fold(name).lower(): idx + 1
    for idx, name in enumerate(TR_MONTHS)
}


def slugify(value: Any) -> str:
    folded = ascii_fold(value).lower()
    folded = re.sub(r"[^a-z0-9]+", "_", folded)
    return folded.strip("_")


def header_key(value: Any) -> str:
    return slugify(value)


def workbook_path() -> Path:
    candidates = sorted(INPUT_DIR.glob("*.xlsx"))
    if not candidates:
        raise FileNotFoundError(f"No .xlsx file found under {INPUT_DIR}")
    return candidates[0]


def is_blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def parse_locale_number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) if math.isfinite(float(value)) else 0.0
    text = str(value).strip().replace("\u00a0", "").replace(" ", "")
    if not text:
        return 0.0
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_done_total(value: Any) -> tuple[float, float]:
    if value is None or value == "":
        return 0.0, 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return 0.0, float(value)
    text = str(value).strip()
    match = re.match(r"^([\d.,]+)\s*/\s*([\d.,]+)$", text)
    if match:
        return parse_locale_number(match.group(1)), parse_locale_number(match.group(2))
    return 0.0, parse_locale_number(text)


def parse_sheet_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # Excel serial date, same epoch as Google Sheets for modern dates.
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    text = str(value).strip()
    if not text:
        return None
    match = re.match(r"^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$", text)
    if match:
        month = TR_MONTH_LOOKUP.get(ascii_fold(match.group(2)).lower())
        if month:
            return date(int(match.group(3)), month, int(match.group(1)))
    match = re.match(r"^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$", text)
    if match:
        year = int(match.group(3))
        if year < 100:
            year += 2000
        return date(year, int(match.group(2)), int(match.group(1)))
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def parse_sheet_datetime(value: Any) -> datetime | None:
    d = parse_sheet_date(value)
    if not d:
        return None
    return datetime.combine(d, time(12, 0), tzinfo=PUBLIC_TZ)


def fmt_date_iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def format_day_month(value: date) -> str:
    return f"{value.day} {TR_MONTHS[value.month - 1]}"


def format_period_label(start: date, today: date, full_end: date) -> str:
    if start.month == full_end.month:
        range_label = f"{start.day}–{full_end.day} {TR_MONTHS[start.month - 1]}"
    else:
        range_label = f"{start.day} {TR_MONTHS[start.month - 1]} – {full_end.day} {TR_MONTHS[full_end.month - 1]}"
    return f"{range_label} haftası · bugüne kadar"


def read_rows(ws) -> list[dict[str, Any]]:
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_values = list(next(rows_iter))
    except StopIteration:
        return []
    headers = []
    seen: Counter[str] = Counter()
    for idx, value in enumerate(header_values):
        key = header_key(value) if not is_blank(value) else f"column_{idx + 1}"
        seen[key] += 1
        if seen[key] > 1:
            key = f"{key}_{seen[key]}"
        headers.append(key)
    out: list[dict[str, Any]] = []
    for row_idx, values in enumerate(rows_iter, start=2):
        values = list(values)
        if all(is_blank(v) for v in values):
            continue
        row = {"_source_row": row_idx, "_sheet": ws.title, "_sheet_slug": slugify(ws.title)}
        for idx, key in enumerate(headers):
            row[key] = values[idx] if idx < len(values) else None
        out.append(row)
    return out


def public_box_label(value: Any) -> str:
    if value is None or value == "":
        return ""
    # Excel may coerce labels such as "1-2" to a date in the local file.
    if isinstance(value, datetime):
        if value.year == 2026 and value.month <= 12 and value.day <= 31:
            return f"{value.month}-{value.day}"
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        if value.year == 2026 and value.month <= 12 and value.day <= 31:
            return f"{value.month}-{value.day}"
        return value.isoformat()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if float(value).is_integer():
            return str(int(value))
        return str(value).replace(".", ",")
    return str(value).strip()


def normalize_box(value: Any) -> str:
    label = ascii_fold(public_box_label(value)).lower().strip()
    range_match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", label)
    if range_match:
        return f"range_{range_match.group(1)}_{range_match.group(2)}"
    return re.sub(r"[^a-z0-9]+", "", label)


def material_category(row: dict[str, Any]) -> str:
    haystack = ascii_fold(
        " ".join(
            str(row.get(key) or "")
            for key in (
                "calisma_alani",
                "devam_eden_calisma",
                "dijital_belge_kodu",
                "notlar",
                "fon",
                "fon_adi",
            )
        )
    ).lower()
    if "foto" in haystack or "gorsel" in haystack or "dia" in haystack:
        return "fotoğraflar"
    if "mektup" in haystack:
        return "mektuplar"
    if "kitap" in haystack:
        return "kitap metinleri"
    if "ders" in haystack:
        return "ders notları"
    if "envanter" in haystack:
        return "envanter"
    if "toplanti" in haystack or "koordinasyon" in haystack:
        return "genel"
    return "belgeler"


def row_project_id(row: dict[str, Any]) -> str:
    haystack = ascii_fold(
        " ".join(
            str(row.get(key) or "")
            for key in (
                "fon",
                "fon_adi",
                "calisma_alani",
                "devam_eden_calisma",
                "dijital_belge_kodu",
                "notlar",
            )
        )
    ).lower()
    return PROJECT_ID if "pnb" in haystack or "boratav" in haystack else "foundation"


def is_unsafe_public_identifier(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    if re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text):
        return True
    if re.fullmatch(r"[0-9a-fA-F]{12,}", text):
        return True
    if re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        text,
    ):
        return True
    compact = re.sub(r"[^A-Za-z0-9]", "", text)
    if len(compact) >= 18:
        letters = re.sub(r"[^A-Za-z]", "", compact)
        vowels = re.findall(r"[aeiouAEIOUçğıöşüÇĞİÖŞÜ]", text)
        if len(vowels) <= 1 or len(letters) / max(len(compact), 1) < 0.7:
            return True
    if len(compact) >= 14 and re.search(r"\d", compact) and re.search(r"[A-Za-z]", compact):
        words = re.findall(r"[A-Za-zÇĞİÖŞÜçğıöşü]{2,}", text)
        if len(words) < 2:
            return True
    return False


def truthy_public_flag(value: Any) -> bool:
    text = ascii_fold(value).strip().lower()
    return text in {"1", "true", "evet", "yes", "y", "var", "izinli", "public", "acik"}


def first_name(value: Any) -> str:
    text = str(value or "").strip()
    if not text or is_unsafe_public_identifier(text):
        return ""
    return re.split(r"\s+", text)[0]


def get_public_volunteer_label(row: dict[str, Any]) -> str:
    explicit = row.get("public_display_name") or row.get("publicdisplayname") or row.get("kamusal_ad")
    if explicit and not is_unsafe_public_identifier(explicit):
        return str(explicit).strip()

    consent_keys = (
        "public_display_allowed",
        "public_consent",
        "ad_gorunsun",
        "ad_yayin_izni",
        "kamusal_ad_izni",
    )
    has_consent = any(truthy_public_flag(row.get(key)) for key in consent_keys)
    raw_name = (
        row.get("paydas")
        or row.get("kaydi_olusuran")
        or row.get("kaydi_olusturan")
        or row.get("_sheet_person")
    )
    if raw_name and is_unsafe_public_identifier(raw_name):
        return "Gönüllü katkısı"
    if raw_name and has_consent:
        return first_name(raw_name) or "Bir gönüllü"
    if raw_name:
        return "Bir gönüllü"
    return "Gönüllü katkısı"


def private_contributor_key(row: dict[str, Any]) -> str:
    raw = (
        row.get("paydas")
        or row.get("kaydi_olusuran")
        or row.get("kaydi_olusturan")
        or row.get("_sheet_person")
        or ""
    )
    raw = ascii_fold(raw).lower().strip()
    if raw:
        return raw
    sheet = slugify(row.get("_sheet") or "")
    return f"sheet:{sheet}" if sheet else ""


def sheet_person_from_title(title: str) -> str:
    parts = str(title or "").split()
    if not parts:
        return ""
    if parts[0].upper() == "PNB":
        return parts[-1]
    return ""


@dataclass
class SourceRecord:
    kind: str
    source_type: str
    date: date | None
    when: datetime | None
    material: str
    project_id: str
    private_key: str
    public_label: str
    box: str = ""
    page_units: int = 0
    row_count: int = 1
    unsafe_identifier: bool = False


@dataclass
class BoxInfo:
    box: str
    name: str
    target_pages: int = 0
    summary_done_pages: int = 0
    detail_done_pages: int = 0
    page_rows: int = 0
    files: int = 0
    documents: int = 0
    materials: Counter[str] = field(default_factory=Counter)
    contributor_keys: set[str] = field(default_factory=set)
    contributor_labels: dict[str, str] = field(default_factory=dict)
    last_activity: date | None = None

    @property
    def done_pages(self) -> int:
        return max(self.summary_done_pages, self.detail_done_pages)

    @property
    def remaining_pages(self) -> int | None:
        if self.target_pages <= 0:
            return None
        return max(0, self.target_pages - self.done_pages)

    @property
    def percent(self) -> float | None:
        if self.target_pages <= 0:
            return None
        return round((min(self.done_pages, self.target_pages) / self.target_pages) * 100, 1)

    @property
    def status(self) -> str:
        if self.target_pages > 0 and self.done_pages >= self.target_pages:
            return "completed"
        if self.done_pages > 0 or self.page_rows > 0:
            return "active"
        return "inventory"


def classify_sheet(title: str) -> str:
    slug = slugify(title)
    if slug == "pnb_sayisallastirma":
        return "pnb_inventory"
    if slug in {"gunluk_akis", "gunluk_gonullu_akisi"}:
        return "activity" if slug == "gunluk_akis" else "schedule"
    if slug.startswith("pnb_") and slug not in {"pnb_zarf_calisma"} and "_zarf" not in slug:
        return "pnb_detail"
    return "other"


def load_workbook_rows(path: Path) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    sheet_info: list[dict[str, Any]] = []
    rows_by_sheet: dict[str, list[dict[str, Any]]] = {}
    for ws in wb.worksheets:
        rows = read_rows(ws)
        rows_by_sheet[ws.title] = rows
        header_values = []
        for row in ws.iter_rows(max_row=1, values_only=True):
            header_values = [v for v in row if not is_blank(v)]
            break
        sheet_info.append(
            {
                "title": ws.title,
                "classification": classify_sheet(ws.title),
                "rows": len(rows),
                "headers": [str(h) for h in header_values],
            }
        )
    return sheet_info, rows_by_sheet


def build_inventory(rows_by_sheet: dict[str, list[dict[str, Any]]]) -> dict[str, BoxInfo]:
    boxes: dict[str, BoxInfo] = {}
    inventory_rows = []
    for title, rows in rows_by_sheet.items():
        if classify_sheet(title) == "pnb_inventory":
            inventory_rows = rows
            break
    for row in inventory_rows:
        box = public_box_label(row.get("kutu") or row.get("kutu_no"))
        if not box:
            continue
        done, total = parse_done_total(row.get("sayfa_sayisi"))
        key = normalize_box(box)
        if not key:
            continue
        boxes[key] = BoxInfo(
            box=box,
            name=f"Kutu {box}",
            target_pages=round(total),
            summary_done_pages=round(done),
            files=round(parse_locale_number(row.get("dosya_sayisi"))),
            documents=round(parse_locale_number(row.get("belge_sayisi"))),
        )
    return boxes


def compute_inventory_totals(rows_by_sheet: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    rows = []
    for title, sheet_rows in rows_by_sheet.items():
        if classify_sheet(title) == "pnb_inventory":
            rows = sheet_rows
            break
    total_pages = 0.0
    total_units = 0.0
    total_files = 0.0
    catalogued_boxes = 0
    for row in rows:
        done, total = parse_done_total(row.get("sayfa_sayisi"))
        total_pages += total
        total_units += parse_locale_number(row.get("belge_sayisi"))
        total_files += parse_locale_number(row.get("dosya_sayisi"))
        box = public_box_label(row.get("kutu") or row.get("kutu_no"))
        if box and (
            parse_locale_number(row.get("dosya_sayisi")) > 0
            or parse_locale_number(row.get("belge_sayisi")) > 0
            or total > 0
        ):
            catalogued_boxes += 1
    return {
        "totalPages": round(total_pages),
        "totalUnits": round(total_units),
        "totalFiles": round(total_files),
        "cataloguedBoxes": catalogued_boxes,
    }


def page_units_for_detail_rows(rows: list[dict[str, Any]]) -> list[int]:
    has_sayfa_sayisi = any(not is_blank(row.get("sayfa_sayisi")) for row in rows)
    units = []
    for row in rows:
        if has_sayfa_sayisi:
            done, total = parse_done_total(row.get("sayfa_sayisi"))
            units.append(round(done or total or 1))
        else:
            units.append(1)
    return units


def collect_records(rows_by_sheet: dict[str, list[dict[str, Any]]], boxes: dict[str, BoxInfo]) -> list[SourceRecord]:
    records: list[SourceRecord] = []
    for title, rows in rows_by_sheet.items():
        classification = classify_sheet(title)
        if classification == "pnb_detail":
            page_units = page_units_for_detail_rows(rows)
            sheet_person = sheet_person_from_title(title)
            for row, units in zip(rows, page_units):
                enriched = dict(row)
                enriched["_sheet_person"] = sheet_person
                box = public_box_label(row.get("kutu") or row.get("kutu_no"))
                when = parse_sheet_datetime(row.get("tarih"))
                private_key = private_contributor_key(enriched)
                public_label = get_public_volunteer_label(enriched)
                unsafe = is_unsafe_public_identifier(
                    row.get("paydas") or row.get("kaydi_olusuran") or row.get("kaydi_olusturan") or sheet_person
                )
                rec = SourceRecord(
                    kind="page",
                    source_type="page_detail",
                    date=when.date() if when else None,
                    when=when,
                    material=material_category(row),
                    project_id=PROJECT_ID,
                    private_key=private_key,
                    public_label=public_label,
                    box=box,
                    page_units=max(1, units),
                    unsafe_identifier=unsafe,
                )
                records.append(rec)
                box_key = normalize_box(box)
                if box_key:
                    info = boxes.setdefault(box_key, BoxInfo(box=box, name=f"Kutu {box}"))
                    info.detail_done_pages += max(1, units)
                    info.page_rows += 1
                    info.materials[rec.material] += 1
                    if private_key:
                        info.contributor_keys.add(private_key)
                        info.contributor_labels[private_key] = public_label
                    if rec.date and (not info.last_activity or rec.date > info.last_activity):
                        info.last_activity = rec.date
        elif classification == "activity":
            for row in rows:
                when = parse_sheet_datetime(row.get("tarih"))
                private_key = private_contributor_key(row)
                public_label = get_public_volunteer_label(row)
                unsafe = is_unsafe_public_identifier(row.get("paydas") or row.get("kaydi_olusuran") or row.get("kaydi_olusturan"))
                records.append(
                    SourceRecord(
                        kind="activity",
                        source_type="activity",
                        date=when.date() if when else None,
                        when=when,
                        material=material_category(row),
                        project_id=row_project_id(row),
                        private_key=private_key,
                        public_label=public_label,
                        page_units=0,
                        unsafe_identifier=unsafe,
                    )
                )
    return records


def selected_period(now_date: date, mode: str = "calendar_week") -> dict[str, Any]:
    if mode == "rolling_7_days":
        start = now_date - timedelta(days=6)
        end = now_date
        label = "Son 7 gün"
        return {
            "mode": mode,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "label": label,
            "isPartial": False,
        }
    start = now_date - timedelta(days=now_date.weekday())
    full_end = start + timedelta(days=6)
    return {
        "mode": "calendar_week",
        "startDate": start.isoformat(),
        "endDate": now_date.isoformat(),
        "fullEndDate": full_end.isoformat(),
        "label": format_period_label(start, now_date, full_end),
        "isPartial": now_date < full_end,
    }


def records_in_period(records: list[SourceRecord], period: dict[str, Any]) -> list[SourceRecord]:
    start = date.fromisoformat(period["startDate"])
    end = date.fromisoformat(period["endDate"])
    return [r for r in records if r.date and start <= r.date <= end]


def date_range(start: date, end: date) -> list[date]:
    days = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def material_list(counter: Counter[str]) -> list[dict[str, Any]]:
    total = sum(counter.values())
    return [
        {
            "material": material,
            "label": material[:1].upper() + material[1:],
            "count": count,
            "percent": round((count / total) * 100, 1) if total else 0,
        }
        for material, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def summarize_day(day: date, rows: list[SourceRecord]) -> dict[str, Any]:
    page_rows = [r for r in rows if r.kind == "page"]
    activity_rows = [r for r in rows if r.kind == "activity"]
    contributors = {r.private_key for r in rows if r.private_key}
    boxes = {normalize_box(r.box) for r in page_rows if r.box}
    materials = Counter(r.material for r in rows if r.material)
    first = min((r.when for r in rows if r.when), default=None)
    last = max((r.when for r in rows if r.when), default=None)
    page_count = len(page_rows)
    activity_count = len(activity_rows)
    if rows:
        parts = []
        if page_count:
            parts.append(f"{page_count} sayfa/detay satırı")
        if activity_count:
            parts.append(f"{activity_count} faaliyet kaydı")
        if contributors:
            parts.append(f"{len(contributors)} gönüllü katkısı")
        if boxes:
            parts.append(f"{len(boxes)} kutu")
        sentence = "Bugün " + ", ".join(parts) + " işlendi."
    else:
        sentence = "Bu gün için kayıt görünmüyor."
    return {
        "dateISO": day.isoformat(),
        "weekdayTR": TR_WEEKDAYS[day.weekday()],
        "dayNumber": day.day,
        "records": len(rows),
        "pageRows": page_count,
        "activityRows": activity_count,
        "pagesDone": sum(r.page_units for r in page_rows),
        "volunteersCount": len(contributors),
        "boxesCount": len(boxes),
        "materials": material_list(materials),
        "firstTime": first.isoformat() if first else None,
        "lastTime": last.isoformat() if last else None,
        "summarySentence": sentence,
    }


def top_contributor_label(public_label: str, rank: int) -> str:
    if public_label != "Bir gönüllü":
        return public_label
    if rank == 0:
        return "Bir gönüllü"
    if rank == 1:
        return "Bir gönüllü daha"
    return "Başka bir gönüllü"


def build_public_summary(
    records: list[SourceRecord],
    boxes: dict[str, BoxInfo],
    inventory_totals: dict[str, int],
    generated_at: datetime,
    period_mode: str = "calendar_week",
) -> dict[str, Any]:
    now_date = generated_at.astimezone(PUBLIC_TZ).date()
    period = selected_period(now_date, period_mode)
    period_records = records_in_period(records, period)
    page_records = [r for r in period_records if r.kind == "page"]
    activity_records = [r for r in period_records if r.kind == "activity"]
    all_page_records = [r for r in records if r.kind == "page"]

    start = date.fromisoformat(period["startDate"])
    end = date.fromisoformat(period["endDate"])
    by_day_lookup: dict[date, list[SourceRecord]] = defaultdict(list)
    for rec in period_records:
        if rec.date:
            by_day_lookup[rec.date].append(rec)
    by_day = [summarize_day(day, by_day_lookup.get(day, [])) for day in date_range(start, end)]

    by_material_counter = Counter(r.material for r in period_records if r.material)
    by_box_counter: dict[str, list[SourceRecord]] = defaultdict(list)
    for rec in page_records:
        key = normalize_box(rec.box)
        if key:
            by_box_counter[key].append(rec)
    by_volunteer_counter: dict[str, list[SourceRecord]] = defaultdict(list)
    for rec in period_records:
        if rec.private_key:
            by_volunteer_counter[rec.private_key].append(rec)

    boxes_active_keys = set(by_box_counter)
    boxes_payload = []
    for key, recs in by_box_counter.items():
        info = boxes.get(key) or BoxInfo(box=recs[0].box, name=f"Kutu {recs[0].box}")
        contributor_counts = Counter(r.private_key for r in recs if r.private_key)
        top_contributors = []
        for private_key, count in contributor_counts.most_common(3):
            label = info.contributor_labels.get(private_key)
            if not label:
                label = next((r.public_label for r in recs if r.private_key == private_key), "Bir gönüllü")
            top_contributors.append({"label": label, "records": count})
        boxes_payload.append(
            {
                "box": info.box,
                "label": f"Kutu {info.box}",
                "done": info.done_pages,
                "target": info.target_pages or None,
                "percent": info.percent,
                "remaining": info.remaining_pages,
                "lastActivityDate": fmt_date_iso(info.last_activity),
                "periodRecords": len(recs),
                "periodPageRows": len(recs),
                "periodPagesDone": sum(r.page_units for r in recs),
                "contributorsCount": len(contributor_counts),
                "topContributors": top_contributors,
                "materials": material_list(Counter(r.material for r in recs)),
                "targetMissing": info.target_pages <= 0,
                "overTarget": info.target_pages > 0 and info.done_pages > info.target_pages,
            }
        )
    boxes_payload.sort(key=lambda b: (-int(b["periodPagesDone"]), str(b["box"])))

    volunteer_payload = []
    for idx, (private_key, recs) in enumerate(
        sorted(by_volunteer_counter.items(), key=lambda item: (-len(item[1]), item[0]))
    ):
        label = next((r.public_label for r in recs if r.public_label), "Bir gönüllü")
        label = top_contributor_label(label, idx)
        page_rows_for_volunteer = [r for r in recs if r.kind == "page"]
        box_counts = Counter(public_box_label(r.box) for r in page_rows_for_volunteer if r.box)
        top_box = box_counts.most_common(1)[0][0] if box_counts else None
        volunteer_payload.append(
            {
                "label": label,
                "records": len(recs),
                "pageRows": len(page_rows_for_volunteer),
                "activityRows": len([r for r in recs if r.kind == "activity"]),
                "pagesDone": sum(r.page_units for r in page_rows_for_volunteer),
                "topBox": f"Kutu {top_box}" if top_box else None,
                "boxes": [f"Kutu {box}" for box, _ in box_counts.most_common(3)],
            }
        )

    target_pages = inventory_totals.get("totalPages") or sum(info.target_pages for info in boxes.values())
    done_pages = sum(r.page_units for r in all_page_records)
    progress_percent = round((done_pages / target_pages) * 100, 1) if target_pages else 0
    inventory_boxes = [info for info in boxes.values() if info.target_pages or info.files or info.documents]
    completed_boxes = [info for info in inventory_boxes if info.status == "completed"]
    warnings = []
    if done_pages > target_pages > 0:
        warnings.append(
            {
                "code": "pages_done_exceeds_target",
                "message": "Recorded page units exceed the inventory target total.",
            }
        )
    over_target_boxes = [info.box for info in inventory_boxes if info.target_pages > 0 and info.done_pages > info.target_pages]
    if over_target_boxes:
        warnings.append(
            {
                "code": "box_done_exceeds_target",
                "message": f"{len(over_target_boxes)} box has more detail rows than its target.",
                "boxes": over_target_boxes[:8],
            }
        )
    missing_targets = [info.box for info in boxes.values() if info.page_rows > 0 and info.target_pages <= 0]
    if missing_targets:
        warnings.append(
            {
                "code": "missing_box_targets",
                "message": f"{len(missing_targets)} active boxes have no page target.",
                "boxes": missing_targets[:8],
            }
        )
    unsafe_count = sum(1 for r in records if r.unsafe_identifier)
    if unsafe_count:
        warnings.append(
            {
                "code": "unsafe_public_identifiers_redacted",
                "message": f"{unsafe_count} contributor values looked unsafe and were anonymized.",
            }
        )
    unknown_dates = sum(1 for r in records if not r.date)
    if unknown_dates:
        warnings.append(
            {
                "code": "unknown_dates",
                "message": f"{unknown_dates} rows could not be assigned to a public period.",
            }
        )
    if sum(day["records"] for day in by_day) != len(period_records):
        warnings.append(
            {
                "code": "by_day_total_mismatch",
                "message": "The by-day total does not equal the period record total.",
            }
        )

    busiest_day = max(by_day, key=lambda day: day["records"], default=None)
    return {
        "generatedAt": generated_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "period": period,
        "totals": {
            "records": len(period_records),
            "pageRows": len(page_records),
            "activityRows": len(activity_records),
            "periodPagesDone": sum(r.page_units for r in page_records),
            "pagesDone": done_pages,
            "pagesTarget": target_pages,
            "progressPercent": progress_percent,
            "boxesTotal": len(inventory_boxes) or None,
            "boxesCatalogued": inventory_totals.get("cataloguedBoxes") or len(inventory_boxes),
            "boxesActive": len(boxes_active_keys),
            "boxesCompleted": len(completed_boxes),
            "boxesRemaining": None,
            "volunteers": len({r.private_key for r in period_records if r.private_key}),
            "materials": len(by_material_counter),
        },
        "byDay": by_day,
        "byMaterial": material_list(by_material_counter),
        "byBox": boxes_payload,
        "byVolunteer": volunteer_payload,
        "highlights": {
            "busiestDay": busiest_day,
            "latestDate": max((r.date.isoformat() for r in period_records if r.date), default=None),
            "topMaterial": material_list(by_material_counter)[0] if by_material_counter else None,
        },
        "warnings": warnings,
        "source": {
            "recordsAreFullAggregate": True,
            "latestActivityCap": 50,
            "privacy": "Contributor names are anonymized unless an explicit public display field/consent exists.",
        },
    }


def latest_activity(records: list[SourceRecord], limit: int = 50) -> list[dict[str, Any]]:
    dated = [r for r in records if r.when]
    dated.sort(key=lambda r: r.when or datetime.min.replace(tzinfo=PUBLIC_TZ), reverse=True)
    items = []
    for rec in dated[:limit]:
        items.append(
            {
                "when": rec.when.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if rec.when else None,
                "dateISO": rec.date.isoformat() if rec.date else None,
                "kind": rec.kind,
                "recordType": rec.source_type,
                "material": rec.material,
                "projectId": rec.project_id,
                "volunteerLabel": rec.public_label,
                "boxLabel": f"Kutu {rec.box}" if rec.box else None,
                "pagesDone": rec.page_units,
            }
        )
    return items


def rolling_counts(records: list[SourceRecord], generated_at: datetime) -> dict[str, Any]:
    current = generated_at.astimezone(PUBLIC_TZ).date()
    start = current - timedelta(days=6)
    days = date_range(start, current)
    rows_by_day: dict[date, list[SourceRecord]] = defaultdict(list)
    for rec in records:
        if rec.date and start <= rec.date <= current:
            rows_by_day[rec.date].append(rec)
    return {
        "mode": "rolling_7_days",
        "startDate": start.isoformat(),
        "endDate": current.isoformat(),
        "records": sum(len(rows_by_day[day]) for day in days),
        "byDay": [{"dateISO": day.isoformat(), "records": len(rows_by_day[day])} for day in days],
    }


def parse_current_snapshot(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.__SNAPSHOT__\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def build_payload(summary: dict[str, Any], records: list[SourceRecord], content: dict[str, Any] | None = None) -> dict[str, Any]:
    totals = summary["totals"]
    return {
        "ok": True,
        "generatedAt": summary["generatedAt"],
        "data": {
            "publicSummary": summary,
            "latestActivity": latest_activity(records, 50),
            "content": content or {},
            # Minimal legacy stats shape for older previews. It intentionally
            # contains no ticker IDs or volunteer tokens.
            "stats": {
                "projects": {
                    PROJECT_ID: {
                        "totalPages": totals["pagesTarget"],
                        "donePages": totals["pagesDone"],
                        "cataloguedBoxes": totals["boxesCatalogued"],
                        "doneUnits": None,
                        "totalUnits": None,
                    }
                }
            },
            "ticker": [],
        },
    }


def write_snapshot(payload: dict[str, Any], path: Path) -> None:
    text = (
        "// Auto-generated privacy-safe snapshot — refreshed from the public sheet aggregate.\n"
        "// landing.js renders this immediately on page load (zero network),\n"
        "// then fetches the live Apps Script endpoint and overlays newer aggregate data.\n"
        "window.__SNAPSHOT__ = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    path.write_text(text, encoding="utf-8")


def validate_summary(summary: dict[str, Any], snapshot_payload: dict[str, Any] | None = None) -> list[str]:
    errors: list[str] = []
    totals = summary["totals"]
    by_day = summary.get("byDay") or []
    by_material = summary.get("byMaterial") or []
    by_volunteer = summary.get("byVolunteer") or []

    if sum(day.get("records", 0) for day in by_day) != totals.get("records"):
        errors.append("sum(byDay.records) != totals.records")

    material_expected = sum(by_material_item.get("count", 0) for by_material_item in by_material)
    if material_expected != totals.get("records", 0):
        errors.append("sum(byMaterial.count) != totals.records")
    if totals.get("records", 0) and material_expected == 0:
        errors.append("byMaterial is empty despite period records")

    for volunteer in by_volunteer:
        label = volunteer.get("label", "")
        if is_unsafe_public_identifier(label):
            errors.append(f"unsafe public volunteer label: {label}")

    for day in by_day:
        if day.get("records", 0) > 0 and day.get("volunteersCount", 0) == 0:
            errors.append(f"{day.get('dateISO')} has records but 0 volunteers")
        try:
            parsed = date.fromisoformat(day["dateISO"])
            if TR_WEEKDAYS[parsed.weekday()] != day.get("weekdayTR"):
                errors.append(f"weekday mismatch for {day.get('dateISO')}")
        except Exception:
            errors.append(f"invalid day dateISO: {day.get('dateISO')}")

    busiest = max(by_day, key=lambda d: d.get("records", 0), default=None)
    highlight = (summary.get("highlights") or {}).get("busiestDay") or {}
    if busiest and highlight and busiest.get("dateISO") != highlight.get("dateISO"):
        errors.append("busiest day highlight does not match byDay")

    if summary.get("source", {}).get("recordsAreFullAggregate") is not True:
        errors.append("summary does not declare full aggregate source")

    pages_done = totals.get("pagesDone") or 0
    pages_target = totals.get("pagesTarget") or 0
    if pages_target and pages_done > pages_target:
        errors.append("pagesDone exceeds pagesTarget")
    expected_pct = round((pages_done / pages_target) * 100, 1) if pages_target else 0
    if totals.get("progressPercent") != expected_pct:
        errors.append("progress percent is not correctly rounded")

    if snapshot_payload:
        data = snapshot_payload.get("data") or {}
        if "publicSummary" not in data:
            errors.append("snapshot is missing data.publicSummary")
        text = json.dumps(snapshot_payload, ensure_ascii=False)
        if re.search(r"sheet_[a-z0-9_]*row\d+", text, re.I):
            errors.append("snapshot exposes raw sheet row identifiers")
        if re.search(r'"volunteerToken"\s*:', text):
            errors.append("snapshot exposes volunteerToken")
        if re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text):
            errors.append("snapshot exposes an email-like value")

    return errors


def redacted_sheet_title(info: dict[str, Any]) -> str:
    title = info["title"]
    if info["classification"] == "pnb_detail":
        parts = title.split()
        if len(parts) > 2:
            return " ".join(parts[:-1] + ["[gönüllü]"])
        if len(parts) == 2:
            return f"{parts[0]} [gönüllü]"
    return title


def write_report(
    path: Path,
    workbook_file: Path,
    sheet_info: list[dict[str, Any]],
    records: list[SourceRecord],
    boxes: dict[str, BoxInfo],
    summary: dict[str, Any],
    current_snapshot: dict[str, Any] | None,
    validation_errors: list[str],
    generated_at: datetime,
) -> None:
    period_records = records_in_period(records, summary["period"])
    page_records = [r for r in records if r.kind == "page"]
    activity_records = [r for r in records if r.kind == "activity"]
    rolling = rolling_counts(records, generated_at)
    current_data = (current_snapshot or {}).get("data") or {}
    current_stats = (((current_data.get("stats") or {}).get("projects") or {}).get(PROJECT_ID) or {})
    current_ticker = current_data.get("ticker") or []
    current_weekly = current_data.get("weeklyRhythm") or []

    lines = [
        "# Public Dashboard Audit",
        "",
        f"- Workbook: `{workbook_file.name}`",
        f"- Generated at: `{summary['generatedAt']}`",
        f"- Public period: `{summary['period']['label']}` (`{summary['period']['mode']}`)",
        "",
        "## Files Responsible For The Current Public Path",
        "",
        "- Public landing HTML: `index.html`",
        "- Public CSS: `css/landing.css`",
        "- Public JS renderer: `js/landing.js`",
        "- Public config: `js/config.public.js`",
        "- Generated snapshot: `js/snapshot.js`",
        "- Google Apps Script sheet sync/public endpoint: `apps-script/SheetSync.gs`",
        "- GitHub Pages deployment/snapshot refresh: `.github/workflows/deploy.yml`",
        "",
        "## Workbook Structure",
        "",
        "| Sheet | Classification | Rows | Public headers detected |",
        "|---|---:|---:|---|",
    ]
    for info in sheet_info:
        headers = ", ".join(info["headers"][:8])
        if len(info["headers"]) > 8:
            headers += ", ..."
        lines.append(
            f"| {redacted_sheet_title(info)} | {info['classification']} | {info['rows']} | {headers} |"
        )

    lines.extend(
        [
            "",
            "## Source Counts",
            "",
            f"- Detail/page rows in workbook: **{len(page_records):,}**",
            f"- Activity rows in Günlük Akış: **{len(activity_records):,}**",
            f"- Recorded page units from detail tabs: **{sum(r.page_units for r in page_records):,}**",
            f"- Target page units from PNB summary: **{summary['totals']['pagesTarget']:,}**",
            f"- Inventory-known box rows: **{summary['totals']['boxesCatalogued']:,}**",
            f"- Completed boxes by detail/target comparison: **{summary['totals']['boxesCompleted']:,}**",
            "",
            "## Selected Period Counts",
            "",
            f"- Calendar-week records: **{summary['totals']['records']:,}**",
            f"- Calendar-week page/detail rows: **{summary['totals']['pageRows']:,}**",
            f"- Calendar-week activity rows: **{summary['totals']['activityRows']:,}**",
            f"- Calendar-week volunteers represented privately: **{summary['totals']['volunteers']:,}**",
            f"- Calendar-week active boxes: **{summary['totals']['boxesActive']:,}**",
            f"- Rolling 7-day records, computed separately: **{rolling['records']:,}**",
            "",
            "## Current Snapshot Comparison",
            "",
            f"- Checked-in snapshot ticker length: **{len(current_ticker):,}**",
            f"- Checked-in snapshot stats.donePages: **{current_stats.get('donePages', 'n/a')}**",
            f"- Checked-in snapshot stats.totalPages: **{current_stats.get('totalPages', 'n/a')}**",
            f"- Checked-in snapshot weeklyRhythm sum: **{sum(current_weekly) if current_weekly else 'n/a'}**",
            f"- Workbook-derived total page units: **{summary['totals']['pagesDone']:,}**",
            f"- Workbook-derived progress: **{summary['totals']['progressPercent']}%**",
            "",
            "## Daily Ledger Check",
            "",
            "| Date | Weekday | Records | Page/detail | Activity | Volunteers | Boxes |",
            "|---|---|---:|---:|---:|---:|---:|",
        ]
    )
    for day in summary["byDay"]:
        lines.append(
            f"| {day['dateISO']} | {day['weekdayTR']} | {day['records']} | {day['pageRows']} | {day['activityRows']} | {day['volunteersCount']} | {day['boxesCount']} |"
        )

    lines.extend(
        [
            "",
            "## Material Distribution",
            "",
            "| Material | Full-period records | Share |",
            "|---|---:|---:|",
        ]
    )
    for item in summary["byMaterial"]:
        lines.append(f"| {item['label']} | {item['count']} | {item['percent']}% |")

    lines.extend(
        [
            "",
            "## Privacy And Data Quality",
            "",
            "- Audit report redacts personal names from detail sheet titles.",
            "- Public payload labels contributors anonymously unless explicit public display/consent fields are present.",
            "- Public payload omits emails, raw sheet row IDs, volunteer tokens, and raw private contributor keys.",
            "",
            "### Warnings",
            "",
        ]
    )
    if summary["warnings"]:
        for warning in summary["warnings"]:
            lines.append(f"- `{warning['code']}`: {warning['message']}")
    else:
        lines.append("- None.")

    lines.extend(["", "### Validation", ""])
    if validation_errors:
        for err in validation_errors:
            lines.append(f"- FAIL: {err}")
    else:
        lines.append("- PASS: summary and snapshot validation checks passed.")
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None, help="Workbook path; defaults to _audit/input/*.xlsx")
    parser.add_argument("--period", choices=["calendar_week", "rolling_7_days"], default="calendar_week")
    parser.add_argument("--write-snapshot", action="store_true", help="Write js/snapshot.js from the workbook aggregate")
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    path = args.input or workbook_path()
    generated_at = datetime.now(tz=PUBLIC_TZ)
    sheet_info, rows_by_sheet = load_workbook_rows(path)
    boxes = build_inventory(rows_by_sheet)
    inventory_totals = compute_inventory_totals(rows_by_sheet)
    records = collect_records(rows_by_sheet, boxes)
    summary = build_public_summary(records, boxes, inventory_totals, generated_at, args.period)
    payload = build_payload(summary, records)

    current_snapshot = parse_current_snapshot(SNAPSHOT_PATH)
    snapshot_for_validation = payload if args.write_snapshot else (current_snapshot or payload)
    validation_errors = validate_summary(summary, snapshot_for_validation)

    print("Workbook sheets:")
    for info in sheet_info:
        print(f"- {info['title']} ({info['classification']}, rows={info['rows']})")
    print()
    print(f"Period: {summary['period']['label']}")
    print(f"Records: {summary['totals']['records']} = {summary['totals']['pageRows']} page/detail + {summary['totals']['activityRows']} activity")
    print(f"Pages: {summary['totals']['pagesDone']} / {summary['totals']['pagesTarget']} ({summary['totals']['progressPercent']}%)")
    print(f"Boxes: {summary['totals']['boxesCatalogued']} inventory-known, {summary['totals']['boxesActive']} active this period")
    print(f"Validation: {'PASS' if not validation_errors else 'FAIL'}")
    for err in validation_errors:
        print(f"  - {err}")

    if not args.validate_only:
        write_report(args.report, path, sheet_info, records, boxes, summary, current_snapshot, validation_errors, generated_at)
        print(f"Report: {args.report}")

    if args.write_snapshot:
        write_snapshot(payload, SNAPSHOT_PATH)
        written = parse_current_snapshot(SNAPSHOT_PATH)
        written_errors = validate_summary(summary, written)
        if written_errors:
            for err in written_errors:
                print(f"Snapshot validation error: {err}")
            return 1
        print(f"Snapshot: {SNAPSHOT_PATH}")

    return 1 if validation_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
