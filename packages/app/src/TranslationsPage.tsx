import { useMemo, useState } from 'react'
import {
  cellKey, labelOf, loadTranslations, localName, saveTranslations, text, translatableProperties,
  type TranslationRow, type TranslationSaveResult
} from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'

/** A grid of every language-tagged text of a class, one row per resource, for translating in bulk. */
export function TranslationsPage ({ classIri }: { classIri: string }) {
  const { model, repo, validator, languages, config, revision, notifyChanged } = useApp()
  const entry = model.classes.find(c => c.iri === classIri)
  const shape = model.shapeForClass(classIri)
  const properties = useMemo(() => shape ? translatableProperties(shape) : [], [shape])
  const langs = useMemo(() => {
    const out = new Set<string>(config.languages)
    for (const p of properties) for (const l of p.languages ?? p.languageIn ?? []) out.add(l)
    return [...out]
  }, [properties, config.languages])
  const [edits, setEdits] = useState<Map<string, Record<string, string>>>(new Map())
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<TranslationSaveResult[]>()
  const rows = useAsync(() => loadTranslations(repo, classIri, properties, languages), [repo, classIri, properties, languages, revision])
  const className = entry ? labelOf(entry.label, classIri, languages) : localName(classIri)

  if (!shape) return <div className='alert error'>No shape targets <code>{classIri}</code>.</div>

  const valueOf = (row: TranslationRow, key: string) => edits.get(row.iri)?.[key] ?? row.texts[key] ?? ''
  const edit = (iri: string, key: string, value: string, original: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      const cells = { ...(next.get(iri) ?? {}) }
      if (value === original) delete cells[key]
      else cells[key] = value
      if (Object.keys(cells).length) next.set(iri, cells)
      else next.delete(iri)
      return next
    })
  }
  const missing = (row: TranslationRow) => properties.some(p => langs.some(l => !valueOf(row, cellKey(p.path.value, l)).trim()))
  const visible = rows.status === 'ready' ? rows.value.filter(r => !onlyMissing || missing(r)) : []

  const save = async () => {
    setSaving(true)
    try {
      const out = await saveTranslations(repo, validator, model, classIri, edits)
      setResults(out)
      const failed = new Set(out.filter(r => r.error).map(r => r.iri))
      setEdits(prev => new Map([...prev].filter(([iri]) => failed.has(iri))))
      notifyChanged()
    } finally {
      setSaving(false)
    }
  }

  const changed = [...edits.values()].reduce((n, cells) => n + Object.keys(cells).length, 0)
  const failed = results?.filter(r => r.error) ?? []
  return (
    <section className='translations'>
      <nav className='crumbs'><a href={href({ name: 'class', classIri })}>{className}</a></nav>
      <div className='page-header'>
        <div>
          <h1>Translations</h1>
          <p className='muted'>Every text of {className.toLowerCase()} in every language. Edit the cells and save; each resource is checked against the shapes.</p>
        </div>
        <div className='actions'>
          <button type='button' className='button primary' disabled={!changed || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : changed ? `Save ${changed} change${changed === 1 ? '' : 's'}` : 'Save'}
          </button>
        </div>
      </div>
      {results && failed.length === 0 && <div className='alert success' role='status'>Saved {results.length} resource{results.length === 1 ? '' : 's'}.</div>}
      {failed.length > 0 && (
        <div className='alert error' role='alert'>
          <p><strong>{failed.length} resource{failed.length === 1 ? '' : 's'} not saved.</strong> The edits are kept in the grid.</p>
          <ul className='issues'>{failed.map(f => <li key={f.iri} className='violation'>{localName(f.iri)}: {f.error}</li>)}</ul>
        </div>
      )}
      {properties.length === 0 && <p className='muted'>This class has no language-tagged text properties.</p>}
      {rows.status === 'loading' && <p className='muted'>Loading…</p>}
      {rows.status === 'error' && <div className='alert error'>{rows.error.message}</div>}
      {rows.status === 'ready' && properties.length > 0 && (
        <>
          <label className='row small'>
            <input type='checkbox' checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            Only resources with a missing translation ({rows.value.filter(missing).length})
          </label>
          <div className='grid-scroll'>
            <table className='data-table grid'>
              <thead>
                <tr>
                  <th rowSpan={2}>Resource</th>
                  {properties.map(p => <th key={p.key} colSpan={langs.length}>{text(p.name, languages) || localName(p.path.value)}</th>)}
                </tr>
                <tr>{properties.flatMap(p => langs.map(l => <th key={`${p.key} ${l}`} className='lang'>{l}</th>))}</tr>
              </thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row.iri} className={edits.has(row.iri) ? 'changed' : undefined}>
                    <th scope='row'><a href={href({ name: 'resource', classIri, iri: row.iri })} title={row.iri}>{row.label}</a></th>
                    {properties.flatMap(p => langs.map(l => {
                      const key = cellKey(p.path.value, l)
                      const original = row.texts[key] ?? ''
                      const value = valueOf(row, key)
                      return (
                        <td key={key} className={value !== original ? 'edited' : !value.trim() ? 'missing' : undefined}>
                          <input
                            aria-label={`${row.label} ${text(p.name, languages) || localName(p.path.value)} ${l}`}
                            value={value} onChange={e => edit(row.iri, key, e.target.value, original)}
                          />
                        </td>
                      )
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && <p className='muted'>Nothing to show.</p>}
        </>
      )}
    </section>
  )
}
