import { NextResponse } from 'next/server'
import { listSites } from '@/lib/sites'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sites = await listSites()

    // Sort by creation date (newest first)
    const sorted = sites.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(
      {
        total: sorted.length,
        sites: sorted.map((s) => ({
          siteId: s.siteId,
          siteName: s.siteName,
          siteUrl: s.siteUrl,
          pagesIndexed: s.pagesIndexed,
          createdAt: s.createdAt,
        })),
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
