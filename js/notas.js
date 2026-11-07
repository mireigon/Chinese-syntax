/* Notas propias por carácter: por qué creo que se escribe y se pronuncia así.
 *
 * Publicada, la página guarda las notas en la base de datos del artifact
 * (colección «notas», un documento por carácter): se ven igual en el
 * ordenador y en el lector, y Claude puede leerlas después. Sin esa base
 * (abierta como fichero suelto, en el envoltorio de Android) se guardan sólo
 * en este navegador. Las rutas de la base no admiten caracteres chinos, así
 * que el id del documento es el punto de código: 好 -> «u597d». */
window.Notas = (function () {
  'use strict';

  var cache = new Map();          // carácter -> texto
  var oyentes = [];
  var db = null;
  var modo = 'local';             // 'local' | 'compartido'

  function idDe(ch) { return 'u' + ch.codePointAt(0).toString(16); }

  function leerLocal(ch) {
    try { return localStorage.getItem('leerchino.nota.' + ch) || ''; } catch (e) { return ''; }
  }
  function guardarLocal(ch, texto) {
    try {
      if (texto) localStorage.setItem('leerchino.nota.' + ch, texto);
      else localStorage.removeItem('leerchino.nota.' + ch);
    } catch (e) { /* modo privado */ }
  }

  function avisar(ch) { oyentes.forEach(function (fn) { fn(ch); }); }

  function leer(ch) {
    if (cache.has(ch)) return cache.get(ch);
    return modo === 'local' ? leerLocal(ch) : '';
  }

  /** Guarda (o borra, si queda vacía). Devuelve una promesa. */
  function guardar(ch, texto) {
    texto = (texto || '').replace(/\s+$/, '');
    cache.set(ch, texto);
    guardarLocal(ch, texto);
    if (!db) return Promise.resolve();
    var ref = db.collection('notas').doc(idDe(ch));
    var op = texto
      ? ref.set({ caracter: ch, texto: texto, actualizado: new Date().toISOString() })
      : ref.delete();
    return op.catch(function (err) {
      if (err && err.code === 'unavailable') {
        return new Promise(function (ok) { setTimeout(ok, 800 + Math.random() * 800); })
          .then(function () { return guardar(ch, texto); });
      }
      throw err;
    });
  }

  function alCambiar(fn) { oyentes.push(fn); }

  function iniciar() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('db').then(function (base) {
      if (!base) return;
      db = base;
      modo = 'compartido';
      db.collection('notas').onSnapshot(function (snap) {
        snap.docChanges().forEach(function (c) {
          var d = c.doc.data() || {};
          if (!d.caracter) return;
          var texto = c.type === 'removed' ? '' : (d.texto || '');
          if (cache.get(d.caracter) === texto) return;
          cache.set(d.caracter, texto);
          avisar(d.caracter);
        });
      }, function () { /* sin base: se sigue con lo que haya en memoria */ });
    }).catch(function () { /* sin base */ });
  }

  return {
    iniciar: iniciar,
    leer: leer,
    guardar: guardar,
    alCambiar: alCambiar,
    modo: function () { return modo; }
  };
})();
