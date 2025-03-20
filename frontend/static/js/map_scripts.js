// Initialize variables
let activePanel = null;
let activePickerType = null;
let mapClickHandler = null;
let routeLayer = null;

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
L.marker(initialCoordinates)
 .addTo(map)
 .bindPopup('Woohoo, glory to Open Data! :D');