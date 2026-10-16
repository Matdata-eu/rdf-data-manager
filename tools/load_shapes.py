"""Upload the shapes into a named graph of a Fuseki dataset (replacing that graph).

Example:
    python tools/load_shapes.py http://localhost:8030/jena-fuseki/metadata/

Uses the SPARQL 1.1 Graph Store Protocol endpoint (<dataset>/data).
"""

import argparse
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHAPES = ROOT / "shapes" / "dim-metadata.shapes.ttl"
DEFAULT_GRAPH = "https://data.banenor.no/data/_shapes_metadata"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", help="Fuseki dataset URL, e.g. http://localhost:8030/jena-fuseki/metadata/")
    parser.add_argument("--shapes", type=Path, default=DEFAULT_SHAPES, help="Shapes file (default: %(default)s)")
    parser.add_argument("--graph", default=DEFAULT_GRAPH, help="Target named graph (default: %(default)s)")
    args = parser.parse_args()

    response = requests.put(
        args.dataset.rstrip("/") + "/data",
        params={"graph": args.graph},
        data=args.shapes.read_bytes(),
        headers={"Content-Type": "text/turtle; charset=utf-8"},
        timeout=60,
    )
    response.raise_for_status()
    print(f"Loaded {args.shapes.name} into <{args.graph}> ({response.status_code})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
