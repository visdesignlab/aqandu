/* global d3 L:true */
/* eslint no-undef: "error" */
/* eslint no-mixed-operators: ["error", {"allowSamePrecedence": true}] */

// setting dates for timeline and for ajax calls
const today = new Date().toISOString().substr(0, 19) + 'Z';
// const todayMST = moment(today).tz("MST").format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) + "Z"
const date = new Date();
// const dateMST = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
date.setDate(date.getDate() - 1);
let pastDate = date.toISOString().substr(0, 19) + 'Z';
// const yesterdayMST = moment(date).tz("MST").format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) + "Z"

// const x = d3.scaleTime().domain([new Date(yesterday), new Date(today)]);
let x = d3.scaleTime().domain([new Date(pastDate), new Date(today)]);
// const lineColor = d3.scaleOrdinal(d3.schemeCategory10);
const y = d3.scaleLinear().domain([0.0, 150.0]);

const sensLayer = L.layerGroup();
// const heat = L.heatLayer();

const epaColors = ['green', 'yellow', 'orange', 'red', 'veryUnhealthyRed', 'hazardousRed', 'noColor'];

const margin = {
  top: 10,
  right: 0,
  bottom: 40,
  left: 50,
};

let lineArray = [];

const dbEndpoint = '/dbapi/api';
const liveSensorURL_purpleAir = generateURL(dbEndpoint, '/liveSensors', {'type': 'purpleAir'});
const liveSensorURL_airU = generateURL(dbEndpoint, '/liveSensors', {'type': 'airU'});
const liveSensorURL_all = generateURL(dbEndpoint, '/liveSensors', {'type': 'all'});
const lastPM25ValueURL = generateURL(dbEndpoint, '/lastValue', {'fieldKey': 'pm25'});
const contoursURL = generateURL(dbEndpoint, '/contours', null);
const lastContourURL = generateURL(dbEndpoint, '/getLatestContour', null);

let theMap;

let liveAirUSensors = [];

let whichTimeRangeToShow = 1;

let currentlySelectedDataSource = 'none';


$(function() {
  window.onload = window.onresize = function () {

    // deals with settiing the from date for the timeline when the radio button is changed
    $('#timelineControls input[type=radio]').on('change', function() {
      whichTimeRangeToShow = parseInt($('[name="timeRange"]:checked').val());

      let newDate = new Date(today);  // use "today" as the base date
      newDate.setDate(newDate.getDate() - whichTimeRangeToShow);
      pastDate = newDate.toISOString().substr(0, 19) + 'Z';

      // refresh x
      x = d3.scaleTime().domain([new Date(pastDate), new Date(today)]);
      setUp();

      // which ID are there
      let lineData = [];
      lineArray.forEach(function(aLine) {
        let theAggregation = getAggregation(whichTimeRangeToShow);
        // if (whichTimeRangeToShow === 1) {
        //   theAggregation = false;
        // } else {
        //   theAggregation = true;
        // }

        lineData.push({id: aLine.id, sensorSource: aLine.sensorSource, aggregation: theAggregation})
      });

      clearData(true);

      lineData.forEach(function(aLine) {
        reGetGraphData(aLine.id, aLine.sensorSource, aLine.aggregation);

      })

    });

    $('#sensorDataSearch').on('submit', function(e) {
        e.preventDefault();  //prevent form from submitting
        let data = $("#sensorDataSearch :input").serializeArray();
        console.log(data[0].value);

        let anAggregation = getAggregation(whichTimeRangeToShow);
        reGetGraphData(data[0].value, 'airu', anAggregation);

        // if the sensor is visible on the map, mark it as selected
        sensLayer.eachLayer(function(layer) {
          if (layer.id === data[0].value) {
            d3.select(layer._icon).classed('sensor-selected', true)
          }
        });
    });

    setUp();
    // TODO: call the render function(s)
    //  L.imageOverlay('overlay1.png', [[40.795925, -111.998256], [40.693031, -111.827190]], {
    // 		opacity: 0.5,
    // 		interactive: true,
    // 	}).addTo(map);
  }

  theMap = setupMap();

  drawSensorOnMap();

  // there is new data every minute for a sensor in the db
  setInterval('updateDots()', 60000);
  setInterval('updateSensors()', 300000); // update every 5min
  // setInterval('updateSensors()', 60000); // update every 5min


  // TODO can this layer stuff be made simpler??
  // TO ADD THE LAYER ICON BACK uncomment the following lines and the line L.control.layers(null, overlayMaps).addTo(theMap);
  // var overlayMaps = {
  //   "SensLayer": sensLayer
  // };

  sensLayer.addTo(theMap);
  // L.control.layers(null, overlayMaps).addTo(theMap);

});


function getAggregation(timeRange) {

  if (timeRange === 1) {
    return false;
  } else {
    return true;
  }
}

/**
 * [setUp description]
 */
function setUp(){
  var div = d3.select("#timeline");
  var bounds = div.node().getBoundingClientRect();
  var svgWidth = bounds.width;
  var svgHeight = 310;
  var width = svgWidth - margin.left - margin.right;
  var height = svgHeight - margin.top - margin.bottom;
  var svg = div.select("svg") // sets size of svgContainer

  x.range([0, width]);
  y.range([height, 0]);

  svg.attr("width", svgWidth)
     .attr("height", svgHeight);

  // the color bands
  svg.select('#colorBands').selectAll('path').remove(); // added else when resizing it would add the bands all over again

  svg.select('#colorBands').append("path")
                 .attr("d", getColorBandPath(0, 12))
                 .style("opacity", 0.1)
                 // .style("stroke", "rgb(0,228,0)")
                 // .style("fill", "rgb(0,228,0)");
                 .style("stroke", "rgb(166, 217, 106)")
                 .style("fill", "rgb(166, 217, 106)");


  svg.select('#colorBands').append("path")
                 .attr("d", getColorBandPath(12, 35.4))
                 .style("opacity", 0.1)
                 // .style("stroke", "rgb(255,255,0)")
                 // .style("fill", "rgb(255,255,0)");
                 .style("stroke", "rgb(255, 255, 191)")
                 .style("fill", "rgb(255, 255, 191)");

  svg.select('#colorBands').append("path")
                 .attr("d", getColorBandPath(35.4, 55.4))
                 .style("opacity", 0.1)
                 // .style("stroke", "rgb(255,126,0)")
                 // .style("fill", "rgb(255,126,0)");
                 .style("stroke", "rgb(253, 174, 97)")
                 .style("fill", "rgb(253, 174, 97)");

  svg.select('#colorBands').append("path")
                 .attr("d", getColorBandPath(55.4, 150.4))
                 .style("opacity", 0.1)
                 // .style("stroke", "rgb(255,0,0)")
                 // .style("fill", "rgb(255,0,0)");
                 .style("stroke", "rgb(215, 25, 28)")
                 .style("fill", "rgb(215, 25, 28)");


  var xAxis = d3.axisBottom(x).ticks(9);
  var yAxis = d3.axisLeft(y).ticks(7);

  svg.select(".x.axis") // Add the X Axis
     .attr("transform", "translate(" + margin.left + "," + (margin.top + height) + ")")
     .call(xAxis);

  svg.select(".x.label")      // text label for the x axis
     .attr("class", "timeline")
     .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom) + ")")
     .style("text-anchor", "middle")
     .text("Time");

  svg.select(".y.axis") // Add the Y Axis
     .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
     .call(yAxis);

  svg.select(".y.label")    // text label for the y axis
     .attr("class", "timeline")
     .attr("transform", "rotate(-90)")
     .attr("y", 0) // rotated! x is now y!
     .attr("x", 0 - (height / 2))
     .attr("dy", "1em")
     .style("text-anchor", "middle")
     .text("PM 2.5 µg/m\u00B3");
}


function getColorBandPath(yStart, yEnd) {
  return "M" + (margin.left + x(x.domain()[0])) + "," + (margin.top + y(yStart)) +
         "L" + (margin.left + x(x.domain()[0])) + "," + (margin.top + y(yEnd)) +
         "L" + (margin.left + x(x.domain()[1])) + "," + (margin.top + y(yEnd)) +
         "L" + (margin.left + x(x.domain()[1])) + "," + (margin.top + y(yStart));
}

/**
 * [setupMap description]
 * @return {[type]} [description]
 */
function setupMap() {
  const slcMap = L.map('SLC-map', {
    center: [40.7608, -111.8910],
    zoom: 9
  }); //13

  //beginning of Peter's code (how to use StamenTileLayer)
  var bottomLayer = new L.StamenTileLayer("toner");
  slcMap.addLayer(bottomLayer);

  var topPane = slcMap.createPane('leaflet-top-pane', slcMap.getPanes().mapPane);
  var topLayerLines = new L.StamenTileLayer('toner-lines');
  var topLayerLabels = new L.StamenTileLayer('toner-labels');
  slcMap.addLayer(topLayerLines);
  slcMap.addLayer(topLayerLabels);
  topPane.appendChild(topLayerLines.getContainer());
  topPane.appendChild(topLayerLabels.getContainer());
  topLayerLabels.setZIndex(9);
  topLayerLines.setZIndex(9);

  L.svg().addTo(slcMap);


  getDataFromDB(lastContourURL).then(data => {

      // process contours data
      console.log(data)

      // function projectPoint(x, y) {
      //     var point = slcMap.latLngToLayerPoint(new L.LatLng(y, x));
      //     this.stream.point(point.x, point.y);
      // }
      //
      // var transform = d3.geoTransform({
      //     point: projectPoint
      // });

      // var path = d3.geoPath().projection(transform);


      var contours = [];
      for (var key in data) {
        // check if the property/key is defined in the object itself, not in parent
        if (data.hasOwnProperty(key)) {
            console.log(key, data[key]);
            // var theContour = data[key]['contours'][0];
            var theContour = data[key];
            var aContour = theContour.path;
            aContour.level = theContour.level;
            aContour.k = theContour.k;

            contours.push(aContour);
        }
      }

      contours.sort(function(a,b) {
          return b.level - a.level;
      });

      var levelColours = ['#a6d96a', '#ffffbf', '#fdae61', '#d7191c', '#bd0026', '#a63603'];
      var defaultContourColor = 'black';
      var defaultContourWidth = 1;

      //console.log('jsonStruct:', jsonStruct);
      var mapSVG = d3.select("#SLC-map").select("svg");
      var g = mapSVG.select("g");  //.attr("class", "leaflet-zoom-hide").attr('opacity', 0.8);
      var contourPath = g.selectAll("path")
        .data(contours)
      .enter().append("path")
      .style("fill",function(d, i) { return levelColours[d.level];})
      .style("stroke", defaultContourColor)
      .style('stroke-width', defaultContourWidth)
      .style('opacity', 1)
      .on('mouseover', function(d) {
          d3.select(this).style('stroke', 'black');
      })
      .on('mouseout', function(d) {
          d3.select(this).style('stroke', defaultContourColor);
      });

      function resetView() {
        console.log('reset:', slcMap.options.center);
        contourPath.attr("d", function(d) {
          var pathStr = d.map(function(d1) {
            var point = slcMap.latLngToLayerPoint(new L.LatLng(d1[1], d1[2]));
            return d1[0] + point.x + "," + point.y;
          }).join('');

          //console.log('d', d);

          return pathStr;
        });
      }

      // slcMap.on("viewreset", resetView);
      slcMap.on("zoom", resetView);

      resetView();


  }).catch(function(err){

      alert("error, request failed!");
      console.log("Error: ", err)
  });


  // var imageUrl = 'static/sample_data/test_colorbrewer.svg',
  // imageBounds = [[40.70159, -112.058312], [40.8433918609, -111.8109267]];
  // L.imageOverlay(imageUrl, imageBounds, {
  //    opacity: 0.8,
  //    interactive: true,
  //  }).addTo(slcMap);

//   // load a tile layer
//   L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2tpdHJlZSIsImEiOiJjajUyb2l0YzQwaHJwMnFwMTNhdGwxMGx1In0.V5OuKXRdmwjq4Lk3o8me1A', {
// // L.tileLayer('https://api.mapbox.com/styles/v1/oscarinslc/cjdy1fjlq1n9p2spe1f1dwvjp/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoib3NjYXJpbnNsYyIsImEiOiJjajZ3bG5kbnUxN2h3Mnd1aDdlOTJ6ZnUzIn0.fLYowxdcPCmZSLt51mG8tw', {
//
//     maxZoom: 18,
//     id: 'mapbox.streets',
//     accessToken: 'pk.eyJ1Ijoic2tpdHJlZSIsImEiOiJjajUydDkwZjUwaHp1MzJxZHhkYnl3eTd4In0.TdQB-1U_ID-37stKON_osw'
//   }).addTo(slcMap);

  // disabling zooming when scrolling down the page (https://gis.stackexchange.com/questions/111887/leaflet-mouse-wheel-zoom-only-after-click-on-map)
  slcMap.scrollWheelZoom.disable();
  slcMap.on('focus', () => { slcMap.scrollWheelZoom.enable(); });
  slcMap.on('blur', () => { slcMap.scrollWheelZoom.disable(); });

  const legend = L.control({position: 'bottomright'});

  legend.onAdd = function () {
    this._div = L.DomUtil.create('div', 'legend');
    this.update(this._div);
    return this._div;
  };

  legend.update = function (thediv) {
    // TODO: draw the legend
    var d3div = d3.select(thediv);
    var titleDataSource = d3div.append('span')
         .attr("class", "legendTitle")
         .text('Data sources:');

    titleDataSource.on('mouseover', d => {
      var mainOffset_x = $('.main').offset().left
      var mainOffset_y = $('.main').offset().top

      var x = $(d3div.node()).offset().left;
      var y = $(d3div.node()).offset().top;

      $('.tooltip').removeClass('hidden')
      $('.tooltip').addClass('show')
      var tooltipHeight = $('.tooltip').height();
      // console.log(tooltipHeight);

      d3.select('.tooltip')
        .style("left", (x - mainOffset_x) + "px")
        .style("top", (y - mainOffset_y - tooltipHeight - 6 - 6 - 6 - 3) + "px")
    })

    titleDataSource.on('mouseout', d => {
      $('.tooltip').removeClass('show')
      $('.tooltip').addClass('hidden')
    });

    var dataLabel = ["airu", "PurpleAir", "Mesowest", "DAQ"];
    var labels = d3div.selectAll('label').data(dataLabel);
    labels.exit().remove();
    var labelsEnter = labels.enter()
                            .append('label')
                            .attr("class", "sensorType");
    labels = labels.merge(labelsEnter);
    labels.text(d => d);

    labels.on('click', d => {
      if (currentlySelectedDataSource != 'none') {
        // element in sensor type legend has been clicked (was already selected) or another element has been selected

        d3.select('.clickedLegendElement').classed('clickedLegendElement', false)
        if (currentlySelectedDataSource === d) {
          // remove notPartOfGroup class
          // remove colored-border-selected class
          d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('notPartOfGroup', false);
          d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('partOfGroup-border', false);

          currentlySelectedDataSource = 'none'
        } else {
          // moved from one element to another wiuthout first unchecking it

          d3.select(d3.event.currentTarget).classed('clickedLegendElement', true)

          d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('notPartOfGroup', true);
          d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('partOfGroup-border', false);
          d3.select('#SLC-map').selectAll('.' + d + ':not(noColor)').classed('notPartOfGroup', false);
          d3.select('#SLC-map').selectAll('.' + d + ':not(noColor)').classed('partOfGroup-border', true);

          currentlySelectedDataSource = d
        }

      } else {
        // add the notPartOfGroup class to all dots, then remove it for the ones that are actually notPartOfGroup
        // remove partOfGroup-border for all dots and add it only for the selected ones

        d3.select(d3.event.currentTarget).classed('clickedLegendElement', true)

        d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('notPartOfGroup', true);
        d3.select('#SLC-map').selectAll('.dot:not(noColor)').classed('partOfGroup-border', false);
        d3.select('#SLC-map').selectAll('.' + d + ':not(noColor)').classed('notPartOfGroup', false);
        d3.select('#SLC-map').selectAll('.' + d + ':not(noColor)').classed('partOfGroup-border', true);

        currentlySelectedDataSource = d;
      }
    });

    return thediv;
  }

  legend.addTo(slcMap);

  // adding color legend
  var colorLegend = L.control({position: 'bottomleft'});

	colorLegend.onAdd = function () {

		var div = L.DomUtil.create('div', 'colorLegend'),
			grades = [0, 12, 35.4, 55.4, 150.4, 250.4],
			colorLabels = [],
			from, to;

    colorLabels.push("<span class='legendTitle'>PM2.5 levels:</span>");

		for (var i = 0; i < grades.length; i++) {
			from = grades[i];
			to = grades[i + 1];

			colorLabels.push(
				'<label><i class="' + getColor(from + 1) + '"></i> ' +
        // from + (to ? ' &ndash; ' + to + ' µg/m<sup>3</sup> ' : ' µg/m<sup>3</sup> +'));
        (to ? from + ' &ndash; ' + to + ' µg/m<sup>3</sup></label>' : 'above ' + from + ' µg/m<sup>3</sup></label>'));
		}

		div.innerHTML = colorLabels.join('<br>');
		return div;
	};

	colorLegend.addTo(slcMap);

  return slcMap;
}


/**
 * Querys db to get the live sensors -- sensors that have data since yesterday beginnning of day
 * @return {[type]} [description]
 */
function drawSensorOnMap() {
  getDataFromDB(liveSensorURL_all).then((data) => {
    const response = data.map((d) => {
      // if (d['Sensor Source'] === 'Purple Air') {
      d.pm25 = conversionPM(d.pm25, d['Sensor Source'], d['Sensor Model']);
      // }

      return d
    });

    sensorLayer(response);

    }).catch((err) => {
      alert('error, request failed!');
      console.log('Error: ', err)
  });
}


/**
 * [sensorLayer description]
 * @param  {[type]} response [description]
 * @return {[type]}          [description]
 */
function sensorLayer(response){
  response.forEach(createMarker);
}


function createMarker(markerData) {
  var dotIcon = {
    iconSize:     [20, 20], // size of the icon
    iconAnchor:   [10, 10], // point of the icon which will correspond to marker's location
    popupAnchor:  [0, -5], // point from which the popup should open relative to the iconAnchor
    html: ''
  };

  console.log(markerData);

  if (markerData.Latitude !== null && markerData.Longitude !== null) {
    let classList = 'dot';
    let currentPM25 = markerData.pm25;

    let currentTime = new Date().getTime()
    let timeLastMeasurement = markerData.time;
    let minutesINBetween = (currentTime - timeLastMeasurement) / (1000 * 60);

    let theColor
    if (markerData['Sensor Source'] === 'airu') {
      if (minutesINBetween < 5.0) {
        theColor = getColor(currentPM25);
      } else {
        theColor = 'noColor';
      }
    } else {
      theColor = getColor(currentPM25);
    }

    // let theColor = getColor(markerData["pm25"]);
    // console.log(item["ID"] + ' ' + theColor + ' ' + item["pm25"])
    classList = classList + ' ' + theColor + ' ';

    // throw away the spaces in the sensor name string so we have a valid class name
    classList += markerData["Sensor Source"].replace(/ /g, '');
    // classList += ' ' + item['ID'];
    dotIcon.className = classList;

    var mark = new L.marker(
      L.latLng(
        parseFloat(markerData.Latitude),
        parseFloat(markerData.Longitude)
      ),
      { icon: L.divIcon(dotIcon) }
    ).addTo(sensLayer);

    mark.id = markerData['ID'];
    if (markerData["Sensor Source"] == "airu") {
      liveAirUSensors.push(markerData.ID)
    }

    mark.bindPopup(
      L.popup({closeButton: false, className: 'sensorInformationPopup'}).setContent('<span class="popup">' + markerData["Sensor Source"] + ': ' + markerData.ID + '</span>'))
    // mark.bindPopup(popup)

    mark.on('click', populateGraph)
    mark.on('mouseover', function(e) {
      // console.log(e.target.id)
      this.openPopup();
    });
    mark.on('mouseout', function(e) {
      this.closePopup();
    });
  }
}


function updateDots() {
  console.log('updating the dots current value');

  getDataFromDB(lastPM25ValueURL).then((data) => {

    // apply conversion for purple air
    Object.keys(data).forEach(function(key) {
        console.log(key, data[key]);
        let sensorModel = data[key]['Sensor Model'];
        let sensorSource = data[key]['Sensor Source'];
        // console.log(conversionPM(data[key]['last'], sensorModel))
        data[key]['last'] = conversionPM(data[key]['last'], sensorSource, sensorModel);
        // console.log(data[key]['last'])
    });

    sensLayer.eachLayer(function(layer) {
      // console.log(layer.id)
      let currentTime = new Date().getTime()
      let timeLastMeasurement = new Date(data[layer.id].time).getTime();
      let minutesINBetween = (currentTime - timeLastMeasurement) / (1000 * 60);

      let currentPM25 = data[layer.id].last;

      let theColor
      if (data[layer.id]['Sensor Source'] === 'airu') {
        if (minutesINBetween < 5.0) {
          theColor = getColor(currentPM25);
        } else {
          theColor = 'noColor';
        }
      } else {
        theColor = getColor(currentPM25);
      }



      console.log(layer.id + ' ' + theColor + ' ' + currentPM25)
      $(layer._icon).removeClass(epaColors.join(' '))
      $(layer._icon).addClass(theColor)
    });

  }).catch((err) => {
    alert("error, request failed!");
    console.log("Error: ", err);
    console.warn(arguments);
  });
}


function updateSensors() {
  console.log('updating the sensors: adding new airUs if available');

  getDataFromDB(liveSensorURL_airU).then((data) => {
    // const response = data.map((d) => {
    //
    //   if (!liveAirUSensors.includes(d.ID)) {
    //     return d;
    //   }
    // });
    const response = data.filter((d) => {

      if (!liveAirUSensors.includes(d.ID)) {
        return d;
      }
    });

    sensorLayer(response);

    }).catch((err) => {
      alert('error, request failed!');
      console.log('Error: ', err)
  });
}

// 0 - 12 ug/m^3 is green
// 12.1 - 35.4 ug/m^3 is yellow
// 35.5 - 55.4 ug/m^3 is orange
// 55.5 - 150.4 ug/m^3 is red
// 150.5 - 250.4 ug/m^3 is veryUnhealthyRed
// above 250.5 ug/m^3 is hazardousRed
function getColor(currentValue) {
  let theColor;
  if (currentValue <= 12) {
    theColor = 'green';
  } else if (currentValue > 12 && currentValue <= 35.4) {
    theColor = 'yellow';
  } else if (currentValue > 35.4 && currentValue <= 55.4) {
    theColor = 'orange';
  } else if (currentValue > 55.4 && currentValue <= 150.4) {
    theColor = 'red';
  } else if (currentValue > 150.4 && currentValue <= 250.4) {
    theColor = 'veryUnhealthyRed';
  } else if (isNaN(currentValue)) {     // dealing with NaN values
    theColor = 'noColor';
  } else {
    theColor = 'hazardousRed';
  }

  return theColor;
}


// var map = setupMap();

function distance(lat1, lon1, lat2, lon2) {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 +
  c(lat1 * p) * c(lat2 * p) *
  (1 - c((lon2 - lon1) * p)) / 2;

  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}


function findDistance(r, mark){
  var lt = mark.getLatLng().lat;
  var lng = mark.getLatLng().lng;
  var closestsensor = null;
  var sensorobject = null;

  r.forEach(function (item){
    if (item["Latitude"] !== null && item["Longitude"] !== null) {
      var d = distance(lt, lng, parseFloat(item["Latitude"]), parseFloat(item["Longitude"]));
      //compare old distance to new distance. Smaller = closestsensor
      if (closestsensor === null) {
        closestsensor = d; //distance
        sensorobject = item; //data object
      } else {
        if (closestsensor > d) {
          closestsensor = d;
          sensorobject = item;
        }
      }
    }
  });
  return sensorobject;
}


function findCorners(ltlg) {
  var cornerarray = [];
  lt = ltlg.lat;
  lg = ltlg.lng;

  var lt1 = lt - 5.0;
  cornerarray.push(lt1);
  var lt2 = lt + 5.0;
  cornerarray.push(lt2);
  var lg1 = lg - 5.0;
  cornerarray.push(lg1);
  var lg2 = lg + 5.0;
  cornerarray.push(lg2);

  return cornerarray;
}


function findNearestSensor(cornerarray, mark, callback) {

  getDataFromDB(liveSensorURL_all).then((data) => {

    response = data.map((d) => {
      // return only location and ID
      const newD = {};
      newD.ID = d.ID;
      newD.Latitude = d.Latitude;
      newD.Longitude = d.Longitude;
      newD.SensorSource = d['Sensor Source']

      return newD;
    });

    var closest = findDistance(response, mark); // returns closest sensor using distance equation
    callback(closest);
  }).catch((err) => {
    alert("error, request failed!");
    console.log("Error: ", err);
    console.warn(arguments);
  });
}


// function addData (sensorData){
//   sensorData = sensorData.results[0].series[0];
//   var chartLabel = sensorData.values[0][sensorData.columns.indexOf('ID')];
//   var markrname = sensorData.values[0][sensorData.columns.indexOf('ID')]; //what shows up in the marker on click (name of sensor)
//   var timeColumn = sensorData.columns.indexOf('time');
//   var pm25Column = sensorData.columns.indexOf('pm2.5 (ug/m^3)');
//
//   sensorData = sensorData.values.map(function (d) {
//     return {
//       id: markrname,
//       time: new Date(d[timeColumn]),
//       pm25: d[pm25Column]
//     };
//   }).filter(function (d) {
//     return d.pm25 === 0 || !!d.pm25;  // forces NaN, null, undefined to be false, all other values to be true
//   });
//
//   lineArray.push({
//     id: markrname,
//     sensorData: sensorData
//   }); //pushes data for this specific line to an array so that there can be multiple lines updated dynamically on Click
//   drawChart();
// }


function preprocessDBData(id, sensorData) {

  let tags = sensorData["tags"][0];
  let sensorSource = tags["Sensor Source"];
  let sensorModel = tags["Sensor Model"];

  const processedSensorData = sensorData["data"].map((d) => {
    return {
      id: id,
      time: new Date(d.time),
      // pm25: d['pm25']
      pm25: conversionPM(d.pm25, sensorSource, sensorModel)
    };
  }).filter((d) => {
    return d.pm25 === 0 || !!d.pm25; // forces NaN, null, undefined to be false, all other values to be true
  });

  var present = false;
  for (var i = 0; i < lineArray.length; i++) {
    if (lineArray[i].id === id) {
      present = true;
      break;
    }
  }

  if (!present) {
    console.log('not in there yet');
    var newLine = {id: id, sensorSource: sensorSource, sensorData: processedSensorData};

    // pushes data for this specific line to an array so that there can be multiple lines updated dynamically on Click
    lineArray.push(newLine)

    drawChart();
  }
}


function drawChart (){
  var svg = d3.select("#timeline svg");
  var bounds = svg.node().getBoundingClientRect();
  var width = bounds.width;
  var height = bounds.height;

  var formatDate = d3.timeFormat('%a %m/%d/%Y');
  var formatTime = d3.timeFormat('%I:%M%p');
  // Mon Jan 29 2018 15:01:16 GMT-0700 (MST)
  // var timestampPrser = d3.timeParse'(%a %b %Y %H:%M:%S GMT-0700 (MST)');
  var s = d3.formatSpecifier("f");
  s.precision = d3.precisionFixed(0.01);
  var pmFormat = d3.format(s);

  // Scale the range of the data
  var valueline = d3.line()
    .x(function (d) {
      return x(d.time);
    })
    .y(function (d) {
      return y(d.pm25);
    });

  //mike bostock's code
  var voronoi = d3.voronoi()
    .x(function(d) { return x(d.time); })
    .y(function(d) { return y(d.pm25); })
    .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.bottom]]);

  // adds the svg attributes to container
  var lines = svg.select('#lines').selectAll('path')
    .data(lineArray, function (d) {
      return d.id;
    }); //any path in svg is selected then assigns the data from the array

  lines.exit().remove(); //remove any paths that have been removed from the array that no longer associated data

  // var linesEnter = lines.enter().append("path"); // looks at data not associated with path and then pairs it
  // lines = linesEnter.merge(lines); //combines new path/data pairs with previous, unremoved data

  lines.enter().append("path") // looks at data not associated with path and then pairs it
       .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
       .attr("d", d => { return valueline(d.sensorData); })
       .attr("class", d => 'line-style line' + d.id)
       .attr("id", function(d) { return 'line_' + d.id; });
       // .attr("stroke", d => lineColor(d.id)); //no return for d function, see above for example

  var focus = svg.select(".focus");
  var dateFocus = svg.select(".dateFocus");



  function mouseover(d) { //d is voronoi paths

    // iterate over the layers and get the right one
    sensLayer.eachLayer(function(layer) {
      if (layer.id === d.data.id) {
        layer.openPopup();
      }
    });

    let hoveredLine = svg.select('.line' + d.data.id);
    hoveredLine.classed("hover", true);
    // Sneaky hack to bump hoveredLine to be the last child of its parent;
    // in SVG land, this means that hoveredLine will jump to the foreground
    //.node() gets the dom element (line element), then when you append child to the parent that it already has, it bumps updated child to the front
    hoveredLine.node().parentNode.appendChild(hoveredLine.node());
    // console.log(d.data.time)
    focus.attr("transform", "translate(" + (x(d.data.time) + margin.left) + "," + (y(d.data.pm25) + margin.top) + ")"); //x and y gets coordinates from values, which we can then change with margin
    // focus.select("text").text(d.data.id);
    // focus.select("text").text(formatTime(d.data.time) + ': ' + d.data.pm25 + ' µg/m\u00B3');
    focus.select("text").text(pmFormat(d.data.pm25) + ' µg/m\u00B3');

    // date focus
    dateFocus.attr("transform", "translate(" + (x(d.data.time) + margin.left) + "," + (y(2) + margin.top) + ")");
    dateFocus.select("rect").attr('x', -1);
    dateFocus.select("rect").attr('height', 9);
    dateFocus.select("rect").attr('width', 2);

    // the date
    dateFocus.select("#focusDate").text(formatDate(d.data.time));
    dateFocus.select("#focusDate").attr('text-anchor', 'middle');
    dateFocus.select("#focusDate").attr('y', '30');

    // the time
    dateFocus.select("#focusTime").text(formatTime(d.data.time));
    dateFocus.select("#focusTime").attr('text-anchor', 'middle');
    dateFocus.select("#focusTime").attr('y', '40');
  }

  function mouseout(d) {

    // close the popup
    sensLayer.eachLayer(function(layer) {
      if (layer.id === d.data.id) {
        layer.closePopup();
      }
    });

    let hoveredLine = svg.select('.line' + d.data.id);
    hoveredLine.classed("hover", false);
    focus.attr("transform", "translate(-100,-100)");
  }

  console.log(lineArray);

  var listOfLists = lineArray.map(function(d) {
    return d.sensorData;
  });
  var listOfPoints = d3.merge(listOfLists);
  var voronoiPolygons = voronoi.polygons(listOfPoints);

  var voronoiGroup = svg.select(".voronoi")
                        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var voronoiPaths = voronoiGroup.selectAll("path")
                                 .data(voronoiPolygons);

  voronoiPaths.exit().remove();

  var voronoiPathsEnter = voronoiPaths.enter().append("path");

  voronoiPaths = voronoiPaths.merge(voronoiPathsEnter);

  voronoiPaths.attr("d", function(d) { return d ? "M" + d.join("L") + "Z" : null; })
              .on("mouseover", mouseover) //I need to add a name for this
              .on("mouseout", mouseout);

  // adds the svg attributes to container
  let labels = svg.select("#legend").selectAll("text").data(lineArray, d => d.id); //any path in svg is selected then assigns the data from the array
  labels.exit().remove(); //remove any paths that have been removed from the array that no longer associated data
  // let labelEnter = labels.enter().append("text"); // looks at data not associated with path and then pairs it
  // labels = labelEnter.merge(labels); //combines new path/data pairs with previous, unremoved data
  //
  // //set up the legend later
  //  labels.attr("x", margin.left + width/2)
  //  .attr("y", margin.top)
  //  .attr("text-decoration")
  //  .attr("text-anchor", "middle")
  //  .attr("font-family", "verdana")
  //  .text(d => d.id);
}


function getGraphData(mark, aggregation) {
  findNearestSensor(findCorners(mark.getLatLng()), mark, function (sensor) {
    // mark = mark.bindPopup('<p>'+ sensor["ID"] +'</p>').openPopup();

    // get the data displayed in the timeline
    // var linesInTimeline = d3.select('svg').select('#lines').selectAll('path').data();
    //
    // // check if clicked sensor ID is already there
    // var present = false;
    // for (var i = 0; i < linesInTimeline.length; i++) {
    //   if (linesInTimeline[i].id === sensor['ID']) {
    //     present = true;
    //     break;
    //   }
    // }
    //
    // if (!present) {

      // var aggregation = false;

      let theRoute = '';
      let parameters = {};
      if (!aggregation) {
        theRoute = '/rawDataFrom?';
        parameters = {'id': sensor['ID'], 'sensorSource': sensor['SensorSource'], 'start': pastDate, 'end': today, 'show': 'pm25'};
      } else if (aggregation) {
        theRoute = '/processedDataFrom?';
        parameters = {'id': sensor['ID'], 'sensorSource': sensor['SensorSource'], 'start': pastDate, 'end': today, 'function': 'mean', 'functionArg': 'pm25', 'timeInterval': '5m'}; // 60m
      } else {
        console.log('hmmmm problem');
      }

      var url = generateURL(dbEndpoint, theRoute, parameters);
      console.log(url)
      getDataFromDB(url).then(data => {

          preprocessDBData(sensor["ID"], data)

      }).catch(function(err){

          alert("error, request failed!");
          console.log("Error: ", err)
      });
    // }
  });
}


function reGetGraphData(theID, theSensorSource, aggregation) {

  let theRoute = '';
  let parameters = {};
  if (!aggregation) {
    theRoute = '/rawDataFrom?';
    parameters = {'id': theID, 'sensorSource': theSensorSource, 'start': pastDate, 'end': today, 'show': 'pm25'};
  } else if (aggregation) {
    theRoute = '/processedDataFrom?';
    parameters = {'id': theID, 'sensorSource': theSensorSource, 'start': pastDate, 'end': today, 'function': 'mean', 'functionArg': 'pm25', 'timeInterval': '5m'}; // 60min
  } else {
    console.log('hmmmm problem');
  }

  var url = generateURL(dbEndpoint, theRoute, parameters);
  console.log(url)
  getDataFromDB(url).then(data => {

      preprocessDBData(theID, data)

  }).catch(function(err){

      alert("error, request failed!");
      console.log("Error: ", err)
  });

}

// var markr = null;

// called when clicked somewhere on the map
// function onMapClick(e) {
//   markr = new L.marker(e.latlng).addTo(map)
//
//   makeGraph(markr);
// }




//map.on('click', onMapClick);

/* this is for parsing through Amir's data
and then building a heat map from the data */

// lonPromise = getData("leaflet/sample-data/XGPS1.csv");
// latPromise = getData("leaflet/sample-data/XGPS2.csv");
// pmValPromise = getData("leaflet/sample-data/YPRED.csv");
//
// lvArray = []; //locations + values array
// Promise.all([lonPromise, latPromise, pmValPromise]) //Promise.all waits for all the other promises to finish
// .then(function (promiseResults) { //once they are finished, the .THEN tells it the next step (a function)
//   var lon = promiseResults[0].trim().split('\n');
//   lon = lon[0].split(',').map(value => Number(value));
//   var lat = promiseResults[1].trim().split('\n');
//   lat = lat.map(row => Number(row.split(',')[0]));
//   var pmVal = promiseResults[2].split('\n');
//   var results = [];
//
//   if (pmVal.length !== lat.length) {
//     throw new Error('wrong number of lat coordinates');
//   }
//
//   pmVal.forEach((row, latIndex) => {
//     row = row.split(',');
//     if (row.length <= 1) {
//       return;
//     }
//     if (row.length !== lon.length) {
//       throw new Error('wrong number of lon coordinates');
//     }
//     row.forEach((value, lonIndex) => {
//       results.push({
//         lat: lat[latIndex],
//         lon: lon[lonIndex],
//         pmVal: Number(value)
//       });
//     });
//   });
//   makeHeat(results);
// });



function getData(strng){
  return new Promise(function (resolve, reject) { //use a promise as a place holder until a promise is fulfilled (resolve)
    d3.text(strng, function(data){
      // console.log(strng, data)
      resolve(data);
    });
  });
}




// sensLayer.addTo(theMap);
// L.control.layers(null, overlayMaps).addTo(theMap);


function populateGraph(e) {

  if (d3.select(this._icon).classed('sensor-selected')) {
    // if dot already selected
    let clickedDotID = this.id
    // d3.select("#line_" + clickedDotID).remove();
    lineArray = lineArray.filter(line => line.id != clickedDotID);
    drawChart();
    d3.select(this._icon).classed('sensor-selected', false);

  } else {
    // only add the timeline if dot has usable data
    if (!d3.select(this._icon).classed('noColor')) {
      d3.select(this._icon).classed('sensor-selected', true);

      let aggregation = getAggregation(whichTimeRangeToShow);
      getGraphData(this, aggregation);
      // if (whichTimeRangeToShow === 1) {
      //
      //   getGraphData(this, false);
      //
      // } else {
      //   getGraphData(this, true);
      // }

    }
  }
}


// function showID() {
//   console.log(this)
//   var dotCenter = [this._latlng.lat, this._latlng.long]
//   var endPoint = [this._latlng.lat + 0.002, this._latlng.long  + 0.004]
//
//   L.polyline([
//     dotCenter,
//     endPoint
//   ]).addTo(map);
//
// }

/* example of the leaflet heatmap plugin, possibly for
modification for interpolation between points.
*/
function makeHeat(results) {
  results = results.map(function (p) { return [p["lat"], p["lon"] ,(p["pmVal"])/100 ]});
  heat = L.heatLayer(results).addTo(map);
}

function clearData(changingTimeRange) {
  // lineArray.forEach( // TODO clear the markers from the map )
  lineArray = []; //this empties line array so that new lines can now be added
  d3.selectAll("#lines").html('');  // in theory, we should just call drawChart again
  d3.selectAll(".voronoi").html('');

  if (!changingTimeRange) {
    d3.selectAll('.dot').classed('sensor-selected', false);
  }
}


/* converts pm2.5 purpleAir to pm2.5 to federal reference method in microgram/m^3 so that the data is "consistent"
only used when data is from purpleAir sensors. There are two different kinds of sensors, thus two different conversions
for sensors pms1003:
PM2.5,TEOM =−54.22405ln(0.98138−0.00772PM2.5,PMS1003)
for sensors pms5003:
PM2.5,TEOM =−64.48285ln(0.97176−0.01008PM2.5,PMS5003)
*/
function conversionPM(pm, sensorSource, sensorModel) {

  if (sensorSource != 'airu' ) {
    let model = null;
    if (sensorModel != null) {
      model = sensorModel.split('+')[0];
    }

    var pmv = 0;
    if (model === 'PMS5003') {
      // console.log('PMS5003')
      // pmv = (-1) * 64.48285 * Math.log(0.97176 - (0.01008 * pm));
      pmv = 0.7778*pm + 2.6536;
    } else if (model === 'PMS1003') {
      // console.log('PMS1003')
      // pmv = (-1) * 54.22405 * Math.log(0.98138 - (0.00772 * pm));
      pmv = 0.5431*pm + 1.0607;
    } else {
      pmv = pm;
    }
  } else {
    // console.log(sensorModel + ' no model?');
    // airu
    // pmv = pm;
    pmv = 0.8582*pm + 1.1644;
  }

  return pmv;
}
