/* Pinyin: elegir la lectura correcta y avisar de los cambios de tono.
 *
 * Dos problemas que el diccionario por sí solo no resuelve:
 *   1. Caracteres polifónicos: 还 es «hái» (todavía) o «huán» (devolver); 得 es
 *      «de», «dé» o «děi» según la función que cumpla en la frase.
 *   2. Sandhi: el tono que se escribe no siempre es el que se pronuncia
 *      (不 bù -> bú, 一 yī -> yì/yí, y la regla de dos terceros tonos seguidos).
 *
 * Aquí se resuelve lo primero mirando la etiqueta gramatical del token, y lo
 * segundo se anota aparte para poder enseñárselo al usuario sin falsear el
 * pinyin escrito. */
window.Pinyin = (function () {
  'use strict';

  /* Lecturas según la función. La clave 'defecto' se usa si nada encaja.
   * 'pos' compara con la etiqueta del token; 'antes'/'despues' con la palabra
   * vecina; 'solo' exige que el token sea la palabra entera. */
  var POLIFONICOS = {
    '得': { defecto: 'de', reglas: [
      { pos: ['v'], py: 'dé', nota: 'obtener' },
      { funcion: 'modal', py: 'děi', nota: 'tener que' }
    ]},
    '着': { defecto: 'zhe', reglas: [
      { funcion: 'aspecto', py: 'zhe', nota: 'acción en curso' }
    ]},
    '还': { defecto: 'hái', reglas: [
      { pos: ['v'], py: 'huán', nota: 'devolver' }
    ]},
    '行': { defecto: 'xíng', reglas: [
      { despues: ['业'], py: 'háng' },
      { antes: ['银', '同', '一'], py: 'háng' }
    ]},
    '为': { defecto: 'wèi', reglas: [
      { pos: ['v'], py: 'wéi', nota: 'ser, hacer de' }
    ]},
    '只': { defecto: 'zhǐ', reglas: [
      { funcion: 'clasificador', py: 'zhī' }
    ]},
    '长': { defecto: 'cháng', reglas: [
      { pos: ['v'], py: 'zhǎng', nota: 'crecer' }
    ]},
    '了': { defecto: 'le', reglas: [
      { pos: ['v'], py: 'liǎo', nota: 'resolver, poder' }
    ]},
    '地': { defecto: 'de', reglas: [
      { pos: ['n', 'ns'], py: 'dì', nota: 'tierra, lugar' }
    ]},
    '的': { defecto: 'de', reglas: [] },
    '会': { defecto: 'huì', reglas: [] },
    '教': { defecto: 'jiāo', reglas: [{ pos: ['n', 'vn'], py: 'jiào' }] },
    '种': { defecto: 'zhǒng', reglas: [{ pos: ['v'], py: 'zhòng', nota: 'plantar' }] },
    '中': { defecto: 'zhōng', reglas: [{ pos: ['v'], py: 'zhòng', nota: 'acertar' }] },
    '重': { defecto: 'zhòng', reglas: [{ pos: ['d'], py: 'chóng', nota: 'de nuevo' }] },
    '好': { defecto: 'hǎo', reglas: [{ pos: ['v'], py: 'hào', nota: 'aficionarse a' }] },
    '都': { defecto: 'dōu', reglas: [{ pos: ['n', 'ns'], py: 'dū', nota: 'capital' }] },
    '少': { defecto: 'shǎo', reglas: [{ pos: ['a'], py: 'shào', nota: 'joven' }] },
    '干': { defecto: 'gàn', reglas: [{ pos: ['a'], py: 'gān', nota: 'seco' }] },
    '觉': { defecto: 'jué', reglas: [{ pos: ['n'], py: 'jiào', nota: 'sueño' }] },
    '乐': { defecto: 'lè', reglas: [{ pos: ['n'], py: 'yuè', nota: 'música' }] },
    '数': { defecto: 'shù', reglas: [{ pos: ['v'], py: 'shǔ', nota: 'contar' }] },
    '量': { defecto: 'liàng', reglas: [{ pos: ['v'], py: 'liáng', nota: 'medir' }] },
    '空': { defecto: 'kōng', reglas: [{ pos: ['n'], py: 'kòng', nota: 'hueco libre' }] },
    '发': { defecto: 'fā', reglas: [{ pos: ['n'], py: 'fà', nota: 'pelo' }] },
    '假': { defecto: 'jiǎ', reglas: [{ pos: ['n'], py: 'jià', nota: 'vacaciones' }] },
    '应': { defecto: 'yīng', reglas: [{ pos: ['v'], py: 'yìng', nota: 'responder' }] },
    '传': { defecto: 'chuán', reglas: [{ pos: ['n'], py: 'zhuàn', nota: 'biografía' }] },
    '调': { defecto: 'tiáo', reglas: [{ pos: ['n'], py: 'diào', nota: 'tono' }] },
    '转': { defecto: 'zhuǎn', reglas: [] },
    '兴': { defecto: 'xìng', reglas: [{ pos: ['v'], py: 'xīng', nota: 'prosperar' }] },
    '差': { defecto: 'chà', reglas: [{ pos: ['n'], py: 'chā', nota: 'diferencia' }] },
    '当': { defecto: 'dāng', reglas: [] },
    '分': { defecto: 'fēn', reglas: [{ funcion: 'clasificador', py: 'fèn' }] },
    '处': { defecto: 'chù', reglas: [{ pos: ['v'], py: 'chǔ', nota: 'tratar, convivir' }] },
    '相': { defecto: 'xiāng', reglas: [{ pos: ['n'], py: 'xiàng', nota: 'aspecto' }] },
    '便': { defecto: 'biàn', reglas: [] },
    '血': { defecto: 'xuè', reglas: [] },
    '率': { defecto: 'lǜ', reglas: [{ pos: ['v'], py: 'shuài', nota: 'encabezar' }] },
    '落': { defecto: 'luò', reglas: [] },
    '尽': { defecto: 'jìn', reglas: [] },
    '强': { defecto: 'qiáng', reglas: [] },
    '参': { defecto: 'cān', reglas: [] }
  };

  /* Caracteres cuya lectura en chino moderno es prácticamente única pero que
   * el diccionario ordena mal, porque lista primero una lectura rara o clásica.
   * Se corrigen de un plumazo, sin depender del contexto. */
  var LECTURA_FIJA = {
    '吗': 'ma', '吧': 'ba', '啊': 'a', '啦': 'la', '呀': 'ya', '嘛': 'ma',
    '呗': 'bei', '哦': 'ò', '嗯': 'èn', '呢': 'ne', '么': 'me',
    '上': 'shàng', '看': 'kàn', '说': 'shuō', '那': 'nà', '儿': 'ér',
    '更': 'gèng', '和': 'hé', '给': 'gěi', '叫': 'jiào', '让': 'ràng',
    '大': 'dà', '子': 'zi', '些': 'xiē', '过': 'guò', '把': 'bǎ'
  };

  var TONO_DE_VOCAL = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
  };
  var CAMBIO_TONO = {
    'bù': { 4: 'bú' },            // 不 pasa a segundo tono ante cuarto tono
    'yī': { 1: 'yì', 2: 'yì', 3: 'yì', 4: 'yí' }
  };

  /** Tono de una sílaba escrita con tildes. 0 = neutro. */
  function tonoDe(silaba) {
    for (var i = 0; i < silaba.length; i++) {
      var t = TONO_DE_VOCAL[silaba[i]];
      if (t) return t;
    }
    return 0;
  }

  function silabas(py) { return py ? py.split(/\s+/).filter(Boolean) : []; }

  /* El 儿 de la erhua no es una sílaba aparte: 一点儿 se dice «yìdiǎnr», no
   * «yì diǎn er». Se pega a la sílaba anterior. */
  function unirErhua(py) {
    if (!py || py.indexOf(' ') < 0) return py;
    var ss = py.split(' ');
    var fuera = [];
    for (var i = 0; i < ss.length; i++) {
      if (i > 0 && /^(er|ér|ēr|ěr|èr|r)$/.test(ss[i]) && fuera.length) {
        fuera[fuera.length - 1] += 'r';
      } else fuera.push(ss[i]);
    }
    return fuera.join(' ');
  }

  /** Elige la lectura de un token entre las que ofrece el diccionario. */
  function elegirLectura(token, anterior, siguiente) {
    var bruto = token.py || '';
    var opciones = bruto.split(' / ').map(function (s) { return s.trim(); }).filter(Boolean);
    var elegida = opciones[0] || '';
    var nota = '';

    if (token.texto.length === 1) {
      if (LECTURA_FIJA[token.texto] && !POLIFONICOS[token.texto]) {
        return { py: LECTURA_FIJA[token.texto], nota: '' };
      }
      var tabla = POLIFONICOS[token.texto];
      if (tabla) {
        elegida = tabla.defecto;
        for (var i = 0; i < tabla.reglas.length; i++) {
          var r = tabla.reglas[i];
          var encaja = true;
          if (r.pos && r.pos.indexOf(token.pos) < 0) encaja = false;
          if (r.funcion && token.funcion !== r.funcion) encaja = false;
          if (r.antes && (!anterior || r.antes.indexOf(anterior.texto) < 0)) encaja = false;
          if (r.despues && (!siguiente || r.despues.indexOf(siguiente.texto) < 0)) encaja = false;
          if (encaja) { elegida = r.py; nota = r.nota || ''; break; }
        }
        if (opciones.length > 1 && !nota) {
          nota = 'otras lecturas: ' + opciones.filter(function (o) { return o !== elegida; }).join(', ');
        }
      } else if (!elegida) {
        elegida = window.Lexico.pinyinDeCaracter(token.texto);
      } else if (opciones.length > 1) {
        nota = 'otras lecturas: ' + opciones.slice(1).join(', ');
      }
    } else if (opciones.length > 1) {
      nota = 'otras lecturas: ' + opciones.slice(1).join(', ');
    }

    elegida = unirErhua(elegida);
    if (!elegida && token.texto.length > 1) {
      // Palabra desconocida: se compone carácter a carácter.
      var partes = [];
      for (var j = 0; j < token.texto.length; j++) {
        partes.push(window.Lexico.pinyinDeCaracter(token.texto[j]) || '?');
      }
      elegida = partes.join(' ');
      nota = 'pinyin aproximado, compuesto carácter a carácter';
    }
    return { py: elegida, nota: nota };
  }

  /* Cambios de tono. El pinyin escrito no se toca: se devuelve aparte cómo se
   * pronuncia de verdad, que es justo lo que nadie te explica al principio. */
  function calcularSandhi(tokens) {
    var avisos = [];
    var plano = [];            // {tk, idx, silaba}
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.tipo !== 'hanzi') continue;
      var ss = silabas(t.py);
      for (var j = 0; j < ss.length; j++) plano.push({ tk: t, idx: j, silaba: ss[j] });
    }
    for (var k = 0; k < plano.length; k++) {
      var act = plano[k], sig = plano[k + 1];
      if (!sig) continue;
      var base = act.silaba.replace(/[0-9]/g, '');
      var tabla = CAMBIO_TONO[base];
      if (tabla) {
        var nuevo = tabla[tonoDe(sig.silaba)];
        if (nuevo) {
          avisos.push({
            token: act.tk, silaba: act.idx, escrito: act.silaba, dicho: nuevo,
            motivo: base === 'bù'
              ? '不 se pronuncia «bú» (segundo tono) cuando le sigue una sílaba de cuarto tono.'
              : '一 se pronuncia «yí» ante cuarto tono y «yì» ante los demás.'
          });
        }
      } else if (tonoDe(act.silaba) === 3 && tonoDe(sig.silaba) === 3) {
        avisos.push({
          token: act.tk, silaba: act.idx, escrito: act.silaba,
          dicho: act.silaba.replace(/[ǎěǐǒǔǚ]/, function (c) {
            return 'áéíóúǘ'['ǎěǐǒǔǚ'.indexOf(c)];
          }),
          motivo: 'Dos terceros tonos seguidos: el primero se pronuncia como segundo tono. Se escribe igual, pero no suena igual.'
        });
      }
    }
    return avisos;
  }

  /** Pinyin de una cadena de tokens, separado por espacios. */
  function deTokens(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.tipo === 'hanzi') out.push(t.py);
      else if (t.tipo !== 'espacio') out.push(t.texto);
    }
    return out.join(' ').replace(/\s+([,.;:!?])/g, '$1');
  }

  return {
    elegirLectura: elegirLectura,
    unirErhua: unirErhua,
    calcularSandhi: calcularSandhi,
    deTokens: deTokens,
    tonoDe: tonoDe,
    silabas: silabas
  };
})();
