# Reciclando Goles

Plataforma oficial de **Reciclando Goles**, preparada para manejar campañas semestrales en Firebase Hosting + Firestore.

- Produccion: `https://reciclando-goles.web.app`
- Repositorio: `https://github.com/ByteShark-dev/reciclando-goles-web`

## Arquitectura

- `public/`
  Frontend publico y panel admin.
- `functions/`
  Cloud Functions opcionales para agregados y automatizaciones si el proyecto migra a Blaze.
- `scripts/`
  Scripts operativos para sync manual, migración al esquema multi-campaña y bootstrap de admin.
- `firestore.rules`
  Reglas con lectura publica acotada y escrituras solo para admins autenticados.
- `storage.rules`
  Reglas para fotos de evidencias publicas, con lectura abierta y subida solo para admins.

## Modelo de datos

### Configuracion global

- `settings/activeCampaign`
  - `campaignId: string | null`
  - `updatedAt`
  - `updatedByUid`
  - `updatedByEmail`

### Campañas

- `campaigns/{campaignId}`
  - `name`
  - `semesterLabel`
  - `status: "draft" | "active" | "closed"`
  - `goalAmount`
  - `startAt`
  - `endAt`
  - `closedAt`
  - `teletonUrl`
  - `summary`
    - `totalAmount`
    - `physicalAmount`
    - `digitalAmount`
    - `recyclingAmount`
    - `donationCount`
  - `createdAt`
  - `updatedAt`
  - `createdByUid`
  - `createdByEmail`

- `campaigns/{campaignId}/donations/{donationId}`
  - `name`
  - `donorId`
  - `amount`
  - `sourceType: "physical" | "digital" | "recycling"`
  - `piggyBankId`
  - `enteredByUid`
  - `enteredByEmail`
  - `createdAt`

- `campaigns/{campaignId}/piggy_banks/{piggyBankId}`
  - `name`
  - `location`
  - `status: "active" | "inactive" | "retired"`
  - `accepts: string[]`
  - `notes`
  - `createdAt`
  - `updatedAt`

- `campaigns/{campaignId}/donor_totals/{donorId}`
  - `displayName`
  - `totalAmount`
  - `donationCount`
  - `lastDonationAt`

- `campaigns/{campaignId}/totals/global`
  - `physicalAmount`
  - `recyclingAmount`
  - `manualDigitalAmount`
  - `syncedDigitalAmount`
  - `digitalAmount`
  - `totalAmount`
  - `donationCount`
  - `syncStatus`
  - `syncError`
  - `syncSource`
  - `teletonUrl`
  - `lastSuccessfulSyncAt`
  - `updatedAt`

- `campaigns/{campaignId}/evidence/{evidenceId}`
  - `title`
  - `kind`
  - `publicUrl`
  - `assetType: "image" | "link"`
  - `storagePath`
  - `fileName`
  - `mimeType`
  - `description`
  - `amount`
  - `recordedAt`
  - `createdAt`

### Roles

- `user_roles/{uid}`
  - `role: "admin"`
  - `enabled: true | false`
  - `email`
  - `displayName`
  - `createdAt`
  - `updatedAt`

## Frontend publico

La home carga `settings/activeCampaign` y, si existe una campaña activa, escucha:

- `campaigns/{campaignId}`
- `campaigns/{campaignId}/totals/global`
- `campaigns/{campaignId}/piggy_banks`
- `campaigns/{campaignId}/donor_totals`
- `campaigns/{campaignId}/evidence`

Si no hay campaña activa, la home entra en modo institucional:

- mantiene hero, aliados e historial
- desactiva el contador operativo
- conserva visibles las campañas cerradas

El ranking publico sale solo de `donor_totals`. No depende de lecturas publicas de `donations`.

## Panel admin

El acceso productivo usa **Firebase Auth email/password** + rol en `user_roles/{uid}`.
En modo gratuito, el panel escribe directo a Firestore con reglas admin-only; no depende de Cloud Functions desplegadas.

El panel incluye:

- resumen de campaña
- registrar donación
- administrar alcancías
- administrar campaña activa
- cerrar campaña
- crear nueva campaña

El acceso por codigo de la version anterior queda solo como referencia de transicion. Ya no se usa para escrituras productivas.

## Backend

### Modo gratuito

- Admin login: Firebase Auth.
- Autorización: `user_roles/{uid}` en Firestore.
- Operaciones admin: escrituras directas desde frontend hacia `campaigns/*`, `donations`, `piggy_banks`, `evidence`, `donor_totals` y `totals/global`, protegidas por reglas.
- Sync de Teletón: `scripts/sync-teleton.mjs` ejecutado por GitHub Actions cada 30 minutos.
- Evidencias con foto: subida directa desde el panel admin a Firebase Storage y referencia guardada en Firestore.

### Cloud Functions opcionales

Las Functions siguen en el repo como ruta futura para Blaze, pero no son necesarias para operar el panel actual en Spark.

## Reglas de Firestore

Lectura publica:

- `settings/activeCampaign`
- `campaigns/*`
- `campaigns/*/piggy_banks/*`
- `campaigns/*/donor_totals/*`
- `campaigns/*/totals/*`
- `campaigns/*/evidence/*`

Escritura:

- solo admins autenticados en paths editables del panel
- `donations` de campaña: create admin-only
- `totals/global` y agregados: admin-only
- sin `update/delete` publico

Colecciones legacy de campaña unica quedan bloqueadas en reglas:

- `donations`
- `stats`
- `donor_totals`
- `campaign_sync`
- `admin_access_logs`

## Reglas de Storage

- lectura publica para `campaigns/{campaignId}/evidence/*`
- subida y borrado solo para admins autenticados
- solo imagenes
- limite por archivo: `8 MB`

## Desarrollo local

Instala dependencias:

```powershell
npm install
cd functions
npm install
cd ..
```

Levanta emuladores:

```powershell
firebase emulators:start --only hosting,firestore,auth,storage
```

Los emuladores quedan en:

- Hosting: `http://127.0.0.1:5000`
- Firestore: `127.0.0.1:8088`
- Auth: `127.0.0.1:9099`
- Storage: `127.0.0.1:9199`

## Activar Firebase Storage

La primera vez debes crear el bucket desde Firebase Console:

1. Abre `Build > Storage`.
2. Pulsa `Get started`.
3. Crea el bucket por defecto del proyecto.
4. Despliega reglas con `firebase deploy --only storage`.

Despues de eso, el panel admin ya puede subir fotos en `Evidencias publicas`.

## Bootstrap de admin

Provisiona un usuario admin real en Firebase Auth y su documento de rol:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw
$env:RECICLANDO_GOLES_ADMIN_EMAIL = "admin@reciclandogoles.mx"
$env:RECICLANDO_GOLES_ADMIN_PASSWORD = "CambiarEstaPassword123!"
$env:RECICLANDO_GOLES_ADMIN_DISPLAY_NAME = "Reciclando Goles Admin"
npm run bootstrap:admin
```

## Migración desde campaña única

Migra el esquema legacy a una primera campaña histórica cerrada sin borrar datos viejos:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw
npm run migrate:multicampaign
```

Variables opcionales:

- `RECICLANDO_GOLES_LEGACY_CAMPAIGN_ID`
- `RECICLANDO_GOLES_LEGACY_CAMPAIGN_NAME`
- `RECICLANDO_GOLES_LEGACY_SEMESTER_LABEL`
- `RECICLANDO_GOLES_LEGACY_EXCLUDED_DONATION_IDS`

Por defecto, la migracion excluye dos registros legacy que no deben contarse en el historico cerrado:

- `DUytYMokCS9hKxPbDucI` (`Reyka`, `3500 MXN`)
- `6tN4tqUDMQZoejigMeEO` (`Reciclaje`, `2769 MXN`)

La migracion:

- crea `campaigns/{legacyCampaignId}` con `status: "closed"`
- copia `donations` legacy a `campaigns/{legacyCampaignId}/donations`
- recalcula `donor_totals` desde las donaciones migradas
- mueve el monto de `campaign_sync/global` a `campaigns/{legacyCampaignId}/totals/global.syncedDigitalAmount`
- deja `settings/activeCampaign.campaignId = null`
- no elimina colecciones legacy

## Flujo operativo

### Reiniciar campaña

1. Cierra la campaña activa desde el panel admin o `adminCloseCampaign`.
2. Crea una nueva campaña en draft.
3. Activa la nueva campaña desde el panel admin.
4. Verifica que el contador público arranque en cero y que el historial conserve la campaña anterior.

### Registrar alcancías

1. Inicia sesión como admin.
2. Abre `Administrar alcancías`.
3. Crea o actualiza la alcancía.
4. Usa `status = active` para mostrarla públicamente.

### Cerrar campaña

1. Revisa resumen y evidencias.
2. Ejecuta `Cerrar campaña`.
3. Verifica que la home quede en modo institucional si aún no activas otra campaña.
4. Confirma que la campaña aparezca en `Historial de campañas`.

## Sync de Teletón

Prueba manual sin escribir:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw
npm run sync:teleton:dry
```

Escritura real:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw
npm run sync:teleton
```

GitHub Actions sigue usando `scripts/sync-teleton.mjs` y ahora sincroniza la **campaña activa**.

## Deploy

Deploy completo:

```powershell
firebase deploy --only hosting,firestore:rules,storage,functions
```

Solo frontend y reglas:

```powershell
firebase deploy --only hosting,firestore:rules,storage
```

Solo functions:

```powershell
firebase deploy --only functions
```
