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
const experiencePlot = makeBarplot("#expLevel");
const sizePlot = makeBarplot("#compSize");
const avgSalaryPlot = makeLineplot("#avgSalary");


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

const companySizeMap = {
    "L": "Large",
    "M": "Medium",
    "S": "Small",
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
            return employmentTypeMap[d.employment_type] || d.employment_type;  // Displaying mapped employment type
        });
        rows.append("td").text(function (d) {
            return experienceLevelMap[d.experience_level] || d.experience_level;  // Displaying mapped experience level
        });
        rows.append("td").text(function (d) {
            return +d.salary_in_usd.toFixed(2);
        });
    }
    return update;
}

function makeBarplot(svgSelector) {
    const margin = { top: 15, right: 10, bottom: 80, left: 40 };
    const width = 300 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgSelector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    function update(newData, selectKey) {
        // Clear previous elements
        svg.selectAll("*").remove();

        const x = d3.scaleBand()
            .domain(newData.map(d => d[selectKey]))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(newData, d => d.count)])
            .nice()
            .range([height, 0]);

        // Add bars with transition
        svg.selectAll(".bar")
            .data(newData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d[selectKey]))
            .attr("y", height)
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .attr("fill", "#60AB9A")
            .transition()
            .duration(800)
            .attr("y", d => y(d.count))
            .attr("height", d => height - y(d.count))
            .delay((d, i) => i * 100); // Add delay to each bar

        // Add x-axis
        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .attr("y", 10)
            .attr("dy", "0.35em") // Adjust vertical alignment
            .style("text-anchor", "end") // Adjust text anchor based on rotation
            .style("font-size", "8px"); // Adjust font size here

        // Add y-axis
        svg.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y));

        // Add x-axis label
        svg.append("text")
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10)

        // Add y-axis label
        svg.append("text")
            .attr("class", "y-axis-label")
            .attr("text-anchor", "top")
            .attr("x", -margin.left / 2)
            .attr("y", -margin.top / 2)
            .text("Count")
            .style("font-size", "8px"); // Adjust font size here
    }
    return update;
}
function makeLineplot(svgSelector) {
    const margin = { top: 15, right: 10, bottom: 80, left: 40 };
    const width = 300 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgSelector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define initial scales and axes
    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const xAxis = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    const yAxis = svg.append("g")
        .attr("class", "y-axis");

    // Append axis labels
    svg.append("text")
        .attr("class", "x-axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width)
        .attr("y", height + margin.bottom - 10)
        .text("Year")
        .style("font-size", "10px");

    svg.append("text")
        .attr("class", "y-axis-label")
        .attr("text-anchor", "top")
        .attr("x", -margin.left / 2)
        .attr("y", -margin.top / 2)
        .text("Avg Salary (USD)")
        .style("font-size", "8px");

    function update(newData) {
        // Parse the data and group by work_year
        const dataByYear = d3.rollups(
            newData,
            v => d3.mean(v, d => d.salary_in_usd),
            d => d.work_year
        ).map(([work_year, avg_salary]) => ({ work_year, avg_salary }));

        // Sort data by work_year
        dataByYear.sort((a, b) => a.work_year - b.work_year);

        // Update scales domain
        x.domain(d3.extent(dataByYear, d => d.work_year));
        y.domain([0, d3.max(dataByYear, d => d.avg_salary)]).nice();

        // Define line generator
        const line = d3.line()
            .x(d => x(d.work_year))
            .y(d => y(d.avg_salary));

        // Update the line path with transition
        svg.selectAll(".line")
            .data([dataByYear])
            .join("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "#60AB9A")
            .attr("stroke-width", 2)
            .transition()
            .duration(500)
            .attr("d", line);

        // Update the dots with transition
        svg.selectAll(".dot")
            .data(dataByYear)
            .join("circle")
            .attr("class", "dot")
            .attr("fill", "#60AB9A")
            .attr("r", 5)
            .transition()
            .duration(500)
            .attr("cx", d => x(d.work_year))
            .attr("cy", d => y(d.avg_salary));

        // Update x-axis with transition
        xAxis.transition()
            .duration(500)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickValues(dataByYear.map(d => d.work_year)))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .attr("y", 10)
            .attr("dy", "0.35em")
            .style("text-anchor", "end");

        // Update y-axis with transition
        yAxis.transition()
            .duration(500)
            .call(d3.axisLeft(y));

        // Update x-axis label position
        svg.select(".x-axis-label")
            .attr("x", width)
            .attr("y", height + margin.bottom - 10);

        // Update y-axis label
        svg.select(".y-axis-label")
            .attr("x", -margin.left / 2)
            .attr("y", -margin.top / 2);
    }

    return update;
}



function updateEmploymentTypeCount(data) {
    const employmentTypeCountContainer = d3.select("#employmentTypeCount");

    // Clear previous content
    employmentTypeCountContainer.selectAll("div").remove();

    // Create a container for each employment type count
    const typeContainer = employmentTypeCountContainer.selectAll(".employment-type-container")
        .data(data)
        .enter()
        .append("div")
        .attr("class", "employment-type-container")
        .style("display", "inline-block") // Set to inline-block for inline display

    // Add count as large number with transition
    typeContainer.append("div")
        .attr("class", "employment-type-count")
        .style("display", "inline-block") // Inline display for count
        .text(d => 0) // Start with 0
        .transition()
        .duration(800)
        .tween("text", function(d) {
            const node = this;
            const i = d3.interpolateNumber(0, d.count); // Interpolate between 0 and current count
            return function(t) {
                node.textContent = Math.round(i(t)); // Update text content with interpolated value
            };
        });

    // Add employment type as bold text, below the count
    typeContainer.append("div")
        .attr("class", "employment-type")
        .style("display", "block") // Block display for type (default behavior)
        .text(d => `${d.employment_type}`);
}



function countEmploymentTypes(data) {
    const employmentTypeCounts = d3.rollups(data, v => v.length, d => employmentTypeMap[d.employment_type] || d.employment_type)
        .map(([employment_type, count]) => ({ employment_type, count }));

    return employmentTypeCounts;
}

// -----------------------------------------------------------------------------------------------------------------------------------------------------
function setupInteractivity(data) {
    const { employmentTypes, experienceLevels, jobTitles, companySizes, minSalary, maxSalary } = data;

    // checkboxes
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

    // companySizes.forEach(size => {
    //     d3.select("#companySizeContainer")
    //         .append("input")
    //         .attr("type", "radio")
    //         .attr("name", "companySize")
    //         .attr("value", size);
    //     d3.select("#companySizeContainer").append("label").text(size);
    // });

    companySizes.forEach(level => {
        const checkboxLabel = d3.select("#companySizeContainer")
            .append("label");

        checkboxLabel.append("input")
            .attr("type", "checkbox")
            .attr("class", "company-size-checkbox")
            .attr("value", level);

        checkboxLabel.append("span")
            .text(level);
    });
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

function getSelectedCompanySizes() {
    const selectedLevels = [];
    d3.selectAll(".company-size-checkbox:checked").each(function () {
        const value = d3.select(this).attr("value");
        const key = getKeyByValue(companySizeMap, value);
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

// --------------------------------------------------------------------------------------------------------------------------------
function filterData() {
    let filteredData = state.data.filter(function(d) {
        return (!state.selectedJobTitle || d.job_title === state.selectedJobTitle) &&
               //(!state.selectedCompanySize || d.company_size === state.selectedCompanySize) &&
               (!state.currentCountry || d.company_location === state.currentCountry) &&
               (d.salary_in_usd >= state.selectedMinSalary && d.salary_in_usd <= state.selectedMaxSalary) &&
               (state.selectedCompanySize.length === 0 || state.selectedCompanySize.includes(d.company_size)) &&
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
        state.selectedCompanySize.length === 0 &&
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
    const employmentTypeCounts = countEmploymentTypes(data);

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
        //companySizes.add(d.company_size);
        companySizes.add(companySizeMap[d.company_size] || d.company_size);
        companyLocations.add(d.company_location);

        // Track min and max salaries
        if (d.salary_in_usd < minSalary) minSalary = d.salary_in_usd;
        if (d.salary_in_usd > maxSalary) maxSalary = d.salary_in_usd;
    });

    const experienceLevelsCount = d3.rollups(data, v => v.length, d => experienceLevelMap[d.experience_level] || d.experience_level)
        .map(([experience_level, count]) => ({ experience_level, count }));

    const companySizesCount = d3.rollups(data, v => v.length, d => companySizeMap[d.company_size] || d.company_size)
        .map(([company_size, count]) => ({ company_size, count }));

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
        experienceLevelsCount,
        jobTitles: sortedJobTitles, // Return the sorted job titles array
        companySizes,
        companySizesCount,
        companyLocations,
        employeeResidenceCount,
        minSalary,
        maxSalary,
        employmentTypeCounts
    };
}

function updateApp() {
    const filtered = filterData();
    const dataToUse = wrangleData(filtered);

    // console.log('Filtered: ', filtered);
    console.log('DataToUse: ', dataToUse);

    jobTable(dataToUse.data);
    jobMap(dataToUse);
    experiencePlot(dataToUse.experienceLevelsCount, "experience_level");
    sizePlot(dataToUse.companySizesCount, "company_size");
    avgSalaryPlot(dataToUse.data);  // Update the line plot with filtered data
    updateEmploymentTypeCount(dataToUse.employmentTypeCounts);

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
    //state.selectedCompanySize = d3.select('input[name="companySize"]:checked').node()?.value || "";
    // state.selectedSalary = +document.getElementById('salaryUserInput').value || 0;
    state.selectedMinSalary = +document.getElementById('minSalaryInput').value || 0;
    state.selectedMaxSalary = +document.getElementById('maxSalaryInput').value || Infinity;

    state.selectedExperienceLevels = getSelectedExperienceLevels();
    state.selectedEmploymentType = getSelectedEmploymentType();
    state.selectedCompanySize = getSelectedCompanySizes();

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

    d3.selectAll('.employment-type-checkbox').property("checked", false);
    d3.selectAll('.experience-level-checkbox').property("checked", false);
    d3.select('#jobTitle').property("value", "");
    d3.selectAll('.company-size-checkbox').property("checked", false);
    document.getElementById('minSalaryInput').value = 0;
    document.getElementById('maxSalaryInput').value = 0;

    updateApp();
});