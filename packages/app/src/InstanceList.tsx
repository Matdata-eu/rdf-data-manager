import { useMemo, useState } from 'react'
import { declaredPrefixes, labelOf, localName, pickByLanguage, text, toCsv, toTable, toTurtle } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'
import { download, fileSlug } from './download'
import { t } from './i18n'
import { InstanceTable } from './InstanceTable'

export function InstanceList ({ classIri, view = 'list' }: { classIri: string; view?: 'list' | 'table' }) {
  const { model, repo, languages, revision } = useApp()
  const [filter, setFilter] = useState('')
  const entry = model.classes.find(c => c.iri === classIri)
  const shape = model.shapeForClass(classIri)
  const table = view === 'table' && Boolean(shape)
  const instances = useAsync(async () => table ? [] : repo.listInstances(classIri), [repo, classIri, revision, table])

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
          {shape && <a className='button' href={href({ name: 'validation', classIri })}>{t('Check')}</a>}
          {shape && !shape.readOnly && <a className='button' href={href({ name: 'translations', classIri })}>{t('Translations')}</a>}
          {shape && (
            <details className='menu'>
              <summary className='button'>{exporting ? t('Exporting…') : t('Export')}</summary>
              <div className='menu-items'>
                <button type='button' disabled={exporting} onClick={() => void exportAs('ttl')}>{t('Turtle (all triples)')}</button>
                <button type='button' disabled={exporting} onClick={() => void exportAs('csv')}>{t('CSV (one row per resource)')}</button>
              </div>
            </details>
          )}
          {shape && !shape.readOnly && <a className='button primary' href={href({ name: 'new', classIri })}>{t('New')}</a>}
        </div>
      </div>
      {exportError && <div className='alert error' role='alert'>{exportError}</div>}
      <div className='list-controls'>
        <input
          type='search' className='filter' placeholder={t('Filter by label or IRI')}
          value={filter} onChange={e => setFilter(e.target.value)} aria-label={t('Filter')}
        />
        {shape && (
          <nav className='view-switch' aria-label={t('View')}>
            <a href={href({ name: 'class', classIri })} aria-current={table ? undefined : 'page'}>{t('List')}</a>
            <a href={href({ name: 'class', classIri, view: 'table' })} aria-current={table ? 'page' : undefined}>{t('Table')}</a>
          </nav>
        )}
      </div>
      {table && shape && <InstanceTable classIri={classIri} shape={shape} filter={filter} />}
      {!table && instances.status === 'loading' && <p className='muted'>{t('Loading…')}</p>}
      {!table && instances.status === 'error' && <div className='alert error'>{instances.error.message}</div>}
      {!table && instances.status === 'ready' && (
        <>
          <p className='muted small'>{t('{shown} of {total}', { shown: rows.length, total: instances.value.length })}</p>
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
          {instances.value.length === 0 && <p className='muted'>{t('No instances yet.')}</p>}
        </>
      )}
    </section>
  )
}
