import { findMasByAddress } from '../lib/nsmascr.js';
import { fetchSheetRows, findVyzva } from '../lib/sheet.js';
import { cors, jsonError } from '../lib/util.js';

// GET /api/vyzva?address=<adresa/sídlo firmy>&sheet=<URL Google tabulky>
// Hlavní endpoint: adresa → obec → MAS → výzva z tabulky.
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return jsonError(res, 405, 'Použijte GET.');

  const address = (req.query.address || req.query.adresa || '').trim();
  const sheet = (req.query.sheet || req.query.tabulka || '').trim();

  if (!address) return jsonError(res, 400, 'Chybí parametr "address" (adresa / sídlo firmy).');
  if (!sheet) return jsonError(res, 400, 'Chybí parametr "sheet" (odkaz na Google tabulku).');

  try {
    const lookup = await findMasByAddress(address);

    if (!lookup.results.length) {
      return res.status(404).json({
        error: 'Pro zadanou adresu se nepodařilo najít obec v databázi MAS.',
        note: 'Velká města (Praha, Brno, Ostrava, Přerov…) zpravidla nespadají pod žádnou MAS — CLLD pokrývá venkovské oblasti.',
        input: { address },
        zkousenoObce: lookup.candidates,
        ...(lookup.similar.length && {
          podobneObce: lookup.similar.map((r) => ({ obec: r.obec, mas: r.mas })),
        }),
      });
    }

    const ambiguous = lookup.results.length > 1;
    const primary = lookup.results[0];

    let vyzvy = null;
    let sheetError = null;
    try {
      const rows = await fetchSheetRows(sheet);
      vyzvy = findVyzva(rows, primary.mas);
    } catch (e) {
      sheetError = e.message;
    }

    return res.status(200).json({
      input: { address, sheet },
      obec: primary.obec,
      mas: primary.mas,
      ambiguous,
      ...(ambiguous && {
        poznamka: 'Nalezeno více stejnojmenných obcí — vybrána první. Ostatní viz "dalsiMoznosti".',
        dalsiMoznosti: lookup.results.slice(1).map((r) => ({ obec: r.obec, mas: r.mas })),
      }),
      ...(sheetError
        ? { vyzva: null, sheetError }
        : vyzvy && vyzvy.length
          ? { vyzva: vyzvy.length === 1 ? vyzvy[0] : vyzvy }
          : { vyzva: null, poznamkaVyzva: `MAS "${primary.mas}" nemá v tabulce žádnou výzvu.` }),
    });
  } catch (e) {
    return jsonError(res, 502, e.message);
  }
}
