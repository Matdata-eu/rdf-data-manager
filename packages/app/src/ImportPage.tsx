import { useState } from 'react'
import { checkImport, labelOf, localName, parseImport, writeImport, type ImportCheck, type ParsedImport } from '@rdf-data-manager/core'
import { useApp } from './context'
import { href } from './router'
import { n, t } from './i18n'

type Phase =
  | { name: 'editing' }
  | { name: 'checking' }
  | { name: 'checked'; parsed: ParsedImport; check: ImportCheck }
  | { name: 'writing'; parsed: ParsedImport }
  | { name: 'written'; count: number }
  | { name: 'error'; message: string }

/** Imports Turtle: the managed instances in it are validated against the shapes, then written (replacing existing ones). */
export function ImportPage () {
  const { model, repo, validator, languages, notifyChanged } = useApp()
  const [turtle, setTurtle] = useState('')
  const [fileName, setFileName] = useState<string>()
  const [phase, setPhase] = useState<Phase>({ name: 'editing' })
  const className = (iri: string) => {
    const c = model.classes.find(x => x.iri === iri)
    return c ? labelOf(c.label, iri, languages) : localName(iri)
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setTurtle(await file.text())
    setFileName(file.name)
    setPhase({ name: 'editing' })
  }

  const check = async () => {
    setPhase({ name: 'checking' })
    try {
      const parsed = await parseImport(turtle, model, repo)
      if (parsed.subjects.length === 0) throw new Error(t('No resource of a managed class was found. Instances need an rdf:type the shapes target.'))
      setPhase({ name: 'checked', parsed, check: await checkImport(parsed, model, repo, validator) })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const write = async (parsed: ParsedImport) => {
    setPhase({ name: 'writing', parsed })
    try {
      await writeImport(parsed, model, repo)
      notifyChanged()
      setPhase({ name: 'written', count: parsed.subjects.length })
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const busy = phase.name === 'checking' || phase.name === 'writing'
  return (
    <section className='import'>
      <div className='page-header'>
        <div>
          <h1>{t('Import')}</h1>
          <p className='muted'>{t('Paste or pick a Turtle file. Its resources are checked against the shapes before anything is written; existing resources are replaced.')}</p>
        </div>
      </div>
      {phase.name === 'error' && <div className='alert error' role='alert'>{phase.message}</div>}
      {phase.name === 'written' && <div className='alert success' role='status'>{n(phase.count, 'Imported 1 resource.', 'Imported {n} resources.')}</div>}
      <div className='card'>
        <label className='row small'>
          <input type='file' accept='.ttl,.nt,text/turtle' onChange={e => void pickFile(e.target.files?.[0])} />
          {fileName && <span className='muted'>{fileName}</span>}
        </label>
        <textarea
          aria-label={t('Turtle')} className='mono' rows={14} value={turtle} placeholder='@prefix ex: <https://example.org/> .&#10;ex:thing a ex:Thing ; …'
          onChange={e => { setTurtle(e.target.value); setPhase({ name: 'editing' }) }}
        />
        <div className='actions'>
          <button type='button' className='button primary' disabled={busy || !turtle.trim()} onClick={() => void check()}>
            {phase.name === 'checking' ? t('Checking…') : t('Check')}
          </button>
        </div>
      </div>
      {(phase.name === 'checked' || phase.name === 'writing') && (
        <div className={`alert ${phase.name === 'checked' && !phase.check.conforms ? 'error' : 'info'}`} role='status'>
          <p>
            <strong>{n(phase.parsed.subjects.length, '1 resource found', '{n} resources found')}</strong>
            {t(', {n} of which already exist and would be replaced.', { n: phase.parsed.subjects.filter(s => s.exists).length })}
            {phase.parsed.unmanaged > 0 && <> {n(phase.parsed.unmanaged, '1 triple about other subjects is written as it is.', '{n} triples about other subjects are written as they are.')}</>}
          </p>
          <ul className='import-list'>
            {phase.parsed.subjects.map(s => {
              const issues = phase.name === 'checked' ? phase.check.issues.get(s.iri) ?? [] : []
              return (
                <li key={s.iri}>
                  <span>
                    {s.exists ? <a href={href({ name: 'resource', classIri: s.classIri, iri: s.iri })}>{localName(s.iri)}</a> : <span className='mono'>{localName(s.iri)}</span>}
                    <span className='muted small'> {className(s.classIri)}, {s.exists ? t('exists') : t('new')}</span>
                  </span>
                  {issues.length > 0 && (
                    <ul className='issues'>
                      {issues.map((i, n) => <li key={n} className={i.severity.toLowerCase()}>{i.path && <span className='muted'>{localName(i.path)}: </span>}{i.message}</li>)}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          <div className='actions'>
            {phase.name === 'checked' && phase.check.conforms && (
              <button type='button' className='button primary' onClick={() => void write(phase.parsed)}>{t('Import')}</button>
            )}
            {phase.name === 'checked' && !phase.check.conforms && (
              <button type='button' className='button danger' onClick={() => void write(phase.parsed)}>{t('Import anyway')}</button>
            )}
            {phase.name === 'writing' && <span className='muted'>{t('Writing…')}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
