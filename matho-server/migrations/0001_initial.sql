CREATE TABLE IF NOT EXISTS rooms (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, generation TEXT NOT NULL, expires INTEGER NOT NULL,
 host_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 id TEXT NOT NULL, token_hash TEXT NOT NULL, seen INTEGER NOT NULL,
 PRIMARY KEY(room,id)
);
CREATE TABLE IF NOT EXISTS messages (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 sender TEXT NOT NULL, recipient TEXT NOT NULL, request_id TEXT NOT NULL,
 kind TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL,
 UNIQUE(room,sender,request_id)
);
CREATE INDEX IF NOT EXISTS inbox ON messages(room,recipient,seq);
CREATE INDEX IF NOT EXISTS message_expiry ON messages(created);
CREATE INDEX IF NOT EXISTS room_expiry ON rooms(expires);
CREATE INDEX IF NOT EXISTS active_sessions ON sessions(room,seen);
