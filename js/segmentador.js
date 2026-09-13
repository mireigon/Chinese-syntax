/* Segmentación: partir el texto chino en palabras.
 *
 * El chino se escribe sin espacios, así que el primer problema de todos es
 * decidir dónde acaba cada palabra. 中国人 puede ser 中国 + 人 («persona de
 * China») o 中 + 国人; sólo una de las dos lecturas es la normal.
 *
 * Se resuelve con un Viterbi sobre el diccionario: de todas las formas de
 * cortar la cadena se elige la que maximiza la suma de log-frecuencias, o sea,
 * la combinación de palabras más probable en conjunto. Es el mismo método que
 * usa jieba, y con sus frecuencias. */
window.Segmentador = (function () {
  'use strict';

  var HANZI = /[㐀-䶿一-鿿豈-﫿]/;
  var LATIN = /[A-Za-zÀ-ÿ]/;
  var DIGITO = /[0-9０-９]/;
  var ESPACIO = /\s/;
  var PUNT_CJK = '。，、；：？！“”‘’（）《》〈〉【】—…·「」『』〔〕～';
  var PUNT_LAT = '.,;:?!"\'()[]{}<>-–—/\\|@#$%^&*_+=~`';

  // Coste de una palabra que no está en el diccionario. Cuanto más largo el
  // trozo desconocido, peor: así se prefiere partir por palabras conocidas.
  var TOTAL_LOG = 17;        // ~log del total de apariciones del corpus
  var PENALIZACION_OOV = 3.5;
  // Pequeño empujón a las palabras largas. Sin él, dos caracteres muy comunes
  // ganan a la palabra que forman juntos: 你 + 好 saldría por delante de 你好.
  var BONO_LONGITUD = 0.1;

  function tipoDe(ch) {
    if (ESPACIO.test(ch)) return 'espacio';
    if (HANZI.test(ch)) return 'hanzi';
    if (DIGITO.test(ch)) return 'numero';
    if (LATIN.test(ch)) return 'latin';
    if (PUNT_CJK.indexOf(ch) >= 0 || PUNT_LAT.indexOf(ch) >= 0) return 'puntuacion';
    return 'otro';
  }

  /** Viterbi sobre un tramo formado sólo por hanzi. */
  function cortarHanzi(texto) {
    var n = texto.length;
    var maxLen = Math.min(window.Lexico.longitudMaxima(), 8);
    var mejor = new Float64Array(n + 1);
    var desde = new Int32Array(n + 1);
    for (var i = 1; i <= n; i++) { mejor[i] = -Infinity; desde[i] = i - 1; }

    for (var fin = 1; fin <= n; fin++) {
      for (var len = 1; len <= maxLen && len <= fin; len++) {
        var ini = fin - len;
        if (mejor[ini] === -Infinity) continue;
        var trozo = texto.slice(ini, fin);
        var e = window.Lexico.buscar(trozo);
        var coste;
        if (e && e.freq > 0) {
          coste = e.freq / 6 - TOTAL_LOG + BONO_LONGITUD * (len - 1);
        } else if (e) {
          coste = -TOTAL_LOG - 1;                  // en el diccionario pero sin frecuencia
        } else if (len === 1) {
          coste = -TOTAL_LOG - PENALIZACION_OOV;
        } else {
          continue;                                // no se inventan palabras largas
        }
        var total = mejor[ini] + coste;
        if (total > mejor[fin]) { mejor[fin] = total; desde[fin] = ini; }
      }
    }

    var cortes = [];
    var p = n;
    while (p > 0) { cortes.push([desde[p], p]); p = desde[p]; }
    cortes.reverse();
    return cortes.map(function (c) { return texto.slice(c[0], c[1]); });
  }

  /** Divide el texto completo en tokens con su posición original. */
  function segmentar(texto) {
    var tokens = [];
    var i = 0;
    while (i < texto.length) {
      var tipo = tipoDe(texto[i]);
      var j = i + 1;
      if (tipo === 'hanzi' || tipo === 'latin' || tipo === 'numero' || tipo === 'espacio') {
        while (j < texto.length && tipoDe(texto[j]) === tipo) j++;
      } else if (tipo === 'otro') {
        // Los emoji ocupan dos unidades de código.
        var cp = texto.codePointAt(i);
        j = i + (cp > 0xFFFF ? 2 : 1);
      }
      var trozo = texto.slice(i, j);

      if (tipo === 'hanzi') {
        var palabras = cortarHanzi(trozo);
        var pos = i;
        for (var k = 0; k < palabras.length; k++) {
          tokens.push(crear(palabras[k], pos, 'hanzi'));
          pos += palabras[k].length;
        }
      } else {
        tokens.push(crear(trozo, i, tipo));
      }
      i = j;
    }
    for (var t = 0; t < tokens.length; t++) tokens[t].i = t;
    return tokens;
  }

  function crear(texto, inicio, tipo) {
    var e = tipo === 'hanzi' ? window.Lexico.buscar(texto) : null;
    return {
      texto: texto,
      inicio: inicio,
      fin: inicio + texto.length,
      tipo: tipo,
      i: 0,
      py: e ? e.py : '',
      notaPy: '',
      pos: e ? e.pos : '',
      freq: e ? e.freq : 0,
      hsk: e ? e.hsk : 0,
      en: e ? e.en : '',
      es: e ? e.es : '',
      conocida: !!e,
      categoria: '',     // categoría en español, la pone Etiquetas
      funcion: '',       // papel concreto en la frase, lo pone el analizador
      marcas: []         // ids de las construcciones que lo tocan
    };
  }

  return { segmentar: segmentar, tipoDe: tipoDe, HANZI: HANZI };
})();
