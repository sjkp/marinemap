module powerbi.extensibility.visual
{

interface ShipMarker extends L.Marker  {
    columns : MarineMapColumnInfo[];
    shipdata: MarineMapCategoryData;
}

export class LeafletMap implements IMap  {
        private map : L.Map;
        private ships = {};
        private redIcon: L.Icon;
        private greenIcon: L.Icon;
        private yellowIcon: L.Icon;
        private grayIcon: L.Icon;

        constructor (elementId : string, private baseUrl: string, private zoomOnClickLevel : number, private colorTrails, private tailLength)
        {
            this.redIcon = L.icon(
                {iconUrl:this.baseUrl + '/resources/redpointer.png',   
                iconSize:     [21, 25], // size of the icon,
            });
            this.greenIcon = L.icon({iconUrl:this.baseUrl + '/resources/greenpointer.png',
        iconSize:     [21, 25], // size of the icon
    });
            this.yellowIcon = L.icon({iconUrl:this.baseUrl + '/resources/yellowpointer.png',
        iconSize:     [21, 25], // size of the icon
    });
            this.grayIcon = L.icon({iconUrl:this.baseUrl + '/resources/graypointer.png',
        iconSize:     [21, 25], // size of the icon
    });
             var openstreetmap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                 attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                 subdomains: ['a', 'b', 'c']
             });

             var transport = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png', {
                 attribution: 'open street view',
                 subdomains: ['a','b','c']
             });


             var cycle = L.tileLayer('http://{s}.tile2.opencyclemap.org/cycle/{z}/{x}/{y}.png', {
                 attribution: 'open street view',
                 subdomains: ['a','b','c'],
                 
             });

            //  var weatherLayer = L.TileLayer.extend({getTileUrl: function(coords){
            //      debugger;
            //     var res = this._map._size;
            //     var x = Math.round((coords.left - this.maxExtent.left) / (res.x * this._tileSize.x));
            //     var y = Math.round((this.maxExtent.top - coords.top) / (res.y * this._tileSize.y));
            //     var z = this._map._zoom;
            //     var limit = Math.pow(2, z);
            //     if (y < 0 || y >= limit) {
            //         return null;
            //     } else {
            //         x = ((x % limit) + limit) % limit;
            //         var url = this.url;
            //         var path = z + "/" + x + "/" + y + "." + this.type;
            //         if (url instanceof Array) {
            //             url = this.selectUrl(path, url);
            //         }
            //         return url + path;
            //     }
            //  }});

            //  var wind = new weatherLayer('http://www.openportguide.org/tiles/actual/wind_vector/5/');
try {
             this.map = L.map(elementId, {
                 worldCopyJump: true,
                 layers: [transport]
             }).setView([0, -0.09], 2);

   
              
            var baseLayers = {
                'OpenStreetMap': openstreetmap,
                'Transport': transport,
                'Cycle': cycle               
            };

            var overlays = {
                //  'Wind': wind
            };

            L.control.layers(baseLayers,overlays).addTo(this.map);


                // //Weather layers
                // //Wind 
                // this.layer_weather_wind1 = new OpenLayers.Layer.TMS("Wind", "http://www.openportguide.org/tiles/actual/wind_vector/5/",
                //     { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
    
                // //Preasure
                // this.layer_weather_pressure1 = new OpenLayers.Layer.TMS("Pressure", "http://www.openportguide.org/tiles/actual/surface_pressure/5/",
                //     { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
    
    
                // this.layer_weather_air_temperature1 = new OpenLayers.Layer.TMS("Air temperature", "http://www.openportguide.org/tiles/actual/air_temperature/5/",
                //     { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
    
                // this.layer_weather_precipitation1 = new OpenLayers.Layer.TMS("Precipitation", "http://www.openportguide.org/tiles/actual/precipitation/5/",
                //     { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
    
                // this.layer_weather_significant_wave_height1 = new OpenLayers.Layer.TMS("Wave Height", "http://www.openportguide.org/tiles/actual/significant_wave_height/5/",
                //     { type: 'png', getURL: this.getTileURL, isBaseLayer: false, visibility: false, displayOutsideMaxExtent: true });
    
    
                // this.hybrid = new OpenLayers.Layer.Bing({
                //     key: 'Aq04lcZvs3og9ebdM3eJwDj_y0fBIyi9Z4C10hjJfQ7aLX-Nhn6Qde60EhOSN0XS',
                //     type: "AerialWithLabels",
                //     name: "Bing Aerial With Labels"
                // });
                // // Seamark
                // this.layer_seamark = new OpenLayers.Layer.TMS("Seamark", "http://t1.openseamap.org/seamark/", { numZoomLevels: 18, type: 'png', getURL: this.getTileURL, isBaseLayer: false, displayOutsideMaxExtent: true });
               
                // this.markerLayer = new OpenLayers.Layer.Markers("Markers",{
                //         displayOutsideMaxExtent: true,
                //         wrapDateLine: false,
                //         renderers: ['Canvas', 'VML']
                //     });
                // this.vectorLayer = new OpenLayers.Layer.Vector("Trails",{
                //         displayOutsideMaxExtent: true,
                //         wrapDateLine: false,
                //         renderers: ['Canvas', 'VML']
                //     });
} catch(e)
{
    console.error(e);
}

        }

        public destroy() {

        }

        public resize() {

        } 

        public setVisibleLayer(name: string)
        {

        }

        

        public plotdata(model: MarineMapDataModel) {
            debugger;
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

            var layerGroup = [];
            //Insert new ships and update ship position
            $.each(model.data, (i, ship: MarineMapCategoryData) => {
                try {
                var dataFiltered = ship.rows.filter((row) => {
                    if (row.values[latIndex] != 0.0 && row.values[longIndex] != 0.0 && row.values[latIndex] !== null &&  row.values[longIndex] !== null) {
                        return true;
                    }
                    return false;
                }).slice(-this.tailLength);
                var locations = dataFiltered.map((data, i) => {
                    return new L.LatLng(data.values[latIndex], data.values[longIndex]);
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

                var marker : ShipMarker = null;
                if (typeof (this.ships[ship.id]) == 'undefined') {
                    
                    marker = (<ShipMarker>L.marker(locations[locations.length - 1]));
                    marker.addTo(this.map);
                    this.ships[ship.id] = marker;
                    
                    layerGroup.push(marker);
                }
                else {
                    marker = this.ships[ship.id];
                    marker.setLatLng(locations[locations.length - 1]);
                }
                marker.shipdata = ship;
                marker.columns = model.columns;

                // var html = new PopupBuilder(ship.id, marker.columns, marker.shipdata).buildHtml();
                // marker.bindPopup(html);
                 this.setMarkerUrl(marker);
                 this.rotateMarker(marker, ship.rows[ship.rows.length - 1].values[headingIndex]);
                
                this.plotTrail(ship.id, pointSegments);
/*
                if (model.data.length == 1) {
                    this.map.setCenter(marker.lonlat, this.zoomOnClickLevel);
                }
                else {
                    this.jumpTo(this.lon, this.lat, this.zoom);
                }
                */
            } catch(e)
            {
                console.log(ship);
                console.error(e);
            }
            });



            this.removeUnselectedShips(model);
        }

        private removeUnselectedShips(model: MarineMapDataModel) {
            //remove ships no longer in input data
            debugger;
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
                        this.map.removeLayer(marker);
                        this.ships[shipId].polylines.forEach(feature => {
                         //   this.vectorLayer.destroyFeatures(feature);
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
               //     this.vectorLayer.destroyFeatures(feature);
                    this.map.removeLayer(feature);
                });
            }
            else {
                this.ships[shipId].polylines = [];
            }
            pointSegments.forEach(points => {
                var polyline = new L.Polyline(points, 
                    this.getLineStyle(points[0].status)
                )
                // var feature = new OpenLayers.Feature.Vector(
                // //    new OpenLayers.Geometry.LineString(points), null, this.getLineStyle(points[0].status)
                // );
                this.ships[shipId].polylines.push(polyline);
           //     this.vectorLayer.addFeatures(feature);
                polyline.addTo(this.map);
            })


        }

        private lineStyle = {
                strokeColor: '#808080',
                strokeOpacity: 0.5,
                strokeWidth: 5
            };

        private getLineStyle(color: MarineMapStatus) : L.PolylineOptions
            {                
                var l : L.PolylineOptions = {
                    color: this.lineStyle.strokeColor,
                    opacity: this.lineStyle.strokeOpacity,
                    weight: this.lineStyle.strokeWidth
                };
                switch(color)
                {
                    case MarineMapStatus.Green:
                        l.color = '#0000ff';
                        break;
                    case MarineMapStatus.Yellow:
                        l.color = '#ffff00';
                        break;
                    case MarineMapStatus.Red:
                        l.color = '#ff0000';
                        break; 
                }
                return l;
            }

        

        private setMarkerUrl(marker: ShipMarker) {
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
                    marker.setIcon(this.redIcon);
                    return;
                }
                if (status === MarineMapStatus.Yellow) {
                    marker.setIcon(this.yellowIcon);
                    return;
                }
                if (status === MarineMapStatus.Green) {
                    marker.setIcon(this.greenIcon);
                    return;
                }
                console.log(data.id + " " + status);
            }
            marker.setIcon(this.grayIcon);
        }

        private rotateMarker(marker: any, rotation: number) {
             marker.setRotationOrigin('10px bottom');
             marker.setRotationAngle(rotation);           
        }

        private NewGeoPointWithStatus(lat, lon, status) {
            var p = L.latLng(lat, lon);
            (<any>p).status = status;
            return p;
        }

    }
}

