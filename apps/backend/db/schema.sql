-- Schema PostgreSQL a sistemului de vot (merge în Supabase: SQL Editor → New query → lipești tot → Run).
-- Nouă tabele, ca în plan. Singura legătură cu identitatea reală e cnp_hmac = HMAC-SHA256(cheie, CNP);
-- cheia HMAC stă în variabila de mediu CNP_HMAC_KEY a backend-ului, niciodată în baza de date.
--
-- Scriptul poate fi rulat de mai multe ori (create … if not exists).

create table if not exists elections (
  id                  text primary key,
  title               text        not null,
  status              text        not null default 'draft' check (status in ('draft', 'open', 'closed', 'tallied')),
  opens_at            timestamptz not null,
  closes_at           timestamptz not null,
  min_selections      integer     not null default 1 check (min_selections >= 0),
  max_selections      integer     not null default 1 check (max_selections >= 1),
  public_key          text,                       -- Y = ΣYᵢ, după ce toți trustees și-au trimis cheia
  aggregate           jsonb,                      -- agregatul homomorf per candidat, calculat la închidere
  tally_ballot_count  integer,                    -- câte buletine au intrat în agregat
  created_at          timestamptz not null default now(),
  check (max_selections >= min_selections)
);

create table if not exists candidates (
  id           text primary key,
  election_id  text    not null references elections (id) on delete cascade,
  name         text    not null,
  description  text    not null default '',
  position     integer not null,                  -- ordinea definește poziția în vectorul de vot
  unique (election_id, position)
);

create table if not exists trustees (
  election_id       text not null references elections (id) on delete cascade,
  id                text not null,
  name              text not null,
  public_key_share  text,                         -- doar Yᵢ, niciodată xᵢ
  key_proof         jsonb,                        -- dovada Schnorr că trustee-ul își cunoaște cheia
  invite_code_hash  text,                         -- SHA-256 al codului de acces pentru CLI
  primary key (election_id, id)
);

create table if not exists eligible_voters (
  election_id  text not null references elections (id) on delete cascade,
  cnp_hmac     char(64) not null,
  primary key (election_id, cnp_hmac)
);

create table if not exists registrations (
  id                 bigserial primary key,
  election_id        text     not null references elections (id) on delete cascade,
  cnp_hmac           char(64) not null,
  credential_pubkey  char(64) not null,
  method             text     not null check (method in ('ocr', 'nfc')),
  trust_level        text     not null check (trust_level in ('optic', 'criptografic')),
  registered_at      timestamptz not null default now(),
  constraint registrations_cnp unique (election_id, cnp_hmac),
  constraint registrations_credential unique (election_id, credential_pubkey)
);

-- Bulletin board-ul: append-only (vezi triggerul de mai jos).
create table if not exists ballots (
  election_id        text     not null references elections (id) on delete cascade,
  seq                integer  not null,
  credential_pubkey  char(64) not null,
  tracking_code      char(64) not null,           -- hash-ul buletinului (codul primit de alegător)
  ciphertexts        jsonb    not null,
  proofs             jsonb    not null,
  signature          text     not null,
  prev_hash          char(64) not null,
  hash               char(64) not null,
  received_at        text     not null,           -- șirul ISO exact care intră în hash-ul intrării
  primary key (election_id, seq),
  constraint ballots_credential unique (election_id, credential_pubkey),
  constraint ballots_tracking_code unique (election_id, tracking_code),
  constraint ballots_hash unique (election_id, hash)
);

create table if not exists partial_decryptions (
  election_id   text  not null,
  trustee_id    text  not null,
  shares        jsonb not null,                   -- Dᵢⱼ și dovezile Chaum–Pedersen
  submitted_at  timestamptz not null default now(),
  primary key (election_id, trustee_id),
  foreign key (election_id, trustee_id) references trustees (election_id, id) on delete cascade
);

create table if not exists results (
  election_id   text primary key references elections (id) on delete cascade,
  counts        jsonb not null,
  published_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id           bigserial primary key,
  election_id  text references elections (id) on delete cascade,
  actor        text  not null,
  action       text  not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_election on audit_log (election_id, id);

-- Board-ul nu se modifică și nu se șterge, nici din greșeală: orice UPDATE sau DELETE pe ballots e refuzat.
-- (Ștergerea în cascadă a unui scrutin întreg rămâne posibilă doar dezactivând triggerul, intenționat.)
create or replace function ballots_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'bulletin board-ul este append-only: % refuzat', tg_op;
end $$;
drop trigger if exists ballots_append_only on ballots;
create trigger ballots_append_only before update or delete on ballots
  for each row execute function ballots_append_only();

-- Supabase expune automat tabelele din schema public prin API-ul REST (cheia „anon”).
-- Cu Row Level Security activat și fără nicio politică, API-ul public nu poate citi sau scrie nimic;
-- backend-ul se conectează direct la PostgreSQL ca utilizatorul „postgres”, care nu e afectat.
alter table elections            enable row level security;
alter table candidates           enable row level security;
alter table trustees             enable row level security;
alter table eligible_voters      enable row level security;
alter table registrations        enable row level security;
alter table ballots              enable row level security;
alter table partial_decryptions  enable row level security;
alter table results              enable row level security;
alter table audit_log            enable row level security;
