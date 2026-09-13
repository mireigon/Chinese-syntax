/* Traducción al español.
 *
 * Dos niveles, y conviene no confundirlos:
 *
 * 1. Traducción estructural (siempre disponible, sin conexión). Se construye a
 *    partir del análisis: cada bloque chino se sustituye por su glosa española
 *    y los bloques se reordenan al orden del español. No es una traducción
 *    literaria, pero tiene una virtud que ninguna traducción automática ofrece:
 *    cada trozo del español sabe de qué trozo del chino sale, y por eso se
 *    pueden resaltar los dos lados a la vez.
 *
 * 2. Traducción natural con IA (opcional, requiere clave de la API de Claude).
 *    Se le pide al modelo que devuelva la traducción partida en segmentos
 *    alineados con el texto original, para no perder el resaltado. */
window.Traduccion = (function () {
  'use strict';

  var ASPECTO = {
    '了': { antes: 'ya', nota: 'acción completada' },
    '过': { despues: 'alguna vez', nota: 'experiencia' },
    '着': { despues: '(en ese estado)', nota: 'estado que se mantiene' }
  };
  var FINALES = {
    '吗': 'pregunta', '呢': 'pregunta', '吧': 'sugerencia',
    '啊': 'énfasis', '呀': 'énfasis', '啦': 'énfasis', '嘛': 'énfasis'
  };

  /* Palabras funcionales que no se traducen por su definición de diccionario
   * sino por lo que hacen en la frase. La cadena vacía significa que en español
   * no se dice nada: el reordenamiento ya las ha hecho innecesarias. */
  var MARCAS = {
    '把': '', '被': 'por', '比': 'que', '的': 'de', '地': '', '得': '',
    '了': '', '着': '', '过': '', '所': '', '之': 'de',
    '吗': '', '呢': '', '吧': '', '啊': '', '呀': '', '啦': '', '嘛': '',
    '个': '', '们': ''
  };

  var POSESIVOS = {
    '我': 'mi', '你': 'tu', '您': 'su', '他': 'su', '她': 'su', '它': 'su',
    '我们': 'nuestro', '咱们': 'nuestro', '你们': 'vuestro',
    '他们': 'su', '她们': 'su', '它们': 'su'
  };

  /* Los localizadores chinos van DETRÁS del lugar (桌子上, «mesa-encima»), y en
   * español la preposición va delante. Esta tabla hace el giro. */
  var LOCALIZADORES_ES = {
    '里': 'en', '里面': 'dentro de', '里边': 'dentro de', '内': 'dentro de',
    '中': 'en', '中间': 'en medio de', '当中': 'en medio de',
    '上': 'en', '上面': 'encima de', '上边': 'encima de',
    '下': 'debajo de', '下面': 'debajo de', '下边': 'debajo de',
    '前': 'delante de', '前面': 'delante de', '前边': 'delante de',
    '后': 'detrás de', '后面': 'detrás de', '后边': 'detrás de',
    '外': 'fuera de', '外面': 'fuera de', '外边': 'fuera de',
    '旁边': 'al lado de', '对面': 'enfrente de', '周围': 'alrededor de',
    '之间': 'entre', '之前': 'antes de', '之后': 'después de',
    '左边': 'a la izquierda de', '右边': 'a la derecha de', '底下': 'debajo de'
  };

  /* Un sintagma de lugar entero: «(在) 出租车 上» -> «en el taxi». */
  function renderizarLugar(tokens) {
    var utiles = tokens.filter(function (tk) {
      return tk.tipo === 'hanzi' && tk.texto !== '在';
    });
    if (!utiles.length) return '';
    var ultimo = utiles[utiles.length - 1];
    var prep = LOCALIZADORES_ES[ultimo.texto];
    if (prep) {
      var resto = renderizar(utiles.slice(0, -1)).texto;
      return resto ? prep + ' ' + resto : prep;
    }
    var texto = renderizar(utiles).texto;
    // Si la glosa ya trae la preposición dentro («家里» = «en casa») no se
    // vuelve a poner.
    if (/^(en|dentro|encima|debajo|delante|detrás|fuera|al lado|enfrente|entre|a la)\b/i.test(texto)) {
      return texto;
    }
    return texto ? 'en ' + texto : '';
  }

  /* Tras preposición el español cambia la forma del pronombre. */
  var TRAS_PREPOSICION = { '我': 'mí', '你': 'ti', '您': 'usted' };

  function glosaTexto(tk) {
    var r = window.Glosa.de(tk);
    return { texto: r.texto, origen: r.origen };
  }

  /* Traduce un grupo de tokens que forma un bloque (un sintagma nominal, el
   * verbo, un complemento...). Aquí es donde se resuelven las diferencias de
   * orden pequeñas: el 的 posesivo, los clasificadores que en español no se
   * dicen, y las partículas que no tienen equivalente. */
  function renderizar(tokens) {
    var piezas = [];
    var ingles = false;

    // 我的手机 -> «mi móvil»: el poseedor va delante en español si es pronombre.
    var iDe = -1;
    for (var d = 0; d < tokens.length; d++) {
      if (tokens[d].texto === '的' && tokens[d].pos === 'uj') { iDe = d; break; }
    }
    if (iDe > 0 && iDe < tokens.length - 1) {
      var mod = tokens.slice(0, iDe);
      var nucleo = tokens.slice(iDe + 1);
      var pos = mod.length === 1 ? POSESIVOS[mod[0].texto] : null;
      if (pos) {
        var n = renderizar(nucleo);
        return { texto: (pos + ' ' + n.texto).trim(), ingles: n.ingles };
      }
      var a = renderizar(nucleo), b = renderizar(mod);
      // 越来越多的年轻人: si el modificador es adjetival, en español va detrás
      // del sustantivo y sin «de». Si es nominal o verbal, lleva «de».
      var adjetival = mod.every(function (x) {
        return x.tipo !== 'hanzi' || x.esAdjetivo || x.esAdverbio || x.esNumeral || x.texto === '的';
      });
      // Los cuantificadores («越来越多的年轻人») van delante en español: «cada vez
      // más jóvenes». Un adjetivo a secas va detrás: «好的东西» -> «cosas buenas».
      var conAdverbio = mod.some(function (x) { return x.esAdverbio; });
      var unido = !adjetival ? a.texto + ' de ' + b.texto
                : conAdverbio ? b.texto + ' ' + a.texto
                : a.texto + ' ' + b.texto;
      return { texto: unido.trim(), ingles: a.ingles || b.ingles };
    }

    var ultimoPleno = -1;
    for (var u = tokens.length - 1; u >= 0; u--) {
      if (tokens[u].tipo === 'hanzi') { ultimoPleno = u; break; }
    }
    // 桌子上 -> «encima de la mesa»: el localizador va al final en chino y la
    // preposición al principio en español.
    var plenos = tokens.filter(function (x) { return x.tipo === 'hanzi'; });
    if (plenos.length > 1) {
      var fin = plenos[plenos.length - 1];
      var prep = LOCALIZADORES_ES[fin.texto];
      if (prep && fin.esLocalizador) {
        var base = renderizar(plenos.slice(0, plenos.indexOf(fin)));
        if (base.texto) return { texto: prep + ' ' + base.texto, ingles: base.ingles };
      }
    }

    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk.tipo === 'espacio' || tk.tipo === 'puntuacion') continue;
      if (tk.omitirEnTraduccion) continue;
      // Un 的 que cierra el grupo (是...的, nominalizador) no se traduce por «de».
      if (tk.texto === '的' && i === ultimoPleno) continue;
      if (tk.papel === 'foco') continue;      // el 是 de 是...的 no dice «ser»
      // Verbo repetido (看看, 想想): en español es «... un poco».
      if (i + 1 < tokens.length && tokens[i + 1].texto === tk.texto && tk.esPredicativo) {
        var rep = glosaTexto(tk);
        if (rep.texto) piezas.push(rep.texto + ' un poco');
        i++;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(MARCAS, tk.texto) && tk.tipo === 'hanzi') {
        if (MARCAS[tk.texto]) piezas.push(MARCAS[tk.texto]);
        continue;
      }
      // Los clasificadores no se dicen en español: «三本书» es «tres libros».
      if (tk.esClasificador && (tk.pos === 'q' ||
          (i > 0 && (tokens[i - 1].esNumeral ||
                     ['这', '那', '哪', '每', '几'].indexOf(tokens[i - 1].texto) >= 0)))) continue;
      // 一 delante de clasificador es el artículo «un», no el número «uno».
      if (tk.texto === '一' && tokens[i + 1] && tokens[i + 1].esClasificador) {
        piezas.push('un');
        continue;
      }
      var gl = glosaTexto(tk);
      if (gl.origen === 'ingles' || gl.origen === 'sin datos') ingles = true;
      if (!gl.texto) continue;
      if (window.Glosa.esDescripcion(gl.texto)) continue;   // «(clasificador general)»
      // Plural detrás de un numeral distinto de «uno»: «tres años», no «tres año».
      piezas.push(tk.plural ? window.Glosa.plural(gl.texto) : gl.texto);
    }
    return { texto: piezas.join(' ').replace(/\s+/g, ' ').trim(), ingles: ingles };
  }

  function glosa(tokens) { return renderizar(tokens).texto; }

  /** Agrupa los tokens de una cláusula por papel, respetando el orden. */
  function agrupar(clausula) {
    var grupos = [];
    var actual = null;
    clausula.tokens.forEach(function (tk) {
      if (tk.tipo === 'espacio') return;
      var papel = tk.papel || 'otro';
      if (papel === 'puntuacion') { grupos.push({ papel: 'puntuacion', tokens: [tk] }); actual = null; return; }
      if (actual && actual.papel === papel) actual.tokens.push(tk);
      else { actual = { papel: papel, tokens: [tk] }; grupos.push(actual); }
    });
    return grupos;
  }

  /** Traducción estructural de una cláusula: lista de segmentos alineados. */
  function traducirClausula(clausula) {
    var grupos = agrupar(clausula);
    var por = {};
    grupos.forEach(function (gr) { (por[gr.papel] = por[gr.papel] || []).push(gr); });

    var segmentos = [];
    function emitir(papel, texto, tokens) {
      if (!texto) return;
      segmentos.push({
        papel: papel, texto: texto, tokens: tokens || [],
        ingles: tokens ? renderizar(tokens).ingles : false
      });
    }
    function tomar(papel) { return (por[papel] || []).map(function (gr) { return gr; }); }

    // Plural detrás de un numeral que no sea «uno»: «tres años», «dos niños».
    // Se marca aquí, sobre la cláusula entera, porque el numeral y lo que
    // cuenta caen a menudo en grupos de papel distintos (两 objeto / 天 compl.).
    var esNumeroPuro = /^[0-9０-９一二三四五六七八九十百千万亿两半第]+$/;
    clausula.tokens.forEach(function (tk, idx) {
      tk.plural = false;
      if (tk.tipo !== 'hanzi' || esNumeroPuro.test(tk.texto)) return;
      var ant = clausula.tokens[idx - 1];
      if (ant && ant.esClasificador && !ant.esNumeral) ant = clausula.tokens[idx - 2];
      if (ant && ant.esNumeral && ant.texto !== '一' && !ant.esClasificador) tk.plural = true;
    });

    // Pregunta A-no-A (去不去, 能不能): en español el verbo se dice una sola vez,
    // así que se marcan la negación y la repetición para no traducirlas. El
    // verbo y el 不 caen en grupos de papel distintos, por eso se hace aquí.
    var esANoA = false;
    for (var an = 0; an + 2 < clausula.tokens.length; an++) {
      var a1 = clausula.tokens[an], neg = clausula.tokens[an + 1], a2 = clausula.tokens[an + 2];
      if (!neg || (neg.texto !== '不' && neg.texto !== '没')) continue;
      if (!a1 || !a2 || a1.texto !== a2.texto) continue;
      if (!a1.esPredicativo && !a1.esModal) continue;
      neg.omitirEnTraduccion = true;
      a2.omitirEnTraduccion = true;
      esANoA = true;
    }

    // 忘在出租车上: si el complemento posverbal empieza por 在, lo que sigue no
    // es objeto sino lugar. Se decide antes de emitir nada, para no partirlo.
    (por['complemento'] || []).forEach(function (gr) {
      if (!gr.tokens[0] || gr.tokens[0].texto !== '在') return;
      gr.esLugar = true;
      gr.lugarTokens = gr.tokens.slice();
      var finAnterior = gr.tokens[gr.tokens.length - 1].i;
      var sigue = true;
      while (sigue) {
        sigue = false;
        (por['objeto'] || []).forEach(function (og) {
          if (og.absorbido || !og.tokens[0]) return;
          if (og.tokens[0].i === finAnterior + 1) {
            gr.lugarTokens = gr.lugarTokens.concat(og.tokens);
            finAnterior = og.tokens[og.tokens.length - 1].i;
            og.absorbido = true;
            sigue = true;
          }
        });
      }
    });

    // Un complemento posverbal que empieza por coverbo (转发给朋友) introduce un
    // complemento, no un resultado: se traduce «a los amigos» y va detrás.
    var PREP_POSVERBAL = { '给': 'a', '到': 'hasta', '往': 'hacia', '向': 'hacia', '于': 'en' };
    (por['complemento'] || []).forEach(function (gr) {
      if (gr.esLugar || !gr.tokens[0]) return;
      var prep = PREP_POSVERBAL[gr.tokens[0].texto];
      if (!prep || gr.tokens.length !== 1) return;
      var siguiente = null;
      (por['objeto'] || []).forEach(function (og) {
        if (!og.absorbido && og.tokens[0] && og.tokens[0].i === gr.tokens[0].i + 1) siguiente = og;
      });
      if (!siguiente) return;
      siguiente.absorbido = true;
      gr.prepTokens = gr.tokens.concat(siguiente.tokens);
      gr.prepTexto = prep + ' ' + glosa(siguiente.tokens);
    });

    // Un resultado o una dirección pegados al verbo (笑死, 走进来) van en español
    // justo detrás del verbo, antes del objeto.
    var pegados = [];
    (por['complemento'] || []).forEach(function (gr) {
      if (gr.esLugar || gr.prepTokens || !gr.tokens[0]) return;
      var v = (por['verbo'] || [])[0];
      if (!v || !v.tokens.length) return;
      if (gr.tokens[0].i !== v.tokens[v.tokens.length - 1].i + 1) return;
      if (!gr.tokens[0].esResultativo && !gr.tokens[0].esDireccional) return;
      gr.pegadoAlVerbo = true;
      pegados.push(gr);
    });

    // El verbo 在 pleno («estar en») lleva su lugar como objeto.
    var verboEsZai = (por['verbo'] || []).some(function (gr) {
      return gr.tokens[0] && gr.tokens[0].texto === '在';
    });

    // El objeto de 把 está en el grupo del coverbo, así que se saca antes para
    // que salga en su sitio: justo detrás del verbo, como en español.
    var objetoBa = null;
    (por['coverbo'] || []).forEach(function (gr, idx) {
      if (gr.tokens[0] && gr.tokens[0].texto === '把') {
        var compl = (por['compl_coverbo'] || [])[idx];
        if (compl) objetoBa = { tokens: gr.tokens.concat(compl.tokens), compl: compl.tokens };
      }
    });
    // El aspecto se reparte entre delante y detrás del verbo. Si ya hay un 已经
    // («ya») en la cláusula, el «ya» del 了 sobra: se diría dos veces.
    var yaHayYa = clausula.tokens.some(function (tk) {
      return tk.texto === '已经' || tk.texto === '刚' || tk.texto === '刚刚';
    });
    var antesVerbo = [], despuesVerbo = [], notasAspecto = [];
    tomar('aspecto').forEach(function (gr) {
      gr.tokens.forEach(function (tk) {
        var a = ASPECTO[tk.texto];
        if (!a) return;
        if (a.antes && !yaHayYa) antesVerbo.push({ texto: a.antes, tokens: [tk] });
        if (a.despues) despuesVerbo.push({ texto: a.despues, tokens: [tk] });
        notasAspecto.push(tk.texto + ': ' + a.nota);
      });
    });

    tomar('conector').forEach(function (gr) { emitir('conector', glosa(gr.tokens), gr.tokens); });
    tomar('tema').forEach(function (gr) { emitir('tema', glosa(gr.tokens) + ',', gr.tokens); });
    tomar('tiempo').forEach(function (gr) { emitir('tiempo', glosa(gr.tokens), gr.tokens); });
    tomar('sujeto').forEach(function (gr) { emitir('sujeto', glosa(gr.tokens), gr.tokens); });
    // 也 + 不 se dice «tampoco», no «también no».
    var tampoco = null;
    (por['adverbio'] || []).forEach(function (gr) {
      if (gr.tokens.length !== 1 || gr.tokens[0].texto !== '也') return;
      (por['negacion'] || []).forEach(function (ng) {
        if (ng.tokens[0] && ng.tokens[0].i === gr.tokens[0].i + 1) {
          tampoco = { tokens: gr.tokens.concat(ng.tokens) };
          gr.absorbido = true;
          ng.absorbido = true;
        }
      });
    });
    if (tampoco) emitir('negacion', 'tampoco', tampoco.tokens);
    tomar('negacion').forEach(function (gr) {
      if (gr.absorbido || gr.tokens.every(function (x) { return x.omitirEnTraduccion; })) return;
      emitir('negacion', 'no', gr.tokens);
    });
    tomar('adverbio').forEach(function (gr) {
      if (!gr.absorbido) emitir('adverbio', glosa(gr.tokens), gr.tokens);
    });
    tomar('modal').forEach(function (gr) { emitir('modal', glosa(gr.tokens), gr.tokens); });
    tomar('foco').forEach(function (gr) { emitir('foco', '', gr.tokens); });
    antesVerbo.forEach(function (x) { emitir('aspecto', x.texto, x.tokens); });
    var hayBi = clausula.tokens.some(function (tk) { return tk.texto === '比'; });
    tomar('verbo').forEach(function (gr) {
      // 在 como verbo pleno es «estar (en)»: el lugar ya lleva su preposición.
      if (gr.tokens[0] && gr.tokens[0].texto === '在') { emitir('verbo', 'está', gr.tokens); return; }
      // 有 con un lugar delante es «hay»; con una persona delante, «tiene».
      if (gr.tokens[0] && (gr.tokens[0].texto === '有' || gr.tokens[0].texto === '没有')) {
        var antes = clausula.tokens.slice(0, clausula.tokens.indexOf(gr.tokens[0]));
        var esLugar = antes.some(function (x) { return x.esLocalizador || x.pos === 's' || x.pos === 'ns'; });
        var neg = gr.tokens[0].texto === '没有';
        emitir('verbo', esLugar ? (neg ? 'no hay' : 'hay') : (neg ? 'no tiene' : 'tiene'), gr.tokens);
        return;
      }
      var txt = glosa(gr.tokens);
      if (hayBi && gr.tokens[0] && gr.tokens[0].esAdjetivo) txt = 'más ' + txt;
      emitir('verbo', txt, gr.tokens);
    });
    pegados.forEach(function (gr) { emitir('complemento', glosa(gr.tokens), gr.tokens); });
    despuesVerbo.forEach(function (x) { emitir('aspecto', x.texto, x.tokens); });
    if (objetoBa) emitir('objeto', glosa(objetoBa.compl), objetoBa.tokens);
    tomar('objeto').forEach(function (gr) {
      if (gr.absorbido) return;
      emitir('objeto', verboEsZai ? renderizarLugar(gr.tokens) : glosa(gr.tokens), gr.tokens);
    });
    tomar('complemento').forEach(function (gr) {
      if (gr.absorbido || gr.pegadoAlVerbo) return;
      if (gr.esLugar) { emitir('complemento', renderizarLugar(gr.lugarTokens), gr.lugarTokens); return; }
      if (gr.prepTokens) { emitir('coverbo', gr.prepTexto, gr.prepTokens); return; }
      emitir('complemento', glosa(gr.tokens), gr.tokens);
    });

    // Los coverbos van delante del verbo en chino y detrás en español: aquí es
    // donde mejor se ve para qué sirve reordenar. Tres de ellos son casos
    // especiales, porque no introducen un circunstancial sino un argumento:
    //   把 -> su complemento es el OBJETO del verbo
    //   被 -> su complemento es el AGENTE de una pasiva
    //   比 -> su complemento es el segundo término de una comparación
    var cv = tomar('coverbo'), cc = tomar('compl_coverbo'), lug = tomar('lugar');
    for (var i = 0; i < Math.max(cv.length, cc.length, lug.length); i++) {
      var marca = cv[i] ? cv[i].tokens[0].texto : '';
      var compl = (cc[i] ? cc[i].tokens : []).concat(lug[i] ? lug[i].tokens : []);
      var toks = (cv[i] ? cv[i].tokens : []).concat(compl);
      if (marca === '把') continue;          // ya se ha emitido junto al verbo
      if (marca === '被') { emitir('coverbo', compl.length ? 'por ' + glosa(compl) : '(por alguien)', toks); continue; }
      if (marca === '在' || marca === '从' || marca === '到') {
        var pref = marca === '从' ? 'desde ' : marca === '到' ? 'hasta ' : '';
        emitir('coverbo', pref ? pref + glosa(compl) : renderizarLugar(compl), toks);
        continue;
      }
      if (marca === '比') { emitir('coverbo', 'que ' + glosa(compl), toks); continue; }
      var piezas = [];
      if (cv[i]) piezas.push(glosa(cv[i].tokens));
      if (compl.length) {
        var uno = compl.length === 1 ? TRAS_PREPOSICION[compl[0].texto] : null;
        piezas.push(uno || glosa(compl));
      }
      emitir('coverbo', piezas.filter(Boolean).join(' '), toks);
    }

    tomar('otro').forEach(function (gr) { emitir('otro', glosa(gr.tokens), gr.tokens); });

    var finales = tomar('final');
    var esPregunta = esANoA || clausula.tokens.some(function (tk) {
      return tk.texto === '吗' || tk.esInterrogativo;
    });
    finales.forEach(function (gr) {
      gr.tokens.forEach(function (tk) {
        var f = FINALES[tk.texto];
        if (f === 'sugerencia') emitir('final', '¿vale?', [tk]);
        else if (f === 'énfasis') emitir('final', '(énfasis)', [tk]);
      });
    });

    return { segmentos: segmentos, esPregunta: esPregunta, notasAspecto: notasAspecto };
  }

  /** Une las cláusulas de todo el texto en una traducción estructural. */
  function literal(analisis) {
    var bloques = [];
    analisis.oraciones.forEach(function (oracion) {
      var partes = [];
      var pregunta = false;
      oracion.clausulas.forEach(function (clausula) {
        var r = traducirClausula(clausula);
        if (r.esPregunta) pregunta = true;
        if (r.segmentos.length) partes.push(r.segmentos);
      });
      bloques.push({ clausulas: partes, pregunta: pregunta, oracion: oracion });
    });

    var texto = bloques.map(function (b) {
      var frase = b.clausulas.map(function (segs) {
        return segs.map(function (s) { return s.texto; }).filter(Boolean).join(' ');
      }).filter(Boolean).join('; ');
      if (!frase) return '';
      frase = frase.charAt(0).toUpperCase() + frase.slice(1);
      return b.pregunta ? '¿' + frase + '?' : frase + '.';
    }).filter(Boolean).join(' ');

    return { bloques: bloques, texto: texto };
  }

  /* ------------------------- traducción con IA ------------------------- */

  var MODELO = 'claude-sonnet-4-5';

  function instrucciones(texto) {
    return 'Eres un traductor de chino a español que trabaja para alguien que está ' +
      'aprendiendo a leer chino desde cero.\n\n' +
      'Traduce este texto al español:\n\n' + texto + '\n\n' +
      'Responde SOLO con un objeto JSON, sin texto alrededor y sin vallas de código, con esta forma:\n' +
      '{"traduccion": "la traducción natural completa en español",\n' +
      ' "segmentos": [{"zh": "trozo exacto del original", "es": "su equivalente en la traducción"}],\n' +
      ' "notas": ["observación breve sobre alguna dificultad de lectura, si la hay"]}\n\n' +
      'Reglas para "segmentos": los campos "zh" deben ser trozos literales y consecutivos ' +
      'del texto original que, concatenados, lo reconstruyan entero. Parte por unidades de ' +
      'sentido (sintagmas), no carácter a carácter. Cada "es" es la parte de la traducción ' +
      'que corresponde a ese trozo; puede quedar vacía si en español no se traduce nada ' +
      '(partículas, clasificadores).';
  }

  /** Pide la traducción natural a la API de Claude. Devuelve una promesa. */
  function conIA(texto, clave, opciones) {
    opciones = opciones || {};
    var cuerpo = {
      model: opciones.modelo || MODELO,
      max_tokens: 2000,
      messages: [{ role: 'user', content: instrucciones(texto) }]
    };
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(cuerpo)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('La API respondió ' + res.status + ': ' + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (datos) {
      var salida = (datos.content || []).map(function (c) { return c.text || ''; }).join('');
      var limpio = salida.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
      var json;
      try { json = JSON.parse(limpio); }
      catch (e) { return { traduccion: salida.trim(), segmentos: [], notas: [] }; }
      return {
        traduccion: json.traduccion || '',
        segmentos: Array.isArray(json.segmentos) ? json.segmentos : [],
        notas: Array.isArray(json.notas) ? json.notas : []
      };
    });
  }

  /** Convierte los segmentos de la IA en posiciones del texto original. */
  function alinear(texto, segmentos) {
    var pos = 0;
    var fuera = [];
    segmentos.forEach(function (s) {
      var zh = (s.zh || '').trim();
      if (!zh) return;
      var idx = texto.indexOf(zh, pos);
      if (idx < 0) idx = texto.indexOf(zh);
      if (idx < 0) { fuera.push({ inicio: -1, fin: -1, zh: zh, es: s.es || '' }); return; }
      fuera.push({ inicio: idx, fin: idx + zh.length, zh: zh, es: s.es || '' });
      pos = idx + zh.length;
    });
    return fuera;
  }

  return {
    literal: literal,
    traducirClausula: traducirClausula,
    conIA: conIA,
    alinear: alinear,
    MODELO: MODELO
  };
})();
