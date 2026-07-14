// @def.boundary registry-system
// @def.doc registry-system

/**
 * Cloudflare Workers 진입점은 Nest 전환 이후 최소 shim만 유지한다.
 * 실제 런타임 검증/지원 경로는 Node + Nest 엔트리포인트(`main.ts`)가 기준이다.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'registry-service', runtime: 'worker-shim' });
    }

    return Response.json(
      {
        error: 'registry-service Cloudflare Worker runtime is no longer supported in this package',
      },
      { status: 501 },
    );
  },
};
