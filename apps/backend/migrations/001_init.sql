-- Schema sistemului de vot: nouă tabele. Singura legătură cu identitatea
-- reală e HMAC(CNP); cheia HMAC nu se află niciodată în baza de date.

CREATE TABLE elections (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'tallied')),
  opens_at    timestamptz NOT NULL,
  closes_at   timestamptz NOT NULL,
  -- Y = ΣYᵢ, publicată după ce toți trustees și-au trimis cheia
  public_key  text,
  -- criptotextele agregate per candidat, publicate la închidere
  aggregate   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE TABLE candidates (
  id           text PRIMARY KEY,
  election_id  text NOT NULL REFERENCES elections (id),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  -- ordinea definește poziția în vectorul de vot
  position     integer NOT NULL CHECK (position >= 0),
  UNIQUE (election_id, position)
);

CREATE TABLE trustees (
  id                text PRIMARY KEY,
  election_id       text NOT NULL REFERENCES elections (id),
  name              text NOT NULL,
  position          integer NOT NULL,
  -- SHA-256 al token-ului dat trustee-ului; token-ul în clar se afișează o singură dată
  token_hash        text NOT NULL,
  -- doar Yᵢ și dovada Schnorr, niciodată xᵢ
  public_key_share  text,
  key_proof         jsonb,
  UNIQUE (election_id, position)
);

CREATE TABLE eligible_voters (
  election_id  text NOT NULL REFERENCES elections (id),
  cnp_hmac     text NOT NULL,
  PRIMARY KEY (election_id, cnp_hmac)
);

CREATE TABLE registrations (
  id                 bigserial PRIMARY KEY,
  election_id        text NOT NULL,
  cnp_hmac           text NOT NULL,
  credential_pubkey  text NOT NULL,
  method             text NOT NULL CHECK (method IN ('ocr', 'nfc')),
  trust_level        text NOT NULL CHECK (trust_level IN ('optic', 'criptografic')),
  registered_at      timestamptz NOT NULL DEFAULT now(),
  -- o persoană se înregistrează o singură dată per scrutin
  UNIQUE (election_id, cnp_hmac),
  UNIQUE (election_id, credential_pubkey),
  FOREIGN KEY (election_id, cnp_hmac) REFERENCES eligible_voters (election_id, cnp_hmac)
);

-- Bulletin board-ul: append-only, fiecare intrare conține hash-ul celei anterioare.
CREATE TABLE ballots (
  election_id        text NOT NULL REFERENCES elections (id),
  seq                integer NOT NULL CHECK (seq >= 1),
  credential_pubkey  text NOT NULL,
  ciphertexts        jsonb NOT NULL,
  proofs             jsonb NOT NULL,
  signature          text NOT NULL,
  ballot_hash        text NOT NULL,
  prev_hash          text NOT NULL,
  hash               text NOT NULL UNIQUE,
  -- păstrat ca text ISO, exact cum intră în hash-ul intrării
  received_at        text NOT NULL,
  PRIMARY KEY (election_id, seq),
  -- un singur vot per credential (politica de revot din plan: primul vot contează)
  UNIQUE (election_id, credential_pubkey),
  FOREIGN KEY (election_id, credential_pubkey) REFERENCES registrations (election_id, credential_pubkey)
);

CREATE FUNCTION ballots_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bulletin board-ul este append-only: % interzis', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ballots_append_only
  BEFORE UPDATE OR DELETE ON ballots
  FOR EACH ROW EXECUTE FUNCTION ballots_append_only();

CREATE TABLE partial_decryptions (
  election_id   text NOT NULL REFERENCES elections (id),
  trustee_id    text NOT NULL REFERENCES trustees (id),
  shares        jsonb NOT NULL,
  proofs        jsonb NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (election_id, trustee_id)
);

CREATE TABLE results (
  election_id    text PRIMARY KEY REFERENCES elections (id),
  counts         jsonb NOT NULL,
  total_ballots  integer NOT NULL,
  published_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  election_id  text REFERENCES elections (id),
  actor        text NOT NULL,
  action       text NOT NULL,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_election ON audit_log (election_id, id);
