import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '7';
    
    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/analytics?days=${days}`, {
      method: 'GET',
      headers: {
        // Forward any cookies from the frontend request for authentication
        ...(request.headers.get('cookie') && {
          'Cookie': request.headers.get('cookie')!,
        }),
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    
    return NextResponse.json(data, {
      status: backendResponse.status,
    });
  } catch (error) {
    console.error('Analytics proxy error:', error);
    return NextResponse.json(
      { 
        toolUsage: [], 
        errors: [], 
        summary: { totalCalls: 0, errorRate: 0, avgResponseTime: 0 },
        error: 'Analytics service unavailable'
      },
      { status: 503 }
    );
  }
}