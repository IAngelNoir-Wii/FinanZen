# Guía: Cómo desplegar FinanZen en GitHub Pages

Para publicar tu aplicación en GitHub Pages de forma gratuita y accesible desde cualquier navegador, sigue estos sencillos pasos:

---

### Paso 1: Configuración en GitHub

1. Entra a tu repositorio en **GitHub**.
2. Ve a la pestaña **Settings** (Configuración) del repositorio.
3. En el menú lateral izquierdo, haz clic en **Pages**.
4. En la sección **Build and deployment**:
   - **Source**: Selecciona **GitHub Actions**.

*(¡Listo! No tienes que configurar ramas manuales `gh-pages`; el flujo de trabajo automático que hemos creado se encargará de todo).*

---

### Paso 2: Subir el código a GitHub

En tu terminal local o entorno de Git, ejecuta:

```bash
# 1. Agrega todos los archivos
git add .

# 2. Crea el commit
git commit -m "Configurar despliegue automático en GitHub Pages"

# 3. Sube los cambios a la rama principal (main o master)
git push origin main
```

---

### Paso 3: Visualizar tu aplicación

1. En tu repositorio de GitHub, ve a la pestaña **Actions**.
2. Verás el flujo de trabajo llamado **Deploy to GitHub Pages** ejecutándose. Tarda aproximadamente 1 minuto.
3. Una vez terminado con un visto verde (✅), en la misma pestaña o en **Settings -> Pages** verás tu enlace público:
   `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`

---

### ¿Cómo funciona el almacenamiento en GitHub Pages?
- **GitHub Pages es un alojamiento estático**: La aplicación funciona al 100% en el navegador utilizando **LocalStorage** (almacenamiento local seguro en tu dispositivo).
- **Copia de seguridad (Exportar / Importar)**:
  - En el pie de página de la aplicación encontrarás los botones **"Exportar copia"** e **"Importar copia"**.
  - Puedes descargar tu archivo JSON de respaldo en cualquier momento y transferirlo a otro celular, tableta o computador con un solo clic.

---

### Configuración técnica ya preparada en el código:
- **`vite.config.ts`**: Ya tiene configurado `base: './'` para que todos los scripts, estilos y fuentes carguen correctamente sin importar el nombre del repositorio o subcarpeta.
- **`.github/workflows/deploy.yml`**: Flujo automático que compila (`npm run build`) y publica la carpeta `dist/` en GitHub Pages en cada push.
