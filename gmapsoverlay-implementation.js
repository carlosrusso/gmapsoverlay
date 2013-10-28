/*
 This Source Code Form is subject to the
 terms of the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed
 with this file, You can obtain one at
 http://mozilla.org/MPL/2.0/.
 */

/*

Code adapted by Carlos Russo for Webdetails

* TODO Consider using .kml files directly, see https://code.google.com/p/geoxml3/
* TODO Attempt merging with NewMapComponent
* TODO Attempt using API of https://github.com/mapstraction/mxn/


*/

function submitGeocode(input) {
    return function(e) {
        var keyCode;

        if (window.event) {
            keyCode = window.event.keyCode;
        } /*else if (variable) {
           keyCode = e.which;
           }*/

        if (keyCode == 13) {
            geocoder.geocode( { address: input.value }, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    map.fitBounds(results[0].geometry.viewport);
                } else {
                    alert("The location entered could not be found");
                }
            });
        }
    }
}

function getColor (value, legendRanges) {
    var qtd = Object.keys(legendRanges.ranges).length;
    for (var j = 0; j < qtd; j++) {
	if ((isNaN(legendRanges.ranges[j].min) && value <= legendRanges.ranges[j].max) ||
	    (isNaN(legendRanges.ranges[j].max) && value >= legendRanges.ranges[j].min) ||
	    (value >= legendRanges.ranges[j].min && value <= legendRanges.ranges[j].max)) {
	    return legendRanges.ranges[j].color;
	}
    }
}

var gMapsOverlayComponentDev = UnmanagedComponent.extend({
    mapEngineOpts: undefined, //override this in preExec
    colormap: [[0, 102, 0, 255], [255, 255 ,0,255], [255, 0,0, 255]], //RGBA
    getColorMap: function() {

        var interpolate = function(a, b, n){
            var c = [], d=[];
            var k, kk, step;
            for (k=0; k<a.length; k++){
                c[k] = [];
                for (kk=0, step = (b[k]-a[k])/n; kk<n; kk++){
                    c[k][kk] = a[k] + kk*step;
                }
            }
            for (k=0; k<c[0].length; k++){
                d[k] = [];
                for (kk=0; kk<c.length; kk++){
                    d[k][kk] =  Math.round(c[kk][k]);
                }
            }
            return d;
        };
        var cmap = [];
        for (k=1; k<this.colormap.length; k++)
        {
            cmap = cmap.concat(interpolate(this.colormap[k-1], this.colormap[k], 32));
        }
        return _.map( cmap, function (v) {
            return 'rgba('+ v.join(',') +')';
        });
    },
    _getMapDefinition : function(callback){
        var myself = this;
        if (!!this.mapName & ! this.mapDefinition){
	    $.getJSON(this.mapName, function(json, callback) {
	        if (json)  {
	            myself.mapDefinition = json;
		}
	    });
        }
        //Dashboards.log('mapDefinition :' + _.keys(this.mapDefinition));
        callback.apply(myself);
    },
    postProcessData: function (values, myself){
        /** do a postProcessing, something like a postPostFetch
         */

        myself.queryResult = {};
	for (i in values.resultset) {
	    var item = values.resultset[i];
	    myself.queryResult[item[0]]  = {
                value: item[1]
            };
            if (item.length > 2){
                myself.queryResult[item[0]].payload = item.slice(2);
            }
	}

        // patch queryResult with color information
        var colormap = myself.getColorMap();
        var qvalues = _.map(myself.queryResult, function (q) { return q.value; });
        var minValue = _.min(qvalues), maxValue = _.max(qvalues);
        var n = colormap.length;
        _.each(myself.queryResult, function (v, key) {
            var level =  (v.value-minValue) / (maxValue - minValue);
            myself.queryResult[key] = _.extend({
                level: level,
                fillColor: colormap[Math.floor( level * (n-1)) ],
                fillOpacity: 0.35,
                strokeWeight: 0.5
            },  myself.queryResult[key]);

        });
    },
    // _parseLegend : function (){
    //     this.legendRanges = new Object;
    //     if (this.legend) {
    //         this.legendRanges.ranges = new Object;
    //         this.legendRanges.text = ((!this.legendText) ? "" : this.legendText);

    //         for (var i = 0; i < this.legend.length; i++) {
    //     	var opts = this.legend[i][1].split(";");
    //     	this.legendRanges.ranges[i] = new Object;
    //     	this.legendRanges.ranges[i].min = parseFloat(opts[0]);
    //     	this.legendRanges.ranges[i].max = parseFloat(opts[1]);
    //     	this.legendRanges.ranges[i].color = opts[2];
    //     	this.legendRanges.ranges[i].desc = this.legend[i][0];
    //         }

    //         this.legendRanges.getColor = function (value) {
    //     	for (var j = 0; j < Object.keys(this.legendRanges.ranges).length; j++) {
    //     	    if ((isNaN(this.legendRanges.ranges[j].min) && value <= this.legendRanges.ranges[j].max) ||
    //     		(isNaN(this.legendRanges.ranges[j].max) && value >= this.legendRanges.ranges[j].min) ||
    //     		(value >= this.legendRanges.ranges[j].min && value <= this.legendRanges.ranges[j].max)) {
    //     		return this.legendRanges.ranges[j].color;
    //     	    }
    //     	}

    //         }
    //     }
    // },
    update : function() {

	myself = this;
        //this._parseLegend();

        // first get the map definition (asynchronously), and then launch triggerQuery (asynchronously)
        this._getMapDefinition( function () {
            if (_.isEmpty(myself.queryDefinition)) {
                myself._initialize();
            } else {
            myself.triggerQuery(myself.queryDefinition, function(values) {
                //myself._getMapDefinition();
                myself.postProcessData(values, myself);
                // Start Google Map stuff
	        myself._initialize();
                // myself.draw will be called once the map is loaded
            });
            }
        });

    },

    _initialize: function() {
	this.mapEngine = new GMapEngineDev();
        this.mapEngine.opts = $.extend(true, this.mapEngine.opts, this.mapEngineOpts);
        if (this.clickCallback){
            this.mapEngine.clickCallback = this.clickCallback;
        }
	this.mapEngine.init(this);
    },

    draw: function() {
	var myself = this;
	this.ph = $("#" + this.htmlObject);
	this.ph.empty();

	this.mapEngine.createMap(this.ph[0], this.centerLongitude, this.centerLatitude, this.defaultZoomLevel);
   	this.mapEngine.renderMap(this.mapDefinition, this.queryResult, ((!this.defaultColor) ? "#EAEAEA" : this.defaultColor), myself.legendRanges);
	this.mapEngine.resetButton(this.ph[0].id, this.defaultZoomLevel, this.centerLongitude, this.centerLatitude);

	if (this.search == true) {
	    this.mapEngine.searchBox(this.ph[0].id);
	}
        this.mapEngine.renderLegend(this.ph[0].id, this.mapDefinition, this.queryResult, this.getColorMap(), [0, 0.5, 1]);

	// if (Object.keys(myself.legendRanges.ranges).length > 0) {
	//     this.mapEngine.createLegend(this.ph[0].id, this.legendRanges);
	// }
        if (this.hackHook){
            this.hackHook();
        }

    }

});

var GMapEngineDev = Base.extend({
    map: undefined,
    opts: {
        mapOptions: {
            // styles:[
            //     {
            //         "featureType": "administrative",
            //         "stylers": [ { "visibility": "off" } ]
            //     },
            //     {
            //         featureType: "road",
            //         elementType: "all",
            //         stylers: [ { visibility: "off" } ]
            //     }
            // ],
	    disableDefaultUI: false,
	    mapTypeControl: true,
	    streetViewControl: false
        }
    },
    opened_info: undefined,
    centered: false,
    overlays: [],
    init: function(mapComponent) {

        $.when( loadGoogleMapsOverlay() ).then (
            function (status) {
		mapComponent.draw();
            });
    },

    createMap: function(target, centerLongitude, centerLatitude, defaultZoomLevel) {
        // see possible features on https://developers.google.com/maps/documentation/javascript/reference#MapTypeStyleFeatureType
	var mapOptions = $.extend(true, {
	    zoom: parseInt(defaultZoomLevel),
	    center: new google.maps.LatLng(centerLatitude, centerLongitude),
            mapTypeId: google.maps.MapTypeId.TERRAIN
	}, this.opts.mapOptions);

        this.map = new google.maps.Map(target, mapOptions);
	this.opened_info = new google.maps.InfoWindow();
    },


    renderMap: function(mapDefinition, queryResult, defaultColor, legend) {
        if (!mapDefinition){
            return;
        }
	var myself = this;

	for (var c in mapDefinition) {
	    var coods = mapDefinition[c],
	        polyPath = [];
	    for (var k = 0; k < coods.length; k++) {
		polyPath.push(new google.maps.LatLng( coods[k][0], coods[k][1]) );
	    }

            var shapeinfo = {
		fillColor:  !!queryResult[c] ? queryResult[c].fillColor: defaultColor,
		fillOpacity: !!queryResult[c] ? queryResult[c].fillOpacity : 0,
		strokeWeight: !!queryResult[c] ? queryResult[c].strokeWeight : 0,
                strokeColor: '#edeceb'
	    };

            var shape = new google.maps.Polygon(_.extend({
		paths : polyPath
	    }, shapeinfo));


            var shapeValue = queryResult[c] ? queryResult[c].value : null;

	    shape.infowindow = new google.maps.InfoWindow({
		content: myself.tooltipMessage(c, shapeValue),
                pixelOffset: { width: 0, height:-3 }
	    });
            shape.infowindow.dataPayload = _.extend({
                name: c,
                value: shapeValue,
                level: queryResult[c] ? queryResult[c].level : 0
            }, shapeinfo);

            if (!!queryResult[c] ) {
                queryResult[c].shape = shape;
            }

	    shape.setMap(myself.map);
            google.maps.event.addListener(shape, 'click', function (event) {
                myself.clickCallback(this.infowindow, event);
            });
	    google.maps.event.addListener(shape, 'mousemove',function (event) {
                //myself.map.setCenter(event.latLong); //doesn't seem to work
                //this.strokeWeight=2;
                //myself.opened_info.close();
                this.fillOpacity=0.7;
                this.strokeColor= "#FFFFFF";
                this.setVisible(false);
                this.setVisible(true);
                this.infowindow.setOptions({ maxWidth: 500});
                this.infowindow.setPosition(event.latLng);
                if (!this.infowindow.getMap())
                    this.infowindow.open(myself.map);
                myself.opened_info = this.infowindow;
            });
            google.maps.event.addListener(shape, 'mouseout', function (event) {
                //this.strokeWeight=0.5;
                myself.opened_info.close();
                this.fillOpacity=0.35;
                this.strokeColor= "#edeceb";
                this.setVisible(false);
                this.setVisible(true);
            });
            //google.maps.event.addListener(shape.infowindow, 'click', function (event) {
            //    myself.clickCallback(this, event);
            //});
	    //google.maps.event.addListener(shape, 'mousemove', function (event) {myself.showInfo(event, myself, this.infowindow);});
            //google.maps.event.addListener(shape, 'mousemove', function (event) {myself.tooltipMessage(event, myself, c, shapeValue, this );});
	}
    },
    tooltipMessage : function (shapeName, shapeValue) {
        var message = "";
        return '<div class="gmapsoverlay-tooltip">' + message + '</div>';
    },
    clickCallback : function (shape, event){
        //Override this
        Dashboards.log(shape.dataPayload.name + ':' + shape.dataPayload.value + ':' + shape.dataPayload.level*100 + '%');
    },
    showInfo: function (event, mapEngine, infowindow) {
	mapEngine.opened_info.close();
	//if (mapEngine.opened_info.name != infowindow.name) {
	infowindow.setPosition(event.latLng);
	infowindow.open(mapEngine.map);
	mapEngine.opened_info = infowindow;
	//}
    },

    resetButton: function (id, zoom, centerLongitude, centerLatitude) {

	var myself = this;

	var controlReset = document.createElement('div');
	var linkReset = document.createElement('a');
	controlReset.appendChild(linkReset);
	controlReset.setAttribute('id', 'controlReset_' + id);
	linkReset.setAttribute('id', 'linkReset_' + id);
	linkReset.href = "javascript:void(0)";
	linkReset.className = 'button';
	linkReset.onclick = (function () {	myself.map.setZoom(zoom);
						myself.map.setCenter(new google.maps.LatLng(centerLatitude, centerLongitude));
					 });
	//linkReset.textContent = 'Reset';
	linkReset.innerHTML = 'Reset';

	myself.map.controls[google.maps.ControlPosition.TOP_LEFT].push(controlReset);
    },

    searchBox: function (id) {

	var myself = this;

	var control = document.createElement('div');
	var input = document.createElement('input');
	control.appendChild(input);
	control.setAttribute('id', 'locationField_' + id);
	input.style.width = '250px';
	input.style.height = '100%';
	input.style.margin = '0px';
	input.style.border = '1px solid #A9BBDF';
	input.style.borderRadius = '2px';
	input.setAttribute('id', 'locationInput_' + id);
	myself.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(control);

	var ac = new google.maps.places.Autocomplete(input, { types: ['geocode'] });
	google.maps.event.addListener(ac, 'place_changed', function() {
	    var place = ac.getPlace();
	    if (place.geometry.viewport) {
		myself.map.fitBounds(place.geometry.viewport);
	    } else {
		myself.map.setCenter(place.geometry.location);
		myself.map.setZoom(17);
	    }
	});

	google.maps.event.addListener(myself.map, 'bounds_changed', function() {
	    input.blur();
	    input.value = '';
	});

	input.onkeyup = submitGeocode(input);
    },
    // createLegend: function (id, legend) {

    //     var myself = this;

    //     // Set CSS styles for the DIV containing the control
    //     // Setting padding to 5 px will offset the control
    //     // from the edge of the map
    //     var controlDiv = document.createElement('DIV');
    //     controlDiv.style.padding = '5px';
    //     controlDiv.setAttribute('id', 'legendDiv_' + id);

    //     // Set CSS for the control border
    //     var controlUI = document.createElement('DIV');
    //     controlUI.setAttribute('id', 'legendUI_' + id);
    //     controlUI.style.backgroundColor = 'white';
    //     controlUI.style.borderStyle = 'solid';
    //     controlUI.style.borderWidth = '1px';
    //     controlUI.title = 'Legend';
    //     controlDiv.appendChild(controlUI);

    //     // Set CSS for the control text
    //     var controlText = document.createElement('DIV');
    //     controlText.setAttribute('id', 'legendText_' + id);
    //     controlText.style.fontFamily = 'Arial,sans-serif';
    //     controlText.style.fontSize = '12px';
    //     controlText.style.paddingLeft = '4px';
    //     controlText.style.paddingRight = '4px';

    //     var legendTable = "";
    //     var qtd = Object.keys(legend.ranges).length;
    //     for (var j = 0; j < qtd; j++) {

    //         if (isNaN(legend.ranges[j].min)) {
    //     	legendTable += "<li><span style='background:" + legend.ranges[j].color + ";'><= " + legend.ranges[j].max + "</span>" + legend.ranges[j].desc + "</li>";
    //         } else if (isNaN(legend.ranges[j].max)) {
    //     	legendTable += "<li><span style='background:" + legend.ranges[j].color + ";'>>= " + legend.ranges[j].min + "</span>" + legend.ranges[j].desc + "</li>";
    //         } else {
    //     	//legendTable += "<li><span style='background:" + legend.ranges[j].color + ";'>" + legend.ranges[j].min + "-" + legend.ranges[j].max + "</span>" + legend.ranges[j].desc + "</li>";
    //     	legendTable += "<li><span style='background:" + legend.ranges[j].color + ";'>" + legend.ranges[j].max + "</span>" + legend.ranges[j].desc + "</li>";
    //         }

    //     }

    //     // Add the text
    //     controlText.innerHTML = "" +
    //         "<div class='my-legend'>" +
    //         "<div class='legend-title'>Legend</div>" +
    //         "<div class='legend-scale'>" +
    //         "  <div class='legend-labels'>" +
    //         legendTable +
    //         "  </div>" +
    //         "</div>" +
    //         "<div class='legend-source'>" + legend.text + "</div>" +
    //         "</div>";

    //     controlUI.appendChild(controlText);

    //     myself.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
    // },
    renderLegend: function (id, mapDefinition, queryResult, colormap, ticks) {
        var engNotation = function(d) {
            var Log1000 = Math.log(1000);
            var engLabels = ['', ' k' , ' M', ' G' , ' T', ' P'];
            var exponent3 = ( d == 0 ? 0 :
                              Math.floor(Math.round( 100 * Math.log(d)/Log1000 )/100) );
            var mantissa = Math.round( 100* d / Math.pow(1000, exponent3))/100;
            return mantissa + engLabels[exponent3];
        };


        var sigFigs = function (num, sig) {
            if (num == 0)
                return 0;
            if (Math.round(num) == num)
                return num;
            var digits = Math.round((-Math.log(Math.abs(num)) / Math.LN10) + (sig || 2));
            //round to significant digits (sig)
            if (digits < 0)
                digits = 0;
            return num.toFixed(digits);
        };


        if (queryResult && mapDefinition ) {
            var values = _.map(queryResult, function (q) { return q.value; });
            var minValue = _.min(values),
                maxValue = _.max(values);
            var n = colormap.length;
            var rounding=1;
            if (maxValue < -5){
                rounding = ((maxValue -minValue)/5).toString().split('.');
                rounding = rounding.length > 1 ? Math.pow(10, Math.max(rounding[1].length, 3)): 1;
                }
            var legend = _.map(ticks, function (level) {
                var value = (minValue + level * (maxValue - minValue)*rounding)/rounding;
                return {
                    value: sigFigs(value,1),
                    level: level,
                    fillColor: colormap[Math.floor( level* n -1)]
                };
            });
        }

        this.legend = legend;

	// Set CSS styles for the DIV containing the control
	// Setting padding to 5 px will offset the control
	// from the edge of the map
	var controlDiv = document.createElement('DIV');
	controlDiv.style.padding = '5px';
	controlDiv.setAttribute('id', 'legendDiv_' + id);

	// Set CSS for the control border
	var controlUI = document.createElement('DIV');
	controlUI.setAttribute('id', 'legendUI_' + id);
	//controlUI.style.backgroundColor = 'white';
	//controlUI.style.borderStyle = 'solid';
	//controlUI.style.borderWidth = '1px';
	controlUI.title = 'Legend';
	controlDiv.appendChild(controlUI);

	// Set CSS for the control text
	var controlText = document.createElement('DIV');
	controlText.setAttribute('id', 'legendText_' + id);
	controlText.style.fontFamily = 'Arial,sans-serif';
	controlText.style.fontSize = '12px';
	controlText.style.paddingLeft = '4px';
	controlText.style.paddingRight = '4px';

	var legendTable = '';
        _.each(legend, function(el){
            //legendTable += "<li><span class='gmapsoverlay-legend-cell' style='background:" + el[2] + "; opacity:0.35;'>" +  "</span><span class='gmapsoverlay-legend-label' style='text-align:right;'>"+ el[1] + "</span></li>";
            var left = (el.level != 0) ? el.level*100 + '%' : '-1px';
           legendTable += "<div class='gmapsoverlay-legend-label' style='left:"+ left+ ";position:absolute;'><div>"+ el.value + "</div></div>";

        });

	// Add the text
        var legendTitle = 'Legend';
	controlText.innerHTML = "" +
	    "<div class='gmapsoverlay-legend'>" +
	    "  <div class='gmapsoverlay-legend-title'>"+ legendTitle+"</div>" +
	    "  <div class='gmapsoverlay-legend-scale'>" +
	    "    <div class='gmapsoverlay-legend-labels'>" +
         	    legendTable +
	    "    </div>" +
	    "  </div>" +
	    "  <div class='gmapsoverlay-legend-source'>" +
            "  </div>" +
	    "</div>";

	controlUI.appendChild(controlText);
	//this.map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(controlDiv);
        $('.gmapsoverlay-legend-container').remove();
        $('#' + id).after($( controlText.innerHTML ).addClass('gmapsoverlay-legend-container'));
    },

    showPopup: function(data, mapElement, popupHeight, popupWidth, contents, popupContentDiv, borderColor) {
        var overlay = new OurMapOverlay(mapElement.getPosition(), popupWidth, popupHeight, contents, popupContentDiv, this.map, borderColor);

	$(this.overlays).each(function (i, elt) {elt.setMap(null);});
        this.overlays.push(overlay);
    }

});
