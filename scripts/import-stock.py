"""Update the public catalog snapshot from an Excel price list."""
import argparse
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workbook', type=Path)
parser.add_argument('--date', required=True, help='Snapshot date (YYYY-MM-DD)')
args = parser.parse_args()
from datetime import date
date.fromisoformat(args.date)

with zipfile.ZipFile(args.workbook) as workbook:
    strings = [
        ''.join(node.itertext()) for node in ET.fromstring(workbook.read('xl/sharedStrings.xml'))
    ] if 'xl/sharedStrings.xml' in workbook.namelist() else []
    sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet.findall('.//{*}row'):
        values = {}
        for cell in row:
            value = cell.findtext('{*}v', '')
            if cell.get('t') == 's':
                value = strings[int(value)]
            elif cell.get('t') == 'inlineStr':
                value = ''.join(cell.find('{*}is').itertext())
            values[re.match(r'[A-Z]+', cell.get('r')).group()] = value.strip()
        if any(values.values()):
            rows.append(values)

columns = {name: column for column, name in rows[0].items()}
catalog = Path(__file__).resolve().parents[1] / 'js/products-data.js'
source = catalog.read_text()
known = set(re.findall(r'\bpart: "([0-9]+)"', source))
snapshot = {}
seen = set()
unmatched = []
for row in rows[1:]:
    code = row.get(columns['Code'], '')
    if not code:
        continue
    if not code.isdecimal() or code in seen:
        raise SystemExit(f'Invalid or duplicate article: {code}')
    seen.add(code)
    price = int(row[columns['РРЦ']])
    stock = int(row[columns['Free Stock']])
    if price <= 0 or stock < 0:
        raise SystemExit(f'Invalid price or stock for {code}')
    if code in known:
        snapshot[code] = [price, stock]
    else:
        unmatched.append(code)

if not snapshot:
    raise SystemExit('No catalog articles matched')
start, end = '// BEGIN STOCK IMPORT', '// END STOCK IMPORT'
before, previous = source.split(start, 1)
_, after = previous.split(end, 1)
data = json.dumps(snapshot, indent=2)
catalog.write_text(f'{before}{start}\nconst stockSnapshot = {data};\nGEEKNOOK_DATA.stockDate = {json.dumps(args.date)};\n{end}{after}')
print(f'Matched {len(snapshot)}/{len(seen)} articles')
print('Workbook only:', ', '.join(sorted(unmatched)) or 'none')
print('Catalog only:', ', '.join(sorted(known - snapshot.keys())) or 'none')
