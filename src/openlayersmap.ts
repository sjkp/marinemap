module powerbi.extensibility.visual {

    interface JQueryStatic {
        signalR: SignalR;
        connection: SignalR;

    }

    interface SignalR {
        locationHub: any;
        hub: any;
    }

    declare var OpenLayers: any;

    export class OpenlayerMap implements IMap {
        constructor(elementId: string, private baseUrl: string, private useSignalR: boolean, private zoomOnClickLevel: number, private colorTrails, private tailLength) {
            this.drawmap(elementId);
        }

        private map;
        private layer_mapnik;
        private layer_seamark;
        private layer_transport;
        private layer_cycle;
        private hybrid;
        private markerLayer;
        private vectorLayer;
        private layer_weather_wind1;
        private layer_weather_pressure1;
        private layer_weather_air_temperature1;
        private layer_weather_precipitation1;
        private layer_weather_significant_wave_height1;

        // Position and zoomlevel of the map
        private lon = 0;
        private lat = 0;
        private zoom = 2;

        private language = 'en';

        private ships = {};

        private lineStyle = {
            strokeColor: '#808080',
            strokeOpacity: 0.5,
            strokeWidth: 5
        };

        private getLineStyle(color: MarineMapStatus) {
            var l = {
                strokeColor: this.lineStyle.strokeColor,
                strokeOpacity: this.lineStyle.strokeOpacity,
                strokeWidth: this.lineStyle.strokeWidth
            };
            switch (color) {
                case MarineMapStatus.Green:
                    l.strokeColor = '#0000ff';
                    break;
                case MarineMapStatus.Yellow:
                    l.strokeColor = '#ffff00';
                    break;
                case MarineMapStatus.Red:
                    l.strokeColor = '#ff0000';
                    break;
            }
            return l;
        }


        private jumpTo(lon, lat, zoom) {
            //var x = Lon2Merc(lon);
            //var y = Lat2Merc(lat);
            this.map.setCenter(this.NewLatLong(lat, lon), zoom);
            return false;
        }

        private NewGeoPoint(lat, lon) {
            return new OpenLayers.Geometry.Point(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());
        }

        private NewGeoPointWithStatus(lat, lon, status) {
            var p = this.NewGeoPoint(lat, lon);
            p.status = status;
            return p;
        }

        private NewLatLong(lat, lon) {
            return new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());
        }

        private addMarker(layer, ll, popupContentHTML) {
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
                var html = new PopupBuilder(marker.columns, marker.shipdata).buildHtml();

                if (feature.popup == null) {
                    feature.data.popupContentHTML = html;
                    feature.popup = feature.createPopup(feature.closeBox);
                    feature.popup.setSize(new OpenLayers.Size(300, 200));
                    self.map.addPopup(feature.popup);
                    feature.popup.show();
                } else {
                    feature.popup.setContentHTML(html);
                    feature.popup.show();
                }
                //We need to reattch this event as the setContentHTML destroys the click event.
                $('#' + feature.id + 'close').click(function () {
                    feature.popup.hide();
                });
                $.each(self.ships, (i, shipMarker) => {
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
        }

        private setMarkerUrl(marker: any) {
            var statusColumn: MarineMapColumnInfo = null;
            $.each(marker.columns, (i, column: MarineMapColumnInfo) => {
                if (column.type == MarineMapColumnType.status) {
                    statusColumn = column;
                    return;
                }
            });
            if (statusColumn != null) {
                var data: MarineMapCategoryData = marker.shipdata;
                var status: number = data.rows[data.rows.length - 1].values[statusColumn.colIndex];

                if (status === MarineMapStatus.Red) {
                    marker.setUrl(this.baseUrl + '/resources/redpointer.png');
                    return;
                }
                if (status === MarineMapStatus.Yellow) {
                    marker.setUrl(this.baseUrl + '/resources/yellowpointer.png');
                    return;
                }
                if (status === MarineMapStatus.Green) {
                    marker.setUrl(this.baseUrl + '/resources/greenpointer.png');
                    return;
                }
                console.log(data.id + " " + status);
            }
            marker.setUrl(this.baseUrl + '/resources/graypointer.png');
        }

        private getTileURL = function (bounds) {
            var res = this.map.getResolution();
            var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
            var y = Math.round((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
            var z = this.map.getZoom();
            var limit = Math.pow(2, z);
            if (y < 0 || y >= limit) {
                return null;
            } else {
                x = ((x % limit) + limit) % limit;
                var url = this.url;
                var path = z + "/" + x + "/" + y + "." + this.type;
                if (url instanceof Array) {
                    url = this.selectUrl(path, url);
                }
                return url + path;
            }
        }

        public resize() {
            setTimeout(() => { this.map.updateSize(); }, 200);
        }

        public destroy() {
            this.map.destroy();
        }

        public plotdata(model: MarineMapDataModel) {
            if (model == null)
                return;
            var latIndex = -1;
            var longIndex = -1;
            var headingIndex = -1;
            var statusIndex = -1;

            $.each(model.columns, (i, column) => {
                if (column.type == MarineMapColumnType.latitude) {
                    latIndex = column.colIndex;
                }
                if (column.type == MarineMapColumnType.longitude) {
                    longIndex = column.colIndex;
                }
                if (column.type == MarineMapColumnType.heading) {
                    headingIndex = column.colIndex;
                }
                if (column.type == MarineMapColumnType.status) {
                    statusIndex = column.colIndex;
                }
            });

            if (longIndex == -1 || latIndex == -1) {
                return;
            }
            //Insert new ships and update ship position
            $.each(model.data, (i, ship: MarineMapCategoryData) => {
                var dataFiltered = ship.rows.filter((row) => {
                    if (row.values[latIndex] != 0.0 && row.values[longIndex] != 0.0) {
                        return true;
                    }
                    return false;
                }).slice(-this.tailLength);
                var locations = dataFiltered.map((data, i) => {
                    return this.NewLatLong(data.values[latIndex], data.values[longIndex]);
                });


                var points = [];
                var pointSegments = []; //Array of array of points. Each array are going to be drawn as a lineString with open layers. 
                //Handle date line crossing and convert to NewGeoPoint
                dataFiltered.forEach((data, index) => {
                    var status = -1;

                    if (this.colorTrails && statusIndex > -1) {
                        status = data.values[statusIndex];
                        if (index > 0) {
                            var prevStatus = dataFiltered[index - 1].values[statusIndex];
                            if (status != prevStatus) {
                                //Status color has changed, close the use of the old color by adding a extra point.
                                points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], prevStatus));
                                pointSegments.push(points);
                                points = [];
                            }
                        }
                    }

                    points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], status));
                    var startPoint = { lat: dataFiltered[index].values[latIndex], long: dataFiltered[index].values[longIndex] };
                    if (index + 1 < dataFiltered.length) {
                        var endPoint = { lat: dataFiltered[index + 1].values[latIndex], long: dataFiltered[index + 1].values[longIndex] };
                        if (Math.abs(startPoint.long - endPoint.long) > 180) {
                            console.log('date line crossing');
                            var midLat = (startPoint.lat + endPoint.lat) / 2


                            var temp_endpoint = { long: startPoint.long, lat: midLat };
                            var temp_startpoint = { long: startPoint.long, lat: midLat };

                            if (startPoint.long < endPoint.long) {
                                temp_endpoint.long = -179.99;
                                temp_startpoint.long = 179.99;
                            } else {
                                temp_endpoint.long = 179.99;
                                temp_startpoint.long = -179.99;
                            }
                            points.push(this.NewGeoPointWithStatus(temp_endpoint.lat, temp_endpoint.long, status));
                            pointSegments.push(points);
                            points = [];
                            points.push(this.NewGeoPointWithStatus(temp_startpoint.lat, temp_startpoint.long, status));
                        }
                    }

                });
                pointSegments.push(points);

                var marker = null;
                if (typeof (this.ships[ship.id]) == 'undefined') {
                    marker = this.addMarker(this.markerLayer, locations[locations.length - 1], ship.id);
                    this.ships[ship.id] = marker;
                }
                else {
                    marker = this.ships[ship.id];
                    marker.moveTo(this.map.getLayerPxFromLonLat(locations[locations.length - 1]));
                }
                marker.shipdata = ship;
                marker.columns = model.columns;

                this.setMarkerUrl(marker);
                this.rotateMarker(marker, ship.rows[ship.rows.length - 1].values[headingIndex]);
                this.plotTrail(ship.id, pointSegments);

                if (model.data.length == 1) {
                    this.map.setCenter(marker.lonlat, this.zoomOnClickLevel);
                }
                else {
                    this.jumpTo(this.lon, this.lat, this.zoom);
                }
            });



            this.removeUnselectedShips(model);
        }

        private removeUnselectedShips(model: MarineMapDataModel) {
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
                        this.ships[shipId].polylines.forEach(feature => {
                            this.vectorLayer.destroyFeatures(feature);
                        });
                        delete this.ships[shipId];
                    }
                }
            }
        }

        //Plot trail after ship
        private plotTrail(shipId: string, pointSegments: any[]) {


            if (typeof (this.ships[shipId].polylines) != 'undefined') {
                this.ships[shipId].polylines.forEach(feature => {
                    this.vectorLayer.destroyFeatures(feature);
                });
            }
            else {
                this.ships[shipId].polylines = [];
            }
            pointSegments.forEach(points => {
                var feature = new OpenLayers.Feature.Vector(
                    new OpenLayers.Geometry.LineString(points), null, this.getLineStyle(points[0].status)
                );
                this.ships[shipId].polylines.push(feature);
                this.vectorLayer.addFeatures(feature);
            })


        }

        private rotateMarker(marker: any, rotation: number) {
            $(marker.icon.imageDiv).css('transform-origin', '10px bottom');
            $(marker.icon.imageDiv).css('transform', 'rotate(' + rotation + 'deg)');
        }

        private drawmap(mapElementId: string) {
            this.map = new OpenLayers.Map(mapElementId, {
                projection: new OpenLayers.Projection("EPSG:900913"),
                displayProjection: new OpenLayers.Projection("EPSG:4326"),
                eventListeners: {
                    //"moveend": mapEventMove,
                    //"zoomend": mapEventZoom
                },
                controls: [
                    new OpenLayers.Control.Navigation(),
                    new OpenLayers.Control.ScaleLine({ topOutUnits: "nmi", bottomOutUnits: "km", topInUnits: 'nmi', bottomInUnits: 'km', maxWidth: '40' }),
                    new OpenLayers.Control.LayerSwitcher(),
                    new OpenLayers.Control.MousePosition(),
                    new OpenLayers.Control.PanZoomBar()],
                //maxExtent: new OpenLayers.Bounds(-20037508.34, -20037508.34, 20037508.34, 20037508.34),
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
                ], {
                    displayOutsideMaxExtent: true,
                    wrapDateLine: true,
                });
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
            this.layer_weather_wind1 = new OpenLayers.Layer.TMS("Wind", "http://www.openportguide.org/tiles/actual/wind_vector/5/",
                { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });

            //Preasure
            this.layer_weather_pressure1 = new OpenLayers.Layer.TMS("Pressure", "http://www.openportguide.org/tiles/actual/surface_pressure/5/",
                { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });


            this.layer_weather_air_temperature1 = new OpenLayers.Layer.TMS("Air temperature", "http://www.openportguide.org/tiles/actual/air_temperature/5/",
                { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });

            this.layer_weather_precipitation1 = new OpenLayers.Layer.TMS("Precipitation", "http://www.openportguide.org/tiles/actual/precipitation/5/",
                { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });

            this.layer_weather_significant_wave_height1 = new OpenLayers.Layer.TMS("Wave Height", "http://www.openportguide.org/tiles/actual/significant_wave_height/5/",
                { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });


            this.hybrid = new OpenLayers.Layer.Bing({
                key: 'Aq04lcZvs3og9ebdM3eJwDj_y0fBIyi9Z4C10hjJfQ7aLX-Nhn6Qde60EhOSN0XS',
                type: "AerialWithLabels",
                name: "Bing Aerial With Labels"
            });
            // Seamark
            this.layer_seamark = new OpenLayers.Layer.TMS("Seamark", "http://t1.openseamap.org/seamark/", { numZoomLevels: 18, type: 'png', getURL: this.getTileURL, isBaseLayer: false, displayOutsideMaxExtent: true });

            this.markerLayer = new OpenLayers.Layer.Markers("Markers", {
                displayOutsideMaxExtent: true,
                wrapDateLine: false,
                renderers: ['Canvas', 'VML']
            });
            this.vectorLayer = new OpenLayers.Layer.Vector("Trails", {
                displayOutsideMaxExtent: true,
                wrapDateLine: false,
                renderers: ['Canvas', 'VML']
            });

            this.map.addLayers([this.layer_mapnik, this.layer_transport, this.layer_cycle, this.hybrid, this.layer_seamark, this.layer_weather_wind1, this.layer_weather_pressure1, this.layer_weather_air_temperature1, this.layer_weather_precipitation1, this.layer_weather_significant_wave_height1, this.vectorLayer, this.markerLayer]);
            this.map.addControl(new OpenLayers.Control.LayerSwitcher());
            this.jumpTo(this.lon, this.lat, this.zoom);

            if (this.useSignalR == true) {
                this.initSignalR();
            }
        }

        private initSignalR() {
            $.ajax({
                type: "GET",
                url: 'https://ajax.aspnetcdn.com/ajax/signalr/jquery.signalr-2.2.0.min.js',
                dataType: "script",
                cache: true
            }).done(() => {
                $.ajax({
                    type: "GET",
                    url: this.baseUrl + '/signalr/hubs',
                    dataType: "script",
                    cache: true
                }).done(() => {
                    $.connection.hub.url = this.baseUrl + '/signalr';
                    var locationHub = $.connection.locationHub;

                    locationHub.client.updateLocation = (data) => {
                        $.each(data, (i, ship) => {
                            console.log('signalr data ' + ship.Id, ship);
                            var locations = ship.Locations.map((data, i) => {
                                return this.NewLatLong(data.Latitude, data.Longitude);
                            });
                            var points = ship.Locations.map((data, i) => {
                                return this.NewGeoPoint(data.Latitude, data.Longitude);
                            });

                            var marker = null;
                            if (typeof (this.ships[ship.Id]) == 'undefined') {
                                marker = this.addMarker(this.markerLayer, locations[locations.length - 1], ship.Id);
                                this.ships[ship.Id] = marker;
                            }
                            else {
                                marker = this.ships[ship.Id];
                                this.rotateMarker(marker, ship.Locations[locations.length - 1].Heading);
                            }

                            var lastLoc = locations[locations.length - 1];
                            marker.moveTo(this.map.getLayerPxFromLonLat(lastLoc));


                            this.plotTrail(ship.Id, points);

                        });
                    };

                    $.connection.hub.start().done(function () {
                        console.log('started');
                    });
                });
            });
        }
    }
}