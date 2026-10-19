import { useMemo, useState } from 'react'
import {
  cellTerms, cellValue, gridColumns, loadGrid, localName, pickByLanguage, saveGrid, text,
  type GridColumn, type GridRow, type GridSaveResult, type InstanceSummary, type NodeShape, type Term
} from '@rdf-data-manager/core'
import { useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href } from './router'
import { n, t } from './i18n'

type Sort = { key: string; desc: boolean }

function compare (a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a.localeCompare(b)
}

/**
 * Every instance of a class as a row, with a column per property. Single-valued
 * properties are edited in the cells when the shapes allow writing; each edited row is
 * saved through the shapes like a form.
 */
export function InstanceTable ({ classIri, shape, filter }: { classIri: string; shape: NodeShape; filter: string }) {
  const { model, repo, validator, languages, revision, notifyChanged } = useApp()
  const columns = useMemo(() => gridColumns(shape), [shape])
  const rows = useAsync(() => loadGrid(repo, model, classIri, shape, columns, languages), [repo, model, classIri, shape, columns, languages, revision])
  const [edits, setEdits] = useState<Map<string, Record<string, string>>>(new Map())
  const [sort, setSort] = useState<Sort>({ key: '', desc: false })
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<GridSaveResult[]>()

  // Labels for IRIs in the cells, and the choices of editable instance columns.
  const pickers = useMemo(() => columns.filter(c => c.editable && c.kind === 'instances'), [columns])
  const options = useAsync(async () => {
    const out = new Map<string, InstanceSummary[]>()
    for (const c of pickers) out.set(c.property.key, await repo.options(c.property.classes))
    return out
  }, [repo, pickers, revision])
  const labels = useAsync(async () => {
    if (rows.status !== 'ready') return new Map<string, Term[]>()
    const iris = rows.value.flatMap(r => columns.flatMap(c => cellTerms(r.state, c.property)))
      .filter(term => term.termType === 'NamedNode').map(term => term.value)
    return repo.labels(iris)
  }, [repo, rows, columns])

  const labelFor = (iri: string): string => {
    const own = labels.status === 'ready' ? labels.value.get(iri) : undefined
    return pickByLanguage(own ?? [], languages)?.value ?? localName(iri)
  }
  const show = (term: Term): string => {
    if (term.termType === 'NamedNode') return labelFor(term.value)
    if (term.termType === 'BlankNode') return t('(nested node)')
    return term.value
  }
  const shown = (row: GridRow, c: GridColumn): string => {
    const terms = cellTerms(row.state, c.property)
    if (c.kind === 'langText' || c.kind === 'langTextarea') return pickByLanguage(terms, languages)?.value ?? ''
    return terms.map(show).join(', ')
  }
  const valueOf = (row: GridRow, c: GridColumn) => edits.get(row.iri)?.[c.property.path.value] ?? cellValue(row.state, c.property)
  const edit = (iri: string, path: string, value: string, original: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      const cells = { ...(next.get(iri) ?? {}) }
      if (value === original) delete cells[path]
      else cells[path] = value
      if (Object.keys(cells).length) next.set(iri, cells)
      else next.delete(iri)
      return next
    })
  }

  const visible = useMemo(() => {
    if (rows.status !== 'ready') return []
    const needle = filter.trim().toLowerCase()
    const out = rows.value.filter(r => !needle || r.label.toLowerCase().includes(needle) || r.iri.toLowerCase().includes(needle))
    const column = columns.find(c => c.property.key === sort.key)
    // Sort on the stored values, so rows do not jump while a cell is being edited.
    const keyOf = (r: GridRow) => column ? (column.editable ? cellValue(r.state, column.property) : shown(r, column)) : r.label
    const sorted = [...out].sort((a, b) => compare(keyOf(a), keyOf(b)))
    return sort.desc ? sorted.reverse() : sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, sort, columns, labels, languages])

  const save = async () => {
    if (rows.status !== 'ready') return
    setSaving(true)
    try {
      const loaded = new Map(rows.value.map(r => [r.iri, r.state]))
      const out = await saveGrid(repo, validator, model, classIri, edits, loaded)
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
  const editable = columns.some(c => c.editable)
  const sortBy = (key: string) => setSort(s => ({ key, desc: s.key === key ? !s.desc : false }))
  const arrow = (key: string) => sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''
  const nameOf = (c: GridColumn) => text(c.property.name, languages) || localName(c.property.path.value)

  const cell = (row: GridRow, c: GridColumn) => {
    const original = cellValue(row.state, c.property)
    const value = valueOf(row, c)
    const label = `${row.label} ${nameOf(c)}`
    const onChange = (v: string) => edit(row.iri, c.property.path.value, v, original)
    if (!c.editable) return <td key={c.property.key} className='readonly'>{shown(row, c)}</td>
    const className = value !== original ? 'edited' : undefined
    if (c.kind === 'boolean') {
      return (
        <td key={c.property.key} className={className}>
          <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
            <option value='' />
            <option value='true'>{t('Yes')}</option>
            <option value='false'>{t('No')}</option>
          </select>
        </td>
      )
    }
    if (c.kind === 'enum' || c.kind === 'instances') {
      const choices = c.kind === 'enum'
        ? (c.property.in ?? []).map(term => ({ value: term.value, label: show(term) }))
        : (options.status === 'ready' ? options.value.get(c.property.key) ?? [] : [])
            .map(o => ({ value: o.iri, label: pickByLanguage(o.labels, languages)?.value ?? localName(o.iri) }))
            .sort((a, b) => a.label.localeCompare(b.label))
      if (value && !choices.some(o => o.value === value)) choices.unshift({ value, label: labelFor(value) })
      return (
        <td key={c.property.key} className={className}>
          <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
            <option value='' />
            {choices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
      )
    }
    return (
      <td key={c.property.key} className={className}>
        <input aria-label={label} type={c.kind === 'date' ? 'date' : 'text'} value={value} onChange={e => onChange(e.target.value)} />
      </td>
    )
  }

  return (
    <div className='instance-table'>
      {editable && (
        <div className='table-toolbar'>
          <p className='muted small'>{t('Edit the cells and save; each resource is checked against the shapes. Texts in several languages are edited under Translations.')}</p>
          <button type='button' className='button primary' disabled={!changed || saving} onClick={() => void save()}>
            {saving ? t('Saving…') : changed ? n(changed, 'Save 1 change', 'Save {n} changes') : t('Save')}
          </button>
        </div>
      )}
      {results && failed.length === 0 && <div className='alert success' role='status'>{n(results.length, 'Saved 1 resource.', 'Saved {n} resources.')}</div>}
      {failed.length > 0 && (
        <div className='alert error' role='alert'>
          <p><strong>{n(failed.length, '1 resource not saved.', '{n} resources not saved.')}</strong> {t('The edits are kept in the grid.')}</p>
          <ul className='issues'>{failed.map(f => <li key={f.iri} className='violation'>{localName(f.iri)}: {f.error}</li>)}</ul>
        </div>
      )}
      {rows.status === 'loading' && <p className='muted'>{t('Loading…')}</p>}
      {rows.status === 'error' && <div className='alert error'>{rows.error.message}</div>}
      {rows.status === 'ready' && (
        <>
          <p className='muted small'>{t('{shown} of {total}', { shown: visible.length, total: rows.value.length })}</p>
          <div className='grid-scroll'>
            <table className='data-table grid'>
              <thead>
                <tr>
                  <th aria-sort={sort.key === '' ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                    <button type='button' className='sort' onClick={() => sortBy('')}>{t('Resource')}{arrow('')}</button>
                  </th>
                  {columns.map(c => (
                    <th key={c.property.key} title={text(c.property.description, languages) || c.property.path.value} aria-sort={sort.key === c.property.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                      <button type='button' className='sort' onClick={() => sortBy(c.property.key)}>{nameOf(c)}{arrow(c.property.key)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row.iri} className={edits.has(row.iri) ? 'changed' : undefined}>
                    <th scope='row'><a href={href({ name: 'resource', classIri, iri: row.iri })} title={row.iri}>{row.label === row.iri ? localName(row.iri) : row.label}</a></th>
                    {columns.map(c => cell(row, c))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.value.length === 0 && <p className='muted'>{t('No instances yet.')}</p>}
        </>
      )}
    </div>
  )
}
