#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convierte la exportacion de Anki en los mazos que usa la aplicacion.

    python3 tools/importar-anki.py chino_flashcards.txt

El fichero de Anki trae cuatro columnas separadas por tabuladores (anverso,
reverso en HTML, etiquetas y mazo). El reverso viene maquetado con divs y
estilos en linea; aqui se extrae la informacion y se tira el HTML, por dos
motivos: la aplicacion lo pinta con su propio aspecto (y su modo de tinta
electronica), y nunca se inyecta en la pagina marcado que venga de un fichero.

Salida: data/mazos.js
"""
import html
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'data', 'mazos.js')

# El reverso, antes del desglose, son lineas separadas por <br>:
#   cabecera (pinyin - glosa)
#   [palabra compuesta <span>pinyin</span> <span>glosa</span>]*   (opcional)
#   frase de ejemplo
SEPARADOR = re.compile(r'<br\s*/?>', re.I)
BLOQUE = re.compile(r'<div style="display:inline-block.*?</div>\s*</div>', re.S)
CELDA = re.compile(r'<div[^>]*>(.*?)</div>', re.S)
ETIQUETAS = re.compile(r'<[^>]+>')


def limpiar(txt):
    """HTML fuera, entidades resueltas, espacios normalizados."""
    txt = ETIQUETAS.sub('', txt or '')
    txt = html.unescape(txt)
    txt = txt.replace(' ', ' ')
    return ' '.join(txt.split())


def partir_cabecera(texto):
    """'ri — sol / dia' -> ('ri', 'sol / dia'). El guion largo es el separador."""
    for sep in ('—', '–', ' - '):
        if sep in texto:
            izq, der = texto.split(sep, 1)
            return limpiar(izq), limpiar(der)
    return '', limpiar(texto)


def partir_reverso(reverso):
    """Separa el reverso en cabecera, compuestos, frase y desglose."""
    corte = reverso.find('<div')
    cabeza, desglose = (reverso[:corte], reverso[corte:]) if corte >= 0 else (reverso, '')
    lineas = [l for l in (x.strip() for x in SEPARADOR.split(cabeza)) if limpiar(l)]
    return lineas, desglose


COMPUESTO = re.compile(r'^(.*?)<span[^>]*>(.*?)</span>\s*<span[^>]*>(.*?)</span>\s*$', re.S)


def leer_compuesto(linea):
    """'一起 <span>yiqi</span> <span>juntos</span>' -> [palabra, pinyin, glosa]."""
    m = COMPUESTO.match(linea.strip())
    if not m:
        return None
    palabra = limpiar(m.group(1))
    if not palabra:
        return None
    return [palabra, limpiar(m.group(2)), limpiar(m.group(3))]


def desglosar(html_desglose):
    """Lista de [palabra, pinyin, glosa] del analisis palabra a palabra."""
    fuera = []
    for bloque in BLOQUE.findall(html_desglose):
        celdas = [limpiar(c) for c in CELDA.findall(bloque)]
        celdas = [c for c in celdas if c]
        if not celdas:
            continue
        palabra = celdas[0]
        pinyin = celdas[1] if len(celdas) > 1 else ''
        glosa = celdas[2] if len(celdas) > 2 else ''
        fuera.append([palabra, pinyin, glosa])
    return fuera


def nombre_legible(mazo):
    """'Chino::Frecuencia::01 (1-100)' -> ('Frecuencia', '01 (1-100)')."""
    trozos = [t.strip() for t in mazo.split('::') if t.strip()]
    if trozos and trozos[0].lower() == 'chino':
        trozos = trozos[1:]
    if len(trozos) >= 2:
        return trozos[0], '::'.join(trozos[1:])
    return (trozos[0] if trozos else 'Otros'), (trozos[0] if trozos else 'Otros')


def identificador(grupo, nombre):
    base = unicodedata.normalize('NFKD', grupo + '-' + nombre)
    base = base.encode('ascii', 'ignore').decode('ascii').lower()
    base = re.sub(r'[^a-z0-9]+', '-', base).strip('-')
    return base or 'mazo'


def importar(ruta):
    filas = []
    with open(ruta, encoding='utf-8', newline='') as f:
        for linea in f:
            linea = linea.rstrip('\r\n')
            if linea.startswith('#') or not linea.strip():
                continue
            campos = linea.split('\t')
            if len(campos) >= 4:
                filas.append(campos)
    if not filas:
        sys.exit('El fichero no tiene tarjetas reconocibles.')

    fichas = {}
    orden_mazos = []
    contenido = {}

    for anverso, reverso, _etiquetas, mazo in filas:
        palabra = limpiar(anverso)
        if not palabra:
            continue
        grupo, nombre = nombre_legible(mazo)
        mid = identificador(grupo, nombre)
        if mid not in contenido:
            contenido[mid] = []
            orden_mazos.append({'id': mid, 'grupo': grupo, 'nombre': nombre})
        contenido[mid].append(palabra)

        lineas, html_desglose = partir_reverso(reverso)
        partes = desglosar(html_desglose)

        pinyin = glosa = frase = ''
        compuestos = []
        if lineas:
            pinyin, glosa = partir_cabecera(limpiar(lineas[0]))
            # La ultima linea es la frase de ejemplo; lo de en medio, compuestos.
            if len(lineas) > 1:
                frase = limpiar(lineas[-1])
                for linea in lineas[1:-1]:
                    c = leer_compuesto(linea)
                    if c:
                        compuestos.append(c)

        # Las tarjetas de los mitos no son vocabulario: el anverso es un trozo
        # del relato y el reverso, su traduccion palabra a palabra. Se marcan
        # para que la aplicacion las presente como lectura, no como vocabulario.
        es_texto = not pinyin
        if es_texto:
            glosa = ''
            frase = ''

        ficha = {}
        if pinyin:
            ficha['py'] = pinyin
        if glosa:
            ficha['es'] = glosa
        if frase:
            ficha['fr'] = frase
        if compuestos:
            ficha['cp'] = compuestos
        if partes:
            ficha['dg'] = partes
        if es_texto:
            ficha['tipo'] = 'texto'
        fichas[palabra] = ficha

    # Los mazos de frecuencia van primero: son los que de verdad se estudian.
    def clave(m):
        prioridad = 0 if m['grupo'].lower().startswith('frecuencia') else 1
        return (prioridad, m['grupo'], m['nombre'])
    orden_mazos.sort(key=clave)

    grupos = []
    for m in orden_mazos:
        if not grupos or grupos[-1]['nombre'] != m['grupo']:
            grupos.append({'nombre': m['grupo'], 'mazos': []})
        grupos[-1]['mazos'].append({'id': m['id'], 'nombre': m['nombre'],
                                    'n': len(contenido[m['id']])})

    datos = {
        'grupos': grupos,
        'mazos': {m['id']: contenido[m['id']] for m in orden_mazos},
        'fichas': fichas
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/importar-anki.py desde una exportacion de Anki.\n')
        f.write('// No editar a mano: vuelve a ejecutar el importador.\n')
        f.write('window.ZH_MAZOS = ')
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    total = sum(len(v) for v in contenido.values())
    print('mazos: %d en %d grupos' % (len(orden_mazos), len(grupos)))
    for g in grupos:
        print('  %-18s %2d mazos, %5d tarjetas'
              % (g['nombre'], len(g['mazos']), sum(x['n'] for x in g['mazos'])))
    print('tarjetas: %d | con frase: %d | con compuestos: %d | con desglose: %d | de lectura: %d'
          % (total,
             sum(1 for v in fichas.values() if v.get('fr')),
             sum(1 for v in fichas.values() if v.get('cp')),
             sum(1 for v in fichas.values() if v.get('dg')),
             sum(1 for v in fichas.values() if v.get('tipo') == 'texto')))
    print('escrito %s (%.1f MB)' % (SALIDA, os.path.getsize(SALIDA) / 1e6))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Uso: python3 tools/importar-anki.py <exportacion-de-anki.txt>')
    importar(sys.argv[1])
