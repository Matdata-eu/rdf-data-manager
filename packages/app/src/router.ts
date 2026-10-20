import { useEffect, useState } from 'react'

/** Hash-based routes, so the app works from any static host (GitHub Pages included). */
export type Route =
  | { name: 'home' }
  | { name: 'class'; classIri: string; view?: 'table' }
  | { name: 'resource'; classIri: string; iri: string }
  | { name: 'new'; classIri: string }
  | { name: 'settings' }
  | { name: 'validation'; classIri?: string }
  | { name: 'translations'; classIri: string }
  | { name: 'search'; query: string }
  | { name: 'import' }

export function parseRoute (hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (parts[0]) {
    case 'class': return parts[1] ? { name: 'class', classIri: parts[1], ...(parts[2] === 'table' ? { view: 'table' as const } : {}) } : { name: 'home' }
    case 'resource': return parts[1] && parts[2] ? { name: 'resource', classIri: parts[1], iri: parts[2] } : { name: 'home' }
    case 'new': return parts[1] ? { name: 'new', classIri: parts[1] } : { name: 'home' }
    case 'settings': return { name: 'settings' }
    case 'validation': return { name: 'validation', classIri: parts[1] || undefined }
    case 'translations': return parts[1] ? { name: 'translations', classIri: parts[1] } : { name: 'home' }
    case 'search': return { name: 'search', query: parts.slice(1).join('/') }
    case 'import': return { name: 'import' }
    default: return { name: 'home' }
  }
}

export function href (route: Route): string {
  const e = encodeURIComponent
  switch (route.name) {
    case 'class': return `#/class/${e(route.classIri)}${route.view ? `/${route.view}` : ''}`
    case 'resource': return `#/resource/${e(route.classIri)}/${e(route.iri)}`
    case 'new': return `#/new/${e(route.classIri)}`
    case 'settings': return '#/settings'
    case 'validation': return route.classIri ? `#/validation/${e(route.classIri)}` : '#/validation'
    case 'translations': return `#/translations/${e(route.classIri)}`
    case 'search': return `#/search/${e(route.query)}`
    case 'import': return '#/import'
    default: return '#/'
  }
}

export function navigate (route: Route): void {
  window.location.hash = href(route)
}

export function useRoute (): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** The class a route is about, for highlighting the sidebar. */
export function classOf (route: Route): string | undefined {
  return 'classIri' in route ? route.classIri : undefined
}
