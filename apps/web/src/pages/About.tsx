import { Link } from 'react-router'

/** Explicația publică a sistemului, pentru alegători și observatori. */
export function About() {
  return (
    <article className="prose">
      <h1>Cum funcționează votul verificabil</h1>
      <p className="lead">
        Votul se criptează pe telefonul alegătorului, totul se publică criptat, voturile se adună fără să fie decriptate individual și se
        decriptează doar totalul. Oricine poate verifica matematic că nimeni n-a trișat.
      </p>

      <h2>1. Configurarea</h2>
      <p>
        Comisia creează scrutinul și importă lista alegătorilor eligibili. Serverul păstrează doar <code>HMAC-SHA256(k, CNP)</code>, cu o cheie k
        care nu se află în baza de date, deci lista nu dezvăluie niciun CNP. Fiecare trustee (de exemplu trei membri ai comisiei) își generează
        local o cheie secretă xᵢ și publică doar Yᵢ = xᵢG. Cheia scrutinului e suma lor:
      </p>
      <span className="formula">Y = Y₁ + Y₂ + … + Yₙ = (x₁ + x₂ + … + xₙ)·G</span>
      <p>Pentru decriptare e nevoie de toți trustees: niciunul singur nu poate afla nimic.</p>

      <h2>2. Înregistrarea</h2>
      <p>
        Alegătorul își scanează buletinul (zona MRZ, citită prin OCR și validată cu cifrele de control) sau citește cipul cărții electronice
        de identitate prin NFC. La NFC, serverul verifică semnătura statului pe datele cipului (Passive Authentication). Telefonul generează o
        pereche de chei de credential; serverul leagă cheia publică de HMAC-ul CNP-ului, o singură dată per persoană.
      </p>

      <h2>3. Votul</h2>
      <p>Pentru fiecare candidat, aplicația criptează 1 (ales) sau 0 (neales), cu un număr aleator r nou de fiecare dată:</p>
      <span className="formula">Enc(m) = (A, B) = (r·G, m·G + r·Y)</span>
      <p>
        Alături atașează dovezi zero-knowledge: fiecare criptotext conține 0 sau 1, iar suma lor e exact 1. Serverul află astfel că votul e
        valid, dar nu și pe cine ai votat. Buletinul e semnat cu cheia de credential. Înainte de trimitere poți cere un audit (provocarea
        Benaloh): aplicația dezvăluie r, iar un verificator independent confirmă că s-a criptat opțiunea aleasă; buletinul auditat se aruncă și
        votul se recriptează.
      </p>

      <h2>4. Bulletin board-ul</h2>
      <p>
        Fiecare buletin intră într-un registru public append-only; fiecare intrare conține hash-ul celei anterioare, deci orice modificare rupe
        lanțul. Primești codul de urmărire (hash-ul intrării tale) cu care îți găsești buletinul pe <Link to="/">pagina scrutinului</Link>.
      </p>

      <h2>5. Numărarea homomorfă</h2>
      <p>Adunând criptotextele tuturor buletinelor pentru un candidat se obține criptarea numărului lui de voturi, fără a decripta niciun vot:</p>
      <span className="formula">(Aⱼ, Bⱼ) = (ΣAₖⱼ, ΣBₖⱼ) = Enc(Tⱼ)</span>
      <p>
        Fiecare trustee publică Dᵢⱼ = xᵢ·Aⱼ cu o dovadă că a folosit cheia lui. Din TⱼG = Bⱼ − ΣDᵢⱼ, totalul Tⱼ se află prin baby-step
        giant-step, fiind cel mult numărul de alegători.
      </p>

      <h2>6. Verificarea publică</h2>
      <p>
        Oricine descarcă board-ul și reface: lanțul de hash-uri, semnăturile, dovezile fiecărui buletin, agregatul și decriptarea. E
        verificabilitate end-to-end: votul e criptat cum ai vrut, înregistrat cum l-ai trimis și numărat cum a fost înregistrat. Tab-ul
        „Verificare publică” de pe pagina fiecărui scrutin rulează verificatorul direct în browser.
      </p>

      <h2>Limitări asumate</h2>
      <ul>
        <li>Constrângerea și cumpărarea voturilor: cineva te poate obliga să votezi de față cu el. Helios are aceeași limită.</li>
        <li>Telefonul alegătorului e de încredere; provocarea Benaloh reduce riscul unei aplicații compromise, dar nu îl elimină.</li>
        <li>Serverul controlează și înregistrarea, deci protecția împotriva voturilor false e parțială (soluția completă: autoritate de înregistrare separată, ca în Belenios).</li>
      </ul>
    </article>
  )
}
