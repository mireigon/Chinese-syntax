package es.leerchino.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Envoltorio de la aplicación web.
 *
 * Toda la lógica vive en los ficheros de assets/www: esta clase sólo abre un
 * WebView a pantalla completa y lo configura para una tableta de tinta
 * electrónica. Como el diccionario viaja dentro del APK, la aplicación
 * funciona entera sin conexión.
 */
public class MainActivity extends Activity {

    /** El parámetro enciende el modo tinta la primera vez; luego manda lo que elija el usuario. */
    private static final String INICIO = "file:///android_asset/www/index.html?tinta=1";

    private WebView web;

    @Override
    protected void onCreate(Bundle estadoGuardado) {
        super.onCreate(estadoGuardado);

        web = new WebView(this);
        web.setBackgroundColor(0xFFFFFFFF);

        // El rebote al llegar al final del scroll es una animación: en tinta
        // electrónica sólo sirve para dejar fantasmas.
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        // localStorage, que es donde se guardan el texto y las preferencias.
        ajustes.setDomStorageEnabled(true);
        // A partir de Android 11 el acceso a file:// viene desactivado y los
        // ficheros del propio APK dejarían de cargarse.
        ajustes.setAllowFileAccess(true);
        ajustes.setAllowFileAccessFromFileURLs(true);
        ajustes.setAllowUniversalAccessFromFileURLs(true);
        // Pellizcar para acercar ayuda a distinguir trazos de caracteres poco
        // frecuentes; los botones de zoom encima del texto, en cambio, estorban.
        ajustes.setSupportZoom(true);
        ajustes.setBuiltInZoomControls(true);
        ajustes.setDisplayZoomControls(false);
        ajustes.setUseWideViewPort(false);
        ajustes.setLoadWithOverviewMode(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView vista, String url) {
                // Lo de dentro del APK se abre aquí; un enlace a internet, fuera.
                if (url == null || url.startsWith("file://")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    return false;
                }
                return true;
            }
        });

        setContentView(web);

        if (estadoGuardado != null) {
            web.restoreState(estadoGuardado);
        } else {
            web.loadUrl(INICIO);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    /** El botón de atrás navega dentro de la aplicación antes de salir de ella. */
    @Override
    public boolean onKeyDown(int codigo, KeyEvent evento) {
        if (codigo == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(codigo, evento);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
}
