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
    // ("admin", "iso_a2", "geometry")
    d3.json("/data/custom.geo.json").then(function(geojson) {
        // get salary
        var salaryDict = {};
        data.forEach(function(d) {
            if (!salaryDict[d.company_location]) {
                salaryDict[d.company_location] = {total: 0, count: 0};
            }
            salaryDict[d.company_location].total += +d.salary_in_usd;
            salaryDict[d.company_location].count += 1;
        });

        // Calculate average salary for each location
        var averageSalaryDict = {};
        for (var location in salaryDict) {
            if (salaryDict[location].count > 0) { // Check if there is salary data for the location
                averageSalaryDict[location] = salaryDict[location].total / salaryDict[location].count;
            }
        }
        console.log(averageSalaryDict);

        // var colorScale = d3.scaleThreshold()
        //     .domain([25000, 50000, 75000, 100000, 150000, 200000, 250000]) // Define threshold values
        //     .range(['#DBE7C9', '#B3CC8F', '#789461', '#345830', '#1A1F16']); // Define corresponding colors
        var colorScale = d3.scaleLinear()
            .domain([d3.min(Object.values(averageSalaryDict)),
                    d3.max(Object.values(averageSalaryDict))])
            .range(['#B3CC8F', '#1A1F16']);
        
            // Filter out Antarctica
        var filteredGeojson = geojson.features.filter(function(feature) {
            return feature.properties.name !== "Antarctica" && averageSalaryDict[feature.properties.iso_a2] !== undefined;
        });

        // Add GeoJSON layer to map
        L.geoJSON(filteredGeojson, {
            style: function(feature) {
            var averageSalary = averageSalaryDict[feature.properties.iso_a2] || 0;
                return {
                    fillColor: colorScale(averageSalary),
                    weight: 1,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.8
                };
            },
            onEachFeature: function (feature, layer) {
                var averageSalary = averageSalaryDict[feature.properties.iso_a2];
                layer.bindTooltip('<b>' + feature.properties.name + '</b><br>Average Salary: $' + averageSalary.toFixed(2), { direction: 'auto' });
            }
        }).addTo(map);

        // Add legend to map
        var legend = L.control({ position: 'bottomright' });

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'),
                grades = [0, 50000, 100000, 150000, 200000, 250000],
                labels = [],
                from, to;
        
            // Add legend title
            div.innerHTML += '<strong>Average Salary in USD</strong><br>';
        
            // Loop through the grades to generate labels with colored squares
            for (var i = 0; i < grades.length; i++) {
                from = grades[i];
                to = grades[i + 1];
        
                labels.push(
                    '<i style="background:' + colorScale(from + 1) + '"></i> $' +
                    from + (to ? '&ndash;$' + to : '+'));
            }
        
            div.innerHTML += labels.join('<br>');
            return div;
        };
        
        legend.addTo(map);
    });
    // Graphs
    // Job table
    // Job numbers
    // Avg salary
    // experience level
    // remote ratio
    // company size
});
