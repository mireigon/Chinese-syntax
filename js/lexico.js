/* Diccionario: carga, consulta y datos de cada palabra.
 *
 * Los ficheros de data/ son cadenas TSV enormes. Se analizan una sola vez y se
 * guardan en un Map. El núcleo llega con la página; la ampliación se pide en
 * segundo plano y, cuando entra, la aplicación repite el análisis. */
window.Lexico = (function () {
  'use strict';

  /** palabra -> { py, pos, freq, hsk, en, es } */
  var entradas = new Map();
  /** carácter suelto -> pinyin (respaldo para lo que no esté en el diccionario) */
  var caracteres = new Map();
  var longitudMaxima = 1;
  var ampliacionCargada = false;

  function analizarLexico(texto) {
    if (!texto) return 0;
    var lineas = texto.split('\n');
    var nuevas = 0;
    for (var i = 0; i < lineas.length; i++) {
      var c = lineas[i].split('\t');
      var palabra = c[0];
      if (!palabra || entradas.has(palabra)) continue;
      entradas.set(palabra, {
        py: c[1] || '',
        pos: c[2] || '',
        freq: +c[3] || 0,
        hsk: +c[4] || 0,
        en: c[5] || '',
        es: ''
      });
      if (palabra.length > longitudMaxima) longitudMaxima = palabra.length;
      nuevas++;
    }
    return nuevas;
  }

  function analizarEspanol(texto) {
    if (!texto) return 0;
    var lineas = texto.split('\n');
    var n = 0;
    for (var i = 0; i < lineas.length; i++) {
      var t = lineas[i].indexOf('\t');
      if (t < 0) continue;
      var palabra = lineas[i].slice(0, t);
      var glosa = lineas[i].slice(t + 1);
      var e = entradas.get(palabra);
      if (!e) {
        // Palabra glosada a mano que no está en el diccionario base.
        e = { py: '', pos: '', freq: 0, hsk: 0, en: '', es: '' };
        entradas.set(palabra, e);
        if (palabra.length > longitudMaxima) longitudMaxima = palabra.length;
      }
      e.es = glosa;
      n++;
    }
    return n;
  }

  function analizarCaracteres(texto) {
    if (!texto) return 0;
    var lineas = texto.split('\n');
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      if (l.length < 2) continue;
      caracteres.set(l[0], l.slice(1));
    }
    return lineas.length;
  }

  function iniciar() {
    analizarLexico(window.ZH_LEXICON_CORE || '');
    analizarCaracteres(window.ZH_CHARS || '');
    analizarEspanol(window.ZH_ES || '');
  }

  /** Carga la parte no esencial del diccionario. Devuelve una promesa. */
  function cargarAmpliacion() {
    if (ampliacionCargada) return Promise.resolve(0);
    ampliacionCargada = true;
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'data/lexicon-ext.js';
      s.onload = function () {
        var n = analizarLexico(window.ZH_LEXICON_EXT || '');
        // El glosario español se vuelve a aplicar por si alguna palabra suya
        // sólo existía en la ampliación.
        analizarEspanol(window.ZH_ES || '');
        window.ZH_LEXICON_EXT = null;
        resolve(n);
      };
      s.onerror = function () { resolve(0); };
      document.head.appendChild(s);
    });
  }

  function buscar(palabra) { return entradas.get(palabra) || null; }
  function existe(palabra) { return entradas.has(palabra); }
  function pinyinDeCaracter(ch) {
    var e = entradas.get(ch);
    if (e && e.py) return e.py.split(' / ')[0];
    return caracteres.get(ch) || '';
  }
  function tamano() { return entradas.size; }
  function maximo() { return longitudMaxima; }

  /** Busca palabras que empiecen por un prefijo (para el buscador manual). */
  function porPrefijo(prefijo, limite) {
    var res = [];
    entradas.forEach(function (e, w) {
      if (res.length >= (limite || 20)) return;
      if (w.indexOf(prefijo) === 0) res.push({ palabra: w, datos: e });
    });
    res.sort(function (a, b) { return b.datos.freq - a.datos.freq; });
    return res;
  }

  return {
    iniciar: iniciar,
    cargarAmpliacion: cargarAmpliacion,
    buscar: buscar,
    existe: existe,
    pinyinDeCaracter: pinyinDeCaracter,
    porPrefijo: porPrefijo,
    tamano: tamano,
    longitudMaxima: maximo
  };
})();
