# Reciclando Goles x Teletón

Sitio web de la campaña **Reciclando Goles x Teletón**, publicado en Firebase Hosting:

- Producción: `https://reciclando-goles.web.app`
- Donación oficial Teletón: `https://www.alcanciadigitalteleton.mx/pagos/0/12689/reciclando-goles-toros-para-el-teletn.html`

## Qué incluye

- Landing pública en `public/`
- Firebase Hosting
- Firestore para donaciones, ranking y sincronización de montos
- Panel admin por código para registrar donaciones presenciales
- Integración visual con la página oficial de Teletón
- Automatización por GitHub Actions para sincronizar el monto digital de Teletón

## Estructura

- `public/`: sitio público
- `functions/`: backend Firebase Functions
- `scripts/sync-teleton.mjs`: sincronización del monto Teletón hacia Firestore
- `.github/workflows/sync-teleton.yml`: tarea programada en GitHub Actions

## Desarrollo local

```powershell
npm install
cd functions
npm install
cd ..
firebase emulators:start --only hosting,firestore,functions
```

## Deploy

```powershell
firebase deploy --only hosting,firestore:rules
```

## Automatización por GitHub Actions

El workflow `.github/workflows/sync-teleton.yml` consulta la página oficial de Teletón cada 30 minutos y actualiza:

- `campaign_sync/global.externalTeletonAmount`

### Secret requerido en GitHub

Configura este secret en el repositorio:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Debe contener el JSON completo de una cuenta de servicio con permisos de lectura y escritura en Firestore para el proyecto `reciclando-goles`.

## Script manual de prueba

Prueba local sin escribir en Firestore:

```powershell
node scripts/sync-teleton.mjs --dry-run
```

Ejecuta escritura real usando la credencial en entorno:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw
node scripts/sync-teleton.mjs
```

