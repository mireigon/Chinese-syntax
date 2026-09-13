/* Construcciones (2 de 3): orden de palabras, cópula y existencia, comparación.
 * Se añaden a la lista que abre js/construcciones.js. */
(function () {
  'use strict';
  var U = window.Construcciones._util;
  var esSN = U.esSN, esCuerpo = U.esCuerpo, cap = U.cap, t = U.t, g = U.g;

  window.Construcciones.REGLAS.push(

  /* ========================= orden de palabras ========================= */
  {
    id: 'ba',
    titulo: '把 — adelantar el objeto para decir qué le pasa',
    familia: 'Orden de palabras',
    nivel: 2,
    formula: 'Sujeto + 把 + Objeto + Verbo + resultado',
    patron: [
      { w: '把', clave: true },
      { fn: esCuerpo, rep: [1, 6], nombre: 'objeto', perezoso: true },
      { clase: 'esPredicativo', nombre: 'verbo' },
      { fn: esCuerpo, rep: [0, 4], nombre: 'resto' }
    ],
    explicar: function (m) {
      var obj = cap(m, 'objeto'), v = cap(m, 'verbo'), r = cap(m, 'resto');
      return {
        resumen: '把 saca «' + t(obj) + '» delante del verbo: la frase trata de qué le pasa a ese objeto.',
        detalle: 'El orden normal es Sujeto–Verbo–Objeto. Con 把 el objeto se adelanta y queda ' +
          'Sujeto–把–Objeto–Verbo. No es un capricho de estilo: 把 exige que el verbo diga qué le ' +
          'ocurrió al objeto, así que casi siempre lleva algo detrás' +
          (r.length ? ' (aquí, «' + t(r) + '»)' : '') + ': un resultado, un destino, un 了, una cantidad. ' +
          'Por eso 我把书看 no es una frase válida, pero 我把书看完了 sí.',
        contraste: 'El español hace algo parecido cuando dice «el libro ya me lo he leído»: se ' +
          'adelanta el objeto para centrar la frase en él. La diferencia es que en chino esa ' +
          'construcción es obligatoria en muchos casos y está marcada con una palabra propia.',
        ejemplo: { zh: '我把门关上了', py: 'wǒ bǎ mén guānshàng le', es: 'he cerrado la puerta' }
      };
    }
  },
  {
    id: 'bei-pasiva',
    titulo: '被 — voz pasiva',
    familia: 'Orden de palabras',
    nivel: 2,
    formula: 'Paciente + 被 (+ agente) + Verbo + resultado',
    patron: [
      { w: '被', clave: true },
      { fn: function (tk) { return esSN(tk) && !tk.esPredicativo; }, rep: [0, 3], nombre: 'agente', perezoso: true },
      { clase: 'esVerbo', nombre: 'verbo' },
      { fn: esCuerpo, rep: [0, 3], nombre: 'resto' }
    ],
    explicar: function (m, ctx) {
      var agente = cap(m, 'agente');
      var previos = ctx.clausula.slice(0, m.inicio);
      return {
        resumen: '被 marca pasiva: ' + (previos.length ? '«' + t(previos) + '»' : 'el sujeto') +
          ' recibe la acción' + (agente.length ? ' de «' + t(agente) + '»' : '') + '.',
        detalle: 'El sujeto de la frase es quien sufre la acción, no quien la hace. El agente puede ' +
          'omitirse por completo (被打了 «le pegaron»), cosa que en español obliga a decir «alguien» o a ' +
          'usar la tercera persona del plural. Como con 把, el verbo casi nunca va desnudo: lleva detrás ' +
          'un 了, un resultado o una cantidad.',
        contraste: 'La pasiva china se usa mucho menos que la española y arrastra un matiz de algo ' +
          'desagradable o no querido. Muchas frases que en español van en pasiva, en chino van en activa ' +
          'o directamente sin sujeto.',
        ejemplo: { zh: '我的手机被偷了', py: 'wǒ de shǒujī bèi tōu le', es: 'me han robado el móvil' }
      };
    }
  },
  {
    id: 'causativa',
    titulo: '让 / 叫 / 使 — hacer que alguien haga algo',
    familia: 'Orden de palabras',
    nivel: 2,
    formula: 'A + 让/叫/使 + B + verbo',
    patron: [
      { w: ['让', '叫', '使'], clave: true, nombre: 'marca' },
      { fn: function (tk) { return esSN(tk) && !tk.esPredicativo; }, rep: [1, 3], nombre: 'agente', perezoso: true },
      { clase: 'esVerbo', nombre: 'verbo' },
      { fn: esCuerpo, rep: [0, 3], nombre: 'resto' }
    ],
    explicar: function (m) {
      var marca = t(cap(m, 'marca'));
      return {
        resumen: marca + ': hace que «' + t(cap(m, 'agente')) + '» ' + (g(cap(m, 'verbo')) || t(cap(m, 'verbo'))) + '.',
        detalle: 'Son verbos que toman una frase entera como objeto: alguien provoca que otro haga algo ' +
          'o esté de cierta manera. 让 y 叫 son «dejar» o «mandar»; 使 es más formal y se traduce por ' +
          '«hacer que». La estructura es A + marca + B + verbo, y B es a la vez objeto del primer verbo ' +
          'y sujeto del segundo.' +
          (marca !== '使' ? ' Ojo: 让 y 叫 también pueden introducir una pasiva coloquial, y sólo el ' +
            'contexto decide («él me dejó ir» frente a «me lo quitaron»).' : ''),
        contraste: 'El español usa subjuntivo («hace que venga»); el chino encadena los dos verbos sin ' +
          'marca de subordinación ninguna.',
        ejemplo: { zh: '妈妈让我早点儿回家', py: 'māma ràng wǒ zǎodiǎnr huí jiā', es: 'mamá me hace volver pronto a casa' }
      };
    }
  },
  {
    id: 'shi-de',
    titulo: '是 ... 的 — poner el foco en cómo, cuándo o dónde',
    familia: 'Orden de palabras',
    nivel: 2,
    formula: '是 + circunstancia + verbo + 的',
    ambito: 'clausula',
    patron: [
      { w: '是', clave: true },
      { fn: esCuerpo, rep: [1, 6], nombre: 'foco', salvo: ['的'] },
      { w: '的', clave: true }
    ],
    explicar: function (m) {
      var foco = cap(m, 'foco');
      if (!foco.some(function (tk) { return tk.esPredicativo; })) return null;
      return {
        resumen: 'El bloque 是...的 destaca las circunstancias: no se discute QUÉ pasó, sino cómo o cuándo.',
        detalle: 'Se usa para hechos ya conocidos por los dos hablantes, cuando lo que se quiere ' +
          'precisar es el cuándo, el dónde, el cómo o el con quién. 我是坐飞机来的 = «vine EN AVIÓN» ' +
          '(que vine ya se sabe). Sin 是...的 la frase informaría del hecho; con ellos, informa de la circunstancia.',
        contraste: 'El español lo hace con entonación y con el orden («fue ayer cuando llegué»). El ' +
          'chino lo marca con estas dos palabras, y por eso al leer conviene fijarse en si hay un 的 ' +
          'suelto al final: cambia por completo lo que la frase está subrayando.',
        ejemplo: { zh: '我是昨天来的', py: 'wǒ shì zuótiān lái de', es: 'llegué ayer (fue ayer cuando llegué)' }
      };
    }
  },
  {
    id: 'lian-dou',
    titulo: '连 ... 都/也 — «incluso», «ni siquiera»',
    familia: 'Orden de palabras',
    nivel: 3,
    formula: '连 + elemento + 都/也 + predicado',
    patron: [
      { w: '连', clave: true },
      { fn: esCuerpo, rep: [1, 4], nombre: 'foco', perezoso: true },
      { w: ['都', '也'], clave: true }
    ],
    explicar: function (m) {
      return {
        resumen: '连...都/也 presenta «' + t(cap(m, 'foco')) + '» como el caso extremo: «incluso», «ni siquiera».',
        detalle: 'Sirve para decir que algo llega tan lejos que hasta el caso más improbable se cumple. ' +
          'Con negación se traduce por «ni siquiera»: 他连饭都没吃 «ni siquiera ha comido». El 都 o el 也 ' +
          'son obligatorios; sin ellos la construcción no funciona.',
        contraste: 'El español sólo necesita «incluso» o «ni siquiera». El chino exige la pareja: ' +
          'una marca delante del elemento destacado y otra antes del verbo.',
        ejemplo: { zh: '他连汉字都会写', py: 'tā lián Hànzì dōu huì xiě', es: 'sabe escribir incluso caracteres' }
      };
    }
  },
  {
    id: 'tema',
    titulo: 'Tema al principio de la frase',
    familia: 'Orden de palabras',
    nivel: 2,
    formula: 'Tema + (coma) + comentario',
    ambito: 'oracion',
    patron: [
      { fn: function (tk) { return esSN(tk) || tk.esTiempo; }, rep: [1, 4], nombre: 'tema' },
      { w: ['，', ','], clave: true },
      { fn: esCuerpo, rep: [1, 12], nombre: 'comentario' }
    ],
    explicar: function (m, ctx) {
      var tema = cap(m, 'tema');
      if (!tema.length) return null;
      // Tiene que abrir la oración: un sintagma suelto en mitad de la frase no
      // es un tema, es el final de la cláusula anterior.
      var antes = ctx.clausula[m.inicio - 1];
      if (antes && antes.pos !== 'w') return null;
      // Y tiene que haber algo que comentar: sin verbo detrás no es tema.
      if (!cap(m, 'comentario').some(function (tk) { return tk.esPredicativo; })) return null;
      return {
        resumen: '«' + t(tema) + '» se enuncia primero como tema, y el resto comenta sobre ello.',
        detalle: 'El chino organiza la frase en tema + comentario antes que en sujeto + predicado. ' +
          'Se anuncia de qué se va a hablar y luego se dice algo al respecto, aunque ese tema no sea ' +
          'el sujeto gramatical del verbo: 这本书, 我看过了 = «este libro, ya lo he leído».',
        contraste: 'El español puede hacerlo («este libro ya me lo he leído»), pero lo marca con un ' +
          'pronombre («lo») que en chino no existe. Al leer, el primer bloque suele ser el tema, no el sujeto.',
        ejemplo: { zh: '中文，我觉得很难', py: 'Zhōngwén, wǒ juéde hěn nán', es: 'el chino, me parece difícil' }
      };
    }
  },

  /* ======================== cópula y existencia ======================== */
  {
    id: 'shi-copula',
    titulo: '是 — «ser» entre dos sustantivos',
    familia: 'Cópula y existencia',
    nivel: 1,
    formula: 'A + 是 + B',
    patron: [
      { w: '是', clave: true },
      { fn: function (tk) { return esSN(tk) || tk.pos === 'm'; }, rep: [1, 4], nombre: 'atributo' }
    ],
    explicar: function (m, ctx) {
      var sig = ctx.clausula[m.fin];
      if (sig && sig.texto === '的') return null;      // eso es 是...的
      return {
        resumen: '是 identifica: «... es ' + (g(cap(m, 'atributo')) || t(cap(m, 'atributo'))) + '».',
        detalle: '是 une dos sustantivos, y sólo eso. Con adjetivos NO se usa: «soy alto» no es 我是高 ' +
          'sino 我很高. Un adjetivo chino ya funciona como verbo por sí solo, así que no necesita cópula.',
        contraste: 'Ese es uno de los errores clásicos del hispanohablante, porque en español «ser» ' +
          'vale para todo. En chino, 是 sólo para «A es B» (dos nombres); para cualidades, el adjetivo ' +
          'solo, casi siempre acompañado de 很.',
        ejemplo: { zh: '他是老师', py: 'tā shì lǎoshī', es: 'es profesor' }
      };
    }
  },
  {
    id: 'you-existencial',
    titulo: '有 — «hay» y «tener»',
    familia: 'Cópula y existencia',
    nivel: 1,
    formula: 'lugar/poseedor + 有 + lo que hay',
    patron: [
      { w: ['有', '没有'], clave: true },
      { fn: function (tk) { return esSN(tk) || tk.esNumeral; }, rep: [1, 5], nombre: 'objeto' }
    ],
    explicar: function (m, ctx) {
      var previos = ctx.clausula.slice(0, m.inicio);
      var lugar = previos.filter(function (tk) { return tk.esLocalizador || tk.pos === 's' || tk.pos === 'ns'; });
      return {
        resumen: lugar.length
          ? '有 introduce lo que hay en «' + t(previos) + '».'
          : '有 = «tener» o «haber»: ' + (g(cap(m, 'objeto')) || t(cap(m, 'objeto'))) + '.',
        detalle: 'La misma palabra cubre nuestros dos verbos. Si delante hay un lugar, se lee «hay»; ' +
          'si hay una persona, se lee «tiene». El orden es siempre lugar/poseedor primero: ' +
          '桌子上有书 «encima de la mesa hay libros».',
        contraste: 'Se niega únicamente con 没 (没有), nunca con 不. Y en las frases de existencia el ' +
          'lugar va delante, al revés que en español («hay libros encima de la mesa»).',
        ejemplo: { zh: '家里有三个人', py: 'jiā lǐ yǒu sān ge rén', es: 'en casa hay tres personas' }
      };
    }
  },
  {
    id: 'zai-locativo',
    titulo: '在 — estar en un sitio',
    familia: 'Cópula y existencia',
    nivel: 1,
    formula: 'X + 在 + lugar (+ localizador)',
    patron: [
      { w: '在', clave: true },
      { fn: function (tk) { return esSN(tk) || tk.pos === 's' || tk.pos === 'ns'; }, rep: [1, 3], nombre: 'lugar' },
      { clase: 'esLocalizador', opt: true, nombre: 'loc' }
    ],
    explicar: function (m, ctx) {
      var sig = ctx.clausula[m.fin];
      if (sig && sig.esPredicativo) return null;    // entonces es progresivo o coverbo
      var loc = cap(m, 'loc');
      return {
        resumen: '在 sitúa: «está en ' + (g(cap(m, 'lugar')) || t(cap(m, 'lugar'))) + '».',
        detalle: 'Aquí 在 es un verbo pleno, «estar (en)». ' + (loc.length
          ? 'La palabra «' + t(loc) + '» que va detrás del lugar es un localizador: en chino la posición ' +
            '(dentro, encima, detrás) se pone DESPUÉS del sitio, no delante.'
          : 'Cuando hace falta precisar la posición se añade detrás un localizador (里 dentro, 上 encima, ' +
            '下 debajo): 桌子上 «encima de la mesa».'),
        contraste: 'El español pone la preposición delante («en la mesa», «encima de la mesa»); el ' +
          'chino pone el lugar primero y la posición detrás, como si dijera «mesa-encima».',
        ejemplo: { zh: '他在家里', py: 'tā zài jiā lǐ', es: 'está en casa' }
      };
    }
  },

  /* ============================ comparación ============================ */
  {
    id: 'bi-comparativo',
    titulo: '比 — comparativo de superioridad',
    familia: 'Comparación',
    nivel: 2,
    formula: 'A + 比 + B + adjetivo (+ diferencia)',
    patron: [
      { w: '比', clave: true },
      { fn: esCuerpo, rep: [1, 4], nombre: 'segundo', perezoso: true },
      { fn: function (tk) { return tk.esAdjetivo || tk.esPredicativo; }, nombre: 'rasgo' },
      { fn: esCuerpo, rep: [0, 3], nombre: 'diferencia' }
    ],
    explicar: function (m, ctx) {
      var primero = ctx.clausula.slice(0, m.inicio);
      var dif = cap(m, 'diferencia');
      return {
        resumen: '«' + t(primero) + '» es más ' + (g(cap(m, 'rasgo')) || '...') + ' que «' + t(cap(m, 'segundo')) + '».',
        detalle: 'La fórmula es A 比 B + adjetivo, y el adjetivo va SOLO, sin 很 ni 更 delante: ' +
          '他比我高 «él es más alto que yo». Poner 很 ahí es el error típico. ' +
          (dif.length ? 'Lo que va detrás del adjetivo («' + t(dif) + '») cuantifica la diferencia: «más alto POR ESTO».'
                      : 'Si se quiere precisar cuánto, se añade detrás del adjetivo: 高一点儿 «un poco más alto», 高两公分 «dos centímetros más alto».'),
        contraste: 'El español necesita «más ... que»; el chino no tiene «más»: la comparación entera ' +
          'la lleva 比, y el adjetivo se queda desnudo.',
        ejemplo: { zh: '今天比昨天热', py: 'jīntiān bǐ zuótiān rè', es: 'hoy hace más calor que ayer' }
      };
    }
  },
  {
    id: 'comparativo-igualdad',
    titulo: '跟 ... 一样 — comparativo de igualdad',
    familia: 'Comparación',
    nivel: 2,
    formula: 'A + 跟/和 + B + 一样 (+ adjetivo)',
    patron: [
      { w: ['跟', '和', '与', '同'], clave: true },
      { fn: esCuerpo, rep: [1, 4], nombre: 'segundo', perezoso: true },
      { w: '一样', clave: true },
      { clase: 'esAdjetivo', opt: true, nombre: 'rasgo' }
    ],
    explicar: function (m) {
      var r = cap(m, 'rasgo');
      return {
        resumen: 'Igualdad: «igual que ' + t(cap(m, 'segundo')) + '»' + (r.length ? ', de ' + (g(r) || '...') : '') + '.',
        detalle: 'A 跟 B 一样 = «A es igual que B». Si se añade un adjetivo detrás se concreta en qué: ' +
          'A 跟 B 一样高 «A es tan alto como B». La negación va delante de 一样: 不一样 «no es igual».',
        contraste: 'Donde el español dice «tan... como», el chino dice «igual», y el adjetivo va al final.',
        ejemplo: { zh: '我跟他一样高', py: 'wǒ gēn tā yíyàng gāo', es: 'soy tan alto como él' }
      };
    }
  },
  {
    id: 'meiyou-comparativo',
    titulo: '没有 ... (那么) — comparativo de inferioridad',
    familia: 'Comparación',
    nivel: 2,
    formula: 'A + 没有 + B + (那么/这么) + adjetivo',
    patron: [
      { w: ['没有', '没'], clave: true },
      { fn: esCuerpo, rep: [1, 3], nombre: 'segundo', perezoso: true },
      { w: ['那么', '这么'], opt: true },
      { clase: 'esAdjetivo', nombre: 'rasgo' }
    ],
    explicar: function (m) {
      return {
        resumen: 'No llega al nivel de «' + t(cap(m, 'segundo')) + '» en ' + (g(cap(m, 'rasgo')) || '...') + '.',
        detalle: 'Es la forma normal de decir «menos que». El chino no dice «A es menos alto que B» ' +
          'sino «A no tiene la altura de B»: 我没有他高 «no soy tan alto como él». 不比 existe pero significa ' +
          'otra cosa («no es que sea más...»), así que para «menos que» lo natural es 没有.',
        contraste: 'Es la negación del comparativo de igualdad, no la de 比. Por eso se traduce mejor ' +
          'por «no es tan... como» que por «es menos... que».',
        ejemplo: { zh: '我没有他高', py: 'wǒ méiyǒu tā gāo', es: 'no soy tan alto como él' }
      };
    }
  },
  {
    id: 'superlativo',
    titulo: '最 / 更 — superlativo y comparativo sin segundo término',
    familia: 'Comparación',
    nivel: 1,
    formula: '最 / 更 + adjetivo',
    patron: [
      { w: ['最', '更', '更加', '越发'], clave: true, nombre: 'grado' },
      { fn: function (tk) { return tk.esAdjetivo || tk.esPredicativo; }, nombre: 'rasgo' }
    ],
    explicar: function (m) {
      var esMax = t(cap(m, 'grado')) === '最';
      return {
        resumen: esMax ? '最 = «el más»: superlativo.' : '更 = «aún más» respecto a algo ya dicho.',
        detalle: esMax
          ? '最 delante del adjetivo da el superlativo. No hace falta artículo ni concordancia: ' +
            '最好 «el mejor», 最贵的 «el más caro».'
          : '更 supone que ya hay un término de comparación en el contexto: 更好 «todavía mejor». ' +
            'No se usa dentro de una frase con 比 (ahí el adjetivo va solo).',
        contraste: 'El español marca el superlativo con el artículo («el más alto»); el chino sólo ' +
          'con 最, sin artículos, que no existen.',
        ejemplo: esMax
          ? { zh: '这个最好', py: 'zhège zuì hǎo', es: 'este es el mejor' }
          : { zh: '今天更冷', py: 'jīntiān gèng lěng', es: 'hoy hace aún más frío' }
      };
    }
  },
  {
    id: 'yue-yue',
    titulo: '越 ... 越 ... — «cuanto más..., más...»',
    familia: 'Comparación',
    nivel: 3,
    formula: '越 + A + 越 + B',
    patron: [
      { w: '越', clave: true },
      { fn: esCuerpo, rep: [1, 3], nombre: 'a', perezoso: true },
      { w: '越', clave: true },
      { fn: esCuerpo, rep: [1, 3], nombre: 'b' }
    ],
    explicar: function (m) {
      return {
        resumen: 'Correlación: cuanto más «' + t(cap(m, 'a')) + '», más «' + t(cap(m, 'b')) + '».',
        detalle: 'Los dos 越 van cada uno delante de su predicado. Existe también la variante ' +
          '越来越 + adjetivo, que significa «cada vez más» sin segundo término: 越来越贵 «cada vez más caro».',
        contraste: 'Calca bastante bien nuestro «cuanto más..., más...», con la ventaja de que en chino ' +
          'las dos piezas son la misma palabra.',
        ejemplo: { zh: '越学越有意思', py: 'yuè xué yuè yǒu yìsi', es: 'cuanto más lo estudias, más interesante es' }
      };
    }
  }

  );
})();
