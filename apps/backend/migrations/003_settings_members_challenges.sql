-- Votul alb (un „candidat” special), membrii comisiei cu roluri și provocările de
-- autentificare păstrate în bază (ca serverul să poată fi repornit sau rulat în mai multe instanțe).

ALTER TABLE candidates
  ADD COLUMN kind text NOT NULL DEFAULT 'candidate' CHECK (kind IN ('candidate', 'blank'));

-- Membrii comisiei: ADMIN_TOKEN rămâne „rădăcina”; cu el se creează membri cu token propriu.
-- Serverul păstrează doar SHA-256 al token-ului, ca la trustees.
CREATE TABLE commission_members (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('comisie', 'observator')),
  token_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- Provocările de autentificare ale alegătorilor (nonce-ul semnat de telefon), valabile 2 minute.
CREATE TABLE auth_challenges (
  id                 text PRIMARY KEY,
  election_id        text NOT NULL REFERENCES elections (id) ON DELETE CASCADE,
  credential_pubkey  text NOT NULL,
  nonce              text NOT NULL,
  expires_at         timestamptz NOT NULL
);

CREATE INDEX auth_challenges_expires ON auth_challenges (expires_at);

ALTER TABLE commission_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
