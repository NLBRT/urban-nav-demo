// Initialize variables
let activePanel = null;
let activePickerType = null;
let mapClickHandler = null;
let routeLayer = null;

let poiGeoJson = { features: [] }; 
let isPoiDataLoaded = false;

// Initialize map with POI data load
function initMap() {
    // ... existing map initialization code ...

    // Load POI data
    fetch('/api/poi-data')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            poiGeoJson = data;
            isPoiDataLoaded = true;
            console.log('POI data loaded with', data.features.length, 'features');
        })
        .catch(error => {
            console.error('POI data load failed:', error);
            isPoiDataLoaded = false;
        });
}

// Updated filtering function
function updatePOIMarkers() {
    poiMarkers.clearLayers();

    const activeFilters = Array.from(document.querySelectorAll('.poi-category input:checked'))
        .flatMap(checkbox => JSON.parse(checkbox.dataset.tags));

    if (activeFilters.length === 0) return;

    const filteredFeatures = poiGeoJson.features.filter(feature => {
        return activeFilters.some(filter => {
            const [key, value] = filter.includes('=') ? filter.split('=') : [filter, null];
            const propValue = feature.properties[key];
            
            if (value === null) return propValue !== undefined; // Key exists check
            if (value === '*') return true; // Wildcard check
            return propValue === value;
        });
    });

    filteredFeatures.forEach(feature => {
        const coords = feature.geometry.type === 'Point' ? 
            [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] : // Convert [lng,lat] to [lat,lng]
            [feature.geometry.coordinates[0][1], feature.geometry.coordinates[0][0]];

        const marker = L.marker(coords, {
            icon: getCategoryIcon(feature.properties)
        }).bindPopup(getPopupContent(feature.properties));
        
        poiMarkers.addLayer(marker);
    });

    poiMarkers.addTo(map);
}

// Update event listeners
document.querySelectorAll('.poi-category input').forEach(checkbox => {
    checkbox.addEventListener('change', updatePOIMarkers);
});

async function calculateRoute() {
    const startInput = document.getElementById('start-point').value;
    const endInput = document.getElementById('end-point').value;

    try {
        // Parse coordinates
        const [startLat, startLng] = startInput.split(',').map(parseFloat);
        const [endLat, endLng] = endInput.split(',').map(parseFloat);

        // Request route from backend
        const response = await fetch('http://localhost:5001/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start_lat: startLat,
                start_lng: startLng,
                end_lat: endLat,
                end_lng: endLng
            })
        });

        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message);
        }

        // Clear previous route
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }

        // Draw new route
        routeLayer = L.polyline(data.route, {
            color: '#6600cc',
            weight: 6,
            opacity: 0.67,
            lineJoin: 'round'
        }).addTo(map);

        // Zoom to route
        map.fitBounds(routeLayer.getBounds());

    } catch (error) {
        alert(`Routing failed: ${error.message}`);
        console.error('Routing error:', error);
    }
}

function drawRoute(coordinates) {
    // Clear previous layers
    if (routeLayer) {
        routeLayer.remove()
    }
    
    // Validate coordinates
    if (coordinates.length < 2) {
        alert('Route calculation failed: Insufficient points');
        return;
    }

    // Create polyline with interpolation
    routeLayer = L.polyline(coordinates, {
        color: '#6600cc',
        weight: 6,
        opacity: 0.67,
        lineJoin: 'round',
        smoothFactor: 1
    }).addTo(map);

    // Add start/end markers
    L.marker(coordinates[0], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        })
    }).addTo(map).bindPopup('Start Point');

    L.marker(coordinates[coordinates.length - 1], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        })
    }).addTo(map).bindPopup('End Point');

    // Zoom to route
    map.fitBounds(routeLayer.getBounds());
}

const greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Search functionality
document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('place-search').value;
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        if (results.length > 0) {
            const firstResult = results[0];
            map.setView([firstResult.lat, firstResult.lon], 16);
            L.marker([firstResult.lat, firstResult.lon]).addTo(map)
                .bindPopup(firstResult.display_name);
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
});

// Panel toggle functionality
document.querySelectorAll('.main-button').forEach(button => {
    button.addEventListener('click', function() {
        const parent = this.closest('.control-button');
        if (activePanel === parent) {
            parent.classList.remove('active');
            activePanel = null;
        } else {
            if (activePanel) activePanel.classList.remove('active');
            parent.classList.add('active');
            activePanel = parent;
        }
    });
});

// Directions Panel Functionality
let startMarker = null;
let endMarker = null;

// Map click handler for point selection
function handleMapClickForPoint(pointType) {
    return function(e) {
        const input = document.getElementById(`${pointType}-point`);
        input.value = formatCoordinate(e.latlng.lat, e.latlng.lng);
        
        if (pointType === 'start') {
            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker(e.latlng, {icon: greenIcon}).addTo(map);
        } else {
            if (endMarker) map.removeLayer(endMarker);
            endMarker = L.marker(e.latlng, {icon: redIcon}).addTo(map);
        }
    };
}

// Assign map pickers
document.querySelectorAll('.map-picker').forEach(button => {
    button.addEventListener('click', function() {
        // Remove any existing click handler
        if (mapClickHandler) {
            map.off('click', mapClickHandler);
        }
        
        // Get which point type we're setting
        const inputGroup = this.closest('.input-group');
        activePickerType = inputGroup.querySelector('input').id.split('-')[0];
        
        // Add visual feedback
        inputGroup.classList.add('active-picking');
        
        // Create new handler that self-destructs after use
        mapClickHandler = function(e) {
            const input = document.getElementById(`${activePickerType}-point`);
            input.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
            
            // Update marker
            if (activePickerType === 'start') {
                if (startMarker) map.removeLayer(startMarker);
                startMarker = L.marker(e.latlng, {icon: greenIcon}).addTo(map);
            } else {
                if (endMarker) map.removeLayer(endMarker);
                endMarker = L.marker(e.latlng, {icon: redIcon}).addTo(map);
            }
            
            // Clean up
            map.off('click', mapClickHandler);
            inputGroup.classList.remove('active-picking');
            mapClickHandler = null;
        };
        
        // Add the temporary click handler
        map.on('click', mapClickHandler);
    });
});


// Geolocation for start point
document.querySelector('.geolocate').addEventListener('click', function() {
    map.locate({setView: true, maxZoom: 16})
        .on('locationfound', e => {
            document.getElementById('start-point').value = 
                `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker(e.latlng, {icon: greenIcon}).addTo(map);
        });
});

// Swap points
document.querySelector('.swap-points').addEventListener('click', function() {
    const startInput = document.getElementById('start-point');
    const endInput = document.getElementById('end-point');
    [startInput.value, endInput.value] = [endInput.value, startInput.value];
    
    // Also swap markers
    if (startMarker && endMarker) {
        const startLatLng = startMarker.getLatLng();
        const endLatLng = endMarker.getLatLng();
        startMarker.setLatLng(endLatLng);
        endMarker.setLatLng(startLatLng);
    }
});

// Initialize map with Siliguri Coords
const initialCoordinates = [26.704661, 88.445896];
const map = L.map('map').setView(initialCoordinates, 17);

// Add OSMF tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
}).addTo(map);

// Add basic controls
L.control.scale().addTo(map);

// Add a marker for demonstration
/* L.marker(initialCoordinates)
 .addTo(map)
 .bindPopup('Woohoo, glory to Open Data! :D'); */ //commented out


 let searchMarkers = [];

// Search functionality
document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('place-search').value;
    if (!query) return;

    try {
        // Clear previous results
        clearSearchResults();
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
        );
        const results = await response.json();
        
        const resultsPanel = document.getElementById('search-results-panel');
        const resultsList = document.getElementById('results-list');
        
        if (results.length === 0) {
            resultsList.innerHTML = '<div class="result-item">No results found</div>';
            resultsPanel.classList.remove('hidden');
            return;
        }

        // Populate results
        resultsList.innerHTML = results.map((result, index) => `
            <div class="result-item" data-lat="${result.lat}" data-lon="${result.lon}">
                <div class="result-title">${result.display_name.split(',')[0]}</div>
                <div class="result-details">
                    ${result.display_name.split(',').slice(1).join(',')}
                </div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                showResultOnMap(lat, lon, item.querySelector('.result-title').textContent);
            });
        });

        resultsPanel.classList.remove('hidden');

    } catch (error) {
        console.error('Search failed:', error);
        alert('Search failed. Please try again.');
    }
});

// Close panel functionality
document.getElementById('close-panel').addEventListener('click', () => {
    document.getElementById('search-results-panel').classList.add('hidden');
    clearSearchResults();
});

function showResultOnMap(lat, lon, title) {
    // Clear previous markers
    searchMarkers.forEach(marker => marker.remove());
    searchMarkers = [];
    
    // Add new marker
    const marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(title);
    
    searchMarkers.push(marker);
    map.setView([lat, lon], 16);
}

function clearSearchResults() {
    searchMarkers.forEach(marker => marker.remove());
    searchMarkers = [];
    document.getElementById('results-list').innerHTML = '';


}

let poiData = null;
let activeMarkers = L.layerGroup();

// Load data on map init
function initMap() {
    // ... existing map init code
    
    // Load POI data
    fetch('/api/poi-data')
        .then(response => response.json())
        .then(data => {
            poiData = data;
            console.log('Loaded', data.features.length, 'POIs');
        });
}

function updatePOIMarkers() {
    // Clear existing markers
    poiMarkers.clearLayers();
    
    // Check if data is loaded and valid
    if (!isPoiDataLoaded || !poiGeoJson?.features) {
        console.warn('POI data not loaded yet');
        return;
    }

    // Get active filters
    const activeFilters = Array.from(document.querySelectorAll('.poi-category input:checked'))
        .flatMap(checkbox => JSON.parse(checkbox.dataset.tags));

    // Exit if no filters
    if (activeFilters.length === 0) return;

    // Filter features
    const filteredFeatures = poiGeoJson.features.filter(feature => {
        return activeFilters.some(filter => {
            const [key, value] = filter.includes('=') ? filter.split('=') : [filter, null];
            const propValue = feature.properties?.[key];
            
            // Handle different filter types
            if (value === null) return propValue !== undefined; // Key exists
            if (value === '*') return true; // Wildcard match
            return propValue === value;
        });
    });

    // Create markers
    filteredFeatures.forEach(feature => {
        try {
            const coords = getCoordinates(feature.geometry);
            if (!coords) return;

            const marker = L.marker(coords, {
                icon: getCategoryIcon(feature.properties)
            }).bindPopup(getPopupContent(feature.properties));
            
            poiMarkers.addLayer(marker);
        } catch (error) {
            console.error('Error creating marker:', error);
        }
    });

    // Add to map
    poiMarkers.addTo(map);
}

// Add coordinate extraction helper
function getCoordinates(geometry) {
    if (!geometry) return null;
    
    try {
        switch(geometry.type) {
            case 'Point':
                return [geometry.coordinates[1], geometry.coordinates[0]];
            case 'LineString':
            case 'Polygon':
                const firstCoord = geometry.coordinates[0];
                return Array.isArray(firstCoord[0]) ? 
                    [firstCoord[0][1], firstCoord[0][0]] :
                    [firstCoord[1], firstCoord[0]];
            default:
                console.warn('Unsupported geometry type:', geometry.type);
                return null;
        }
    } catch (error) {
        console.error('Coordinate extraction failed:', error);
        return null;
    }
}

// Add GPX parser library (include this before map_scripts.js in your HTML)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/gpx.min.js"></script>

let gpxTrack = null;

document.getElementById('gpx-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Clear existing track
    if (gpxTrack) {
        map.removeLayer(gpxTrack);
    }

    // Create new GPX track
    gpxTrack = new L.GPX(file, {
        async: true,
        polyline_options: {
            color: 'hotpink',
            weight: 5,
            opacity: 0.8,
            lineCap: 'round'
        },
        marker_options: {
            startIcon: null,
            endIcon: null,
            shadowUrl: null
        }
    });

    // Add to map and zoom to track
    gpxTrack.on('addline', function(e) {
        map.fitBounds(e.line.getBounds());
    });
    
    gpxTrack.addTo(map);
});