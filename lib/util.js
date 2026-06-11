export function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Normalizace názvu MAS pro párování — odstraní diakritiku, právní formy a interpunkci.
// "Místní akční skupina Hranicko, z. s." i "MAS Hranicko z.s." → "mashranicko"
export function normalizeMas(s) {
  let n = stripDiacritics(s).toLowerCase();
  n = n.replace(/mistni\s+akcni\s+skupina/g, ' mas ');
  n = n.replace(/[^a-z0-9]+/g, '');
  for (const suf of ['zspolek', 'sro', 'ops', 'zs', 'zu', 'as']) {
    while (n.endsWith(suf)) n = n.slice(0, -suf.length);
  }
  return n;
}

export function normalizeBasic(s) {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}
