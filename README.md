# Apex Concrete — Invoice & Payroll Manager

Aplicación web interna para **Apex Concrete**. Sincroniza facturas desde QuickBooks Online, calcula automáticamente el pago a instaladores por trabajo MONO SLAB y genera reportes exportables.

🔗 **Producción:** [apex-tau-ebon.vercel.app](https://apex-tau-ebon.vercel.app)

---

## Features

- **Sync con QuickBooks Online** — OAuth2, importa todas las facturas con un click
- **Cálculo automático de planilla** — Detecta líneas POUR MONO SLAB y calcula pago ($1.00/m²)
- **Reportes interactivos** — Resumen, Salarios, Por Cobrar, Ingresos, Margen
- **Export Excel + PDF** — Excel con 3 hojas y formatos de número; vista HTML para imprimir/PDF
- **Pagos externos** — Agrega gastos manuales o recurrentes (diario/semanal/mensual) a la planilla
- **Email automático** — Reporte diario/semanal/mensual por correo con Excel adjunto
- **Dark mode** — Toggle sol/luna, persiste en localStorage
- **Bilingüe** — Español / English, toggle en header
- **Filtros** — Por período, cliente, tipo de factura, estado de pago, fechas personalizadas

---

## Tech Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js 18 (ESModules), Express |
| Base de datos | MongoDB Atlas (Mongoose) |
| Email | Nodemailer (SMTP / Gmail) |
| Excel | SheetJS (xlsx) |
| Hosting Frontend | Vercel |
| Hosting Backend | Render |

---

## Estructura

```
Apex/
├── frontend/
│   └── src/
│       ├── api/index.js              # Cliente HTTP con retry automático
│       ├── context/
│       │   ├── LanguageContext.jsx   # i18n EN/ES
│       │   └── ThemeContext.jsx      # Dark/light mode
│       ├── components/Layout.jsx     # Header + nav
│       └── pages/
│           ├── ReportsPage.jsx       # Reportes + FAB export + pagos externos
│           ├── InvoicesPage.jsx      # Facturas con filtros
│           └── SettingsPage.jsx      # QBO connection + config de email
│
└── backend/
    └── src/
        ├── models/
        │   ├── Invoice.js            # Factura QBO
        │   ├── Collaborator.js       # Instalador
        │   ├── ExternalPayment.js    # Pagos manuales/recurrentes
        │   └── AppSettings.js        # Config singleton (emails, frecuencia)
        ├── routes/
        │   ├── qbo.js               # OAuth2 + sync
        │   ├── invoices.js          # CRUD + recalculate
        │   ├── reports.js           # Endpoints de reportes
        │   ├── payments.js          # Pagos externos
        │   └── appSettings.js       # Configuración
        ├── salary/salaryRules.js    # Lógica de cálculo ($1.00/m²)
        └── services/
            ├── emailService.js      # Reporte por correo
            └── cronJobs.js          # Scheduler (cada minuto)
```

---

## Setup local

### Backend

```bash
cd backend
npm install
cp .env.example .env   # Editar con tus credenciales
npm run dev
```

**Variables de entorno backend (`.env`):**

```env
MONGO_URI=mongodb+srv://...
QBO_CLIENT_ID=...
QBO_CLIENT_SECRET=...
QBO_REDIRECT_URI=http://localhost:3001/api/qbo/callback
FRONTEND_URL=http://localhost:5173

# Email (opcional — si no se pone, no envía reportes)
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

**Variables de entorno frontend (`.env`):**

```env
VITE_API_URL=http://localhost:3001
```

---

## Despliegue

### Backend → Render
1. New Web Service → conectar repo
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node src/index.js`
5. Agregar variables de entorno (ver arriba + `PORT` lo asigna Render automáticamente)

### Frontend → Vercel
1. Import repo → root directory: `frontend`
2. Build: `npm run build` / Output: `dist`
3. Variable de entorno: `VITE_API_URL=https://apex-w9h5.onrender.com`

---

## API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/qbo/status` | Estado de conexión QBO |
| GET | `/api/qbo/connect` | Iniciar OAuth (redirige a Intuit) |
| POST | `/api/qbo/sync` | Sincronizar facturas |
| POST | `/api/qbo/disconnect` | Desconectar QBO |
| GET | `/api/invoices` | Listar facturas (paginado + filtros) |
| PATCH | `/api/invoices/:id/collaborator` | Asignar instalador |
| POST | `/api/invoices/recalculate` | Recalcular campos MONO SLAB en todas |
| GET | `/api/reports/overview` | KPIs generales |
| GET | `/api/reports/salary` | Planilla por colaborador |
| GET | `/api/reports/receivables` | Cuentas por cobrar |
| GET | `/api/reports/revenue` | Ingresos mensuales |
| GET | `/api/reports/margin` | Margen por cliente |
| GET | `/api/reports/export` | JSON completo para Excel/PDF |
| GET | `/api/payments` | Pagos externos |
| POST | `/api/payments` | Crear pago externo |
| DELETE | `/api/payments/:id` | Eliminar pago externo |
| GET | `/api/settings` | Leer configuración |
| PATCH | `/api/settings` | Actualizar configuración |

---

## Regla de salario

```js
// Solo líneas que contengan "MONO SLAB" en productService O description
// (QBO a veces deja productService vacío y pone el nombre en description)
pay = monoSlabQty × $1.00
```

---

> Para contexto técnico detallado ver [`CONTEXT.md`](./CONTEXT.md)
