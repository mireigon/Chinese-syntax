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

  var el = {
    entrada: $('#entrada'),
    salidaZh: $('#salida-chino'),
    salidaEs: $('#salida-espanol'),
    salidaPy: $('#salida-pinyin'),
    salidaIa: $('#salida-ia'),
    gramatica: $('#salida-gramatica'),
    leyenda: $('#leyenda'),
    contador: $('#contador'),
    ficha: $('#ficha'),
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
      var i = crear('i', '');
      i.style.background = 'var(--c-' + info.color + ')';
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
    document.body.classList.remove('enfocando');
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
    document.body.classList.add('enfocando');

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
  }

  /* -------------------------- ficha de la palabra ----------------------- */

  function mostrarFicha(tk, elemento) {
    var f = el.ficha;
    f.textContent = '';

    var cab = crear('div', '');
    cab.appendChild(crear('span', 'f-han', tk.texto));
    if (tk.hsk) {
      var h = crear('span', 'etiqueta-hsk', 'HSK ' + tk.hsk);
      cab.appendChild(h);
    }
    f.appendChild(cab);
    if (tk.py) f.appendChild(crear('div', 'f-py', tk.py));
    if (tk.categoria) f.appendChild(crear('div', 'f-cat', tk.categoria));

    var gl = window.Glosa.de(tk);
    if (gl.origen === 'glosario' || gl.origen === 'compuesta' || gl.origen === 'reduplicada') {
      f.appendChild(crear('div', 'f-es', tk.es || gl.texto));
    }
    if (tk.en) f.appendChild(crear('div', 'f-en', tk.en));
    if (!tk.es && !tk.en && tk.tipo === 'hanzi') {
      f.appendChild(crear('div', 'f-es', 'Sin definición en el diccionario.'));
    }

    var extras = [];
    if (tk.papel && window.Analisis.PAPELES[tk.papel] && tk.papel !== 'otro' && tk.papel !== 'puntuacion') {
      extras.push('Función: ' + window.Analisis.PAPELES[tk.papel].nombre.toLowerCase() + '.');
    }
    if (tk.notaPy) extras.push(tk.notaPy.charAt(0).toUpperCase() + tk.notaPy.slice(1) + '.');
    if (tk.sandhi) extras.push('Se pronuncia «' + tk.sandhi.dicho + '»: ' + tk.sandhi.motivo);
    if (extras.length) f.appendChild(crear('div', 'f-extra', extras.join(' ')));

    f.classList.remove('oculta');
    var r = elemento.getBoundingClientRect();
    var ancho = f.offsetWidth;
    var izq = Math.min(window.innerWidth - ancho - 12, Math.max(8, r.left + r.width / 2 - ancho / 2));
    var arriba = r.bottom + window.scrollY + 8;
    if (r.bottom + f.offsetHeight + 20 > window.innerHeight) {
      arriba = r.top + window.scrollY - f.offsetHeight - 8;
    }
    f.style.left = izq + 'px';
    f.style.top = Math.max(8, arriba) + 'px';
  }

  function ocultarFicha() { el.ficha.classList.add('oculta'); }

  /* ------------------------------- análisis ----------------------------- */

  function analizar() {
    var texto = el.entrada.value;
    textoActual = texto;
    el.contador.textContent = texto.length ? texto.length + ' caracteres' : '';

    analisisActual = window.Analisis.analizar(texto);
    marcaSeleccionada = null;
    pintarChino(analisisActual);
    pintarPinyin(analisisActual);
    pintarEspanol(analisisActual);
    pintarGramatica(analisisActual);
    pintarLeyenda(analisisActual);
    limpiarResaltado();
    guardar('texto', texto);
  }

  var analizarPronto = esperar(analizar, 180);

  /* -------------------------- traducción con IA ------------------------- */

  function traducirConIa() {
    var clave = el.claveApi.value.trim();
    var boton = $('#btn-traducir-ia');
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

    window.Traduccion.conIA(textoActual, clave).then(function (res) {
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
    }).catch(function (err) {
      el.salidaIa.textContent = '';
      el.salidaIa.appendChild(crear('div', 'error', 'No se ha podido traducir. ' + err.message));
    }).then(function () { boton.disabled = false; });
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
      'A la derecha, la traducción. En los dos lados, el <strong>color del subrayado</strong> indica ',
      'qué papel cumple cada trozo en la frase. Al pasar el cursor por una palabra se enciende ',
      'también su equivalente en el otro panel: así se ve de un vistazo cómo se reordena el chino ',
      'al pasarlo al español.</p>',

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

  function conectarEventos() {
    el.entrada.addEventListener('input', analizarPronto);

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
      if (e.key === 'Escape') { cerrarModal(); limpiarResaltado(); ocultarFicha(); }
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

    // resaltado cruzado entre paneles
    document.addEventListener('mouseover', function (e) {
      var pal = e.target.closest ? e.target.closest('[data-tok]') : null;
      if (pal && analisisActual) {
        var tk = analisisActual.tokens[+pal.dataset.tok];
        if (!tk) return;
        if (!marcaSeleccionada) resaltarTokens([tk.i]);
        if (tk.tipo === 'hanzi') mostrarFicha(tk, pal);
        return;
      }
      var seg = e.target.closest ? e.target.closest('[data-toks]') : null;
      if (seg && !marcaSeleccionada) {
        resaltarTokens((seg.dataset.toks || '').split(',').filter(Boolean).map(Number));
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('[data-tok]')) ocultarFicha();
    });
    el.salidaZh.addEventListener('mouseleave', function () {
      if (!marcaSeleccionada) limpiarResaltado();
      ocultarFicha();
    });
    [el.salidaEs, el.salidaPy].forEach(function (n) {
      n.addEventListener('mouseleave', function () {
        if (!marcaSeleccionada) limpiarResaltado();
      });
    });

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
        resaltarMarca(marcaSeleccionada);
      } else {
        marcaSeleccionada = null;
        limpiarResaltado();
      }
    });
    el.gramatica.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var t = e.target.closest ? e.target.closest('.tarjeta') : null;
        if (t) { e.preventDefault(); t.click(); }
      }
    });
  }

  function iniciar() {
    window.Lexico.iniciar();
    conectarEventos();

    var guardado = leer('texto');
    var clave = leer('clave');
    if (clave) el.claveApi.value = clave;
    el.entrada.value = guardado || window.Ejemplos[0].texto;
    analizar();

    el.estadoDicc.textContent = window.Lexico.tamano().toLocaleString('es-ES') + ' palabras cargadas';

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
