# Leer chino

Una página que coge un texto en chino, lo parte en palabras, lo analiza
sintácticamente, lo transcribe a pinyin, lo traduce al español y explica —en
español y para alguien que empieza de cero— qué construcción gramatical hay
detrás de cada trozo.

Está pensada para leer lo que uno se encuentra de verdad: una publicación de X,
un mensaje, la etiqueta de un bote. No hace falta instalar nada ni conectarse a
ningún servidor: es HTML, CSS y JavaScript sin dependencias, y el diccionario
viaja dentro de la propia página.

## Cómo se abre

```sh
git clone <este repositorio>
cd Chinese-syntax
python3 -m http.server 8000     # o cualquier servidor estático
```

Y abrir <http://localhost:8000>. También funciona subiéndolo tal cual a GitHub
Pages o a cualquier alojamiento estático.

> Abrir `index.html` con doble clic (`file://`) muestra el vocabulario nuclear
> —unas 53.000 palabras— pero no carga la ampliación del diccionario, porque el
> navegador bloquea esa segunda petición. Con un servidor local se cargan las
> 143.000.

## Qué se ve en pantalla

**Panel izquierdo — el chino.** El texto queda partido en palabras, cada una con
su pinyin encima. Debajo de cada palabra hay un subrayado de color que dice qué
papel cumple en la frase: sujeto, verbo, objeto, circunstancia, coverbo,
partícula de aspecto… Al pasar el ratón por una palabra aparece su ficha:
pronunciación, categoría, significado, nivel HSK y, si la tiene, la lectura
alternativa o el cambio de tono al pronunciarla.

**Panel derecho — el pinyin y el español.** Arriba, la lectura corrida. Debajo,
dos traducciones:

- **Estructural.** La construye el propio programa a partir del análisis:
  sustituye cada bloque por su equivalente español y los recoloca en el orden
  del español. Sale literal, a veces torpe, pero cada trozo se puede rastrear
  hasta el original, y por eso se pueden resaltar los dos lados a la vez. Sirve
  para entender la construcción, no para leerla bonita.
- **Natural (IA).** Se la pide a la API de Claude, que devuelve la traducción ya
  partida en segmentos alineados con el original para no perder el resaltado.
  Necesita una clave propia; se guarda sólo en el navegador (`localStorage`) y no
  se manda a ningún otro sitio.

**Abajo — la gramática.** Una tarjeta por cada construcción reconocida en el
texto. Cada una lleva el nombre de la construcción, la fórmula, una explicación
escrita con las palabras concretas de tu frase, la comparación con lo que haría
el español y un ejemplo canónico. Al pinchar una tarjeta se resalta en los dos
paneles la parte de la frase a la que se refiere.

Todo lo que se enciende a la vez está enlazado: pasar el ratón por una palabra
china enciende su pinyin y su traducción; pasarlo por la traducción enciende el
chino del que salió.

## Qué reconoce

Cincuenta construcciones, agrupadas por familias:

| Familia | Algunas de las que cubre |
| --- | --- |
| Partículas estructurales | 的 atributivo y nominalizador, 地, 得, 所 |
| Aspecto | 了 verbal y modal, 着, 过, 在/正在, 起来 incoativo |
| Negación | 不 frente a 没, 别 |
| Orden de palabras | 把, 被, 让/叫/使 causativo, 是…的, 连…都/也, tema |
| Cópula y existencia | 是, 有, 在 locativo, 很 + adjetivo |
| Comparación | 比, 跟…一样, 没有…那么, 最/更, 越…越 |
| Complementos | resultado, dirección, potencial (V得/不+C), duración y frecuencia |
| Modalidad | 会 / 能 / 可以 / 要 / 想 / 应该 y sus diferencias |
| Preguntas | 吗, A-no-A, interrogativos sin mover, 吧, 呢 |
| Clasificadores | Num+CL+N, 这/那+CL, 二 frente a 两 |
| Adverbios de alcance | 都, 就 frente a 才, 也/还/又/再 |
| Conectores | 因为…所以, 虽然…但是, 如果…就, 一…就… y demás parejas |
| Coverbos | 给, 对, 跟, 用, 从, 往, 为了, 离… |
| Morfología | reduplicación verbal, 们, 有点儿 frente a 一点儿 |

Además avisa de los cambios de tono que no se escriben: el 不 que pasa a segundo
tono ante cuarto, el 一 que cambia según lo que venga detrás, y los dos terceros
tonos seguidos.

## Cómo funciona por dentro

```
index.html            la página
css/estilo.css        estilos, incluida la paleta por papel sintáctico
js/lexico.js          carga y consulta del diccionario
js/glosa.js           glosa española de una palabra, con composición y respaldo
js/pinyin.js          polifonía según la función, sandhi, erhua
js/segmentador.js     segmentación por Viterbi sobre frecuencias
js/etiquetas.js       categorías gramaticales e inventarios cerrados
js/patrones.js        buscador de patrones con retroceso
js/construcciones*.js las cincuenta construcciones, con sus explicaciones
js/analisis.js        oraciones, cláusulas y papeles sintácticos
js/traduccion.js      traducción estructural alineada y puente con la API
js/ejemplos.js        textos de muestra
js/ui.js              interfaz y resaltado cruzado
data/*.js             diccionario generado (se versiona, no hay que construirlo)
tools/                el pipeline que genera data/, y el glosario español a mano
tests/motor.js        banco de pruebas del motor, sin navegador
```

El paso difícil es el primero: el chino se escribe sin espacios, así que antes
de analizar nada hay que decidir dónde acaba cada palabra. Se resuelve con un
Viterbi sobre el diccionario, que elige el corte cuya suma de log-frecuencias es
máxima. Después se etiqueta cada palabra, se reparten los papeles dentro de cada
cláusula, se aplican los patrones gramaticales y, sólo al final, se decide el
pinyin: hay caracteres cuya lectura depende de la función que acaben cumpliendo
(得 es «de», «dé» o «děi» según dónde esté).

### Probar el motor sin navegador

```sh
node tests/motor.js                    # analiza las frases de muestra
node tests/motor.js "你好，你叫什么名字？"   # analiza lo que le pases
```

Imprime, para cada frase, la segmentación con pinyin y papeles, la traducción
estructural y las construcciones detectadas.

### Regenerar el diccionario

Los ficheros de `data/` ya vienen hechos. Sólo hace falta rehacerlos si se toca
el glosario español o los filtros del diccionario:

```sh
tools/fetch-sources.sh     # descarga CC-CEDICT, jieba y pypinyin (necesita red)
python3 tools/build-data.py
```

### Añadir o corregir vocabulario

El glosario español está escrito a mano en `tools/lexicon/*.tsv`, un fichero por
bloque temático y una línea por palabra:

```
手机	móvil
```

Después de editarlo, `python3 tools/build-data.py` regenera
`data/es-lexicon.js`. No hace falta descargar las fuentes para esto si ya están
en `tools/sources/`; si no lo están, el glosario se puede regenerar igualmente
comentando la llamada a `build()`.

### Añadir una construcción gramatical

En `js/construcciones*.js`, un objeto más en la lista:

```js
{
  id: 'mi-regla',
  titulo: '…',
  familia: 'Aspecto',
  nivel: 2,                       // 1 básico, 2 intermedio, 3 avanzado
  formula: 'verbo + 了',
  patron: [ { clase: 'esVerbo', nombre: 'verbo' }, { w: '了', clave: true } ],
  explicar: function (m, ctx) {
    return { resumen: '…', detalle: '…', contraste: '…',
             ejemplo: { zh: '…', py: '…', es: '…' } };
  }
}
```

`explicar` puede devolver `null` para descartar una coincidencia que no
convenza: es la forma de evitar falsos positivos sin complicar el patrón.

## Hasta dónde llega

Conviene saber dónde falla, porque falla:

- La segmentación es automática y se equivoca, sobre todo con nombres propios de
  persona y con lengua muy coloquial. Las palabras que no están en el
  diccionario salen con el subrayado punteado.
- El análisis de papeles es superficial: no construye un árbol sintáctico
  completo. Con frases largas, muy subordinadas o sin puntuación, se pierde.
- La traducción estructural es literal por diseño. No intenta sonar bien; para
  eso está la pestaña de IA.
- El glosario español cubre unas 2.100 palabras escritas a mano (todo HSK 1–4,
  las palabras gramaticales, vocabulario de redes y de etiquetas de producto).
  El resto del diccionario sólo tiene definición inglesa, y cuando se usa se
  marca en cursiva con la coletilla «(en inglés)».
- El pinyin de las palabras que no están en CC-CEDICT se compone carácter a
  carácter y puede fallar en los polifónicos.

## Procedencia de los datos

| Fuente | Qué aporta | Licencia |
| --- | --- | --- |
| [CC-CEDICT](https://cc-cedict.org/) | 116.000 entradas con pinyin, definición inglesa y nivel HSK | CC BY-SA 4.0 |
| [jieba](https://github.com/fxsjy/jieba) | frecuencias y etiquetas morfosintácticas | MIT |
| [pypinyin](https://github.com/mozillazg/python-pinyin) | tablas de pinyin de caracteres y palabras | MIT |

El glosario español, las explicaciones gramaticales y el código son originales
de este repositorio. Al redistribuir hay que mantener la atribución de CC-CEDICT
y su licencia compartida.
