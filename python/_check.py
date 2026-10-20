import os
os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ.setdefault("ERP_DB_ENGINE", "sqlitecloud")
from utils.env_loader import require_db_url
os.environ["SQLITE_CLOUD_URL"] = require_db_url()
from database.connection import get_db

db = get_db()

print("=== EXPENSES ===")
rows = db.fetch_all("SELECT account_code, account_name, account_type FROM accounts WHERE account_type = ? ORDER BY account_code", ("EXPENSE",))
for r in rows: print(r)

print("=== 15% CODES ===")
rows2 = db.fetch_all("SELECT account_code, account_name FROM accounts WHERE account_code LIKE ? ORDER BY account_code", ("15%",))
for r in rows2: print(r)

print("=== PARTY 62 CODES ===")
rows3 = db.fetch_all("SELECT account_code, account_name FROM accounts WHERE account_code LIKE '62%' ORDER BY account_code")
for r in rows3: print(r)

print("=== 6000/6100 (selling/ga expenses) ===")
rows4 = db.fetch_all("SELECT account_code, account_name FROM accounts WHERE account_code IN ('6000','6100') ORDER BY account_code")
for r in rows4: print(r)
