import type { RepositoryConfig, ShapesSource } from '@rdf-data-manager/core'

export type { ShapesSource }

export interface AppConfig extends RepositoryConfig {
  timeoutMs: number
  /** Preferred language for labels and messages. */
  language: string
  /** Language tags offered in Settings; the shapes' rdm:languages are added to these. */
  languages: string[]
  /** URLs of ES modules that export extra widgets (see docs/CONFIG.md). */
  widgets: string[]
}

export const DEFAULT_CONFIG: AppConfig = {
  queryUrl: '',
  updateUrl: '',
  dataGraph: '',
  shapes: { source: 'endpoint', graph: '' },
  language: 'en',
  languages: ['en'],
  timeoutMs: 120_000,
  widgets: []
}

const STORAGE_KEY = 'rdf-data-manager.config'

/** Derives the query and update URLs of a Fuseki-style dataset URL. */
export function endpointsFromDataset (datasetUrl: string): { queryUrl: string; updateUrl: string } {
  const base = datasetUrl.trim().replace(/\/+$/, '')
  return { queryUrl: `${base}/query`, updateUrl: `${base}/update` }
}

export function isConfigured (config: AppConfig): boolean {
  return Boolean(config.queryUrl)
}

function readStorage (): Partial<AppConfig> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<AppConfig> : {}
  } catch {
    return {}
  }
}

export function saveConfig (config: AppConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Storage can be unavailable (private mode); the config then lives for this visit only.
  }
}

/**
 * Settings from URL parameters, so a link can open the app on a given endpoint:
 *   ?dataset=<Fuseki dataset URL> or ?query=<url>&update=<url>
 *   &shapesGraph=<iri> or &shapesUrl=<url>, &graph=<data graph>, &lang=<tag>
 */
function readUrlParams (search: string): Partial<AppConfig> {
  const params = new URLSearchParams(search)
  const out: Partial<AppConfig> = {}
  const dataset = params.get('dataset')
  if (dataset) Object.assign(out, endpointsFromDataset(dataset))
  if (params.get('query')) out.queryUrl = params.get('query')!
  if (params.get('update')) out.updateUrl = params.get('update')!
  if (params.get('graph') !== null) out.dataGraph = params.get('graph')!
  if (params.get('shapesGraph')) out.shapes = { source: 'endpoint', graph: params.get('shapesGraph')! }
  if (params.get('shapesUrl')) out.shapes = { source: 'url', url: params.get('shapesUrl')! }
  if (params.get('lang')) out.language = params.get('lang')!
  return out
}

/**
 * Optional config.json next to index.html, written at deploy time (for example by the
 * Docker entrypoint). It provides defaults; the user's saved settings and URL
 * parameters win over it, unless it sets "locked": true.
 */
async function readDeployConfig (): Promise<Partial<AppConfig> & { locked?: boolean }> {
  try {
    const response = await fetch('config.json', { cache: 'no-store' })
    if (!response.ok) return {}
    return await response.json() as Partial<AppConfig> & { locked?: boolean }
  } catch {
    return {}
  }
}

export async function loadConfig (): Promise<{ config: AppConfig; locked: boolean }> {
  const deploy = await readDeployConfig()
  const { locked = false, ...deployConfig } = deploy
  const merged: AppConfig = locked
    ? { ...DEFAULT_CONFIG, ...deployConfig }
    : { ...DEFAULT_CONFIG, ...deployConfig, ...readStorage(), ...readUrlParams(window.location.search) }
  if (merged.queryUrl && !merged.updateUrl) merged.updateUrl = merged.queryUrl
  return { config: merged, locked }
}
