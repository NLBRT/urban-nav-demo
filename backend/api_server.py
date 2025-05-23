from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/walk"

@app.route('/route', methods=['POST'])
def get_route():
    try:
        data = request.json
        start_lng = data['start_lng']
        start_lat = data['start_lat']
        end_lng = data['end_lng']
        end_lat = data['end_lat']

        # Construct OSRM API URL
        coordinates = f"{start_lng},{start_lat};{end_lng},{end_lat}"
        url = f"{OSRM_BASE_URL}/{coordinates}"
        
        # Request parameters
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'false'
        }

        response = requests.get(url, params=params)
        response_data = response.json()

        if response.status_code != 200:
            return jsonify({
                "error": "Routing failed",
                "message": response_data.get('message', 'Unknown error')
            }), 400

        # Extract coordinates from response
        route_coordinates = [
            [coord[1], coord[0]]  # Convert to [lat, lng] format
            for coord in response_data['routes'][0]['geometry']['coordinates']
        ]

        return jsonify({
            "status": "success",
            "route": route_coordinates,
            "distance": response_data['routes'][0]['distance'],
            "duration": response_data['routes'][0]['duration']
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/poi-data')
def get_poi_data():
    try:
        data_path = os.path.join(os.path.dirname(__file__), 'data', 'siliguri_pois.geojson')
        
        if not os.path.exists(data_path):
            app.logger.error(f"POI file not found at {data_path}")
            return jsonify({"error": "POI data not found"}), 404
            
        return send_file(
            data_path,
            mimetype='application/json',
            as_attachment=False
        )
        
    except Exception as e:
        app.logger.error(f"POI data error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)