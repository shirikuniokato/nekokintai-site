// 公開 API のデータだけを使う。仮の投稿やローカルの件数は表示しない。
export const PAGE_SIZE = 8

function queryString(options = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return params.size ? `?${params}` : ''
}

async function request(path, options = {}) {
  const response = await fetch(`/api/nekos${path}`, { ...options, headers: { 'Content-Type': 'application/json' } })
  if (response.status === 404 && !options.method) return null
  if (!response.ok) throw new Error('ねこちゃんの通信に失敗しました')
  return response.json()
}

export function fetchNekos({ sort, page, hiddenOwners }) {
  return request(queryString({ sort, page, limit: PAGE_SIZE, hide: [...hiddenOwners].join(',') }))
}

export async function fetchNeko(id, { hiddenOwners = new Set() } = {}) {
  const response = await request(`/${encodeURIComponent(id)}${queryString({ hide: [...hiddenOwners].join(',') })}`)
  return response?.cat ?? null
}

export async function fetchOtherNekos({ excludeId, hiddenOwners, count = 4 }) {
  const response = await request(queryString({ sort: 'new', page: 0, limit: count, exclude: excludeId, hide: [...hiddenOwners].join(',') }))
  return response.cats
}

export function setLike(id, liked) {
  return request(`/${encodeURIComponent(id)}/like`, { method: 'PUT', body: JSON.stringify({ liked }) })
}

export function reportPublication(id, revision, reason) {
  return request(`/${encodeURIComponent(id)}/reports`, { method: 'POST',
    body: JSON.stringify({ revision, targetKind: 'publication', reason }) })
}
