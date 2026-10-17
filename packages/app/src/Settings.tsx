import { useState, type FormEvent } from 'react'
import { endpointsFromDataset, type AppConfig, type ShapesSource } from './config'
import { DEMOS } from './demos'
import { t } from './i18n'

/** The configured and shape languages plus the current one, so a saved choice is never lost. */
function languageOptions (config: AppConfig, shapeLanguages: string[]): string[] {
  return [...new Set([...config.languages, ...shapeLanguages, config.language])]
}

function languageName (tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag, 'en'], { type: 'language' }).of(tag)
    return name && name !== tag ? `${name} (${tag})` : tag
  } catch {
    return tag
  }
}

interface Props {
  initial: AppConfig
  /** Languages the loaded shapes mention (rdm:languages), offered next to the configured ones. */
  shapeLanguages?: string[]
  onApply: (config: AppConfig) => void
  onCancel?: () => void
}

export function Settings ({ initial, shapeLanguages = [], onApply, onCancel }: Props) {
  const [config, setConfig] = useState<AppConfig>(initial)
  const [dataset, setDataset] = useState('')
  const [graph, setGraph] = useState(initial.shapes.source === 'endpoint' ? initial.shapes.graph : '')
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
      demo: undefined,
      queryUrl: config.queryUrl.trim(),
      updateUrl: (config.updateUrl || config.queryUrl).trim(),
      dataGraph: config.dataGraph.trim(),
      shapes
    })
  }
  const [demo, setDemo] = useState(initial.demo ?? DEMOS[0].name)
  const startDemo = () => onApply({ ...config, demo })

  const canApply = Boolean(config.queryUrl.trim()) &&
    (source === 'endpoint' ? Boolean(graph.trim()) : source === 'url' ? Boolean(url.trim()) : Boolean(file))

  return (
    <form className='card settings' onSubmit={submit}>
      <h1>{t('Settings')}</h1>
      <p className='muted'>
        {t('Connect to a SPARQL endpoint and choose the SHACL/DASH shapes that define the forms. Settings are kept in this browser.')}
      </p>

      <fieldset>
        <legend>{t('Endpoint')}</legend>
        <label>
          <span>{t('Dataset URL')} <small className='muted'>{t('(fills in both URLs for Fuseki)')}</small></span>
          <div className='row'>
            <input type='url' placeholder='http://localhost:3030/dataset/' value={dataset} onChange={e => setDataset(e.target.value)} />
            <button type='button' className='button' disabled={!dataset.trim()} onClick={() => setConfig(c => ({ ...c, ...endpointsFromDataset(dataset) }))}>{t('Use')}</button>
          </div>
        </label>
        <label>
          <span>{t('Query URL')}</span>
          <input type='url' required value={config.queryUrl} onChange={e => set('queryUrl', e.target.value)} />
        </label>
        <label>
          <span>{t('Update URL')}</span>
          <input type='url' value={config.updateUrl} onChange={e => set('updateUrl', e.target.value)} />
        </label>
        <label>
          <span>{t('Data graph')} <small className='muted'>{t('(empty: the default graph)')}</small></span>
          <input type='text' value={config.dataGraph} onChange={e => set('dataGraph', e.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>{t('Shapes')}</legend>
        <div className='radios'>
          <label><input type='radio' checked={source === 'endpoint'} onChange={() => setSource('endpoint')} /> {t('Named graph in the endpoint')}</label>
          <label><input type='radio' checked={source === 'url'} onChange={() => setSource('url')} /> {t('Turtle file at a URL')}</label>
          <label><input type='radio' checked={source === 'inline'} onChange={() => setSource('inline')} /> {t('Local Turtle file')}</label>
        </div>
        {source === 'endpoint' && (
          <label>
            <span>{t('Shapes graph')}</span>
            <input type='text' required placeholder='https://…' value={graph} onChange={e => setGraph(e.target.value)} />
          </label>
        )}
        {source === 'url' && (
          <label>
            <span>{t('Shapes URL')}</span>
            <input type='url' value={url} onChange={e => setUrl(e.target.value)} />
          </label>
        )}
        {source === 'inline' && (
          <label>
            <span>{t('Shapes file')} {file && <small className='muted'>{t('({name} loaded)', { name: file.name })}</small>}</span>
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
        <legend>{t('Display')}</legend>
        <label>
          <span>{t('Preferred language for labels and messages')}</span>
          <select value={config.language} onChange={e => set('language', e.target.value)}>
            {languageOptions(config, shapeLanguages).map(l => <option key={l} value={l}>{languageName(l)}</option>)}
          </select>
        </label>
      </fieldset>

      <div className='actions'>
        <button type='submit' className='button primary' disabled={!canApply}>{t('Connect')}</button>
        {onCancel && <button type='button' className='button' onClick={onCancel}>{t('Cancel')}</button>}
      </div>

      <fieldset className='demo'>
        <legend>{t('No endpoint? Try a demo')}</legend>
        <p className='muted small'>{t('The data is loaded into a store that runs in this browser tab. Nothing is sent anywhere, and a reload starts over.')}</p>
        <div className='row'>
          <select aria-label={t('Demo dataset')} value={demo} onChange={e => setDemo(e.target.value)}>
            {DEMOS.map(d => <option key={d.name} value={d.name}>{d.title}</option>)}
          </select>
          <button type='button' className='button' onClick={startDemo}>{t('Start demo')}</button>
        </div>
        <p className='muted small'>{DEMOS.find(d => d.name === demo)?.description}</p>
      </fieldset>
    </form>
  )
}
