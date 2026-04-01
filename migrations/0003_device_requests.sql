PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS device_requests (
  samsat_id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  stock_status TEXT NOT NULL,
  kabid_status TEXT NOT NULL,
  kabid_approved_count INTEGER,
  sekban_status TEXT NOT NULL,
  sekban_approved_count INTEGER,
  added_device_ids_json TEXT NOT NULL,
  finalized_at TEXT,
  letter_file_name TEXT,
  letter_mime_type TEXT,
  letter_uploaded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (samsat_id) REFERENCES samsat(id)
);

CREATE INDEX IF NOT EXISTS idx_device_requests_updated_at ON device_requests(updated_at);
