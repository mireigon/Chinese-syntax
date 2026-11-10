/* El bloque de los caracteres: de qué piezas está hecho cada uno, qué pieza
 * le da el sonido y a quién se lo da, con qué otros no confundirlo, palabras
 * frecuentes que lo llevan y la nota propia.
 *
 * Vive aparte porque lo enseñan dos sitios: la ficha del analizador y el
 * dorso de las tarjetas. Los chips llevan data-explorar con el carácter o la
 * palabra a la que saltan; qué pasa al tocarlos lo decide quien los pinta.
 */
window.Caracteres = (function () {
  'use strict';

  function crear(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function esHan(ch) {
    return ch.length === 2 || /[⺀-⿟㐀-鿿豈-﫿]/.test(ch);
  }

  /** Token de mentira para una palabra que no está en la frase. */
  function tokenDeExploracion(w) {
    var e = window.Lexico.buscar(w) || {};
    var py = e.py ? e.py.split(' / ')[0]
      : Array.from(w).map(window.Lexico.pinyinDeCaracter).join(' ');
    var cats = window.Etiquetas.CATEGORIAS;
    return {
      texto: w, tipo: 'hanzi', py: py, en: e.en || '', es: e.es || '', hsk: e.hsk || 0,
      categoria: e.pos ? (cats[e.pos] || cats[e.pos[0]] || '') : '',
      marcas: [], explorado: true
    };
  }

  function chipExplorar(w, resto, clase, py) {
    var b = crear('button', 'chip chip-zh' + (clase ? ' ' + clase : ''));
    b.type = 'button';
    b.dataset.explorar = w;
    b.appendChild(crear('span', 'zh', w));
    if (py) b.appendChild(crear('span', 'chip-py', py));
    if (resto && resto.ingles) b.appendChild(crear('span', 'chip-resto chip-ingles', resto.texto));
    else if (resto) b.appendChild(crear('span', 'chip-resto', resto));
    return b;
  }

  /** Glosa corta de una entrada del diccionario, en español si la hay. El
   *  inglés se devuelve marcado ({ texto, ingles }) para pintarlo distinto. */
  function glosaCorta(e) {
    if (!e) return '';
    var g = e.es ? window.Glosa.primeraAcepcion(e.es) : window.Glosa.primeraAcepcion(e.en || '');
    if (g.length > 28) g = g.slice(0, 27) + '…';
    return g && !e.es ? { texto: g, ingles: true } : g;
  }

  /* Nota propia del carácter. Se guarda sola al dejar de escribir y al salir
   * del campo; si otra pantalla la cambia, se actualiza aquí salvo que se
   * esté escribiendo en ella. */
  function pintarNota(bloque, ch) {
    var cab = crear('div', 'd-sub d-sub-nota');
    cab.appendChild(document.createTextNode('Mi nota'));
    var estado = crear('span', 'd-nota-estado', '');
    cab.appendChild(estado);
    bloque.appendChild(cab);

    var ta = crear('textarea', 'd-mia');
    ta.rows = 2;
    ta.spellcheck = false;
    ta.dataset.notaChar = ch;
    ta.placeholder = 'Por qué creo que ' + ch + ' se escribe y se pronuncia así…';
    ta.value = window.Notas.leer(ch);
    bloque.appendChild(ta);

    var temporizador = null;
    var ultimo = ta.value;
    function guardarYa() {
      clearTimeout(temporizador);
      temporizador = null;
      if (ta.value === ultimo) return;
      ultimo = ta.value;
      estado.textContent = 'guardando…';
      window.Notas.guardar(ch, ta.value).then(function () {
        estado.textContent = window.Notas.modo() === 'local' ? 'guardada en este dispositivo' : 'guardada';
      }).catch(function (err) {
        estado.textContent = err && err.code === 'quota_exceeded'
          ? 'no cabe: la base de notas está llena' : 'no se pudo guardar';
      });
    }
    ta.addEventListener('input', function () {
      estado.textContent = '';
      clearTimeout(temporizador);
      temporizador = setTimeout(guardarYa, 900);
    });
    ta.addEventListener('blur', guardarYa);
  }

  /* Por cada carácter: estructura, origen (sólo si la fuente lo trae), serie
   * fonética y palabras frecuentes que lo contienen.
   * opciones.excluir  palabras que no hace falta repetir en «Palabras con»
   *                   (en una tarjeta, las que ya trae el propio mazo) */
  function pintarCaracteres(f, texto, opciones) {
    var excluir = (opciones && opciones.excluir) || [];
    var chars = Array.from(texto).filter(esHan);
    var unico = chars.length === 1;
    var vistos = {};
    chars = chars.filter(function (c) { return vistos[c] ? false : (vistos[c] = true); }).slice(0, 4);
    if (!chars.length) return;

    var zona = crear('div', 'd-chars');
    chars.forEach(function (ch) {
      var fi = window.Hanzi.ficha(ch);
      var bloque = crear('div', 'd-char');

      var cab = crear('div', 'd-char-cab');
      if (unico) cab.appendChild(crear('span', 'd-char-han zh', ch));
      else cab.appendChild(chipExplorar(ch, '', 'chip-grande'));
      cab.appendChild(crear('span', 'f-py', window.Lexico.pinyinDeCaracter(ch)));
      if (!unico) {
        var g = glosaCorta(window.Lexico.buscar(ch));
        if (g) cab.appendChild(crear('span', 'd-char-gl' + (g.ingles ? ' chip-ingles' : ''), g.texto || g));
      }
      if (fi && fi.nombreTipo) cab.appendChild(crear('span', 'f-cat', fi.nombreTipo));
      bloque.appendChild(cab);

      if (!fi) {
        bloque.appendChild(crear('p', 'd-nota', 'Sin datos de estructura en la fuente.'));
      } else if (fi.tipo === 'f') {
        // En los 形声 de la fuente la pista es la categoría de significado
        // («palabra», «metal»); si es una frase entera se muestra aparte.
        var pistaCorta = fi.pista && !/[⺀-鿿]/.test(fi.pista) && fi.pista.split(' ').length <= 3;
        var linea = crear('div', 'd-formula');
        if (fi.semantico) {
          linea.appendChild(chipExplorar(fi.semantico, pistaCorta ? '«' + fi.pista + '»' : '', 'chip-pieza'));
          linea.appendChild(crear('span', 'd-papel', 'significado'));
          linea.appendChild(crear('span', 'd-mas', '+'));
        }
        linea.appendChild(chipExplorar(fi.fonetico, fi.pyFonetico, 'chip-pieza'));
        linea.appendChild(crear('span', 'd-papel', 'sonido'));
        bloque.appendChild(linea);
        if (fi.pista && !pistaCorta) bloque.appendChild(crear('p', 'd-pista', fi.pista));
        var sonidos = {
          igual: 'Suena igual que ' + fi.fonetico + ' (salvo, quizá, el tono).',
          parecido: 'Suena parecido a ' + fi.fonetico + ': la pista de sonido sigue sirviendo a medias.',
          distinto: 'El sonido de ' + fi.fonetico + ' ya no se reconoce: la pronunciación ha cambiado con los siglos.'
        };
        if (sonidos[fi.sonido]) bloque.appendChild(crear('p', 'd-nota', sonidos[fi.sonido]));
      } else {
        if (fi.piezas.length > 1 || fi.piezas[0] !== ch) {
          var lp = crear('div', 'd-formula');
          fi.piezas.forEach(function (p, i) {
            if (p === ch) return;
            if (i) lp.appendChild(crear('span', 'd-mas', '+'));
            lp.appendChild(chipExplorar(p, glosaCorta(window.Lexico.buscar(p)), 'chip-pieza'));
          });
          if (lp.childNodes.length) bloque.appendChild(lp);
        }
        if (fi.pista) bloque.appendChild(crear('p', 'd-pista', fi.pista));
        else if (fi.tipo) bloque.appendChild(crear('p', 'd-nota', 'La fuente no explica su origen.'));
        else bloque.appendChild(crear('p', 'd-nota', 'Sin datos de origen en la fuente.'));
      }

      var parecidos = window.Hanzi.parecidos(ch);
      if (parecidos.length) {
        bloque.appendChild(crear('div', 'd-sub d-sub-confusion', 'No confundir con'));
        var fc = crear('div', 'd-fila');
        parecidos.forEach(function (p) {
          fc.appendChild(chipExplorar(p, glosaCorta(window.Lexico.buscar(p)), 'chip-confusion',
            window.Lexico.pinyinDeCaracter(p)));
        });
        bloque.appendChild(fc);
      }

      pintarNota(bloque, ch);

      if (fi && fi.serie.length) {
        bloque.appendChild(crear('div', 'd-sub', 'Misma pieza de sonido ' + fi.fonetico));
        var fs = crear('div', 'd-fila');
        fi.serie.forEach(function (s) {
          fs.appendChild(chipExplorar(s.caracter, s.py, s.igual ? 'chip-igual' : ''));
        });
        bloque.appendChild(fs);
      }

      if (fi && fi.daSonidoA.length) {
        bloque.appendChild(crear('div', 'd-sub', ch + ' da el sonido a'));
        var fd = crear('div', 'd-fila');
        fi.daSonidoA.forEach(function (s) {
          fd.appendChild(chipExplorar(s.caracter, s.py, s.igual ? 'chip-igual' : ''));
        });
        bloque.appendChild(fd);
      }

      var palabras = window.Hanzi.palabrasCon(ch, unico ? 10 : 6)
        .filter(function (p) { return p.palabra !== texto && excluir.indexOf(p.palabra) < 0; });
      if (palabras.length) {
        bloque.appendChild(crear('div', 'd-sub', 'Palabras con ' + ch));
        var fp = crear('div', 'd-fila');
        palabras.forEach(function (p) {
          fp.appendChild(chipExplorar(p.palabra, glosaCorta(p.datos), '',
            (p.datos.py || '').split(' / ')[0]));
        });
        bloque.appendChild(fp);
      }
      zona.appendChild(bloque);
    });
    f.appendChild(zona);
  }

  return {
    esHan: esHan,
    token: tokenDeExploracion,
    chip: chipExplorar,
    glosaCorta: glosaCorta,
    pintar: pintarCaracteres
  };
})();
