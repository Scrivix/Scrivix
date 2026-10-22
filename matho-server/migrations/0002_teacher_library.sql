CREATE TABLE IF NOT EXISTS teacher_libraries (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS teacher_sets (id TEXT PRIMARY KEY, library_id TEXT NOT NULL, title TEXT NOT NULL, config TEXT NOT NULL, bank TEXT NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS teacher_sets_library ON teacher_sets(library_id);
CREATE TABLE IF NOT EXISTS teacher_set_versions (set_id TEXT NOT NULL, revision INTEGER NOT NULL, bank TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(set_id,revision));
CREATE TABLE IF NOT EXISTS teacher_library_rooms (code TEXT PRIMARY KEY, set_id TEXT NOT NULL, expires INTEGER NOT NULL);
