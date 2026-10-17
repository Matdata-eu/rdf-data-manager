import { useEffect, useState } from 'react'

/** Hash-based routes, so the app works from any static host (GitHub Pages included). */
export type Route =
  | { name: 'home' }
  | { name: 'class'; classIri: string }
  | { name: 'resource'; classIri: string; iri: string }
  | { name: 'new'; classIri: string }
  | { name: 'settings' }

export function parseRoute (hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (parts[0]) {
    case 'class': return parts[1] ? { name: 'class', classIri: parts[1] } : { name: 'home' }
    case 'resource': return parts[1] && parts[2] ? { name: 'resource', classIri: parts[1], iri: parts[2] } : { name: 'home' }
    case 'new': return parts[1] ? { name: 'new', classIri: parts[1] } : { name: 'home' }
    case 'settings': return { name: 'settings' }
    default: return { name: 'home' }
  }
}

export function href (route: Route): string {
  const e = encodeURIComponent
  switch (route.name) {
    case 'class': return `#/class/${e(route.classIri)}`
    case 'resource': return `#/resource/${e(route.classIri)}/${e(route.iri)}`
    case 'new': return `#/new/${e(route.classIri)}`
    case 'settings': return '#/settings'
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
