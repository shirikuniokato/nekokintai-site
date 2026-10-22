CREATE TABLE neko_runtime (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  environment TEXT NOT NULL CHECK (environment IN ('production', 'development'))
);
INSERT INTO neko_runtime VALUES (1, 'production');

CREATE TABLE neko_device_keys (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL REFERENCES neko_owners(owner_hash),
  public_key TEXT NOT NULL,
  attestation_challenge_id TEXT NOT NULL UNIQUE,
  counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE neko_challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('attest', 'mutation', 'read')),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'development')),
  owner_hash TEXT NOT NULL REFERENCES neko_owners(owner_hash),
  key_id TEXT,
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
  payload_json TEXT NOT NULL,
  client_data_hash TEXT NOT NULL CHECK (length(client_data_hash) = 64),
  expires_at INTEGER NOT NULL,
  consumed_by TEXT
);
CREATE INDEX neko_challenges_expiry ON neko_challenges(expires_at);

CREATE TABLE neko_authenticated_mutations (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL REFERENCES neko_owners(owner_hash),
  proof_kind TEXT NOT NULL CHECK (proof_kind IN ('ios', 'android', 'development')),
  key_id TEXT,
  previous_counter INTEGER,
  new_counter INTEGER,
  challenge_id TEXT NOT NULL UNIQUE REFERENCES neko_challenges(id),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
  client_data_hash TEXT NOT NULL CHECK (length(client_data_hash) = 64),
  proof_digest TEXT NOT NULL UNIQUE CHECK (length(proof_digest) = 64),
  action TEXT NOT NULL CHECK (action IN ('publish', 'withdraw', 'retire', 'read')),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 10),
  generation TEXT NOT NULL,
  expected_generation TEXT,
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  publication_id TEXT NOT NULL,
  code TEXT,
  name TEXT,
  author TEXT,
  fallback_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  result_id TEXT,
  result_revision INTEGER,
  result_json TEXT,
  CHECK ((proof_kind = 'ios' AND key_id IS NOT NULL AND previous_counter >= 0 AND new_counter > previous_counter)
    OR (proof_kind IN ('android', 'development') AND key_id IS NULL AND previous_counter IS NULL AND new_counter IS NULL))
);

-- proof の消費と実際の保存は別々に確定させない。どの段階の競合でも文全体を取り消す。
CREATE TRIGGER neko_authenticated_mutation AFTER INSERT ON neko_authenticated_mutations
BEGIN
  SELECT CASE WHEN NEW.proof_kind = 'development' AND NOT EXISTS
    (SELECT 1 FROM neko_runtime WHERE id = 1 AND environment = 'development')
    THEN RAISE(ABORT, 'development_proof_forbidden') END;
  UPDATE neko_challenges SET consumed_by = NEW.id
  WHERE id = NEW.challenge_id AND purpose = CASE WHEN NEW.action = 'read' THEN 'read' ELSE 'mutation' END
    AND platform = NEW.proof_kind AND owner_hash = NEW.owner_hash
    AND key_id IS NEW.key_id AND payload_digest = NEW.payload_digest AND client_data_hash = NEW.client_data_hash
    AND expires_at > NEW.created_at AND consumed_by IS NULL;
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'challenge_conflict') END;

  UPDATE neko_device_keys SET counter = NEW.new_counter
  WHERE NEW.proof_kind = 'ios' AND id = NEW.key_id AND owner_hash = NEW.owner_hash
    AND counter = NEW.previous_counter AND NEW.new_counter > counter;
  SELECT CASE WHEN NEW.proof_kind = 'ios' AND changes() != 1 THEN RAISE(ABORT, 'counter_conflict') END;

  SELECT CASE WHEN NEW.action = 'publish' AND NOT EXISTS (
    SELECT 1 FROM neko_owners o, neko_settings s WHERE o.owner_hash = NEW.owner_hash
      AND o.suspended_at IS NULL AND s.id = 1 AND s.publishing_paused = 0
  ) THEN RAISE(ABORT, 'publishing_unavailable') END;

  SELECT CASE WHEN NEW.action != 'read' AND NOT (
    (NEW.expected_generation IS NULL AND NEW.expected_revision = 0
      AND NOT EXISTS (SELECT 1 FROM neko_slots WHERE owner_hash = NEW.owner_hash AND slot = NEW.slot))
    OR EXISTS (SELECT 1 FROM neko_slots s JOIN neko_publications p ON p.id = s.publication_id
      WHERE s.owner_hash = NEW.owner_hash AND s.slot = NEW.slot
        AND p.generation = NEW.expected_generation AND p.revision = NEW.expected_revision)
  ) THEN RAISE(ABORT, 'publication_conflict') END;

  UPDATE neko_publications SET code = NEW.code, name = coalesce(nullif(NEW.name, ''), fallback_name),
    author = NEW.author, updated_at = NEW.created_at, withdrawn_at = NULL, revision = revision + 1
  WHERE NEW.action = 'publish' AND NEW.generation IS NEW.expected_generation
    AND id = NEW.publication_id AND owner_hash = NEW.owner_hash AND slot = NEW.slot
    AND generation = NEW.generation AND revision = NEW.expected_revision
    AND replaced_at IS NULL AND moderated_at IS NULL AND deleted_at IS NULL;
  SELECT CASE WHEN NEW.action = 'publish' AND NEW.generation IS NEW.expected_generation
    AND changes() != 1 THEN RAISE(ABORT, 'publication_conflict') END;

  INSERT INTO neko_publications (id, owner_hash, slot, generation, code, name, author, fallback_name, created_at, updated_at)
  SELECT NEW.publication_id, NEW.owner_hash, NEW.slot, NEW.generation, NEW.code,
    coalesce(nullif(NEW.name, ''), NEW.fallback_name), NEW.author, NEW.fallback_name, NEW.created_at, NEW.created_at
  WHERE NEW.action = 'publish' AND NEW.generation IS NOT NEW.expected_generation;

  UPDATE neko_publications SET replaced_at = NEW.created_at, revision = revision + 1
  WHERE NEW.action = 'publish' AND NEW.generation IS NOT NEW.expected_generation
    AND id = (SELECT publication_id FROM neko_slots WHERE owner_hash = NEW.owner_hash AND slot = NEW.slot);

  INSERT INTO neko_slots(owner_hash, slot, publication_id)
  SELECT NEW.owner_hash, NEW.slot, NEW.publication_id
  WHERE NEW.action = 'publish' AND NEW.generation IS NOT NEW.expected_generation
  ON CONFLICT(owner_hash, slot) DO UPDATE SET publication_id = excluded.publication_id;

  UPDATE neko_publications SET
    withdrawn_at = CASE WHEN NEW.action = 'withdraw' THEN NEW.created_at ELSE withdrawn_at END,
    replaced_at = CASE WHEN NEW.action = 'retire' THEN NEW.created_at ELSE replaced_at END,
    updated_at = NEW.created_at, revision = revision + 1
  WHERE NEW.action IN ('withdraw', 'retire') AND id = NEW.publication_id AND owner_hash = NEW.owner_hash
    AND slot = NEW.slot AND generation = NEW.generation AND revision = NEW.expected_revision AND replaced_at IS NULL;
  SELECT CASE WHEN NEW.action IN ('withdraw', 'retire') AND changes() != 1 THEN RAISE(ABORT, 'publication_conflict') END;

  UPDATE neko_authenticated_mutations SET result_id = NEW.publication_id,
    result_revision = (SELECT revision FROM neko_publications WHERE id = NEW.publication_id),
    result_json = (SELECT json_object('id', p.id, 'generation', p.generation, 'revision', p.revision,
      'code', p.code, 'name', p.name, 'author', p.author, 'withdrawnAt', p.withdrawn_at,
      'replacedAt', p.replaced_at, 'moderatedAt', p.moderated_at, 'deletedAt', p.deleted_at)
      FROM neko_slots s JOIN neko_publications p ON p.id = s.publication_id
      WHERE s.owner_hash = NEW.owner_hash AND s.slot = NEW.slot)
  WHERE id = NEW.id;
  SELECT CASE WHEN NEW.action != 'read' AND
    (SELECT result_revision FROM neko_authenticated_mutations WHERE id = NEW.id) IS NULL
    THEN RAISE(ABORT, 'publication_conflict') END;
END;

CREATE TRIGGER neko_device_attestation AFTER INSERT ON neko_device_keys
BEGIN
  UPDATE neko_challenges SET consumed_by = 'key:' || NEW.id
  WHERE id = NEW.attestation_challenge_id AND purpose = 'attest' AND platform = 'ios'
    AND owner_hash = NEW.owner_hash AND key_id = NEW.id AND consumed_by IS NULL
    AND expires_at > NEW.created_at;
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'challenge_conflict') END;
END;
