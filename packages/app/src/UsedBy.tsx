import { labelOf, localName, pickByLanguage } from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'
import { n } from './i18n'

/** The triples elsewhere that point at a resource, with links where the subject is managed. */
export function UsedBy ({ iri, owned }: { iri: string; owned: string[] }) {
  const { repo, model, languages, revision } = useApp()
  const refs = useAsync(async () => {
    const list = await repo.references(iri, owned)
    const labels = await repo.labels(list.map(r => r.subject))
    return list.map(r => ({
      ...r,
      label: pickByLanguage(labels.get(r.subject) ?? [], languages)?.value ?? localName(r.subject),
      classIri: r.classes.find(c => model.shapeForClass(c))
    }))
  }, [repo, model, iri, owned.join(' '), languages, revision])
  if (refs.status !== 'ready' || refs.value.length === 0) return null
  const className = (c: string) => {
    const entry = model.classes.find(x => x.iri === c)
    return entry ? labelOf(entry.label, c, languages) : localName(c)
  }
  return (
    <details className='used-by'>
      <summary>{n(refs.value.length, 'Used by 1 resource', 'Used by {n} resources')}</summary>
      <ul>
        {refs.value.map(r => (
          <li key={`${r.subject} ${r.predicate}`}>
            {r.classIri
              ? <a href={href({ name: 'resource', classIri: r.classIri, iri: r.subject })}>{r.label}</a>
              : <span className='mono' title={r.subject}>{localName(r.subject)}</span>}
            <span className='muted small'> {r.classIri ? className(r.classIri) : ''} · {localName(r.predicate)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
