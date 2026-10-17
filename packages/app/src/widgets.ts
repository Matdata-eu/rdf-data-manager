import { WidgetRegistry, builtinWidgets, type Widget } from '@rdf-data-manager/react'

/**
 * Builds the widget registry: the built-in editors, then every module listed under
 * "widgets" in config.json. Each entry is the URL of an ES module whose default export
 * is a Widget or an array of Widgets, so a deployment adds widgets without a rebuild.
 */
export async function loadWidgets (urls: string[]): Promise<{ registry: WidgetRegistry; failed: string[] }> {
  const registry = new WidgetRegistry(builtinWidgets)
  const failed: string[] = []
  for (const url of urls) {
    try {
      const mod = await import(/* @vite-ignore */ url) as { default?: Widget | Widget[] }
      if (!mod.default) throw new Error('no default export')
      registry.register(mod.default)
    } catch (e) {
      console.error(`Widget module ${url} could not be loaded:`, e)
      failed.push(url)
    }
  }
  return { registry, failed }
}
