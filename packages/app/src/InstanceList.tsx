import { useMemo, useState } from 'react'
import { labelOf, localName, pickByLanguage, text } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'

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

  return (
    <section>
      <div className='page-header'>
        <div>
          <h1>{title}</h1>
          {entry && <p className='muted'>{text(entry.comment, languages)}</p>}
        </div>
        {shape && !shape.readOnly && <a className='button primary' href={href({ name: 'new', classIri })}>New</a>}
      </div>
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
