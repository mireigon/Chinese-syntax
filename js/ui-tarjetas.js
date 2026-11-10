/* Interfaz de las tarjetas de memoria.
 *
 * El contenido viene de los mazos de Anki importados (pinyin, traducción,
 * palabras compuestas y una frase de ejemplo desglosada). Al destaparla se
 * añade lo que la aplicación sabe por su cuenta: nivel HSK, categoría
 * gramatical, cambios de tono y, si es una palabra gramatical, la
 * construcción en la que participa con su fórmula.
 *
 * Cuándo vuelve cada tarjeta lo decide js/tarjetas.js. */
window.UITarjetas = (function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var crear = function (e, c, t) { return window.Ficha.crear(e, c, t); };

  var el = {};
  var sesion = null;
  var nuevasPorSesion = 20;

  function guardar(clave, valor) {
    try { localStorage.setItem('leerchino.' + clave, valor); } catch (e) { /* bloqueado */ }
  }
  function leer(clave) {
    try { return localStorage.getItem('leerchino.' + clave); } catch (e) { return null; }
  }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  /* ----------------------------- lista de mazos -------------------------- */

  function pintarMazos() {
    var cont = el.lista;
    cont.textContent = '';
    var grupos = window.Tarjetas.grupos();
    var t = window.Tarjetas.totales();

    el.resumenGlobal.textContent =
      t.total.toLocaleString('es-ES') + ' tarjetas. ' +
      (t.vistas ? 'Has empezado ' + t.vistas.toLocaleString('es-ES') + ', ' +
                  t.aprendidas.toLocaleString('es-ES') + ' ya asentadas. '
                : 'Aún no has empezado ninguna. ') +
      (t.pendientes ? 'Hoy te tocan ' + plural(t.pendientes, 'repaso', 'repasos') + '.'
                    : 'No tienes repasos pendientes para hoy.');

    grupos.forEach(function (g, i) {
      var seccion = crear('div', 'grupo-mazos');
      var cab = crear('div', 'grupo-cabecera');
      cab.appendChild(crear('h3', '', g.nombre));
      var sumaPend = g.mazos.reduce(function (a, m) { return a + m.pendientes; }, 0);
      var sumaTotal = g.mazos.reduce(function (a, m) { return a + m.total; }, 0);
      cab.appendChild(crear('span', 'grupo-cuenta',
        g.mazos.length + ' mazos · ' + sumaTotal.toLocaleString('es-ES') + ' tarjetas' +
        (sumaPend ? ' · ' + sumaPend + ' por repasar' : '')));
      seccion.appendChild(cab);

      var rejilla = crear('div', 'lista-mazos');
      g.mazos.forEach(function (m) { rejilla.appendChild(fichaMazo(m)); });
      seccion.appendChild(rejilla);

      // Los mazos de frecuencia son los que se estudian a diario; el resto
      // empieza plegado para no enterrarlos.
      if (i > 0) {
        seccion.classList.add('plegado');
        cab.classList.add('plegable');
        cab.addEventListener('click', function () { seccion.classList.toggle('plegado'); });
      }
      cont.appendChild(seccion);
    });
  }

  function fichaMazo(m) {
    var caja = crear('div', 'mazo');
    if (m.pendientes) caja.classList.add('mazo-pendiente');

    var cab = crear('div', 'mazo-cabecera');
    cab.appendChild(crear('h4', '', m.nombre));
    caja.appendChild(cab);

    caja.appendChild(crear('div', 'mazo-muestra', m.palabras.slice(0, 8).map(function (w) {
      return w.length > 4 ? w.slice(0, 4) + '…' : w;
    }).join(' ')));

    var barra = crear('div', 'barra');
    var hecho = crear('i', 'barra-hecho');
    hecho.style.width = Math.round(100 * m.vistas / m.total) + '%';
    var firme = crear('i', 'barra-firme');
    firme.style.width = Math.round(100 * m.aprendidas / m.total) + '%';
    barra.appendChild(hecho);
    barra.appendChild(firme);
    caja.appendChild(barra);

    var pie = crear('div', 'mazo-pie');
    var partes = [];
    if (m.pendientes) partes.push(plural(m.pendientes, 'repaso', 'repasos'));
    if (m.nuevas) partes.push(m.nuevas + ' sin ver');
    if (!partes.length) partes.push('al día');
    pie.appendChild(crear('span', 'mazo-estado', partes.join(' · ')));

    var b = crear('button', 'boton', m.pendientes || m.nuevas ? 'Estudiar' : 'Repasar');
    b.type = 'button';
    b.addEventListener('click', function () { empezar(m); });
    pie.appendChild(b);
    caja.appendChild(pie);

    if (m.vistas) {
      var r = crear('button', 'boton-plano mazo-reiniciar', 'Reiniciar');
      r.type = 'button';
      r.addEventListener('click', function () {
        if (!window.confirm('¿Borrar tu progreso de «' + m.nombre + '»? Sus ' +
                            m.total + ' tarjetas volverán a contar como nuevas.')) return;
        window.Tarjetas.reiniciar(m.palabras);
        pintarMazos();
      });
      caja.appendChild(r);
    }
    return caja;
  }

  /* -------------------------------- estudio ------------------------------ */

  function empezar(m) {
    var cola = window.Tarjetas.cola(m.palabras, nuevasPorSesion);
    if (!cola.length) cola = m.palabras.slice();   // repaso libre, sin planificar
    sesion = { mazo: m, cola: cola, indice: 0, destapada: false,
               hechas: 0, aciertos: 0, fallos: 0, total: cola.length };
    mostrar('estudio');
    el.titulo.textContent = m.grupo + ' · ' + m.nombre;
    pintarTarjeta();
  }

  function palabraActual() {
    return sesion && sesion.indice < sesion.cola.length ? sesion.cola[sesion.indice] : null;
  }

  function pintarTarjeta() {
    var palabra = palabraActual();
    if (!palabra) { terminar(); return; }

    sesion.destapada = false;
    var ficha = window.Tarjetas.ficha(palabra) || {};
    var esLectura = ficha.tipo === 'texto';

    el.frente.textContent = palabra;
    el.frente.classList.toggle('frente-texto', esLectura);
    el.frente.classList.toggle('es-nueva', !window.Tarjetas.datosDe(palabra));
    el.dorso.classList.add('oculta');
    el.dorso.textContent = '';
    el.respuestas.classList.add('oculta');
    el.acciones.classList.remove('oculta');
    el.progreso.textContent = (sesion.hechas + 1) + ' de ' + sesion.total;
    el.pista.textContent = sinRaton() ? 'Toca la tarjeta para destaparla.'
                                      : 'Espacio para destapar; luego 1, 2, 3 o 4 para responder.';
  }

  function destapar() {
    var palabra = palabraActual();
    if (!palabra || sesion.destapada) return;
    sesion.destapada = true;
    el.dorso.classList.remove('oculta');
    el.dorso.textContent = '';
    // Los botones se preparan antes de escribir el dorso, porque el dorso los
    // coloca dentro de sí mismo, justo debajo de la definición.
    pintarRespuestas(palabra);
    pintarDorso(palabra);
    el.acciones.classList.add('oculta');
  }

  /* Los botones viven dentro de la tarjeta, pegados a la definición, y no al
   * final de todo: con los compuestos, la frase de ejemplo y la gramática
   * debajo, quedaban a un scroll de distancia y había que ir a buscarlos. */
  function colocarRespuestas() {
    el.dorso.appendChild(el.respuestas);
    el.respuestas.classList.remove('oculta');
  }

  /* ----------------------------- dorso ---------------------------------- */

  function pintarDorso(palabra) {
    var ficha = window.Tarjetas.ficha(palabra) || {};

    if (ficha.tipo !== 'texto') {
      // Cabecera: lo del mazo (pinyin y traducción) más lo que sabe el
      // diccionario de la aplicación (categoría, nivel, inglés, polifonía).
      var tk = window.Ficha.tokenDePalabra(palabra);
      var cab = crear('div', 'd-cabecera');
      var ident = crear('div', 'd-identidad');
      if (ficha.py) ident.appendChild(crear('div', 'f-py', ficha.py));
      // La categoría sólo se enseña cuando es informativa y fiable: en una
      // palabra funcional (partícula, clasificador, preposición...) dice algo
      // que la traducción no dice. En un sustantivo o un verbo corriente, la
      // etiqueta del corpus para un carácter suelto se equivoca a menudo
      // (日 aparece como numeral, por las fechas) y no aporta nada.
      if (tk && tk.categoria && esFuncional(tk)) {
        ident.appendChild(crear('div', 'f-cat', tk.categoria));
      }
      cab.appendChild(ident);
      if (tk && tk.hsk) cab.appendChild(crear('span', 'etiqueta-hsk', 'HSK ' + tk.hsk));
      el.dorso.appendChild(cab);

      if (ficha.es) el.dorso.appendChild(crear('div', 'f-es', ficha.es));
      if (tk && tk.en) el.dorso.appendChild(crear('div', 'f-en', tk.en));

      var notas = [];
      if (tk && tk.sandhi) notas.push('Se pronuncia «' + tk.sandhi.dicho + '»: ' + tk.sandhi.motivo);
      if (notas.length) el.dorso.appendChild(crear('div', 'f-extra', notas.join(' ')));

      colocarRespuestas();

      if (ficha.cp && ficha.cp.length) {
        el.dorso.appendChild(seccion('Palabras que lo llevan', listaGlosas(ficha.cp)));
      }
      if (ficha.fr) {
        var caja = crear('div', '');
        caja.appendChild(crear('div', 'frase-ejemplo', ficha.fr));
        if (ficha.dg && ficha.dg.length) caja.appendChild(desglose(ficha.dg));
        el.dorso.appendChild(seccion('En una frase', caja));
      }
      pintarGramatica(palabra);
      pintarCaracteresDorso(palabra, ficha);
    } else {
      // En las tarjetas de lectura no hay definición: los botones van arriba
      // del todo, antes del desglose del texto.
      colocarRespuestas();
      if (ficha.dg && ficha.dg.length) {
        el.dorso.appendChild(seccion('Palabra por palabra', desglose(ficha.dg)));
      }
    }
  }

  function esFuncional(tk) {
    var pos = tk.pos || '';
    return pos.charAt(0) === 'u' || pos.charAt(0) === 'y' || pos.charAt(0) === 'p' ||
           pos.charAt(0) === 'c' || pos === 'q' || pos.charAt(0) === 'r' ||
           pos === 'vmod' || pos === 'vshi' || pos === 'vyou' || tk.esClasificador;
  }

  function seccion(titulo, contenido) {
    var caja = crear('div', 'dorso-seccion');
    caja.appendChild(crear('div', 'f-cat', titulo));
    caja.appendChild(contenido);
    return caja;
  }

  /** Lista vertical de compuestos: palabra, pinyin y significado. */
  function listaGlosas(filas) {
    var lista = crear('div', 'compuestos');
    filas.forEach(function (f) {
      var fila = crear('div', 'compuesto');
      fila.appendChild(crear('span', 'c-han', f[0]));
      fila.appendChild(crear('span', 'c-py', f[1]));
      fila.appendChild(crear('span', 'c-es', f[2]));
      lista.appendChild(fila);
    });
    return lista;
  }

  /** Desglose de la frase: un bloquecito por palabra, como en el mazo original. */
  function desglose(filas) {
    var caja = crear('div', 'desglose');
    filas.forEach(function (f) {
      if (!f[0] || /^[\s。，、？！：；""''（）]+$/.test(f[0])) return;
      var b = crear('div', 'dg-bloque');
      b.appendChild(crear('span', 'dg-han', f[0]));
      if (f[1]) b.appendChild(crear('span', 'dg-py', f[1]));
      if (f[2]) b.appendChild(crear('span', 'dg-es', f[2]));
      caja.appendChild(b);
    });
    return caja;
  }

  /* Las palabras más frecuentes del chino son casi todas gramaticales, y su
   * traducción sola no enseña gran cosa: 了 no «significa» nada que se pueda
   * memorizar, hace algo. Para esas, el dorso añade la construcción. */
  function pintarGramatica(palabra) {
    var construcciones = window.Tarjetas.construccionesDe(palabra);
    if (!construcciones.length) return;
    var caja = crear('div', '');
    construcciones.slice(0, 3).forEach(function (c) {
      var bloque = crear('div', 'uso');
      bloque.appendChild(crear('div', 'uso-titulo', c.titulo));
      if (c.formula) bloque.appendChild(crear('div', 'formula', c.formula));
      if (c.ejemplo) {
        var ej = crear('div', 'ejemplo');
        ej.appendChild(crear('span', 'zh', c.ejemplo.zh));
        ej.appendChild(crear('span', 'py', c.ejemplo.py));
        ej.appendChild(crear('span', 'es', c.ejemplo.es));
        bloque.appendChild(ej);
      }
      caja.appendChild(bloque);
    });
    el.dorso.appendChild(seccion(
      construcciones.length === 1 ? 'Cómo funciona' : 'Cómo funciona (' + construcciones.length + ' usos)',
      caja));
  }

  /* Lo mismo que enseña el analizador al tocar una palabra: de qué piezas
   * está hecho cada carácter, cuál le da el sonido y a quién se lo da, con qué
   * no confundirlo, palabras que lo llevan y la nota propia. Los chips
   * exploran dentro de esta misma sección, con su rastro para volver: la
   * tarjeta y sus botones de respuesta se quedan donde estaban. */
  function pintarCaracteresDorso(palabra, ficha) {
    if (!Array.from(palabra).some(window.Caracteres.esHan)) return;
    var zona = crear('div', 'dorso-chars');
    // «Palabras con» no repite los compuestos que ya trae el propio mazo.
    var excluir = (ficha.cp || []).map(function (c) { return c[0]; });
    var camino = [palabra];

    function pintar() {
      zona.textContent = '';
      var actual = camino[camino.length - 1];
      if (camino.length > 1) {
        var nav = crear('div', 'd-rastro');
        camino.forEach(function (paso, i) {
          if (i) nav.appendChild(crear('span', 'd-rastro-sep', '›'));
          if (i === camino.length - 1) { nav.appendChild(crear('span', 'd-rastro-actual zh', paso)); return; }
          var b = crear('button', 'd-rastro-paso zh', paso);
          b.type = 'button';
          b.dataset.rastro = i;
          nav.appendChild(b);
        });
        zona.appendChild(nav);
        var explorada = crear('div', 'dorso-explorada');
        window.Ficha.render(window.Caracteres.token(actual), explorada, {});
        zona.appendChild(explorada);
      }
      window.Caracteres.pintar(zona, actual, camino.length === 1 ? { excluir: excluir } : null);
    }

    zona.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-explorar], [data-rastro]') : null;
      if (!b) return;
      ev.stopPropagation();
      if (b.dataset.rastro != null) camino = camino.slice(0, +b.dataset.rastro + 1);
      else camino.push(b.dataset.explorar);
      pintar();
      if (zona.getBoundingClientRect().top < 0) zona.scrollIntoView({ block: 'start' });
    });

    pintar();
    el.dorso.appendChild(seccion(
      Array.from(palabra).filter(window.Caracteres.esHan).length > 1 ? 'Sus caracteres' : 'El carácter',
      zona));
  }

  /* ---------------------------- respuestas ------------------------------ */

  function etiquetaEspera(p) {
    if (p.enSesion) return 'ahora';
    if (p.dias === 1) return 'mañana';
    if (p.dias < 30) return p.dias + ' días';
    if (p.dias < 365) return Math.round(p.dias / 30) + ' meses';
    return '1 año';
  }

  function pintarRespuestas(palabra) {
    el.respuestas.textContent = '';
    window.Tarjetas.previsiones(palabra).forEach(function (p, i) {
      var b = crear('button', 'respuesta r-' + p.id);
      b.type = 'button';
      b.title = p.ayuda;
      b.appendChild(crear('span', 'r-tecla', String(i + 1)));
      b.appendChild(crear('span', 'r-nombre', p.nombre));
      b.appendChild(crear('span', 'r-espera', etiquetaEspera(p)));
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        calificar(p.id);
      });
      el.respuestas.appendChild(b);
    });
  }

  function calificar(nota) {
    var palabra = palabraActual();
    if (!palabra || !sesion.destapada) return;
    var r = window.Tarjetas.responder(palabra, nota);
    if (nota === 0) sesion.fallos++; else sesion.aciertos++;

    if (r.enSesion) {
      // Vuelve más adelante en esta misma sesión; no cuenta como hecha.
      sesion.cola.splice(sesion.indice, 1);
      sesion.cola.splice(Math.min(sesion.cola.length, sesion.indice + 4), 0, palabra);
    } else {
      sesion.indice++;
      sesion.hechas++;
    }
    pintarTarjeta();
    el.vistaEstudio.scrollIntoView({ block: 'start' });
  }

  function terminar() {
    mostrar('fin');
    el.resumenSesion.textContent = '';
    var actualizado = window.Tarjetas.mazo(sesion.mazo.id) || sesion.mazo;

    el.resumenSesion.appendChild(crear('p', 'f-es',
      'Has repasado ' + plural(sesion.hechas, 'tarjeta', 'tarjetas') + ' de «' + sesion.mazo.nombre + '».' +
      (sesion.fallos ? ' Fallaste ' + plural(sesion.fallos, 'vez', 'veces') + ', y esas vuelven antes.' : '')));
    el.resumenSesion.appendChild(crear('p', 'f-extra',
      'En este mazo quedan ' + actualizado.nuevas + ' sin ver y ' +
      actualizado.pendientes + ' repasos para hoy.'));

    var fila = crear('div', 'acciones-tarjeta');
    if (actualizado.nuevas || actualizado.pendientes) {
      var seguir = crear('button', 'boton boton-grande', 'Seguir con este mazo');
      seguir.type = 'button';
      seguir.addEventListener('click', function () { empezar(actualizado); });
      fila.appendChild(seguir);
    }
    var volver = crear('button', 'boton-plano', 'Volver a los mazos');
    volver.type = 'button';
    volver.addEventListener('click', irAMazos);
    fila.appendChild(volver);
    el.resumenSesion.appendChild(fila);
  }

  /* ------------------------------ navegación ----------------------------- */

  function mostrar(cual) {
    el.vistaMazos.classList.toggle('oculta', cual !== 'mazos');
    el.vistaEstudio.classList.toggle('oculta', cual !== 'estudio');
    el.vistaFin.classList.toggle('oculta', cual !== 'fin');
  }

  function irAMazos() {
    sesion = null;
    pintarMazos();
    mostrar('mazos');
  }

  function sinRaton() {
    return !(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }

  function alPulsarTecla(e) {
    if (!sesion || el.vistaEstudio.classList.contains('oculta')) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!sesion.destapada) destapar();
      return;
    }
    if (sesion.destapada && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      calificar(+e.key - 1);
    }
  }

  function montar() {
    el = {
      lista: $('#lista-mazos'),
      resumenGlobal: $('#resumen-global'),
      vistaMazos: $('#vista-mazos'),
      vistaEstudio: $('#vista-estudio'),
      vistaFin: $('#vista-fin'),
      titulo: $('#titulo-estudio'),
      progreso: $('#progreso-estudio'),
      frente: $('#frente'),
      dorso: $('#dorso'),
      acciones: $('#acciones-tarjeta'),
      respuestas: $('#respuestas'),
      pista: $('#pista-teclado'),
      resumenSesion: $('#resumen-sesion')
    };

    if (!window.Tarjetas.iniciar()) return false;

    var guardadas = leer('nuevas');
    if (guardadas !== null) nuevasPorSesion = +guardadas;
    $('#op-nuevas').value = String(nuevasPorSesion);
    $('#op-nuevas').addEventListener('change', function () {
      nuevasPorSesion = +this.value; guardar('nuevas', this.value);
    });
    $('#btn-destapar').addEventListener('click', destapar);
    $('#tarjeta').addEventListener('click', function (ev) {
      if (!sesion || sesion.destapada) return;
      // Los botones de respuesta viven dentro de la tarjeta: pulsarlos no es
      // un toque para destapar.
      if (ev.target.closest && ev.target.closest('button, a, input, textarea, select')) return;
      destapar();
    });
    $('#btn-volver-mazos').addEventListener('click', irAMazos);
    document.addEventListener('keydown', alPulsarTecla);

    irAMazos();
    return true;
  }

  return { montar: montar, refrescar: pintarMazos };
})();
