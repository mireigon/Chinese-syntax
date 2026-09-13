#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construye los ficheros de datos que usa la aplicación web.

Fuentes (se descargan con tools/fetch-sources.sh, no se versionan):
  tools/sources/cedict.json      CC-CEDICT  (CC BY-SA 4.0)  -> pinyin, inglés, nivel HSK
  tools/sources/jieba-dict.txt   jieba      (MIT)           -> frecuencias y etiquetas POS
  tools/sources/pinyin_dict.json  pypinyin  (MIT)           -> pinyin de caracteres sueltos
  tools/sources/phrases_dict.json pypinyin  (MIT)           -> pinyin de palabras
  tools/sources/hsk.json         listas HSK 1-6

Salida (sí se versiona, para que la app funcione sin instalar nada):
  data/lexicon-core.js  vocabulario nuclear (se carga al abrir la página)
  data/lexicon-ext.js   resto del diccionario (se carga en segundo plano)
  data/chars.js     pinyin de caracteres sueltos no cubiertos por el diccionario
  data/meta.js      metadatos y recuentos
"""
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sources')
OUT = os.path.join(ROOT, 'data')

# Palabras de jieba que no están en CC-CEDICT: se incluyen a partir de esta
# frecuencia para que la segmentación no las parta por la mitad.
JIEBA_MIN_FREQ = 20
HANZI = re.compile(r'[㐀-䶿一-鿿豈-﫿]')


def log(*a):
    print(*a, file=sys.stderr)


def load_sources():
    need = ['cedict.json', 'jieba-dict.txt', 'pinyin_dict.json', 'phrases_dict.json', 'hsk.json']
    missing = [n for n in need if not os.path.exists(os.path.join(SRC, n))]
    if missing:
        sys.exit('Faltan fuentes: %s\nEjecuta primero tools/fetch-sources.sh' % ', '.join(missing))
    cedict = json.load(open(os.path.join(SRC, 'cedict.json'), encoding='utf-8'))
    jieba = {}
    for line in open(os.path.join(SRC, 'jieba-dict.txt'), encoding='utf-8'):
        p = line.split()
        if len(p) >= 2:
            jieba[p[0]] = (int(p[1]), p[2] if len(p) > 2 else 'x')
    chars = json.load(open(os.path.join(SRC, 'pinyin_dict.json'), encoding='utf-8'))
    phrases = json.load(open(os.path.join(SRC, 'phrases_dict.json'), encoding='utf-8'))
    hsk = json.load(open(os.path.join(SRC, 'hsk.json'), encoding='utf-8-sig'))
    return cedict, jieba, chars, phrases, hsk


# --- pinyin -----------------------------------------------------------------
VOWELS = {
    'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù',
    'v': 'ǖǘǚǜ', 'ü': 'ǖǘǚǜ',
}


def numbered_to_marks(syl):
    """cheng2 -> chéng ; lu:4 -> lǜ ; el tono 5 (neutro) se queda sin tilde."""
    m = re.match(r'^([a-zA-Zü:]+)([1-5])?$', syl)
    if not m:
        return syl
    body, tone = m.group(1), m.group(2)
    body = body.replace('u:', 'ü').replace('U:', 'Ü').replace('v', 'ü')
    if not tone or tone == '5':
        return body.lower()
    tone = int(tone)
    low = body.lower()
    # Regla estándar de colocación de la tilde.
    if 'a' in low:
        idx = low.index('a')
    elif 'o' in low and 'e' not in low:
        idx = low.index('o')
    elif 'e' in low:
        idx = low.index('e')
    else:
        # última vocal de iu/ui/etc.
        idx = max((low.rindex(c) for c in 'iouü' if c in low), default=-1)
    if idx < 0:
        return low
    ch = low[idx]
    table = VOWELS.get(ch)
    if not table:
        return low
    return low[:idx] + table[tone - 1] + low[idx + 1:]


def pinyin_marks(numbered):
    """'ni3 hao3' -> 'nǐ hǎo'"""
    out = []
    for syl in numbered.split():
        syl = syl.strip()
        if not syl:
            continue
        if re.match(r'^[a-zA-Zü:]+[1-5]?$', syl):
            out.append(numbered_to_marks(syl))
        else:
            out.append(syl)
    return ' '.join(out)


# --- limpieza de las glosas inglesas ----------------------------------------
CEDICT_NOISE = re.compile(r'\[[^\]]*\]')          # referencias tipo [ni3 hao3]
VARIANT = re.compile(r'^(variant of|old variant of|also written|see |erhua variant)', re.I)


def clean_en(translations, limit=3, maxlen=120):
    out = []
    for t in translations:
        t = CEDICT_NOISE.sub('', t)
        t = re.sub(r'\s{2,}', ' ', t).strip(' ;,')
        if not t:
            continue
        if len(t) > maxlen:
            t = t[:maxlen].rsplit(' ', 1)[0] + '…'
        out.append(t)
        if len(out) >= limit:
            break
    if not out:
        return ''
    # Las entradas que sólo remiten a otra forma aportan poco: se marcan cortas.
    if VARIANT.match(out[0]) and len(out) > 1:
        out = out[1:] + out[:1]
    return '; '.join(out)


def solo_verbal(acepciones):
    """True si CC-CEDICT describe la palabra principalmente como verbo.

    Se exige que la primera acepcion sea verbal y que al menos la mitad lo
    sean. Asi 学 («to learn, to study, to imitate, science») entra, y 同学
    («to study at the same school, fellow student, classmate») no.
    """
    utiles = [a for a in acepciones if a and not a.startswith('CL:')]
    if not utiles or not utiles[0].startswith('to '):
        return False
    verbales = sum(1 for a in utiles if a.startswith('to '))
    return verbales * 2 >= len(utiles)


def build():
    cedict, jieba, char_py, phrase_py, hsk_lists = load_sources()

    hsk_of = {}
    for level, words in enumerate(hsk_lists, start=1):
        for w in words:
            hsk_of.setdefault(w, level)

    # «Numeral + clasificador» (三本, 两个) no debe quedar como una palabra: si
    # se queda, 三本书 se corta 三本 / 书 y se pierde la estructura que hay que
    # enseñar. Algunas de esas combinaciones están en CC-CEDICT como apellidos
    # japoneses o topónimos, así que hay que quitarlas también de ahí.
    NUM_CL = re.compile('^[一二三四五六七八九十两几半]['
                        '个位只条张本件辆双些点种次遍下杯碗块层段句封座台套份名群篇棵朵顿趟场首支根片幅面把门'
                        '年天周秒岁元米克斤]$')

    # Negación + predicado. Se parten (不能 -> 不 + 能) porque así el analizador
    # encuentra el verbo y quien aprende ve la negación por separado. Sólo se
    # conservan las que ya no se sienten como negación de nada.
    NEG_LEXICALIZADAS = set((
        '不错 不但 不过 不仅 不管 不用 不如 不必 不妨 不然 不少 不久 不断 不同 不足 不满 '
        '不幸 不良 不利 不定 不安 不便 不停 不容 不已 不宜 不成 不快 不巧 不料 不禁 不时 '
        '不甘 不屑 不朽 不凡 不乏 不服 不测 不至 不外 不端 不忍 不祥 不宁 不悦 不菲 不逊 '
        '没有 没错 没准 没劲 没趣 没辙').split())

    def es_negacion_transparente(w):
        return len(w) == 2 and w[0] in '不没' and w not in NEG_LEXICALIZADAS

    # Verbo + partícula de aspecto (去过, 看过, 吃了). Igual que con la negación:
    # hay que verlas separadas para entender el aspecto, y si no el analizador
    # no reconoce la construcción. Se conservan las ya lexicalizadas.
    ASPECTO_LEXICALIZADAS = set((
        '经过 通过 不过 难过 太过 超过 度过 路过 错过 越过 渡过 胜过 好过 走过 度过 '
        '罢了 为了 除了 算了 得了 极了 沿着 随着 接着 跟着 照着 顺着 冲着 朝着 本着 '
        '凭着 活着 意味着 犯不着 用不着 划得来').split())

    def es_verbo_mas_aspecto(w):
        return len(w) == 2 and w[1] in '过了着' and w not in ASPECTO_LEXICALIZADAS

    # Pronombre + lo que sea: 我会, 他说, 你们都... no son palabras, son dos.
    def es_pronombre_mas_algo(w):
        return len(w) == 2 and w[0] in '我你他她它咱您' and w not in ('我们', '你们', '他们',
                                                                     '她们', '它们', '咱们',
                                                                     '他人', '她俩', '我国',
                                                                     '我军', '他俩', '我方')

    entries = {}   # palabra -> [pinyin_num, pos, freq, hsk, en]
    for e in cedict:
        w = e['s']
        if not w or not HANZI.search(w):
            continue
        if NUM_CL.match(w) or es_negacion_transparente(w) or es_verbo_mas_aspecto(w):
            continue
        py = e.get('py', '')
        en = clean_en(e.get('en') or [])
        freq, pos = jieba.get(w, (0, ''))
        # El corpus etiqueta como sustantivos muchos verbos (学, 回家, 跑步) y eso
        # deja la frase sin predicado. CC-CEDICT lo desmiente: sus acepciones
        # verbales empiezan por «to ». Se exige que TODAS lo sean, porque 同学
        # («to study at the same school», «classmate») es un sustantivo con una
        # primera acepción engañosa y la mayoría de sus sentidos nominales.
        if pos and pos[0] not in 'vam' and solo_verbal(e.get('en') or []):
            pos = 'v'
        level = hsk_of.get(w) or e.get('hsk') or 0
        prev = entries.get(w)
        if prev:
            # CC-CEDICT trae varias entradas por palabra (distintas lecturas):
            # se conserva la más informativa y se acumulan las lecturas.
            if py and py not in prev[0].split('/'):
                prev[0] = prev[0] + '/' + py
            if en and len(en) > len(prev[4]):
                prev[4] = en
            continue
        entries[w] = [py, pos, freq, level, en]

    # Clasificadores: un bigrama «clasificador + sustantivo» que sólo esté en
    # jieba (本书, 个人儿...) parte mal las frases, porque 这本书 debería cortarse
    # 这 / 本 / 书. Se descartan.
    CLASIFICADORES = set('个位只条张本件辆双些点种次遍下杯碗块层段句封座台套份名群篇棵朵顿趟场首支根片幅面把门队批串堆副届卷类')

    added = 0
    for w, (freq, pos) in jieba.items():
        if w in entries or freq < JIEBA_MIN_FREQ or not HANZI.search(w):
            continue
        if len(w) == 2 and w[0] in CLASIFICADORES:
            continue
        if NUM_CL.match(w):
            continue
        # Negación + predicado (不难, 不能, 没去). El corpus las trae como una
        # sola palabra y encima etiquetadas como adverbio, con lo que la frase
        # se queda sin verbo. Además, a quien está aprendiendo le interesa ver
        # el 不 suelto. Las que sí están lexicalizadas (不错, 不但, 不过...)
        # vienen de CC-CEDICT y no pasan por aquí.
        if es_negacion_transparente(w) or es_verbo_mas_aspecto(w) or es_pronombre_mas_algo(w):
            continue
        # Verbo + coverbo (放在, 送到, 交给): tampoco son palabras. Si se dejan,
        # el 在 deja de analizarse como introductor de lugar.
        if len(w) == 2 and w[1] in '在到给' and w not in ('存在', '现在', '正在', '所在',
                                                        '得到', '来到', '受到', '想到',
                                                        '看到', '找到', '感到', '达到',
                                                        '遇到', '直到', '不到', '供给'):
            continue
        syls = phrase_py.get(w)
        if syls:
            py_field = '~' + ' '.join(s[0] for s in syls)   # '~' = ya lleva tildes
        else:
            # Sin pinyin de palabra: se compone con la lectura principal de
            # cada caracter. Aproximado, pero mejor que dejarlo en blanco.
            parts = []
            for ch in w:
                r = char_py.get(str(ord(ch)))
                parts.append(r.split(',')[0] if r else '?')
            py_field = '~' + ' '.join(parts) if all(p != '?' for p in parts) else ''
        entries[w] = [py_field, pos, freq, hsk_of.get(w, 0), '']
        added += 1
    log('entradas CC-CEDICT: %d  +  jieba: %d  =  %d' % (len(entries) - added, added, len(entries)))

    # El corpus de frecuencias es periodístico, así que infravalora el
    # vocabulario hablado de todos los días. Sin esta corrección, 你好 se parte
    # en 你 + 好, que por separado son mucho más frecuentes.
    HABLADO = ('你好 您好 谢谢 再见 对不起 没关系 不客气 请问 不好意思 麻烦你 早上好 晚安 '
               '没事 没什么 怎么办 好吗 是不是 对吧 真的 假的 一下 一点儿 有点儿 这样 那样 '
               '什么样 多久 几点 一起 一样 一定 当然 也许 可能 应该 必须 愿意 喜欢 讨厌 '
               '知道 觉得 认识 明白 记得 忘记 希望 打算 准备 开始 结束 继续 帮忙 休息 '
               '起床 睡觉 吃饭 喝水 看书 上班 下班 上课 下课 回家 出门 走路 坐车 开车')
    for w in HABLADO.split():
        if w in entries and entries[w][2] < 1200:
            entries[w][2] = 1200

    # Frecuencia comprimida a un entero pequeño (log). 0 = no vista en el corpus.
    lines = []
    for w in sorted(entries):
        py, pos, freq, level, en = entries[w]
        if py.startswith('~'):
            py_marks = py[1:]
        else:
            py_marks = ' / '.join(pinyin_marks(p) for p in py.split('/')) if py else ''
        lf = 0 if freq <= 0 else max(1, min(99, int(round(math.log(freq) * 6))))
        en = en.replace('\t', ' ').replace('\n', ' ').replace('`', "'")
        lines.append('%s\t%s\t%s\t%d\t%d\t%s' % (w, py_marks, pos, lf, level, en))

    os.makedirs(OUT, exist_ok=True)

    # El léxico se parte en dos niveles para que la página sea usable al
    # instante: el núcleo (HSK, caracteres sueltos y palabras frecuentes) se
    # carga de golpe; el resto llega después y el análisis se repite solo.
    def is_core(line):
        f = line.split('\t')
        return f[4] != '0' or int(f[3]) >= 25 or len(f[0]) == 1

    core = [l for l in lines if is_core(l)]
    ext = [l for l in lines if not is_core(l)]

    def dump(path, varname, rows):
        payload = '\n'.join(rows).replace('\\', '\\\\').replace('${', '$\\{')
        with open(os.path.join(OUT, path), 'w', encoding='utf-8') as f:
            f.write('// Generado por tools/build-data.py — no editar a mano.\n')
            f.write('// CC-CEDICT (CC BY-SA 4.0) + jieba (MIT) + pypinyin (MIT).\n')
            f.write('// campos: palabra \\t pinyin \\t POS \\t log-frecuencia \\t nivel HSK \\t inglés\n')
            f.write('window.%s = `%s`;\n' % (varname, payload))
        log('  %s: %d entradas' % (path, len(rows)))

    dump('lexicon-core.js', 'ZH_LEXICON_CORE', core)
    dump('lexicon-ext.js', 'ZH_LEXICON_EXT', ext)

    # Caracteres sueltos que no están en el léxico (para no dejar nunca sin pinyin).
    known = set(entries)
    clines = []
    for code, readings in char_py.items():
        ch = chr(int(code))
        if ch in known:
            continue
        first = readings.split(',')[0]
        clines.append(ch + first)
    with open(os.path.join(OUT, 'chars.js'), 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/build-data.py — pinyin de caracteres sueltos (pypinyin, MIT).\n')
        f.write('window.ZH_CHARS = `' + '\n'.join(clines) + '`;\n')

    with open(os.path.join(OUT, 'meta.js'), 'w', encoding='utf-8') as f:
        json.dump({
            'entradas': len(entries),
            'caracteres_extra': len(clines),
            'con_ingles': sum(1 for v in entries.values() if v[4]),
            'con_hsk': sum(1 for v in entries.values() if v[3]),
            'nucleo': len(core),
        }, f, ensure_ascii=False)
    # meta.js debe ser JS, no JSON suelto
    meta = open(os.path.join(OUT, 'meta.js'), encoding='utf-8').read()
    open(os.path.join(OUT, 'meta.js'), 'w', encoding='utf-8').write('window.ZH_META = %s;\n' % meta)
    log('listo')


def build_spanish():
    """Funde tools/lexicon/*.tsv (glosario escrito a mano) en data/es-lexicon.js."""
    import glob
    rows = {}
    dupes = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'tools', 'lexicon', '*.tsv'))):
        for n, line in enumerate(open(path, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            if '\t' not in line:
                log('  aviso %s:%d sin tabulador: %r' % (os.path.basename(path), n, line))
                continue
            w, gloss = line.split('\t', 1)
            w, gloss = w.strip(), gloss.strip()
            if not w or not gloss:
                continue
            if w in rows:
                if rows[w] != gloss:
                    dupes.append((w, rows[w], gloss))
                continue      # gana el primero: el orden de los ficheros manda
            rows[w] = gloss
    for w, a, b in dupes:
        log('  duplicado %s: se usa %r y se ignora %r' % (w, a, b))
    payload = '\n'.join('%s\t%s' % (w, rows[w]) for w in sorted(rows))
    with open(os.path.join(OUT, 'es-lexicon.js'), 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/build-data.py desde tools/lexicon/*.tsv\n')
        f.write('// Para anadir o corregir una palabra, edita el .tsv y vuelve a ejecutar el script.\n')
        f.write('window.ZH_ES = `' + payload.replace('\\', '\\\\').replace('${', '$\\{') + '`;\n')
    log('glosario espanol: %d entradas' % len(rows))
    return len(rows)


if __name__ == '__main__':
    build()
    build_spanish()
