/* Interfaz: enlaza el análisis con la página.
 *
 * La idea que sostiene todo el diseño: cada palabra china y cada trozo de
 * español llevan encima la lista de tokens de los que salen. Resaltar es tan
 * sencillo como marcar todos los elementos que comparten un token. Por eso al
 * pasar el cursor por un lado se enciende también el otro. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var analisisActual = null;
  var textoActual = '';
  var marcaSeleccionada = null;
  var tokenFijado = null;
  // En una tableta no hay puntero fino ni «hover»: toda la interacción es tocar.
  var hayRaton = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var el = {
    entrada: $('#entrada'),
    salidaZh: $('#salida-chino'),
    salidaEs: $('#salida-espanol'),
    salidaPy: $('#salida-pinyin'),
    salidaIa: $('#salida-ia'),
    gramatica: $('#salida-gramatica'),
    leyenda: $('#leyenda'),
    contador: $('#contador'),
    detalle: $('#detalle'),
    modal: $('#modal'),
    modalContenido: $('#modal-contenido'),
    estadoDicc: $('#estado-dicc'),
    nivel: $('#op-nivel'),
    claveApi: $('#clave-api')
  };

  /* ------------------------------ utilidades ---------------------------- */

  function crear(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function esperar(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, yo = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(yo, args); }, ms);
    };
  }

  function guardar(clave, valor) {
    try { localStorage.setItem('leerchino.' + clave, valor); } catch (e) { /* modo privado */ }
  }
  function leer(clave) {
    try { return localStorage.getItem('leerchino.' + clave); } catch (e) { return null; }
  }

  /* --------------------------- panel del chino -------------------------- */

  function pintarChino(analisis) {
    var cont = el.salidaZh;
    cont.textContent = '';
    if (!analisis.tokens.length) {
      cont.appendChild(crear('p', 'vacio', 'Escribe o pega un texto en chino para verlo analizado.'));
      return;
    }
    var verPinyin = $('#op-pinyin').checked;
    var verGlosa = $('#op-glosa').checked;

    analisis.oraciones.forEach(function (oracion) {
      var div = crear('div', 'oracion');
      oracion.tokens.forEach(function (tk) {
        if (tk.tipo === 'espacio') { div.appendChild(document.createTextNode(' ')); return; }

        var clases = ['palabra'];
        if (tk.papel) clases.push('p-' + tk.papel);
        if (tk.tipo === 'puntuacion') clases.push('puntuacion');
        if (tk.tipo === 'hanzi' && !tk.conocida) clases.push('desconocida');
        if (tk.esClave) clases.push('clave');

        var pal = crear('span', clases.join(' '));
        pal.dataset.tok = tk.i;

        if (verPinyin && tk.tipo === 'hanzi') {
          pal.appendChild(crear('span', 'py', tk.py || '·'));
        }
        pal.appendChild(crear('span', 'han', tk.texto));
        if (verGlosa && tk.tipo === 'hanzi') {
          var gl = window.Glosa.de(tk);
          pal.appendChild(crear('span', 'gl', gl.texto));
        }
        div.appendChild(pal);
      });
      cont.appendChild(div);
    });
  }

  function pintarLeyenda(analisis) {
    var usados = {};
    analisis.tokens.forEach(function (tk) {
      if (tk.papel && tk.papel !== 'otro' && tk.papel !== 'puntuacion') usados[tk.papel] = true;
    });
    el.leyenda.textContent = '';
    Object.keys(usados).forEach(function (papel) {
      var info = window.Analisis.PAPELES[papel];
      if (!info) return;
      var s = crear('span', '');
      s.title = info.ayuda;
      // La clase deja que el modo tinta dibuje también la FORMA del subrayado.
      // Sólo se fija el color: el testigo lo usa como fondo en pantalla normal
      // y como color del trazo en modo tinta, donde la FORMA también importa.
      var i = crear('i', 'l-' + papel);
      i.style.color = 'var(--c-' + info.color + ')';
      s.appendChild(i);
      s.appendChild(document.createTextNode(info.nombre));
      el.leyenda.appendChild(s);
    });
  }

  /* -------------------------- panel del español ------------------------- */

  function pintarEspanol(analisis) {
    var cont = el.salidaEs;
    cont.textContent = '';
    var res = window.Traduccion.literal(analisis);
    if (!res.bloques.length) {
      cont.appendChild(crear('p', 'vacio', 'Aquí aparecerá la traducción, alineada con el texto chino.'));
      return;
    }
    res.bloques.forEach(function (bloque) {
      var p = crear('div', 'frase-es');
      if (bloque.pregunta) p.appendChild(document.createTextNode('¿'));
      bloque.clausulas.forEach(function (segmentos, idx) {
        if (idx) p.appendChild(document.createTextNode('; '));
        segmentos.forEach(function (seg) {
          if (!seg.texto) return;
          var s = crear('span', 'seg p-' + seg.papel + (seg.ingles ? ' solo-ingles' : ''), seg.texto);
          s.dataset.toks = seg.tokens.map(function (t) { return t.i; }).join(',');
          var info = window.Analisis.PAPELES[seg.papel];
          if (info) s.title = info.nombre + (info.ayuda ? ' — ' + info.ayuda : '');
          p.appendChild(s);
        });
      });
      p.appendChild(document.createTextNode(bloque.pregunta ? '?' : '.'));
      cont.appendChild(p);
    });
  }

  /** Lectura en pinyin del texto entero, palabra a palabra y alineada. */
  function pintarPinyin(analisis) {
    var cont = el.salidaPy;
    cont.textContent = '';
    if (!analisis.tokens.length) {
      cont.appendChild(crear('p', 'vacio', 'Aquí aparecerá la lectura en pinyin.'));
      return;
    }
    analisis.oraciones.forEach(function (oracion) {
      var div = crear('div', 'frase-es');
      oracion.tokens.forEach(function (tk) {
        if (tk.tipo === 'espacio') return;
        if (tk.tipo === 'puntuacion') {
          div.appendChild(document.createTextNode(tk.texto === '，' ? ', ' : tk.texto));
          return;
        }
        var s = crear('span', 'seg seg-py p-' + (tk.papel || 'otro'), tk.py || tk.texto);
        s.dataset.toks = tk.i;
        if (tk.sandhi) s.title = 'Se pronuncia «' + tk.sandhi.dicho + '»';
        div.appendChild(s);
      });
      cont.appendChild(div);
    });
  }

  /* --------------------------- panel de gramática ----------------------- */

  function pintarGramatica(analisis) {
    var cont = el.gramatica;
    cont.textContent = '';
    var nivelMax = +el.nivel.value;
    var marcas = analisis.marcas.filter(function (m) { return m.nivel <= nivelMax; });

    if (!marcas.length) {
      cont.appendChild(crear('p', 'vacio', analisis.tokens.length
        ? 'No se ha reconocido ninguna construcción en este texto con el nivel elegido.'
        : 'Las construcciones gramaticales que aparezcan en el texto se explicarán aquí.'));
      pintarNotasPinyin(analisis, cont);
      return;
    }

    // Primero lo básico, y dentro de cada nivel por orden de aparición.
    marcas = marcas.slice().sort(function (a, b) {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      return (a.tokens[0] ? a.tokens[0].i : 0) - (b.tokens[0] ? b.tokens[0].i : 0);
    });

    marcas.forEach(function (m) {
      var tarjeta = crear('div', 'tarjeta nivel-' + m.nivel);
      tarjeta.dataset.marca = m.id;
      tarjeta.setAttribute('role', 'button');
      tarjeta.setAttribute('tabindex', '0');

      tarjeta.appendChild(crear('h3', '', m.titulo));
      var nivelTexto = ['', 'básico', 'intermedio', 'avanzado'][m.nivel];
      tarjeta.appendChild(crear('div', 'meta', m.familia + ' · ' + nivelTexto));
      tarjeta.appendChild(crear('p', 'resumen', m.resumen));

      var cuerpo = crear('div', 'cuerpo');
      if (m.formula) cuerpo.appendChild(crear('div', 'formula', m.formula));
      if (m.detalle) cuerpo.appendChild(crear('p', 'detalle', m.detalle));
      if (m.contraste) cuerpo.appendChild(crear('p', 'contraste', m.contraste));
      if (m.ejemplo) {
        var ej = crear('div', 'ejemplo');
        ej.appendChild(crear('span', 'zh', m.ejemplo.zh));
        ej.appendChild(crear('span', 'py', m.ejemplo.py));
        ej.appendChild(crear('span', 'es', m.ejemplo.es));
        cuerpo.appendChild(ej);
      }
      tarjeta.appendChild(cuerpo);
      cont.appendChild(tarjeta);
    });

    pintarNotasPinyin(analisis, cont);
  }

  /** Tarjeta aparte con los cambios de tono, que no son gramática pero se leen mal. */
  function pintarNotasPinyin(analisis, cont) {
    if (!analisis.sandhi.length) return;
    var vistos = {};
    var unicos = analisis.sandhi.filter(function (s) {
      var k = s.escrito + '>' + s.dicho;
      if (vistos[k]) return false;
      vistos[k] = true;
      return true;
    });
    var tarjeta = crear('div', 'tarjeta nivel-1 abierta');
    tarjeta.appendChild(crear('h3', '', 'Cambios de tono al pronunciar'));
    tarjeta.appendChild(crear('div', 'meta', 'Pronunciación · básico'));
    tarjeta.appendChild(crear('p', 'resumen',
      'En este texto hay ' + unicos.length + ' sílaba' + (unicos.length > 1 ? 's' : '') +
      ' que se escribe' + (unicos.length > 1 ? 'n' : '') + ' con un tono y se pronuncia' +
      (unicos.length > 1 ? 'n' : '') + ' con otro.'));
    var cuerpo = crear('div', 'cuerpo');
    unicos.slice(0, 6).forEach(function (s) {
      var p = crear('p', 'detalle');
      p.appendChild(crear('strong', '', s.token.texto + ': se escribe «' + s.escrito + '», se dice «' + s.dicho + '». '));
      p.appendChild(document.createTextNode(s.motivo));
      cuerpo.appendChild(p);
    });
    tarjeta.appendChild(cuerpo);
    cont.appendChild(tarjeta);
  }

  /* ------------------------------ resaltado ----------------------------- */

  function limpiarResaltado() {
    Array.prototype.forEach.call(document.querySelectorAll('.activa'), function (n) {
      if (!n.classList.contains('pestana')) n.classList.remove('activa');
    });
  }

  /** Enciende, en los dos paneles, todo lo que dependa de estos tokens. */
  function resaltarTokens(indices) {
    limpiarResaltado();
    if (!indices || !indices.length) return;
    var conjunto = {};
    indices.forEach(function (i) { conjunto[i] = true; });

    Array.prototype.forEach.call(document.querySelectorAll('[data-tok]'), function (n) {
      if (conjunto[+n.dataset.tok]) n.classList.add('activa');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-toks]'), function (n) {
      var suyos = (n.dataset.toks || '').split(',').filter(Boolean).map(Number);
      if (suyos.some(function (i) { return conjunto[i]; })) n.classList.add('activa');
    });
  }

  function resaltarMarca(idMarca) {
    if (!analisisActual) return;
    var m = analisisActual.marcas.filter(function (x) { return x.id === idMarca; })[0];
    if (!m) return;
    resaltarTokens(m.tokens.map(function (t) { return t.i; }));
    var tarjeta = document.querySelector('.tarjeta[data-marca="' + idMarca + '"]');
    if (tarjeta) tarjeta.classList.add('activa');
    pintarDetalleMarca(m);
  }

  /* --------------------- detalle de la palabra tocada -------------------- */

  /* La ficha no flota: vive en un sitio fijo bajo el texto y se reescribe
   * cuando tocas otra palabra. Así no tapa lo que estás leyendo y, en tinta
   * electrónica, sólo se repinta ese recuadro. */

  function pintarDetalleVacio() {
    el.detalle.textContent = '';
    el.detalle.classList.add('detalle-vacio');
    el.detalle.appendChild(crear('p', '', hayRaton
      ? 'Pon el cursor sobre una palabra (o tócala) para ver su pronunciación, su significado y su función en la frase.'
      : 'Toca una palabra para ver su pronunciación, su significado y su función en la frase.'));
  }

  /* Exploración: desde la palabra tocada se puede saltar a sus caracteres, a
   * los de su serie fonética o a otras palabras que los contienen. El rastro
   * guarda el camino; su primer elemento es siempre el token de la frase. */
  var rastro = [];

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

  function explorar(w) {
    rastro.push(w);
    pintarDetalle(tokenDeExploracion(w));
  }

  function volverA(indice) {
    rastro = rastro.slice(0, indice + 1);
    var paso = rastro[indice];
    pintarDetalle(typeof paso === 'string' ? tokenDeExploracion(paso) : paso);
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

  function pintarRastro(f) {
    if (rastro.length < 2) return;
    var nav = crear('div', 'd-rastro');
    rastro.forEach(function (paso, i) {
      var texto = typeof paso === 'string' ? paso : paso.texto;
      if (i) nav.appendChild(crear('span', 'd-rastro-sep', '›'));
      if (i === rastro.length - 1) { nav.appendChild(crear('span', 'd-rastro-actual zh', texto)); return; }
      var b = crear('button', 'd-rastro-paso zh', texto);
      b.type = 'button';
      b.dataset.rastro = i;
      nav.appendChild(b);
    });
    f.appendChild(nav);
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
   * fonética y palabras frecuentes que lo contienen. */
  function pintarCaracteres(f, texto) {
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
        .filter(function (p) { return p.palabra !== texto; });
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

  function pintarDetalle(tk) {
    var marcas = [];
    if (tk.marcas && tk.marcas.length && analisisActual) {
      tk.marcas.forEach(function (id) {
        var m = analisisActual.marcas.filter(function (x) { return x.id === id; })[0];
        if (m) marcas.push(m);
      });
    }
    window.Ficha.render(tk, el.detalle, {
      papel: true,
      marcas: marcas,
      alPulsarMarca: abrirTarjeta,
      // Las migas de pan van arriba del todo, antes de la propia ficha.
      antes: pintarRastro
    });
    if (tk.tipo === 'hanzi') pintarCaracteres(el.detalle, tk.texto);
  }

  function pintarDetalleMarca(m) {
    var f = el.detalle;
    f.textContent = '';
    f.classList.remove('detalle-vacio');
    f.appendChild(crear('div', 'd-titulo', m.titulo));
    f.appendChild(crear('div', 'f-es', m.resumen));
    f.appendChild(crear('div', 'f-extra',
      'Resaltado en los dos paneles: ' +
      m.tokens.map(function (x) { return x.texto; }).join('') + '.'));
  }

  function seleccionarToken(indice, fijar) {
    if (!analisisActual) return;
    var tk = analisisActual.tokens[indice];
    if (!tk) return;
    if (fijar) { tokenFijado = indice; marcaSeleccionada = null; }
    resaltarTokens([indice]);
    rastro = [tk];
    pintarDetalle(tk);
  }

  function soltarSeleccion() {
    tokenFijado = null;
    marcaSeleccionada = null;
    limpiarResaltado();
    pintarDetalleVacio();
  }

  function abrirTarjeta(id) {
    var tarjeta = document.querySelector('.tarjeta[data-marca="' + id + '"]');
    if (!tarjeta) return;
    Array.prototype.forEach.call(el.gramatica.querySelectorAll('.tarjeta'), function (t) {
      t.classList.remove('abierta');
    });
    tarjeta.classList.add('abierta');
    marcaSeleccionada = id;
    tokenFijado = null;
    resaltarMarca(id);
    tarjeta.scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------- análisis ----------------------------- */

  function analizar() {
    var texto = el.entrada.value;
    textoActual = texto;
    el.contador.textContent = texto.length ? texto.length + ' caracteres' : '';

    analisisActual = window.Analisis.analizar(texto);
    marcaSeleccionada = null;
    tokenFijado = null;
    pintarChino(analisisActual);
    pintarPinyin(analisisActual);
    pintarEspanol(analisisActual);
    pintarGramatica(analisisActual);
    pintarLeyenda(analisisActual);
    limpiarResaltado();
    pintarDetalleVacio();
    guardar('texto', texto);
  }

  var analizarPronto = esperar(analizar, 180);

  /* -------------------------- traducción con IA ------------------------- */

  /* Cuando la página corre publicada, Claude está a mano y no hace falta clave;
   * si no, se usa la API con la clave que ponga el usuario. */
  var sampleClaude = null;

  function traducirConIa() {
    var boton = $('#btn-traducir-ia');
    if (sampleClaude) {
      if (!textoActual.trim()) return;
      boton.disabled = true;
      el.salidaIa.textContent = '';
      el.salidaIa.appendChild(crear('p', 'vacio', 'Traduciendo…'));
      window.Traduccion.conClaude(textoActual, sampleClaude)
        .then(pintarResultadoIa)
        .catch(function (err) {
          el.salidaIa.textContent = '';
          el.salidaIa.appendChild(crear('div', 'error',
            err && err.code === 'not_granted'
              ? 'Para usar esta traducción hay que dar permiso cuando el navegador lo pida.'
              : 'No se ha podido traducir. ' + ((err && err.message) || '')));
        })
        .then(function () { boton.disabled = false; });
      return;
    }
    var clave = el.claveApi.value.trim();
    if (!clave) {
      el.salidaIa.textContent = '';
      el.salidaIa.appendChild(crear('div', 'error', 'Hace falta una clave de la API de Claude. Se consigue en console.anthropic.com y se guarda sólo en este navegador.'));
      return;
    }
    if (!textoActual.trim()) return;
    guardar('clave', clave);

    boton.disabled = true;
    el.salidaIa.textContent = '';
    el.salidaIa.appendChild(crear('p', 'vacio', 'Traduciendo…'));

    window.Traduccion.conIA(textoActual, clave).then(pintarResultadoIa).catch(function (err) {
      el.salidaIa.textContent = '';
      el.salidaIa.appendChild(crear('div', 'error', 'No se ha podido traducir. ' + err.message));
    }).then(function () { boton.disabled = false; });
  }

  function pintarResultadoIa(res) {
      el.salidaIa.textContent = '';
      var alineados = window.Traduccion.alinear(textoActual, res.segmentos);

      if (alineados.length) {
        var p = crear('div', 'texto-ia');
        alineados.forEach(function (a) {
          if (!a.es) return;
          var s = crear('span', 'seg', a.es);
          // Se traducen las posiciones del texto original a índices de token.
          var indices = [];
          analisisActual.tokens.forEach(function (tk) {
            if (tk.inicio < a.fin && tk.fin > a.inicio) indices.push(tk.i);
          });
          s.dataset.toks = indices.join(',');
          p.appendChild(s);
          p.appendChild(document.createTextNode(' '));
        });
        el.salidaIa.appendChild(p);
      } else if (res.traduccion) {
        el.salidaIa.appendChild(crear('div', 'texto-ia', res.traduccion));
      }

      if (res.notas && res.notas.length) {
        var caja = crear('div', 'notas-ia');
        caja.appendChild(crear('strong', '', 'Notas del traductor'));
        var ul = crear('ul', '');
        res.notas.forEach(function (n) { ul.appendChild(crear('li', '', n)); });
        caja.appendChild(ul);
        el.salidaIa.appendChild(caja);
      }
  }

  /* -------------------------------- modales ----------------------------- */

  function abrirModal(construir) {
    el.modalContenido.textContent = '';
    construir(el.modalContenido);
    el.modal.classList.remove('oculta');
  }
  function cerrarModal() { el.modal.classList.add('oculta'); }

  function modalEjemplos(cont) {
    cont.appendChild(crear('h2', '', 'Ejemplos para empezar'));
    cont.appendChild(crear('p', '', 'Cada uno enseña una cosa distinta. Pincha en el que quieras y se analizará al momento.'));
    var lista = crear('div', 'lista-ejemplos');
    window.Ejemplos.forEach(function (ej) {
      var b = crear('button', 'ejemplo-boton');
      b.type = 'button';
      b.appendChild(crear('span', 'e-zh', ej.texto));
      b.appendChild(crear('span', 'e-nota', ej.nota));
      b.addEventListener('click', function () {
        el.entrada.value = ej.texto;
        cerrarModal();
        analizar();
        el.entrada.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      lista.appendChild(b);
    });
    cont.appendChild(lista);
  }

  function modalAyuda(cont) {
    var html = [
      '<h2>Cómo se usa</h2>',
      '<p>Pega en el recuadro de la izquierda cualquier texto en chino: una publicación de X, ',
      'un mensaje, la etiqueta de un producto. El análisis se hace solo, mientras escribes, y ',
      'sin enviar nada a ningún servidor.</p>',

      '<h3>Los dos paneles</h3>',
      '<p>A la izquierda ves el texto partido en palabras, con el pinyin encima de cada una. ',
      'A la derecha, la traducción. En los dos lados, el <strong>subrayado</strong> indica qué papel ',
      'cumple cada trozo en la frase. <strong>Toca una palabra</strong> (o pasa el cursor, si usas ',
      'ratón) y se enciende también su equivalente en el otro panel: así se ve de un vistazo cómo ',
      'se reordena el chino al pasarlo al español. Debajo del texto aparece su ficha, y desde ahí ',
      'puedes saltar a la construcción gramatical que la afecta. Toca otra vez para soltarla.</p>',

      '<h3>En una tableta de tinta electrónica</h3>',
      '<p>El botón <strong>Tinta</strong> de arriba cambia a un modo pensado para lectores de tinta ',
      'electrónica: sin animaciones ni atenuados (que es lo que deja fantasmas en pantalla), ',
      'contraste al máximo, letra y zonas de toque más grandes, y la cabecera deja de ir pegada ',
      'arriba. Además, cada papel sintáctico pasa a tener una <strong>forma de subrayado</strong> ',
      'propia —continuo, doble, a rayas, de puntos, ondulado— para que se distingan aunque la ',
      'pantalla esté en blanco y negro o descolore el color.</p>',

      '<h3>Las dos traducciones</h3>',
      '<p><strong>Estructural</strong> es la que hace este programa por su cuenta: sustituye cada bloque ',
      'por su equivalente español y los recoloca en el orden del español. Sale literal, a veces torpe, ',
      'pero cada palabra se puede rastrear hasta el original. Sirve para entender la construcción, ',
      'no para leerla bonita.</p>',
      '<p><strong>Natural (IA)</strong> pide la traducción a la API de Claude y sale mucho mejor escrita. ',
      'Necesita una clave propia, que se guarda únicamente en este navegador.</p>',

      '<h3>Abajo: la gramática</h3>',
      '<p>Cada tarjeta es una construcción reconocida en tu texto. Pincha en ella para desplegar la ',
      'explicación completa, la fórmula, la comparación con el español y un ejemplo canónico. Al ',
      'pincharla también se resalta en los dos paneles la parte de la frase a la que se refiere.</p>',

      '<h3>La pestaña «Tarjetas»</h3>',
      '<p>Es un sistema de repetición espaciada como el de Anki, con tus mazos: 28 de ',
      'frecuencia de cien caracteres cada uno (del más común al menos), más los relatos. ',
      'Destapa la tarjeta y sale todo lo que sabemos de ese carácter: pronunciación, ',
      'significado, palabras compuestas que lo llevan, una frase de ejemplo desglosada ',
      'palabra por palabra y, si es una palabra gramatical, la construcción en la que ',
      'participa con su fórmula.</p>',
      '<p>Después eliges cuánto te ha costado: <strong>Otra vez</strong> la devuelve dentro ',
      'de la misma sesión, y <strong>Difícil</strong>, <strong>Bien</strong> o ',
      '<strong>Fácil</strong> la alejan cada vez más en el tiempo. Debajo de cada botón ',
      'pone exactamente cuándo volverá. El progreso se guarda en el dispositivo, así que no ',
      'hace falta cuenta ni conexión.</p>',

      '<h3>Por dónde empezar si no sabes nada</h3>',
      '<p>Pon el nivel en «sólo lo básico» y quédate con tres ideas: en chino los verbos no se ',
      'conjugan (el tiempo lo dan palabras como 昨天 o partículas como 了), los modificadores van ',
      'siempre delante de lo que modifican, y casi todo lo que en español va detrás del verbo, en ',
      'chino va delante. El resto es vocabulario.</p>',

      '<h3>Qué fiabilidad tiene</h3>',
      '<p>La segmentación y el análisis son automáticos y se equivocan, sobre todo con nombres ',
      'propios, lengua muy coloquial y frases largas. Cuando una palabra aparece con subrayado ',
      'punteado es que no está en el diccionario. Y si una glosa sale en cursiva es que sólo había ',
      'definición en inglés.</p>'
    ].join('');
    cont.innerHTML = html;
  }

  /* ------------------------------- arranque ----------------------------- */

  /* --------------------------- modos de la app -------------------------- */

  function cambiarModo(modo) {
    $('#modo-analizar').classList.toggle('oculta', modo !== 'analizar');
    $('#modo-tarjetas').classList.toggle('oculta', modo !== 'tarjetas');
    Array.prototype.forEach.call(document.querySelectorAll('.modo'), function (b) {
      var activo = b.dataset.modo === modo;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
    guardar('modo', modo);
    // Al volver a las tarjetas puede haber cambiado el día: se recuentan.
    if (modo === 'tarjetas' && window.UITarjetas) window.UITarjetas.refrescar();
  }

  /* -------------------------- tinta electrónica ------------------------- */

  /* En una pantalla de tinta electrónica cada cambio en pantalla cuesta un
   * repintado y deja fantasmas. Este modo quita animaciones y atenuados, sube
   * el contraste al máximo y distingue los papeles por el ESTILO del subrayado
   * además de por el color, porque el color de un Kaleido 3 sale muy lavado. */
  function aplicarTinta(activo) {
    document.body.classList.toggle('tinta', !!activo);
    var b = $('#btn-tinta');
    if (b) {
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
      b.classList.toggle('activo', !!activo);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', activo ? '#ffffff' : '#faf8f5');
    guardar('tinta', activo ? '1' : '0');
  }

  function tintaInicial() {
    // El envoltorio de Android lo enciende de entrada; si no, manda lo que el
    // usuario eligiera la última vez.
    var guardada = leer('tinta');
    if (guardada !== null) return guardada === '1';
    if (window.LEERCHINO_TINTA) return true;
    return /[?&]tinta=1/.test(location.search);
  }

  function conectarEventos() {
    el.entrada.addEventListener('input', analizarPronto);

    $('#btn-tinta').addEventListener('click', function () {
      aplicarTinta(!document.body.classList.contains('tinta'));
    });

    Array.prototype.forEach.call(document.querySelectorAll('.modo'), function (b) {
      b.addEventListener('click', function () { cambiarModo(b.dataset.modo); });
    });

    ['#op-pinyin', '#op-glosa'].forEach(function (sel) {
      $(sel).addEventListener('change', function () { if (analisisActual) pintarChino(analisisActual); });
    });
    $('#op-papeles').addEventListener('change', function () {
      document.body.classList.toggle('sin-papeles', !this.checked);
    });
    el.nivel.addEventListener('change', function () { if (analisisActual) pintarGramatica(analisisActual); });

    $('#btn-limpiar').addEventListener('click', function () {
      el.entrada.value = '';
      analizar();
      el.entrada.focus();
    });

    $('#btn-ejemplos').addEventListener('click', function () { abrirModal(modalEjemplos); });
    $('#btn-ayuda').addEventListener('click', function () { abrirModal(modalAyuda); });
    $('#modal-cerrar').addEventListener('click', cerrarModal);
    el.modal.addEventListener('click', function (e) { if (e.target === el.modal) cerrarModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        // Escape dentro de una nota sólo sale del campo: no tira la ficha.
        if (e.target && e.target.classList && e.target.classList.contains('d-mia')) { e.target.blur(); return; }
        cerrarModal(); soltarSeleccion();
      }
    });

    // pestañas del panel español
    Array.prototype.forEach.call(document.querySelectorAll('.pestana'), function (p) {
      p.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.pestana'), function (o) {
          o.classList.remove('activa');
        });
        p.classList.add('activa');
        $('#vista-estructural').classList.toggle('oculta', p.dataset.vista !== 'estructural');
        $('#vista-ia').classList.toggle('oculta', p.dataset.vista !== 'ia');
      });
    });
    $('#btn-traducir-ia').addEventListener('click', traducirConIa);

    // Resaltado cruzado. Tocar fija la selección; en un ordenador, además, el
    // cursor la previsualiza mientras no haya nada fijado.
    function tokenDelEvento(destino) {
      if (!destino || !destino.closest) return -1;
      var pal = destino.closest('[data-tok]');
      if (pal) return +pal.dataset.tok;
      var seg = destino.closest('[data-toks]');
      if (seg) {
        var lista = (seg.dataset.toks || '').split(',').filter(Boolean);
        if (lista.length) return +lista[0];
      }
      return -1;
    }

    // Dentro de la ficha: saltar a otro carácter o palabra, o volver atrás.
    el.detalle.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-explorar], [data-rastro]') : null;
      if (!b) return;
      // La ficha se repinta y el botón deja de estar en el documento: sin
      // esto, el manejador general lo tomaría por un toque fuera y soltaría
      // la selección.
      e.stopPropagation();
      if (b.dataset.rastro != null) volverA(+b.dataset.rastro);
      else explorar(b.dataset.explorar);
      if (el.detalle.getBoundingClientRect().top < 0) el.detalle.scrollIntoView({ block: 'start' });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('#modo-tarjetas') || e.target.closest('.modos')) return;
      if (e.target.closest('.detalle')) return;
      var i = tokenDelEvento(e.target);
      if (i >= 0) {
        if (tokenFijado === i) soltarSeleccion();
        else seleccionarToken(i, true);
        return;
      }
      // Tocar fuera de los paneles suelta lo que hubiera seleccionado.
      if (e.target.closest &&
          (e.target.closest('.salida') || e.target.closest('.tarjeta') ||
           e.target.closest('.cabecera') || e.target.closest('.modal'))) return;
      if (tokenFijado !== null || marcaSeleccionada) soltarSeleccion();
    });

    if (hayRaton) {
      document.addEventListener('mouseover', function (e) {
        if (tokenFijado !== null || marcaSeleccionada) return;
        var i = tokenDelEvento(e.target);
        if (i >= 0) seleccionarToken(i, false);
      });
      [el.salidaZh, el.salidaEs, el.salidaPy].forEach(function (n) {
        if (!n) return;
        n.addEventListener('mouseleave', function () {
          if (tokenFijado === null && !marcaSeleccionada) {
            limpiarResaltado();
            pintarDetalleVacio();
          }
        });
      });
    }

    // tarjetas de gramática: pinchar despliega y fija el resaltado
    el.gramatica.addEventListener('click', function (e) {
      var tarjeta = e.target.closest ? e.target.closest('.tarjeta') : null;
      if (!tarjeta) return;
      var abierta = tarjeta.classList.contains('abierta');
      Array.prototype.forEach.call(el.gramatica.querySelectorAll('.tarjeta'), function (t) {
        if (t !== tarjeta) t.classList.remove('abierta');
      });
      tarjeta.classList.toggle('abierta', !abierta);
      if (!abierta && tarjeta.dataset.marca) {
        marcaSeleccionada = tarjeta.dataset.marca;
        tokenFijado = null;
        resaltarMarca(marcaSeleccionada);
      } else {
        soltarSeleccion();
      }
    });
    el.gramatica.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var t = e.target.closest ? e.target.closest('.tarjeta') : null;
        if (t) { e.preventDefault(); t.click(); }
      }
    });
  }

  /* Deja la aplicación instalada en el dispositivo: sin conexión sigue
   * funcionando y el diccionario no se vuelve a descargar. No tiene sentido
   * (ni está permitido) en file://, que es como la carga el envoltorio
   * de Android, donde los ficheros ya están dentro. */
  function registrarServicio() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* da igual */ });
  }

  function iniciar() {
    window.Lexico.iniciar();
    window.Hanzi.iniciar();
    window.Notas.iniciar();
    window.Notas.alCambiar(function (ch) {
      Array.prototype.forEach.call(el.detalle.querySelectorAll('textarea.d-mia'), function (ta) {
        if (ta.dataset.notaChar === ch && document.activeElement !== ta) ta.value = window.Notas.leer(ch);
      });
    });
    registrarServicio();
    conectarEventos();

    aplicarTinta(tintaInicial());

    if (window.UITarjetas && window.UITarjetas.montar()) {
      cambiarModo(leer('modo') === 'tarjetas' ? 'tarjetas' : 'analizar');
    } else {
      // Sin datos de mazos, la pestaña no sirve de nada: se esconde.
      var pestana = document.querySelector('.modo[data-modo="tarjetas"]');
      if (pestana) pestana.classList.add('oculta');
    }

    var guardado = leer('texto');
    var clave = leer('clave');
    if (clave) el.claveApi.value = clave;
    el.entrada.value = guardado || window.Ejemplos[0].texto;
    analizar();

    // Saber qué build se está usando evita el lío de instalar un APK viejo
    // encima de uno nuevo: todos se llaman igual.
    var sello = $('#version-app');
    if (sello && window.LEERCHINO_VERSION) {
      sello.textContent = 'versión ' + window.LEERCHINO_VERSION;
      sello.insertAdjacentHTML('afterend', '<span class="separador">·</span>');
    }

    el.estadoDicc.textContent = window.Lexico.tamano().toLocaleString('es-ES') + ' palabras cargadas';

    // Si la página corre publicada, Claude está disponible sin clave de API.
    window.Traduccion.disponibleSinClave().then(function (sample) {
      if (!sample) return;
      sampleClaude = sample;
      $('.fila-clave').classList.add('oculta');
      var aviso = $('#vista-ia .aviso-vista');
      if (aviso) {
        aviso.textContent = 'Traducción natural hecha por Claude. No hace falta ninguna clave: ' +
          'el navegador pedirá permiso la primera vez.';
      }
      var caja = crear('div', 'fila-clave');
      var b = crear('button', 'boton', 'Traducir con Claude');
      b.type = 'button';
      b.id = 'btn-claude';
      b.addEventListener('click', traducirConIa);
      caja.appendChild(b);
      $('#vista-ia').insertBefore(caja, el.salidaIa);
    });

    // El resto del diccionario llega después y el análisis se repite solo.
    window.Lexico.cargarAmpliacion().then(function (n) {
      if (!n) return;
      el.estadoDicc.textContent = window.Lexico.tamano().toLocaleString('es-ES') + ' palabras en el diccionario';
      analizar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
