# shadcn/ui Dashboard Research

## Executive Summary

shadcn/ui represents the current state-of-the-art for building modern React dashboards in 2024, offering beautiful, accessible components with excellent TypeScript support. The library provides comprehensive chart components built on Recharts, pre-built dashboard layouts, and authentication UI patterns. Key advantages include copy-paste simplicity, Tailwind CSS integration, and extensive customization capabilities without vendor lock-in.

**Primary Recommendations:**
- Use shadcn/ui with Next.js 14+ for optimal performance and developer experience
- Implement Recharts-based chart components for data visualization
- Leverage built-in dark/light mode support for professional dashboard aesthetics
- Utilize pre-built authentication forms and dashboard layouts

## Technology Stack Overview

### Core Technologies

| Technology | Version | Purpose | Benefits |
|------------|---------|---------|----------|
| shadcn/ui | Latest | Component Library | Copy-paste, customizable, accessible |
| Next.js | 14+ | React Framework | App Router, SSR, optimizations |
| Tailwind CSS | 3.4+ | Styling | Utility-first, responsive design |
| Recharts | 2.8+ | Charts/Visualization | React-native charts, responsive |
| Radix UI | Latest | Primitives | Accessibility, keyboard navigation |
| TypeScript | 5.0+ | Type Safety | Enhanced developer experience |

### shadcn/ui Advantages

**Developer Experience:**
- Copy and paste components (no npm dependencies)
- Full TypeScript support out of the box
- Customizable via CSS variables and Tailwind classes
- No vendor lock-in - components become part of your codebase

**Design System:**
- Consistent design language based on Radix UI
- Built-in accessibility features
- Dark/light mode support
- Responsive design patterns

## Detailed Dashboard Components

### Layout Components

**Dashboard Shell Structure:**
```tsx
// app/dashboard/layout.tsx
import { DashboardShell } from "@/components/dashboard/shell"
import { DashboardHeader } from "@/components/dashboard/header"
import { DashboardSidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <div className="flex-1">
        <DashboardHeader />
        <main className="flex-1 space-y-4 p-8 pt-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Sidebar Navigation:**
```tsx
// components/dashboard/sidebar.tsx
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  BarChart3, 
  AlertTriangle, 
  Users, 
  Settings,
  Database 
} from "lucide-react"

const sidebarItems = [
  { title: "Overview", href: "/dashboard", icon: BarChart3 },
  { title: "Tool Usage", href: "/dashboard/tools", icon: Database },
  { title: "Errors", href: "/dashboard/errors", icon: AlertTriangle },
  { title: "Users", href: "/dashboard/users", icon: Users },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  return (
    <div className="hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-[60px] items-center border-b px-6">
          <h2 className="text-lg font-semibold">HubSpot MCP Analytics</h2>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 p-2">
            {sidebarItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className="w-full justify-start"
                asChild
              >
                <a href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </a>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
```

### Chart Components

**Tool Usage Chart:**
```tsx
// components/charts/tool-usage-chart.tsx
"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  usage: {
    label: "Tool Usage",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

interface ToolUsageChartProps {
  data: Array<{
    toolName: string
    usage: number
    successRate: number
  }>
}

export function ToolUsageChart({ data }: ToolUsageChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Usage Analytics</CardTitle>
        <CardDescription>Usage frequency by tool over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="toolName" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="usage" fill="var(--color-usage)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing tool usage for the last 30 days
        </div>
      </CardFooter>
    </Card>
  )
}
```

**Real-time Metrics Dashboard:**
```tsx
// components/charts/realtime-metrics.tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Activity, AlertCircle, CheckCircle, Clock } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  variant?: "default" | "success" | "warning" | "error"
}

function MetricCard({ title, value, change, icon: Icon, variant = "default" }: MetricCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success": return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
      case "warning": return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
      case "error": return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      default: return ""
    }
  }

  return (
    <Card className={getVariantStyles()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <Badge variant={change > 0 ? "default" : "secondary"} className="text-xs">
            {change > 0 ? "+" : ""}{change}%
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

interface RealtimeMetricsProps {
  wsEndpoint: string
}

export function RealtimeMetrics({ wsEndpoint }: RealtimeMetricsProps) {
  const [metrics, setMetrics] = useState({
    activeRequests: 0,
    avgResponseTime: 0,
    errorRate: 0,
    successRate: 95.5
  })

  useEffect(() => {
    const ws = new WebSocket(wsEndpoint)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'metrics') {
        setMetrics(data.payload)
      }
    }

    return () => ws.close()
  }, [wsEndpoint])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Active Requests"
        value={metrics.activeRequests}
        icon={Activity}
      />
      <MetricCard
        title="Avg Response Time"
        value={`${metrics.avgResponseTime}ms`}
        icon={Clock}
        variant={metrics.avgResponseTime > 5000 ? "warning" : "default"}
      />
      <MetricCard
        title="Error Rate"
        value={`${metrics.errorRate}%`}
        icon={AlertCircle}
        variant={metrics.errorRate > 5 ? "error" : "default"}
      />
      <MetricCard
        title="Success Rate"
        value={`${metrics.successRate}%`}
        icon={CheckCircle}
        variant="success"
      />
    </div>
  )
}
```

### Data Tables

**Error Logs Table:**
```tsx
// components/tables/error-logs-table.tsx
"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Search } from "lucide-react"

interface ErrorLog {
  id: string
  level: "error" | "warn" | "info"
  message: string
  toolName?: string
  timestamp: Date
  resolved: boolean
}

const columns: ColumnDef<ErrorLog>[] = [
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => {
      const level = row.getValue("level") as string
      const variant = level === "error" ? "destructive" : 
                    level === "warn" ? "secondary" : "default"
      return <Badge variant={variant}>{level.toUpperCase()}</Badge>
    },
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => (
      <div className="max-w-[500px] truncate font-medium">
        {row.getValue("message")}
      </div>
    ),
  },
  {
    accessorKey: "toolName",
    header: "Tool",
    cell: ({ row }) => {
      const toolName = row.getValue("toolName") as string
      return toolName ? (
        <Badge variant="outline">{toolName}</Badge>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      )
    },
  },
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const date = row.getValue("timestamp") as Date
      return (
        <div className="text-sm text-muted-foreground">
          {date.toLocaleString()}
        </div>
      )
    },
  },
  {
    accessorKey: "resolved",
    header: "Status",
    cell: ({ row }) => {
      const resolved = row.getValue("resolved") as boolean
      return (
        <Badge variant={resolved ? "default" : "destructive"}>
          {resolved ? "Resolved" : "Open"}
        </Badge>
      )
    },
  },
]

interface ErrorLogsTableProps {
  data: ErrorLog[]
}

export function ErrorLogsTable({ data }: ErrorLogsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter messages..."
            value={(table.getColumn("message")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("message")?.setFilterValue(event.target.value)
            }
            className="pl-8"
          />
        </div>
      </div>
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
            {table.getRowModel().rows?.length ? (
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

## Authentication UI Components

### Login Form

```tsx
// components/auth/login-form.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Login failed")
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the analytics dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

## Project Setup and Configuration

### Next.js Configuration

**next.config.js:**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  typescript: {
    // Allow production builds to successfully complete even if
    // your project has TypeScript type errors.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
```

**shadcn/ui Installation:**
```bash
# Initialize Next.js project
npx create-next-app@latest hubspot-dashboard --typescript --tailwind --eslint

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Install required components
npx shadcn-ui@latest add card
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add form
npx shadcn-ui@latest add chart

# Install additional dependencies
npm install recharts @tanstack/react-table
npm install react-hook-form @hookform/resolvers zod
npm install lucide-react
```

### Tailwind Configuration

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

## Advanced Dashboard Patterns

### Theme Support

```tsx
// components/theme-provider.tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// components/mode-toggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

### Responsive Design Patterns

```tsx
// components/responsive-dashboard.tsx
"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

export function ResponsiveDashboard({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)

    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b px-4 py-3">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                {/* Mobile sidebar content */}
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold">Analytics Dashboard</h1>
          </div>
        </header>
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop layout */}
      {children}
    </div>
  )
}
```

## Performance Optimization

### Chart Performance

```tsx
// hooks/use-chart-data.tsx
import { useMemo } from "react"
import { format, subDays } from "date-fns"

export function useChartData(rawData: any[], timeRange: number = 7) {
  return useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, timeRange)
    
    return rawData
      .filter(item => item.timestamp >= startDate)
      .map(item => ({
        ...item,
        formattedDate: format(item.timestamp, "MMM dd"),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [rawData, timeRange])
}
```

### Component Lazy Loading

```tsx
// components/lazy-components.tsx
import { lazy, Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

const AdvancedChart = lazy(() => import("./charts/advanced-chart"))
const DataTable = lazy(() => import("./tables/data-table"))

export function LazyChart(props: any) {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
      <AdvancedChart {...props} />
    </Suspense>
  )
}
```

## Resource Links

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [shadcn/ui Chart Examples](https://ui.shadcn.com/docs/components/chart)
- [shadcn/ui Dashboard Example](https://ui.shadcn.com/examples/dashboard)
- [Recharts Documentation](https://recharts.org/en-US/)
- [TanStack Table Documentation](https://tanstack.com/table/v8)
- [Next.js App Router](https://nextjs.org/docs/app)

## Recommendations

1. **Start with shadcn/ui dashboard template** to accelerate development
2. **Use Recharts for all chart components** for consistency and performance
3. **Implement dark/light mode** for professional appearance
4. **Build responsive layouts** from the start using mobile-first approach
5. **Leverage TypeScript** throughout for better developer experience
6. **Use proper data fetching patterns** with SWR or TanStack Query
7. **Implement lazy loading** for heavy components like charts and tables
8. **Follow shadcn/ui naming conventions** for consistency across components