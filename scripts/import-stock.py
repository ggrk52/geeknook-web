"""Update warehouse stock snapshot:
- Writes full confidential baseline (without wholesale Otgruzka) to local gitignored data/stock.json.
- Writes capped public fallback (<= 6 per SKU, no initialStock/initialSpent) to js/products-data.js.
- Optionally pushes full stock table to Cloudflare Worker (--push-worker URL).
"""
import argparse
import csv
import getpass
import hashlib
import json
import os
import re
import urllib.error
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path

PUBLIC_STOCK_CAP = 6


def parse_xlsx_rows(workbook_path: Path):
    with zipfile.ZipFile(workbook_path) as workbook:
        strings = (
            ["".join(node.itertext()) for node in ET.fromstring(workbook.read("xl/sharedStrings.xml"))]
            if "xl/sharedStrings.xml" in workbook.namelist()
            else []
        )
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        raw_rows = []
        for row in sheet.findall(".//{*}row"):
            values = {}
            for cell in row:
                value = cell.findtext("{*}v", "")
                if cell.get("t") == "s":
                    value = strings[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(cell.find("{*}is").itertext())
                col = re.match(r"[A-Z]+", cell.get("r")).group()
                values[col] = value.strip()
            if any(values.values()):
                raw_rows.append(values)

    if not raw_rows:
        return []
    header = raw_rows[0]
    return [{col_name: row.get(col_letter, "") for col_letter, col_name in header.items()} for row in raw_rows[1:]]


def parse_csv_rows(csv_path: Path):
    text = csv_path.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    return [{k.strip(): (v or "").strip() for k, v in row.items() if k} for row in reader]


def infer_category(description: str) -> str:
    lower = description.lower()
    if "подставка под монитор" in lower or "focus station" in lower:
        return "Подставки"
    if "коврик" in lower or "mouse pad" in lower:
        return "Коврики"
    return "Кронштейны и модули"


def parse_int(val, default=None):
    raw = str(val if val is not None else "").strip()
    if not raw and default is not None:
        return default
    if not re.fullmatch(r"[0-9]+(?:[.,]0+)?", raw):
        raise SystemExit("Expected a non-negative whole number")
    result = int(re.split(r"[,.]", raw)[0])
    if result > 9007199254740991:
        raise SystemExit("Quantity or price is too large")
    return result


def push_to_worker(worker_url, stock_doc, admin_key, keep_deductions, permitted_removals):
    parsed = urllib.parse.urlsplit(worker_url)
    official = "https://geeknook-stock.sergeykozlov2006.workers.dev"
    if (f"{parsed.scheme}://{parsed.netloc}" != official and
            not (parsed.hostname in ("localhost", "127.0.0.1") and parsed.scheme in ("https", "http"))):
        raise SystemExit("Unknown stock service address")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path.rstrip("/") not in ("", "/admin/seed"):
        raise SystemExit("Invalid stock service URL")
    base = f"{parsed.scheme}://{parsed.netloc}"

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect())
    def post(action, fields):
        req = urllib.request.Request(base, data=json.dumps({"action": action, **fields}).encode(),
            headers={"Content-Type": "application/json", "X-Admin-Key": admin_key})
        try:
            with opener.open(req, timeout=20) as resp:
                result = json.load(resp)
        except urllib.error.HTTPError as err:
            raise SystemExit(f"Worker HTTP {err.code}: " + err.read(1000).decode(errors="replace"))
        if result.get("ok") is not True:
            raise SystemExit("Worker did not acknowledge operation")
        return result

    before = post("admin_list", {})
    if "revision" not in before:
        raise SystemExit("Deploy the versioned stock Worker before importing")
    removed = sorted(before["items"].keys() - stock_doc["items"].keys())
    if set(removed) - permitted_removals:
        raise SystemExit("Missing SKUs on Worker (use --remove-code for each intended removal): " + ", ".join(removed))
    result = post("seed", {"stockDate": stock_doc["stockDate"], "snapshotHash": stock_doc["snapshotHash"],
        "items": stock_doc["items"], "keepDeductions": keep_deductions, "expectedRevision": before["revision"],
        "confirmRemoved": removed})
    print(f"Synced {result['imported']} SKUs to Cloudflare Worker")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_file", type=Path, help="Path to .xlsx or .csv stock price list")
    parser.add_argument("--date", default=date.today().isoformat(), help="Snapshot date (YYYY-MM-DD)")
    parser.add_argument("--push-worker", default="", help="Cloudflare Worker URL to push full stock table")
    parser.add_argument("--keep-deductions", action="store_true", help="Preserve order deductions on Worker during seed")
    parser.add_argument("--remove-code", action="append", default=[], help="Confirm intentional removal of one SKU")
    args = parser.parse_args()
    date.fromisoformat(args.date)

    suffix = args.source_file.suffix.lower()
    if suffix == ".xlsx":
        rows = parse_xlsx_rows(args.source_file)
    elif suffix == ".csv":
        rows = parse_csv_rows(args.source_file)
    else:
        raise SystemExit(f"Unsupported format: {suffix}. Expected .xlsx or .csv")

    if not rows:
        raise SystemExit("No rows found in stock table")

    repo_root = Path(__file__).resolve().parents[1]
    catalog = repo_root / "js" / "products-data.js"
    data_dir = repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    stock_json_path = data_dir / "stock.json"

    catalog_source = catalog.read_text(encoding="utf-8")
    known = set(re.findall(r'\bpart:\s*"([0-9]+)"', catalog_source))

    public_snapshot = {}
    full_items = {}
    seen = set()
    unmatched = []

    for row in rows:
        code = str(row.get("Code", "")).strip()
        if not re.fullmatch(r"[0-9]{1,32}", code) or code in seen:
            raise SystemExit(f"Invalid or duplicate article: {code}")
        seen.add(code)

        description = str(row.get("Description", "")).strip() or f"Товар {code}"
        price = parse_int(row.get("РРЦ"))
        free_stock = parse_int(row.get("Free Stock"))
        spent = parse_int(row.get("Расход"), 0)

        if price <= 0 or free_stock < 0 or spent < 0:
            raise SystemExit(f"Invalid price, stock, or spent value for {code}")

        initial_stock = free_stock + spent
        category = infer_category(description)

        # Full inventory stored strictly in local gitignored data/stock.json & Cloudflare Durable Object
        full_items[code] = {
            "code": code,
            "name": description,
            "category": category,
            "price": price,
            "initialStock": initial_stock,
            "initialSpent": spent,
            "stock": free_stock,
        }

        capped_stock = min(free_stock, PUBLIC_STOCK_CAP)
        if code in known:
            public_snapshot[code] = [price, capped_stock, 0]
        else:
            unmatched.append(code)

    if not public_snapshot:
        raise SystemExit("No catalog articles matched")

    hash_payload = json.dumps({"stockDate": args.date, "items": full_items}, sort_keys=True, ensure_ascii=False)
    snapshot_hash = hashlib.sha256(hash_payload.encode("utf-8")).hexdigest()[:16]

    stock_doc = {
        "stockDate": args.date,
        "snapshotHash": snapshot_hash,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalSkus": len(full_items),
        "items": full_items,
    }
    permitted_removals = set(args.remove_code)
    if stock_json_path.exists():
        previous_items = json.loads(stock_json_path.read_text(encoding="utf-8"))["items"]
        missing = previous_items.keys() - full_items.keys() - permitted_removals
        if missing:
            raise SystemExit("Missing SKUs (use --remove-code for intended removals): " + ", ".join(sorted(missing)))

    # Public catalog snapshot exposes only price + availability capped at PUBLIC_STOCK_CAP (6 = "6+ in stock")
    public_meta = {
        code: {
            "name": entry["name"],
            "category": entry["category"],
            "price": entry["price"],
            "stock": min(entry["stock"], PUBLIC_STOCK_CAP),
            "capped": entry["stock"] >= PUBLIC_STOCK_CAP,
        }
        for code, entry in full_items.items()
    }

    start, end = "// BEGIN STOCK IMPORT", "// END STOCK IMPORT"
    before, previous = catalog_source.split(start, 1)
    _, after = previous.split(end, 1)

    block = "\n".join(
        [
            start,
            f"const stockSnapshot = {json.dumps(public_snapshot, indent=2, ensure_ascii=False)};",
            f"const stockCatalogTable = {json.dumps(public_meta, indent=2, ensure_ascii=False)};",
            f"GEEKNOOK_DATA.stockDate = {json.dumps(args.date)};",
            f"GEEKNOOK_DATA.stockSnapshotHash = {json.dumps(snapshot_hash)};",
            end,
        ]
    )
    if args.push_worker:
        admin_key = os.environ.get("STOCK_ADMIN_KEY", "").strip()
        if not admin_key:
            admin_key = getpass.getpass("Cloudflare Worker STOCK_ADMIN_KEY: ").strip()
        if not admin_key:
            raise SystemExit("STOCK_ADMIN_KEY is required for --push-worker")
        push_to_worker(args.push_worker, stock_doc, admin_key, args.keep_deductions, permitted_removals)

    stock_json_path.write_text(json.dumps(stock_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    catalog.write_text(f"{before}{block}{after}", encoding="utf-8")

    print(f"Matched {len(public_snapshot)}/{len(seen)} catalog articles -> {stock_json_path.relative_to(repo_root)} (local only)")
    print(f"Public JS snapshot capped at {PUBLIC_STOCK_CAP} pcs per SKU -> js/products-data.js")
    print("Workbook only:", ", ".join(sorted(unmatched)) or "none")
    print("Catalog only:", ", ".join(sorted(known - public_snapshot.keys())) or "none")



if __name__ == "__main__":
    main()
