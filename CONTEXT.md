# Apex Concrete — Project Context

> Documento de referencia para sesiones de desarrollo futuras.
> Última actualización: Abril 2026

---

## ¿Qué es esto?

**Apex** es una aplicación web interna para **Apex Concrete**, empresa de instalación de pisos de concreto. Reemplaza un proceso manual en el que la contadora descargaba facturas de QuickBooks Online y calculaba a mano el salario de los instaladores.

La app hace tres cosas clave:
1. **Sincroniza** facturas desde QuickBooks Online vía su API OAuth2
2. **Calcula** automáticamente el pago a los instaladores (trabajo MONO SLAB = $1.00 por m²)
3. **Genera reportes** de ingresos, márgenes, cuentas por cobrar y planilla — exportables a Excel o PDF

---

## Stack Técnico

| Capa | Tecnología | Hosting |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Vercel |
| Backend | Node.js 18 (ESModules) + Express | Render (free tier) |
| Base de datos | MongoDB Atlas | Atlas free tier |
| Auth QBO | OAuth2 Authorization Code Flow | — |

**URLs de producción:**
- Frontend: `https://apex-tau-ebon.vercel.app`
- Backend: `https://apex-w9h5.onrender.com`

---

## Estructura de carpetas

```
Apex/
├── frontend/
│   └── src/
│       ├── api/index.js          ← Toda la comunicación con el backend
│       ├── context/
│       │   ├── LanguageContext.jsx   ← i18n EN/ES, toggle en header
│       │   └── ThemeContext.jsx      ← Dark/light mode, persiste en localStorage
│       ├── components/
│       │   └── Layout.jsx        ← Header, nav mobile/desktop, toggles
│       └── pages/
│           ├── ReportsPage.jsx   ← Página principal: tabs + FAB export + pagos externos
│           ├── InvoicesPage.jsx  ← Lista de facturas con filtros colapsables
│           └── SettingsPage.jsx  ← Tabs: Conexiones (QBO) / General (email/frecuencia)
└── backend/
    └── src/
        ├── models/
        │   ├── Invoice.js            ← Factura QBO
        │   ├── Collaborator.js       ← Instalador (nombre, color)
        │   ├── ExternalPayment.js    ← Pagos manuales/recurrentes en planilla
        │   └── AppSettings.js        ← Singleton de configuración (emails, frecuencia)
        ├── routes/
        │   ├── qbo.js           ← OAuth2 connect/callback/sync/disconnect
        │   ├── invoices.js      ← CRUD + /recalculate
        │   ├── reports.js       ← overview/salary/receivables/revenue/margin/export
        │   ├── payments.js      ← Pagos externos CRUD
        │   └── appSettings.js   ← GET/PATCH configuración
        ├── salary/
        │   └── salaryRules.js   ← Lógica de cálculo de pago
        └── services/
            ├── emailService.js  ← Nodemailer: reporte HTML + Excel adjunto
            └── cronJobs.js      ← Scheduler propio (cada minuto), sin dependencias externas
```

---

## Modelo de datos clave

### Invoice
```js
{
  qboId: String,          // ID único de QBO (idempotency key para upsert)
  docNumber: String,      // Número de factura visible
  customerName: String,
  billingCompany: String,
  txnDate: Date,
  dueDate: Date,
  totalAmount: Number,
  balance: Number,        // Saldo pendiente (0 = pagado)
  estado: String,         // "Draft", "Posted", etc.
  lineItems: [{
    productService: String,  // Nombre del item (puede ser vacío en QBO)
    description: String,     // IMPORTANTE: QBO pone el nombre real aquí cuando está vacío arriba
    qty: Number,
    rate: Number,
    amount: Number,
  }],
  hasMonoSlab: Boolean,       // Calculado: ¿tiene líneas POUR MONO SLAB?
  monoSlabQty: Number,        // Total m² MONO SLAB
  collaboratorPay: Number,    // monoSlabQty × $1.00
  collaborator: ObjectId,     // Referencia a Collaborator (asignado manualmente)
  collaboratorRaw: String,    // Texto raw del campo "Memo" de QBO
}
```

### Regla de salario crítica
```js
// salaryRules.js
function isMonoSlab(lineItem) {
  const text = [lineItem.productService, lineItem.description]
    .filter(Boolean).join(' ').toUpperCase();
  return text.includes('MONO SLAB');
}
// Pay: monoSlabQty × $1.00 por m²
```

> **Gotcha importante:** QBO frecuentemente deja `ItemRef.Name` vacío y pone el nombre real del producto en `Description`. Por eso `isMonoSlab` revisa AMBOS campos. Esto afectó 328 facturas históricas — la detección solo en `productService` daba $0.

### AppSettings (singleton)
```js
{
  _id: 'singleton',
  reportEmails: [String],          // Destinatarios del reporte automático
  reportFrequency: 'daily' | 'weekly' | 'monthly',
  reportHour: Number,              // Hora de envío (0-23)
  reportDayOfWeek: Number,         // Para weekly (0=Dom, 1=Lun...)
  reportDayOfMonth: Number,        // Para monthly (1-31)
}
```

### ExternalPayment
```js
{
  name: String,
  amount: Number,
  isRecurring: Boolean,
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly',
    dayOfWeek: Number,
    dayOfMonth: Number,   // Inferido del día de creación
    hour: Number,
  },
  startDate: Date,
  active: Boolean,
}
```

---

## Flujo de QuickBooks Online

```
Usuario → /settings (Conexiones) → "Conectar QBO"
  → GET /api/qbo/connect → redirige a Intuit OAuth
  → Intuit → GET /api/qbo/callback?code=...&realmId=...
  → Backend intercambia code por tokens (access + refresh)
  → Guarda tokens en MongoDB
  → Redirige a /settings?qbo=connected

POST /api/qbo/sync:
  → Lee tokens de DB, refresca si el access_token expiró
  → Llama GET /v3/company/{realmId}/query?query=SELECT * FROM Invoice
  → Paginación: sigue leyendo mientras haya más
  → Para cada Invoice: mapea líneas, detecta MONO SLAB, calcula pay
  → Upsert en MongoDB por qboId
```

**Credenciales necesarias en Render (env vars):**
```
QBO_CLIENT_ID=...
QBO_CLIENT_SECRET=...
QBO_REDIRECT_URI=https://apex-w9h5.onrender.com/api/qbo/callback
MONGO_URI=mongodb+srv://...
FRONTEND_URL=https://apex-tau-ebon.vercel.app
```

---

## Reportes disponibles

| Tab | Endpoint | Qué muestra |
|---|---|---|
| Resumen | `/api/reports/overview` | KPIs: facturado, cobrado, por cobrar, costo collab, margen |
| Salarios | `/api/reports/salary` | Pago por colaborador + pagos externos + detalle por factura |
| Por Cobrar | `/api/reports/receivables` | Clientes con saldo pendiente |
| Ingresos | `/api/reports/revenue` | Tabla mensual de facturado/cobrado/pendiente |
| Margen | `/api/reports/margin` | Margen bruto por cliente |

**Exportación:**
- `GET /api/reports/export` — devuelve JSON con `{period, resumen, salaries[], invoices[]}`
- Frontend genera Excel (SheetJS/xlsx, 3 hojas) o abre vista HTML para imprimir/PDF

---

## Email automático

- `emailService.js` usa **nodemailer** con SMTP configurable
- Envía el reporte del día anterior en HTML + Excel adjunto
- `cronJobs.js` hace tick cada minuto y dispara según frecuencia en AppSettings
- **Config desde el frontend:** `/settings → General` (agregar emails + seleccionar frecuencia/hora)

**Variables de entorno para email (Render):**
```
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   ← App Password de Google (no la contraseña normal)
```
Si `SMTP_*` no están configuradas, el cron simplemente no envía — no rompe nada.

---

## Cold-start de Render

Render free tier apaga el servidor tras ~15 min sin tráfico. El primer request falla con "CORS error" (en realidad es que no hay servidor todavía).

**Solución implementada en `api/index.js`:**
- `fetchApi` reintenta hasta 3 veces (delays: 4s, 8s) en errores de red
- Keep-alive ping a `/api/health` cada 4 minutos mientras el tab esté visible
- Ping inicial al cargar la app para despertar el servidor temprano

---

## UI / Frontend

- **Dark mode:** clase `dark` en `<html>`, toggle sol/luna en header, persiste en `localStorage`
- **i18n:** contexto EN/ES, toggle con ícono de translate en header, persiste en `localStorage`
- **FAB de export:** botón flotante bottom-right, ícono de descarga, se expande con X al abrirse
- **Filtros:** colapsables en InvoicesPage (botón "Filtros" se pone naranja cuando hay filtros activos)
- **Mobile:** bottom nav con Reports, Invoices, Settings; FAB sube por encima del nav móvil
- **Tailwind colors:** `primary-*` (naranja), `steel-*` (azul oscuro), `concrete-*` (gris claro)

---

## Lo que NO está implementado aún

- Auto-sync diario de QBO sin intervención del usuario (el cron solo manda email, el sync QBO es manual desde Settings)
- Las frecuencias de `ExternalPayment.schedule` están guardadas en DB pero el `cronJobs.js` actual no las ejecuta automáticamente (solo dispara el email)
