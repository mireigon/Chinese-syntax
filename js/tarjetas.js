/* Tarjetas de memoria con repetición espaciada.
 *
 * Los mazos vienen de una exportación de Anki del propio usuario, convertida
 * por tools/importar-anki.py: 28 mazos de frecuencia de cien caracteres cada
 * uno, más los relatos. Cada tarjeta trae su pinyin, su traducción, palabras
 * compuestas y una frase de ejemplo desglosada palabra a palabra.
 *
 * La planificación es una versión reducida de SM-2, que es lo que usan Anki y
 * AnkiDroid: cada tarjeta guarda su facilidad y su intervalo, y cada respuesta
 * los ajusta. La idea de fondo es que una palabra que recuerdas sin esfuerzo
 * no necesita volver a aparecer mañana, y una que fallas sí.
 *
 * Este módulo no toca el DOM: sólo decide qué toca estudiar y cuándo vuelve.
 */
window.Tarjetas = (function () {
  'use strict';

  var TAMANO_MAZO = 100;
  var CLAVE = 'leerchino.tarjetas';
  var FACILIDAD_MIN = 1.3, FACILIDAD_MAX = 2.8, FACILIDAD_INICIAL = 2.5;

  /** Las cuatro respuestas, en el mismo orden que en AnkiDroid. */
  var RESPUESTAS = [
    { id: 0, nombre: 'Otra vez', ayuda: 'No me ha salido. Vuelve dentro de un momento.' },
    { id: 1, nombre: 'Difícil',  ayuda: 'Me ha costado. Vuelve pronto.' },
    { id: 2, nombre: 'Bien',     ayuda: 'La sabía.' },
    { id: 3, nombre: 'Fácil',    ayuda: 'Inmediata. Que tarde mucho en volver.' }
  ];

  var datos = { grupos: [], mazos: {}, fichas: {} };
  var vocabulario = [];               // todas las palabras, sin repetir
  var indiceMazos = {};               // id -> { id, nombre, grupo, palabras }
  /** palabra -> [facilidad, intervalo, repeticiones, vence, fallos] */
  var estado = {};

  /* --------------------------- almacenamiento --------------------------- */

  /** Día local como número entero, para no depender de la hora. */
  function hoy() {
    var d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }

  function cargar() {
    estado = {};
    try {
      var crudo = localStorage.getItem(CLAVE);
      if (!crudo) return;
      var guardados = JSON.parse(crudo);
      Object.keys(guardados).forEach(function (w) {
        var v = guardados[w];
        if (v && v.length >= 4) estado[w] = v;
      });
    } catch (e) { /* almacenamiento bloqueado: se estudia sin guardar */ }
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch (e) { /* sin espacio o bloqueado */ }
  }

  function iniciar() {
    var crudo = window.ZH_MAZOS;
    if (!crudo || !crudo.grupos) return 0;
    datos = crudo;
    indiceMazos = {};
    vocabulario = [];
    datos.grupos.forEach(function (g) {
      g.mazos.forEach(function (m) {
        var palabras = datos.mazos[m.id] || [];
        indiceMazos[m.id] = { id: m.id, nombre: m.nombre, grupo: g.nombre, palabras: palabras };
        palabras.forEach(function (w) { vocabulario.push(w); });
      });
    });
    cargar();
    return vocabulario.length;
  }

  /* ------------------------------- mazos -------------------------------- */

  function resumen(m) {
    var dia = hoy();
    var nuevas = 0, pendientes = 0, aprendidas = 0;
    m.palabras.forEach(function (w) {
      var e = estado[w];
      if (!e) { nuevas++; return; }
      if (e[3] <= dia) pendientes++;
      // «Aprendida» = ya aguanta tres semanas o más entre repasos.
      if (e[1] >= 21) aprendidas++;
    });
    return {
      id: m.id, nombre: m.nombre, grupo: m.grupo, palabras: m.palabras,
      total: m.palabras.length,
      nuevas: nuevas, pendientes: pendientes, aprendidas: aprendidas,
      vistas: m.palabras.length - nuevas
    };
  }

  /** Los grupos de mazos con el recuento de cada uno, para la pantalla inicial. */
  function grupos() {
    return datos.grupos.map(function (g) {
      return {
        nombre: g.nombre,
        mazos: g.mazos.map(function (m) { return resumen(indiceMazos[m.id]); })
      };
    });
  }

  function mazo(id) {
    return indiceMazos[id] ? resumen(indiceMazos[id]) : null;
  }

  /** Contenido de una tarjeta tal y como vino del fichero de Anki. */
  function ficha(palabra) { return datos.fichas[palabra] || null; }

  /**
   * Cola de estudio de un mazo: primero lo que toca repasar, después palabras
   * nuevas hasta el límite pedido.
   */
  function cola(palabras, limiteNuevas) {
    var dia = hoy();
    var pendientes = [], nuevas = [];
    palabras.forEach(function (w) {
      var e = estado[w];
      if (!e) nuevas.push(w);
      else if (e[3] <= dia) pendientes.push(w);
    });
    if (limiteNuevas != null && limiteNuevas >= 0) nuevas = nuevas.slice(0, limiteNuevas);
    return pendientes.concat(nuevas);
  }

  /* --------------------------- planificación ---------------------------- */

  function limitar(x, min, max) { return Math.max(min, Math.min(max, x)); }

  function estadoInicial() { return [FACILIDAD_INICIAL, 0, 0, hoy(), 0]; }

  /**
   * Calcula el estado siguiente sin tocar nada. Lo usan tanto la respuesta de
   * verdad como la previsión que se enseña en los botones, para que lo que
   * anuncia el botón sea exactamente lo que va a pasar.
   */
  function calcular(e, nota) {
    var facilidad = e[0], intervalo = e[1], repeticiones = e[2], fallos = e[4] || 0;

    if (nota === 0) {
      // Fallo: se reinicia el intervalo y vuelve dentro de la misma sesión.
      return {
        siguiente: [limitar(facilidad - 0.2, FACILIDAD_MIN, FACILIDAD_MAX), 0, 0, hoy(), fallos + 1],
        dias: 0,
        enSesion: true
      };
    }

    if (repeticiones === 0) {
      // Primer acierto: arranque corto, como los pasos de aprendizaje de Anki.
      intervalo = nota === 3 ? 4 : 1;
    } else if (nota === 1) {
      facilidad = limitar(facilidad - 0.15, FACILIDAD_MIN, FACILIDAD_MAX);
      intervalo = Math.max(1, Math.round(intervalo * 1.2));
    } else if (nota === 2) {
      intervalo = Math.max(1, Math.round(intervalo * facilidad));
    } else {
      facilidad = limitar(facilidad + 0.15, FACILIDAD_MIN, FACILIDAD_MAX);
      intervalo = Math.max(1, Math.round(intervalo * facilidad * 1.3));
    }
    // Un tope sensato: más de un año no aporta nada y descuadra la vista.
    intervalo = Math.min(intervalo, 365);
    return {
      siguiente: [facilidad, intervalo, repeticiones + 1, hoy() + intervalo, fallos],
      dias: intervalo,
      enSesion: false
    };
  }

  /** Aplica una respuesta y devuelve cuándo vuelve la tarjeta. */
  function responder(palabra, nota) {
    var r = calcular(estado[palabra] || estadoInicial(), nota);
    estado[palabra] = r.siguiente;
    guardar();
    return { dias: r.dias, enSesion: r.enSesion };
  }

  /** Cuánto tardaría en volver con cada respuesta, para rotular los botones. */
  function previsiones(palabra) {
    var actual = estado[palabra] || estadoInicial();
    return RESPUESTAS.map(function (r) {
      var c = calcular(actual, r.id);
      return { id: r.id, nombre: r.nombre, ayuda: r.ayuda, dias: c.dias, enSesion: c.enSesion };
    });
  }

  /* ------------------------ gramática de la palabra ---------------------- */

  /* Muchas de las palabras más frecuentes son gramaticales (了, 把, 被, 的, 得)
   * y su traducción sola no enseña gran cosa. Pero la aplicación ya sabe
   * explicarlas: aquí se buscan las construcciones cuyo patrón nombra esa
   * palabra, para poder enseñar su fórmula y su ejemplo en el dorso. */
  function literalesDe(patron) {
    var fuera = [];
    (patron || []).forEach(function (pieza) {
      if (!pieza || !pieza.w) return;
      (Array.isArray(pieza.w) ? pieza.w : [pieza.w]).forEach(function (w) { fuera.push(w); });
    });
    return fuera;
  }

  function construccionesDe(palabra) {
    var reglas = (window.Construcciones && window.Construcciones.REGLAS) || [];
    var fuera = [];
    reglas.forEach(function (r) {
      var patrones = r.patrones || [r.patron];
      var aparece = patrones.some(function (p) { return literalesDe(p).indexOf(palabra) >= 0; });
      if (!aparece) return;
      fuera.push({ id: r.id, titulo: r.titulo, familia: r.familia, nivel: r.nivel,
                   formula: r.formula, ejemplo: ejemploDe(r) });
    });
    return fuera;
  }

  /* El ejemplo canónico vive dentro de explicar(), que necesita una frase
   * analizada. Se analiza el ejemplo de la propia regla para sacarlo. */
  var ejemplosCache = {};
  function ejemploDe(regla) {
    if (ejemplosCache[regla.id] !== undefined) return ejemplosCache[regla.id];
    var salida = null;
    try {
      var sonda = { capturas: {}, claves: [], tokens: [], inicio: 0, fin: 0 };
      var exp = regla.explicar(sonda, { clausula: [], oracion: { clausulas: [] }, indice: 0 });
      if (exp && exp.ejemplo) salida = exp.ejemplo;
    } catch (e) { salida = null; }
    ejemplosCache[regla.id] = salida;
    return salida;
  }

  /* ------------------------------- cuentas ------------------------------ */

  function totales() {
    var dia = hoy();
    var vistas = 0, pendientes = 0, aprendidas = 0;
    vocabulario.forEach(function (w) {
      var e = estado[w];
      if (!e) return;
      vistas++;
      if (e[3] <= dia) pendientes++;
      if (e[1] >= 21) aprendidas++;
    });
    return { total: vocabulario.length, vistas: vistas, pendientes: pendientes, aprendidas: aprendidas };
  }

  function datosDe(palabra) {
    var e = estado[palabra];
    if (!e) return null;
    return { facilidad: e[0], intervalo: e[1], repeticiones: e[2], vence: e[3], fallos: e[4] || 0 };
  }

  /** Borra el progreso de un mazo (o de todo si no se pasa nada). */
  function reiniciar(palabras) {
    (palabras || vocabulario).forEach(function (w) { delete estado[w]; });
    guardar();
  }

  return {
    iniciar: iniciar,
    grupos: grupos,
    mazo: mazo,
    ficha: ficha,
    cola: cola,
    responder: responder,
    previsiones: previsiones,
    totales: totales,
    datosDe: datosDe,
    construccionesDe: construccionesDe,
    reiniciar: reiniciar,
    hoy: hoy,
    RESPUESTAS: RESPUESTAS,
    TAMANO_MAZO: TAMANO_MAZO
  };
})();
