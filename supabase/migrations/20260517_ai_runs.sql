-- Phase 9: AI Copilot usage log
CREATE TABLE IF NOT EXISTS ai_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  kind        TEXT NOT NULL,        -- 'draft_email' | 'draft_reply' | 'summarize' | 'gap_analysis' | 'auto_tag'
  input_hash  TEXT,                 -- SHA-256 of the input for cache hit detection
  output      TEXT,
  model       TEXT,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  cost_usd    NUMERIC(10, 6),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_user_created ON ai_runs(user_id, created_at DESC);
