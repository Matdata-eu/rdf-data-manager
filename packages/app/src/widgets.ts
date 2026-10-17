import { WidgetRegistry, builtinWidgets, type Widget } from '@rdf-data-manager/react'

/**
 * Widgets that ship with the app, loaded on demand by name. They are separate chunks, so
 * a deployment that does not list them never downloads them (and their libraries).
 */
const bundled: Record<string, () => Promise<{ default: Widget | Widget[] }>> = {
  map: () => import('@rdf-data-manager/widget-map'),
  time: () => import('@rdf-data-manager/widget-time')
}

/**
 * Builds the widget registry: the built-in editors, then every entry listed under
 * "widgets" in config.json. An entry is the name of a bundled widget ("map", "time") or
 * the URL of an ES module whose default export is a Widget or an array of Widgets, so a
 * deployment adds widgets without a rebuild.
 */
export async function loadWidgets (entries: string[]): Promise<{ registry: WidgetRegistry; failed: string[] }> {
  const registry = new WidgetRegistry(builtinWidgets)
  const failed: string[] = []
  for (const entry of entries) {
    try {
      const mod = entry in bundled
        ? await bundled[entry]()
        : await import(/* @vite-ignore */ entry) as { default?: Widget | Widget[] }
      if (!mod.default) throw new Error('no default export')
      registry.register(mod.default)
    } catch (e) {
      console.error(`Widget ${entry} could not be loaded:`, e)
      failed.push(entry)
    }
  }
  return { registry, failed }
}
