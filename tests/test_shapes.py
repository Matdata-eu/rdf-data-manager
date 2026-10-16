"""Validate the DIM metadata shapes against the sample data and the negative test cases.

Run with: python -m pytest tests
"""

from pathlib import Path

import pytest
from pyshacl import validate
from rdflib import Graph, Namespace
from rdflib.namespace import SH

ROOT = Path(__file__).resolve().parents[1]
SHAPES = ROOT / "shapes" / "dim-metadata.shapes.ttl"
SAMPLE = ROOT / "examples" / "dim-metadata.sample.ttl"
INVALID = sorted((ROOT / "tests" / "data" / "invalid").glob("*.ttl"))
BND = Namespace("https://data.banenor.no/data/")


@pytest.fixture(scope="module")
def shapes() -> Graph:
    return Graph().parse(SHAPES)


def run(data: Graph, shapes: Graph) -> Graph:
    _, report, _ = validate(data, shacl_graph=shapes, advanced=True, allow_warnings=True)
    return report


def results(report: Graph) -> list[tuple]:
    out = []
    for r in report.subjects(SH.resultSeverity, None):
        out.append(
            (
                report.value(r, SH.sourceShape),
                report.value(r, SH.sourceConstraint),
                report.value(r, SH.resultSeverity),
                str(report.value(r, SH.resultMessage)),
            )
        )
    return out


def test_shapes_are_valid_shacl(shapes):
    conforms, _, text = validate(shapes, meta_shacl=True, shacl_graph=shapes, advanced=True)
    # meta_shacl checks the shapes graph itself against SHACL-SHACL
    assert conforms, text


def test_sample_data_conforms_without_warnings(shapes):
    report = run(Graph().parse(SAMPLE), shapes)
    assert results(report) == []


@pytest.mark.parametrize("case", INVALID, ids=lambda p: p.stem)
def test_invalid_case_is_reported(case, shapes):
    header = dict(
        line[2:].split(": ", 1)
        for line in case.read_text(encoding="utf-8").splitlines()
        if line.startswith("# expect-")
    )
    expected_shape = BND[header["expect-shape"].strip()]
    expected_severity = SH[header["expect-severity"].strip()]

    found = results(run(Graph().parse(case), shapes))
    matching = [
        r for r in found if expected_shape in (r[0], r[1]) and r[2] == expected_severity
    ]
    assert matching, f"expected {header} but got {found}"
