import { useApp } from '../app/context'
import { href } from '../app/router'
import { useAsync } from '../app/useAsync'
import { labelOf } from '../shapes/model'

export function Sidebar ({ active }: { active?: string }) {
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
    </nav>
  )
}
