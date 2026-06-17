import sqlite3
conn = sqlite3.connect("moneyhunter.db")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cur.fetchall())
cur.execute("SELECT chat_id, username, first_name, is_group FROM subscribers")
rows = cur.fetchall()
print("Subscribers:", rows)
conn.close()
