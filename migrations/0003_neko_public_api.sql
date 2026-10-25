ALTER TABLE neko_reports ADD COLUMN reporter_hash TEXT CHECK (reporter_hash IS NULL OR length(reporter_hash) = 64);
CREATE UNIQUE INDEX neko_reports_deduplicate
  ON neko_reports(publication_id, publication_revision, target_kind, reporter_hash) WHERE reporter_hash IS NOT NULL;

CREATE TABLE neko_rate_limits (
  scope TEXT NOT NULL,
  ip_hash TEXT NOT NULL CHECK (length(ip_hash) = 64),
  bucket INTEGER NOT NULL,
  used INTEGER NOT NULL CHECK (used > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(scope, ip_hash, bucket)
);
CREATE INDEX neko_rate_limits_expiry ON neko_rate_limits(expires_at);

CREATE TABLE neko_report_notifications (
  report_id INTEGER PRIMARY KEY REFERENCES neko_reports(id),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  last_error TEXT
);
CREATE TRIGGER neko_report_notification AFTER INSERT ON neko_reports
BEGIN
  INSERT INTO neko_report_notifications(report_id) VALUES(NEW.id);
END;
