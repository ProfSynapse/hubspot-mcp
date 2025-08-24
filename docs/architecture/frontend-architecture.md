# Frontend Architecture Design

## Executive Summary

This document defines the complete frontend architecture for the HubSpot MCP Analytics Dashboard using Next.js 14+ with shadcn/ui components. The architecture emphasizes performance, accessibility, real-time data visualization, and responsive design while maintaining a professional aesthetic suitable for admin dashboards.

## Technology Stack

### Core Technologies
- **Next.js 14+**: React framework with App Router for optimal performance
- **TypeScript 5.0+**: Strong typing for complex dashboard data structures
- **shadcn/ui**: Modern, accessible component library built on Radix UI
- **Tailwind CSS 3.4+**: Utility-first styling with built-in responsive design
- **Recharts 2.8+**: Data visualization library optimized for React
- **TanStack Query v5**: Server state management and caching
- **Zustand**: Client state management for UI interactions
- **React Hook Form**: Form handling with Zod validation

### UI/UX Libraries
- **Radix UI**: Accessible, unstyled UI primitives
- **Lucide React**: Modern icon library with consistent design
- **next-themes**: Dark/light mode support with system preference detection
- **react-hot-toast**: Elegant toast notifications
- **framer-motion**: Smooth animations and transitions

## Application Architecture

### Folder Structure
```
dashboard/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication layout group
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Main dashboard layout group
│   │   ├── analytics/
│   │   │   ├── overview/
│   │   │   ├── tools/
│   │   │   ├── errors/
│   │   │   └── settings/
│   │   ├── dashboard/
│   │   └── layout.tsx
│   ├── api/                      # API routes (if needed)
│   ├── globals.css
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home redirect
├── components/                   # Reusable components
│   ├── ui/                       # shadcn/ui components
│   ├── charts/                   # Chart components
│   ├── tables/                   # Data table components
│   ├── forms/                    # Form components
│   ├── layout/                   # Layout components
│   └── analytics/                # Analytics-specific components
├── lib/                          # Utility libraries
│   ├── api.ts                    # API client
│   ├── auth.ts                   # Authentication utilities
│   ├── utils.ts                  # General utilities
│   ├── validations.ts            # Zod schemas
│   └── websocket.ts              # WebSocket client
├── hooks/                        # Custom React hooks
│   ├── use-api.ts               # API data fetching hooks
│   ├── use-auth.ts              # Authentication hooks
│   ├── use-websocket.ts         # WebSocket hooks
│   └── use-charts.ts            # Chart data processing hooks
├── stores/                       # State management
│   ├── auth-store.ts            # Authentication state
│   ├── dashboard-store.ts       # Dashboard UI state
│   └── settings-store.ts        # User preferences
├── types/                        # TypeScript type definitions
│   ├── api.ts                   # API response types
│   ├── auth.ts                  # Authentication types
│   └── analytics.ts             # Analytics data types
└── styles/                       # Additional styles
    └── charts.css               # Chart-specific styles
```

## Component Architecture

### Layout Components

#### Root Layout
```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/query-provider'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HubSpot MCP Analytics Dashboard',
  description: 'Real-time analytics dashboard for HubSpot MCP server monitoring',
  viewport: 'width=device-width, initial-scale=1',
  robots: 'noindex, nofollow', // Private admin dashboard
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, 'min-h-screen bg-background font-sans antialiased')}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <div className="relative flex min-h-screen flex-col">
                <main className="flex-1">{children}</main>
              </div>
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

#### Dashboard Layout
```typescript
// app/(dashboard)/layout.tsx
'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login')
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <DashboardSidebar />
      <div className="flex flex-col">
        <DashboardHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

#### Dashboard Sidebar
```typescript
// components/layout/dashboard-sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart3,
  Database,
  AlertTriangle,
  Settings,
  Activity,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react'

const sidebarItems = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: BarChart3,
    description: 'System overview and key metrics'
  },
  {
    title: 'Real-time Monitor',
    href: '/dashboard/monitor',
    icon: Activity,
    description: 'Live system monitoring'
  },
  {
    title: 'Tool Analytics',
    href: '/dashboard/tools',
    icon: Database,
    description: 'BCP tool usage analysis'
  },
  {
    title: 'Performance',
    href: '/dashboard/performance',
    icon: TrendingUp,
    description: 'Performance metrics and trends'
  },
  {
    title: 'Error Analysis',
    href: '/dashboard/errors',
    icon: AlertTriangle,
    description: 'Error tracking and resolution'
  },
  {
    title: 'Request Logs',
    href: '/dashboard/requests',
    icon: FileText,
    description: 'HTTP request analytics'
  },
  {
    title: 'Users & Sessions',
    href: '/dashboard/users',
    icon: Users,
    description: 'User activity and sessions'
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'System configuration'
  }
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-6 w-6" />
            <span>MCP Analytics</span>
          </Link>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                            (item.href !== '/dashboard' && pathname.startsWith(item.href))
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'justify-start gap-2 h-auto p-3',
                    isActive && 'bg-muted font-medium'
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm">{item.title}</span>
                      <span className="text-xs text-muted-foreground lg:block hidden">
                        {item.description}
                      </span>
                    </div>
                  </Link>
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
```

### Chart Components

#### Tool Usage Chart
```typescript
// components/charts/tool-usage-chart.tsx
'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface ToolUsageData {
  bcpName: string
  toolName: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  avgDuration: number
}

interface ToolUsageChartProps {
  data: ToolUsageData[]
  loading?: boolean
  timeRange: string
  className?: string
}

const chartConfig = {
  successfulCalls: {
    label: 'Successful',
    color: 'hsl(var(--chart-1))',
  },
  failedCalls: {
    label: 'Failed',
    color: 'hsl(var(--chart-2))',
  },
  avgDuration: {
    label: 'Avg Duration (ms)',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

export function ToolUsageChart({ 
  data, 
  loading = false, 
  timeRange,
  className 
}: ToolUsageChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      tool: `${item.bcpName}.${item.toolName}`,
      fullName: `${item.bcpName} - ${item.toolName}`,
      successfulCalls: item.successfulCalls,
      failedCalls: item.failedCalls,
      totalCalls: item.totalCalls,
      avgDuration: item.avgDuration,
      successRate: ((item.successfulCalls / item.totalCalls) * 100).toFixed(1)
    }))
  }, [data])

  const totalCalls = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.totalCalls, 0), 
    [chartData]
  )

  const avgSuccessRate = useMemo(() => {
    if (chartData.length === 0) return 0
    const totalSuccess = chartData.reduce((sum, item) => sum + item.successfulCalls, 0)
    return ((totalSuccess / totalCalls) * 100).toFixed(1)
  }, [chartData, totalCalls])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Tool Usage Analytics</CardTitle>
          <CardDescription>Loading usage data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Tool Usage Analytics</CardTitle>
        <CardDescription>
          Usage patterns and success rates for the last {timeRange}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 80,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="tool"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis />
              <ChartTooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md">
                        <p className="font-medium">{data.fullName}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-green-600">
                            Successful: {data.successfulCalls} calls
                          </p>
                          <p className="text-red-600">
                            Failed: {data.failedCalls} calls
                          </p>
                          <p className="text-muted-foreground">
                            Success Rate: {data.successRate}%
                          </p>
                          <p className="text-muted-foreground">
                            Avg Duration: {data.avgDuration}ms
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar 
                dataKey="successfulCalls" 
                stackId="a" 
                fill="var(--color-successfulCalls)"
                name="Successful Calls"
              />
              <Bar 
                dataKey="failedCalls" 
                stackId="a" 
                fill="var(--color-failedCalls)"
                name="Failed Calls"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex items-center justify-between border-t pt-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span>Overall Success Rate: {avgSuccessRate}%</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Calls: {totalCalls.toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Real-time Metrics Display
```typescript
// components/charts/realtime-metrics.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Minus
} from 'lucide-react'
import { useWebSocket } from '@/hooks/use-websocket'
import { cn } from '@/lib/utils'

interface RealtimeMetrics {
  activeRequests: number
  avgResponseTime: number
  errorRate: number
  successRate: number
  throughput: number
  timestamp: string
}

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'error'
  description?: string
  loading?: boolean
}

function MetricCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon: Icon, 
  variant = 'default',
  description,
  loading = false 
}: MetricCardProps) {
  const getVariantStyles = () => {
    const styles = {
      default: 'border-border',
      success: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50',
      warning: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/50',
      error: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50'
    }
    return styles[variant]
  }

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-muted-foreground" />
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600'
    if (trend === 'down') return 'text-red-600'
    return 'text-muted-foreground'
  }

  return (
    <Card className={cn('transition-colors', getVariantStyles())}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? (
            <div className="h-8 w-16 animate-pulse bg-muted rounded" />
          ) : (
            value
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {change !== undefined && !loading && (
          <div className={cn('flex items-center text-xs mt-1', getTrendColor())}>
            {getTrendIcon()}
            <span className="ml-1">
              {change > 0 ? '+' : ''}{change}% from last hour
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const { isConnected, subscribe, on } = useWebSocket()

  useEffect(() => {
    if (isConnected) {
      subscribe(['metrics', 'overview'])
      
      on('metrics', (data: RealtimeMetrics) => {
        setMetrics(data)
        setLoading(false)
      })
      
      on('overview', (data: any) => {
        // Handle overview updates
        setLoading(false)
      })
    }
  }, [isConnected, subscribe, on])

  const getSuccessRateVariant = (rate: number) => {
    if (rate >= 95) return 'success'
    if (rate >= 85) return 'warning'
    return 'error'
  }

  const getResponseTimeVariant = (time: number) => {
    if (time <= 500) return 'success'
    if (time <= 2000) return 'warning'
    return 'error'
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Active Requests"
        value={metrics?.activeRequests ?? 0}
        icon={Activity}
        description="Currently processing"
        loading={loading}
      />
      
      <MetricCard
        title="Avg Response Time"
        value={metrics ? `${metrics.avgResponseTime}ms` : '0ms'}
        icon={Clock}
        variant={metrics ? getResponseTimeVariant(metrics.avgResponseTime) : 'default'}
        description="Average response time"
        loading={loading}
      />
      
      <MetricCard
        title="Error Rate"
        value={metrics ? `${metrics.errorRate.toFixed(1)}%` : '0%'}
        icon={AlertCircle}
        variant={metrics && metrics.errorRate > 5 ? 'error' : 'default'}
        description="Errors in last hour"
        loading={loading}
      />
      
      <MetricCard
        title="Success Rate"
        value={metrics ? `${metrics.successRate.toFixed(1)}%` : '0%'}
        icon={CheckCircle}
        variant={metrics ? getSuccessRateVariant(metrics.successRate) : 'default'}
        description="Successful requests"
        loading={loading}
      />
    </div>
  )
}
```

### Data Table Components

#### Analytics Data Table
```typescript
// components/tables/analytics-data-table.tsx
'use client'

import { useState } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronDown, 
  Search, 
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'
import { DataTablePagination } from './data-table-pagination'
import { DataTableViewOptions } from './data-table-view-options'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  searchPlaceholder?: string
  onRefresh?: () => void
  onExport?: () => void
  filterableColumns?: Array<{
    id: string
    title: string
    options: Array<{ label: string; value: string }>
  }>
}

export function AnalyticsDataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  searchPlaceholder = "Search...",
  onRefresh,
  onExport,
  filterableColumns = []
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="pl-8 max-w-sm"
            />
          </div>
          
          {/* Column Filters */}
          {filterableColumns.map((column) => (
            <DropdownMenu key={column.id}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Filter className="mr-2 h-4 w-4" />
                  {column.title}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {column.options.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={table.getColumn(column.id)?.getFilterValue() === option.value}
                    onCheckedChange={(checked) => {
                      const column = table.getColumn(column.id)
                      column?.setFilterValue(checked ? option.value : undefined)
                    }}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          )}
          
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
```

## State Management

### Authentication Store
```typescript
// stores/auth-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiClient } from '@/lib/api'
import { User } from '@/types/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<boolean>
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string) => {
        set({ isLoading: true })
        
        try {
          const response = await ApiClient.post('/auth/login', {
            username,
            password
          })
          
          const { user, accessToken } = response.data
          
          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await ApiClient.post('/auth/logout')
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      refreshToken: async () => {
        try {
          const response = await ApiClient.post('/auth/refresh')
          const { accessToken } = response.data
          
          set({ accessToken })
          return true
        } catch (error) {
          console.error('Token refresh failed:', error)
          get().logout()
          return false
        }
      },

      setUser: (user: User) => {
        set({ user })
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user data, not tokens
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
)
```

### Dashboard Store
```typescript
// stores/dashboard-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DashboardState {
  // UI State
  sidebarCollapsed: boolean
  selectedTimeRange: '1h' | '24h' | '7d' | '30d'
  refreshInterval: number
  autoRefresh: boolean
  theme: 'light' | 'dark' | 'system'
  
  // Filter State
  toolFilters: {
    bcpName?: string
    toolName?: string
    success?: boolean
  }
  errorFilters: {
    level?: string
    resolved?: boolean
    category?: string
  }
  
  // Actions
  toggleSidebar: () => void
  setTimeRange: (range: '1h' | '24h' | '7d' | '30d') => void
  setRefreshInterval: (interval: number) => void
  toggleAutoRefresh: () => void
  setToolFilters: (filters: any) => void
  setErrorFilters: (filters: any) => void
  resetFilters: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      selectedTimeRange: '24h',
      refreshInterval: 10000, // 10 seconds
      autoRefresh: true,
      theme: 'system',
      
      toolFilters: {},
      errorFilters: {},

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setTimeRange: (selectedTimeRange) => {
        set({ selectedTimeRange })
      },

      setRefreshInterval: (refreshInterval) => {
        set({ refreshInterval })
      },

      toggleAutoRefresh: () => {
        set((state) => ({ autoRefresh: !state.autoRefresh }))
      },

      setToolFilters: (toolFilters) => {
        set({ toolFilters })
      },

      setErrorFilters: (errorFilters) => {
        set({ errorFilters })
      },

      resetFilters: () => {
        set({
          toolFilters: {},
          errorFilters: {}
        })
      },
    }),
    {
      name: 'dashboard-settings',
    }
  )
)
```

## Custom Hooks

### API Data Fetching Hook
```typescript
// hooks/use-api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

export function useAnalyticsOverview(timeRange: string) {
  return useQuery({
    queryKey: ['analytics', 'overview', timeRange],
    queryFn: () => ApiClient.get(`/analytics/overview?timeRange=${timeRange}`),
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
  })
}

export function useToolUsageLogs(filters: any, page: number = 1) {
  return useQuery({
    queryKey: ['analytics', 'tools', filters, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        ...filters
      })
      return ApiClient.get(`/analytics/tools?${params}`)
    },
    keepPreviousData: true,
  })
}

export function useErrorLogs(filters: any, page: number = 1) {
  return useQuery({
    queryKey: ['analytics', 'errors', filters, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        ...filters
      })
      return ApiClient.get(`/analytics/errors?${params}`)
    },
    keepPreviousData: true,
  })
}

export function useResolveError() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      ApiClient.patch(`/analytics/errors/${id}/resolve`, { resolutionNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'errors'] })
    }
  })
}

export function useExportData() {
  return useMutation({
    mutationFn: (params: { type: string; format: string; filters?: any }) => 
      ApiClient.get(`/analytics/export/${params.format}`, { params: params.filters }),
  })
}
```

### WebSocket Hook
```typescript
// hooks/use-websocket.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/components/ui/use-toast'

interface WebSocketMessage {
  type: string
  data: any
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const ws = useRef<WebSocket | null>(null)
  const { accessToken } = useAuthStore()
  const eventCallbacks = useRef<Map<string, Function[]>>(new Map())
  const subscriptions = useRef<Set<string>>(new Set())

  const connect = useCallback(() => {
    if (!accessToken || ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState('connecting')
    
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/api/v1/ws/analytics?token=${accessToken}`
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setConnectionState('connected')
      
      // Re-subscribe to previous subscriptions
      if (subscriptions.current.size > 0) {
        subscribe(Array.from(subscriptions.current))
      }
    }

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        const callbacks = eventCallbacks.current.get(message.type)
        
        if (callbacks) {
          callbacks.forEach(callback => callback(message.data))
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.current.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      setIsConnected(false)
      setConnectionState('disconnected')
      
      // Attempt to reconnect after a delay
      if (event.code !== 1000) { // Not a normal closure
        setTimeout(() => {
          connect()
        }, 3000)
      }
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast({
        title: 'Connection Error',
        description: 'Lost connection to real-time updates',
        variant: 'destructive'
      })
    }
  }, [accessToken])

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect')
      ws.current = null
    }
    setIsConnected(false)
    setConnectionState('disconnected')
  }, [])

  const subscribe = useCallback((streams: string[]) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot subscribe')
      return
    }

    streams.forEach(stream => subscriptions.current.add(stream))

    ws.current.send(JSON.stringify({
      type: 'subscribe',
      streams
    }))
  }, [])

  const unsubscribe = useCallback((streams: string[]) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return
    }

    streams.forEach(stream => subscriptions.current.delete(stream))

    ws.current.send(JSON.stringify({
      type: 'unsubscribe',
      streams
    }))
  }, [])

  const on = useCallback((eventType: string, callback: Function) => {
    if (!eventCallbacks.current.has(eventType)) {
      eventCallbacks.current.set(eventType, [])
    }
    eventCallbacks.current.get(eventType)!.push(callback)
  }, [])

  const off = useCallback((eventType: string, callback?: Function) => {
    if (!callback) {
      eventCallbacks.current.delete(eventType)
    } else {
      const callbacks = eventCallbacks.current.get(eventType)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (accessToken) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [accessToken, connect, disconnect])

  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
    off
  }
}
```

## Performance Optimization

### Code Splitting and Lazy Loading
```typescript
// app/(dashboard)/analytics/page.tsx
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Lazy load heavy components
const ToolUsageChart = dynamic(() => import('@/components/charts/tool-usage-chart'), {
  loading: () => <div className="h-[400px] w-full animate-pulse bg-muted rounded" />
})

const PerformanceMetrics = dynamic(() => import('@/components/charts/performance-metrics'), {
  loading: () => <LoadingSpinner />
})

const ErrorAnalysisTable = dynamic(() => import('@/components/tables/error-analysis-table'), {
  ssr: false
})

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<LoadingSpinner />}>
        <ToolUsageChart />
      </Suspense>
      
      <Suspense fallback={<LoadingSpinner />}>
        <PerformanceMetrics />
      </Suspense>
      
      <Suspense fallback={<div>Loading error analysis...</div>}>
        <ErrorAnalysisTable />
      </Suspense>
    </div>
  )
}
```

### Chart Data Processing
```typescript
// hooks/use-chart-data.ts
import { useMemo } from 'react'
import { format, subDays, eachHourOfInterval, eachDayOfInterval } from 'date-fns'

export function useProcessedChartData(rawData: any[], timeRange: string) {
  return useMemo(() => {
    if (!rawData || rawData.length === 0) return []

    const endDate = new Date()
    const startDate = subDays(endDate, getTimeRangeDays(timeRange))
    
    // Group data by appropriate time intervals
    const interval = timeRange === '1h' || timeRange === '24h' ? 
      eachHourOfInterval({ start: startDate, end: endDate }) :
      eachDayOfInterval({ start: startDate, end: endDate })

    return interval.map(date => {
      const dateKey = format(date, timeRange === '1h' || timeRange === '24h' ? 'yyyy-MM-dd HH:00' : 'yyyy-MM-dd')
      const dataForPeriod = rawData.filter(item => 
        format(new Date(item.timestamp), timeRange === '1h' || timeRange === '24h' ? 'yyyy-MM-dd HH:00' : 'yyyy-MM-dd') === dateKey
      )

      return {
        timestamp: format(date, timeRange === '1h' || timeRange === '24h' ? 'HH:mm' : 'MMM dd'),
        fullTimestamp: date.toISOString(),
        count: dataForPeriod.length,
        successCount: dataForPeriod.filter(item => item.success).length,
        errorCount: dataForPeriod.filter(item => !item.success).length,
        avgDuration: dataForPeriod.length > 0 ? 
          dataForPeriod.reduce((sum, item) => sum + item.duration, 0) / dataForPeriod.length : 0
      }
    })
  }, [rawData, timeRange])
}

function getTimeRangeDays(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 0.042 // ~1 hour in days
    case '24h': return 1
    case '7d': return 7
    case '30d': return 30
    default: return 1
  }
}
```

## Responsive Design

### Mobile-First Approach
```typescript
// components/layout/mobile-sidebar.tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { DashboardSidebar } from './dashboard-sidebar'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <DashboardSidebar />
      </SheetContent>
    </Sheet>
  )
}
```

## Accessibility Features

### ARIA Labels and Keyboard Navigation
```typescript
// components/ui/data-table-toolbar.tsx
export function DataTableToolbar({ table }: { table: any }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter results..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
          aria-label="Filter table results"
        />
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
```

## Error Boundaries and Error Handling

```typescript
// components/error-boundary.tsx
'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An error occurred while rendering this component. Please try refreshing or contact support if the problem persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
```

This frontend architecture provides a robust, scalable, and maintainable foundation for the analytics dashboard with modern React patterns, comprehensive error handling, and excellent user experience across all device sizes.