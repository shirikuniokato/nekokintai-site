-- attestation の応答が失われたときも、同じ証明だけを登録済みとして返す。
ALTER TABLE neko_device_keys ADD COLUMN attestation_digest TEXT
  CHECK (attestation_digest IS NULL OR length(attestation_digest) = 64);
