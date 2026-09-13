/* Construcciones (3 de 3): modalidad, preguntas, clasificadores, complementos,
 * adverbios de alcance, conectores, coverbos y morfología. */
(function () {
  'use strict';
  var U = window.Construcciones._util;
  var esSN = U.esSN, esCuerpo = U.esCuerpo, cap = U.cap, t = U.t, g = U.g;

  window.Construcciones.REGLAS.push(

  /* ============================= modalidad ============================= */
  {
    id: 'modales',
    titulo: 'Verbos modales: 会 / 能 / 可以 / 要 / 想 / 应该',
    familia: 'Modalidad',
    nivel: 1,
    formula: 'modal + verbo',
    patron: [
      { clase: 'esModal', clave: true, nombre: 'modal' },
      { clase: 'esPredicativo', rep: [1, 2], nombre: 'verbo' }
    ],
    explicar: function (m) {
      var mod = t(cap(m, 'modal'));
      var notas = {
        '会': 'saber hacer algo porque se ha aprendido (我会说中文) y también «va a pasar» como predicción.',
        '能': 'ser capaz en esta situación concreta: tener la posibilidad física o práctica.',
        '可以': 'estar permitido; también «se puede» como propuesta.',
        '要': 'querer o ir a hacer algo; según el contexto, también «hay que».',
        '想': 'querer, tener ganas; más suave que 要. Solo, también significa «pensar, echar de menos».',
        '应该': 'deber moral o expectativa razonable: «debería».',
        '必须': 'obligación fuerte: «tener que», sin alternativa.',
        '得': 'obligación coloquial; aquí se pronuncia «děi».',
        '愿意': 'estar dispuesto a, acceder de buen grado.',
        '敢': 'atreverse a.'
      };
      return {
        resumen: mod + ' + ' + t(cap(m, 'verbo')) + ': ' + (notas[mod] || 'matiz modal sobre el verbo') ,
        detalle: 'Los modales van siempre justo delante del verbo principal y no llevan nunca 了, 着 ni 过. ' +
          'La negación se coloca delante del modal (不能去, no 能不去). ' +
          'Tres de ellos se traducen todos por «poder» en español y conviene separarlos bien: ' +
          '会 = saber (habilidad aprendida), 能 = ser capaz ahora, 可以 = estar permitido.',
        contraste: 'El español distingue «saber / poder / deber» con verbos distintos, pero los usa de ' +
          'forma más laxa. En chino la elección es más estricta y cambia el significado.',
        ejemplo: { zh: '我会说一点儿中文', py: 'wǒ huì shuō yìdiǎnr Zhōngwén', es: 'sé hablar un poco de chino' }
      };
    }
  },

  /* ============================= preguntas ============================= */
  {
    id: 'pregunta-ma',
    titulo: '吗 — pregunta de sí o no',
    familia: 'Preguntas',
    nivel: 1,
    formula: 'frase afirmativa + 吗',
    patron: [{ w: '吗', clave: true }],
    explicar: function () {
      return {
        resumen: '吗 al final convierte la frase entera en una pregunta de sí o no.',
        detalle: 'No hay que cambiar nada más: ni el orden de las palabras, ni el verbo, ni la ' +
          'entonación. Se escribe la afirmación y se le pega 吗. 你是学生 «eres estudiante» → ' +
          '你是学生吗 «¿eres estudiante?».',
        contraste: 'El español invierte el orden y sube la entonación; el chino sólo añade una sílaba ' +
          'átona al final. Por eso una frase china se lee entera antes de saber si era pregunta.',
        ejemplo: { zh: '你是中国人吗？', py: 'nǐ shì Zhōngguó rén ma?', es: '¿eres chino?' }
      };
    }
  },
  {
    id: 'pregunta-a-no-a',
    titulo: 'Pregunta A-no-A',
    familia: 'Preguntas',
    nivel: 2,
    formula: 'verbo + 不/没 + verbo',
    patron: [
      { fn: function (tk) { return tk.esPredicativo || tk.esModal; }, nombre: 'v1' },
      { w: ['不', '没'], clave: true },
      { fn: function (tk) { return tk.esPredicativo || tk.esModal; }, nombre: 'v2' }
    ],
    explicar: function (m) {
      var a = t(cap(m, 'v1')), b = t(cap(m, 'v2'));
      if (a !== b && a.indexOf(b) !== 0 && b.indexOf(a) !== 0) return null;
      return {
        resumen: 'Pregunta hecha ofreciendo las dos opciones: «' + a + ' o no ' + b + '».',
        detalle: 'Es la alternativa a 吗 y suena algo más neutra y directa. Se repite el verbo con la ' +
          'negación en medio: 是不是, 有没有, 去不去. Con verbos de dos sílabas se puede abreviar la ' +
          'primera: 喜不喜欢. Nunca lleva 吗 al final: sería redundante.',
        contraste: 'El español no tiene nada parecido; lo más cercano sería «¿vienes o no?».',
        ejemplo: { zh: '你去不去？', py: 'nǐ qù bu qù?', es: '¿vas o no?' }
      };
    }
  },
  {
    id: 'interrogativo-in-situ',
    titulo: 'Interrogativos sin mover: 什么, 谁, 哪儿, 怎么',
    familia: 'Preguntas',
    nivel: 1,
    formula: 'la palabra interrogativa ocupa el lugar de la respuesta',
    patron: [{ clase: 'esInterrogativo', clave: true, nombre: 'q' }],
    explicar: function (m, ctx) {
      var q = cap(m, 'q')[0];
      // 几 y 多少 delante de clasificador son cantidad, no pregunta abierta.
      var sig = ctx.clausula[m.fin];
      return {
        resumen: '«' + q.texto + '» ocupa exactamente la posición que tendría la respuesta.',
        detalle: 'El chino no mueve la palabra interrogativa al principio de la frase. Donde iría el ' +
          'dato que falta, se pone el interrogativo y ya está: 你吃什么? «¿qué comes?» tiene el mismo ' +
          'orden que 我吃饭 «como arroz». Estas preguntas no llevan 吗.' +
          (sig && sig.esClasificador ? ' Aquí va seguido de clasificador, así que pregunta por una cantidad.' : ''),
        contraste: 'En español el interrogativo salta al principio («¿QUÉ comes?»); en chino se queda ' +
          'quieto. Esto facilita mucho la lectura: la estructura de la pregunta es idéntica a la de la respuesta.',
        ejemplo: { zh: '你住在哪儿？', py: 'nǐ zhù zài nǎr?', es: '¿dónde vives?' }
      };
    }
  },
  {
    id: 'particula-ba',
    titulo: '吧 — sugerencia o suposición',
    familia: 'Preguntas',
    nivel: 1,
    formula: '... + 吧',
    patron: [{ w: '吧', clave: true }],
    explicar: function () {
      return {
        resumen: '吧 suaviza: propone algo o da algo por supuesto esperando confirmación.',
        detalle: 'Dos usos. Con una propuesta: 我们走吧 «venga, vámonos». Con una afirmación: ' +
          '你是学生吧 «eres estudiante, ¿no?». Nunca es una pregunta abierta: el hablante ya tiene una idea.',
        contraste: 'Cubre lo que en español hacen «venga», «¿no?», «¿verdad?» y el imperativo en primera ' +
          'persona del plural («vámonos»).',
        ejemplo: { zh: '我们走吧', py: 'wǒmen zǒu ba', es: 'venga, vámonos' }
      };
    }
  },
  {
    id: 'particula-ne',
    titulo: '呢 — «¿y...?» y continuidad',
    familia: 'Preguntas',
    nivel: 1,
    formula: '... + 呢',
    patron: [{ w: '呢', clave: true }],
    explicar: function (m, ctx) {
      var antes = ctx.clausula.slice(Math.max(0, m.inicio - 3), m.inicio);
      var breve = antes.length <= 2 && antes.every(function (tk) { return esSN(tk); });
      return {
        resumen: breve ? '呢 devuelve la pregunta: «¿y ' + t(antes) + '?».'
                       : '呢 marca que la situación sigue en curso, o remata una pregunta abierta.',
        detalle: 'Con un sustantivo delante y nada más, 呢 rebota la pregunta anterior sin repetirla: ' +
          '我很好，你呢? «yo bien, ¿y tú?». Al final de una frase larga, subraya que algo está pasando ' +
          'ahora mismo (他在睡觉呢) o ablanda una pregunta con interrogativo.',
        contraste: 'El «¿y tú?» del español necesita entonación; el chino lo marca con esta partícula.',
        ejemplo: { zh: '我很好，你呢？', py: 'wǒ hěn hǎo, nǐ ne?', es: 'yo estoy bien, ¿y tú?' }
      };
    }
  },

  /* =========================== clasificadores =========================== */
  {
    id: 'clasificador',
    titulo: 'Numeral + clasificador + sustantivo',
    familia: 'Clasificadores',
    nivel: 1,
    formula: 'número / 这 / 那 + clasificador + sustantivo',
    patron: [
      { fn: function (tk) { return tk.esNumeral || ['这', '那', '哪', '每', '几'].indexOf(tk.texto) >= 0; }, nombre: 'det' },
      { clase: 'esClasificador', clave: true, nombre: 'cl' },
      { fn: esSN, opt: true, nombre: 'nombre' }
    ],
    explicar: function (m) {
      var cl = cap(m, 'cl')[0], nom = cap(m, 'nombre');
      var notas = {
        '个': 'el comodín: si no sabes cuál toca, casi siempre cuela.',
        '位': 'para personas, con respeto (clientes, profesores, invitados).',
        '本': 'para libros y cuadernos.',
        '张': 'para cosas planas: mesas, papeles, camas, entradas.',
        '条': 'para cosas largas y flexibles: ríos, calles, pantalones, peces, perros.',
        '只': 'para animales y para objetos que van en pareja.',
        '件': 'para prendas de ropa y para asuntos.',
        '辆': 'para vehículos con ruedas.',
        '杯': 'para lo que cabe en un vaso o taza.',
        '双': 'para pares: zapatos, calcetines, palillos.',
        '把': 'para lo que se coge con la mano: sillas, cuchillos, paraguas.',
        '块': 'para trozos, y para el dinero en lenguaje hablado.',
        '家': 'para negocios: tiendas, restaurantes, empresas.',
        '门': 'para asignaturas y cursos.',
        '首': 'para canciones y poemas.',
        '场': 'para eventos: partidos, películas, lluvias.'
      };
      return {
        resumen: 'En chino no se cuenta directamente: hace falta el clasificador «' + cl.texto + '» entre el número y el sustantivo.',
        detalle: 'Nunca se dice 三书: hay que decir 三本书. Cada sustantivo pide un clasificador concreto ' +
          'según su forma o su categoría, un poco como nuestros «dos VASOS de agua» o «tres HOJAS de papel», ' +
          'sólo que en chino es obligatorio con todos los sustantivos contables. ' +
          (notas[cl.texto] ? cl.texto + ': ' + notas[cl.texto] : '') +
          (nom.length ? ' Aquí acompaña a «' + t(nom) + '».' : ' El sustantivo se ha omitido porque se sobreentiende.'),
        contraste: 'También son obligatorios detrás de 这 («este») y 那 («ese»): 这本书, no 这书.',
        ejemplo: { zh: '三本书', py: 'sān běn shū', es: 'tres libros' }
      };
    }
  },
  {
    id: 'dos-liang',
    titulo: '二 frente a 两 — dos maneras de decir «dos»',
    familia: 'Clasificadores',
    nivel: 1,
    formula: '两 + clasificador   /   二 en cifras y ordinales',
    patron: [
      { w: ['两', '二'], clave: true, nombre: 'num' },
      { clase: 'esClasificador', opt: true, nombre: 'cl' }
    ],
    explicar: function (m) {
      var num = t(cap(m, 'num')), cl = cap(m, 'cl');
      if (num === '二' && cl.length) {
        return {
          resumen: 'Delante de un clasificador lo normal es 两, no 二.',
          detalle: 'Para contar cosas se usa 两 (两个人 «dos personas»). 二 queda para los números ' +
            'leídos, las fechas, los ordinales y las cifras compuestas (十二, 第二).',
          contraste: 'El español tiene un solo «dos»; el chino reparte según se cuente o se enumere.',
          ejemplo: { zh: '两个人', py: 'liǎng ge rén', es: 'dos personas' }
        };
      }
      if (num !== '两') return null;
      return {
        resumen: '两 es el «dos» que se usa para contar cosas.',
        detalle: '两 va siempre con clasificador' + (cl.length ? ' (aquí «' + t(cl) + '»)' : '') +
          '. Para leer números, fechas y ordinales se usa 二: 二月 «febrero», 第二 «el segundo».',
        contraste: 'Conviene fijarlo pronto porque se usa constantemente y suena mal al revés.',
        ejemplo: { zh: '两点', py: 'liǎng diǎn', es: 'las dos (en punto)' }
      };
    }
  },

  /* ============================ complementos ============================ */
  {
    id: 'resultativo',
    titulo: 'Complemento de resultado: verbo + resultado',
    familia: 'Complementos',
    nivel: 2,
    formula: 'verbo + 完/好/到/见/懂/错 ...',
    patron: [
      { clase: 'esVerbo', nombre: 'verbo' },
      { clase: 'esResultativo', clave: true, nombre: 'res' }
    ],
    explicar: function (m, ctx) {
      var v = cap(m, 'verbo')[0], r = cap(m, 'res')[0];
      if (v.texto === r.texto) return null;
      var notas = {
        '完': 'terminar del todo', '好': 'quedar bien hecho', '到': 'llegar a conseguirlo',
        '见': 'percibir (ver, oír)', '懂': 'llegar a entender', '错': 'hacerlo mal',
        '住': 'que quede fijado', '成': 'convertirlo en', '掉': 'que desaparezca',
        '清楚': 'con claridad', '干净': 'dejarlo limpio', '明白': 'quedar claro', '满': 'hasta llenarlo'
      };
      return {
        resumen: '«' + v.texto + r.texto + '»: el verbo dice la acción y «' + r.texto + '» dice cómo acabó (' +
          (notas[r.texto] || 'el resultado') + ').',
        detalle: 'El chino separa la acción de su resultado y los pega en ese orden. 看 es «mirar», ' +
          'pero «entender leyendo» es 看懂; 找 es «buscar», y «encontrar» es 找到. Sin el segundo elemento ' +
          'la acción puede no haber llegado a nada: 我找了 es «busqué», 我找到了 es «lo encontré».',
        contraste: 'El español mete el resultado dentro del propio verbo («buscar» / «encontrar»), así ' +
          'que son verbos distintos. En chino es una pieza añadida, y eso permite negar sólo el resultado.',
        ejemplo: { zh: '我看懂了', py: 'wǒ kàndǒng le', es: 'lo he entendido (leyéndolo)' }
      };
    }
  },
  {
    id: 'direccional',
    titulo: 'Complemento direccional: verbo + 来/去/上/下...',
    familia: 'Complementos',
    nivel: 2,
    formula: 'verbo (+ dirección) + 来/去',
    patron: [
      { clase: 'esVerbo', nombre: 'verbo' },
      { clase: 'esDireccional', clave: true, nombre: 'dir' }
    ],
    explicar: function (m) {
      var v = cap(m, 'verbo')[0], d = cap(m, 'dir')[0];
      if (v.texto === d.texto) return null;
      return {
        resumen: '«' + d.texto + '» detrás del verbo indica hacia dónde va el movimiento.',
        detalle: '来 es hacia el hablante y 去 alejándose de él; 上/下/进/出/回/过 dan la dirección ' +
          '(subir, bajar, entrar, salir, volver, cruzar) y se pueden combinar con 来/去: 走进来 ' +
          '«entrar andando hacia aquí». La diferencia entre 来 y 去 depende de dónde esté quien habla.',
        contraste: 'El español lo resuelve con verbos distintos («venir» / «ir», «entrar» / «salir»); ' +
          'el chino usa un verbo general de manera más un remate de dirección.',
        ejemplo: { zh: '他走进来了', py: 'tā zǒu jìnlái le', es: 'entró andando' }
      };
    }
  },
  {
    id: 'duracion',
    titulo: 'Complemento de duración y de frecuencia',
    familia: 'Complementos',
    nivel: 2,
    formula: 'verbo + cantidad de tiempo / número de veces',
    patron: [
      { clase: 'esVerbo', nombre: 'verbo' },
      { w: '了', opt: true },
      { clase: 'esNumeral', nombre: 'num' },
      { fn: function (tk) { return tk.esClasificador || /^(年|天|小时|分钟|个月|星期|次|遍|下)$/.test(tk.texto); }, clave: true, nombre: 'unidad' }
    ],
    explicar: function (m) {
      return {
        resumen: 'Cuánto dura o cuántas veces: «' + t(cap(m, 'num')) + t(cap(m, 'unidad')) + '» va DETRÁS del verbo.',
        detalle: 'El tiempo que dura una acción y el número de veces que se repite van siempre después ' +
          'del verbo, no antes. Ojo con no confundirlo con el «cuándo» (今天, 三点), que va antes. ' +
          'Si además hay objeto, el verbo se repite: 我学中文学了三年.',
        contraste: 'En español el orden es más libre («estudié tres años» / «tres años estudié»). En ' +
          'chino la posición es la que distingue «cuándo» de «cuánto tiempo».',
        ejemplo: { zh: '我学了三年中文', py: 'wǒ xué le sān nián Zhōngwén', es: 'estudié chino tres años' }
      };
    }
  },

  /* ======================= adverbios de alcance ======================= */
  {
    id: 'dou',
    titulo: '都 — «todos», y siempre delante del verbo',
    familia: 'Adverbios de alcance',
    nivel: 1,
    formula: 'sujeto plural + 都 + verbo',
    patron: [{ w: '都', clave: true }],
    explicar: function (m, ctx) {
      var antes = ctx.clausula.slice(0, m.inicio);
      return {
        resumen: '都 recoge lo que se ha dicho antes: «' + (t(antes) || 'todo eso') + '», todo ello.',
        detalle: '都 nunca va delante de lo que cuantifica: va delante del VERBO y mira hacia atrás. ' +
          'Por eso 我们都是学生 es «todos nosotros somos estudiantes». Si el grupo va detrás de 都, ' +
          'la frase no funciona. También aparece obligatoriamente con 每 («cada») y con 连...都.',
        contraste: 'El español pone «todos» junto al sustantivo; el chino lo separa y lo deja pegado al verbo. ' +
          'Es un cambio de posición que cuesta automatizar.',
        ejemplo: { zh: '他们都来了', py: 'tāmen dōu lái le', es: 'han venido todos' }
      };
    }
  },
  {
    id: 'jiu-cai',
    titulo: '就 frente a 才 — pronto y tarde',
    familia: 'Adverbios de alcance',
    nivel: 2,
    formula: '就 = antes de lo esperado / 才 = después de lo esperado',
    patron: [{ w: ['就', '才'], clave: true, nombre: 'adv' }],
    explicar: function (m) {
      var esJiu = t(cap(m, 'adv')) === '就';
      return {
        resumen: esJiu ? '就: antes o más fácil de lo esperado; también «entonces».'
                       : '才: más tarde, con más esfuerzo o menos de lo esperado.',
        detalle: 'Son la pareja que mide las expectativas del hablante. 他六点就来了 «llegó ya a las seis» ' +
          '(pronto); 他六点才来 «no llegó hasta las seis» (tarde). Con la misma hora, el juicio es opuesto. ' +
          '就 aparece además en la segunda parte de las condicionales (如果...就) con el valor de «entonces».',
        contraste: 'El español lo dice con «ya», «sólo», «no... hasta»; el chino con una sola sílaba ' +
          'delante del verbo. Es de lo que más cambia el tono de una frase.',
        ejemplo: esJiu
          ? { zh: '他六点就来了', py: 'tā liù diǎn jiù lái le', es: 'llegó ya a las seis' }
          : { zh: '他六点才来', py: 'tā liù diǎn cái lái', es: 'no llegó hasta las seis' }
      };
    }
  },
  {
    id: 'ye-hai',
    titulo: '也 / 还 / 又 / 再 — «también» y «otra vez»',
    familia: 'Adverbios de alcance',
    nivel: 2,
    formula: 'adverbio + verbo',
    patron: [{ w: ['也', '还', '又', '再'], clave: true, nombre: 'adv' }],
    explicar: function (m) {
      var a = t(cap(m, 'adv'));
      var notas = {
        '也': '«también». Va delante del verbo, nunca al final: 我也去, no 我去也.',
        '还': '«todavía» o «además». Marca que algo sigue o que se añade una cosa más.',
        '又': '«otra vez», pero para algo que YA ha vuelto a ocurrir.',
        '再': '«otra vez», pero para algo que aún no ha ocurrido: la repetición futura.'
      };
      return {
        resumen: a + ': ' + notas[a],
        detalle: '又 y 再 se traducen los dos por «otra vez» y se confunden constantemente. La clave es ' +
          'el tiempo: 又 mira al pasado (他又迟到了 «ha vuelto a llegar tarde»), 再 mira al futuro ' +
          '(再说一遍 «dilo otra vez»). Todos ellos van delante del verbo.',
        contraste: 'En español «también» y «otra vez» se mueven con libertad por la frase; en chino ' +
          'están clavados justo antes del verbo.',
        ejemplo: { zh: '我也是学生', py: 'wǒ yě shì xuéshēng', es: 'yo también soy estudiante' }
      };
    }
  },

  /* ======================== conectores correlativos ==================== */
  {
    id: 'correlativos',
    titulo: 'Conectores en pareja: 因为...所以, 虽然...但是, 如果...就',
    familia: 'Conectores',
    nivel: 2,
    formula: 'conector 1 + oración, conector 2 + oración',
    ambito: 'oracion',
    patron: [
      { w: ['因为', '虽然', '尽管', '如果', '要是', '不但', '不仅', '只要', '只有', '既然', '无论', '不管', '即使', '除非'], clave: true, nombre: 'a' },
      // El segundo conector está en la otra cláusula, así que hay que dejar
      // pasar la coma que las separa.
      { fn: function (tk) { return tk.tipo !== 'espacio'; }, rep: [1, 20], nombre: 'primera', perezoso: true },
      { w: ['所以', '但是', '可是', '不过', '就', '才', '而且', '并且', '都', '也', '还', '因此', '于是'], clave: true, nombre: 'b' }
    ],
    explicar: function (m) {
      var a = t(cap(m, 'a')), b = t(cap(m, 'b'));
      var parejas = {
        '因为': 'causa → consecuencia: «como... entonces...»',
        '虽然': 'concesión: «aunque..., sin embargo...»',
        '尽管': 'concesión: «a pesar de que..., aun así...»',
        '如果': 'condición: «si..., entonces...»',
        '要是': 'condición coloquial: «si..., pues...»',
        '不但': 'adición: «no sólo..., sino que además...»',
        '不仅': 'adición: «no sólo..., sino que además...»',
        '只要': 'condición suficiente: «con tal de que..., ya...»',
        '只有': 'condición necesaria: «sólo si..., entonces sí...»',
        '既然': 'premisa aceptada: «ya que..., pues...»',
        '无论': 'indiferencia: «sea cual sea..., igualmente...»',
        '不管': 'indiferencia: «pase lo que pase..., igualmente...»',
        '即使': 'concesión hipotética: «aunque fuera..., aun así...»',
        '除非': 'excepción: «a menos que..., si no...»'
      };
      return {
        resumen: a + ' ... ' + b + ' — ' + (parejas[a] || 'conectores correlativos'),
        detalle: 'El chino usa los conectores por parejas: uno abre la primera oración y otro abre la ' +
          'segunda. Lo importante es que el segundo NO es opcional como en español; de hecho, muchas veces ' +
          'se omite el primero y se deja sólo el segundo: 他很累，所以没来.',
        contraste: 'En español decir «aunque llueve, pero voy» es incorrecto. En chino 虽然...但是 es ' +
          'justamente lo normal. Es el calco que más chirría al traducir literalmente.',
        ejemplo: { zh: '虽然很贵，但是我买了', py: 'suīrán hěn guì, dànshì wǒ mǎi le', es: 'aunque era caro, lo compré' }
      };
    }
  },
  {
    id: 'yi-jiu',
    titulo: '一 ... 就 ... — «en cuanto..., ...»',
    familia: 'Conectores',
    nivel: 3,
    formula: '一 + acción 1 + 就 + acción 2',
    ambito: 'oracion',
    patron: [
      { w: '一', clave: true },
      { clase: 'esPredicativo', rep: [1, 3], nombre: 'a' },
      { fn: function (tk) { return tk.tipo !== 'espacio' && tk.texto !== '就'; },
        rep: [0, 6], perezoso: true },
      { w: '就', clave: true },
      { fn: esCuerpo, rep: [1, 5], nombre: 'b' }
    ],
    explicar: function (m) {
      return {
        resumen: 'En cuanto «' + t(cap(m, 'a')) + '», inmediatamente «' + t(cap(m, 'b')) + '».',
        detalle: 'Aquí 一 no es «uno»: forma pareja con 就 para encadenar dos hechos sin pausa. ' +
          'También expresa una reacción automática: 他一喝酒就脸红 «en cuanto bebe, se le pone la cara roja».',
        contraste: 'Equivale a «en cuanto», «nada más + infinitivo». La diferencia es que el chino ' +
          'necesita las dos marcas, una en cada mitad.',
        ejemplo: { zh: '我一到家就给你打电话', py: 'wǒ yí dào jiā jiù gěi nǐ dǎ diànhuà', es: 'en cuanto llegue a casa te llamo' }
      };
    }
  },

  /* ============================== coverbos ============================== */
  {
    id: 'coverbo',
    titulo: 'Coverbos: la «preposición» va antes del verbo',
    familia: 'Coverbos',
    nivel: 2,
    formula: 'sujeto + coverbo + complemento + VERBO',
    patron: [
      { w: ['给', '对', '跟', '和', '用', '从', '往', '向', '朝', '为', '为了', '按照', '根据', '离', '替', '比照'], clave: true, nombre: 'cv' },
      { fn: esCuerpo, rep: [1, 4], nombre: 'compl', perezoso: true },
      { clase: 'esPredicativo', nombre: 'verbo' }
    ],
    explicar: function (m) {
      var cv = t(cap(m, 'cv'));
      var notas = {
        '给': 'a, para (destinatario)', '对': 'a, hacia, con respecto a', '跟': 'con',
        '和': 'con', '用': 'con (instrumento)', '从': 'desde', '往': 'hacia', '向': 'hacia',
        '朝': 'hacia', '为': 'por, para', '为了': 'para (finalidad)', '按照': 'según',
        '根据': 'según', '离': 'de (distancia respecto a)', '替': 'en lugar de, para'
      };
      return {
        resumen: cv + ' («' + (notas[cv] || '...') + '») introduce «' + t(cap(m, 'compl')) +
          '» ANTES del verbo «' + t(cap(m, 'verbo')) + '».',
        detalle: 'Estas palabras funcionan como preposiciones, pero el grupo entero va delante del verbo ' +
          'principal, no detrás. El orden es sujeto + [coverbo + complemento] + verbo: 我给你打电话 ' +
          'literalmente «yo a-ti hago llamada». Se llaman coverbos porque históricamente eran verbos.',
        contraste: 'Aquí está una de las mayores diferencias de orden con el español, que coloca estos ' +
          'complementos DETRÁS del verbo («te llamo A TI»). En chino todo lo circunstancial se acumula ' +
          'antes del verbo, y el verbo queda casi al final.',
        ejemplo: { zh: '我给你打电话', py: 'wǒ gěi nǐ dǎ diànhuà', es: 'te llamo por teléfono' }
      };
    }
  },

  /* ============================= morfología ============================= */
  {
    id: 'reduplicacion-verbal',
    titulo: 'Verbo repetido — «un poco», «a ver»',
    familia: 'Morfología',
    nivel: 2,
    formula: 'V V   /   V 一 V   /   V 了 V',
    // El diccionario trae algunas reduplicaciones como una sola palabra (看看) y
    // otras llegan en tokens sueltos (想 一 想), así que hacen falta dos patrones.
    patrones: [
      [{ fn: function (tk) {
           return tk.tipo === 'hanzi' && tk.texto.length === 2 &&
                  tk.texto[0] === tk.texto[1] && tk.esPredicativo;
         }, clave: true, nombre: 'unico' }],
      [{ clase: 'esPredicativo', nombre: 'v1' },
       { w: ['一', '了'], opt: true },
       { clase: 'esPredicativo', nombre: 'v2' }]
    ],
    explicar: function (m) {
      var unico = cap(m, 'unico')[0];
      var a = unico || cap(m, 'v1')[0];
      var b = unico || cap(m, 'v2')[0];
      if (!a || !b) return null;
      if (!unico && a.texto !== b.texto) return null;
      if (unico) a = { texto: unico.texto[0], es: '', en: '', tipo: 'hanzi', py: '' };
      var base = window.Lexico.buscar(a.texto);
      if (base) { a.es = base.es; a.en = base.en; }
      return {
        resumen: 'Repetir «' + a.texto + '» le quita peso: «' + (g([a]) || a.texto) + ' un poco, a ver qué tal».',
        detalle: 'Es un recurso muy frecuente y muy cortés. Convierte la acción en algo breve, tentativo ' +
          'y sin compromiso: 看看 «echar un vistazo», 想想 «pensarlo un momento», 试试 «probar a ver». ' +
          'La segunda sílaba se pronuncia átona.',
        contraste: 'El español lo consigue con diminutivos y adverbios («échale un vistazo», «piénsalo ' +
          'un momento»). El chino sólo repite la palabra.',
        ejemplo: { zh: '你看看', py: 'nǐ kànkan', es: 'échale un vistazo' }
      };
    }
  },
  {
    id: 'sufijo-men',
    titulo: '们 — plural sólo para personas',
    familia: 'Morfología',
    nivel: 1,
    formula: 'persona + 们',
    // 同学们 viene del diccionario como una sola palabra; 学生 们 puede llegar
    // en dos. Se contemplan los dos casos.
    patrones: [
      [{ fn: function (tk) {
           return tk.tipo === 'hanzi' && tk.texto.length > 1 &&
                  tk.texto.slice(-1) === '们';
         }, clave: true, nombre: 'entera' }],
      [{ fn: function (tk) { return tk.esNombre || tk.esPronombre; }, nombre: 'base' },
       { w: '们', clave: true }]
    ],
    explicar: function (m) {
      var entera = cap(m, 'entera')[0];
      var base = entera ? entera.texto.slice(0, -1) : t(cap(m, 'base'));
      if (!base) return null;
      return {
        resumen: '们 hace plural «' + base + '», y sólo funciona con personas.',
        detalle: 'El chino no marca el plural: 书 es «libro» y «libros». 们 es la única excepción y se ' +
          'limita a pronombres y a personas (我们, 学生们). Además no se puede usar si ya hay un número ' +
          'delante: 三个学生, nunca 三个学生们.',
        contraste: 'En español todo concuerda en número; en chino la cantidad se deduce del contexto o ' +
          'se dice con un numeral. Al leer, no des por hecho el singular.',
        ejemplo: { zh: '同学们好', py: 'tóngxuémen hǎo', es: 'hola a todos, compañeros' }
      };
    }
  },
  {
    id: 'hen-adjetivo',
    titulo: '很 + adjetivo — el adjetivo ya es el verbo',
    familia: 'Cópula y existencia',
    nivel: 1,
    formula: 'sujeto + 很 + adjetivo   (sin «ser»)',
    patron: [
      { w: ['很', '非常', '太', '真', '挺', '特别', '十分', '比较'], clave: true, nombre: 'grado' },
      { clase: 'esAdjetivo', nombre: 'adj' }
    ],
    explicar: function (m) {
      var grado = t(cap(m, 'grado'));
      return {
        resumen: grado + ' + «' + t(cap(m, 'adj')) + '»: aquí el adjetivo funciona como verbo, sin 是.',
        detalle: 'En chino un adjetivo ya contiene el «ser»: 他高 es «él es alto». Lo que pasa es que un ' +
          'adjetivo desnudo suena a comparación implícita, así que se le pone 很 delante como relleno. ' +
          'Por eso 很 muchas veces NO significa «muy»: es sólo el soporte normal del adjetivo. Para ' +
          '«muy» de verdad se usa 非常, 特别 o 太...了.',
        contraste: 'Traducir 我很好 por «estoy MUY bien» exagera: es simplemente «estoy bien». Y decir ' +
          '我是好 es agramatical: 是 nunca acompaña a un adjetivo.',
        ejemplo: { zh: '我很好', py: 'wǒ hěn hǎo', es: 'estoy bien' }
      };
    }
  },
  {
    id: 'youdianr',
    titulo: '有点儿 frente a 一点儿',
    familia: 'Morfología',
    nivel: 2,
    formula: '有点儿 + adjetivo (antes)  /  adjetivo + 一点儿 (después)',
    patron: [
      { w: ['有点儿', '有点', '一点儿', '一点'], clave: true, nombre: 'marca' }
    ],
    explicar: function (m, ctx) {
      var marca = t(cap(m, 'marca'));
      var esYou = marca.indexOf('有') === 0;
      var sig = ctx.clausula[m.fin];
      if (!esYou && (!sig || !sig.esAdjetivo) && !(ctx.clausula[m.inicio - 1] && ctx.clausula[m.inicio - 1].esAdjetivo)) {
        return null;
      }
      return {
        resumen: esYou ? '有点儿 va DELANTE del adjetivo y suele implicar queja.'
                       : '一点儿 va DETRÁS del adjetivo y es neutro.',
        detalle: 'Los dos significan «un poco», pero ni ocupan la misma posición ni tienen el mismo tono. ' +
          '有点儿贵 = «es un poco caro» (y no me gusta). 便宜一点儿 = «un poco más barato» (petición neutra). ' +
          '有点儿 siempre precede y casi siempre valora algo negativamente.',
        contraste: 'En español «un poco» sirve para los dos; en chino elegir mal cambia el tono de la frase.',
        ejemplo: { zh: '有点儿贵，便宜一点儿吧', py: 'yǒudiǎnr guì, piányi yìdiǎnr ba', es: 'es un poco caro, ¿me lo dejas algo más barato?' }
      };
    }
  }

  );
})();
