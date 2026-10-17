import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Parser } from 'n3'
import type { Quad } from '@rdf-data-manager/core'

export const root = fileURLToPath(new URL('..', import.meta.url))

export function readTurtle (relativePath: string): Quad[] {
  return new Parser().parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'))
}

export function readText (relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}
