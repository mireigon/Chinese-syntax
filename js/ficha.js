/* La ficha de una palabra: pinyin, categoría, significado, nivel y notas.
 *
 * Vive aparte porque la usan dos sitios con el mismo aspecto: el analizador,
 * cuando tocas una palabra de la frase, y el dorso de las tarjetas de memoria.
 * Que sean literalmente lo mismo no es casualidad: lo que estudias en una
 * tarjeta tiene que ser idéntico a lo que te encuentras leyendo. */
window.Ficha = (function () {
  'use strict';

  function crear(etiqueta, clase, texto) {
    var n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  /* Convierte una palabra suelta del diccionario en un token como los que
   * produce el analizador, pasándola por el mismo análisis. Así hereda la
   * lectura correcta de los polifónicos, la categoría y el aviso de cambio de
   * tono, sin duplicar nada. */
  function tokenDePalabra(palabra) {
    var r = window.Analisis.analizar(palabra);
    for (var i = 0; i < r.tokens.length; i++) {
      if (r.tokens[i].tipo === 'hanzi') return r.tokens[i];
    }
    return null;
  }

  /**
   * Escribe la ficha dentro de un contenedor.
   * opciones.papel    muestra la función que cumple en la frase (sólo tiene
   *                   sentido dentro de un análisis, no en una tarjeta suelta)
   * opciones.sinHanzi omite el carácter, para cuando ya se ve en grande
   * opciones.marcas   construcciones a las que saltar, con su callback
   */
  function render(tk, destino, opciones) {
    opciones = opciones || {};
    destino.textContent = '';
    destino.classList.remove('detalle-vacio');
    if (!tk) return;

    var cab = crear('div', 'd-cabecera');
    if (!opciones.sinHanzi) cab.appendChild(crear('span', 'f-han', tk.texto));
    var bloque = crear('div', 'd-identidad');
    if (tk.py) bloque.appendChild(crear('div', 'f-py', tk.py));
    if (tk.categoria) bloque.appendChild(crear('div', 'f-cat', tk.categoria));
    cab.appendChild(bloque);
    if (tk.hsk) cab.appendChild(crear('span', 'etiqueta-hsk', 'HSK ' + tk.hsk));
    destino.appendChild(cab);

    var gl = window.Glosa.de(tk);
    if (gl.origen === 'glosario' || gl.origen === 'compuesta' || gl.origen === 'reduplicada') {
      destino.appendChild(crear('div', 'f-es', tk.es || gl.texto));
    }
    if (tk.en) destino.appendChild(crear('div', 'f-en', tk.en));
    if (!tk.es && !tk.en && tk.tipo === 'hanzi') {
      destino.appendChild(crear('div', 'f-es', 'Sin definición en el diccionario.'));
    }

    var extras = [];
    if (opciones.papel && tk.papel && window.Analisis.PAPELES[tk.papel] &&
        tk.papel !== 'otro' && tk.papel !== 'puntuacion') {
      extras.push('Función: ' + window.Analisis.PAPELES[tk.papel].nombre.toLowerCase() + '.');
    }
    if (tk.notaPy) extras.push(tk.notaPy.charAt(0).toUpperCase() + tk.notaPy.slice(1) + '.');
    if (tk.sandhi) extras.push('Se pronuncia «' + tk.sandhi.dicho + '»: ' + tk.sandhi.motivo);
    if (extras.length) destino.appendChild(crear('div', 'f-extra', extras.join(' ')));

    if (opciones.marcas && opciones.marcas.length) {
      var fila = crear('div', 'd-marcas');
      opciones.marcas.forEach(function (m) {
        var b = crear('button', 'chip', m.titulo);
        b.type = 'button';
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (opciones.alPulsarMarca) opciones.alPulsarMarca(m.id);
        });
        fila.appendChild(b);
      });
      destino.appendChild(fila);
    }
  }

  return { render: render, tokenDePalabra: tokenDePalabra, crear: crear };
})();
