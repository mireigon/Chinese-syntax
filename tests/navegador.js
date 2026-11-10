/* Pruebas de interacción en un navegador de verdad.
 *
 * tests/comprobar.js cubre el motor, pero corre sin DOM y por eso no ve los
 * fallos de interfaz. Este fija los que ya han aparecido una vez: que al
 * responder una tarjeta la siguiente salga tapada (los botones viven dentro
 * de la tarjeta, y su clic subía hasta el manejador que destapa), y que el
 * resaltado cruzado del analizador responda al toque.
 *
 *   npm i playwright            (o PLAYWRIGHT=/ruta/a/node_modules/playwright)
 *   node tests/navegador.js     (levanta él mismo el servidor)
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var RAIZ = path.join(__dirname, '..');
var PUERTO = +(process.env.PUERTO || 8799);

var TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

// El sello de versión lo escribe la build (android/construir.sh), no el
// repositorio, así que aquí se sirve uno de mentira para poder comprobar que
// la cabecera lo enseña.
var VERSION_PRUEBA = '9.9 (prueba)';

function servidor() {
  return http.createServer(function (req, res) {
    var rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    if (rel === '/data/version.js') {
      res.writeHead(200, { 'content-type': TIPOS['.js'] });
      res.end('window.LEERCHINO_VERSION = "' + VERSION_PRUEBA + '";\n');
      return;
    }
    var fichero = path.join(RAIZ, rel);
    if (fichero.indexOf(RAIZ) !== 0 || !fs.existsSync(fichero)) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(fichero)] || 'application/octet-stream' });
    fs.createReadStream(fichero).pipe(res);
  });
}

function cargarPlaywright() {
  var rutas = [process.env.PLAYWRIGHT, 'playwright',
               path.join(RAIZ, 'node_modules', 'playwright')].filter(Boolean);
  for (var i = 0; i < rutas.length; i++) {
    try { return require(rutas[i]); } catch (e) { /* siguiente */ }
  }
  return null;
}

function navegador() {
  // En el contenedor de pruebas Chromium ya viene instalado.
  var base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  var encontrado;
  fs.readdirSync(base).forEach(function (d) {
    ['chrome-linux64/chrome', 'chrome-linux/chrome'].forEach(function (sub) {
      var p = path.join(base, d, sub);
      if (!encontrado && fs.existsSync(p)) encontrado = p;
    });
  });
  return encontrado;
}

var fallos = 0, pruebas = 0;
function comprobar(que, condicion, detalle) {
  pruebas++;
  if (condicion) return;
  fallos++;
  console.error('FALLA  ' + que + (detalle ? '\n       ' + detalle : ''));
}

(function () {
  var pw = cargarPlaywright();
  if (!pw) {
    console.log('(playwright no está instalado: se omiten las pruebas de navegador)');
    return;
  }
  var srv = servidor();
  srv.listen(PUERTO, function () {
    ejecutar(pw).catch(function (e) {
      console.error('error:', e.message); fallos++;
    }).then(function () {
      srv.close();
      console.log((pruebas - fallos) + '/' + pruebas + ' comprobaciones de navegador correctas');
      if (fallos) process.exit(1);
    });
  });
})();

async function ejecutar(pw) {
  var navegadorRuta = navegador();
  var browser = await pw.chromium.launch(navegadorRuta ? { executablePath: navegadorRuta } : {});
  var ctx = await browser.newContext({
    viewport: { width: 820, height: 1040 }, hasTouch: true, isMobile: true
  });
  var page = await ctx.newPage();
  var errores = [];
  page.on('pageerror', function (e) { errores.push(e.message); });

  await page.goto('http://localhost:' + PUERTO + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.evaluate(function () {
    try { localStorage.clear(); } catch (e) { /* bloqueado */ }
  });

  /* ----------------------------- versión ------------------------------ */

  // Sin esto no hay forma de saber desde la tableta qué build está instalada,
  // y es facilísimo instalar una descarga vieja creyendo que es la nueva.
  var sello = await page.evaluate(function () {
    var c = document.querySelector('#version-cabecera');
    return {
      cabecera: c ? c.textContent : null,
      visible: !!(c && c.getBoundingClientRect().width > 0),
      pie: (document.querySelector('#version-app') || {}).textContent
    };
  });
  comprobar('la cabecera enseña la versión', sello.cabecera === 'v' + VERSION_PRUEBA && sello.visible,
    JSON.stringify(sello));
  comprobar('el pie también la enseña', sello.pie === 'versión ' + VERSION_PRUEBA, sello.pie);

  /* ---------------------------- analizador ---------------------------- */

  await page.fill('#entrada', '他把手机忘在出租车上了。');
  await page.waitForTimeout(700);
  comprobar('el texto se segmenta en palabras',
    (await page.evaluate(function () { return document.querySelectorAll('.palabra').length; })) > 5);

  await page.tap('.palabra:nth-of-type(3)');
  await page.waitForTimeout(350);
  var trasTocar = await page.evaluate(function () {
    return {
      activos: document.querySelectorAll('.activa').length,
      ficha: !document.querySelector('#detalle').classList.contains('detalle-vacio')
    };
  });
  comprobar('tocar una palabra la resalta en los dos paneles', trasTocar.activos >= 2,
    'resaltados: ' + trasTocar.activos);
  comprobar('tocar una palabra escribe su ficha', trasTocar.ficha);

  /* ----------------------------- tarjetas ----------------------------- */

  await page.tap('.modo[data-modo="tarjetas"]');
  await page.waitForTimeout(400);
  comprobar('la pestaña de tarjetas lista los mazos',
    (await page.evaluate(function () { return document.querySelectorAll('.mazo').length; })) >= 28);

  await page.tap('.mazo .boton');
  await page.waitForTimeout(400);

  function estado() {
    return page.evaluate(function () {
      return {
        palabra: document.querySelector('#frente').textContent,
        tapada: document.querySelector('#dorso').classList.contains('oculta'),
        mostrar: !document.querySelector('#acciones-tarjeta').classList.contains('oculta')
      };
    });
  }

  var antes = await estado();
  comprobar('la tarjeta empieza tapada', antes.tapada && antes.mostrar);

  function bloqueCaracteres() {
    return page.evaluate(function () {
      var z = document.querySelector('#dorso .dorso-chars');
      return {
        visible: !!(z && z.getBoundingClientRect().height > 0),
        subs: z ? Array.prototype.map.call(z.querySelectorAll('.d-sub'), function (n) {
          return n.textContent;
        }) : []
      };
    });
  }
  comprobar('el bloque de caracteres no se ve antes de destapar', !(await bloqueCaracteres()).visible);

  await page.tap('#tarjeta');
  await page.waitForTimeout(300);
  comprobar('tocar la tarjeta la destapa', !(await estado()).tapada);

  // Lo que enseña el analizador al tocar un carácter tiene que estar también
  // en el dorso: hubo un tiempo en que sólo vivía en el analizador.
  var bloque = await bloqueCaracteres();
  comprobar('al destapar sale el bloque de caracteres con su nota',
    bloque.visible && bloque.subs.indexOf('Mi nota') >= 0 &&
    bloque.subs.some(function (t) { return /^Palabras con /.test(t); }),
    JSON.stringify(bloque.subs));

  var dentro = await page.evaluate(function () {
    return document.querySelector('#dorso').contains(document.querySelector('#respuestas'));
  });
  comprobar('los botones de respuesta están dentro de la tarjeta', dentro);

  var orden = await page.evaluate(function () {
    return Array.prototype.map.call(document.querySelector('#dorso').children, function (c) {
      return c.id || c.className.split(' ')[0];
    });
  });
  comprobar('los botones van justo después de la definición',
    orden.indexOf('respuestas') > orden.indexOf('f-es') &&
    orden.indexOf('respuestas') < orden.lastIndexOf('dorso-seccion'),
    'orden: ' + orden.join(', '));

  // El fallo que motivó esta prueba: el clic en un botón subía hasta el
  // manejador de la tarjeta y destapaba la siguiente nada más aparecer.
  var malas = 0;
  for (var i = 0; i < 6; i++) {
    await page.tap('.respuesta.r-' + (i % 4));
    await page.waitForTimeout(280);
    var e = await estado();
    if (!(e.tapada && e.mostrar)) malas++;
    if (e.tapada) { await page.tap('#tarjeta'); await page.waitForTimeout(220); }
  }
  if ((await estado()).tapada) { await page.tap('#tarjeta'); await page.waitForTimeout(220); }
  await page.tap('.respuesta.r-2');
  await page.waitForTimeout(280);
  comprobar('tras responder, el bloque de caracteres vuelve a ocultarse',
    (await estado()).tapada && !(await bloqueCaracteres()).visible);
  comprobar('tras responder, la siguiente tarjeta sale tapada', malas === 0,
    malas + ' de 6 salieron destapadas');

  // El teclado hace lo mismo.
  await page.keyboard.press('3');
  await page.waitForTimeout(280);
  comprobar('responder con el teclado también tapa la siguiente', (await estado()).tapada);
  await page.keyboard.press(' ');
  await page.waitForTimeout(280);
  comprobar('el espacio destapa', !(await estado()).tapada);

  comprobar('no hay errores de JavaScript', errores.length === 0, errores.join(' | '));
  await browser.close();
}
