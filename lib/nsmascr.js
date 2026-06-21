import { normalizeBasic } from './util.js';

const SEARCH_URL = 'https://databaze.nsmascr.cz/search.php?search=';

// Z adresy vygeneruje kandidáty na název obce (od nejpravděpodobnějšího).
// "Komenského 696/35, 750 02 Přerov I-Město" → ["Přerov I-Město", "Přerov", ...]
export function obecCandidates(address) {
  const out = [];
  const push = (v) => {
    v = v.trim().replace(/\s{2,}/g, ' ');
    if (v && v.length >= 2 && !/\d/.test(v) && !out.includes(v)) out.push(v);
  };

  const parts = String(address).split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    let p = parts[i].replace(/\b\d{3}\s?\d{2}\b/g, '').trim(); // odstranit PSČ
    if (!p) continue;
    push(p);
    // "Přerov I-Město", "Ostrava 2" → základ názvu
    const noSuffix = p.replace(/\s+[IVX]+\s*[-–].*$/i, '').replace(/\s+\d+$/, '').trim();
    push(noSuffix);
    const words = noSuffix.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      push(words[words.length - 1]);
      push(words.slice(-2).join(' '));
    }
  }
  return out.slice(0, 6);
}

// Vyhledá obec v databázi NS MAS ČR a vrátí seznam {obec, mas, id}.
async function searchObec(query) {
  const r = await fetch(SEARCH_URL + encodeURIComponent(query), {
    headers: { 'User-Agent': 'mas-vyzva-api/1.0' },
  });
  if (!r.ok) throw new Error(`databaze.nsmascr.cz vrátila HTTP ${r.status}`);
  const html = await r.text();

  const obceIdx = html.indexOf('<strong>Obce</strong>');
  if (obceIdx === -1) return [];
  const seg = html.slice(obceIdx);

  const results = [];
  const re = /<a href="mas\.php\?id=(\d+)[^"]*">([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(seg))) {
    const text = m[2].trim();
    // "Hranice (okr. Přerov) - MAS Hranicko z. s."
    const mm = text.match(/^(.*?\([^)]*\))\s*-\s*(.+)$/) || text.match(/^(.+?)\s+-\s+(.+)$/);
    results.push({
      id: Number(m[1]),
      obec: mm ? mm[1].trim() : text,
      mas: mm ? mm[2].trim() : null,
      raw: text,
    });
  }
  return results;
}

// Hlavní lookup: adresa → obec → MAS.
// MAS vracíme POUZE při přesné shodě názvu obce — jinak by "Přerov" chybně
// matchnul "Brodek u Přerova". Podobné obce vracíme zvlášť jako "similar".
export async function findMasByAddress(address) {
  const candidates = obecCandidates(address);
  let similar = [];
  let searchedSimilar = null;

  for (const obec of candidates) {
    const results = await searchObec(obec);
    if (!results.length) continue;

    const nq = normalizeBasic(obec);
    const exact = results.filter((r) => normalizeBasic(r.obec.replace(/\s*\(.*$/, '')) === nq);
    if (exact.length) {
      return { searchedObec: obec, candidates, results: exact, exact: true, similar: [] };
    }
    if (!similar.length) {
      similar = results;
      searchedSimilar = obec;
    }
  }

  return { searchedObec: searchedSimilar, candidates, results: [], exact: false, similar };
}
