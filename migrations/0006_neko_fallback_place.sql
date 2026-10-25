-- 野良ねこの名前を、文字ではなく場所の番号で持つ（#262）。文字で持つと見る人の言語に訳せない。
-- 番号はサイトの辞書 assets/nekos/stray-names.mjs の placeNN の NN。
-- 並びは変えず、足すときは末尾なので、上限はここに書かない（足すたびに migration を要らなくする）。
-- name には付けた名前だけを入れ、空なら空のまま。画面は見る人の言語、OGP は日本語で組み立てる。
-- 0004 の trigger が自動名の文字を name に焼き込んでいたので、外してから作りなおす。
DROP TRIGGER neko_authenticated_mutation;

ALTER TABLE neko_publications ADD COLUMN fallback_place INTEGER CHECK (fallback_place >= 0);
ALTER TABLE neko_authenticated_mutations ADD COLUMN fallback_place INTEGER CHECK (fallback_place >= 0);

-- これまでに付けた自動名（4 言語×20）を番号にもどす。dev の D1 にはすでに文字で入った行がある。
CREATE TABLE neko_migration_0006_stray_names (name TEXT PRIMARY KEY, place INTEGER NOT NULL);
INSERT INTO neko_migration_0006_stray_names (name, place) VALUES
  ('街の野良ねこ', 0), ('海辺の野良ねこ', 1), ('路地裏の野良ねこ', 2), ('公園の野良ねこ', 3), ('屋根の上の野良ねこ', 4),
  ('塀の上の野良ねこ', 5), ('商店街の野良ねこ', 6), ('駅前の野良ねこ', 7), ('神社の野良ねこ', 8), ('川辺の野良ねこ', 9),
  ('港の野良ねこ', 10), ('坂道の野良ねこ', 11), ('縁側の野良ねこ', 12), ('橋の下の野良ねこ', 13), ('本屋の野良ねこ', 14),
  ('喫茶店の野良ねこ', 15), ('銭湯の野良ねこ', 16), ('駄菓子屋の野良ねこ', 17), ('灯台の野良ねこ', 18), ('田んぼの野良ねこ', 19),
  ('The town stray', 0), ('The seaside stray', 1), ('The back alley stray', 2), ('The park stray', 3), ('The rooftop stray', 4),
  ('The garden wall stray', 5), ('The shopping street stray', 6), ('The station stray', 7), ('The shrine stray', 8), ('The riverside stray', 9),
  ('The harbor stray', 10), ('The hillside stray', 11), ('The porch stray', 12), ('The bridge stray', 13), ('The bookshop stray', 14),
  ('The café stray', 15), ('The bathhouse stray', 16), ('The candy shop stray', 17), ('The lighthouse stray', 18), ('The rice field stray', 19),
  ('마을의 길고양이', 0), ('바닷가의 길고양이', 1), ('뒷골목의 길고양이', 2), ('공원의 길고양이', 3), ('지붕 위의 길고양이', 4),
  ('담장 위의 길고양이', 5), ('상점가의 길고양이', 6), ('역 앞의 길고양이', 7), ('신사 경내의 길고양이', 8), ('강가의 길고양이', 9),
  ('항구의 길고양이', 10), ('언덕길의 길고양이', 11), ('툇마루의 길고양이', 12), ('다리 아래의 길고양이', 13), ('서점의 길고양이', 14),
  ('카페의 길고양이', 15), ('목욕탕의 길고양이', 16), ('과자 가게의 길고양이', 17), ('등대의 길고양이', 18), ('논의 길고양이', 19),
  ('街上的浪貓', 0), ('海邊的浪貓', 1), ('巷弄的浪貓', 2), ('公園的浪貓', 3), ('屋頂的浪貓', 4),
  ('圍牆的浪貓', 5), ('商店街的浪貓', 6), ('車站前的浪貓', 7), ('神社的浪貓', 8), ('河邊的浪貓', 9),
  ('港口的浪貓', 10), ('坡道的浪貓', 11), ('緣廊的浪貓', 12), ('橋下的浪貓', 13), ('書店的浪貓', 14),
  ('咖啡店的浪貓', 15), ('澡堂的浪貓', 16), ('糖果店的浪貓', 17), ('燈塔的浪貓', 18), ('稻田的浪貓', 19);

UPDATE neko_publications SET fallback_place = (SELECT m.place FROM neko_migration_0006_stray_names m
  WHERE m.name = neko_publications.fallback_name);
UPDATE neko_publications SET name = '' WHERE name = fallback_name;
UPDATE neko_authenticated_mutations SET fallback_place = (SELECT m.place FROM neko_migration_0006_stray_names m
  WHERE m.name = neko_authenticated_mutations.fallback_name) WHERE fallback_name IS NOT NULL;

-- 番号にもどせない行があったら migration ごと止める。黙って別の場所の名前にしない。
CREATE TABLE neko_migration_0006_unmatched (unmatched INTEGER CHECK (unmatched IS NULL));
INSERT INTO neko_migration_0006_unmatched SELECT 1 FROM neko_publications WHERE fallback_place IS NULL;
INSERT INTO neko_migration_0006_unmatched SELECT 1 FROM neko_authenticated_mutations
  WHERE fallback_name IS NOT NULL AND fallback_place IS NULL;
DROP TABLE neko_migration_0006_unmatched;
DROP TABLE neko_migration_0006_stray_names;

ALTER TABLE neko_publications DROP COLUMN fallback_name;
ALTER TABLE neko_authenticated_mutations DROP COLUMN fallback_name;

-- ADD COLUMN では NOT NULL を付けられないので、新しい行は trigger で縛る。
CREATE TRIGGER neko_publication_fallback_place_required BEFORE INSERT ON neko_publications
WHEN NEW.fallback_place IS NULL
BEGIN
  SELECT RAISE(ABORT, 'fallback_place_required');
END;

-- 一度決まった場所は変えない（再公開・編集・運営の操作でも）。
CREATE TRIGGER neko_publication_fallback_place_fixed BEFORE UPDATE OF fallback_place ON neko_publications
WHEN NEW.fallback_place IS NOT OLD.fallback_place
BEGIN
  SELECT RAISE(ABORT, 'fallback_place_fixed');
END;

-- 0004 と同じ。ちがうのは name に自動名を入れないことと、fallback_place を新しい行にだけ入れること（同じ世代の更新では触らない）。
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

  UPDATE neko_publications SET code = NEW.code, name = NEW.name,
    author = NEW.author, updated_at = NEW.created_at, withdrawn_at = NULL, revision = revision + 1
  WHERE NEW.action = 'publish' AND NEW.generation IS NEW.expected_generation
    AND id = NEW.publication_id AND owner_hash = NEW.owner_hash AND slot = NEW.slot
    AND generation = NEW.generation AND revision = NEW.expected_revision
    AND replaced_at IS NULL AND moderated_at IS NULL AND deleted_at IS NULL;
  SELECT CASE WHEN NEW.action = 'publish' AND NEW.generation IS NEW.expected_generation
    AND changes() != 1 THEN RAISE(ABORT, 'publication_conflict') END;

  INSERT INTO neko_publications (id, owner_hash, slot, generation, code, name, author, fallback_place, created_at, updated_at)
  SELECT NEW.publication_id, NEW.owner_hash, NEW.slot, NEW.generation, NEW.code,
    NEW.name, NEW.author, NEW.fallback_place, NEW.created_at, NEW.created_at
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
      'code', p.code, 'name', p.name, 'fallbackPlace', p.fallback_place, 'author', p.author, 'withdrawnAt', p.withdrawn_at,
      'replacedAt', p.replaced_at, 'moderatedAt', p.moderated_at, 'deletedAt', p.deleted_at)
      FROM neko_slots s JOIN neko_publications p ON p.id = s.publication_id
      WHERE s.owner_hash = NEW.owner_hash AND s.slot = NEW.slot)
  WHERE id = NEW.id;
  SELECT CASE WHEN NEW.action != 'read' AND
    (SELECT result_revision FROM neko_authenticated_mutations WHERE id = NEW.id) IS NULL
    THEN RAISE(ABORT, 'publication_conflict') END;
END;
