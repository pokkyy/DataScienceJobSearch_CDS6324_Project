d3.csv("data/ds_salaries.csv", d3.autoType).then(function (data) {
    console.log("Raw data:", data);

    const dataWrangled = wrangleData(data);
    setupInteractivity(dataWrangled);
    createMap(dataWrangled);
    
    console.log("Wrangled data:", dataWrangled);
    
    // Event listener for Filter button
    document.getElementById('filterButton').addEventListener('click', function() {
        // Gather user input values
        const selectedEmploymentType = d3.select('input[name="employmentType"]:checked').node().value;
        const selectedExperienceLevel = d3.select('input[name="experienceLevel"]:checked').node().value;
        const selectedJobTitle = d3.select('#jobTitle').node().value;
        const selectedCompanySize = d3.select('input[name="companySize"]:checked').node().value;
        const selectedSalary = +document.getElementById('salaryUserInput').value;

        // Filter data based on user selections
        let filteredData = dataWrangled.data.filter(function(d) {
            return (!selectedEmploymentType || d.employment_type === selectedEmploymentType) &&
                   (!selectedExperienceLevel || d.experience_level === selectedExperienceLevel) &&
                   (!selectedJobTitle || d.job_title === selectedJobTitle) &&
                   (!selectedCompanySize || d.company_size === selectedCompanySize) &&
                   (!selectedSalary || +d.salary_in_usd >= selectedSalary);
        });

        // Update the map and table with filtered data
        const filteredWrangledData = wrangleData(filteredData); // Wrangle filtered data again if needed
        createMap(filteredWrangledData);
        makeGraphs(null, filteredWrangledData); // Pass null or relevant country data depending on your needs
    });
});

function wrangleData(data) {
    const salaryDict = {};
    const employmentTypes = new Set();
    const experienceLevels = new Set();
    const jobTitles = new Set();
    const companySizes = new Set();
    let minSalary = Infinity;
    let maxSalary = -Infinity;

    data.forEach(function (d) {
        if (!salaryDict[d.company_location]) {
            salaryDict[d.company_location] = { total: 0, count: 0 };
        }
        salaryDict[d.company_location].total += +d.salary_in_usd;
        salaryDict[d.company_location].count += 1;

        employmentTypes.add(d.employment_type);
        experienceLevels.add(d.experience_level);
        jobTitles.add(d.job_title);
        companySizes.add(d.company_size);

        if (d.salary_in_usd < minSalary) minSalary = d.salary_in_usd;
        if (d.salary_in_usd > maxSalary) maxSalary = d.salary_in_usd;
    });

    const averageSalaryDict = {};
    for (const location in salaryDict) {
        if (salaryDict[location].count > 0) {
            averageSalaryDict[location] = salaryDict[location].total / salaryDict[location].count;
        }
    }

    return {
        data,
        salaryDict,
        averageSalaryDict,
        employmentTypes,
        experienceLevels,
        jobTitles,
        companySizes,
        minSalary,
        maxSalary
    };
}

function setupInteractivity(dataWrangled) {
    const { employmentTypes, experienceLevels, jobTitles, companySizes, minSalary, maxSalary } = dataWrangled;

    employmentTypes.forEach(type => {
        d3.select("#employmentTypeContainer")
            .append("input")
            .attr("type", "radio")
            .attr("name", "employmentType")
            .attr("value", type);
        d3.select("#employmentTypeContainer").append("label").text(type);
    });

    experienceLevels.forEach(level => {
        d3.select("#experienceLevelContainer")
            .append("input")
            .attr("type", "radio")
            .attr("name", "experienceLevel")
            .attr("value", level);
        d3.select("#experienceLevelContainer").append("label").text(level);
    });

    jobTitles.forEach(title => {
        d3.select("#jobTitle").append("option").attr("value", title).text(title);
    });

    companySizes.forEach(size => {
        d3.select("#companySizeContainer")
            .append("input")
            .attr("type", "radio")
            .attr("name", "companySize")
            .attr("value", size);
        d3.select("#companySizeContainer").append("label").text(size);
    });

    d3.select("#salaryUserInput")
        .attr("type", "range")
        .attr("min", minSalary)
        .attr("max", maxSalary);
}

function createMap(dataWrangled) {
    const { averageSalaryDict } = dataWrangled;

    var map = L.map("jobMap").setView([0, 0], 2);
    var previousCountry = null;
    var currentCountry = null;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(map);

    d3.json("/data/custom.geo.json").then(function (geojson) {
        var colorScale = d3.scaleLinear()
            .domain([d3.min(Object.values(averageSalaryDict)), d3.max(Object.values(averageSalaryDict))])
            .range(["#B3CC8F", "#1A1F16"]);

        var filteredGeojson = geojson.features.filter(function (feature) {
            return feature.properties.name !== "Antarctica" &&
                averageSalaryDict[feature.properties.iso_a2] !== undefined;
        });

        L.geoJSON(filteredGeojson, {
            style: function (feature) {
                var averageSalary = averageSalaryDict[feature.properties.iso_a2] || 0;
                return {
                    fillColor: colorScale(averageSalary),
                    weight: 1,
                    opacity: 1,
                    color: "white",
                    fillOpacity: 0.8,
                };
            },
            onEachFeature: function (feature, layer) {
                var averageSalary = averageSalaryDict[feature.properties.iso_a2];
                layer.bindTooltip(
                    "<b>" + feature.properties.name + "</b><br>Average Salary: $" + averageSalary.toFixed(2),
                    { direction: "auto" }
                );

                layer.on("click", function () {
                    if (previousCountry) {
                        previousCountry.setStyle({
                            fillColor: colorScale(averageSalaryDict[previousCountry.feature.properties.iso_a2] || 0),
                        });
                    }
                    previousCountry = layer;
                    currentCountry = feature.properties.iso_a2;

                    makeGraphs(currentCountry, dataWrangled);

                    layer.setStyle({ fillColor: "#FECDAA" });
                });
            },
        }).addTo(map);

        var legend = L.control({ position: "bottomright" });

        legend.onAdd = function () {
            const div = L.DomUtil.create("div", "info legend"),
                grades = [0, 50000, 100000, 150000, 200000, 250000],
                labels = [];
                let from = null;
                let to = null;

            div.innerHTML += "<strong>Average Salary in USD</strong><br>";

            for (var i = 0; i < grades.length; i++) {
                from = grades[i];
                to = grades[i + 1];

                labels.push(
                    '<i style="background:' + colorScale(from + 1) + '"></i> $' + from + (to ? "&ndash;$" + to : "+")
                );
            }

            div.innerHTML += labels.join("<br>");
            return div;
        };

        legend.addTo(map);
    });
}

function makeGraphs(currentCountry, dataWrangled) {
    makeTable(currentCountry, dataWrangled.data);
}

function makeTable(currentCountry, data) {
    d3.select("#jobTable").selectAll("table").remove();

    var table = d3.select("#jobTable").append("table");

    var countryData = data.filter(function (d) {
        return d.company_location === currentCountry;
    });

    var header = table.append("tr");
    header.append("th").text("Job Title");
    header.append("th").text("Employment Type");
    header.append("th").text("Experience Level");
    header.append("th").text("Salary in USD ($)");

    var rows = table.selectAll("tr.data-row")
        .data(countryData)
        .enter()
        .append("tr")
        .classed("data-row", true);

    rows.append("td").text(function (d) {
        return d.job_title;
    });
    rows.append("td").text(function (d) {
        return d.employment_type;
    });
    rows.append("td").text(function (d) {
        return d.experience_level;
    });
    rows.append("td").text(function (d) {
        return +d.salary_in_usd.toFixed(2);
    });
}
