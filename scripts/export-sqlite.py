#!/usr/bin/env python3
"""Export the current Card Ledger SQLite DB to a JSON interchange file."""
import json, sqlite3, sys
from pathlib import Path
TABLES = ['app_user','remember_tokens','app_settings','credit_cards','upi_apps','transactions','statements','bill_payments','payment_allocations']
if len(sys.argv) < 2:
    print('Usage: python scripts/export-sqlite.py PATH_TO_app.sqlite [OUTPUT.json]')
    raise SystemExit(2)
src=Path(sys.argv[1]).expanduser().resolve()
out=Path(sys.argv[2]).expanduser().resolve() if len(sys.argv)>2 else Path('sqlite-export.json').resolve()
if not src.is_file():
    print(f'SQLite database not found: {src}'); raise SystemExit(2)
con=sqlite3.connect(f'file:{src}?mode=ro',uri=True);con.row_factory=sqlite3.Row
try:
    present={r['name'] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    data={'format':'card-ledger-sqlite-export-v1','source_file':src.name,'tables':{},'warnings':[]}
    for table in TABLES:
        if table not in present:
            data['tables'][table]=[]; continue
        cols=[r['name'] for r in con.execute(f'PRAGMA table_info("{table}")')]
        data['tables'][table]=[dict(r) for r in con.execute(f'SELECT * FROM "{table}" ORDER BY rowid')]
        data.setdefault('columns',{})[table]=cols
    txn=data['tables'].get('transactions',[])
    receipt_count=sum(bool(t.get('attachment_path')) for t in txn)
    if receipt_count: data['warnings'].append(f'{receipt_count} transaction(s) have local attachment_path values. Receipt files must be separately copied to private Cloudflare R2 and mapped before switching production.')
    data['counts']={k:len(v) for k,v in data['tables'].items()}
    out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Exported SQLite data to {out}')
    print('Row counts: '+', '.join(f'{k}={v}' for k,v in data['counts'].items()))
    for warning in data['warnings']: print('WARNING: '+warning)
finally: con.close()
