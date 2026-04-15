# Supply Pro Task Manager

A full-stack web application for managing Supply Pro orders with a Joober-style calendar dashboard.

## Features

- **Automated Order Scraping**: Playwright-based scraper fetches orders from Supply Pro
- **Calendar Dashboard**: Drag-and-drop task assignment to collaborators
- **Salary Management**: Pluggable salary calculation system
- **Real-time Notifications**: Toast notifications for important events
- **Auto-sync**: Orders automatically sync every 30 minutes

## Tech Stack

| Layer | Technology |
|-------|------------|
| Scraping | Playwright (Node.js) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Scheduler | node-cron |
| Frontend | React + Vite + TailwindCSS |
| Drag & Drop | @dnd-kit/core |
| Notifications | react-hot-toast |

## Project Structure

```
/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── scraper/          # Playwright scraping logic
│   │   ├── models/           # Mongoose models
│   │   ├── routes/           # REST API routes
│   │   ├── services/         # Business logic
│   │   ├── salary/           # Salary calculation engine
│   │   └── index.js
│   └── package.json
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Page components
│   │   └── main.jsx
│   └── package.json
│
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Supply Pro account credentials

### Backend Setup

```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your credentials
npm run seed  # Create sample collaborators
npm run dev   # Start development server
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your backend URL
npm run dev   # Start development server
```

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| `SUPPLYPRO_EMAIL` | Supply Pro login email |
| `SUPPLYPRO_PASSWORD` | Supply Pro login password |
| `SUPPLYPRO_URL` | Supply Pro base URL |
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Server port (default: 3001) |
| `CRON_INTERVAL` | Cron expression for auto-sync |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scrape` | Trigger manual scrape |
| GET | `/api/orders` | List orders (filterable) |
| GET | `/api/orders/:id` | Get order details |
| PATCH | `/api/orders/:id/assign` | Assign order to collaborator |
| GET | `/api/collaborators` | List collaborators |
| POST | `/api/collaborators` | Create collaborator |
| PUT | `/api/collaborators/:id` | Update collaborator |
| GET | `/api/collaborators/:id/salary` | Get salary summary |
| GET | `/api/calendar` | Get calendar data |

## Deployment

### Backend (Railway/Render)

1. Create new project on Railway or Render
2. Connect your repository
3. Set build command: `npm install && npx playwright install chromium`
4. Set start command: `node src/index.js`
5. Add all environment variables from `.env.example`

### Frontend (Vercel)

1. Import project to Vercel
2. Set root directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add `VITE_API_URL` environment variable

## Salary Calculation

Salary formulas are defined in `backend/src/salary/salaryRules.js`.
The file contains placeholder functions with TODO comments explaining how to implement:

- Fixed amount per order
- Percentage commission
- Hourly rate calculations
- Tiered pricing
- Role-based multipliers

## Development Notes

### Design Decisions

1. **Session Persistence**: Playwright cookies are saved to minimize logins
2. **Deduplication**: Orders are upserted using `orderId` as unique key
3. **Optimistic Updates**: Frontend updates UI before API confirmation
4. **Color Coding**: Each collaborator has a unique color for visual clarity

### Scraper Retry Logic

The scraper implements exponential backoff:
- Max 3 retries
- Delays: 1s, 2s, 4s

## License

MIT
