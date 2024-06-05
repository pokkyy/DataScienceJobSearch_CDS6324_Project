// Load data
d3.csv("data/ds_salaries.csv", d3.autoType).then(function(data){
    console.log(data[0]);


    // User input

    // Map
    var map = L.map('jobMap').setView([0, 0], 2);

    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Load GeoJSON data of world countries
    d3.json("/data/custom.geo.json").then(function(geojson) {
        // Add GeoJSON layer to map
        L.geoJSON(geojson, {
            style: function(feature) {
                return {
                    fillColor: getColor(feature.properties.counts),
                    weight: 1,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            }
        }).addTo(map);
    });

    // Define color scale for choropleth
    function getColor(d) {
        return d > 250000 ? '#1A1F16' :
            d > 200000 ? '#AE3F20' :
            d > 100000 ? '#345830' :
            d > 50000 ? '#4A7856' :
            '#94ECBE';
    }

    // Graphs
    // Job table
    // Job numbers
    // Avg salary
    // experience level
    // remote ratio
    // company size
});
