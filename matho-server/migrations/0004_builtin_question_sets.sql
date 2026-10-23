CREATE TABLE IF NOT EXISTS builtin_question_sets (
 slug TEXT PRIMARY KEY,
 config TEXT NOT NULL,
 bank TEXT NOT NULL,
 updated INTEGER NOT NULL
);
