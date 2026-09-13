/* Glosa española de una palabra o de un grupo de palabras.
 *
 * El glosario escrito a mano cubre el vocabulario nuclear, pero el diccionario
 * completo tiene 144.000 entradas y las demás sólo traen definición inglesa.
 * Aquí se resuelve en cascada: glosa española directa; si no, composición a
 * partir de las piezas de la palabra; si no, la definición inglesa marcada como
 * tal; y como último recurso, el propio carácter. Nunca se cuela inglés sin
 * avisar de que lo es. */
window.Glosa = (function () {
  'use strict';

  /* Primera acepción de una glosa. Corta por «/» o «;», pero nunca dentro de
   * un paréntesis: «de (partícula posesiva / de relativo)» es una sola glosa. */
  function acepciones(texto) {
    if (!texto) return [];
    var fuera = [], nivel = 0, ini = 0;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (c === '(') nivel++;
      else if (c === ')') nivel--;
      else if ((c === '/' || c === ';') && nivel === 0) {
        fuera.push(texto.slice(ini, i).trim());
        ini = i + 1;
      }
    }
    fuera.push(texto.slice(ini).trim());
    return fuera.filter(Boolean);
  }

  /* Primera acepción aprovechable. Si la primera es sólo una aclaración entre
   * paréntesis («(clasificador de negocios) / casa»), se salta y se coge la
   * siguiente: dentro de una frase española la aclaración no dice nada. */
  function primeraAcepcion(texto) {
    var lista = acepciones(texto);
    for (var i = 0; i < lista.length; i++) {
      if (!esDescripcion(lista[i])) return lista[i];
    }
    return lista[0] || '';
  }

  /* Una glosa que es sólo una aclaración entre paréntesis («(clasificador
   * general)») describe la palabra en vez de traducirla: no sirve para meterla
   * dentro de una frase en español. */
  function esDescripcion(glosa) {
    return /^\(.*\)$/.test((glosa || '').trim());
  }

  /* Transcripción de un nombre propio: las sílabas se juntan y sólo la primera
   * va en mayúscula, como se escribe Běijīng. */
  function transcribir(token) {
    var py = (token.py || '').replace(/\s+/g, ' ').trim();
    if (!py) return '';
    var junto = py.split(' ').join('');
    return junto.charAt(0).toUpperCase() + junto.slice(1);
  }

  /* Parte una palabra desconocida en trozos que sí tengan glosa española,
   * prefiriendo los trozos largos. Devuelve null si no se puede cubrir entera. */
  function componerPorPalabras(texto) {
    if (texto.length > 6) return null;
    var partes = [];
    var i = 0;
    var largoMaximo = 0;
    while (i < texto.length) {
      var encontrado = 0;
      for (var len = Math.min(4, texto.length - i); len >= 1; len--) {
        var e = window.Lexico.buscar(texto.substr(i, len));
        if (e && e.es) {
          var trozo = primeraAcepcion(e.es);
          if (!esDescripcion(trozo)) partes.push(trozo);
          encontrado = len;
          break;
        }
      }
      if (!encontrado) return null;
      i += encontrado;
      if (encontrado > 1) largoMaximo = Math.max(largoMaximo, encontrado);
    }
    // Descomponer una palabra conocida en caracteres sueltos suele dar
    // disparates («行李» = «valer ciruela» en vez de «equipaje»), así que sólo
    // se acepta si alguno de los trozos es una palabra de verdad.
    return partes.length > 1 && largoMaximo > 1 ? partes.join(' ') : null;
  }

  /** Glosa española de un token. Devuelve { texto, origen }. */
  function de(token) {
    if (!token) return { texto: '', origen: 'vacio' };
    if (token.tipo !== 'hanzi') return { texto: token.texto, origen: 'literal' };
    // Nombres propios detectados por el contexto (lo que sigue a 叫 o a 姓):
    // se transcriben aunque el carácter tenga glosa, porque ahí no significa
    // lo que significa suelto. 李 es «Li», no «ciruela».
    if (token.esNombrePropio) return { texto: transcribir(token), origen: 'nombre propio' };

    if (token.es) return { texto: primeraAcepcion(token.es), origen: 'glosario' };

    // Nombres propios del diccionario sin glosa española: se transcriben.
    if (!token.esNumeral && !token.esClasificador &&
        (token.pos === 'nr' || token.pos === 'ns' || token.pos === 'nt' || token.pos === 'nrt')) {
      var tr = transcribir(token);
      if (tr) return { texto: tr, origen: 'nombre propio' };
    }

    // Verbo reduplicado (看看, 想想): «mirar un poco».
    if (token.texto.length === 2 && token.texto[0] === token.texto[1]) {
      var base = window.Lexico.buscar(token.texto[0]);
      if (base && base.es) {
        return { texto: primeraAcepcion(base.es) + ' un poco', origen: 'reduplicada' };
      }
    }

    // Composición: se parte la palabra en trozos conocidos. Se intenta primero
    // con trozos largos, porque 年轻人 es «年轻 + 人» (joven + persona) y no
    // «年 + 轻 + 人» (año + ligero + persona).
    if (token.texto.length > 1) {
      var porPalabras = componerPorPalabras(token.texto);
      if (porPalabras) return { texto: porPalabras, origen: 'compuesta' };

      if (token.en) return { texto: primeraAcepcion(token.en), origen: 'ingles' };

      var partes = [];
      var completo = true;
      for (var i = 0; i < token.texto.length; i++) {
        var e = window.Lexico.buscar(token.texto[i]);
        if (!e || !e.es) { completo = false; break; }
        // Las piezas que sólo se describen entre paréntesis y los clasificadores
        // no aportan nada dentro de una frase española: «一本» es «uno», no
        // «uno raíz».
        if (window.Etiquetas && window.Etiquetas.CLASIFICADORES.has(token.texto[i])) continue;
        var trozo = primeraAcepcion(e.es);
        if (esDescripcion(trozo)) continue;
        partes.push(trozo);
      }
      if (completo && partes.length) {
        // «三年» se compone como «tres año»: si la primera pieza es un numeral
        // distinto de uno, la última va en plural.
        if (partes.length > 1 && token.esNumeral && token.texto[0] !== '一') {
          partes[partes.length - 1] = plural(partes[partes.length - 1]);
        }
        return { texto: partes.join(' '), origen: 'compuesta' };
      }
    }
    if (token.en) return { texto: primeraAcepcion(token.en), origen: 'ingles' };
    return { texto: token.texto, origen: 'sin datos' };
  }

  /* Plural del español, para cuando delante hay un numeral: «tres año» chirría
   * lo bastante como para merecer esta regla de andar por casa. */
  function plural(texto) {
    if (!texto || texto.indexOf(' ') >= 0 || /[()]/.test(texto)) return texto;
    if (/[aeiouáéíóú]$/i.test(texto)) return texto + 's';
    if (/[sxz]$/i.test(texto)) return texto;
    if (/[íú]$/i.test(texto)) return texto + 'es';
    return texto + 'es';
  }

  /** Glosa de una secuencia de tokens, unida con espacios. */
  function deTokens(tokens) {
    if (!tokens || !tokens.length) return '';
    var fuera = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].tipo === 'espacio' || tokens[i].tipo === 'puntuacion') continue;
      var r = de(tokens[i]);
      if (r.texto) fuera.push(r.texto);
    }
    return fuera.join(' ');
  }

  /** Como deTokens, pero nunca devuelve inglés: si no hay glosa española usa
   *  el propio carácter chino. Sirve para incrustar en las explicaciones, donde
   *  una palabra inglesa suelta confunde más de lo que ayuda. */
  function deTokensSeguro(tokens) {
    if (!tokens || !tokens.length) return '';
    var fuera = [];
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk.tipo === 'espacio' || tk.tipo === 'puntuacion') continue;
      var r = de(tk);
      fuera.push(r.origen === 'ingles' || r.origen === 'sin datos' ? tk.texto : r.texto);
    }
    return fuera.join(' ');
  }

  return { de: de, deTokens: deTokens, deTokensSeguro: deTokensSeguro, plural: plural,
           primeraAcepcion: primeraAcepcion, acepciones: acepciones, esDescripcion: esDescripcion };
})();
