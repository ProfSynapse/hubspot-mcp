'use client';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ErrorData } from '@/lib/analytics-api';
import { AlertTriangle } from 'lucide-react';

interface ErrorTableProps {
  data: ErrorData[];
}

export function ErrorTable({ data }: ErrorTableProps) {
  // Sort by error count and take top 10
  const sortedErrors = data
    .sort((a, b) => b.error_count - a.error_count)
    .slice(0, 10);

  if (sortedErrors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Recent Errors
          </CardTitle>
          <CardDescription>
            Error occurrences by tool and operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <div className="text-2xl mb-2">🎉</div>
              <p>No errors recorded in the selected time period</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Recent Errors
        </CardTitle>
        <CardDescription>
          Error occurrences by tool and operation (top 10)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>
            {data.length > 10 ? `Showing top 10 of ${data.length} error types` : ''}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Error Code</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedErrors.map((error, index) => (
              <TableRow key={`${error.tool_name}-${error.operation}-${error.error_code}-${index}`}>
                <TableCell className="font-medium">
                  {error.tool_name}
                </TableCell>
                <TableCell>
                  {error.operation || '-'}
                </TableCell>
                <TableCell>
                  <code className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                    {error.error_code}
                  </code>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {error.error_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}