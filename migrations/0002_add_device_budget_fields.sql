PRAGMA foreign_keys=ON;

ALTER TABLE devices ADD COLUMN budget_year TEXT;
ALTER TABLE devices ADD COLUMN budget_source TEXT;
ALTER TABLE devices ADD COLUMN service_history TEXT;

CREATE INDEX IF NOT EXISTS idx_devices_budget_year ON devices(budget_year);
