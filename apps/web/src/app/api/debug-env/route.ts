import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  return NextResponse.json({
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_PREFIX: dbUrl.substring(0, 20),
    DIRECT_URL_SET: !!process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
}
