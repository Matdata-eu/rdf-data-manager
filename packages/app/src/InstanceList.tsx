import { useMemo, useState } from 'react'
import { declaredPrefixes, labelOf, localName, pickByLanguage, text, toCsv, toTable, toTurtle } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'
import { download, fileSlug } from './download'

export function InstanceList ({ classIri }: { classIri: string }) {
  const { model, repo, languages, revision } = useApp()
  const [filter, setFilter] = useState('')
  const entry = model.classes.find(c => c.iri === classIri)
  const shape = model.shapeForClass(classIri)
  const instances = useAsync(() => repo.listInstances(classIri), [repo, classIri, revision])

  const rows = useMemo(() => {
    if (instances.status !== 'ready') return []
    const needle = filter.trim().toLowerCase()
    return instances.value
      .map(i => ({ iri: i.iri, label: pickByLanguage(i.labels, languages)?.value ?? localName(i.iri) }))
      .filter(r => !needle || r.label.toLowerCase().includes(needle) || r.iri.toLowerCase().includes(needle))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [instances, filter, languages])

  const title = entry ? labelOf(entry.label, classIri, languages) : localName(classIri)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()

  const exportAs = async (format: 'ttl' | 'csv') => {
    if (!shape) return
    setExporting(true)
    setExportError(undefined)
    try {
      const quads = await repo.loadClassData(classIri, shape, model)
      if (format === 'ttl') download(`${fileSlug(title)}.ttl`, toTurtle(quads, declaredPrefixes(model)), 'text/turtle')
      else download(`${fileSlug(title)}.csv`, toCsv(toTable(classIri, shape, quads, languages)), 'text/csv')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section>
      <div className='page-header'>
        <div>
          <h1>{title}</h1>
          {entry && <p className='muted'>{text(entry.comment, languages)}</p>}
        </div>
        <div className='actions'>
          {shape && <a className='button' href={href({ name: 'validation', classIri })}>Check</a>}
          {shape && !shape.readOnly && <a className='button' href={href({ name: 'translations', classIri })}>Translations</a>}
          {shape && (
            <details className='menu'>
              <summary className='button'>{exporting ? 'Exporting…' : 'Export'}</summary>
              <div className='menu-items'>
                <button type='button' disabled={exporting} onClick={() => void exportAs('ttl')}>Turtle (all triples)</button>
                <button type='button' disabled={exporting} onClick={() => void exportAs('csv')}>CSV (one row per resource)</button>
              </div>
            </details>
          )}
          {shape && !shape.readOnly && <a className='button primary' href={href({ name: 'new', classIri })}>New</a>}
        </div>
      </div>
      {exportError && <div className='alert error' role='alert'>{exportError}</div>}
      <input
        type='search' className='filter' placeholder='Filter by label or IRI'
        value={filter} onChange={e => setFilter(e.target.value)} aria-label='Filter'
      />
      {instances.status === 'loading' && <p className='muted'>Loading…</p>}
      {instances.status === 'error' && <div className='alert error'>{instances.error.message}</div>}
      {instances.status === 'ready' && (
        <>
          <p className='muted small'>{rows.length} of {instances.value.length}</p>
          <ul className='instance-list'>
            {rows.map(r => (
              <li key={r.iri}>
                <a href={href({ name: 'resource', classIri, iri: r.iri })}>
                  <span className='label'>{r.label}</span>
                  <span className='iri'>{localName(r.iri)}</span>
                </a>
              </li>
            ))}
          </ul>
          {instances.value.length === 0 && <p className='muted'>No instances yet.</p>}
        </>
      )}
    </section>
  )
}
