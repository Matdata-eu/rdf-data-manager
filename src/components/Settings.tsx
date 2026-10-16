import { useState, type FormEvent } from 'react'
import { DEFAULT_SHAPES_GRAPH, endpointsFromDataset, type AppConfig, type ShapesSource } from '../config/config'

interface Props {
  initial: AppConfig
  onApply: (config: AppConfig) => void
  onCancel?: () => void
}

export function Settings ({ initial, onApply, onCancel }: Props) {
  const [config, setConfig] = useState<AppConfig>(initial)
  const [dataset, setDataset] = useState('')
  const [graph, setGraph] = useState(initial.shapes.source === 'endpoint' ? initial.shapes.graph : DEFAULT_SHAPES_GRAPH)
  const [url, setUrl] = useState(initial.shapes.source === 'url' ? initial.shapes.url : '')
  const [file, setFile] = useState<{ name: string; turtle: string } | null>(
    initial.shapes.source === 'inline' ? { name: initial.shapes.name, turtle: initial.shapes.turtle } : null)
  const [source, setSource] = useState<ShapesSource['source']>(initial.shapes.source)

  const set = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => setConfig(c => ({ ...c, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const shapes: ShapesSource = source === 'endpoint'
      ? { source, graph: graph.trim() }
      : source === 'url'
        ? { source, url: url.trim() }
        : { source: 'inline', turtle: file?.turtle ?? '', name: file?.name ?? 'shapes.ttl' }
    onApply({
      ...config,
      queryUrl: config.queryUrl.trim(),
      updateUrl: (config.updateUrl || config.queryUrl).trim(),
      dataGraph: config.dataGraph.trim(),
      shapes
    })
  }

  const canApply = Boolean(config.queryUrl.trim()) &&
    (source === 'endpoint' ? Boolean(graph.trim()) : source === 'url' ? Boolean(url.trim()) : Boolean(file))

  return (
    <form className='card settings' onSubmit={submit}>
      <h1>Settings</h1>
      <p className='muted'>
        Connect to a SPARQL endpoint and choose the SHACL/DASH shapes that define the forms.
        Settings are kept in this browser.
      </p>

      <fieldset>
        <legend>Endpoint</legend>
        <label>
          <span>Dataset URL <small className='muted'>(fills in both URLs for Fuseki)</small></span>
          <div className='row'>
            <input type='url' placeholder='http://localhost:3030/dataset/' value={dataset} onChange={e => setDataset(e.target.value)} />
            <button type='button' className='button' disabled={!dataset.trim()} onClick={() => setConfig(c => ({ ...c, ...endpointsFromDataset(dataset) }))}>Use</button>
          </div>
        </label>
        <label>
          <span>Query URL</span>
          <input type='url' required value={config.queryUrl} onChange={e => set('queryUrl', e.target.value)} />
        </label>
        <label>
          <span>Update URL</span>
          <input type='url' value={config.updateUrl} onChange={e => set('updateUrl', e.target.value)} />
        </label>
        <label>
          <span>Data graph <small className='muted'>(empty: the default graph)</small></span>
          <input type='text' value={config.dataGraph} onChange={e => set('dataGraph', e.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Shapes</legend>
        <div className='radios'>
          <label><input type='radio' checked={source === 'endpoint'} onChange={() => setSource('endpoint')} /> Named graph in the endpoint</label>
          <label><input type='radio' checked={source === 'url'} onChange={() => setSource('url')} /> Turtle file at a URL</label>
          <label><input type='radio' checked={source === 'inline'} onChange={() => setSource('inline')} /> Local Turtle file</label>
        </div>
        {source === 'endpoint' && (
          <label>
            <span>Shapes graph</span>
            <input type='text' value={graph} onChange={e => setGraph(e.target.value)} />
          </label>
        )}
        {source === 'url' && (
          <label>
            <span>Shapes URL</span>
            <input type='url' value={url} onChange={e => setUrl(e.target.value)} />
          </label>
        )}
        {source === 'inline' && (
          <label>
            <span>Shapes file {file && <small className='muted'>({file.name} loaded)</small>}</span>
            <input
              type='file' accept='.ttl,text/turtle'
              onChange={async e => {
                const f = e.target.files?.[0]
                if (f) setFile({ name: f.name, turtle: await f.text() })
              }}
            />
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Display</legend>
        <label>
          <span>Preferred language for labels</span>
          <select value={config.language} onChange={e => set('language', e.target.value)}>
            <option value='en'>English (en)</option>
            <option value='nb'>Norsk bokmål (nb)</option>
            <option value='nn'>Norsk nynorsk (nn)</option>
          </select>
        </label>
      </fieldset>

      <div className='actions'>
        <button type='submit' className='button primary' disabled={!canApply}>Connect</button>
        {onCancel && <button type='button' className='button' onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
