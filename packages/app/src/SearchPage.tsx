import { labelOf, localName, pickByLanguage } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'

/** Results of the search box in the top bar: instances of every managed class whose label or IRI matches. */
export function SearchPage ({ query }: { query: string }) {
  const { model, repo, languages, revision } = useApp()
  const hits = useAsync(() => repo.search(model.classes.map(c => c.iri), query, 100), [repo, model, query, revision])
  const className = (iri: string) => {
    const c = model.classes.find(x => x.iri === iri)
    return c ? labelOf(c.label, iri, languages) : localName(iri)
  }
  return (
    <section>
      <div className='page-header'>
        <div>
          <h1>Search</h1>
          <p className='muted'>Resources whose label or IRI contains “{query}”.</p>
        </div>
      </div>
      {hits.status === 'loading' && <p className='muted'>Searching…</p>}
      {hits.status === 'error' && <div className='alert error'>{hits.error.message}</div>}
      {hits.status === 'ready' && (
        <>
          <p className='muted small'>{hits.value.length} result{hits.value.length === 1 ? '' : 's'}{hits.value.length === 100 ? ' (first 100)' : ''}</p>
          <ul className='instance-list'>
            {hits.value.map(h => (
              <li key={h.iri}>
                <a href={href({ name: 'resource', classIri: h.classIri, iri: h.iri })}>
                  <span className='label'>{pickByLanguage(h.labels, languages)?.value ?? localName(h.iri)} <span className='muted small'>{className(h.classIri)}</span></span>
                  <span className='iri'>{localName(h.iri)}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
