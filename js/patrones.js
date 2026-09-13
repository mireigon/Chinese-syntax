/* Buscador de patrones sobre la lista de tokens.
 *
 * Cada construcción gramatical se describe como una secuencia de piezas, y
 * este módulo se encarga de encontrarla en la frase. Es un comparador con
 * retroceso: cuando una repetición se pasa de larga, prueba con menos.
 *
 * Piezas admitidas:
 *   { w: '把' }                el texto exacto (o una lista de textos)
 *   { pos: 'v' }               la etiqueta ('v*' compara sólo el principio)
 *   { clase: 'esVerbo' }       una propiedad del token (o varias, todas)
 *   { salvo: ['了','的'] }     excluye esos textos
 *   { fn: function (t) {} }    condición a medida
 *   { rep: [min, max] }        repetición de la propia pieza
 *   { opt: true }              equivale a rep [0, 1]
 *   { nombre: 'verbo' }        guarda lo que encaje con ese nombre
 *   { clave: true }            marca el token como pieza destacada
 *   { libre: true }            comodín: encaja con cualquier token
 */
window.Patrones = (function () {
  'use strict';

  function encajaPieza(pieza, tok) {
    if (!tok) return false;
    if (pieza.libre) return true;
    if (pieza.w) {
      var ws = Array.isArray(pieza.w) ? pieza.w : [pieza.w];
      if (ws.indexOf(tok.texto) < 0) return false;
    }
    if (pieza.salvo) {
      var ex = Array.isArray(pieza.salvo) ? pieza.salvo : [pieza.salvo];
      if (ex.indexOf(tok.texto) >= 0) return false;
    }
    if (pieza.pos) {
      var ps = Array.isArray(pieza.pos) ? pieza.pos : [pieza.pos];
      var ok = false;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        if (p.slice(-1) === '*') { if ((tok.pos || '').indexOf(p.slice(0, -1)) === 0) { ok = true; break; } }
        else if (tok.pos === p) { ok = true; break; }
      }
      if (!ok) return false;
    }
    if (pieza.clase) {
      var cs = Array.isArray(pieza.clase) ? pieza.clase : [pieza.clase];
      for (var j = 0; j < cs.length; j++) if (!tok[cs[j]]) return false;
    }
    if (pieza.noClase) {
      var ns = Array.isArray(pieza.noClase) ? pieza.noClase : [pieza.noClase];
      for (var k = 0; k < ns.length; k++) if (tok[ns[k]]) return false;
    }
    if (pieza.fn && !pieza.fn(tok)) return false;
    return true;
  }

  function limites(pieza) {
    if (pieza.rep) return { min: pieza.rep[0], max: pieza.rep[1] };
    if (pieza.opt) return { min: 0, max: 1 };
    return { min: 1, max: 1 };
  }

  /** Intenta encajar el patrón a partir de un índice. Devuelve el resultado o null. */
  function desde(patron, tokens, inicio) {
    var capturas = {}, claves = [];

    function paso(pi, ti) {
      if (pi === patron.length) return ti;
      var pieza = patron[pi];
      var lim = limites(pieza);
      var largo = 0;
      while (largo < lim.max && encajaPieza(pieza, tokens[ti + largo])) largo++;
      // Por defecto se prueba con la repetición más larga y se va acortando;
      // con 'perezoso' al revés, que es lo que hace falta cuando el trozo
      // variable va justo antes de la pieza que de verdad queremos localizar
      // (el objeto de 把 antes del verbo, por ejemplo).
      var orden = [];
      if (pieza.perezoso) { for (var a = lim.min; a <= largo; a++) orden.push(a); }
      else { for (var b = largo; b >= lim.min; b--) orden.push(b); }
      for (var oi = 0; oi < orden.length; oi++) {
        var n = orden[oi];
        var fin = paso(pi + 1, ti + n);
        if (fin >= 0) {
          if (pieza.nombre && n > 0) capturas[pieza.nombre] = tokens.slice(ti, ti + n);
          if (pieza.clave) for (var q = 0; q < n; q++) claves.push(tokens[ti + q]);
          return fin;
        }
      }
      return -1;
    }

    var fin = paso(0, inicio);
    if (fin < 0) return null;
    return {
      inicio: inicio, fin: fin,
      tokens: tokens.slice(inicio, fin),
      capturas: capturas,
      claves: claves
    };
  }

  /** Todas las apariciones del patrón, sin solaparse. */
  function todas(patron, tokens) {
    var res = [];
    var i = 0;
    while (i < tokens.length) {
      var m = desde(patron, tokens, i);
      if (m && m.fin > m.inicio) { res.push(m); i = m.fin; }
      else i++;
    }
    return res;
  }

  /** La primera aparición, o null. */
  function primera(patron, tokens) {
    for (var i = 0; i < tokens.length; i++) {
      var m = desde(patron, tokens, i);
      if (m && m.fin > m.inicio) return m;
    }
    return null;
  }

  function texto(tokens) {
    return (tokens || []).map(function (t) { return t.texto; }).join('');
  }
  function pinyin(tokens) {
    return (tokens || []).map(function (t) { return t.py || t.texto; }).join(' ');
  }
  function glosa(tokens) {
    return (tokens || []).map(function (t) {
      return (t.es || t.en || t.texto).split(/ *[/;] */)[0];
    }).join(' ');
  }

  return { desde: desde, todas: todas, primera: primera, texto: texto, pinyin: pinyin, glosa: glosa };
})();
