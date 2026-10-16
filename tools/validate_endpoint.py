"""Validate the content of a SPARQL endpoint against the DIM metadata shapes.

Example:
    python tools/validate_endpoint.py http://localhost:8030/jena-fuseki/metadata/

By default only the data the shapes look at is read, with a few CONSTRUCT queries:
  - all triples of instances of the classes the shapes target or reference
    (sh:targetClass, sh:class), plus their csvw:tableSchema and its csvw:column nodes;
  - dcterms:isVersionOf, dcterms:created and spin:text of managed query versions;
  - the dcat:Distribution nodes linked from those instances (skip with --no-distributions).
Each pattern is matched in the default graph and in every named graph except the
shapes graph. Use --full to CONSTRUCT the whole dataset instead.
"""

import argparse
import sys
import time
from pathlib import Path

import requests
from pyshacl import validate
from rdflib import Graph
from rdflib.namespace import SH

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHAPES = ROOT / "shapes" / "dim-metadata.shapes.ttl"
SHAPES_GRAPH = "https://data.banenor.no/data/_shapes_metadata"
DISTRIBUTION = "http://www.w3.org/ns/dcat#Distribution"

PREFIXES = """
PREFIX csvw: <http://www.w3.org/ns/csvw#>
PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX spin: <http://spinrdf.org/spin#>
PREFIX yasgui: <https://matdata.eu/ns/yasgui#>
"""


def in_all_graphs(pattern: str) -> str:
    """Match a pattern in the default graph and in every named graph except the shapes graph."""
    return f"""
  {{ {pattern} }}
  UNION
  {{ GRAPH ?g {{ {pattern} }} FILTER (?g != <{SHAPES_GRAPH}>) }}
"""


def queries(classes: list[str], distributions: bool) -> dict[str, str]:
    values = "VALUES ?type { " + " ".join(f"<{c}>" for c in classes) + " }"
    result = {
        "instances": f"""
CONSTRUCT {{ ?s ?p ?o }}
WHERE {{ {values} {in_all_graphs("?s a ?type ; ?p ?o . FILTER (?p != dcat:distribution)")} }}
""",
        "table schemas": f"""
CONSTRUCT {{ ?x ?p ?o }}
WHERE {{ {values} {in_all_graphs("?s a ?type ; csvw:tableSchema|csvw:tableSchema/csvw:column ?x . ?x ?p ?o .")} }}
""",
        "query versions": f"""
CONSTRUCT {{ ?v dcterms:isVersionOf ?q ; dcterms:created ?created ; spin:text ?text }}
WHERE {{ {in_all_graphs('''
    ?v dcterms:isVersionOf ?q .
    ?q a yasgui:ManagedQuery .
    OPTIONAL { ?v dcterms:created ?created }
    OPTIONAL { ?v spin:text ?text }
''')} }}
""",
    }
    if distributions:
        result["distributions"] = f"""
CONSTRUCT {{ ?s dcat:distribution ?d . ?d ?p ?o }}
WHERE {{ {values} {in_all_graphs("?s a ?type ; dcat:distribution ?d . ?d ?p ?o .")} }}
"""
    return result


FULL = f"""
CONSTRUCT {{ ?s ?p ?o }}
WHERE {{ {in_all_graphs("?s ?p ?o")} }}
"""


def shape_classes(shapes: Graph) -> list[str]:
    """Classes the shapes target or require with sh:class, except distributions (read separately)."""
    classes = set(shapes.objects(None, SH.targetClass)) | set(shapes.objects(None, SH["class"]))
    return sorted(str(c) for c in classes if str(c) != DISTRIBUTION)


def fetch(query_url: str, query: str, timeout: int, into: Graph) -> None:
    response = requests.post(
        query_url,
        data={"query": PREFIXES + query},
        headers={"Accept": "application/n-triples"},
        timeout=timeout,
    )
    response.raise_for_status()
    into.parse(data=response.content.decode("utf-8"), format="nt")  # N-Triples is always UTF-8


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", help="Fuseki dataset URL, e.g. http://localhost:8030/jena-fuseki/metadata/")
    parser.add_argument("--shapes", type=Path, default=DEFAULT_SHAPES, help="Shapes file (default: %(default)s)")
    parser.add_argument("--full", action="store_true", help="Read the whole dataset instead of the shape targets")
    parser.add_argument("--no-distributions", action="store_true", help="Do not read dcat:Distribution nodes")
    parser.add_argument("--timeout", type=int, default=300, help="Timeout per query in seconds (default: %(default)s)")
    args = parser.parse_args()

    shapes = Graph().parse(args.shapes)
    query_url = args.dataset.rstrip("/") + "/query"
    todo = {"whole dataset": FULL} if args.full else queries(shape_classes(shapes), not args.no_distributions)

    data = Graph()
    for name, query in todo.items():
        started, before = time.monotonic(), len(data)
        fetch(query_url, query, args.timeout, data)
        print(f"Read {len(data) - before} triples ({name}) in {time.monotonic() - started:.1f}s", file=sys.stderr)
    print(f"Validating {len(data)} triples from {query_url}", file=sys.stderr)

    conforms, _, text = validate(data, shacl_graph=shapes, advanced=True, allow_warnings=True)
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    return 0 if conforms else 1


if __name__ == "__main__":
    sys.exit(main())
