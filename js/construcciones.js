/* Biblioteca de construcciones gramaticales del chino, explicadas en español.
 *
 * Cada regla sabe reconocerse a sí misma en la frase y explicar qué hace,
 * usando las palabras concretas que el usuario ha escrito. La explicación
 * siempre intenta lo mismo: decir qué función cumple la pieza, dar la fórmula
 * y compararla con lo que haría el español, que es donde está la dificultad
 * real (el chino no conjuga, no declina y coloca las cosas en otro orden).
 *
 * Campos de una regla:
 *   id        identificador estable (se usa para resaltar y para los enlaces)
 *   titulo    nombre de la construcción
 *   familia   grupo temático, para ordenar la lista de explicaciones
 *   nivel     1 principiante, 2 intermedio, 3 avanzado
 *   formula   esquema abstracto
 *   ambito    'clausula' (por defecto) u 'oracion' si cruza comas
 *   patron    secuencia de piezas para window.Patrones
 *   explicar  devuelve la explicación, o null para descartar la coincidencia
 */
window.Construcciones = (function () {
  'use strict';

  var P = window.Patrones;
  var t = function (x) { return P.texto(x); };
  // Glosa en español para incrustar en las explicaciones. Devuelve cadena
  // vacía si sólo hay definición inglesa: preferimos no decir nada.
  var g = function (x) { return window.Glosa.deTokensSeguro(x); };

  function esSN(tk) { return tk.esNombre || tk.esPronombre || tk.esNumeral || tk.esClasificador; }
  function esCuerpo(tk) { return tk.tipo === 'hanzi' && !tk.esFinal; }
  function cap(m, n) { return m.capturas[n] || []; }
  function ultimo(arr) { return arr[arr.length - 1]; }

  var REGLAS = [

  /* ===================== partículas estructurales ===================== */
  {
    id: 'de-atributivo',
    titulo: '的 — une un modificador con su sustantivo',
    familia: 'Partículas estructurales',
    nivel: 1,
    formula: 'modificador + 的 + sustantivo',
    patron: [
      { fn: function (tk) { return esCuerpo(tk) && !tk.esConjuncion; },
        rep: [1, 6], nombre: 'mod', salvo: ['的'] },
      { w: '的', clave: true },
      { fn: function (tk) { return esSN(tk) || tk.esAdjetivo; }, rep: [1, 3], nombre: 'nucleo' }
    ],
    explicar: function (m) {
      var mod = cap(m, 'mod'), nuc = cap(m, 'nucleo');
      var esPosesivo = mod.length === 1 && (mod[0].esPronombre || mod[0].pos === 'nr');
      return {
        resumen: esPosesivo
          ? '的 marca posesión: «' + t(nuc) + ' de ' + t(mod) + '».'
          : '的 engancha «' + t(mod) + '» como descripción de «' + t(nuc) + '».',
        detalle: esPosesivo
          ? 'Aquí 的 hace lo mismo que el «de» del español o que un posesivo: ' +
            t(mod) + '的' + t(nuc) + ' = «' + (g(nuc) || t(nuc)) + ' de ' + (g(mod) || t(mod)) + '». ' +
            'Con la familia y las relaciones muy cercanas se suele omitir: 我妈妈 («mi madre»), no 我的妈妈.'
          : 'Todo lo que va delante de 的 describe al sustantivo que va detrás. ' +
            'Es la única forma que tiene el chino de construir lo que en español son adjetivos pospuestos, ' +
            'complementos con «de» y oraciones de relativo: el modificador SIEMPRE va delante, por largo que sea.',
        contraste: esPosesivo ? null :
          'En español el modificador va detrás («el libro QUE COMPRÉ AYER»); en chino va delante y ' +
          'se cierra con 的 («ayer compré 的 libro»). Al leer conviene buscar primero el 的 y entender ' +
          'que el sustantivo de verdad empieza justo después.',
        ejemplo: { zh: '我昨天买的书', py: 'wǒ zuótiān mǎi de shū', es: 'el libro que compré ayer' }
      };
    }
  },
  {
    id: 'de-nominalizador',
    titulo: '的 al final — «el que», «lo que»',
    familia: 'Partículas estructurales',
    nivel: 2,
    formula: '... + 的  (sin sustantivo detrás)',
    patron: [
      { fn: function (tk) { return esCuerpo(tk) && !tk.esConjuncion; },
        rep: [1, 5], nombre: 'mod', salvo: ['的'] },
      { w: '的', clave: true },
      { fn: function (tk) { return tk.esFinal || tk.pos === 'w'; }, opt: true }
    ],
    explicar: function (m, ctx) {
      var sig = ctx.clausula[m.fin];
      if (sig && (esSN(sig) || sig.esAdjetivo)) return null;   // eso ya lo cubre 的 atributivo
      return {
        resumen: '的 sin sustantivo detrás: el grupo entero pasa a funcionar como un nombre.',
        detalle: 'Cuando 的 no va seguido de sustantivo, el sustantivo está sobreentendido y el conjunto ' +
          'significa «el/la/lo que ...». «' + t(cap(m, 'mod')) + '的» equivale a «el que ' + (g(cap(m, 'mod')) || '...') + '».',
        contraste: 'Es el mismo recurso que el español «el rojo», «los de ayer», «lo que dijiste»: ' +
          'se calla el sustantivo porque se deduce del contexto.',
        ejemplo: { zh: '这本书是我的', py: 'zhè běn shū shì wǒ de', es: 'este libro es mío' }
      };
    }
  },
  {
    id: 'de-adverbial',
    titulo: '地 — convierte un adjetivo en adverbio de modo',
    familia: 'Partículas estructurales',
    nivel: 2,
    formula: 'adjetivo + 地 + verbo',
    patron: [
      { fn: esCuerpo, rep: [1, 3], nombre: 'modo', salvo: ['地'] },
      { w: '地', clave: true },
      { clase: 'esPredicativo', rep: [1, 2], nombre: 'verbo' }
    ],
    explicar: function (m) {
      return {
        resumen: '地 marca «' + t(cap(m, 'modo')) + '» como la manera en que se hace «' + t(cap(m, 'verbo')) + '».',
        detalle: 'Se lee «de» (no «dì»). Es el equivalente exacto de nuestro sufijo -mente: ' +
          t(cap(m, 'modo')) + '地 = «' + (g(cap(m, 'modo')) || '...') + '-mente». ' +
          'Ojo con no confundirlo con 的 (que describe sustantivos) ni con 得 (que va detrás del verbo).',
        contraste: 'Los tres se pronuncian «de» en esta función. Lo que los distingue es la posición: ' +
          '的 antes de un sustantivo, 地 antes de un verbo, 得 después de un verbo.',
        ejemplo: { zh: '他慢慢地走', py: 'tā mànman de zǒu', es: 'camina lentamente' }
      };
    }
  },
  {
    id: 'de-complemento',
    titulo: '得 — complemento de grado o de resultado',
    familia: 'Complementos',
    nivel: 2,
    formula: 'verbo + 得 + cómo salió / hasta qué punto',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: '得', clave: true },
      { fn: esCuerpo, rep: [1, 5], nombre: 'compl' }
    ],
    explicar: function (m) {
      return {
        resumen: '得 introduce cómo se hace o hasta qué punto llega «' + t(cap(m, 'verbo')) + '».',
        detalle: 'Lo que va detrás de 得 no es otra acción: es una valoración de la acción anterior. ' +
          t(cap(m, 'verbo')) + '得' + t(cap(m, 'compl')) + ' = «' + (g(cap(m, 'verbo')) || '...') +
          ' de manera ' + (g(cap(m, 'compl')) || '...') + '» o «... tanto que ' + (g(cap(m, 'compl')) || '...') + '». ' +
          'Si el verbo lleva objeto hay que repetirlo: 他说汉语说得很好.',
        contraste: 'El español lo resuelve con «muy bien», «tan... que», «de manera...»; el chino lo ' +
          'resuelve siempre con esta misma partícula detrás del verbo.',
        ejemplo: { zh: '他跑得很快', py: 'tā pǎo de hěn kuài', es: 'corre muy rápido' }
      };
    }
  },
  {
    id: 'potencial',
    titulo: 'Complemento potencial: V得/不 + resultado',
    familia: 'Complementos',
    nivel: 3,
    formula: 'verbo + 得/不 + resultado  →  «poder / no poder lograr X»',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: ['得', '不'], clave: true, nombre: 'marca' },
      { fn: function (tk) { return tk.esResultativo || tk.esDireccional; }, nombre: 'res' }
    ],
    explicar: function (m) {
      var neg = t(cap(m, 'marca')) === '不';
      return {
        resumen: neg
          ? '看得/看不 + resultado: aquí se niega la POSIBILIDAD de lograr «' + t(cap(m, 'res')) + '».'
          : 'Verbo + 得 + resultado: se afirma que sí se puede lograr «' + t(cap(m, 'res')) + '».',
        detalle: 'Esta es una de las construcciones más útiles y más invisibles del chino. Se mete ' +
          '得 (puedo) o 不 (no puedo) entre el verbo y su resultado: 看懂 «entender leyendo» → ' +
          '看得懂 «puedo entenderlo» / 看不懂 «no consigo entenderlo». No expresa permiso ni voluntad, ' +
          'sino capacidad efectiva en esa situación.',
        contraste: 'En español usamos verbos auxiliares («no consigo entenderlo»); el chino lo mete ' +
          'dentro de la propia palabra verbal, por eso pasa desapercibido.',
        ejemplo: { zh: '这个字我看不懂', py: 'zhège zì wǒ kàn bu dǒng', es: 'este carácter no consigo entenderlo' }
      };
    }
  },
  {
    id: 'suo-relativa',
    titulo: '所 — relativa de objeto (registro formal)',
    familia: 'Partículas estructurales',
    nivel: 3,
    formula: 'sujeto + 所 + verbo + 的 (+ sustantivo)',
    patron: [
      { w: '所', clave: true },
      { clase: 'esVerbo', nombre: 'verbo' },
      { w: '的', opt: true }
    ],
    explicar: function (m) {
      return {
        resumen: '所 anuncia una relativa culta: «lo que se ' + (g(cap(m, 'verbo')) || '...') + '».',
        detalle: 'Es una marca heredada del chino clásico que se conserva en lengua escrita y ' +
          'periodística. Señala que el sustantivo modificado es el OBJETO del verbo, no el sujeto. ' +
          'Se puede quitar sin cambiar el significado; sólo sube el registro.',
        contraste: 'Equivale a nuestro «lo que», «aquello que»: 我所说的 = «lo que digo».',
        ejemplo: { zh: '我所知道的', py: 'wǒ suǒ zhīdào de', es: 'lo que yo sé' }
      };
    }
  },

  /* ============================== aspecto ============================== */
  {
    id: 'le-verbal',
    titulo: '了 detrás del verbo — acción completada',
    familia: 'Aspecto',
    nivel: 1,
    formula: 'verbo + 了 (+ objeto)',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: '了', clave: true }
    ],
    explicar: function (m, ctx) {
      var sig = ctx.clausula[m.fin];
      var finalDeClausula = !sig || sig.pos === 'w' || sig.esFinal;
      return {
        resumen: finalDeClausula
          ? '了 aquí puede marcar acción terminada, cambio de situación, o las dos cosas a la vez.'
          : '了 marca que «' + t(cap(m, 'verbo')) + '» ya se ha completado.',
        detalle: '了 NO es un tiempo pasado: es aspecto. Dice que la acción se ve como un hecho ' +
          'acabado, sea en pasado, presente o futuro (明天我吃了饭就去 «mañana, en cuanto haya comido, voy»). ' +
          (finalDeClausula
            ? 'Al ir al final de la cláusula, además puede ser el 了 modal, que anuncia un cambio: ' +
              '«ahora ya es así, antes no». Con muchos verbos las dos lecturas se superponen y el contexto decide.'
            : 'Al ir pegado al verbo y con algo detrás, la lectura clara es la de acción completada.'),
        contraste: 'Traducirlo siempre por un pretérito es el error más común. 我吃了 no es «comí» ' +
          'sino «ya he comido / ya está comido». Para hablar del pasado sin más, el chino usa marcas ' +
          'de tiempo (昨天, 去年) y muchas veces no pone 了.',
        ejemplo: { zh: '我买了三本书', py: 'wǒ mǎi le sān běn shū', es: 'compré tres libros' }
      };
    }
  },
  {
    id: 'le-modal',
    titulo: '了 al final — cambio de situación',
    familia: 'Aspecto',
    nivel: 1,
    formula: '... + 了  (cierre de la frase)',
    patron: [
      { fn: esCuerpo, nombre: 'antes', salvo: ['了'] },
      { w: '了', clave: true },
      { fn: function (tk) { return tk.pos === 'w' || tk.esFinal; }, opt: true }
    ],
    explicar: function (m, ctx) {
      var sig = ctx.clausula[m.fin];
      if (sig && !sig.esFinal && sig.pos !== 'w') return null;
      var antes = cap(m, 'antes');
      if (antes.length && antes[0].esPredicativo) {
        // Si el token anterior es verbal, ya lo ha explicado la regla le-verbal.
        if (!antes[0].esAdjetivo) return null;
      }
      return {
        resumen: 'El 了 final anuncia un cambio: antes no era así y ahora sí.',
        detalle: 'Este 了 no habla de una acción acabada sino de un estado nuevo. 下雨了 no es ' +
          '«llovió» sino «(ya) se ha puesto a llover». 我知道了 = «ah, ya lo entiendo» (antes no lo sabía). ' +
          'Con adjetivos y cantidades es especialmente claro: 太贵了 «se ha puesto carísimo / es demasiado caro».',
        contraste: 'El español lo dice con «ya», «se ha puesto a», «ahora»: ese matiz de novedad es ' +
          'justo lo que aporta este 了.',
        ejemplo: { zh: '下雨了', py: 'xià yǔ le', es: 'ya está lloviendo / se ha puesto a llover' }
      };
    }
  },
  {
    id: 'zhe-durativo',
    titulo: '着 — estado que se mantiene',
    familia: 'Aspecto',
    nivel: 2,
    formula: 'verbo + 着',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: '着', clave: true }
    ],
    explicar: function (m) {
      return {
        resumen: '着 presenta «' + t(cap(m, 'verbo')) + '» como un estado que sigue puesto.',
        detalle: 'Se pronuncia «zhe», átono. No es exactamente el gerundio: 着 describe una situación ' +
          'que permanece, no una acción en marcha. 门开着 = «la puerta está abierta» (alguien la abrió y ' +
          'sigue así). Muy usado también para decir cómo se hace algo: 站着吃 «comer de pie».',
        contraste: 'Para «estar haciendo algo ahora mismo» el chino prefiere 在 o 正在. 着 es más bien ' +
          'nuestro participio con «estar»: «está abierta», «lleva puesto», «con la luz encendida».',
        ejemplo: { zh: '他站着说话', py: 'tā zhànzhe shuōhuà', es: 'habla de pie' }
      };
    }
  },
  {
    id: 'guo-experiencial',
    titulo: '过 — «alguna vez en la vida»',
    familia: 'Aspecto',
    nivel: 2,
    formula: 'verbo + 过',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: '过', clave: true }
    ],
    explicar: function (m) {
      return {
        resumen: '过 dice que «' + t(cap(m, 'verbo')) + '» se ha hecho alguna vez, como experiencia.',
        detalle: 'No cuenta un suceso concreto sino que registra una experiencia vivida: 我去过中国 ' +
          '«he estado en China (alguna vez)». La negación es con 没 y 过 se mantiene: 没去过 «no he ido nunca».',
        contraste: 'Es casi exactamente nuestro pretérito perfecto con valor de experiencia: ' +
          '«¿has comido alguna vez...?». La diferencia es que en chino esa lectura está marcada ' +
          'explícitamente por 过, no por el tiempo verbal.',
        ejemplo: { zh: '我没去过北京', py: 'wǒ méi qùguo Běijīng', es: 'nunca he estado en Pekín' }
      };
    }
  },
  {
    id: 'zai-progresivo',
    titulo: '在 / 正在 — estar haciendo algo ahora',
    familia: 'Aspecto',
    nivel: 1,
    formula: '(正)在 + verbo (+ 呢)',
    patron: [
      { w: ['在', '正在', '正'], clave: true, nombre: 'marca' },
      { clase: 'esPredicativo', rep: [1, 2], nombre: 'verbo' }
    ],
    explicar: function (m, ctx) {
      var v = cap(m, 'verbo');
      if (!v.length) return null;
      // 在 + lugar no es progresivo, es locativo; lo distingue el que siga un verbo.
      var hayRemate = ctx.clausula.some(function (tk) { return tk.texto === '呢'; });
      return {
        resumen: t(cap(m, 'marca')) + ' + verbo = «estar ' + (g(v) || '...') + '-ndo» en este momento.',
        detalle: 'Es el progresivo del chino y va DELANTE del verbo, no detrás. 正在 insiste en «justo ' +
          'ahora mismo», 在 basta para el uso normal' + (hayRemate ? ', y el 呢 del final refuerza ese «ahora mismo».' : '.') +
          ' No se combina con 了: una acción en curso no está terminada.',
        contraste: 'Cuidado: 在 también es «estar en un sitio» (我在家). Lo que decide es qué viene ' +
          'detrás: si es un verbo, es progresivo; si es un lugar, es locativo.',
        ejemplo: { zh: '他正在看书呢', py: 'tā zhèngzài kàn shū ne', es: 'está leyendo (ahora mismo)' }
      };
    }
  },
  {
    id: 'qilai-incoativo',
    titulo: '起来 — ponerse a / empezar a',
    familia: 'Aspecto',
    nivel: 3,
    formula: 'verbo + 起来',
    patron: [
      { clase: 'esPredicativo', nombre: 'verbo' },
      { w: '起来', clave: true }
    ],
    explicar: function (m) {
      return {
        resumen: '起来 detrás del verbo marca el arranque de la acción: «ponerse a ' + (g(cap(m, 'verbo')) || '...') + '».',
        detalle: 'Literalmente es «levantarse», pero detrás de un verbo se ha gramaticalizado con dos ' +
          'valores: empezar de golpe (他哭起来了 «se echó a llorar») y «visto desde fuera, al hacerlo» ' +
          '(看起来 «por lo que se ve», 听起来 «suena a»).',
        contraste: 'El español usa perífrasis distintas para cada caso: «echarse a», «ponerse a», ' +
          '«parecer». En chino es siempre el mismo remate 起来.',
        ejemplo: { zh: '看起来不错', py: 'kànqǐlái búcuò', es: 'tiene buena pinta' }
      };
    }
  },

  /* ============================== negación ============================== */
  {
    id: 'bu-negacion',
    titulo: '不 — negación general',
    familia: 'Negación',
    nivel: 1,
    formula: '不 + verbo / adjetivo',
    patron: [
      { w: '不', clave: true },
      { fn: function (tk) { return tk.esPredicativo || tk.esModal || tk.esCoverbo; }, nombre: 'nucleo' }
    ],
    explicar: function (m) {
      return {
        resumen: '不 niega «' + t(cap(m, 'nucleo')) + '»: costumbre, voluntad, cualidad o futuro.',
        detalle: 'El chino tiene dos negaciones y elegir mal cambia el sentido. 不 niega lo que no es ' +
          'un hecho puntual ya ocurrido: lo que uno no hace habitualmente, no quiere hacer, no va a hacer, ' +
          'o una cualidad que no se tiene. 我不吃肉 = «no como carne (nunca, por norma)».',
        contraste: 'Se pronuncia «bú» (segundo tono) cuando la sílaba siguiente lleva cuarto tono: ' +
          '不是 se dice «bú shì». Es automático y no se refleja en la escritura.',
        ejemplo: { zh: '我不喝咖啡', py: 'wǒ bù hē kāfēi', es: 'no bebo café' }
      };
    }
  },
  {
    id: 'mei-negacion',
    titulo: '没(有) — negación de lo ocurrido',
    familia: 'Negación',
    nivel: 1,
    formula: '没(有) + verbo',
    patron: [
      { w: ['没', '没有'], clave: true },
      { fn: function (tk) { return tk.esPredicativo || esSN(tk); }, nombre: 'nucleo' }
    ],
    explicar: function (m) {
      var n = cap(m, 'nucleo');
      var conSustantivo = n.length && esSN(n[0]) && !n[0].esPredicativo;
      return {
        resumen: conSustantivo
          ? '没(有) + sustantivo = «no hay / no tener ' + (g(n) || t(n)) + '».'
          : '没(有) niega que «' + t(n) + '» haya llegado a ocurrir.',
        detalle: conSustantivo
          ? 'Para negar 有 («tener», «haber») sólo vale 没: nunca se dice 不有. '
          : 'Es la negación de los hechos: dice que algo NO ha pasado. Y cancela el 了: ' +
            '我没吃 «no he comido» (jamás 我没吃了). Con 过 sí convive: 没去过 «no he ido nunca».',
        contraste: '不 y 没 se traducen los dos por «no», pero reparten el trabajo: 不 para costumbres, ' +
          'voluntad, cualidades y futuro; 没 para lo que no ha sucedido y para negar 有.',
        ejemplo: { zh: '我没吃饭', py: 'wǒ méi chī fàn', es: 'no he comido' }
      };
    }
  },
  {
    id: 'bie-prohibicion',
    titulo: '别 / 不要 — prohibición',
    familia: 'Negación',
    nivel: 1,
    formula: '别 + verbo',
    patron: [
      { w: ['别', '不要', '甭'], clave: true },
      { clase: 'esPredicativo', nombre: 'verbo' }
    ],
    explicar: function (m) {
      return {
        resumen: 'Orden negativa: «no ' + (g(cap(m, 'verbo')) || '...') + '».',
        detalle: '别 es la forma corta y coloquial; 不要 es algo más neutra. Las dos forman el imperativo ' +
          'negativo. Añadir 了 al final lo convierte en «deja ya de...»: 别说了 «deja de hablar».',
        contraste: 'Equivale a nuestro «no + subjuntivo» («no hables»). El chino no conjuga: la orden ' +
          'se reconoce sólo por 别 y por la ausencia de sujeto.',
        ejemplo: { zh: '别担心', py: 'bié dānxīn', es: 'no te preocupes' }
      };
    }
  }

  ];

  return { REGLAS: REGLAS, _util: { esSN: esSN, esCuerpo: esCuerpo, cap: cap, t: t, g: g, ultimo: ultimo } };
})();
