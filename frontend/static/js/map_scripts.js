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
L.control.layers(null, null, { position: 'bottomright' }).addTo(map);

// Add a marker for demonstration
L.marker(initialCoordinates)
 .addTo(map)
 .bindPopup('Woohoo, glory to Open Data! :D');