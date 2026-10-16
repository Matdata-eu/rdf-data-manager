"""Validate the content of a SPARQL endpoint against the DIM metadata shapes.

Example:
    python tools/validate_endpoint.py http://localhost:8030/jena-fuseki/metadata/

The data is read with one CONSTRUCT over the default graph and all named graphs
except the shapes graph, so run it against a development copy if /metadata is large.
"""

import argparse
import sys
from pathlib import Path

import requests
from pyshacl import validate
from rdflib import Graph

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHAPES = ROOT / "shapes" / "dim-metadata.shapes.ttl"
SHAPES_GRAPH = "https://data.banenor.no/data/_shapes_metadata"

CONSTRUCT = f"""
CONSTRUCT {{ ?s ?p ?o }}
WHERE {{
  {{ ?s ?p ?o }}
  UNION
  {{ GRAPH ?g {{ ?s ?p ?o }} FILTER (?g != <{SHAPES_GRAPH}>) }}
}}
"""


def fetch(query_url: str) -> Graph:
    response = requests.post(
        query_url,
        data={"query": CONSTRUCT},
        headers={"Accept": "text/turtle"},
        timeout=300,
    )
    response.raise_for_status()
    return Graph().parse(data=response.text, format="turtle")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", help="Fuseki dataset URL, e.g. http://localhost:8030/jena-fuseki/metadata/")
    parser.add_argument("--shapes", type=Path, default=DEFAULT_SHAPES, help="Shapes file (default: %(default)s)")
    args = parser.parse_args()

    query_url = args.dataset.rstrip("/") + "/query"
    data = fetch(query_url)
    print(f"Read {len(data)} triples from {query_url}", file=sys.stderr)

    conforms, _, text = validate(
        data,
        shacl_graph=Graph().parse(args.shapes),
        advanced=True,
        allow_warnings=True,
    )
    print(text)
    return 0 if conforms else 1


if __name__ == "__main__":
    sys.exit(main())
