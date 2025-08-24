import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/check`, {
      method: 'GET',
      headers: {
        // Forward any cookies from the frontend request
        ...(request.headers.get('cookie') && {
          'Cookie': request.headers.get('cookie')!,
        }),
      },
    });

    return new NextResponse(null, {
      status: backendResponse.status,
    });
  } catch (error) {
    console.error('Auth check proxy error:', error);
    return new NextResponse(null, { status: 503 });
  }
}