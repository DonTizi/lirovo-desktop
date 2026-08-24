/**
 * Forward-only schema migrations.
 *
 * Each entry runs inside one transaction and bumps `user_version`. Nothing is
 * ever edited in place: a user who upgrades and then rolls back must still find
 * a database the old build can open, which is only true if migrations only add.
 */
export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      // ---- sources -------------------------------------------------------
      // Identity is the content hash: the same bytes ingested twice are one
      // source, however they were named or wherever they came from.
      `CREATE TABLE sources (
        id             TEXT PRIMARY KEY,
        kind           TEXT NOT NULL CHECK (kind IN ('url','file')),
        uri            TEXT NOT NULL,
        content_sha256 TEXT,
        title          TEXT,
        duration_s     REAL,
        has_audio      INTEGER NOT NULL CHECK (has_audio IN (0,1)),
        has_video      INTEGER NOT NULL CHECK (has_video IN (0,1)),
        created_at     INTEGER NOT NULL
      )`,
      `CREATE INDEX ix_sources_hash ON sources(content_sha256)`,

      // ---- schemas -------------------------------------------------------
      // The parent is mutable only in WHERE IT POINTS. A revision is frozen
      // the moment it is written, so publishing is moving a pointer rather
      // than editing a row that claims to be immutable.
      `CREATE TABLE schemas (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL UNIQUE,
        description          TEXT,
        published_revision   TEXT,
        created_at           INTEGER NOT NULL,
        archived_at          INTEGER
      )`,
      `CREATE TABLE schema_revisions (
        id            TEXT PRIMARY KEY,
        schema_id     TEXT NOT NULL REFERENCES schemas(id),
        version       INTEGER NOT NULL,
        json_schema   TEXT NOT NULL,
        schema_sha256 TEXT NOT NULL,
        change_reason TEXT,
        created_at    INTEGER NOT NULL,
        UNIQUE (schema_id, version)
      )`,

      // ---- runs ----------------------------------------------------------
      // A job IS a run. There is no second table that would be one-to-one with
      // this one, because artifacts and stages hang off the run and a second
      // execution has to be able to coexist with the first.
      `CREATE TABLE runs (
        id                 TEXT PRIMARY KEY,
        source_id          TEXT NOT NULL REFERENCES sources(id),
        schema_revision_id TEXT REFERENCES schema_revisions(id),
        status             TEXT NOT NULL CHECK (status IN ('claimed','running','succeeded','failed','cancelled')),
        stage_pointer      TEXT,
        error_code         TEXT,
        error_message      TEXT,
        lease_owner        TEXT,
        lease_expires_at   INTEGER,
        created_at         INTEGER NOT NULL,
        started_at         INTEGER,
        finished_at        INTEGER
      )`,
      `CREATE INDEX ix_runs_source ON runs(source_id, created_at DESC)`,
      `CREATE INDEX ix_runs_active ON runs(status, lease_expires_at)`,

      // One row per ATTEMPT. A retry that overwrote the first attempt would
      // erase the only record of why the first one failed.
      `CREATE TABLE run_stage_attempts (
        run_id        TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        stage         TEXT NOT NULL,
        attempt       INTEGER NOT NULL CHECK (attempt >= 1),
        input_hash    TEXT NOT NULL,
        status        TEXT NOT NULL CHECK (status IN ('running','done','failed','degraded')),
        output_json   TEXT,
        error_code    TEXT,
        error_message TEXT,
        started_at    INTEGER NOT NULL,
        finished_at   INTEGER,
        PRIMARY KEY (run_id, stage, attempt)
      )`,

      `CREATE TABLE artifacts (
        id           TEXT PRIMARY KEY,
        run_id       TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        kind         TEXT NOT NULL,
        rel_path     TEXT NOT NULL,
        sha256       TEXT NOT NULL,
        bytes        INTEGER NOT NULL CHECK (bytes >= 0),
        content_type TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        UNIQUE (run_id, rel_path)
      )`,

      // Everything needed to explain a run and to run it again. Prompts are
      // stored whole: a model alias and a prompt hash do not reproduce
      // anything, because the prompt ASSEMBLER changes behaviour with no
      // version bump anywhere.
      `CREATE TABLE run_manifests (
        run_id              TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
        source_sha256       TEXT,
        schema_revision_id  TEXT,
        schema_json         TEXT,
        prompts_json        TEXT NOT NULL,
        asr_engine          TEXT,
        asr_model           TEXT,
        inference_backend   TEXT,
        inference_model     TEXT,
        backend_version     TEXT,
        dependencies_json   TEXT NOT NULL,
        settings_json       TEXT NOT NULL,
        created_at          INTEGER NOT NULL
      )`,

      // ---- evidence and values -------------------------------------------
      `CREATE TABLE evidence (
        id         TEXT PRIMARY KEY,
        run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        modality   TEXT NOT NULL CHECK (modality IN ('audio','visual','both')),
        source_ref TEXT NOT NULL,
        t_start    REAL NOT NULL,
        t_end      REAL NOT NULL,
        quote      TEXT,
        node_key   TEXT
      )`,
      `CREATE INDEX ix_evidence_run ON evidence(run_id, t_start)`,

      // `observation_id` always; `proposition_key` only when the schema
      // declares an identity rule. The financial claim id it descends from
      // carries nine dimensions — entity, metric, period, basis, unit,
      // currency and so on — that arbitrary video JSON simply does not have,
      // so a mandatory identity here would be precision we cannot back.
      `CREATE TABLE extracted_values (
        observation_id           TEXT PRIMARY KEY,
        run_id                   TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        field_path               TEXT NOT NULL,
        value_json               TEXT NOT NULL,
        proposition_key          TEXT,
        retracts_observation_id  TEXT REFERENCES extracted_values(observation_id),
        created_at               INTEGER NOT NULL
      )`,
      `CREATE INDEX ix_values_run ON extracted_values(run_id)`,
      `CREATE INDEX ix_values_proposition ON extracted_values(proposition_key)`,

      `CREATE TABLE value_evidence (
        observation_id TEXT NOT NULL REFERENCES extracted_values(observation_id) ON DELETE CASCADE,
        evidence_id    TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
        role           TEXT NOT NULL CHECK (role IN ('value','context','definition')),
        PRIMARY KEY (observation_id, evidence_id, role)
      )`,

      // Four audited axes, and a queue position derived from them. Deliberately
      // not a probability: the upstream system this descends from names its own
      // equivalent "not a calibrated probability", and a slide plus the
      // narration describing it are two correlated encodings of one source, not
      // two independent witnesses.
      `CREATE TABLE review_signals (
        observation_id     TEXT PRIMARY KEY REFERENCES extracted_values(observation_id) ON DELETE CASCADE,
        evidence_coverage  TEXT NOT NULL CHECK (evidence_coverage IN ('none','single','multiple')),
        evidence_modalities INTEGER NOT NULL CHECK (evidence_modalities BETWEEN 0 AND 2),
        evidence_quality   TEXT NOT NULL CHECK (evidence_quality IN ('verbatim','ocr_uncertain','inferred')),
        consistency        TEXT NOT NULL CHECK (consistency IN ('agree','conflict','retracted')),
        mapping_status     TEXT NOT NULL CHECK (mapping_status IN ('matched','provisional','unmapped')),
        review_priority    INTEGER NOT NULL,
        priority_version   INTEGER NOT NULL CHECK (priority_version >= 1)
      )`,
      `CREATE INDEX ix_signals_queue ON review_signals(review_priority DESC)`,

      // Append-only. A mutable review_state column would destroy the record of
      // who accepted what, against which schema revision and which evidence.
      `CREATE TABLE review_events (
        id                 TEXT PRIMARY KEY,
        observation_id     TEXT NOT NULL REFERENCES extracted_values(observation_id) ON DELETE CASCADE,
        decision           TEXT NOT NULL CHECK (decision IN ('approved','rejected','reopened')),
        actor              TEXT NOT NULL,
        note               TEXT,
        schema_revision_id TEXT,
        created_at         INTEGER NOT NULL
      )`,
      `CREATE INDEX ix_review_events_obs ON review_events(observation_id, created_at)`,

      // The current decision as a view over the events, so there is exactly one
      // place the answer comes from.
      `CREATE VIEW review_state AS
        SELECT observation_id,
               (SELECT decision FROM review_events e2
                 WHERE e2.observation_id = e1.observation_id
                 ORDER BY created_at DESC, id DESC LIMIT 1) AS decision,
               MAX(created_at) AS decided_at
          FROM review_events e1
         GROUP BY observation_id`,
    ],
  },
];
