import { useState } from 'react'
import { declaredPrefixes, localName, type PropertyShape, type Term, type ValueState } from '@rdf-data-manager/core'
import { useForm } from './context'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; text: string; columns: string[]; rows: Record<string, Term>[] }

function cell (t?: Term): string {
  if (!t) return ''
  return t.termType === 'NamedNode' ? localName(t.value) : t.value
}

/**
 * For a property with rdm:queryText: fetches the SPARQL text the value points at and
 * runs it on request, so a managed query can be checked without leaving the form.
 */
export function QueryPreview ({ property, value }: { property: PropertyShape; value: ValueState }) {
  const { repo, model } = useForm()
  const [state, setState] = useState<State>({ status: 'idle' })
  const iri = value.term?.termType === 'NamedNode' ? value.term.value : undefined
  if (!iri || !property.queryText) return null

  const run = async () => {
    setState({ status: 'loading' })
    try {
      const texts = await repo.texts(iri, property.queryText!, declaredPrefixes(model))
      if (texts.length === 0) throw new Error('No query text was found for this value.')
      const text = texts[0]
      const result = await repo.preview(text, 50)
      setState({ status: 'ready', text, ...result })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className='query-preview'>
      <button type='button' className='button ghost small' disabled={state.status === 'loading'} onClick={() => void run()}>
        {state.status === 'loading' ? 'Running…' : state.status === 'ready' ? 'Run again' : 'Preview query result'}
      </button>
      {state.status === 'error' && <span className='issues'><span className='violation'>{state.message}</span></span>}
      {state.status === 'ready' && (
        <div className='query-result'>
          <details>
            <summary className='small muted'>Query</summary>
            <pre>{state.text}</pre>
          </details>
          {state.rows.length === 0
            ? <p className='muted small'>No rows.</p>
            : (
                <table className='data-table'>
                  <thead><tr>{state.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {state.rows.map((r, i) => <tr key={i}>{state.columns.map(c => <td key={c} title={r[c]?.value}>{cell(r[c])}</td>)}</tr>)}
                  </tbody>
                </table>
              )}
          <p className='muted small'>{state.rows.length} row{state.rows.length === 1 ? '' : 's'}{state.rows.length === 50 ? ' (first 50)' : ''}</p>
        </div>
      )}
    </div>
  )
}
