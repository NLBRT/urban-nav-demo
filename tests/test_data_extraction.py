import sys
import os
import pytest
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from backend.data_extraction import process_osm_data

def test_data_extraction():
    # Test with small area
    G = process_osm_data(city="Siliguri, India")
    
    # Check basic requirements
    assert len(G.nodes) > 50, "Should have reasonable number of nodes"
    assert 'elevation' in G.nodes[list(G.nodes)[0]], "Nodes should have elevation data"
    assert 'grade' in G.edges[list(G.edges)[0]], "Edges should have grade/slope data"
    
    # Check file output
    assert os.path.exists('./data/urban_nav_graph.graphml'), "Graph file missing"
    assert os.path.exists('./data/nodes_metadata.csv'), "Metadata file missing"