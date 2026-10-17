import { useCallback, useEffect, useMemo, useState } from 'react'
import { isConfigured, loadConfig, saveConfig, type AppConfig } from '../config/config'
import { Repository } from '../data/repository'
import { preferredLanguages } from '../rdf/terms'
import { ShapesValidator } from '../validation/validate'
import { AppContext, type AppServices } from '../app/context'
import { navigate, useRoute } from '../app/router'
import type { ShapesModel } from '../shapes/model'
import { Settings } from './Settings'
import { Sidebar } from './Sidebar'
import { InstanceList } from './InstanceList'
import { ResourcePage } from './ResourcePage'
import { Home } from './Home'
import { ErrorBoundary } from './ErrorBoundary'

type Boot =
  | { status: 'config' }
  | { status: 'loading'; config: AppConfig }
  | { status: 'error'; config: AppConfig; error: Error }
  | { status: 'ready'; config: AppConfig; repo: Repository; model: ShapesModel; validator: ShapesValidator }

export function App () {
  const [boot, setBoot] = useState<Boot>({ status: 'config' })
  const [locked, setLocked] = useState(false)
  const [initial, setInitial] = useState<AppConfig | null>(null)
  const [revision, setRevision] = useState(0)
  const route = useRoute()

  const start = useCallback(async (config: AppConfig) => {
    setBoot({ status: 'loading', config })
    try {
      const repo = new Repository(config)
      const model = await repo.loadShapes()
      const validator = new ShapesValidator(model.quads)
      setBoot({ status: 'ready', config, repo, model, validator })
    } catch (error) {
      setBoot({ status: 'error', config, error: error instanceof Error ? error : new Error(String(error)) })
    }
  }, [])

  useEffect(() => {
    loadConfig().then(({ config, locked }) => {
      setInitial(config)
      setLocked(locked)
      if (isConfigured(config)) void start(config)
    })
  }, [start])

  const services = useMemo<AppServices | null>(() => boot.status === 'ready'
    ? {
        config: boot.config,
        repo: boot.repo,
        model: boot.model,
        validator: boot.validator,
        languages: preferredLanguages(boot.config.language),
        revision,
        notifyChanged: () => setRevision(r => r + 1)
      }
    : null, [boot, revision])

  const config = boot.status === 'config' ? initial : boot.config
  const applySettings = (next: AppConfig) => {
    saveConfig(next)
    setInitial(next)
    navigate({ name: 'home' })
    void start(next)
  }

  const showSettings = route.name === 'settings' || boot.status === 'config' || boot.status === 'error'

  return (
    <div className='app'>
      <header className='topbar'>
        <a className='brand' href='#/'><img src='./favicon.svg' alt='' />RDF <b>Data</b> Manager</a>
        {config?.queryUrl && <span className='endpoint' title={config.queryUrl}>{config.queryUrl}</span>}
        {!locked && <a className='button ghost' href='#/settings'>Settings</a>}
      </header>
      {boot.status === 'loading' && <main className='content'><p className='muted'>Loading shapes…</p></main>}
      {showSettings && config && boot.status !== 'loading' && (
        <main className='content narrow'>
          {boot.status === 'error' && (
            <div className='alert error' role='alert'>
              <strong>Could not start.</strong> {boot.error.message}
            </div>
          )}
          {!locked && <Settings initial={config} onApply={applySettings} onCancel={boot.status === 'ready' ? () => navigate({ name: 'home' }) : undefined} />}
        </main>
      )}
      {services && !showSettings && (
        <AppContext.Provider value={services}>
          <div className='layout'>
            <Sidebar active={route.name === 'class' || route.name === 'resource' || route.name === 'new' ? route.classIri : undefined} />
            <main className='content'>
              <ErrorBoundary resetKey={window.location.hash}>
                {route.name === 'home' && <Home />}
                {route.name === 'class' && <InstanceList key={route.classIri} classIri={route.classIri} />}
                {route.name === 'resource' && <ResourcePage key={`${route.classIri} ${route.iri}`} classIri={route.classIri} iri={route.iri} />}
                {route.name === 'new' && <ResourcePage key={`new ${route.classIri}`} classIri={route.classIri} />}
              </ErrorBoundary>
            </main>
          </div>
        </AppContext.Provider>
      )}
    </div>
  )
}
