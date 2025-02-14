import osmnx as ox
import pandas as pd
import requests
from tqdm import tqdm

def get_elevation(locations, batch_size=100):
    """Fetch elevations using Open-Elevation API"""
    elevations = []
    api_url = "https://api.open-elevation.com/api/v1/lookup"
    
    #Processing in batches to avoid huge payloads
    for i in tqdm(range(0, len(locations), batch_size), desc="Fetching elevations"):
        batch = locations[i:i+batch_size]
        payload = {"locations": [{"latitude": lat, "longitude": lon} for lat, lon in batch]}
        
        try:
            response = requests.post(api_url, json=payload)
            response.raise_for_status()
            elevations += [result['elevation'] for result in response.json()['results']]
        except Exception as e:
            print(f"Error fetching elevations: {e}")
            elevations += [None] * len(batch)
            
    return elevations

def process_osm_data(city="Siliguri, India"):
    """Main processing function"""
    print("Downloading OSM data...")
    
    #OSMnx parameters
    G = ox.graph_from_place(
        city,
        network_type='walk',
        custom_filter='["highway"~"footway|path|pedestrian|steps"]',
        retain_all=True
    )
    
    print("Processing nodes...")
    nodes = ox.utils_graph.graph_to_gdfs(G, edges=False)
    
    print("Fetching elevation data...")
    locations = list(zip(nodes['y'], nodes['x']))  # (lat, lon) tuples
    
    nodes['elevation'] = get_elevation(locations)
    
    for node_id, elevation in zip(nodes.index, nodes['elevation']):
        G.nodes[node_id]['elevation'] = elevation
    
    print("Calculating slopes...")
    G = ox.add_edge_grades(G)
    
    print("Saving data...")
    ox.save_graphml(G, filepath='./data/urban_nav_graph.graphml')
    nodes.to_csv('./data/nodes_metadata.csv')
    
    print(f"Completed processing {len(nodes)} nodes!")
    return G

if __name__ == "__main__":
    process_osm_data()