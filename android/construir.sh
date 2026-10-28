#!/usr/bin/env bash
#
# Construye leer-chino.apk sin el SDK de Android.
#
# El SDK completo no hace falta: las piezas sueltas están en el archivo de
# Ubuntu (aapt, zipalign, apksigner) y en Maven Central (los stubs de android
# para compilar, y dx para convertir el bytecode a dex).
#
#   Dependencias:  apt install aapt zipalign apksigner   +   un JDK
#   Uso:           android/construir.sh
#   Resultado:     android/leer-chino.apk
#
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(dirname "$AQUI")"
LIBS="$AQUI/libs"
TRABAJO="$AQUI/.trabajo"
SALIDA="$AQUI/leer-chino.apk"
LLAVE="$AQUI/llave-depuracion.jks"

ANDROID_JAR_URL="https://repo1.maven.org/maven2/com/google/android/android/4.1.1.4/android-4.1.1.4.jar"
DX_URL="https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar"

for cmd in aapt zipalign apksigner javac java keytool; do
  command -v "$cmd" >/dev/null || { echo "Falta '$cmd'. Instala: apt install aapt zipalign apksigner default-jdk" >&2; exit 1; }
done

echo "==> Descargando lo que falte"
mkdir -p "$LIBS"
[ -f "$LIBS/android.jar" ] || curl -sSL --retry 3 -o "$LIBS/android.jar" "$ANDROID_JAR_URL"
[ -f "$LIBS/dx.jar" ]      || curl -sSL --retry 3 -o "$LIBS/dx.jar" "$DX_URL"

echo "==> Preparando los assets (la aplicación web entera)"
rm -rf "$TRABAJO"
mkdir -p "$TRABAJO/assets/www"
cp "$RAIZ/index.html" "$TRABAJO/assets/www/"
cp -r "$RAIZ/css" "$RAIZ/js" "$RAIZ/data" "$TRABAJO/assets/www/"
# El service worker sólo sirve en la web: aquí los ficheros ya están dentro.
rm -f "$TRABAJO/assets/www/sw.js"
echo "    $(find "$TRABAJO/assets/www" -type f | wc -l) ficheros, $(du -sh "$TRABAJO/assets/www" | cut -f1)"

echo "==> Compilando recursos y manifiesto (aapt)"
mkdir -p "$TRABAJO/gen"
# -0 js deja el diccionario sin comprimir: así el WebView lo lee directamente
# del APK, sin el límite de tamaño que tienen los assets comprimidos.
aapt package -f \
  -M "$AQUI/AndroidManifest.xml" \
  -S "$AQUI/res" \
  -A "$TRABAJO/assets" \
  -I "$LIBS/android.jar" \
  -J "$TRABAJO/gen" \
  -F "$TRABAJO/base.apk" \
  -0 js

echo "==> Compilando el código java"
mkdir -p "$TRABAJO/clases"
javac --release 8 -nowarn \
  -classpath "$LIBS/android.jar" \
  -d "$TRABAJO/clases" \
  $(find "$AQUI/java" "$TRABAJO/gen" -name '*.java') 2>&1 | grep -v "^Note:" || true

echo "==> Convirtiendo a dex"
java -cp "$LIBS/dx.jar" com.android.dx.command.Main \
  --dex --min-sdk-version=21 \
  --output="$TRABAJO/classes.dex" "$TRABAJO/clases"

echo "==> Montando el APK"
( cd "$TRABAJO" && aapt add -f base.apk classes.dex >/dev/null )
zipalign -f 4 "$TRABAJO/base.apk" "$TRABAJO/alineado.apk"

if [ ! -f "$LLAVE" ]; then
  echo "==> Creando la llave de firma"
  # Llave de depuración, con la contraseña estándar de Android. No es un
  # secreto: su único cometido es que el sistema acepte instalar el APK y que
  # las actualizaciones se reconozcan como de la misma aplicación.
  keytool -genkeypair -v -keystore "$LLAVE" \
    -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Leer chino (depuración), OU=, O=, L=, S=, C=ES" >/dev/null 2>&1
fi

echo "==> Firmando"
apksigner sign \
  --ks "$LLAVE" --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$SALIDA" "$TRABAJO/alineado.apk"

apksigner verify --print-certs "$SALIDA" | head -3
rm -rf "$TRABAJO"
echo
echo "Listo: $SALIDA  ($(du -h "$SALIDA" | cut -f1))"
