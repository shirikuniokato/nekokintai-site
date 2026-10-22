// 端末証明と公開名の検査がそろうまで、投稿を受け付けない。
export function onRequest() {
  return Response.json(
    { error: 'unavailable' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
