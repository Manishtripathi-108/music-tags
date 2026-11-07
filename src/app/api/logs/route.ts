import { NextRequest, NextResponse } from 'next/server';
import { getApiLogs, clearApiLogs } from '@/services/logger/apiLogger';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const logs = getApiLogs();
    return NextResponse.json({ logs, total: logs.length });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    clearApiLogs();
    return NextResponse.json({ success: true, message: 'API logs cleared' });
}
