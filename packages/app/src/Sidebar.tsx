import { labelOf } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'

export function Sidebar ({ active, tool }: { active?: string; tool?: 'validation' | 'import' }) {
  const { model, repo, languages, revision } = useApp()
  const counts = useAsync(() => repo.countInstances(model.classes.map(c => c.iri)), [repo, model, revision])

  return (
    <nav className='sidebar' aria-label='Classes'>
      <ul>
        {model.classes.map(c => (
          <li key={c.iri}>
            <a href={href({ name: 'class', classIri: c.iri })} className={active === c.iri ? 'active' : undefined} title={c.iri}>
              <span>{labelOf(c.label, c.iri, languages)}</span>
              {counts.status === 'ready' && <span className='count'>{counts.value.get(c.iri) ?? 0}</span>}
            </a>
          </li>
        ))}
      </ul>
      {model.classes.length === 0 && <p className='muted small'>The shapes define no classes with an rdfs:label.</p>}
      <h2 className='sidebar-heading'>Tools</h2>
      <ul>
        <li><a href={href({ name: 'validation' })} className={tool === 'validation' ? 'active' : undefined}>Check all data</a></li>
        <li><a href={href({ name: 'import' })} className={tool === 'import' ? 'active' : undefined}>Import</a></li>
      </ul>
    </nav>
  )
}
