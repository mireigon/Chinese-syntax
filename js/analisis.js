/* Analizador: de un texto chino a una estructura con oraciones, cláusulas,
 * papeles sintácticos y construcciones gramaticales detectadas.
 *
 * El análisis es superficial a propósito. No construye un árbol completo, sino
 * que identifica los bloques que de verdad ayudan a leer: de quién se habla,
 * qué circunstancias se acumulan antes del verbo, cuál es el verbo, y qué viene
 * detrás. En chino ese reparto es casi todo lo que hace falta, porque el orden
 * de los bloques es rígido y no hay concordancia que ayude. */
window.Analisis = (function () {
  'use strict';

  var FIN_ORACION = '。！？!?…';
  var FIN_CLAUSULA = '，,、；;：:';

  var PAPELES = {
    tema: { nombre: 'Tema', color: 'tema', ayuda: 'De esto va la frase. Se enuncia primero, aunque no sea el sujeto del verbo.' },
    sujeto: { nombre: 'Sujeto', color: 'sujeto', ayuda: 'Quien realiza o experimenta la acción.' },
    tiempo: { nombre: 'Cuándo', color: 'circunstancia', ayuda: 'Las expresiones de tiempo van antes del verbo, casi siempre al principio.' },
    lugar: { nombre: 'Dónde', color: 'circunstancia', ayuda: 'El lugar se coloca antes del verbo, introducido por 在 y cerrado con un localizador.' },
    adverbio: { nombre: 'Adverbio', color: 'circunstancia', ayuda: 'Los adverbios se pegan delante del verbo; no se mueven como en español.' },
    modal: { nombre: 'Modal', color: 'modal', ayuda: 'Verbo modal: poder, querer, deber. Va justo antes del verbo principal.' },
    foco: { nombre: 'Foco', color: 'modal', ayuda: 'El 是 de 是...的 no significa «ser»: anuncia que lo importante viene detrás.' },
    negacion: { nombre: 'Negación', color: 'negacion', ayuda: '不 o 没, siempre delante de lo que niegan.' },
    coverbo: { nombre: 'Coverbo', color: 'coverbo', ayuda: 'Preposición que, junto con su complemento, se coloca ANTES del verbo.' },
    compl_coverbo: { nombre: 'Compl. del coverbo', color: 'coverbo', ayuda: 'Complemento que introduce el coverbo.' },
    verbo: { nombre: 'Verbo', color: 'verbo', ayuda: 'Núcleo del predicado. Un adjetivo también puede ocupar este puesto, sin necesidad de «ser».' },
    aspecto: { nombre: 'Aspecto', color: 'aspecto', ayuda: '了, 着 o 过: no son tiempos verbales, indican cómo se ve la acción.' },
    objeto: { nombre: 'Objeto', color: 'objeto', ayuda: 'Lo que recibe la acción. Va detrás del verbo, salvo con 把 o en pasiva.' },
    complemento: { nombre: 'Complemento', color: 'complemento', ayuda: 'Resultado, dirección, duración o grado: va pegado detrás del verbo.' },
    final: { nombre: 'Partícula final', color: 'final', ayuda: 'Cierra la frase y le da el tono: pregunta, sugerencia, matiz.' },
    conector: { nombre: 'Conector', color: 'conector', ayuda: 'Enlaza oraciones. En chino suelen ir en pareja.' },
    atributo: { nombre: 'Modificador', color: 'atributo', ayuda: 'Describe al sustantivo que viene detrás; se cierra con 的.' },
    puntuacion: { nombre: 'Puntuación', color: 'neutro', ayuda: '' },
    otro: { nombre: 'Otro', color: 'neutro', ayuda: '' }
  };

  /* ---------------------- división del texto ------------------------- */

  function dividir(tokens) {
    var oraciones = [], oracion = null, clausula = null;

    function nuevaOracion() {
      oracion = { tokens: [], clausulas: [], marcas: [] };
      oraciones.push(oracion);
      nuevaClausula();
    }
    function nuevaClausula() {
      clausula = { tokens: [], marcas: [] };
      if (oracion) oracion.clausulas.push(clausula);
    }

    nuevaOracion();
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      oracion.tokens.push(tk);
      clausula.tokens.push(tk);
      if (tk.tipo === 'puntuacion') {
        if (FIN_ORACION.indexOf(tk.texto) >= 0) {
          if (i < tokens.length - 1) nuevaOracion();
        } else if (FIN_CLAUSULA.indexOf(tk.texto) >= 0) {
          nuevaClausula();
        }
      }
    }
    // Se descartan las cláusulas y oraciones que sólo tienen espacios.
    oraciones.forEach(function (o) {
      o.clausulas = o.clausulas.filter(function (c) {
        return c.tokens.some(function (tk) { return tk.tipo !== 'espacio'; });
      });
    });
    return oraciones.filter(function (o) { return o.clausulas.length; });
  }

  /* --------------------- papeles dentro de la cláusula ---------------- */

  function esNominal(tk) {
    return tk.esNombre || tk.esPronombre || tk.esNumeral || tk.esClasificador ||
           tk.esLocalizador || tk.pos === 'uj' || tk.pos === 'b' || tk.pos === 'nz';
  }

  /** Índice del verbo principal, o -1. */
  function localizarVerbo(ts) {
    var candidato = -1;

    // En 是 ... 的 el 是 no es el verbo: sólo enfoca. El verbo de verdad está
    // dentro del bloque, así que se busca a partir del 是.
    var desde = 0;
    for (var s = 0; s < ts.length; s++) {
      if (ts[s].texto !== '是') continue;
      for (var e = s + 1; e < ts.length; e++) {
        if (ts[e].texto === '的' && ts[e].pos === 'uj') {
          var hayVerbo = false;
          for (var v = s + 1; v < e; v++) {
            if (ts[v].esPredicativo && !ts[v].esModal) hayVerbo = true;
          }
          if (hayVerbo) desde = s + 1;
          break;
        }
        if (ts[e].pos === 'w') break;
      }
      break;
    }

    for (var i = desde; i < ts.length; i++) {
      var tk = ts[i];
      if (!tk.esPredicativo || tk.esModal) continue;
      if (tk.pos === 'p' || tk.pos === 'pba' || tk.pos === 'pbei') continue;
      // 桌子上: 上 está en el diccionario como verbo («subir»), pero detrás de un
      // sustantivo es un localizador, no el núcleo de la frase.
      if (tk.esLocalizador && i > 0 && (ts[i - 1].esNombre || ts[i - 1].esPronombre)) continue;
      candidato = i;
      break;
    }
    if (candidato >= 0) return candidato;

    // Sin verbo claro. Una partícula de aspecto delata al verbo: lo que va
    // justo antes de 了, 着 o 过 es el predicado, diga lo que diga la etiqueta.
    for (var p = 1; p < ts.length; p++) {
      if (ts[p].pos === 'ul' || ts[p].pos === 'uz' || ts[p].pos === 'ug') {
        if (ts[p - 1].tipo === 'hanzi' && !ts[p - 1].esFinal) return p - 1;
      }
    }

    // Si hay modal, el modal hace de núcleo.
    for (var j = 0; j < ts.length; j++) if (ts[j].esModal) return j;

    // 书在桌子上: sin más verbo, el que manda es 在 («estar en»). Lo mismo con 有.
    for (var z = 0; z < ts.length; z++) {
      if (ts[z].texto === '在' || ts[z].texto === '有' || ts[z].texto === '没有') return z;
    }

    // Si la cláusula tiene coverbo, adverbio o negación, hay predicado aunque
    // el diccionario etiquete mal la palabra: se toma la última palabra plena.
    var indicio = ts.some(function (tk) {
      return tk.esCoverbo || tk.esAdverbio || tk.pos === 'pba' || tk.pos === 'pbei' ||
             tk.texto === '不' || tk.texto === '没' || tk.texto === '没有';
    });
    if (indicio) {
      for (var k = ts.length - 1; k >= 0; k--) {
        var tk = ts[k];
        if (tk.tipo !== 'hanzi' || tk.esFinal || tk.esAdverbio || tk.esCoverbo) continue;
        if (tk.pos[0] === 'u' || tk.pos === 'y' || tk.esPronombre) continue;
        if (tk.esLocalizador && k > 0 && (ts[k - 1].esNombre || ts[k - 1].esPronombre)) continue;
        if (tk.texto === '不' || tk.texto === '没' || tk.texto === '没有') continue;
        return k;
      }
    }
    // Cláusula nominal de verdad: una etiqueta, un título, un sintagma suelto.
    return -1;
  }

  function asignarPapeles(clausula) {
    var ts = clausula.tokens;
    var iVerbo = localizarVerbo(ts);
    clausula.iVerbo = iVerbo;

    for (var i = 0; i < ts.length; i++) {
      var tk = ts[i];
      if (tk.tipo === 'puntuacion') { tk.papel = 'puntuacion'; continue; }
      if (tk.tipo === 'espacio') { tk.papel = 'otro'; continue; }
      tk.papel = 'otro';
    }

    // Zona previa al verbo.
    var enCoverbo = false;
    for (var k = 0; k < ts.length; k++) {
      var t = ts[k];
      if (t.papel === 'puntuacion' || t.papel === 'otro' && t.tipo === 'espacio') continue;
      if (iVerbo >= 0 && k > iVerbo) break;

      if (t.esConjuncion) { t.papel = 'conector'; enCoverbo = false; continue; }
      if (t.texto === '不' || t.texto === '没' || t.texto === '没有' || t.texto === '别') {
        t.papel = 'negacion'; enCoverbo = false; continue;
      }
      if (t.texto === '是' && iVerbo >= 0 && k < iVerbo) { t.papel = 'foco'; enCoverbo = false; continue; }
      if (t.esModal && k !== iVerbo) { t.papel = 'modal'; enCoverbo = false; continue; }
      if (t.pos === 'pba' || t.pos === 'pbei' || t.pos === 'pbi' ||
          (t.pos === 'p' && k !== iVerbo)) {
        t.papel = 'coverbo'; enCoverbo = true; continue;
      }
      if (t.esAdverbio && !esNominal(t)) { t.papel = 'adverbio'; enCoverbo = false; continue; }
      if (t.esTiempo) { t.papel = 'tiempo'; enCoverbo = false; continue; }
      if (enCoverbo) {
        t.papel = t.esLocalizador ? 'lugar' : 'compl_coverbo';
        continue;
      }
      if (esNominal(t)) { t.papel = 'sujeto'; continue; }
    }

    if (iVerbo >= 0) ts[iVerbo].papel = 'verbo';

    // Zona posterior al verbo.
    var vistoObjeto = false;
    for (var m = iVerbo + 1; iVerbo >= 0 && m < ts.length; m++) {
      var u = ts[m];
      if (u.papel === 'puntuacion' || u.tipo === 'espacio') continue;
      if (u.esFinal) { u.papel = 'final'; continue; }
      if (u.pos === 'ul' || u.pos === 'uz' || u.pos === 'ug') { u.papel = 'aspecto'; continue; }
      if (u.pos === 'ud') { u.papel = 'complemento'; continue; }
      if (u.esResultativo || u.esDireccional) {
        if (m === iVerbo + 1) { u.papel = 'complemento'; continue; }
      }
      if (ts[m - 1] && ts[m - 1].papel === 'complemento' && !esNominal(u)) { u.papel = 'complemento'; continue; }
      if (esNominal(u) || u.tipo === 'latin' || u.tipo === 'numero') {
        u.papel = vistoObjeto ? 'complemento' : 'objeto';
        continue;
      }
      if (u.esPredicativo) { u.papel = 'complemento'; vistoObjeto = true; continue; }
      u.papel = 'complemento';
    }

    // Un bloque nominal inicial separado por coma se lee como tema.
    if (clausula.tokens.length && clausula.esTema) {
      clausula.tokens.forEach(function (x) { if (x.papel === 'sujeto') x.papel = 'tema'; });
    } else {
      // Sin coma también hay tema cuando delante del verbo hay dos grupos
      // nominales y el segundo es un pronombre: 这个字我看不懂 = «este carácter,
      // yo no lo entiendo». El primero es el tema, el pronombre es el sujeto.
      var iPron = -1;
      for (var s2 = 0; s2 < ts.length && (iVerbo < 0 || s2 < iVerbo); s2++) {
        if (ts[s2].papel === 'sujeto' && ts[s2].esPronombre) iPron = s2;
      }
      if (iPron > 0) {
        var hayPrevio = false;
        for (var s3 = 0; s3 < iPron; s3++) if (ts[s3].papel === 'sujeto') hayPrevio = true;
        if (hayPrevio) {
          for (var s4 = 0; s4 < iPron; s4++) if (ts[s4].papel === 'sujeto') ts[s4].papel = 'tema';
        }
      }
    }

    // Lo que va delante de 的 es un modificador.
    for (var d = 0; d < ts.length; d++) {
      if (ts[d].texto === '的' && ts[d].pos === 'uj') {
        for (var b = d - 1; b >= 0; b--) {
          if (ts[b].papel === 'puntuacion' || ts[b].esConjuncion) break;
          if (ts[b].papel === 'verbo' || ts[b].papel === 'sujeto' || ts[b].papel === 'tema') {
            if (b === d - 1 || ts[b].papel !== 'verbo') ts[b].papelExtra = 'atributo';
            break;
          }
          ts[b].papelExtra = 'atributo';
        }
      }
    }
    return clausula;
  }

  /* ---------------------- aplicación de las reglas -------------------- */

  var contadorMarca = 0;

  function aplicarReglas(oracion) {
    var marcas = [];
    var reglas = window.Construcciones.REGLAS;

    for (var r = 0; r < reglas.length; r++) {
      var regla = reglas[r];
      // Una regla puede describirse con varios patrones alternativos.
      var patrones = regla.patrones || [regla.patron];
      var ambitos = regla.ambito === 'oracion'
        ? [oracion.tokens]
        : oracion.clausulas.map(function (c) { return c.tokens; });

      for (var a = 0; a < ambitos.length; a++) {
        var ts = ambitos[a];
        var i = 0;
        var seguridad = 0;
        while (i < ts.length && seguridad++ < 500) {
          var m = null;
          for (var pp = 0; pp < patrones.length && !m; pp++) {
            var intento = window.Patrones.desde(patrones[pp], ts, i);
            if (intento && intento.fin > intento.inicio) m = intento;
          }
          if (!m) { i++; continue; }
          var ctx = { clausula: ts, oracion: oracion, indice: i };
          var exp = null;
          try { exp = regla.explicar(m, ctx); } catch (e) { exp = null; }
          if (!exp) { i++; continue; }
          var marca = {
            id: regla.id + '-' + (++contadorMarca),
            reglaId: regla.id,
            titulo: regla.titulo,
            familia: regla.familia,
            nivel: regla.nivel,
            formula: regla.formula,
            tokens: m.tokens.slice(),
            claves: m.claves.slice(),
            resumen: exp.resumen,
            detalle: exp.detalle,
            contraste: exp.contraste || null,
            ejemplo: exp.ejemplo || null
          };
          marcas.push(marca);
          i = Math.max(m.inicio + 1, m.fin - 1);
        }
      }
    }

    // Se quitan las coincidencias repetidas de la misma regla sobre el mismo tramo.
    var vistas = {};
    marcas = marcas.filter(function (mk) {
      var clave = mk.reglaId + ':' + mk.tokens.map(function (x) { return x.i; }).join(',');
      if (vistas[clave]) return false;
      vistas[clave] = true;
      return true;
    });

    marcas.forEach(function (mk) {
      mk.tokens.forEach(function (tk) { if (tk.marcas.indexOf(mk.id) < 0) tk.marcas.push(mk.id); });
      mk.claves.forEach(function (tk) { tk.esClave = true; });
    });
    oracion.marcas = marcas;
    return marcas;
  }

  /* ------------------------------ entrada ----------------------------- */

  function analizar(texto) {
    contadorMarca = 0;
    var tokens = window.Segmentador.segmentar(texto || '');
    window.Etiquetas.etiquetar(tokens);

    var oraciones = dividir(tokens);

    // Una cláusula que termina en coma y es puramente nominal funciona como tema.
    oraciones.forEach(function (o) {
      o.clausulas.forEach(function (c, idx) {
        c.esTema = idx === 0 && o.clausulas.length > 1 &&
          !c.tokens.some(function (tk) { return tk.esPredicativo; });
      });
      o.clausulas.forEach(asignarPapeles);
    });

    // Lo que sigue a 叫 o a 姓 es un nombre de persona, aunque el diccionario
    // no lo conozca. Sin esto, 我叫李明 se traduciría palabra por palabra.
    for (var n = 0; n < tokens.length; n++) {
      if (tokens[n].texto !== '叫' && tokens[n].texto !== '姓') continue;
      for (var q = n + 1; q < Math.min(n + 4, tokens.length); q++) {
        var cand = tokens[q];
        if (cand.tipo !== 'hanzi') break;
        if (cand.esPronombre || cand.esAdverbio || cand.esFinal || cand.pos[0] === 'u') break;
        cand.esNombrePropio = true;
      }
    }

    // El pinyin se decide al final, cuando cada token ya conoce su función.
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk.tipo !== 'hanzi') continue;
      tk.funcion = tk.papel === 'aspecto' ? 'aspecto'
        : tk.papel === 'modal' ? 'modal'
        : tk.esClasificador ? 'clasificador' : '';
      var lectura = window.Pinyin.elegirLectura(tk, tokens[i - 1], tokens[i + 1]);
      tk.py = lectura.py;
      tk.notaPy = lectura.nota;
    }

    var todasMarcas = [];
    oraciones.forEach(function (o) {
      aplicarReglas(o).forEach(function (mk) { todasMarcas.push(mk); });
    });

    var sandhi = window.Pinyin.calcularSandhi(tokens);
    sandhi.forEach(function (s) { s.token.sandhi = s; });

    return {
      texto: texto,
      tokens: tokens,
      oraciones: oraciones,
      marcas: todasMarcas,
      sandhi: sandhi,
      papeles: PAPELES
    };
  }

  return { analizar: analizar, PAPELES: PAPELES };
})();
