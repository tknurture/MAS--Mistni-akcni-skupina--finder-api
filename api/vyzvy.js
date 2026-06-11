import { fetchSheetRows, findVyzva } from '../lib/sheet.js';
import { cors, jsonError } from '../lib/util.js';

// GET /api/vyzvy?sheet=<URL>&mas=<volitelně název MAS>
// Bez "mas" vrátí všechny výzvy z tabulky, s "mas" jen výzvy dané MAS.
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return jsonError(res, 405, 'Použijte GET.');

  const sheet = (req.query.sheet || req.query.tabulka || '').trim();
  const mas = (req.query.mas || '').trim();
  if (!sheet) return jsonError(res, 400, 'Chybí parametr "sheet".');

  try {
    const rows = await fetchSheetRows(sheet);

    if (mas) {
      const vyzvy = findVyzva(rows, mas);
      if (!vyzvy) return res.status(404).json({ error: `MAS "${mas}" nemá v tabulce žádnou výzvu.` });
      return res.status(200).json({ vyzvy });
    }

    // Celý přehled — všechny MAS v tabulce
    const headers = rows[0];
    const nazevIdx = headers.findIndex((h) => h.toLowerCase().includes('název mas'));
    const all = [];
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const name = rows[i][nazevIdx];
      if (name && !seen.has(name)) {
        seen.add(name);
        const v = findVyzva(rows, name);
        if (v) all.push(...v);
      }
    }
    return res.status(200).json({ pocet: all.length, vyzvy: all });
  } catch (e) {
    return jsonError(res, 502, e.message);
  }
}
