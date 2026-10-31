# Explicații: tot proiectul, de la zero

Acest folder explică proiectul pentru cineva care nu a mai văzut niciodată codul și nici nu știe ce înseamnă cuvintele din el. Fiecare termen e explicat prima dată când apare, iar la final există un glosar cu toate cuvintele, în ordine alfabetică.

Dacă un cuvânt nu e clar într-un capitol, caută-l în [07-glosar.md](07-glosar.md).

## În ce ordine să citești

| Nr. | Fișier | Ce afli |
| --- | --- | --- |
| 1 | [01-ideea-si-conceptele.md](01-ideea-si-conceptele.md) | Ce face proiectul, cine îl folosește și ideile de bază: criptare, hash, chei, semnături, dovezi, de ce votul rămâne secret și totuși verificabil. |
| 2 | [02-tehnologii-si-de-ce.md](02-tehnologii-si-de-ce.md) | Fiecare limbaj, program și bibliotecă folosită: ce e, ce face în proiect și de ce a fost aleasă în locul altora. Aici sunt TypeScript, Node, NestJS, PostgreSQL, Supabase, React, Expo, Docker și toate celelalte. |
| 3 | [03-cum-circula-cererile.md](03-cum-circula-cererile.md) | Cum vorbesc telefonul, site-ul și serverul între ele: ce e o cerere HTTP, ce se trimite, ce se primește, cu exemple reale pentru un vot complet. |
| 4 | [04-codul-explicat-linie-cu-linie.md](04-codul-explicat-linie-cu-linie.md) | Cum se citește codul: fiecare cuvânt cheie din TypeScript, SQL, Docker și YAML, apoi fișierele cele mai importante explicate rând cu rând. |
| 5 | [05-harta-fisierelor.md](05-harta-fisierelor.md) | Fiecare folder și fiecare fișier din proiect, cu o propoziție simplă despre ce face. |
| 6 | [06-performanta-si-teste.md](06-performanta-si-teste.md) | Ce s-a măsurat, cât de repede merge, ce teste există și cum le rulezi. |
| 7 | [07-glosar.md](07-glosar.md) | Toate cuvintele, de la A la Z. |

## Proiectul într-un paragraf

E un sistem de **vot electronic** pentru alegeri universitare. Alegătorul se identifică cu buletinul, scanându-l cu camera telefonului sau citind cipul prin NFC. Apoi votează din aplicația de pe telefon. Votul se **criptează pe telefon**, deci serverul nu vede niciodată pe cine a votat cineva. La final, voturile criptate se adună fără să fie decriptate unul câte unul, iar doar totalul se decriptează, de către mai multe persoane împreună (trustees). Oricine poate verifica, cu un program public, că numărătoarea e corectă și că nimeni n-a schimbat sau șters vreun vot.

## Cele trei părți vizibile

1. **Aplicația de telefon** (`apps/mobile`): alegătorul se înregistrează cu buletinul, votează și își verifică votul.
2. **Site-ul** (`apps/web`): comisia electorală creează scrutinul, încarcă lista de alegători, deschide și închide votul. Publicul vede rezultatele și poate verifica tot.
3. **Serverul** (`apps/backend`): primește cererile de la telefon și de la site, verifică totul și salvează în baza de date (Supabase).

Pe lângă ele mai sunt: biblioteca de criptografie comună (`packages/crypto`), stratul comun de comunicare (`packages/api`), programele în linia de comandă pentru trustees, verificare și simulare (`tools/`) și demonstrațiile de atac (`demos/`).

## Legătura cu celelalte documente

- [DOCUMENTATIE.md](../DOCUMENTATIE.md): documentația tehnică, cu formule, modelul de amenințare și rezultatele. E scrisă pentru lucrarea de licență.
- [EXPLICATIE.md](../EXPLICATIE.md): istoria construcției, pas cu pas, și descrierea tehnică a fiecărui fișier.
- Acest folder: aceleași lucruri, dar explicate de la zero, fără să presupună că știi ceva dinainte.
