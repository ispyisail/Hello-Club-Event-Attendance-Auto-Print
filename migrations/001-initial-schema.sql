-- Up
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- Down
DROP TABLE events;
