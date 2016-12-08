/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
var powerbi;
(function (powerbi) {
    var extensibility;
    (function (extensibility) {
        var visual;
        (function (visual) {
            var MarineMapColumnType;
            (function (MarineMapColumnType) {
                MarineMapColumnType[MarineMapColumnType["data"] = 0] = "data";
                MarineMapColumnType[MarineMapColumnType["latitude"] = 1] = "latitude";
                MarineMapColumnType[MarineMapColumnType["longitude"] = 2] = "longitude";
                MarineMapColumnType[MarineMapColumnType["heading"] = 3] = "heading";
                MarineMapColumnType[MarineMapColumnType["link"] = 4] = "link";
                MarineMapColumnType[MarineMapColumnType["time"] = 5] = "time";
                MarineMapColumnType[MarineMapColumnType["category"] = 6] = "category";
                MarineMapColumnType[MarineMapColumnType["status"] = 7] = "status";
            })(MarineMapColumnType = visual.MarineMapColumnType || (visual.MarineMapColumnType = {}));
            ;
            var PopupBuilder = (function () {
                function PopupBuilder(id, columnInfos, data) {
                    this.id = id;
                    this.columnInfos = columnInfos;
                    this.data = data;
                }
                PopupBuilder.prototype.buildHtml = function () {
                    var _this = this;
                    var html = this.buildHeader(this.data.id);
                    var lastDataPoint = this.data.rows[this.data.rows.length - 1];
                    html += '<ul>';
                    var footerHtml = "";
                    var link = this.data.link;
                    $.each(this.columnInfos, function (i, column) {
                        if (column.type == MarineMapColumnType.data) {
                            html += _this.buildRow(column.displayName, lastDataPoint.values[column.colIndex]);
                        }
                        if (column.type == MarineMapColumnType.time) {
                            var date = new Date(lastDataPoint.values[column.colIndex]);
                            // var dateFormat = valueFormatter.create({format: "dd/MM/yyyy HH:mm:ss", value: date});
                            // footerHtml += dateFormat.format(date);
                            footerHtml += " " + (new Date()).toISOString();
                        }
                        if (column.type == MarineMapColumnType.link) {
                            link = lastDataPoint.values[column.colIndex];
                        }
                    });
                    html += '</ul>';
                    if (link != null && link != "")
                        html += this.buildMoreInfo(link);
                    html += this.buildFooter(footerHtml);
                    return html;
                };
                PopupBuilder.prototype.buildHeader = function (title) {
                    return '<div class="popup-title">' + title + '<span id="' + this.id + 'close" class="popup-close">x</span></div>';
                };
                PopupBuilder.prototype.buildRow = function (label, value) {
                    return '<li><span>' + label + '</span><span>' + value + '</span ></li>';
                };
                PopupBuilder.prototype.buildFooter = function (value) {
                    return '<div class="popup-footer">' + value + '</div>';
                };
                PopupBuilder.prototype.buildMoreInfo = function (link) {
                    return '<div class="popup-moreinfo"><a href="' + link + '" target="_blank">More info</a></div>';
                };
                return PopupBuilder;
            }());
            visual.PopupBuilder = PopupBuilder;
            var OpenlayerMap = (function () {
                function OpenlayerMap(elementId, baseUrl, useSignalR, zoomOnClickLevel) {
                    this.baseUrl = baseUrl;
                    this.useSignalR = useSignalR;
                    this.zoomOnClickLevel = zoomOnClickLevel;
                    // Position and zoomlevel of the map
                    this.lon = 0;
                    this.lat = 0;
                    this.zoom = 2;
                    this.language = 'en';
                    this.ships = {};
                    this.lineStyle = {
                        strokeColor: '#0000ff',
                        strokeOpacity: 0.5,
                        strokeWidth: 5
                    };
                    this.getTileURL = function (bounds) {
                        var res = this.map.getResolution();
                        var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
                        var y = Math.round((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
                        var z = this.map.getZoom();
                        var limit = Math.pow(2, z);
                        if (y < 0 || y >= limit) {
                            return null;
                        }
                        else {
                            x = ((x % limit) + limit) % limit;
                            var url = this.url;
                            var path = z + "/" + x + "/" + y + "." + this.type;
                            if (url instanceof Array) {
                                url = this.selectUrl(path, url);
                            }
                            return url + path;
                        }
                    };
                    this.drawmap(elementId);
                }
                OpenlayerMap.prototype.jumpTo = function (lon, lat, zoom) {
                    //var x = Lon2Merc(lon);
                    //var y = Lat2Merc(lat);
                    this.map.setCenter(this.NewLatLong(lat, lon), zoom);
                    return false;
                };
                OpenlayerMap.prototype.NewGeoPoint = function (lat, lon) {
                    return new OpenLayers.Geometry.Point(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());
                };
                OpenlayerMap.prototype.NewLatLong = function (lat, lon) {
                    return new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());
                };
                OpenlayerMap.prototype.addMarker = function (layer, ll, popupContentHTML) {
                    var self = this;
                    var feature = new OpenLayers.Feature(layer, ll);
                    feature.closeBox = false;
                    feature.popupClass = OpenLayers.Class(OpenLayers.Popup.Anchored, { minSize: new OpenLayers.Size(200, 100) });
                    feature.data.overflow = "hidden";
                    var marker = new OpenLayers.Marker(ll);
                    marker.feature = feature;
                    var markerClick = function (evt) {
                        var feature = this.feature;
                        var marker = this;
                        if (self.zoomOnClickLevel > 0) {
                            self.map.setCenter(marker.lonlat, self.zoomOnClickLevel);
                        }
                        var html = new PopupBuilder(feature.id, marker.columns, marker.shipdata).buildHtml();
                        if (feature.popup == null) {
                            feature.data.popupContentHTML = html;
                            feature.popup = feature.createPopup(feature.closeBox);
                            feature.popup.setSize(new OpenLayers.Size(300, 200));
                            self.map.addPopup(feature.popup);
                            feature.popup.show();
                        }
                        else {
                            feature.popup.setContentHTML(html);
                            feature.popup.show();
                        }
                        //We need to reattch this event as the setContentHTML destroys the click event.
                        $('#' + feature.id + 'close').click(function () {
                            feature.popup.hide();
                        });
                        $.each(self.ships, function (i, shipMarker) {
                            if (shipMarker.feature != null && shipMarker.feature.id != feature.id && shipMarker.feature.popup != null) {
                                shipMarker.feature.popup.hide();
                            }
                        });
                        feature.popup.moveTo(self.map.getLayerPxFromLonLat(marker.lonlat));
                        OpenLayers.Event.stop(evt);
                    };
                    marker.events.register("mousedown", marker, markerClick);
                    layer.addMarker(marker);
                    return marker;
                };
                OpenlayerMap.prototype.setMarkerUrl = function (marker) {
                    var statusColumn = null;
                    $.each(marker.columns, function (i, column) {
                        if (column.type == MarineMapColumnType.status) {
                            statusColumn = column;
                            return;
                        }
                    });
                    if (statusColumn != null) {
                        var data = marker.shipdata;
                        var status = data.rows[data.rows.length - 1].values[statusColumn.colIndex];
                        if (status == 1) {
                            marker.setUrl(this.baseUrl + '/resources/redpointer.png');
                            return;
                        }
                        if (status == 2) {
                            marker.setUrl(this.baseUrl + '/resources/yellowpointer.png');
                            return;
                        }
                        if (status == 3) {
                            marker.setUrl(this.baseUrl + '/resources/greenpointer.png');
                            return;
                        }
                    }
                    marker.setUrl(this.baseUrl + '/resources/graypointer.png');
                };
                OpenlayerMap.prototype.resize = function () {
                    var _this = this;
                    setTimeout(function () { _this.map.updateSize(); }, 200);
                };
                OpenlayerMap.prototype.destroy = function () {
                    this.map.destroy();
                };
                OpenlayerMap.prototype.plotdata = function (model) {
                    var _this = this;
                    if (model == null)
                        return;
                    var latIndex = -1;
                    var longIndex = -1;
                    var headingIndex = -1;
                    $.each(model.columns, function (i, column) {
                        if (column.type == MarineMapColumnType.latitude) {
                            latIndex = column.colIndex;
                        }
                        if (column.type == MarineMapColumnType.longitude) {
                            longIndex = column.colIndex;
                        }
                        if (column.type == MarineMapColumnType.heading) {
                            headingIndex = column.colIndex;
                        }
                    });
                    if (longIndex == -1 || latIndex == -1) {
                        return;
                    }
                    //Insert new ships and update ship position
                    $.each(model.data, function (i, ship) {
                        var dataFiltered = ship.rows.filter(function (row) {
                            if (row.values[latIndex] != 0.0 && row.values[longIndex] != 0.0) {
                                return true;
                            }
                            return false;
                        }).slice(-10);
                        var locations = dataFiltered.map(function (data, i) {
                            return _this.NewLatLong(data.values[latIndex], data.values[longIndex]);
                        });
                        var points = dataFiltered.map(function (data, i) {
                            return _this.NewGeoPoint(data.values[latIndex], data.values[longIndex]);
                        });
                        var marker = null;
                        if (typeof (_this.ships[ship.id]) == 'undefined') {
                            marker = _this.addMarker(_this.markerLayer, locations[locations.length - 1], ship.id);
                            _this.ships[ship.id] = marker;
                        }
                        else {
                            marker = _this.ships[ship.id];
                            marker.moveTo(_this.map.getLayerPxFromLonLat(locations[locations.length - 1]));
                        }
                        marker.shipdata = ship;
                        marker.columns = model.columns;
                        _this.setMarkerUrl(marker);
                        _this.rotateMarker(marker, ship.rows[ship.rows.length - 1].values[headingIndex]);
                        _this.plotTrail(ship.id, points);
                    });
                    this.removeUnselectedShips(model);
                };
                OpenlayerMap.prototype.removeUnselectedShips = function (model) {
                    //remove ships no longer in input data
                    for (var shipId in this.ships) {
                        if (this.ships.hasOwnProperty(shipId)) {
                            var found = false;
                            $.each(model.data, function (i, ship) {
                                if (shipId == ship.id) {
                                    found = true;
                                }
                            });
                            if (found == false) {
                                var marker = this.ships[shipId];
                                this.markerLayer.removeMarker(marker);
                                this.vectorLayer.destroyFeatures(marker.polylines);
                                delete this.ships[shipId];
                            }
                        }
                    }
                };
                //Plot trail after ship
                OpenlayerMap.prototype.plotTrail = function (shipId, points) {
                    if (typeof (this.ships[shipId].polylines) != 'undefined') {
                        var feature = this.ships[shipId].polylines;
                        this.vectorLayer.destroyFeatures(feature);
                    }
                    var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(points), null, this.lineStyle);
                    this.ships[shipId].polylines = feature;
                    this.vectorLayer.addFeatures(feature);
                };
                OpenlayerMap.prototype.rotateMarker = function (marker, rotation) {
                    $(marker.icon.imageDiv).css('transform-origin', '10px bottom');
                    $(marker.icon.imageDiv).css('transform', 'rotate(' + rotation + 'deg)');
                };
                OpenlayerMap.prototype.drawmap = function (mapElementId) {
                    this.map = new OpenLayers.Map(mapElementId, {
                        projection: new OpenLayers.Projection("EPSG:900913"),
                        displayProjection: new OpenLayers.Projection("EPSG:4326"),
                        eventListeners: {},
                        controls: [
                            new OpenLayers.Control.Navigation(),
                            new OpenLayers.Control.ScaleLine({ topOutUnits: "nmi", bottomOutUnits: "km", topInUnits: 'nmi', bottomInUnits: 'km', maxWidth: '40' }),
                            new OpenLayers.Control.LayerSwitcher(),
                            new OpenLayers.Control.MousePosition(),
                            new OpenLayers.Control.PanZoomBar()
                        ],
                        maxExtent: new OpenLayers.Bounds(-20037508.34, -20037508.34, 20037508.34, 20037508.34),
                        numZoomLevels: 18,
                        maxResolution: 156543,
                        units: 'meters'
                    });
                    // Add Layers to map-------------------------------------------------------------------------------------------------------
                    // Mapnik
                    this.layer_mapnik = new OpenLayers.Layer.OSM("Mapnik", // Official OSM tileset as protocol-independent URLs
                    [
                        'https://a.tile.openstreetmap.org/${z}/${x}/${y}.png',
                        'https://b.tile.openstreetmap.org/${z}/${x}/${y}.png',
                        'https://c.tile.openstreetmap.org/${z}/${x}/${y}.png'
                    ]);
                    this.layer_transport = new OpenLayers.Layer.OSM("Transport", [
                        'http://a.tile2.opencyclemap.org/transport/${z}/${x}/${y}.png',
                        'http://b.tile2.opencyclemap.org/transport/${z}/${x}/${y}.png',
                        'http://c.tile2.opencyclemap.org/transport/${z}/${x}/${y}.png'
                    ]);
                    this.layer_cycle = new OpenLayers.Layer.OSM("Cycle", [
                        'http://a.tile2.opencyclemap.org/cycle/${z}/${x}/${y}.png',
                        'http://b.tile2.opencyclemap.org/cycle/${z}/${x}/${y}.png',
                        'http://c.tile2.opencyclemap.org/cycle/${z}/${x}/${y}.png'
                    ]);
                    //Weather layers
                    //Wind 
                    this.layer_weather_wind1 = new OpenLayers.Layer.TMS("Wind", "http://www.openportguide.org/tiles/actual/wind_vector/5/", { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
                    //Preasure
                    this.layer_weather_pressure1 = new OpenLayers.Layer.TMS("Pressure", "http://www.openportguide.org/tiles/actual/surface_pressure/5/", { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
                    this.layer_weather_air_temperature1 = new OpenLayers.Layer.TMS("Air temperature", "http://www.openportguide.org/tiles/actual/air_temperature/5/", { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
                    this.layer_weather_precipitation1 = new OpenLayers.Layer.TMS("Precipitation", "http://www.openportguide.org/tiles/actual/precipitation/5/", { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
                    this.layer_weather_significant_wave_height1 = new OpenLayers.Layer.TMS("Wave Height", "http://www.openportguide.org/tiles/actual/significant_wave_height/5/", { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
                    this.hybrid = new OpenLayers.Layer.Bing({
                        key: 'Aq04lcZvs3og9ebdM3eJwDj_y0fBIyi9Z4C10hjJfQ7aLX-Nhn6Qde60EhOSN0XS',
                        type: "AerialWithLabels",
                        name: "Bing Aerial With Labels"
                    });
                    // Seamark
                    this.layer_seamark = new OpenLayers.Layer.TMS("Seamark", "http://t1.openseamap.org/seamark/", { numZoomLevels: 18, type: 'png', getURL: this.getTileURL, isBaseLayer: false, displayOutsideMaxExtent: true });
                    this.markerLayer = new OpenLayers.Layer.Markers("Markers");
                    this.vectorLayer = new OpenLayers.Layer.Vector("Trails");
                    this.map.addLayers([this.layer_mapnik, this.layer_transport, this.layer_cycle, this.hybrid, this.layer_seamark, this.layer_weather_wind1, this.layer_weather_pressure1, this.layer_weather_air_temperature1, this.layer_weather_precipitation1, this.layer_weather_significant_wave_height1, this.vectorLayer, this.markerLayer]);
                    this.map.addControl(new OpenLayers.Control.LayerSwitcher());
                    this.jumpTo(this.lon, this.lat, this.zoom);
                    if (this.useSignalR == true) {
                        this.initSignalR();
                    }
                };
                OpenlayerMap.prototype.initSignalR = function () {
                    var _this = this;
                    $.ajax({
                        type: "GET",
                        url: 'https://ajax.aspnetcdn.com/ajax/signalr/jquery.signalr-2.2.0.min.js',
                        dataType: "script",
                        cache: true
                    }).done(function () {
                        $.ajax({
                            type: "GET",
                            url: _this.baseUrl + '/signalr/hubs',
                            dataType: "script",
                            cache: true
                        }).done(function () {
                            $.connection.hub.url = _this.baseUrl + '/signalr';
                            var locationHub = $.connection.locationHub;
                            locationHub.client.updateLocation = function (data) {
                                $.each(data, function (i, ship) {
                                    console.log('signalr data ' + ship.Id, ship);
                                    var locations = ship.Locations.map(function (data, i) {
                                        return _this.NewLatLong(data.Latitude, data.Longitude);
                                    });
                                    var points = ship.Locations.map(function (data, i) {
                                        return _this.NewGeoPoint(data.Latitude, data.Longitude);
                                    });
                                    var marker = null;
                                    if (typeof (_this.ships[ship.Id]) == 'undefined') {
                                        marker = _this.addMarker(_this.markerLayer, locations[locations.length - 1], ship.Id);
                                        _this.ships[ship.Id] = marker;
                                    }
                                    else {
                                        marker = _this.ships[ship.Id];
                                        _this.rotateMarker(marker, ship.Locations[locations.length - 1].Heading);
                                    }
                                    var lastLoc = locations[locations.length - 1];
                                    marker.moveTo(_this.map.getLayerPxFromLonLat(lastLoc));
                                    _this.plotTrail(ship.Id, points);
                                });
                            };
                            $.connection.hub.start().done(function () {
                                console.log('started');
                            });
                        });
                    });
                };
                return OpenlayerMap;
            }());
            visual.OpenlayerMap = OpenlayerMap;
            var Visual = (function () {
                function Visual(options) {
                    var _this = this;
                    this.baseUri = Visual.defaultBaseUri;
                    this.useLiveData = false;
                    this.zoomOnClickLevel = 0;
                    this.maxValue = 1;
                    this.redrawCanvas = function () {
                        //this.updateCanvasSize();
                        var data = Visual.converter(_this.dataView);
                        if (_this.openlayerMap != null) {
                            _this.openlayerMap.plotdata(data);
                            var newBaseUri = _this.getBaseUri();
                            var redrawNeeded = false;
                            if (newBaseUri != _this.baseUri) {
                                _this.baseUri = newBaseUri;
                                redrawNeeded = true;
                            }
                            var newUseLiveData = _this.getUseLiveData();
                            if (newUseLiveData != _this.useLiveData) {
                                _this.useLiveData = newUseLiveData;
                                redrawNeeded = true;
                            }
                            var newZoomOnClick = _this.getZoomOnClick();
                            if (newZoomOnClick != _this.zoomOnClickLevel) {
                                _this.zoomOnClickLevel = newZoomOnClick;
                                redrawNeeded = true;
                            }
                            if (redrawNeeded) {
                                console.log('redraw needed');
                                _this.openlayerMap.destroy();
                                _this.openlayerMap = new OpenlayerMap(_this.mapId, _this.baseUri, _this.useLiveData, _this.zoomOnClickLevel);
                            }
                        }
                    };
                    this.initialize = function (container) {
                        console.log('initialize');
                        _this.mapId = "openlayermap" + Math.random().toString(36).substr(2, 9);
                        _this.map = $('<div style="position: absolute;" class="marinemap-openlayer" id="' + _this.mapId + '"></div>');
                        _this.map.width(_this.currentViewport.width);
                        _this.map.height(_this.currentViewport.height);
                        $(container).append(_this.map);
                        $.ajax({
                            type: "GET",
                            url: "https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/OpenLayers.js",
                            dataType: "script",
                            cache: true
                        }).done(function () {
                            console.log('openlayers loaded');
                            $.ajax({
                                type: "GET",
                                url: "https://www.openstreetmap.org/openlayers/OpenStreetMap.js",
                                dataType: "script",
                                cache: true
                            }).done(function () {
                                var omap = new OpenlayerMap(_this.mapId, _this.baseUri, _this.useLiveData, _this.zoomOnClickLevel);
                                _this.openlayerMap = omap;
                                console.log('load complete', _this.mapId);
                                _this.redrawCanvas();
                            });
                        });
                    };
                    this.init(options);
                }
                // Convert a DataView into a view model
                Visual.converter = function (dataView) {
                    if (typeof (dataView) == 'undefined' || dataView == null)
                        return;
                    console.log('converter', dataView);
                    var table = dataView.table;
                    // debug.assertValue(table, 'table');
                    // debug.assertValue(table.rows, 'table.rows');
                    var model = {
                        columns: [],
                        data: [],
                    };
                    var catagoryIndex = -1;
                    if (dataView && dataView.metadata) {
                        var linkAdded = false;
                        for (var i = 0; i < dataView.metadata.columns.length; i++) {
                            var column = dataView.metadata.columns[i];
                            if (!column.roles) {
                                continue;
                            }
                            var columnInfo = {
                                colIndex: i,
                                format: column.format,
                                displayName: column.displayName,
                                queryName: column.queryName,
                                type: MarineMapColumnType.data
                            };
                            if (column.roles["Category"] === true) {
                                catagoryIndex = i;
                                columnInfo.type = MarineMapColumnType.category;
                            }
                            if (column.roles["Time"] === true) {
                                columnInfo.type = MarineMapColumnType.time;
                            }
                            if (column.roles["Longitude"] === true) {
                                columnInfo.type = MarineMapColumnType.longitude;
                            }
                            if (column.roles["Latitude"] === true) {
                                columnInfo.type = MarineMapColumnType.latitude;
                            }
                            if (column.roles["Heading"] === true) {
                                columnInfo.type = MarineMapColumnType.heading;
                            }
                            if (column.roles["Link"] === true) {
                                columnInfo.type = MarineMapColumnType.link;
                            }
                            if (column.roles["Status"] === true) {
                                columnInfo.type = MarineMapColumnType.status;
                            }
                            model.columns.push(columnInfo);
                        }
                    }
                    if (catagoryIndex == -1)
                        return null;
                    for (var i = 0; i < table.rows.length; i++) {
                        var row = {
                            values: table.rows[i]
                        };
                        var category = table.rows[i][catagoryIndex];
                        var categoryModel = null;
                        for (var j = 0; j < model.data.length; j++) {
                            if (model.data[j].id == category) {
                                categoryModel = model.data[j];
                                break;
                            }
                        }
                        if (categoryModel == null) {
                            console.log(category);
                            categoryModel = { rows: [], id: category.toString(), link: Visual.getLink(dataView, category) };
                            model.data.push(categoryModel);
                        }
                        categoryModel.rows.push(row);
                    }
                    console.log(model);
                    return model;
                };
                /* One time setup*/
                Visual.prototype.init = function (options) {
                    this.element = options.element;
                    //this.legend = powerbi.visuals.createLegend(options.element, options.interactivity && options.interactivity.isInteractiveLegend, null);
                    this.hostServices = options.host;
                    this.initialize(this.element);
                };
                /* Called for data, size, formatting changes*/
                Visual.prototype.update = function (options) {
                    if (this.currentViewport == null) {
                        this.currentViewport = options.viewport;
                    }
                    this.dataView = options.dataViews[0];
                    var viewport = options.viewport;
                    if (this.openlayerMap != null) {
                        console.log('update');
                        //Handle resizing of the visual.                    
                        this.onResizing(viewport);
                        this.redrawCanvas();
                    }
                };
                Visual.prototype.getBaseUri = function () {
                    return Visual.getFieldText(this.dataView, 'settings', 'baseUri', this.baseUri);
                };
                Visual.prototype.getUseLiveData = function () {
                    return Visual.getFieldBoolean(this.dataView, 'settings', 'useLiveData', this.useLiveData);
                };
                Visual.prototype.getZoomOnClick = function () {
                    return Visual.getFieldNumber(this.dataView, 'settings', 'zoomOnClick', 0);
                };
                /*About to remove your visual, do clean up here */
                Visual.prototype.destroy = function () {
                    this.openlayerMap.destroy();
                    this.map.remove();
                };
                /* Called when the view port resizes (apparently not called anymore, see update method) */
                Visual.prototype.onResizing = function (viewport) {
                    console.log(viewport.height + " " + viewport.width);
                    if (this.currentViewport.width !== viewport.width || this.currentViewport.height !== viewport.height) {
                        this.currentViewport = viewport;
                        console.log('resize');
                        var map = $('#' + this.mapId);
                        map.height(this.currentViewport.height);
                        map.width(this.currentViewport.width);
                        this.openlayerMap.resize();
                    }
                };
                //Make visual properties available in the property pane in Power BI
                Visual.prototype.enumerateObjectInstances = function (options) {
                    var instances = [];
                    var dataView = this.dataView;
                    switch (options.objectName) {
                        case 'settings':
                            var settings = {
                                objectName: 'settings',
                                displayName: 'Settings',
                                selector: null,
                                properties: {
                                    baseUri: Visual.getFieldText(dataView, 'settings', 'baseUri', Visual.defaultBaseUri),
                                    useLiveData: Visual.getFieldBoolean(dataView, 'settings', 'useLiveData', false),
                                    links: Visual.getFieldText(dataView, 'settings', 'links', ''),
                                    zoomOnClick: Visual.getFieldNumber(dataView, 'settings', 'zoomOnClick', 0),
                                }
                            };
                            instances.push(settings);
                            break;
                    }
                    return instances;
                };
                Visual.prototype.canResizeTo = function (viewport) {
                    return true;
                };
                Visual.prototype.getViewPort = function () {
                    var currentViewport = this.currentViewport;
                    // var legendMargins = this.legend.getMargins();
                    var mapViewport = {
                        width: currentViewport.width,
                        height: currentViewport.height //- legendMargins.height,
                    };
                    return mapViewport;
                };
                Visual.getFieldText = function (dataView, field, property, defaultValue) {
                    if (property === void 0) { property = 'text'; }
                    if (defaultValue === void 0) { defaultValue = ''; }
                    if (dataView) {
                        var objects = dataView.metadata.objects;
                        if (objects) {
                            var f = objects[field];
                            if (f) {
                                var text = f[property];
                                if (text)
                                    return text;
                            }
                        }
                    }
                    return defaultValue;
                };
                Visual.getFieldNumber = function (dataView, field, property, defaultValue) {
                    if (property === void 0) { property = 'text'; }
                    if (defaultValue === void 0) { defaultValue = 100; }
                    if (dataView) {
                        var objects = dataView.metadata.objects;
                        if (objects) {
                            var f = objects[field];
                            if (f) {
                                var num = f[property];
                                if (num)
                                    return num;
                            }
                        }
                    }
                    return defaultValue;
                };
                Visual.getFieldBoolean = function (dataView, field, property, defaultValue) {
                    if (property === void 0) { property = 'text'; }
                    if (defaultValue === void 0) { defaultValue = false; }
                    if (dataView) {
                        var objects = dataView.metadata.objects;
                        if (objects) {
                            var f = objects[field];
                            if (f) {
                                var bool = f[property];
                                if (bool)
                                    return bool;
                            }
                        }
                    }
                    return defaultValue;
                };
                return Visual;
            }());
            Visual.defaultBaseUri = 'https://jlvesselmon.azurewebsites.net/';
            Visual.getLink = function (dataView, id) {
                var links = Visual.getFieldText(dataView, 'settings', 'links');
                var ret = null;
                if (links != null) {
                    var linksArr = links.split(';');
                    $.each(linksArr, function (i, keyValue) {
                        var pair = keyValue.split(',');
                        if (pair.length == 2 && pair[0] == id) {
                            ret = pair[1];
                            return;
                        }
                    });
                }
                return ret;
            };
            visual.Visual = Visual;
        })(visual = extensibility.visual || (extensibility.visual = {}));
    })(extensibility = powerbi.extensibility || (powerbi.extensibility = {}));
})(powerbi || (powerbi = {}));
//# sourceMappingURL=visual.js.map