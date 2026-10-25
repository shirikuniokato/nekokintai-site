-- remove は公開終了。個人情報の物理削除・保存期限は別途定義する。
ALTER TABLE neko_publications ADD COLUMN deleted_at INTEGER;
ALTER TABLE neko_owners ADD COLUMN moderation_revision INTEGER NOT NULL DEFAULT 1 CHECK (moderation_revision > 0);

CREATE TABLE neko_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  publishing_paused INTEGER NOT NULL CHECK (publishing_paused IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at INTEGER NOT NULL
);
INSERT INTO neko_settings VALUES (1, 0, 1, 0);

CREATE TABLE neko_reports (
  id INTEGER PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES neko_publications(id),
  publication_revision INTEGER NOT NULL CHECK (publication_revision > 0),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('publication', 'owner')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER CHECK (resolved_at IS NULL OR resolved_at >= created_at),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE INDEX neko_reports_pending ON neko_reports(created_at, id) WHERE resolved_at IS NULL;
CREATE INDEX neko_reports_publication ON neko_reports(publication_id);

-- 単一 INSERT と trigger 内の CAS を同じ SQL 文として確定させる。
-- 対象が古ければ ABORT し、成功していない操作を監査に残さない。
CREATE TABLE neko_operations (
  id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'unhide', 'remove', 'suspend', 'unsuspend', 'pause', 'resume', 'resolve')),
  target TEXT NOT NULL,
  expected_revision INTEGER NOT NULL CHECK (expected_revision > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  actor TEXT NOT NULL CHECK (length(trim(actor)) BETWEEN 1 AND 100),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TRIGGER neko_operation_publication AFTER INSERT ON neko_operations
WHEN NEW.action IN ('hide', 'unhide', 'remove')
BEGIN
  UPDATE neko_publications SET
    moderated_at = CASE WHEN NEW.action = 'hide' THEN NEW.created_at WHEN NEW.action = 'unhide' THEN NULL ELSE moderated_at END,
    deleted_at = CASE WHEN NEW.action = 'remove' THEN NEW.created_at ELSE deleted_at END,
    revision = revision + 1, updated_at = NEW.created_at
  WHERE id = NEW.target AND revision = NEW.expected_revision AND deleted_at IS NULL
    AND (NEW.action = 'remove' OR (NEW.action = 'hide' AND moderated_at IS NULL)
      OR (NEW.action = 'unhide' AND moderated_at IS NOT NULL));
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'operation_conflict') END;
END;

CREATE TRIGGER neko_operation_owner AFTER INSERT ON neko_operations
WHEN NEW.action IN ('suspend', 'unsuspend')
BEGIN
  UPDATE neko_owners SET
    suspended_at = CASE WHEN NEW.action = 'suspend' THEN NEW.created_at ELSE NULL END,
    moderation_revision = moderation_revision + 1
  WHERE public_token = NEW.target AND moderation_revision = NEW.expected_revision
    AND ((NEW.action = 'suspend' AND suspended_at IS NULL)
      OR (NEW.action = 'unsuspend' AND suspended_at IS NOT NULL));
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'operation_conflict') END;
END;

CREATE TRIGGER neko_operation_settings AFTER INSERT ON neko_operations
WHEN NEW.action IN ('pause', 'resume')
BEGIN
  UPDATE neko_settings SET publishing_paused = CASE WHEN NEW.action = 'pause' THEN 1 ELSE 0 END,
    revision = revision + 1, updated_at = NEW.created_at
  WHERE id = 1 AND NEW.target = 'publishing' AND revision = NEW.expected_revision
    AND ((NEW.action = 'pause' AND publishing_paused = 0)
      OR (NEW.action = 'resume' AND publishing_paused = 1));
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'operation_conflict') END;
END;

CREATE TRIGGER neko_operation_report AFTER INSERT ON neko_operations
WHEN NEW.action = 'resolve'
BEGIN
  UPDATE neko_reports SET resolved_at = NEW.created_at, revision = revision + 1
  WHERE id = NEW.target AND CAST(id AS TEXT) = NEW.target
    AND revision = NEW.expected_revision AND resolved_at IS NULL;
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'operation_conflict') END;
END;
