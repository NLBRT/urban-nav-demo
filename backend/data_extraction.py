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
    print("Downloading OSM data...")
    G = ox.graph_from_place(
        city,
        network_type='walk',
        custom_filter='["highway"~"residential|living_street|service|footway|path|pedestrian|steps"]',
        retain_all=True
    )

    # Add edge geometries
    G = ox.add_edge_bearings(G)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)

    for node in G.nodes:
        if 'x' not in G.nodes[node] or 'y' not in G.nodes[node]:
            point = ox.projector.project_geometry(Point(G.nodes[node]['lon'], G.nodes[node]['lat']))[0]
            G.nodes[node]['x'] = point.x
            G.nodes[node]['y'] = point.y
    
    print("Projecting graph...")
    G_projected = ox.project_graph(G, to_crs="EPSG:32618")

    G_geo = ox.project_graph(G, to_crs="WGS84")
    for node in G_projected.nodes():
        G_projected.nodes[node]['lat'] = G_geo.nodes[node]['y']
        G_projected.nodes[node]['lon'] = G_geo.nodes[node]['x']
    
    print("Processing nodes...")
    # CORRECTED: Use new method to get nodes/edges
    nodes, edges = ox.graph_to_gdfs(G_projected)
    
    print("Fetching elevation data...")
    locations = list(zip(nodes['y'], nodes['x']))
    nodes['elevation'] = get_elevation(locations)
    
    print("Saving data...")
    ox.save_graphml(G_projected, './data/urban_nav_graph.graphml')
    nodes.to_csv('./data/nodes_metadata.csv')
    
    return G_projected

if __name__ == "__main__":
    process_osm_data()