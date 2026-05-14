import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Use same JWT_SECRET as other parts of the app
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow setup page and set-admin API without auth
    if (pathname === '/setup' || pathname === '/api/admin/set-admin') {
        return NextResponse.next();
    }

    // 1. Define protected routes (only admin routes now)
    const isAdminRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/admin');

    if (!isAdminRoute) {
        return NextResponse.next();
    }

    // 2. Get token from cookies
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
        // If it's an API route, return 401
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }
        // If it's a page route, redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // 3. Verify JWT
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userRole = payload.role as string;

        // 4. Role-based access control (only ADMIN role)
        if (userRole !== 'ADMIN') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Forbidden: Admin access required' },
                    { status: 403 }
                );
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 5. No need to inject headers since APIs now read cookies directly
        return NextResponse.next();
    } catch (error) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        '/setup',
        '/api/admin/set-admin',
        '/admin/:path*',
        '/api/admin/:path*',
    ],
};
