/* Comprobaciones del motor. Fijan el comportamiento en los casos que más
 * cuesta acertar y que ya se han roto alguna vez: segmentación de palabras
 * cortas, elección de lectura en los polifónicos, cambios de tono, reparto de
 * papeles y detección de construcciones.
 *
 *   node tests/comprobar.js        (sale con código 1 si algo falla)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var raiz = path.join(__dirname, '..');
var ctx = {
  console: console, Promise: Promise, Set: Set, Map: Map, Math: Math, JSON: JSON,
  document: { createElement: function () { return {}; }, head: { appendChild: function () {} } }
};
ctx.window = ctx;
vm.createContext(ctx);
['data/lexicon-core.js', 'data/chars.js', 'data/es-lexicon.js', 'data/meta.js',
 'js/lexico.js', 'js/glosa.js', 'js/pinyin.js', 'js/segmentador.js', 'js/etiquetas.js',
 'js/patrones.js', 'js/construcciones.js', 'js/construcciones-2.js',
 'js/construcciones-3.js', 'js/analisis.js', 'js/traduccion.js'
].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
});
ctx.Lexico.iniciar();

var fallos = 0, pruebas = 0;

function comprobar(descripcion, condicion, detalle) {
  pruebas++;
  if (condicion) return;
  fallos++;
  console.error('FALLA  ' + descripcion + (detalle ? '\n       ' + detalle : ''));
}

function analizar(texto) { return ctx.Analisis.analizar(texto); }
function palabras(r) {
  return r.tokens.filter(function (t) { return t.tipo === 'hanzi'; })
          .map(function (t) { return t.texto; });
}
function tokenDe(r, texto) {
  return r.tokens.filter(function (t) { return t.texto === texto; })[0];
}
function reglas(r) { return r.marcas.map(function (m) { return m.reglaId; }); }

/* --------------------------- segmentación --------------------------- */

[['你好', ['你好']],
 ['三本书', ['三', '本', '书']],
 ['我买了三本书', ['我', '买', '了', '三', '本', '书']],
 ['他不能来', ['他', '不', '能', '来']],
 ['中国人', ['中国', '人']],
 ['这个字', ['这个', '字']]
].forEach(function (caso) {
  var got = palabras(analizar(caso[0]));
  comprobar('se segmenta ' + caso[0] + ' como ' + caso[1].join('/'),
    got.join('/') === caso[1].join('/'), 'sale: ' + got.join('/'));
});

/* --------------------------- pinyin --------------------------- */

[['你吃饭了吗？', '吗', 'ma'],
 ['我看不懂', '看', 'kàn'],
 ['他还在家', '还', 'hái'],
 ['书在桌子上', '上', 'shàng'],
 ['我想说', '说', 'shuō'],
 ['他正在看书呢', '呢', 'ne'],
 ['我买的书', '的', 'de'],
 ['他跑得很快', '得', 'de'],
 ['他站着说话', '着', 'zhe']
].forEach(function (caso) {
  var t = tokenDe(analizar(caso[0]), caso[1]);
  comprobar('«' + caso[1] + '» se lee «' + caso[2] + '» en ' + caso[0],
    t && t.py === caso[2], t ? 'sale: ' + t.py : 'no aparece el token');
});

comprobar('no se queda ninguna palabra sin pinyin', (function () {
  var faltan = [];
  ['他把手机忘在出租车上了。', '净含量：500克。保质期：12个月。',
   '越来越多的年轻人选择一个人生活。'].forEach(function (f) {
    analizar(f).tokens.forEach(function (t) {
      if (t.tipo === 'hanzi' && (!t.py || t.py.indexOf('?') >= 0)) faltan.push(t.texto);
    });
  });
  if (faltan.length) comprobar._detalle = faltan.join(', ');
  return !faltan.length;
})(), comprobar._detalle);

/* --------------------------- cambios de tono --------------------------- */

var sandhiBu = analizar('不错').sandhi;
comprobar('不 ante cuarto tono se marca como «bú»',
  sandhiBu.length === 1 && sandhiBu[0].dicho === 'bú',
  JSON.stringify(sandhiBu.map(function (s) { return s.escrito + '>' + s.dicho; })));

comprobar('不 ante segundo tono NO cambia', analizar('不难').sandhi.length === 0);

var sandhi33 = analizar('语法').sandhi;
comprobar('dos terceros tonos seguidos se marcan',
  sandhi33.length === 1 && sandhi33[0].dicho === 'yú',
  JSON.stringify(sandhi33.map(function (s) { return s.escrito + '>' + s.dicho; })));

/* --------------------------- papeles --------------------------- */

function papelDe(texto, palabra) {
  var t = tokenDe(analizar(texto), palabra);
  return t ? t.papel : '(no aparece)';
}
[['我把书放在桌子上了。', '把', 'coverbo'],
 ['我把书放在桌子上了。', '放', 'verbo'],
 ['他不是学生。', '不', 'negacion'],
 ['他不是学生。', '是', 'verbo'],
 ['我会说中文。', '会', 'modal'],
 ['书在桌子上。', '在', 'verbo'],
 ['你吃饭了吗？', '吗', 'final'],
 ['这个字我看不懂。', '我', 'sujeto'],
 ['我是昨天来的。', '是', 'foco']
].forEach(function (caso) {
  var got = papelDe(caso[0], caso[1]);
  comprobar('en «' + caso[0] + '», ' + caso[1] + ' es ' + caso[2],
    got === caso[2], 'sale: ' + got);
});

/* --------------------------- construcciones --------------------------- */

[['我把门关上了。', 'ba'],
 ['我的手机被偷了。', 'bei-pasiva'],
 ['妈妈让我回家。', 'causativa'],
 ['他比我高。', 'bi-comparativo'],
 ['我是昨天来的。', 'shi-de'],
 ['这个字我看不懂。', 'potencial'],
 ['你是学生吗？', 'pregunta-ma'],
 ['你去不去？', 'pregunta-a-no-a'],
 ['虽然很贵，但是我买了。', 'correlativos'],
 ['他连汉字都会写。', 'lian-dou'],
 ['我给你打电话。', 'coverbo'],
 ['三本书', 'clasificador'],
 ['我没去过北京。', 'guo-experiencial'],
 ['他正在看书。', 'zai-progresivo'],
 ['越学越有意思。', 'yue-yue'],
 ['我学了三年中文。', 'duracion'],
 ['你看看。', 'reduplicacion-verbal'],
 ['同学们好。', 'sufijo-men'],
 ['我很好。', 'hen-adjetivo'],
 ['他慢慢地走。', 'de-adverbial'],
 ['他跑得很快。', 'de-complemento'],
 ['我看懂了。', 'resultativo'],
 ['他走进来了。', 'direccional'],
 ['我跟他一样高。', 'comparativo-igualdad'],
 ['我没有他高。', 'meiyou-comparativo'],
 ['我一到家就给你打电话。', 'yi-jiu']
].forEach(function (caso) {
  var got = reglas(analizar(caso[0]));
  comprobar('«' + caso[0] + '» dispara la regla ' + caso[1],
    got.indexOf(caso[1]) >= 0, 'salen: ' + (got.join(', ') || 'ninguna'));
});

/* ------------------- falsos positivos que ya aparecieron ------------------- */

comprobar('«我叫李明» no se analiza como pasiva',
  reglas(analizar('我叫李明。')).indexOf('bei-pasiva') < 0);
comprobar('«我给你打电话» no se analiza como pasiva',
  reglas(analizar('我给你打电话。')).indexOf('bei-pasiva') < 0);
comprobar('«住了» no se explica como complemento de resultado',
  reglas(analizar('我在北京住了三年。')).indexOf('resultativo') < 0);
comprobar('un conector no entra en el modificador de 的', (function () {
  var m = analizar('虽然中文的语法不难。').marcas.filter(function (x) {
    return x.reglaId === 'de-atributivo';
  })[0];
  return m && m.tokens[0].texto !== '虽然';
})());
comprobar('un sintagma en mitad de la frase no se toma por tema',
  reglas(analizar('我在北京住了三年，中文说得还不错。')).indexOf('tema') < 0);

/* --------------------------- traducción --------------------------- */

function es(texto) { return ctx.Traduccion.literal(analizar(texto)).texto; }

[['我叫李明。', 'Lǐ Míng'],
 ['我住在北京。', 'Pekín'],
 ['桌子上有一本书。', 'hay'],
 ['他有两个孩子。', 'dos niños'],
 ['我买了三本书。', 'tres libros'],
 ['我在家里看书。', 'en casa'],
 ['他把手机忘在出租车上了。', 'en taxi'],
 ['我给你打电话。', 'a ti'],
 ['你看看。', 'un poco'],
 ['他也不会说中文。', 'tampoco']
].forEach(function (caso) {
  var got = es(caso[0]);
  comprobar('«' + caso[0] + '» se traduce con «' + caso[1] + '»',
    got.indexOf(caso[1]) >= 0, 'sale: ' + got);
});

/* --------------------------- resumen --------------------------- */

console.log((pruebas - fallos) + '/' + pruebas + ' comprobaciones correctas');
if (fallos) { console.error(fallos + ' fallo(s)'); process.exit(1); }
