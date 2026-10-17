import { useMemo, useState } from 'react'
import { useApp } from '../app/context'
import { href, navigate } from '../app/router'
import { useAsync } from '../app/useAsync'
import { LABEL_PROPERTIES, isValidIri, literal, localName, pickByLanguage } from '../rdf/terms'
import { labelOf, text, type NodeShape } from '../shapes/model'
import { emptyState, withLanguageSlots, type NodeState } from '../form/state'
import { buildDelete, loadForEditing, ownedOf, prepareSave, type LoadedResource, type PreparedSave } from '../data/editing'
import { NodeForm } from './NodeForm'

type Phase =
  | { name: 'editing' }
  | { name: 'saving' }
  | { name: 'blocked'; prepared: PreparedSave }
  | { name: 'saved'; prepared: PreparedSave }
  | { name: 'unchanged' }
  | { name: 'confirmDelete'; references: number }
  | { name: 'deleting' }
  | { name: 'error'; message: string }

function collectSubjects (node: NodeState, out = new Map<string, string>()): Map<string, string> {
  if (node.subject) out.set(node.id, node.subject.value)
  for (const list of Object.values(node.values)) for (const v of list) if (v.node) collectSubjects(v.node, out)
  return out
}

function titleOf (state: NodeState, languages: string[]): string | undefined {
  for (const p of LABEL_PROPERTIES) {
    const values = state.values[p]
    if (!values?.length) continue
    const terms = values.filter(v => v.text.trim()).map(v => v.lang ? literal(v.text, v.lang) : literal(v.text))
    const picked = pickByLanguage(terms, languages)
    if (picked) return picked.value
  }
  return undefined
}

export function ResourcePage ({ classIri, iri }: { classIri: string; iri?: string }) {
  const { model, languages } = useApp()
  const shape = model.shapeForClass(classIri)
  const entry = model.classes.find(c => c.iri === classIri)
  const className = entry ? labelOf(entry.label, classIri, languages) : localName(classIri)

  if (!shape) {
    return <div className='alert error'>No shape targets <code>{classIri}</code>.</div>
  }
  return iri
    ? <ExistingResource shape={shape} classIri={classIri} className={className} iri={iri} />
    : <NewResource shape={shape} classIri={classIri} className={className} />
}

function ExistingResource ({ shape, classIri, className, iri }: { shape: NodeShape; classIri: string; className: string; iri: string }) {
  const { model, repo } = useApp()
  const [version, setVersion] = useState(0)
  const [flash, setFlash] = useState<string>()
  const loaded = useAsync(() => loadForEditing(repo, model, shape, iri), [repo, model, shape, iri, version])
  if (loaded.status === 'loading') return <p className='muted'>Loading…</p>
  if (loaded.status === 'error') return <div className='alert error'>{loaded.error.message}</div>
  if (loaded.value.quads.length === 0) {
    return (
      <div className='alert error'>
        <code>{iri}</code> was not found. <a href={href({ name: 'class', classIri })}>Back to {className}</a>
      </div>
    )
  }
  // The key remounts the editor after a save reloads the resource, so it starts from the fresh state.
  return (
    <Editor
      key={version} shape={shape} classIri={classIri} className={className} iri={iri}
      loaded={loaded.value} initial={loaded.value.state} flash={flash}
      onSaved={message => { setFlash(message); setVersion(v => v + 1) }}
    />
  )
}

function NewResource ({ shape, classIri, className }: { shape: NodeShape; classIri: string; className: string }) {
  const { model } = useApp()
  const initial = useMemo(() => withLanguageSlots(emptyState(shape, model, classIri)), [shape, model, classIri])
  return <Editor shape={shape} classIri={classIri} className={className} initial={initial} />
}

function Editor ({ shape, classIri, className, iri, loaded, initial, flash, onSaved }: {
  shape: NodeShape
  classIri: string
  className: string
  iri?: string
  loaded?: LoadedResource
  initial: NodeState
  /** Message carried over from the save that reloaded this editor. */
  flash?: string
  onSaved?: (message: string) => void
}) {
  const { repo, validator, languages, notifyChanged } = useApp()
  const [state, setState] = useState(initial)
  const [phase, setPhase] = useState<Phase>({ name: 'editing' })
  const [localPart, setLocalPart] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [showUpdate, setShowUpdate] = useState(false)
  const readOnly = shape.readOnly

  const isNew = !iri
  const targetIri = iri ?? (shape.uriStart ? `${shape.uriStart}${localPart.trim()}` : localPart.trim())
  const prepared = phase.name === 'blocked' || phase.name === 'saved' ? phase.prepared : undefined
  const subjects = useMemo(() => prepared ? collectSubjects(prepared.state) : new Map<string, string>(), [prepared])
  const issues = prepared?.report.issues ?? []
  const title = titleOf(state, languages) ?? (iri ? localName(iri) : `New ${className.toLowerCase()}`)

  const change = (next: NodeState) => {
    setState(next)
    if (phase.name !== 'blocked') setPhase({ name: 'editing' })
  }

  const checkName = async (): Promise<boolean> => {
    if (!isNew) return true
    const part = localPart.trim()
    if (!part) {
      setNameError('Enter an identifier.')
      return false
    }
    if (shape.uriStart && shape.localNamePattern && !new RegExp(shape.localNamePattern).test(part)) {
      setNameError(text(shape.localNameDescription, languages) ? 'This identifier does not have the expected form.' : `The identifier must match ${shape.localNamePattern}.`)
      return false
    }
    if (!isValidIri(targetIri)) {
      setNameError(shape.uriStart ? 'The identifier contains characters that are not allowed in an IRI.' : 'Enter an absolute IRI.')
      return false
    }
    if (await repo.exists(targetIri)) {
      setNameError(`${targetIri} already exists.`)
      return false
    }
    setNameError(undefined)
    return true
  }

  const write = async (p: PreparedSave) => {
    setPhase({ name: 'saving' })
    try {
      await repo.update(p.update)
      const warnings = p.report.issues.filter(i => i.severity === 'Warning').length
      const message = `Saved.${warnings ? ` ${warnings} warning${warnings > 1 ? 's' : ''}: ${p.report.issues.filter(i => i.severity === 'Warning').map(i => i.message).join(' ')}` : ''}`
      setPhase({ name: 'saved', prepared: p })
      notifyChanged()
      if (isNew) navigate({ name: 'resource', classIri, iri: p.iri })
      else onSaved?.(message)
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const save = async () => {
    setPhase({ name: 'saving' })
    try {
      if (!(await checkName())) {
        setPhase({ name: 'editing' })
        return
      }
      const p = await prepareSave(repo, validator, { iri: targetIri, current: state, loaded })
      if (!p.diff.inserts.length && !p.diff.deletes.length) {
        setPhase({ name: 'unchanged' })
        return
      }
      if (!p.report.conforms) {
        setPhase({ name: 'blocked', prepared: p })
        return
      }
      await write(p)
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const askDelete = async () => {
    if (!loaded) return
    setPhase({ name: 'saving' })
    try {
      const references = await repo.incomingReferences(loaded.iri, ownedOf(loaded))
      setPhase({ name: 'confirmDelete', references })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const remove = async () => {
    if (!loaded) return
    setPhase({ name: 'deleting' })
    try {
      await repo.update(buildDelete(repo, loaded))
      navigate({ name: 'class', classIri })
      notifyChanged()
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const busy = phase.name === 'saving' || phase.name === 'deleting'
  const violations = issues.filter(i => i.severity === 'Violation').length
  const warnings = issues.filter(i => i.severity === 'Warning').length

  return (
    <section className='resource'>
      <nav className='crumbs'><a href={href({ name: 'class', classIri })}>{className}</a></nav>
      <div className='page-header'>
        <div>
          <h1>{title}</h1>
          {iri && <p className='mono small muted' title={iri}>{iri}</p>}
        </div>
        {!readOnly && (
          <div className='actions'>
            {!isNew && <button type='button' className='button danger' disabled={busy} onClick={() => void askDelete()}>Delete</button>}
            <button type='button' className='button primary' disabled={busy} onClick={() => void save()}>
              {phase.name === 'saving' ? 'Checking…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {phase.name === 'error' && <div className='alert error' role='alert'>{phase.message}</div>}
      {phase.name === 'editing' && flash && <div className='alert success' role='status'>{flash}</div>}
      {phase.name === 'unchanged' && <div className='alert info' role='status'>Nothing to save; no changes.</div>}
      {phase.name === 'saved' && (
        <div className='alert success' role='status'>
          Saved.{warnings > 0 && ` ${warnings} warning${warnings > 1 ? 's' : ''} remain, shown below.`}
        </div>
      )}
      {phase.name === 'blocked' && (
        <div className='alert error' role='alert'>
          <p>
            <strong>{violations} problem{violations > 1 ? 's' : ''}</strong> must be fixed before this conforms to the shapes
            {warnings > 0 && <> (and {warnings} warning{warnings > 1 ? 's' : ''})</>}. They are marked below.
          </p>
          <div className='actions'>
            <button type='button' className='button' onClick={() => void save()}>Check again</button>
            <button type='button' className='button danger' onClick={() => void write(phase.prepared)}>Save anyway</button>
          </div>
        </div>
      )}
      {phase.name === 'confirmDelete' && (
        <div className='alert warning' role='alert'>
          <p>
            Delete <strong>{title}</strong> and its {loaded?.quads.length ?? 0} triples?
            {phase.references > 0
              ? <> {phase.references} triple{phase.references > 1 ? 's' : ''} elsewhere still point to it and will be left dangling.</>
              : ' Nothing else refers to it.'}
          </p>
          <div className='actions'>
            <button type='button' className='button' onClick={() => setPhase({ name: 'editing' })}>Cancel</button>
            <button type='button' className='button danger' onClick={() => void remove()}>Delete</button>
          </div>
        </div>
      )}

      {isNew && (
        <div className='card identifier'>
          <label htmlFor='local-name'>Identifier<span className='required'>*</span></label>
          <div className='row'>
            {shape.uriStart && <span className='mono prefix' title={shape.uriStart}>{shape.uriStart}</span>}
            <input
              id='local-name' className='mono' value={localPart} aria-invalid={Boolean(nameError)}
              placeholder={shape.uriStart ? 'local name' : 'https://…'}
              onChange={e => { setLocalPart(e.target.value); setNameError(undefined) }}
            />
          </div>
          {text(shape.localNameDescription, languages) && <span className='hint'>{text(shape.localNameDescription, languages)}</span>}
          {nameError && <ul className='issues'><li className='violation'>{nameError}</li></ul>}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); void save() }}>
        <NodeForm node={state} onChange={change} issues={issues} subjects={subjects} />
      </form>

      {prepared && (
        <details className='update-preview' open={showUpdate} onToggle={e => setShowUpdate((e.target as HTMLDetailsElement).open)}>
          <summary>SPARQL update ({prepared.diff.deletes.length} removed, {prepared.diff.inserts.length} added)</summary>
          <pre>{prepared.update}</pre>
        </details>
      )}
    </section>
  )
}
