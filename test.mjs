import { findMasByAddress, obecCandidates } from './lib/nsmascr.js';
import { fetchSheetRows, findVyzva } from './lib/sheet.js';

const SHEET = 'https://docs.google.com/spreadsheets/d/1H2OV8_cCT_OYHVOlApoSHKArH0CV9w5QZO7_np_hDtM/edit?gid=0#gid=0';

const addresses = [
  'Komenského 696/35, 750 02 Přerov',
  'Tř. 1. máje 328, 753 01 Hranice I-Město',
  'Soukenická 877/9, Moravská Ostrava, 702 00 Ostrava',
];

for (const addr of addresses) {
  console.log('\n========', addr);
  console.log('kandidáti:', obecCandidates(addr));
  const lookup = await findMasByAddress(addr);
  console.log('obec:', lookup.results[0]?.obec ?? '— nenalezeno');
  console.log('MAS: ', lookup.results[0]?.mas ?? '—');
  if (lookup.results.length > 1) console.log('další:', lookup.results.slice(1).map(r => r.obec));

  if (lookup.results[0]?.mas) {
    const rows = await fetchSheetRows(SHEET);
    const vyzvy = findVyzva(rows, lookup.results[0].mas);
    if (vyzvy) {
      for (const v of vyzvy) {
        console.log('VÝZVA:', v.identifikaceVyzvy);
        console.log('  stav:', v.stavVyzvy, '| příjem:', v.datumZahajeniPrijmu, '→', v.datumUkonceniPrijmu);
      }
    } else {
      console.log('VÝZVA: žádná v tabulce');
    }
  }
}
