# Guía: Cómo desplegar FinanZen con Firebase en GitHub Pages

Tu aplicación ahora está conectada con **Firebase Auth (Google)** y **Cloud Firestore en tiempo real**, por lo que funciona directamente en GitHub Pages sin necesitar servidor propio y sincroniza tus datos en cualquier dispositivo.

---

### Paso 1: Autorizar tu dominio de GitHub Pages en Firebase

Para que el botón **"Continuar con Google"** funcione desde tu URL pública de GitHub Pages:

1. Entra a [Firebase Console](https://console.firebase.google.com/) y abre tu proyecto (`asymmetric-surfer-491ww`).
2. En el menú izquierdo ve a **Build** → **Authentication** → pestaña **Settings** → **Authorized domains**.
3. Haz clic en **Add domain** y agrega tu dominio de GitHub Pages (solo el host, sin `https://` ni rutas), por ejemplo:
   `iangelnoir-wii.github.io`
4. Guarda los cambios.

---

### Paso 2: Configuración de Pages en GitHub

1. Entra a tu repositorio en **GitHub**.
2. Ve a **Settings** → **Pages**.
3. En **Build and deployment** → **Source**, selecciona **GitHub Actions**.

---

### Paso 3: Subir el código actualizado a GitHub

Ejecuta en tu terminal:

```bash
git add .
git commit -m "Vincular Firebase Auth y Firestore en tiempo real"
git push origin main
```

1. En la pestaña **Actions** de GitHub verás el flujo **Deploy to GitHub Pages** ejecutarse automáticamente (~1 minuto).
2. Al finalizar en verde (✅), abre tu enlace público `https://<tu-usuario>.github.io/<repositorio>/` e inicia sesión con tu cuenta de correo de Google para ver y editar tus datos en tiempo real desde cualquier dispositivo.
