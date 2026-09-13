/* Categorías gramaticales y clases de palabras.
 *
 * Las etiquetas que trae el diccionario (n, v, a, d, p, u...) vienen de un
 * corpus automático y a veces fallan justo en las palabras que más importan:
 * 很 aparece como «zg», 行 como «zg». Como toda la gramática se apoya en estas
 * etiquetas, las palabras funcionales llevan aquí una etiqueta escrita a mano
 * que sobrescribe a la del diccionario.
 *
 * Además se guardan los inventarios cerrados (clasificadores, modales,
 * direccionales, resultativos, localizadores...) que las reglas consultan. */
window.Etiquetas = (function () {
  'use strict';

  function conjunto(lista) {
    var s = new Set();
    lista.forEach(function (x) { s.add(x); });
    return s;
  }

  /* --- inventarios cerrados ------------------------------------------- */

  var CLASIFICADORES = conjunto(('个 位 只 条 张 本 件 辆 双 些 点 种 次 遍 下 杯 碗 块 层 段 句 封 家 座 台 套 ' +
    '份 名 群 篇 棵 朵 顿 趟 场 首 支 根 片 幅 面 把 门 队 批 串 堆 副 届 卷 类 例 列 轮 排 派 匹 起 束 艘 摊 ' +
    '堂 头 团 味 项 样 页 阵 枝 株 桩 宗 组 盒 瓶 袋 箱 包 打 对 帮 伙 具 间 卷 颗 辈 步 笔 点儿 声').split(' '));

  var MODALES = conjunto('会 能 可以 要 想 愿意 应该 该 必须 得 敢 肯 可能 能够 得以 想要 可 须'.split(' '));

  var COVERBOS = conjunto(('在 从 到 向 往 朝 对 对于 关于 给 为 为了 由 由于 用 拿 按 按照 根据 通过 ' +
    '离 跟 和 与 同 沿着 随着 除了 比 就 自 自从 至 于 冲 替 论 依 依照 凭 靠 趁 经过 针对').split(' '));

  var ADVERBIOS = conjunto(('很 太 非常 都 也 还 就 才 再 又 更 最 已经 正在 正 常常 经常 一直 总是 ' +
    '马上 立刻 终于 突然 忽然 大概 也许 当然 其实 特别 尤其 几乎 差不多 一定 肯定 只 仅 仅仅 光 ' +
    '曾经 从来 向来 依然 仍然 仍 竟然 居然 果然 反而 却 倒 简直 根本 到底 究竟 难道 偏偏 幸好 ' +
    '刚 刚才 刚刚 早就 快 慢慢 渐渐 逐渐 互相 亲自 专门 顺便 稍微 有点儿 挺 极 十分 相当 比较 ' +
    '越来越 越发 更加 尽量 千万 务必 必然 未必 不妨 照样 依旧 素来 历来 从此 于是 随后 接着').split(' '));

  var PARTICULAS_FINALES = conjunto('吗 呢 吧 啊 呀 啦 嘛 哦 哈 咯 喽 罢了 而已 来着 呗 咧 嘞'.split(' '));

  var DIRECCIONALES = conjunto(('来 去 上 下 进 出 回 过 起 开 上来 上去 下来 下去 进来 进去 出来 出去 ' +
    '回来 回去 过来 过去 起来 开来 开去').split(' '));

  // Ojo: 了, 着, 过, 得 NO entran aquí. Son partículas y, si se cuelan, toda
  // combinación «verbo + partícula» se explicaría como complemento de resultado.
  var RESULTATIVOS = conjunto(('完 好 到 见 懂 错 住 成 会 掉 走 上 下 开 光 满 清楚 干净 明白 够 ' +
    '死 透 惯 腻 烦 醒 倒 破 断 碎 坏 丢 失 中 起 出 动').split(' '));

  var LOCALIZADORES = conjunto(('里 上 下 中 内 外 前 后 旁 边 间 左 右 东 西 南 北 附近 旁边 里面 里边 ' +
    '上面 上边 下面 下边 前面 前边 后面 后边 中间 外面 外边 左边 右边 对面 之间 之内 之外 之前 之后 ' +
    '以内 以外 以上 以下 之上 之下 当中 周围 底下 头上').split(' '));

  var TIEMPO = conjunto(('今天 明天 昨天 前天 后天 今年 明年 去年 前年 后年 现在 以前 以后 将来 过去 ' +
    '刚才 早上 上午 中午 下午 晚上 夜里 白天 今晚 昨晚 明晚 早晨 傍晚 半夜 春 夏 秋 冬 ' +
    '春天 夏天 秋天 冬天 平时 最近 当时 后来 从前 将来 目前 如今 当今 每天 每年 每月 每周').split(' '));

  var PRONOMBRES = conjunto(('我 你 您 他 她 它 我们 咱们 你们 他们 她们 它们 自己 大家 别人 人家 ' +
    '这 那 哪 这儿 那儿 哪儿 这里 那里 哪里 这个 那个 哪个 这些 那些 哪些 什么 谁 怎么 怎样 ' +
    '怎么样 为什么 多少 几 各 每 某 其 此 该 本人 咱').split(' '));

  var INTERROGATIVOS = conjunto('什么 谁 哪 哪儿 哪里 哪个 哪些 怎么 怎样 怎么样 为什么 多少 几 何 如何 多久 几时'.split(' '));

  var CONJUNCIONES = conjunto(('和 跟 与 同 及 以及 或 或者 还是 但是 可是 不过 然而 而 而且 并且 ' +
    '因为 所以 由于 因此 于是 虽然 尽管 如果 要是 假如 倘若 即使 就算 哪怕 无论 不管 只要 只有 ' +
    '除非 既然 不但 不仅 甚至 并 况且 何况 反正 总之 那么 那 就 便').split(' '));

  /* --- etiqueta escrita a mano para las palabras funcionales ----------- */

  var FORZADAS = {
    '的': 'uj', '地': 'uv', '得': 'ud', '了': 'ul', '着': 'uz', '过': 'ug',
    '们': 'k', '之': 'uj', '所': 'usuo', '者': 'k', '把': 'pba', '被': 'pbei',
    '将': 'pba', '给': 'p', '让': 'pbei', '叫': 'v', '是': 'vshi', '有': 'vyou',
    '不': 'd', '没': 'd', '没有': 'd', '别': 'd', '很': 'd', '太': 'd',
    '比': 'pbi', '更': 'd', '最': 'd', '一样': 'a', '一些': 'm', '一点儿': 'm',
    '吗': 'y', '呢': 'y', '吧': 'y', '啊': 'y', '呀': 'y', '啦': 'y', '嘛': 'y',
    '会': 'vmod', '能': 'vmod', '可以': 'vmod', '要': 'vmod', '想': 'vmod',
    '应该': 'vmod', '必须': 'vmod', '愿意': 'vmod', '敢': 'vmod', '可能': 'd',
    '在': 'p', '从': 'p', '到': 'v', '向': 'p', '往': 'p', '对': 'p',
    '为': 'p', '为了': 'p', '跟': 'p', '和': 'c', '离': 'p', '用': 'v',
    '就': 'd', '才': 'd', '都': 'd', '也': 'd', '还': 'd', '再': 'd', '又': 'd',
    '已经': 'd', '正在': 'd', '正': 'd', '连': 'd', '只': 'd', '一直': 'd',
    '个': 'q', '位': 'q', '条': 'q', '张': 'q', '本': 'q', '件': 'q',
    '这': 'r', '那': 'r', '哪': 'r', '每': 'r', '各': 'r',
    '因为': 'c', '所以': 'c', '虽然': 'c', '但是': 'c', '可是': 'c',
    '如果': 'c', '要是': 'c', '不但': 'c', '而且': 'c', '或者': 'c',
    '越': 'd', '越来越': 'd', '一边': 'd', '一面': 'd'
  };

  /* Compuestos de verbo + objeto que el corpus etiqueta como sustantivos
   * («correr-pasos», «cantar-canción»). Son verbos en toda regla y, si no se
   * corrigen, el analizador se queda sin predicado. */
  ('打电话 跑步 唱歌 散步 见面 生气 聊天 游泳 上网 帮忙 请假 睡觉 起床 上班 下班 吃饭 ' +
   '看书 说话 结婚 洗澡 理发 刷牙 打针 出差 加班 打折 打扫 打字 排队 出发 报名 毕业 ' +
   '考试 上课 下课 放假 开会 做饭 逛街 拍照 干杯 握手 鼓掌 道歉 敬酒 分手 吵架 ' +
   '搬家 出国 回国 留学 打工 挣钱 赚钱 花钱 省钱 存钱 取钱 付款 下单 收货 退货 ' +
   '点赞 转发 评论 关注 直播 打卡 截图 吐槽 加油 骑车 开车 坐车 走路 爬山 钓鱼')
    .split(' ').forEach(function (w) { if (w) FORZADAS[w] = 'v'; });

  /* Locuciones adjetivas frecuentes que también se etiquetan mal. */
  '有意思 没意思 有名 有用 没用 有空 没空 有道理 不错 差不多 了不起'
    .split(' ').forEach(function (w) { FORZADAS[w] = 'a'; });

  var CATEGORIAS = {
    n: 'sustantivo', ng: 'sustantivo', nr: 'nombre propio', nrt: 'nombre propio',
    nrfg: 'nombre propio', ns: 'topónimo', nt: 'organización', nz: 'nombre propio',
    nl: 'sustantivo', nw: 'obra',
    v: 'verbo', vd: 'verbo', vn: 'sustantivo verbal', vg: 'verbo', vi: 'verbo',
    vq: 'verbo', vf: 'verbo', vx: 'verbo', vl: 'locución verbal',
    vshi: 'cópula «ser»', vyou: 'verbo «tener / haber»', vmod: 'verbo modal',
    a: 'adjetivo', ad: 'adjetivo adverbial', an: 'adjetivo sustantivado',
    ag: 'adjetivo', al: 'locución adjetiva', b: 'adjetivo no predicativo',
    d: 'adverbio', dg: 'adverbio', df: 'adverbio',
    m: 'numeral', mq: 'numeral + clasificador', q: 'clasificador',
    r: 'pronombre', rg: 'pronombre', rr: 'pronombre', rz: 'pronombre',
    ry: 'pronombre interrogativo', rys: 'pronombre interrogativo',
    p: 'preposición (coverbo)', pba: 'marca de objeto antepuesto (把)',
    pbei: 'marca de pasiva (被)', pbi: 'marca de comparación (比)',
    c: 'conjunción', cc: 'conjunción',
    u: 'partícula', uj: 'partícula estructural', uv: 'partícula adverbial',
    ud: 'partícula de complemento', ul: 'partícula de aspecto',
    uz: 'partícula de aspecto', ug: 'partícula de aspecto',
    usuo: 'partícula relativa (所)',
    y: 'partícula final', e: 'interjección', o: 'onomatopeya',
    f: 'localizador', s: 'lugar', t: 'expresión de tiempo',
    z: 'palabra descriptiva', i: 'locución fija', l: 'locución',
    j: 'abreviatura', k: 'sufijo', h: 'prefijo', g: 'morfema',
    zg: 'morfema', x: 'otro', w: 'puntuación', eng: 'palabra extranjera'
  };

  /** Etiqueta y categoría de cada token; también sus clases léxicas. */
  function etiquetar(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.tipo !== 'hanzi') {
        t.pos = t.tipo === 'puntuacion' ? 'w' : (t.tipo === 'numero' ? 'm' : 'x');
        t.categoria = t.tipo === 'puntuacion' ? 'puntuación'
          : t.tipo === 'numero' ? 'número'
          : t.tipo === 'latin' ? 'palabra extranjera' : 'símbolo';
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(FORZADAS, t.texto)) t.pos = FORZADAS[t.texto];
      if (!t.pos) t.pos = adivinar(t);
      t.categoria = CATEGORIAS[t.pos] || CATEGORIAS[t.pos[0]] || 'palabra';

      t.esClasificador = CLASIFICADORES.has(t.texto);
      t.esModal = MODALES.has(t.texto) || t.pos === 'vmod';
      t.esCoverbo = COVERBOS.has(t.texto);
      t.esAdverbio = ADVERBIOS.has(t.texto) || t.pos[0] === 'd';
      t.esFinal = PARTICULAS_FINALES.has(t.texto);
      t.esDireccional = DIRECCIONALES.has(t.texto);
      t.esResultativo = RESULTATIVOS.has(t.texto);
      t.esLocalizador = LOCALIZADORES.has(t.texto) || t.pos === 'f';
      t.esTiempo = TIEMPO.has(t.texto) || t.pos === 't';
      t.esPronombre = PRONOMBRES.has(t.texto) || t.pos[0] === 'r';
      t.esInterrogativo = INTERROGATIVOS.has(t.texto);
      t.esConjuncion = CONJUNCIONES.has(t.texto) || t.pos[0] === 'c';
      t.esVerbo = t.pos[0] === 'v' && t.pos !== 'vn';
      t.esNombre = t.pos[0] === 'n' || t.pos === 'vn' || t.pos === 'an' || t.pos === 's';
      t.esAdjetivo = t.pos[0] === 'a' || t.pos === 'z' || t.pos === 'b';
      t.esNumeral = t.pos[0] === 'm' || /^[0-9０-９一二三四五六七八九十百千万亿两半]+$/.test(t.texto);
      t.esPredicativo = t.esVerbo || (t.esAdjetivo && t.pos !== 'b');
    }
    return tokens;
  }

  /** Última opción cuando el diccionario no trae etiqueta. */
  function adivinar(t) {
    if (PARTICULAS_FINALES.has(t.texto)) return 'y';
    if (CLASIFICADORES.has(t.texto)) return 'q';
    if (PRONOMBRES.has(t.texto)) return 'r';
    if (ADVERBIOS.has(t.texto)) return 'd';
    if (COVERBOS.has(t.texto)) return 'p';
    if (CONJUNCIONES.has(t.texto)) return 'c';
    if (LOCALIZADORES.has(t.texto)) return 'f';
    if (/^[0-9０-９一二三四五六七八九十百千万亿两]+$/.test(t.texto)) return 'm';
    return 'n';
  }

  return {
    etiquetar: etiquetar,
    CATEGORIAS: CATEGORIAS,
    CLASIFICADORES: CLASIFICADORES,
    MODALES: MODALES,
    COVERBOS: COVERBOS,
    DIRECCIONALES: DIRECCIONALES,
    RESULTATIVOS: RESULTATIVOS,
    LOCALIZADORES: LOCALIZADORES,
    INTERROGATIVOS: INTERROGATIVOS,
    PARTICULAS_FINALES: PARTICULAS_FINALES
  };
})();
