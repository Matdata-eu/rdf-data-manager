import { Parser } from 'n3'
import { blankNode, literal, namedNode, type Quad, type Term } from '../rdf/terms'

export interface SparqlEndpoint {
  queryUrl: string
  updateUrl: string
  /** Extra HTTP headers, e.g. an Authorization header added by a hosting proxy. */
  headers?: Record<string, string>
  timeoutMs?: number
}

export type Bindings = Record<string, Term>

export class SparqlError extends Error {
  constructor (message: string, readonly status?: number, readonly body?: string) {
    super(message)
    this.name = 'SparqlError'
  }
}

interface JsonTerm {
  type: 'uri' | 'literal' | 'typed-literal' | 'bnode'
  value: string
  'xml:lang'?: string
  datatype?: string
}

function fromJson (t: JsonTerm): Term {
  switch (t.type) {
    case 'uri':
      return namedNode(t.value)
    case 'bnode':
      return blankNode(t.value)
    default:
      if (t['xml:lang']) return literal(t.value, t['xml:lang'])
      if (t.datatype) return literal(t.value, namedNode(t.datatype))
      return literal(t.value)
  }
}

/** Minimal SPARQL 1.1 protocol client (query + update) built on fetch. */
export class SparqlClient {
  constructor (readonly endpoint: SparqlEndpoint, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  private async post (url: string, field: 'query' | 'update', text: string, accept?: string): Promise<Response> {
    const controller = new AbortController()
    const timer = this.endpoint.timeoutMs ? setTimeout(() => controller.abort(), this.endpoint.timeoutMs) : undefined
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          ...(accept ? { Accept: accept } : {}),
          ...this.endpoint.headers
        },
        body: new URLSearchParams({ [field]: text }).toString(),
        signal: controller.signal
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new SparqlError(
        `Could not reach ${url} (${reason}). Check the URL, that the server is running and that it allows cross-origin (CORS) requests from this page.`
      )
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new SparqlError(`${field === 'query' ? 'Query' : 'Update'} failed: HTTP ${response.status} ${response.statusText}`, response.status, body)
    }
    return response
  }

  async select (query: string): Promise<Bindings[]> {
    const response = await this.post(this.endpoint.queryUrl, 'query', query, 'application/sparql-results+json')
    const json = await response.json() as { results: { bindings: Record<string, JsonTerm>[] } }
    return json.results.bindings.map(row => {
      const out: Bindings = {}
      for (const [name, value] of Object.entries(row)) out[name] = fromJson(value)
      return out
    })
  }

  async ask (query: string): Promise<boolean> {
    const response = await this.post(this.endpoint.queryUrl, 'query', query, 'application/sparql-results+json')
    const json = await response.json() as { boolean: boolean }
    return json.boolean
  }

  async construct (query: string): Promise<Quad[]> {
    const response = await this.post(this.endpoint.queryUrl, 'query', query, 'application/n-triples, text/turtle;q=0.9')
    const text = await response.text()
    const format = (response.headers.get('content-type') ?? '').includes('turtle') ? 'text/turtle' : 'application/n-triples'
    return new Parser({ format }).parse(text)
  }

  async update (update: string): Promise<void> {
    await this.post(this.endpoint.updateUrl, 'update', update)
  }
}
