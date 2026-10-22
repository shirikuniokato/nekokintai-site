-- uid・IP の原文を保存しない。飼い主は非表示・停止後も残して再公開の迂回を防ぐ。
CREATE TABLE neko_owners (
  owner_hash TEXT PRIMARY KEY CHECK (length(owner_hash) = 64),
  public_token TEXT NOT NULL UNIQUE CHECK (length(public_token) = 64),
  suspended_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE neko_publications (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL REFERENCES neko_owners(owner_hash),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 10),
  generation TEXT NOT NULL,
  code TEXT NOT NULL CHECK (length(code) = 31),
  name TEXT NOT NULL,
  fallback_name TEXT NOT NULL,
  author TEXT NOT NULL CHECK (length(author) <= 12),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  withdrawn_at INTEGER,
  replaced_at INTEGER,
  moderated_at INTEGER,
  UNIQUE (owner_hash, slot, generation)
);

-- 枠を入れ替えた後も現在の世代を残し、古いリクエストで元へ戻させない。
CREATE TABLE neko_slots (
  owner_hash TEXT NOT NULL REFERENCES neko_owners(owner_hash),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 10),
  publication_id TEXT NOT NULL UNIQUE REFERENCES neko_publications(id),
  PRIMARY KEY (owner_hash, slot)
);

CREATE TABLE neko_likes (
  publication_id TEXT NOT NULL REFERENCES neko_publications(id),
  ip_hash TEXT NOT NULL CHECK (length(ip_hash) = 64),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (publication_id, ip_hash)
);

CREATE INDEX neko_publications_newest ON neko_publications(created_at DESC, id DESC);
CREATE INDEX neko_publications_owner ON neko_publications(owner_hash, slot);
CREATE INDEX neko_likes_recent ON neko_likes(publication_id, created_at);
