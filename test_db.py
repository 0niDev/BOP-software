import sqlitecloud

DB_URL = "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"

def test_connection():
    try:
        conn = sqlitecloud.connect(DB_URL)
        
        # Test items
        items = conn.execute("SELECT COUNT(*) as count FROM items").fetchone()
        print(f"✅ Items in cloud: {items[0]}")
        
        # Test parties
        parties = conn.execute("SELECT COUNT(*) as count FROM parties").fetchone()
        print(f"✅ Parties in cloud: {parties[0]}")
        
        # Get sample items
        sample = conn.execute("SELECT * FROM items LIMIT 3").fetchall()
        columns = [desc[0] for desc in conn.execute("SELECT * FROM items LIMIT 1").description]
        print("\n📦 Sample items:")
        for row in sample:
            print(f"  {dict(zip(columns, row))}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_connection()