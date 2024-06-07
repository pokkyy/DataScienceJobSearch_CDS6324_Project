// Load data
// countries all work using iso_a2 property

d3.csv("data/ds_salaries.csv", d3.autoType).then(function(data){
    console.log(data[0]);
    
    var currentCountry = null;

    // salary setup -------------------------------------------------------------------------------------------------------------------------------------
    var salaryDict = {};
    data.forEach(function(d) {
        if (!salaryDict[d.company_location]) {
            salaryDict[d.company_location] = {total: 0, count: 0};
        }
        salaryDict[d.company_location].total += +d.salary_in_usd;
        salaryDict[d.company_location].count += 1;
    });

    // Calculate average salary for each location
    // need work  on this to account for diff job titles, etc for full customisastion
    var averageSalaryDict = {};
    for (var location in salaryDict) {
        if (salaryDict[location].count > 0) { // Check if there is salary data for the location
            averageSalaryDict[location] = salaryDict[location].total / salaryDict[location].count;
        }
    }

    console.log(averageSalaryDict)

    // Graphs functions, so after call and theyll ploop
    // one func to call them all
    function makeGraphs(currentCountry) {
        makeTable(currentCountry);
    }
    
    // Job table test
    function makeTable(currentCountry) {
        // Remove existing table
        d3.select('#jobTable').selectAll("table").remove();

        // Create a new table
        var table = d3.select('#jobTable')
            .append('table');

        var countryData = data.filter(function(d) {
            return d.company_location === currentCountry;
        });

        // Append header row
        var header = table.append("tr");
        header.append("th").text("Job Title");
        header.append("th").text("Employment Type");
        header.append("th").text("Experience Level");

        // Append rows with data for the selected country
        var rows = table.selectAll("tr.data-row")
            .data(countryData)
            .enter()
            .append("tr")
            .classed("data-row", true);

        rows.append("td").text(function(d) { return d.job_title; });
        rows.append("td").text(function(d) { return d.employment_type; });
        rows.append("td").text(function(d) { return d.experience_level; });
    }

    // Job numbers
    // Avg salary
    // experience level
    // remote ratio
    // company size

    // User input

    // Map
    var map = L.map('jobMap').setView([0, 0], 2);
    var previousCountry = null;

    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);


    // probably need to change depending on user input, will think later once uve made it yes
    // Load GeoJSON data of world countries
    // ("admin", "iso_a2", "geometry")
    d3.json("/data/custom.geo.json").then(function(geojson) {
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

        // Add GeoJSON layer to map  --------------------------------------------------------------------------------------------------------------------------
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
                
                layer.on('click', function() {
                    if (previousCountry) {
                        previousCountry.setStyle({ fillColor: colorScale(averageSalaryDict[previousCountry.feature.properties.iso_a2] || 0) });
                    }
                    previousCountry = layer;
                    currentCountry = feature.properties.iso_a2;

                    makeGraphs(currentCountry)
                
                    layer.setStyle({ fillColor: '#FECDAA' });
                });
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
});
