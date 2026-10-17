import { readFileSync } from 'node:fs'
import { Parser } from 'n3'
import type { Quad } from '../src/rdf/terms'

/** Reads a Turtle file relative to the packages/ directory (fixtures live in shapes-dim). */
export function readTurtle (relativePath: string): Quad[] {
  return new Parser().parse(readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8'))
}
