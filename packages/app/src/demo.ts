import { MemoryClient, initMemoryStore } from '@rdf-data-manager/store-memory'
import type { AppConfig } from './config'
import { DEMOS, type DemoInfo } from './demos'
import dimShapes from '../../shapes-dim/shapes/dim-metadata.shapes.ttl?raw'
import dimData from '../../shapes-dim/examples/dim-metadata.sample.ttl?raw'
import geoShapes from '../../../examples/geo-time/shapes.ttl?raw'
import geoData from '../../../examples/geo-time/data.ttl?raw'
import showcaseShapes from '../../../examples/showcase/shapes.ttl?raw'
import showcaseData from '../../../examples/showcase/data.ttl?raw'

export interface Demo extends DemoInfo {
  shapes: string
  data: string
  widgets: string[]
  languages: string[]
}

/** Datasets bundled with the app that run in an in-browser store: nothing is sent anywhere. */
const content: Record<string, Omit<Demo, keyof DemoInfo>> = {
  dim: { shapes: dimShapes, data: dimData, widgets: [], languages: ['en', 'nb', 'nn'] },
  'geo-time': { shapes: geoShapes, data: geoData, widgets: ['map', 'time'], languages: ['en'] },
  showcase: { shapes: showcaseShapes, data: showcaseData, widgets: ['map', 'time'], languages: ['en', 'nb', 'nn'] }
}

export function findDemo (name: string): Demo | undefined {
  const info = DEMOS.find(d => d.name === name)
  return info && content[name] ? { ...info, ...content[name] } : undefined
}

/** A memory store loaded with the demo's data, and the config that points the app at it. */
export async function startDemo (demo: Demo, config: AppConfig): Promise<{ client: MemoryClient; config: AppConfig }> {
  await initMemoryStore()
  const client = new MemoryClient()
  client.loadTurtle(demo.data)
  return {
    client,
    config: {
      ...config,
      queryUrl: `demo:${demo.name}`,
      updateUrl: `demo:${demo.name}`,
      dataGraph: '',
      shapes: { source: 'inline', turtle: demo.shapes, name: `${demo.name}.ttl` },
      widgets: demo.widgets,
      languages: [...new Set([...config.languages, ...demo.languages])]
    }
  }
}
