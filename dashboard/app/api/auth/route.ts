import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any cookies from the frontend request
        ...(request.headers.get('cookie') && {
          'Cookie': request.headers.get('cookie')!,
        }),
      },
      body: JSON.stringify(body),
    });

    const responseData = await backendResponse.json();
    
    // Create the response
    const response = NextResponse.json(responseData, {
      status: backendResponse.status,
    });

    // Forward any set-cookie headers from backend
    const setCookieHeader = backendResponse.headers.get('set-cookie');
    if (setCookieHeader) {
      response.headers.set('set-cookie', setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error('Auth proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Authentication service unavailable' },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest) {
  // This handles auth check requests
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