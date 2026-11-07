/* Caracteres: de qué están hechos, de dónde vienen y con qué se emparentan.
 *
 * Los datos salen de Make Me a Hanzi (data/hanzi.js). La mayoría de los
 * caracteres (un 70 %) son 形声: una pieza da la categoría de significado y
 * otra da el SONIDO. Esa segunda pieza no aporta sentido, y decirlo claro es
 * más útil que inventarse una historia: por eso para los 形声 se muestra la
 * fórmula «significado + sonido», y la pista narrativa sólo para ideogramas y
 * pictogramas, y sólo si la fuente la trae.
 *
 * Además se calculan dos parentescos:
 *   - la serie fonética: los caracteres que usan la misma pieza de sonido;
 *   - las palabras frecuentes que contienen el carácter. */
window.Hanzi = (function () {
  'use strict';

  /** carácter -> { tipo, sem, fon, desc, pista } */
  var datos = new Map();
  /** pieza fonética -> [caracteres que la usan] */
  var series = new Map();
  var cachePalabras = new Map();
  /** carácter -> [caracteres que se le parecen a la vista] */
  var parecidosDe = new Map();
  var iniciado = false;

  var TIPOS = {
    f: 'Semántico-fonético (形声)',
    i: 'Ideograma (会意)',
    p: 'Pictograma (象形)'
  };

  // Caracteres de descripción ideográfica (⿰, ⿱...) y huecos de la fuente.
  var NO_PIEZA = /[⿰-⿿？]/;

  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    var lineas = (window.ZH_HANZI || '').split('\n');
    for (var i = 0; i < lineas.length; i++) {
      var c = lineas[i].split('\t');
      if (!c[0]) continue;
      var d = { tipo: c[1] || '', sem: c[2] || '', fon: c[3] || '', desc: c[4] || '', pista: c[5] || '' };
      datos.set(c[0], d);
      if (d.tipo === 'f' && d.fon) {
        if (!series.has(d.fon)) series.set(d.fon, []);
        series.get(d.fon).push(c[0]);
      }
    }
    window.ZH_HANZI = null;

    (window.ZH_CONFUSABLES || '').split('\n').forEach(function (l) {
      var c = l.split('\t');
      if (c[0] && c[1]) parecidosDe.set(c[0], Array.from(c[1]));
    });
    window.ZH_CONFUSABLES = null;
  }

  /** Caracteres que se le parecen a la vista (data/confusables.js), el más parecido primero. */
  function parecidos(ch) {
    iniciar();
    return parecidosDe.get(ch) || [];
  }

  function frecuencia(ch) {
    var e = window.Lexico.buscar(ch);
    return e ? e.freq : 0;
  }

  /** Pinyin sin tonos, para comparar sonidos: «hài» y «hái» suenan igual. */
  function sinTono(py) {
    return (py || '').normalize('NFD').replace(/ü/g, 'v').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Piezas de la descomposición, sin los operadores ⿰ ⿱... */
  function piezas(desc) {
    var fuera = [];
    Array.from(desc || '').forEach(function (p) {
      if (!NO_PIEZA.test(p) && fuera.indexOf(p) < 0) fuera.push(p);
    });
    return fuera;
  }

  /** Ficha de un carácter, o null si la fuente no lo conoce. */
  function ficha(ch) {
    iniciar();
    var d = datos.get(ch);
    if (!d) return null;
    var py = window.Lexico.pinyinDeCaracter(ch);
    var f = {
      caracter: ch,
      py: py,
      tipo: d.tipo,
      nombreTipo: TIPOS[d.tipo] || '',
      semantico: d.sem,
      fonetico: d.fon,
      piezas: piezas(d.desc),
      pista: d.pista,
      serie: []
    };
    if (d.fon) {
      f.pyFonetico = window.Lexico.pinyinDeCaracter(d.fon);
      f.sonido = compararSonido(py, f.pyFonetico);
      f.serie = serieFonetica(d.fon, ch, 10);
    }
    // Y al revés: si el propio carácter es pieza de sonido de otros.
    f.daSonidoA = series.has(ch) ? serieFonetica(ch, ch, 10) : [];
    return f;
  }

  /** Cuánto del sonido de la pieza fonética conserva el carácter. */
  function compararSonido(py, pyFon) {
    var a = sinTono(py), b = sinTono(pyFon);
    if (!a || !b) return '';
    if (a === b) return 'igual';
    var inicial = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(.*)$/;
    var fa = a.match(inicial), fb = b.match(inicial);
    if (fa[2] === fb[2] || fa[1] && fa[1] === fb[1]) return 'parecido';
    return 'distinto';
  }

  /** Otros caracteres con la misma pieza fonética, los frecuentes primero. */
  function serieFonetica(fon, salvo, limite) {
    var lista = (series.get(fon) || []).filter(function (c) { return c !== salvo; });
    if (fon !== salvo && datos.has(fon)) lista.unshift(fon);
    var pyFon = sinTono(window.Lexico.pinyinDeCaracter(fon));
    return lista
      .map(function (c) {
        var py = window.Lexico.pinyinDeCaracter(c);
        return { caracter: c, py: py, freq: frecuencia(c), igual: sinTono(py) === pyFon };
      })
      .filter(function (x) { return x.freq > 0 || x.caracter === fon; })
      .sort(function (a, b) {
        if (a.caracter === fon) return -1;
        if (b.caracter === fon) return 1;
        return b.freq - a.freq;
      })
      .slice(0, limite || 10);
  }

  /** Palabras frecuentes que contienen el carácter y tienen definición. */
  function palabrasCon(ch, limite) {
    var clave = ch + '|' + window.Lexico.tamano();
    if (cachePalabras.has(clave)) return cachePalabras.get(clave);
    var res = [];
    window.Lexico.recorrer(function (w, e) {
      if (w.length < 2 || w.length > 4 || w.indexOf(ch) < 0) return;
      if (!e.es && !e.en) return;
      res.push({ palabra: w, datos: e });
    });
    res.sort(function (a, b) { return b.datos.freq - a.datos.freq; });
    res = res.slice(0, limite || 8);
    cachePalabras.set(clave, res);
    return res;
  }

  return {
    iniciar: iniciar,
    ficha: ficha,
    palabrasCon: palabrasCon,
    parecidos: parecidos,
    sinTono: sinTono
  };
})();
