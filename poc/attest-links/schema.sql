CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('attest','assert','integrity')),
  key_id TEXT,
  client_data_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE ios_keys (
  key_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  attestation_challenge_id TEXT NOT NULL UNIQUE REFERENCES challenges(id),
  verified_at INTEGER NOT NULL
);
CREATE TABLE ios_assertion_receipts (
  challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),
  key_id TEXT NOT NULL REFERENCES ios_keys(key_id),
  counter INTEGER NOT NULL CHECK (counter > 0),
  client_data_hash TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  UNIQUE(key_id, counter)
);
CREATE TABLE android_receipts (
  challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),
  verified_at INTEGER NOT NULL
);
CREATE TABLE request_buckets (
  minute INTEGER PRIMARY KEY,
  used INTEGER NOT NULL
);
