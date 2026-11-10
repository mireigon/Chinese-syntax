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

# La versión sale del propio git, para que no se pueda olvidar subirla: el
# versionCode es el número de commits (siempre crece, que es lo que Android
# exige para dejar actualizar) y el nombre lleva el commit, para poder mirar
# dentro de la aplicación qué build estás usando.
VERSION_CODE="$(git -C "$RAIZ" rev-list --count HEAD 2>/dev/null || echo 1)"
COMMIT="$(git -C "$RAIZ" rev-parse --short HEAD 2>/dev/null || echo '?')"
# El propio APK queda modificado en cada build: no cuenta como cambio suelto.
SUCIO=""
git -C "$RAIZ" diff --quiet -- . ':(exclude)android/leer-chino.apk' 2>/dev/null || SUCIO="+"
VERSION_NAME="1.${VERSION_CODE} (${COMMIT}${SUCIO})"
echo "==> Versión ${VERSION_NAME}, código ${VERSION_CODE}"

# Si algo falla a mitad, el APK anterior sigue en disco y es facilísimo
# enviarlo creyendo que es el recién hecho. Se borra antes de empezar.
rm -f "$SALIDA"

echo "==> Preparando los assets (la aplicación web entera)"
rm -rf "$TRABAJO"
mkdir -p "$TRABAJO/assets/www"
cp "$RAIZ/index.html" "$TRABAJO/assets/www/"
cp -r "$RAIZ/css" "$RAIZ/js" "$RAIZ/data" "$TRABAJO/assets/www/"
# El service worker sólo sirve en la web: aquí los ficheros ya están dentro.
rm -f "$TRABAJO/assets/www/sw.js"
# Sello de versión: la aplicación lo enseña en el pie, para saber de un
# vistazo qué build se está usando.
printf 'window.LEERCHINO_VERSION = "%s";\n' "$VERSION_NAME" > "$TRABAJO/assets/www/data/version.js"

# La versión se sustituye sobre una copia del manifiesto. Las banderas
# --version-code/--version-name de aapt no reemplazan lo que ya trae el
# manifiesto (ni con --replace-version, en esta versión de la herramienta).
MANIFIESTO="$TRABAJO/AndroidManifest.xml"
sed -e "s/android:versionCode=\"[^\"]*\"/android:versionCode=\"$VERSION_CODE\"/" \
    -e "s/android:versionName=\"[^\"]*\"/android:versionName=\"$VERSION_NAME\"/" \
    "$AQUI/AndroidManifest.xml" > "$MANIFIESTO"
echo "    $(find "$TRABAJO/assets/www" -type f | wc -l) ficheros, $(du -sh "$TRABAJO/assets/www" | cut -f1)"

echo "==> Compilando recursos y manifiesto (aapt)"
mkdir -p "$TRABAJO/gen"
# -0 js deja el diccionario sin comprimir: así el WebView lo lee directamente
# del APK, sin el límite de tamaño que tienen los assets comprimidos.
aapt package -f \
  -M "$MANIFIESTO" \
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

# Comprobación final: que lo que ha salido es de verdad esta versión. Sin
# esto, un fallo silencioso a mitad pasa desapercibido hasta que alguien
# instala el APK y echa en falta lo que acabas de añadir.
CODIGO_REAL="$(aapt dump badging "$SALIDA" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")"
if [ "$CODIGO_REAL" != "$VERSION_CODE" ]; then
  echo "ERROR: el APK dice versionCode=$CODIGO_REAL y esperábamos $VERSION_CODE." >&2
  exit 1
fi
for necesario in data/mazos.js data/hanzi.js js/tarjetas.js js/hanzi.js js/notas.js; do
  if ! unzip -l "$SALIDA" "assets/www/$necesario" >/dev/null 2>&1; then
    echo "ERROR: falta assets/www/$necesario dentro del APK." >&2
    exit 1
  fi
done

rm -rf "$TRABAJO"

# Copia con la versión en el nombre. Los navegadores no sobrescriben las
# descargas, las renombran («leer-chino (1).apk»), así que un nombre fijo
# acaba sirviendo para instalar siempre el mismo fichero viejo sin notarlo.
ETIQUETADO="$AQUI/leer-chino-${VERSION_NAME%% *}.apk"
rm -f "$AQUI"/leer-chino-*.apk
cp "$SALIDA" "$ETIQUETADO"

echo
echo "Listo: $SALIDA"
echo "       $ETIQUETADO  ($(du -h "$SALIDA" | cut -f1))"
