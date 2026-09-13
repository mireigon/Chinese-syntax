/* Banco de pruebas del motor, para ejecutar con Node sin navegador:
 *   node tests/motor.js            analiza las frases de muestra
 *   node tests/motor.js "你好"      analiza lo que le pases
 * Carga los mismos ficheros que la página, simulando el objeto window. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var raiz = path.join(__dirname, '..');
var contexto = { console: console, document: { createElement: function () { return {}; }, head: { appendChild: function () {} } }, Promise: Promise, Set: Set, Map: Map, Math: Math, JSON: JSON };
contexto.window = contexto;
vm.createContext(contexto);

['data/lexicon-core.js', 'data/chars.js', 'data/es-lexicon.js', 'data/meta.js',
 'js/lexico.js', 'js/glosa.js', 'js/pinyin.js', 'js/segmentador.js', 'js/etiquetas.js',
 'js/patrones.js', 'js/construcciones.js', 'js/construcciones-2.js',
 'js/construcciones-3.js', 'js/analisis.js', 'js/traduccion.js'
].forEach(function (f) {
  var p = path.join(raiz, f);
  if (!fs.existsSync(p)) { console.error('(falta ' + f + ')'); return; }
  vm.runInContext(fs.readFileSync(p, 'utf8'), contexto, { filename: f });
});

contexto.Lexico.iniciar();

var FRASES = [
  '你好！我叫李明，今天天气很好。',
  '我把书放在桌子上了。',
  '我的手机被偷了。',
  '他比我高一点儿。',
  '虽然很贵，但是我还是买了。',
  '这个字我看不懂。',
  '我是昨天坐飞机来的。',
  '你吃饭了吗？',
  '他正在看书呢。',
  '我学了三年中文。',
  '他连汉字都会写。',
  '我给你打电话。',
  '越学越有意思。',
  '我没去过北京。',
  '同学们好，请大家看看这本书。'
];

function barra(t) { return '─'.repeat(t); }

var frases = process.argv.length > 2 ? process.argv.slice(2) : FRASES;
var totalMarcas = 0, sinPinyin = 0, tokensTotal = 0;

frases.forEach(function (frase) {
  var r = contexto.Analisis.analizar(frase);
  console.log('\n' + barra(70));
  console.log(frase);
  var linea = r.tokens.filter(function (t) { return t.tipo !== 'espacio'; })
    .map(function (t) {
      tokensTotal++;
      if (t.tipo === 'hanzi' && !t.py) sinPinyin++;
      return t.texto + (t.py ? '[' + t.py + ']' : '') + (t.papel && t.papel !== 'otro' && t.papel !== 'puntuacion' ? '·' + t.papel : '');
    }).join('  ');
  console.log(linea);
  if (contexto.Traduccion) {
    console.log('ES: ' + contexto.Traduccion.literal(r).texto);
  }
  r.marcas.forEach(function (m) {
    totalMarcas++;
    console.log('  » [' + m.familia + '] ' + m.titulo);
    console.log('      ' + m.resumen);
  });
  if (!r.marcas.length) console.log('  (ninguna construcción detectada)');
});

console.log('\n' + barra(70));
console.log('tokens: ' + tokensTotal + ' | sin pinyin: ' + sinPinyin +
            ' | construcciones detectadas: ' + totalMarcas +
            ' | reglas cargadas: ' + contexto.Construcciones.REGLAS.length +
            ' | diccionario: ' + contexto.Lexico.tamano());
