import { findMasByAddress } from '../lib/nsmascr.js';
import { cors, jsonError } from '../lib/util.js';

// GET /api/mas?address=<adresa> — jen lookup MAS podle adresy (bez tabulky).
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return jsonError(res, 405, 'Použijte GET.');

  const address = (req.query.address || req.query.adresa || '').trim();
  if (!address) return jsonError(res, 400, 'Chybí parametr "address".');

  try {
    const lookup = await findMasByAddress(address);
    if (!lookup.results.length) {
      return res.status(404).json({
        error: 'Obec nenalezena v databázi MAS.',
        zkousenoObce: lookup.candidates,
        ...(lookup.similar.length && {
          podobneObce: lookup.similar.map((r) => ({ obec: r.obec, mas: r.mas })),
        }),
      });
    }
    return res.status(200).json({
      input: { address },
      hledanaObec: lookup.searchedObec,
      vysledky: lookup.results.map((r) => ({ obec: r.obec, mas: r.mas })),
    });
  } catch (e) {
    return jsonError(res, 502, e.message);
  }
}
