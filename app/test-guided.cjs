// Run: node app/test-guided.cjs (no dependencies or hardware).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let now = 0;
const data = new Map();
const ctx = vm.createContext({
  performance: { now: () => now }, setInterval: () => 1, clearInterval() {},
  localStorage: { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) },
});
for (const file of ['protocol.js', 'game.js']) {
  vm.runInContext(fs.readFileSync(`${__dirname}/js/${file}`, 'utf8'), ctx);
}
vm.runInContext('this.Engine = Partida; this.book = Libreta; this.parse = parseLine;', ctx);
for (const confidence of [0, .9]) {
  now = 0; data.clear(); let result;
  const game = new ctx.Engine({ id: 'test', nombre: 'Test', pasos: [
    { clase: 'colar', seg: 1 }, { clase: 'agitar', seg: 1 },
  ] }, { onFin: r => { result = r; } });
  game.arrancar();
  now = 1000; game._tick();
  game.alimentar({ clase: 'agitar', confianza: confidence });
  now = 2000; game._tick();
  assert.equal(result.pasos[0].precision, null);
  assert.equal(result.precision, confidence ? 1 : 0);
  assert.equal(ctx.book._leer().gestos.colar, undefined);
}
assert.equal(ctx.parse('{"g":"reposo_mano","p":0.87}').clase, 'reposo_mano');
assert.equal(ctx.parse('not valid'), null);
console.log('PASS: guided steps excluded; measured success/failure preserved; parser accepts reposo_mano.');
