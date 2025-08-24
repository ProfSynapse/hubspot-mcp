# HubSpot MCP Analytics Dashboard

A Next.js frontend dashboard for monitoring HubSpot MCP tool usage and performance analytics.

## Features

- 🔐 **Authentication**: Secure login with username/password
- 📊 **Analytics Dashboard**: Real-time charts showing tool usage and performance
- 📈 **Charts**: Bar charts for tool usage, line charts for response times
- 🚨 **Error Tracking**: Table showing recent errors and their frequency
- ⏱️ **Time Filtering**: View data for last 24 hours, 7 days, or 30 days
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js 18+ 
- The backend analytics server running on port 3001
- PostgreSQL database with analytics data

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Create `.env.local` file:
   ```bash
   BACKEND_URL=http://localhost:3001
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Access the dashboard**:
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Default Login

- Username: `admin`
- Password: (set in backend database)

## Project Structure

```
dashboard/
├── app/                    # Next.js app directory
│   ├── api/               # API route handlers (proxy to backend)
│   ├── dashboard/         # Main dashboard page
│   └── login/            # Login page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── login-form.tsx    # Authentication form
│   ├── usage-chart.tsx   # Tool usage bar chart
│   ├── response-time-chart.tsx  # Response time line chart
│   ├── error-table.tsx   # Error log table
│   ├── summary-cards.tsx # Stats summary cards
│   └── time-filter.tsx   # Time period selector
├── lib/                  # Utilities and API clients
│   ├── auth.ts          # Authentication functions
│   ├── analytics-api.ts # Analytics API client
│   └── utils.ts         # Utility functions
└── package.json
```

## Building for Production

```bash
npm run build
npm start
```

## Environment Variables

- `BACKEND_URL`: URL of the backend analytics API (default: http://localhost:3001)
- `NODE_ENV`: Environment mode (development/production)

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

## API Integration

The frontend proxies requests to the backend analytics API:

- `POST /api/auth` - Login/logout
- `GET /api/auth/check` - Authentication check
- `GET /api/analytics?days=7` - Analytics data

## Development

The dashboard connects to your existing backend analytics server. Make sure it's running on the configured `BACKEND_URL` before starting the frontend development server.