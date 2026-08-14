# App Links — cómo abre la app en vez del navegador

El archivo vive en `assets/.well-known/assetlinks.json`.

**Ojo con la carpeta**: la de este proyecto es `assets/`, no `public/` —
está así en `vite.config.js` (`publicDir: 'assets'`). Un archivo puesto en
`public/` no llega al despliegue, y el fallo es silencioso: Vercel devuelve el
`index.html` de la aplicación y Android descarta la verificación sin decir
nada.

Este archivo es lo que hace que un enlace `https://pos.amorycielo.com/...`
—en un correo, en WhatsApp, donde sea— **abra la app en vez del navegador**
cuando está instalada, y el navegador cuando no lo está. Es el mismo mecanismo
que usan Mercado Libre y compañía, y se llama App Links.

Android lo descarga al instalar la app, comprueba que el identificador y la
huella de firma coinciden con los del APK, y solo entonces le cede los enlaces
del dominio. No hay redirección de por medio: el enlace se intercepta antes de
que el navegador llegue a abrirlo.

## La huella corresponde al APK de depuración

La que está puesta sale del almacén de depuración de Android
(`~/.android/debug.keystore`), que es con el que se compilan los APK de prueba.

**El día que se firme una versión de release, la huella cambia y los enlaces
dejan de abrir la app** hasta que se añada la nueva aquí. El campo es una
lista precisamente para eso: se pueden tener las dos a la vez, y conviene
hacerlo así en vez de sustituir una por otra, para que los APK ya instalados
sigan funcionando.

Para sacar la huella de un almacén:

```
keytool -list -v -keystore RUTA_DEL_ALMACEN -alias EL_ALIAS
```

## Comprobar que funciona

El archivo tiene que responder en:

    https://pos.amorycielo.com/.well-known/assetlinks.json

Con `Content-Type: application/json` y sin redirecciones — Android rechaza la
verificación si hay un redirect de por medio.

Y en el teléfono, con la app instalada:

```
adb shell pm get-app-links com.amorycielo.pos
```

Debe decir `verified` para el dominio. Si dice `1024` o `legacy_failure`, la
verificación no pasó: casi siempre es que el archivo no se sirve como JSON, que
hay un redirect, o que la huella no coincide.
