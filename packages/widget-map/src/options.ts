/** Tile source and start view of the map. Change them with configureMap() before the first form renders. */
export const mapOptions = {
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  /** [latitude, longitude] shown when there is no geometry yet. */
  center: [60.4, 9.0] as [number, number],
  zoom: 5
}

export function configureMap (options: Partial<typeof mapOptions>): void {
  Object.assign(mapOptions, options)
}
