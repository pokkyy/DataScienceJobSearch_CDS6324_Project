const state = {
    data: [],
    avgSalary: {},
    previousCountry: null,
    currentCountry: "",
    selectedEmploymentType: [],
    selectedExperienceLevels: [],
    selectedJobTitle: "",
    selectedCompanySize: "",
    selectedMinSalary: 0,
    selectedMaxSalary: Infinity
};

// for map
let map;
let legend;
let employeeResidenceLayer;

// visuals
const jobTable = makeTable();
const jobMap = createMap();


// Mapping dictionaries for employment types and experience levels
const employmentTypeMap = {
    "PT": "Part-time",
    "FT": "Full-time",
    "CT": "Contract",
    "FL": "Freelance"
};

const experienceLevelMap = {
    "EN": "Entry-level / Junior",
    "MI": "Mid-level / Intermediate",
    "SE": "Senior-level / Expert",
    "EX": "Executive-level / Director"
};

//------------------------------------------------------------------------------------------------  GRAPHS
function createMap() {
    if (map) {
        map.remove();
    }

    map = L.map("jobMap").setView([0, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(map);

    function update(newData) {
        const { companyLocations } = newData;
        var averageSalaryDict = state.avgSalary;  // keeping colour consisten

        d3.json("/data/custom.geo.json").then(function (geojson) {
            var colorScale = d3.scaleLinear()
                .domain([d3.min(Object.values(averageSalaryDict)), d3.max(Object.values(averageSalaryDict))])
                .range(["#B3CC8F", "#1A1F16"]);

            var filteredGeojson = geojson.features.filter(function (feature) {
                return feature.properties.name !== "Antarctica" &&
                    averageSalaryDict[feature.properties.iso_a2] !== undefined &&
                    companyLocations.has(feature.properties.iso_a2); // Filter based on company locations in filtered data
            });

            // Remove previous layers before adding new ones
            map.eachLayer(function (layer) {
                if (layer instanceof L.GeoJSON) {
                    map.removeLayer(layer);
                }
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
                        "<b>" + feature.properties.name + "</b><br>Average Salary: $" + (averageSalary ? averageSalary.toFixed(2) : "N/A"),
                        { direction: "auto" }
                    );

                    layer.on("click", function () {
                        if (state.previousCountry) {
                            state.previousCountry.setStyle({
                                fillColor: colorScale(averageSalaryDict[state.previousCountry.feature.properties.iso_a2] || 0),
                            });
                        }
                        state.previousCountry = layer;
                        state.currentCountry = feature.properties.iso_a2;

                        layer.setStyle({ fillColor: "#FECDAA" });

                        console.log('Current Country: ' + state.currentCountry);
                        updateApp();
                    });
                },
            }).addTo(map);

            if (legend) {
                map.removeControl(legend);
            }

            legend = L.control({ position: "bottomright" });

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
    return update;
}

function makeTable() {
    d3.select("#jobTable").selectAll("table").remove();

    var table = d3.select("#jobTable").append("table");

    function update(newData) {
        console.log("Table data:", newData); // Log newData to check its type

        newData.sort((a, b) => a.job_title.localeCompare(b.job_title));

        table.selectAll("tr").remove();

        var header = table.append("tr");
        header.append("th").text("Job Title");
        header.append("th").text("Employment Type");
        header.append("th").text("Experience Level");
        header.append("th").text("Salary in USD ($)");

        var rows = table.selectAll("tr.data-row")
            .data(newData)
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
    return update;
}

// ------------------------------------------------------------------------------------------------
function setupInteractivity(data) {
    const { employmentTypes, experienceLevels, jobTitles, companySizes, minSalary, maxSalary } = data;

    // employmentTypes.forEach(type => {
    //     d3.select("#employmentTypeContainer")
    //         .append("input")
    //         .attr("type", "radio")
    //         .attr("name", "employmentType")
    //         .attr("value", type);
    //     d3.select("#employmentTypeContainer").append("label").text(type);
    // });

    // experienceLevels.forEach(level => {
    //     d3.select("#experienceLevelContainer")
    //         .append("input")
    //         .attr("type", "radio")
    //         .attr("name", "experienceLevel")
    //         .attr("value", level);
    //     d3.select("#experienceLevelContainer").append("label").text(level);
    // });

    employmentTypes.forEach(level => {
        const checkboxLabel = d3.select("#employmentTypeContainer")
            .append("label");

        checkboxLabel.append("input")
            .attr("type", "checkbox")
            .attr("class", "employment-type-checkbox")
            .attr("value", level);

        checkboxLabel.append("span")
            .text(level);
    });

    // Create checkboxes for experience levels
    experienceLevels.forEach(level => {
        const checkboxLabel = d3.select("#experienceLevelContainer")
            .append("label");

        checkboxLabel.append("input")
            .attr("type", "checkbox")
            .attr("class", "experience-level-checkbox")
            .attr("value", level);

        checkboxLabel.append("span")
            .text(level);
    });

    d3.select("#jobTitle").append("option").attr("value", "").text("Select job title");

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

    // d3.select("#salaryUserInput")
    //     .attr("type", "range")
    //     .attr("min", minSalary)
    //     .attr("max", maxSalary);
}

function getSelectedExperienceLevels() {
    const selectedLevels = [];
    d3.selectAll(".experience-level-checkbox:checked").each(function () {
        const value = d3.select(this).attr("value");
        const key = getKeyByValue(experienceLevelMap, value);
        if (key) {
            selectedLevels.push(key);
        }
    });
    return selectedLevels;
}

function getSelectedEmploymentType() {
    const selectedLevels = [];
    d3.selectAll(".employment-type-checkbox:checked").each(function () {
        const value = d3.select(this).attr("value");
        const key = getKeyByValue(employmentTypeMap, value);
        if (key) {
            selectedLevels.push(key);
        }
    });
    return selectedLevels;
}

// Helper function to get key from value in experienceLevelMap
function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function filterData() {
    let filteredData = state.data.filter(function(d) {
        return (!state.selectedJobTitle || d.job_title === state.selectedJobTitle) &&
               (!state.selectedCompanySize || d.company_size === state.selectedCompanySize) &&
               (!state.currentCountry || d.company_location === state.currentCountry) &&
               (d.salary_in_usd >= state.selectedMinSalary && d.salary_in_usd <= state.selectedMaxSalary) &&
               (state.selectedExperienceLevels.length === 0 || state.selectedExperienceLevels.includes(d.experience_level)) &&
               (state.selectedEmploymentType.length === 0 || state.selectedEmploymentType.includes(d.employment_type));
    });

    // If no filters are selected (or all filters are null, undefined, or default),
    // return all data
    if (
        (!state.selectedJobTitle || state.selectedJobTitle === "") &&
        (!state.selectedCompanySize || state.selectedCompanySize === "") &&
        (!state.currentCountry || state.currentCountry === "") &&
        state.selectedMinSalary === 0 &&
        state.selectedMaxSalary === Infinity &&
        state.selectedExperienceLevels.length === 0 &&
        state.selectedEmploymentType.length === 0
    ) {
        filteredData = state.data;
    }

    return filteredData;
}



function wrangleData(data) {
    const employmentTypes = new Set();
    const experienceLevels = new Set();
    const jobTitles = new Set();
    const companySizes = new Set();
    const companyLocations = new Set();
    let minSalary = 0;
    let maxSalary = Infinity;
    const salaryDict = {};
    const employeeResidenceCount = {};

    // Process each data entry
    data.forEach(function (d) {
        // Update salary statistics for each company location
        if (!salaryDict[d.company_location]) {
            salaryDict[d.company_location] = { total: 0, count: 0 };
        }
        salaryDict[d.company_location].total += +d.salary_in_usd;
        salaryDict[d.company_location].count += 1;

        // Count employee residence for each company location
        if (!employeeResidenceCount[d.company_location]) {
            employeeResidenceCount[d.company_location] = 0;
        }
        employeeResidenceCount[d.company_location]++;

        // Add unique values to sets
        employmentTypes.add(employmentTypeMap[d.employment_type] || d.employment_type);
        experienceLevels.add(experienceLevelMap[d.experience_level] || d.experience_level);
        jobTitles.add(d.job_title);
        companySizes.add(d.company_size);
        companyLocations.add(d.company_location);

        // Track min and max salaries
        if (d.salary_in_usd < minSalary) minSalary = d.salary_in_usd;
        if (d.salary_in_usd > maxSalary) maxSalary = d.salary_in_usd;
    });

    // Calculate average salary for each company location
    const averageSalaryDict = {};
    for (const location in salaryDict) {
        if (salaryDict[location].count > 0) {
            averageSalaryDict[location] = salaryDict[location].total / salaryDict[location].count;
        }
    }

    // Convert jobTitles set to an array and sort it alphabetically
    const sortedJobTitles = Array.from(jobTitles).sort();

    return {
        data,
        salaryDict,
        averageSalaryDict,
        employmentTypes,
        experienceLevels,
        jobTitles: sortedJobTitles, // Return the sorted job titles array
        companySizes,
        companyLocations,
        employeeResidenceCount,
        minSalary,
        maxSalary
    };
}

function updateApp() {
    const filtered = filterData();
    const dataToUse = wrangleData(filtered);

    // console.log('Filtered: ', filtered);
    console.log('DataToUse: ', dataToUse);

    jobTable(dataToUse.data);
    jobMap(dataToUse)
}

d3.csv("data/ds_salaries.csv", d3.autoType).then(function (data) {
    state.data = data;
    const filtered = filterData();
    const dataToUse = wrangleData(filtered);

    state.avgSalary = dataToUse.averageSalaryDict;

    setupInteractivity(dataToUse);
    jobMap(dataToUse);

    updateApp();
});

d3.select('#filterButton').on('click', function() {
    //state.selectedEmploymentType = d3.select('input[name="employmentType"]:checked').node()?.value || "";
    //state.selectedExperienceLevel = d3.select('input[name="experienceLevel"]:checked').node()?.value || "";
    state.selectedJobTitle = d3.select('#jobTitle').node()?.value || "";
    state.selectedCompanySize = d3.select('input[name="companySize"]:checked').node()?.value || "";
    // state.selectedSalary = +document.getElementById('salaryUserInput').value || 0;
    state.selectedMinSalary = +document.getElementById('minSalaryInput').value || 0;
    state.selectedMaxSalary = +document.getElementById('maxSalaryInput').value || Infinity;

    state.selectedExperienceLevels = getSelectedExperienceLevels();
    state.selectedEmploymentType = getSelectedEmploymentType();

    console.log('employment type', state.selectedEmploymentType);
    updateApp();
});

// Add event listener for the clear selection button
d3.select('#clearSelectionButton').on('click', function() {
    state.selectedEmploymentType = "";
    state.selectedExperienceLevel = "";
    state.selectedJobTitle = "";
    state.selectedCompanySize = "";
    state.selectedMinSalary = 0;
    state.selectedMaxSalary = Infinity;
    state.currentCountry = "";

    d3.select('input[name="employmentType"]:checked').property("checked", false);
    d3.select('input[name="experienceLevel"]:checked').property("checked", false);
    d3.select('#jobTitle').property("value", "");
    d3.select('input[name="companySize"]:checked').property("checked", false);
    document.getElementById('minSalaryInput').value = 0;
    document.getElementById('maxSalaryInput').value = 0;

    updateApp();
});