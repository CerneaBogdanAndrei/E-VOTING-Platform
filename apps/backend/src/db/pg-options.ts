// Opțiunile de conexiune PostgreSQL, comune serverului și migrărilor.
// SSL e pornit automat pentru orice server care nu e local (Supabase, Neon etc.);
// DATABASE_SSL=off îl oprește, DATABASE_SSL=on îl forțează. Certificatul se verifică
// doar dacă DATABASE_CA conține CA-ul (PEM), pentru că pooler-ul Supabase folosește
// un CA propriu care nu e în lista implicită a lui Node.

import type pg from 'pg'

export function pgOptions(databaseUrl: string, env: NodeJS.ProcessEnv = process.env): pg.ClientConfig {
  const url = new URL(databaseUrl)
  // sslmode din URL ar suprascrie opțiunile de mai jos, așa că îl scoatem.
  const sslmode = url.searchParams.get('sslmode')
  url.searchParams.delete('sslmode')
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
  const flag = env.DATABASE_SSL?.toLowerCase()
  const useSsl = flag === 'off' || flag === 'false' ? false : flag === 'on' || flag === 'true' || (sslmode && sslmode !== 'disable') ? true : !local
  const ca = env.DATABASE_CA?.replace(/\\n/g, '\n')
  return {
    connectionString: url.toString(),
    ssl: useSsl ? (ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }) : false,
  }
}
