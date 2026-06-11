import { normalizeMas, normalizeBasic } from './util.js';

// Cache CSV v paměti instance (Vercel Fluid Compute instance přežívá mezi requesty)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Přijme celou URL Google tabulky nebo holé ID, vrátí { id, gid }.
export function parseSheetUrl(input) {
  const s = String(input || '');
  const idMatch = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (!idMatch) throw new Error('Neplatný odkaz na Google tabulku. Očekávám URL ve formátu https://docs.google.com/spreadsheets/d/<ID>/edit?gid=<GID>');
  const gidMatch = s.match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

// CSV parser zvládající uvozovky a víceřádkové buňky.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function fetchSheetRows(sheetInput) {
  const { id, gid } = parseSheetUrl(sheetInput);
  const key = `${id}:${gid}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rows;

  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`Tabulku se nepodařilo načíst (HTTP ${r.status}). Je nastavená jako veřejná pro čtení?`);
  const text = await r.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('Tabulka není veřejná pro čtení (Google vrátil přihlašovací stránku).');
  }

  const rows = parseCsv(text);
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

function findCol(headers, ...needles) {
  const norm = headers.map((h) => normalizeBasic(h));
  for (const needle of needles) {
    const n = normalizeBasic(needle);
    const idx = norm.findIndex((h) => h.includes(n));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Najde řádek výzvy podle názvu MAS a vrátí strukturovaná data.
export function findVyzva(rows, masName) {
  if (!rows.length) return null;
  const headers = rows[0];

  const col = {
    nazevMas: findCol(headers, 'Název MAS'),
    kraj: findCol(headers, 'Kraj'),
    web: findCol(headers, 'Odkaz na webové stránky MAS'),
    kontaktJmeno: findCol(headers, 'Jméno a příjmení'),
    kontaktTelefon: findCol(headers, 'Telefonní číslo'),
    kontaktEmail: findCol(headers, 'E-mail'),
    identifikace: findCol(headers, 'Identifikace výzvy'),
    vyhlaseni: findCol(headers, 'Datum vyhlášení výzvy'),
    zahajeniPrijmu: findCol(headers, 'Datum zahájení příjmu žádostí'),
    ukonceniPrijmu: findCol(headers, 'Datum ukončení příjmu žádostí'),
    stav: findCol(headers, 'Stav výzvy'),
    alokace: findCol(headers, 'Alokace výzvy'),
    odkazVyzva: findCol(headers, 'Odkaz na vyhlášenou výzvu'),
  };

  if (col.nazevMas === -1) throw new Error('V tabulce chybí sloupec "Název MAS".');

  const target = normalizeMas(masName);
  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    const cellRaw = rows[i][col.nazevMas];
    if (!cellRaw) continue;
    const cell = normalizeMas(cellRaw);
    if (cell === target || cell.includes(target) || target.includes(cell)) {
      matches.push(rows[i]);
    }
  }
  if (!matches.length) return null;

  const get = (row, c) => (c !== -1 && row[c] != null ? String(row[c]).trim() : null);

  return matches.map((row) => ({
    nazevMas: get(row, col.nazevMas),
    kraj: get(row, col.kraj),
    identifikaceVyzvy: get(row, col.identifikace),
    stavVyzvy: get(row, col.stav),
    datumVyhlaseni: get(row, col.vyhlaseni),
    datumZahajeniPrijmu: get(row, col.zahajeniPrijmu),
    datumUkonceniPrijmu: get(row, col.ukonceniPrijmu),
    alokace: get(row, col.alokace),
    odkazNaVyzvu: get(row, col.odkazVyzva),
    webMas: get(row, col.web),
    kontakt: {
      jmeno: get(row, col.kontaktJmeno),
      telefon: get(row, col.kontaktTelefon),
      email: get(row, col.kontaktEmail),
    },
  }));
}
