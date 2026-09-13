#!/usr/bin/env bash
# Descarga las fuentes lingüísticas que necesita tools/build-data.py.
# Sólo hace falta si quieres regenerar data/*.js; el repositorio ya trae
# los ficheros generados, así que la aplicación funciona sin ejecutar esto.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p sources work
cd work

echo "==> CC-CEDICT + niveles HSK (paquete npm 'cedict', ISC / CC BY-SA 4.0)"
npm pack cedict@1.45.0 >/dev/null
tar xzf cedict-*.tgz
npm install protobufjs --no-save --silent
node -e '
const entries = require("./package/index.js");
const out = [];
for (const x of entries) {
  const s = x.simplified || x.traditional;
  if (!s || !/[一-鿿]/.test(s)) continue;
  const d = x.definitions && x.definitions[0];
  if (!d) continue;
  out.push({ s, t: x.traditional, py: d.pinyin,
             en: x.definitions.flatMap(z => z.translations).slice(0, 4),
             hsk: x.hsk || 0 });
}
require("fs").writeFileSync("../sources/cedict.json", JSON.stringify(out));
console.error("   " + out.length + " entradas");
'
cp package/hsk.json ../sources/hsk.json

echo "==> jieba (MIT): diccionario de frecuencias y etiquetas POS"
pip3 download jieba==0.42.1 -d . --no-deps -q
tar xzf jieba-0.42.1.tar.gz
cp jieba-0.42.1/jieba/dict.txt ../sources/jieba-dict.txt

echo "==> pypinyin (MIT): tablas de pinyin"
pip3 download pypinyin -d . --no-deps -q
unzip -oq pypinyin-*.whl
cp pypinyin/pinyin_dict.json pypinyin/phrases_dict.json ../sources/

cd ..
rm -rf work
echo "==> Listo. Ahora: python3 tools/build-data.py"
