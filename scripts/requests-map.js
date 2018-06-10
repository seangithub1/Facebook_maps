import { makeLineGraph, makeLineGraphData } from "./line-graph.js";
import { tip } from "./tooltip-config.js";
import { VerticalLegend } from "./legend.js";
import { drawSlider } from "./double-slider.js";

const margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    },
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

const colorNames = [
    "map-empty-color",
    "map-color-1",
    "map-color-2",
    "map-color-3",
    "map-color-4",
    "map-color-5"
];
const colorThresholds = [1, 25, 250, 2500, 25000, 210000];
const color = d3
    .scaleThreshold()
    .domain(colorThresholds)
    .range(colorNames);

const svg = d3
    .select("#geomap")
    .attr("id", "line-graph")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("class", "map");

const projection = d3
    .geoNaturalEarth1()
    .scale(170)
    .translate([width / 2, height / 1.5]);

const path = d3.geoPath().projection(projection);


// Percentage merge still has bugs
function mergeYears(data, startYear, endYear) {
    let countries = new Map();
    for (let year = startYear; year <= endYear; year++) {
        let yearData = data.filter(r => r.year == year);
        for (let country of yearData) {
            if (countries.has(country.id)) {
                let existing = countries.get(country.id);
                existing["requests"] =
                    +existing["requests"] + +country["requests"];
                existing["accounts"] =
                    +existing["accounts"] + +country["accounts"];
                existing["percentAccepted"] =
                    (+existing["percentAccepted"] * existing.datapoints +
                        +country["percentAccepted"]) /
                    (existing.datapoints + 1);
                existing.datapoints += 1;
                countries.set(country.id, existing);
            } else {
                let copy = Object.assign({}, country);
                copy.datapoints = 1;
                countries.set(copy.id, copy);
            }
        }
    }
    return Array.from(countries.values());
}

const defaultGraphCountries = [
    "United States",
    "India",
    "United Kingdom",
    "Germany",
    "France",
    "Canada"
];
const countriesToGraph = new Set();

function getCountriesToGraph() {
    if (countriesToGraph.size > 0) return countriesToGraph;
    return defaultGraphCountries;
}

function toggleCountry(requestData, country, yearLow, yearHigh) {
    if (countriesToGraph.has(country)) {
        countriesToGraph.delete(country);
    } else {
        countriesToGraph.add(country);
    }
    makeLineGraph(
        makeLineGraphData(requestData, getCountriesToGraph(), yearLow, yearHigh)
    );
}

function setData(geoData, request_data, yearLow, yearHigh) {
    makeLineGraph(
        makeLineGraphData(
            request_data,
            getCountriesToGraph(),
            yearLow,
            yearHigh
        )
    );

    var requestsById = {};
    var accountsById = {};
    var rateById = {};
    var names = {};

    var requests = mergeYears(request_data, yearLow, yearHigh);

    requests.forEach(function(d) {
        requestsById[d.id] = +d["requests"];
        accountsById[d.id] = +d["accounts"];
        rateById[d.id] = +d["percentAccepted"];
        names[d.id] = d.country;
    });

    geoData.features.forEach(function(d) {
        d.requests = requestsById[d.id];
        d.accounts = accountsById[d.id];
        d.rate = rateById[d.id];
    });

    // clear
    svg.selectAll("*").remove();

    //Changes to country color White
    svg.append("g")
        .selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", function(d) {
            if (requestsById[d.id] == 0 || isNaN(requestsById[d.id]))
                return "map-empty-color";
            return color(requestsById[d.id]);
        })
        .classed("country", true)
        .classed("selected", d => countriesToGraph.has(names[d.id]))
        // tooltips
        .on("mouseover", function(d) {
            tip.show(d);
        })
        .on("mouseout", function() {
            tip.hide();
        })
        .on("click", function(d) {
            if (requestsById[d.id] > 0)
                toggleCountry(request_data, names[d.id], yearLow, yearHigh);
            d3.select(this).classed(
                "selected",
                countriesToGraph.has(names[d.id])
            );
        });

    svg.append("path")
        .datum(
            topojson.mesh(geoData.features, function(a, b) {
                return a.id !== b.id;
            })
        )
        // .datum(topojson.mesh(data.features, function(a, b) { return a !== b; }))
        .attr("class", "names")
        .attr("d", path);

    //legend
    svg.append("g")
        .attr("class", "legendLinear")
        .attr("transform", "translate(30,330)");

    let legend = new VerticalLegend(svg, colorThresholds, colorNames, x =>
        Math.pow(x, 1 / 4)
    );
    legend.draw(40, 60, 20, 437);
}

queue()
    .defer(d3.json, "data/world_countries.json")
    .defer(d3.tsv, "data/facebook_output/all_facebook.tsv")
    .defer(d3.tsv, "data/google_output/all_google.tsv")
    .defer(d3.tsv, "data/microsoft_output/all_microsoft.tsv")
    .await(ready);

function ready(error, geoData, facebookRequests, googleRequests, microsoftRequests) {
    document.getElementById("select-facebook").addEventListener("click", () => {
        setData(geoData, facebookRequests, 2013, 2017);
    });

    document.getElementById("select-google").addEventListener("click", () => {
        setData(geoData, googleRequests, 2013, 2017);
    });

    document.getElementById("select-microsoft").addEventListener("click", () => {
        setData(geoData, microsoftRequests, 2013, 2017);
    });

    setData(geoData, facebookRequests, 2013, 2017);
    drawSlider();
}
