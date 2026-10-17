import { useMemo } from 'react'
import {
  DASH, EDITOR_KINDS, editorFor, localName, namedNode, pickByLanguage, toNT,
  type EditorKind, type InstanceSummary, type Repository
} from '@rdf-data-manager/core'
import { useForm, useT } from '../context'
import { useAsync } from '../useAsync'
import type { Widget, WidgetEditorProps } from './types'
import { AutoComplete } from './AutoComplete'

interface EditorProps extends WidgetEditorProps {
  kind: EditorKind
}

/** Option lists per repository, so a stale app context never serves another endpoint. */
const optionCaches = new WeakMap<Repository, Map<string, Promise<InstanceSummary[]>>>()

function loadOptions (repo: Repository, classes: string[], revision: number): Promise<InstanceSummary[]> {
  let cache = optionCaches.get(repo)
  if (!cache) {
    cache = new Map()
    optionCaches.set(repo, cache)
  }
  const key = `${revision} ${classes.join(' ')}`
  if (!cache.has(key)) {
    // A new revision makes every earlier list stale; drop them.
    cache.clear()
    const promise = repo.options(classes)
    promise.catch(() => cache.delete(key))
    cache.set(key, promise)
  }
  return cache.get(key)!
}

function LanguageInput ({ property, value, onChange }: Pick<EditorProps, 'property' | 'value' | 'onChange'>) {
  const t = useT()
  const choices = property.languages ?? property.languageIn
  const fixed = Boolean(property.languages?.includes(value.lang ?? '') && property.uniqueLang)
  if (fixed) return <span className='lang-tag' title={t('Language')}>{value.lang}</span>
  if (choices) {
    const options = value.lang && !choices.includes(value.lang) ? [...choices, value.lang] : choices
    return (
      <select className='lang-select' value={value.lang ?? ''} aria-label={t('Language')} onChange={e => onChange({ ...value, lang: e.target.value || undefined })}>
        <option value=''>–</option>
        {options.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    )
  }
  return (
    <input
      className='lang-input' value={value.lang ?? ''} placeholder={t('lang')} aria-label={t('Language')}
      onChange={e => onChange({ ...value, lang: e.target.value.trim() || undefined })}
    />
  )
}

function InstancesSelect ({ property, value, onChange, id, invalid }: WidgetEditorProps) {
  const { repo, revision, languages } = useForm()
  const t = useT()
  const options = useAsync(() => loadOptions(repo, property.classes, revision), [repo, property.classes.join(' '), revision])
  const items = useMemo(() => {
    if (options.status !== 'ready') return []
    return options.value
      .map(o => ({ iri: o.iri, label: pickByLanguage(o.labels, languages)?.value ?? localName(o.iri) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [options, languages])
  const current = value.term?.value ?? ''
  const known = items.some(i => i.iri === current)
  return (
    <select
      id={id} aria-invalid={invalid} value={current}
      onChange={e => {
        const picked = e.target.value
        onChange({ ...value, text: picked, term: picked ? namedNode(picked) : undefined })
      }}
    >
      <option value=''>{options.status === 'loading' ? t('Loading…') : t('— choose —')}</option>
      {current && !known && <option value={current}>{localName(current)}</option>}
      {items.map(i => <option key={i.iri} value={i.iri} title={i.iri}>{i.label}</option>)}
    </select>
  )
}

function EnumSelect ({ property, value, onChange, id, invalid }: WidgetEditorProps) {
  const options = property.in ?? []
  const current = value.term ? toNT(value.term) : ''
  return (
    <select
      id={id} aria-invalid={invalid} value={current}
      onChange={e => {
        const term = options.find(o => toNT(o) === e.target.value)
        onChange({ ...value, text: term?.value ?? '', term })
      }}
    >
      <option value=''>— choose —</option>
      {options.map(o => <option key={toNT(o)} value={toNT(o)}>{o.termType === 'NamedNode' ? localName(o.value) : o.value}</option>)}
    </select>
  )
}

function Editor (props: EditorProps) {
  const { kind, property, value, onChange, id, invalid } = props
  const setText = (text: string) => onChange({ ...value, text })
  switch (kind) {
    case 'textarea':
      return <textarea id={id} aria-invalid={invalid} rows={3} value={value.text} onChange={e => setText(e.target.value)} />
    case 'langText':
    case 'langTextarea':
      return (
        <div className='with-lang'>
          {kind === 'langText'
            ? <input id={id} aria-invalid={invalid} type='text' value={value.text} onChange={e => setText(e.target.value)} />
            : <textarea id={id} aria-invalid={invalid} rows={3} value={value.text} onChange={e => setText(e.target.value)} />}
          <LanguageInput property={property} value={value} onChange={onChange} />
        </div>
      )
    case 'date':
      return <input id={id} aria-invalid={invalid} type='date' value={value.text} onChange={e => setText(e.target.value)} />
    case 'dateTime':
      return <input id={id} aria-invalid={invalid} type='datetime-local' step='1' value={value.text.replace(/Z$/, '').slice(0, 19)} onChange={e => setText(e.target.value)} />
    case 'boolean':
      return (
        <select id={id} aria-invalid={invalid} value={value.text} onChange={e => setText(e.target.value)}>
          <option value=''>—</option>
          <option value='true'>true</option>
          <option value='false'>false</option>
        </select>
      )
    case 'instances':
      return <InstancesSelect {...props} />
    case 'enum':
      return <EnumSelect {...props} />
    case 'uri':
      return <input id={id} aria-invalid={invalid} type='url' placeholder='https://…' value={value.text} onChange={e => setText(e.target.value)} />
    default: {
      const numeric = property.datatype && /#(integer|int|long|short|decimal|double|float|nonNegativeInteger|positiveInteger)$/.test(property.datatype)
      return (
        <input
          id={id} aria-invalid={invalid} type={numeric ? 'number' : 'text'}
          step={numeric && /integer|int|long|short/i.test(property.datatype!) ? 1 : 'any'}
          pattern={property.pattern && !numeric ? property.pattern : undefined}
          value={value.text} onChange={e => setText(e.target.value)}
        />
      )
    }
  }
}

/** The dash:editor IRI each built-in kind implements. */
const EDITOR_IRI: Record<EditorKind, string> = {
  text: DASH.TextFieldEditor,
  textarea: DASH.TextAreaEditor,
  langText: DASH.TextFieldWithLangEditor,
  langTextarea: DASH.TextAreaWithLangEditor,
  date: DASH.DatePickerEditor,
  dateTime: DASH.DateTimePickerEditor,
  boolean: DASH.BooleanSelectEditor,
  enum: DASH.EnumSelectEditor,
  instances: DASH.InstancesSelectEditor,
  uri: DASH.URIEditor,
  details: DASH.DetailsEditor
}

/**
 * One widget per built-in editor kind. Each scores 10 for the properties DASH's own
 * rules would give it (see editorFor), so a shape without dash:editor gets the same
 * widget it always did, and a custom widget wins by scoring higher or by being named.
 */
export const builtinWidgets: Widget[] = [
  ...EDITOR_KINDS.filter(kind => kind !== 'details').map((kind): Widget => ({
    id: EDITOR_IRI[kind],
    score: p => editorFor(p) === kind ? 10 : 0,
    Editor: props => <Editor {...props} kind={kind} />
  })),
  // Searches the endpoint instead of listing every instance; chosen by naming it in dash:editor.
  { id: DASH.AutoCompleteEditor, score: p => editorFor(p) === 'instances' && p.classes.length > 0 ? 9 : 0, Editor: AutoComplete }
]
