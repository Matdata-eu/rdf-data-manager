/** The demo datasets bundled with the app; their data and the store load on demand (demo.ts). */
export interface DemoInfo {
  name: string
  title: string
  description: string
}

export const DEMOS: DemoInfo[] = [
  {
    name: 'showcase',
    title: 'Feature tour: a railway network',
    description: 'Stations, lines, areas, closures and stored queries whose shapes use every editor, widget and SHACL feature the app supports, with a few deliberate validation problems.'
  },
  {
    name: 'dim',
    title: 'DIM metadata (Bane NOR)',
    description: 'Datasets, key figures and sections of the Digital Infrastructure Model, in English, Bokmål and Nynorsk.'
  },
  {
    name: 'geo-time',
    title: 'Places and events',
    description: 'Geometries on a map and intervals on a calendar: the map and time widgets.'
  }
]
