// Testes das regras puras da integração DSSAT (sem React, sem rede).
// Rodar: node --experimental-strip-types --test scripts/tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allPairsEnabled, cropCodeFromName, eligibleInSelection, fmtKg, fmtPct, fmtSignedPct, isValidIsoDate,
  soilSummary, suggestKnownCrops, targetMetric, validateSearchForm, yyyydddToBr,
} from '../../src/utils/dssatLogic.ts';

const catalog = [
  { code: 'MZ', name: 'Milho' }, { code: 'CP', name: 'Feijão-caupi' }, { code: 'BN', name: 'Feijão' },
  { code: 'CS', name: 'Mandioca' }, { code: 'SG', name: 'Sorgo' }, { code: 'PI', name: 'Abacaxi' },
  { code: 'SC', name: 'Cana-de-açúcar' },
];
const caps = {
  sequence_pairs: [['BN', 'CP'], ['CP', 'MZ'], ['MZ', 'SG'], ['CP', 'SG']],
  crops: [{ code: 'MZ', rotation_target_metric: 'yield_kg_ha' }, { code: 'SC', rotation_target_metric: 'biomass_kg_ha' }],
};

test('nomes da roça viram códigos do catálogo; palma fica de fora', () => {
  assert.equal(cropCodeFromName('Feijão de corda', catalog), 'CP');
  assert.equal(cropCodeFromName('milho crioulo', catalog), 'MZ');
  assert.equal(cropCodeFromName('Macaxeira', catalog), 'CS');
  assert.equal(cropCodeFromName('MZ', catalog), 'MZ');
  assert.equal(cropCodeFromName('Palma forrageira', catalog), null);
  assert.deepEqual(suggestKnownCrops(['Milho e feijão de corda', 'Palma', 'milho'], catalog), ['MZ', 'CP']);
});

test('elegibilidade por pares na seleção atual', () => {
  assert.deepEqual([...eligibleInSelection(['MZ', 'CP', 'PI'], caps)].sort(), ['CP', 'MZ']);
  assert.equal(eligibleInSelection(['MZ', 'BN'], caps).size, 0);
  assert.equal(allPairsEnabled(['MZ', 'CP', 'SG'], caps), true);
  assert.equal(allPairsEnabled(['MZ', 'CP', 'BN'], caps), false);
  assert.equal(allPairsEnabled(['MZ'], caps), false);
  assert.equal(targetMetric('SC', caps), 'biomass_kg_ha');
  assert.equal(targetMetric('XX', caps), 'yield_kg_ha');
});

test('datas civis e validação do formulário', () => {
  assert.equal(isValidIsoDate('1992-02-29'), true);
  assert.equal(isValidIsoDate('1993-02-29'), false);
  assert.equal(isValidIsoDate('1992-1-5'), false);
  const ok = { selected: ['MZ', 'CP'], eligible: new Set(['MZ', 'CP']), dates: ['1992-01-15', '1992-06-15', '1993-01-15'],
    years: [2015, 2020], targets: { MZ: '1000', CP: '300,5' } };
  assert.deepEqual(validateSearchForm(ok), []);
  assert.ok(validateSearchForm({ ...ok, targets: { MZ: '1000' } }).some((e) => e.includes('CP')));
  assert.ok(validateSearchForm({ ...ok, dates: ['1992-06-15', '1992-01-15', '1993-01-15'] }).length);
  assert.ok(validateSearchForm({ ...ok, dates: ['1992-01-15', '1992-06-15', '1994-01-15'] }).length);
  assert.ok(validateSearchForm({ ...ok, years: [2015] }).length);
  assert.ok(validateSearchForm({ ...ok, years: [1991, 2015] }).length);
  // 29/02 de 1992 reaplicado a 2015 não existe
  const leap = validateSearchForm({ ...ok, dates: ['1992-02-29', '1992-06-15', '1993-01-15'] });
  assert.ok(leap.some((e) => e.includes('não existe')));
});

test('formatação: zero é zero, nulo é "sem dado"', () => {
  assert.equal(fmtKg(0), '0 kg/ha');
  assert.equal(fmtKg(null), 'sem dado');
  assert.equal(fmtPct(0.47), '47%');
  assert.equal(fmtPct(null), 'sem dado');
  assert.equal(fmtSignedPct(6.7), '+7%');
  assert.equal(fmtSignedPct(-15.6), '-16%');
  assert.equal(yyyydddToBr(1992015), '15/01/1992');
  assert.equal(yyyydddToBr(2000060), '29/02/2000');
  assert.equal(yyyydddToBr(0), null);
});

test('resumo do solo para leigo', () => {
  const layers = [
    { SLB: 30, SLLL: 0.12, SDUL: 0.22, SLHW: 5.2, SLOC: 1, SLCL: 17.5, origem: 'estimado (PronaSolos 90 m)' },
    { SLB: 100, SLLL: 0.18, SDUL: 0.28 },
    { SLB: 200, SLLL: 0.2, SDUL: 0.3 },
  ];
  const s = soilSummary(layers, 'SL');
  assert.equal(s.texture, 'franco-arenoso');
  assert.equal(s.waterMm1m, 100);   // 0.10*300 + 0.10*700 mm
  assert.equal(s.ph, 5.2);
  assert.equal(s.measured, false);
  assert.equal(soilSummary([], 'SL'), null);
});
