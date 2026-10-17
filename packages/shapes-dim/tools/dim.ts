/** Conventions of the Bane NOR DIM deployment that the tools default to. */
export const DEFAULT_SHAPES_GRAPH = 'https://data.banenor.no/data/_shapes_metadata'

/** Derives the query and update URLs of a Fuseki-style dataset URL. */
export function endpointsFromDataset (datasetUrl: string): { queryUrl: string; updateUrl: string } {
  const base = datasetUrl.trim().replace(/\/+$/, '')
  return { queryUrl: `${base}/query`, updateUrl: `${base}/update` }
}
