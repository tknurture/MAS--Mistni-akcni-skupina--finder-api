# MAS Výzva API

Backend API: podle adresy/sídla firmy najde místně příslušnou **MAS** (místní akční skupinu) a v zadané Google tabulce dohledá **stav dotační výzvy** a termíny příjmu žádostí.

**Zdroje dat:**
- MAS podle obce: https://databaze.nsmascr.cz/ (oficiální databáze NS MAS ČR)
- Výzvy: libovolná veřejná Google tabulka se sloupcem "Název MAS" (formát OPTAK CLLD)

## Endpointy

### `GET /api/vyzva` — hlavní endpoint

Adresa → obec → MAS → výzva z tabulky.

| Parametr | Povinný | Popis |
|---|---|---|
| `address` | ano | Adresa / sídlo firmy (např. `Skalička 102, 753 52 Skalička`) |
| `sheet` | ano | Celá URL Google tabulky (např. `https://docs.google.com/spreadsheets/d/<ID>/edit?gid=0`) |

```
GET /api/vyzva?address=Horka%20nad%20Moravou%2032&sheet=https://docs.google.com/spreadsheets/d/1H2OV8.../edit?gid=0
```

Odpověď `200`:
```json
{
  "obec": "Horka nad Moravou (okr. Olomouc)",
  "mas": "MAS Moravská cesta, z. s.",
  "ambiguous": false,
  "vyzva": {
    "nazevMas": "MAS Moravská cesta, z. s.",
    "kraj": "Olomoucký",
    "identifikaceVyzvy": "6. výzva MAS Moravská cesta – OP TAK – Technologie pro MAS",
    "stavVyzvy": "Uzavřená",
    "datumZahajeniPrijmu": "27.4.2026 8:00:00",
    "datumUkonceniPrijmu": "5.6.2026 12:00:00",
    "alokace": "3 400 000,00 Kč",
    "odkazNaVyzvu": "https://...",
    "kontakt": { "jmeno": "...", "telefon": "...", "email": "..." }
  }
}
```

Speciální stavy:
- `404` — obec nespadá pod žádnou MAS (velká města: Praha, Brno, Ostrava, Přerov…); v odpovědi `podobneObce`
- `"ambiguous": true` — více stejnojmenných obcí; vybrána první, ostatní v `dalsiMoznosti`
- `"vyzva": null` + `poznamkaVyzva` — MAS nalezena, ale v tabulce nemá výzvu
- `sheetError` — tabulku se nepodařilo načíst (není veřejná apod.); MAS lookup přesto proběhl

### `GET /api/mas` — jen lookup MAS

| Parametr | Povinný |
|---|---|
| `address` | ano |

Vrací obec + MAS bez čtení tabulky.

### `GET /api/vyzvy` — přehled výzev z tabulky

| Parametr | Povinný | Popis |
|---|---|---|
| `sheet` | ano | URL Google tabulky |
| `mas` | ne | Filtr na konkrétní MAS |

Bez `mas` vrátí všechny výzvy v tabulce.

### `GET /api/health`

Health check.

## Poznámky k implementaci

- **GET s body neexistuje** — HTTP standard body u GET ignoruje, proto jsou vstupy v query parametrech.
- Tabulka musí být **veřejná pro čtení** (Sdílet → Kdokoli s odkazem → Čtenář). Čte se přes CSV export, není potřeba Google API klíč.
- Tabulku lze kdykoliv vyměnit — stačí poslat jinou URL v parametru `sheet`. Vyžaduje jen sloupce "Název MAS", "Stav výzvy", "Datum zahájení/ukončení příjmu žádostí".
- Párování názvů MAS je tolerantní k diakritice, právním formám (z.s., o.p.s.) a interpunkci.
- MAS se vrací **pouze při přesné shodě názvu obce** — jinak by "Přerov" chybně matchnul "Brodek u Přerova".
- CSV tabulky se cachuje 5 minut v paměti instance.
- CORS povolen pro všechny originy — API lze volat z prohlížeče i z n8n.

## Lokální test

```bash
node test.mjs
```

## Deploy na Vercel

```bash
npm i -g vercel   # pokud chybí
vercel            # preview
vercel --prod     # produkce
```

Nebo připojit GitHub repo ve Vercel dashboardu — deploy při každém push.
