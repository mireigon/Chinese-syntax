/* Service worker: deja la aplicación entera en el dispositivo.
 *
 * Todo lo que necesita —código, estilos y los nueve megas de diccionario— se
 * guarda en la caché la primera vez y a partir de ahí se sirve de ahí. Así
 * funciona sin conexión, que es como se suele leer en una tableta, y además
 * arranca mucho más rápido: el diccionario no vuelve a descargarse nunca.
 *
 * Al cambiar la versión se descarta la caché anterior entera. */
var VERSION = 'leerchino-v2';

var ESENCIALES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './js/lexico.js',
  './js/glosa.js',
  './js/pinyin.js',
  './js/segmentador.js',
  './js/etiquetas.js',
  './js/patrones.js',
  './js/construcciones.js',
  './js/construcciones-2.js',
  './js/construcciones-3.js',
  './js/analisis.js',
  './js/traduccion.js',
  './js/ficha.js',
  './js/ejemplos.js',
  './js/ui.js',
  './js/tarjetas.js',
  './js/ui-tarjetas.js',
  './data/mazos.js',
  './data/lexicon-core.js',
  './data/chars.js',
  './data/es-lexicon.js',
  './data/meta.js',
  './icono-192.png',
  './icono-512.png'
];

// El resto del diccionario pesa bastante: se guarda aparte, para que un fallo
// suyo no impida que la aplicación quede instalada y utilizable.
var OPCIONALES = ['./data/lexicon-ext.js'];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(ESENCIALES).then(function () {
        return Promise.all(OPCIONALES.map(function (u) {
          return cache.add(u).catch(function () { /* se reintenta al usarlo */ });
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.map(function (k) {
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  var peticion = evento.request;
  if (peticion.method !== 'GET') return;

  var url = new URL(peticion.url);
  // La traducción con IA tiene que salir a la red siempre.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then(function (guardada) {
      if (guardada) return guardada;
      return fetch(peticion).then(function (respuesta) {
        if (respuesta && respuesta.ok && respuesta.type === 'basic') {
          var copia = respuesta.clone();
          caches.open(VERSION).then(function (c) { c.put(peticion, copia); });
        }
        return respuesta;
      }).catch(function () {
        // Sin conexión y sin copia: si piden una página, se da la principal.
        if (peticion.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      });
    })
  );
});
