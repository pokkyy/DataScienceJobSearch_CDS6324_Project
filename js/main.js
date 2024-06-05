// Load data
d3.csv("data/ds_salaries.csv", d3.autoType).then(function(data){
    console.log(data[0]);

});
