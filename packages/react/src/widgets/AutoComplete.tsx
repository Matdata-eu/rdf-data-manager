import { useEffect, useId, useState } from 'react'
import { localName, namedNode, pickByLanguage, type SearchHit, type Term } from '@rdf-data-manager/core'
import { useForm } from '../context'
import { useAsync } from '../useAsync'
import type { WidgetEditorProps } from './types'

/**
 * dash:AutoCompleteEditor: a text box that searches the endpoint as the user types, for
 * classes with too many instances for a select. The chosen resource is shown by label.
 */
export function AutoComplete ({ property, value, onChange, id, invalid }: WidgetEditorProps) {
  const { repo, languages, revision } = useForm()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const listId = useId()
  const current = value.term?.value ?? ''

  // The label of the current value is looked up once, so the box shows a name rather than an IRI.
  const label = useAsync(async () => {
    if (!current) return undefined
    const map = await repo.labels([current]).catch(() => new Map<string, Term[]>())
    return pickByLanguage(map.get(current) ?? [], languages)?.value ?? localName(current)
  }, [repo, current, languages, revision])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!open || query.trim().length < 2) {
        setHits([])
        return
      }
      repo.search(property.classes, query, 20).then(found => { if (!cancelled) setHits(found) }, () => { if (!cancelled) setHits([]) })
    }, open ? 200 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [repo, property.classes, query, open])

  const pick = (iri: string) => {
    onChange({ ...value, text: iri, term: namedNode(iri) })
    setOpen(false)
    setQuery('')
  }

  return (
    <div className='autocomplete'>
      <input
        id={id} aria-invalid={invalid} role='combobox' aria-expanded={open} aria-controls={listId} aria-autocomplete='list'
        placeholder='Type to search…' title={current || undefined}
        value={open ? query : (label.status === 'ready' && label.value ? label.value : current ? localName(current) : '')}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
      />
      {current && !open && <button type='button' className='icon-button' title='Clear' aria-label='Clear' onClick={() => onChange({ ...value, text: '', term: undefined })}>×</button>}
      {open && (
        <ul id={listId} role='listbox' className='autocomplete-list'>
          {hits.map(h => (
            <li key={h.iri} role='option' aria-selected={h.iri === current} onMouseDown={() => pick(h.iri)}>
              <span>{pickByLanguage(h.labels, languages)?.value ?? localName(h.iri)}</span>
              <span className='mono small muted'>{localName(h.iri)}</span>
            </li>
          ))}
          {query.trim().length >= 2 && hits.length === 0 && <li className='muted small'>No matches</li>}
          {query.trim().length < 2 && <li className='muted small'>Type at least two characters</li>}
        </ul>
      )}
    </div>
  )
}
