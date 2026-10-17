import { useMemo, useState } from 'react'
import {
  LABEL_PROPERTIES, assertUnchanged, buildDelete, describeChanges, emptyState, isValidIri, labelOf, literal, loadForEditing, localName,
  ownedOf, pickByLanguage, prepareSave, text, withLanguageSlots,
  type LoadedResource, type NodeShape, type NodeState, type PreparedSave
} from '@rdf-data-manager/core'
import { UsedBy } from './UsedBy'
import { OtherProperties } from './OtherProperties'
import { NodeForm, useAsync } from '@rdf-data-manager/react'
import { useApp } from './context'
import { href, navigate } from './router'
import { n, t } from './i18n'

type Phase =
  | { name: 'editing' }
  | { name: 'saving' }
  | { name: 'blocked'; prepared: PreparedSave }
  | { name: 'review'; prepared: PreparedSave }
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
    return <div className='alert error'>{t('No shape targets')} <code>{classIri}</code>.</div>
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
  if (loaded.status === 'loading') return <p className='muted'>{t('Loading…')}</p>
  if (loaded.status === 'error') return <div className='alert error'>{loaded.error.message}</div>
  if (loaded.value.quads.length === 0) {
    return (
      <div className='alert error'>
        <code>{iri}</code> {t('was not found.')} <a href={href({ name: 'class', classIri })}>{t('Back to {class}', { class: className })}</a>
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
  const { repo, model, validator, languages, notifyChanged } = useApp()
  const [state, setState] = useState(initial)
  const [phase, setPhase] = useState<Phase>({ name: 'editing' })
  const [localPart, setLocalPart] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [showUpdate, setShowUpdate] = useState(false)
  const readOnly = shape.readOnly

  const isNew = !iri
  const targetIri = iri ?? (shape.uriStart ? `${shape.uriStart}${localPart.trim()}` : localPart.trim())
  const prepared = phase.name === 'blocked' || phase.name === 'saved' || phase.name === 'review' ? phase.prepared : undefined
  const subjects = useMemo(() => prepared ? collectSubjects(prepared.state) : new Map<string, string>(), [prepared])
  const issues = prepared?.report.issues ?? []
  const title = titleOf(state, languages) ?? (iri ? localName(iri) : t('New {class}', { class: className.toLowerCase() }))

  const change = (next: NodeState) => {
    setState(next)
    if (phase.name !== 'blocked') setPhase({ name: 'editing' })
  }

  const checkName = async (): Promise<boolean> => {
    if (!isNew) return true
    const part = localPart.trim()
    if (!part) {
      setNameError(t('Enter an identifier.'))
      return false
    }
    if (shape.uriStart && shape.localNamePattern && !new RegExp(shape.localNamePattern).test(part)) {
      setNameError(text(shape.localNameDescription, languages) ? t('This identifier does not have the expected form.') : t('The identifier must match {pattern}.', { pattern: shape.localNamePattern }))
      return false
    }
    if (!isValidIri(targetIri)) {
      setNameError(shape.uriStart ? t('The identifier contains characters that are not allowed in an IRI.') : t('Enter an absolute IRI.'))
      return false
    }
    if (await repo.exists(targetIri)) {
      setNameError(t('{iri} already exists.', { iri: targetIri }))
      return false
    }
    setNameError(undefined)
    return true
  }

  const write = async (p: PreparedSave) => {
    setPhase({ name: 'saving' })
    try {
      if (loaded) await assertUnchanged(repo, loaded, model)
      await repo.update(p.update)
      if (isNew && !(await repo.exists(p.iri))) {
        throw new Error(t('{iri} was not created: it already existed, or the endpoint refused the update.', { iri: p.iri }))
      }
      const warnings = p.report.issues.filter(i => i.severity === 'Warning').length
      const message = `${t('Saved.')}${warnings ? ` ${n(warnings, '1 warning', '{n} warnings')}: ${p.report.issues.filter(i => i.severity === 'Warning').map(i => i.message).join(' ')}` : ''}`
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
      setPhase({ name: 'review', prepared: p })
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
            {!isNew && <button type='button' className='button danger' disabled={busy} onClick={() => void askDelete()}>{t('Delete')}</button>}
            <button type='button' className='button primary' disabled={busy} onClick={() => void save()}>
              {phase.name === 'saving' ? t('Checking…') : isNew ? t('Create') : t('Save')}
            </button>
          </div>
        )}
      </div>

      {phase.name === 'error' && <div className='alert error' role='alert'>{phase.message}</div>}
      {phase.name === 'editing' && flash && <div className='alert success' role='status'>{flash}</div>}
      {phase.name === 'unchanged' && <div className='alert info' role='status'>{t('Nothing to save; no changes.')}</div>}
      {phase.name === 'saved' && (
        <div className='alert success' role='status'>
          {t('Saved.')}{warnings > 0 && ` ${n(warnings, '1 warning remains, shown below.', '{n} warnings remain, shown below.')}`}
        </div>
      )}
      {phase.name === 'review' && (
        <div className='alert info review' role='status'>
          <p>
            <strong>{t('Review:')}</strong> {n(phase.prepared.diff.deletes.length, '1 triple removed', '{n} triples removed')},{' '}
            {t('{n} added', { n: phase.prepared.diff.inserts.length })}{warnings > 0 && n(warnings, ', with 1 warning shown below', ', with {n} warnings shown below')}.
          </p>
          <ChangeList prepared={phase.prepared} shape={shape} />
          <div className='actions'>
            <button type='button' className='button primary' onClick={() => void write(phase.prepared)}>{isNew ? t('Create') : t('Save')}</button>
            <button type='button' className='button' onClick={() => setPhase({ name: 'editing' })}>{t('Keep editing')}</button>
          </div>
        </div>
      )}
      {phase.name === 'blocked' && (
        <div className='alert error' role='alert'>
          <p>
            <strong>{n(violations, '1 problem', '{n} problems')}</strong> {t('must be fixed before this conforms to the shapes')}
            {warnings > 0 && <> {n(warnings, '(and 1 warning)', '(and {n} warnings)')}</>}. {t('They are marked below.')}
          </p>
          <div className='actions'>
            <button type='button' className='button' onClick={() => void save()}>{t('Check again')}</button>
            <button type='button' className='button danger' onClick={() => void write(phase.prepared)}>{t('Save anyway')}</button>
          </div>
        </div>
      )}
      {phase.name === 'confirmDelete' && (
        <div className='alert warning' role='alert'>
          <p>
            {t('Delete {title} and its {n} triples?', { title, n: loaded?.quads.length ?? 0 })}
            {phase.references > 0
              ? <> {n(phase.references, '1 triple elsewhere still points to it and will be left dangling.', '{n} triples elsewhere still point to it and will be left dangling.')}</>
              : ` ${t('Nothing else refers to it.')}`}
          </p>
          <div className='actions'>
            <button type='button' className='button' onClick={() => setPhase({ name: 'editing' })}>{t('Cancel')}</button>
            <button type='button' className='button danger' onClick={() => void remove()}>{t('Delete')}</button>
          </div>
        </div>
      )}

      {isNew && (
        <div className='card identifier'>
          <label htmlFor='local-name'>{t('Identifier')}<span className='required'>*</span></label>
          <div className='row'>
            {shape.uriStart && <span className='mono prefix' title={shape.uriStart}>{shape.uriStart}</span>}
            <input
              id='local-name' className='mono' value={localPart} aria-invalid={Boolean(nameError)}
              placeholder={shape.uriStart ? t('local name') : 'https://…'}
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
          <summary>{t('SPARQL update ({d} removed, {i} added)', { d: prepared.diff.deletes.length, i: prepared.diff.inserts.length })}</summary>
          <pre>{prepared.update}</pre>
        </details>
      )}
      {loaded && <OtherProperties quads={loaded.quads} iri={loaded.iri} shape={shape} />}
      {loaded && <UsedBy iri={loaded.iri} owned={ownedOf(loaded)} />}
    </section>
  )
}

/** The pending changes in the words of the shapes. */
function ChangeList ({ prepared, shape }: { prepared: PreparedSave; shape: NodeShape }) {
  const { model, languages } = useApp()
  const changes = useMemo(() => describeChanges(prepared.diff, prepared.iri, shape, model, languages), [prepared, shape, model, languages])
  return (
    <table className='data-table changes'>
      <tbody>
        {changes.map(c => (
          <tr key={`${c.subject} ${c.property}`}>
            <th scope='row'>{c.subjectLabel !== localName(prepared.iri) && <span className='muted small'>{c.subjectLabel} › </span>}{c.propertyLabel}</th>
            <td>
              {c.removed.map((v, i) => <del key={`d${i}`}>{v}</del>)}
              {c.added.map((v, i) => <ins key={`i${i}`}>{v}</ins>)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
