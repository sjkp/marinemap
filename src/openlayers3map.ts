module powerbi.extensibility.visual {

    export class MarineMapSinglePointData {
        constructor(public id, public data : MarineMapDataRow, public status: MarineMapStatus, public link? : string)
        {

        }
    }
    
    export module OpenLayer3Map {
        // class OpenLayers3MapFeature extends ol.Feature {
        //     public markers: ol.layer.Vector;
        //     public shipdata: MarineMapSinglePointData;
        // }
    

    export class OpenLayers3Map implements IMap {        

        private map: ol.Map;
        private shipMarkers : {[id: string]: ol.Feature;} = {};
        private markerLayer: ol.source.Vector;
        private vectorLayer: ol.source.Vector;
        private tooltip: HTMLElement;
        private overlay: ol.Overlay;
        private modelColumns: MarineMapColumnInfo[];
        private baseLayers = [];
        private grayMarker; 
        private yellowMarker;
        private redMarker;
        private greenMarker;
        private view: ol.View;

        constructor(elementId: string, private zoomOnClickLevel: number, private colorTrails, private tailLength, private tailColors : TailColors) {
            var standard = new ol.layer.Tile({
                title: 'standard',
                visible: true,
                source: new ol.source.OSM(),
                type: 'base'
            });

            var transport = new ol.layer.Tile({
                title: 'transport',
                source: new ol.source.OSM({
                    url: 'https://{a-c}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=d9fb74dd97ee4a309cbf4b8da03b91af',
                }),
                visible: false,
                type: 'base'
            });

            var cycle = new ol.layer.Tile({
                title: 'cycle',
                source: new ol.source.OSM({
                    url: 'https://{a-c}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=d9fb74dd97ee4a309cbf4b8da03b91af'
                }),
                visible: false,
                type: 'base'
            });

            var base_URL = 'https://weather.openportguide.org/tiles/actual/';

            var precipitation = new ol.layer.Tile({
                title: 'precipitation shaded 6h',
                visible: false,
                opacity: 0.3,
                source: new ol.source.XYZ({
                   url: base_URL+ 'precipitation_shaded/6h/{z}/{x}/{y}.png',
                  attributions: [new ol.Attribution({
                    html: "<FONT SIZE='3'>Precipitation:</FONT><img src='precipitation_legend.png'/>"
                  })]
                })
              });

             var waveheight= new ol.layer.Tile({
                title: 'primary wave height direction 6h',
                visible: false,
                source: new ol.source.XYZ({
                   url: base_URL + 'primary_wave_height_direction/6h/{z}/{x}/{y}.png',
                  attributions: [new ol.Attribution({
                    html: "<FONT SIZE='3'>Wave height:</FONT><img src='primary_wave_height_direction_legend.png'/>"
                  })]
                })
              });

              var wind = new ol.layer.Tile({
                title: 'wind stream 6h',
                visible: false,
                source: new ol.source.XYZ({
                   url: base_URL + 'wind_stream/6h/{z}/{x}/{y}.png',
                  attributions: [new ol.Attribution({
                    html: "<FONT SIZE='3'>Wind speed:</FONT><img src='wind_legend.png'/>"
                  })]
                })
              });

              var air = new ol.layer.Tile({
                title: 'air temperature 6h',
                visible: false,
                source: new ol.source.XYZ({
                   url: base_URL + 'air_temperature/6h/{z}/{x}/{y}.png',
                  attributions: [new ol.Attribution({
                    html: "<FONT SIZE='3'>Air temperature in °C</FONT><img src='empty_legend.png'/>"
                  })]
                })
              });

            this.markerLayer = new ol.source.Vector();
            var markers = new ol.layer.Vector({
                source: this.markerLayer
            });
            this.view = new ol.View({
                    center: ol.proj.fromLonLat([0, 0]),
                    zoom: 1
                });
            markers.setZIndex(999);
            this.baseLayers = [transport,standard, cycle];
            this.map = new ol.Map({
                layers: [new ol.layer.Group({
                    title: 'Base layers',
                    layers:  this.baseLayers,
                }), markers, new ol.layer.Group({
                    title: 'Weather overlays',
                    layers: [precipitation, waveheight, wind, air]
                })                
                ],
                target: elementId,
                view: this.view
            });
            var html = $('<div id="tooltip" class="tooltip"></div>');
            $("#"+elementId).append(html);            
            this.tooltip = document.getElementById('tooltip');
            this.overlay = new ol.Overlay({
                element: this.tooltip,
                offset: [10, 0],
                positioning: 'bottom-left'
            });
            this.map.addOverlay(this.overlay);

            

            this.map.on('click', this.displayTooltip);

            var layerSwitcher = new ol.control.LayerSwitcher({
                tipLabel: 'Legend' // Optional label for button
            });
            this.map.addControl(layerSwitcher);

            this.grayMarker = this.makeMarker(this.tailColors.getGray().solid.color);
            this.greenMarker = this.makeMarker(this.tailColors.getGreen().solid.color);
            this.yellowMarker = this.makeMarker(this.tailColors.getYellow().solid.color);
            this.redMarker = this.makeMarker(this.tailColors.getRed().solid.color);
        }

       
 
        public destroy() {
            this.map.setTarget(null);
        }

        public resize() {
            setTimeout(() => { this.map.updateSize();}, 200);     
        }

        public setVisibleLayer(layerNumber: string)
        {
            this.baseLayers.forEach((layer, i) => {                
                layer.setVisible(parseInt(layerNumber) === i);
            });
        }

        private displayTooltip = (evt) => {
            var pixel = evt.pixel;
            var feature = this.map.forEachFeatureAtPixel(pixel, function (feature) {
                return feature;
            });
            this.tooltip.style.display = feature ? '' : 'none';
            // console.log(  this.tooltip.style.display)
            if (feature) {

                if (feature.getGeometry().getType() == 'Point') {
                    //We are on the feature (ship)
                    var point = <ol.geom.Point>feature.getGeometry();

                    this.view.setZoom(this.zoomOnClickLevel);
                    this.view.setCenter(point.getCoordinates())

                    this.overlay.setPosition(point.getCoordinates());
                }
                else {
                    this.overlay.setPosition(evt.coordinate); //We are on the line string. 
                }

                var popupHtml = new PopupBuilder(this.modelColumns, (<any>feature).shipdata).buildHtml();
                this.tooltip.innerHTML = popupHtml;
            }
        };

        private NewGeoPoint(lat, lon) {
            return ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        }

        private NewGeoPointWithStatus(lat, lon, status, data : MarineMapSinglePointData) {
            var p = this.NewGeoPoint(lat, lon);
            (<any>p).status = status;
            (<any>p).data = data;
            return p;
        }

        private NewLatLong(lat, lon) {
            return this.NewGeoPoint(lat, lon);
        }


        public plotdata(model: MarineMapDataModel) {         
            try {
                if (model == null)
                    return;
                var latIndex = -1;
                var longIndex = -1;
                var headingIndex = -1;
                var statusIndex = -1;
                this.modelColumns = model.columns;
                $.each(this.modelColumns, (i, column) => {
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
                    if (!ship.id) {
                        return;
                    }
                    // console.log("processing "+ ship.id);
                    var dataFiltered = ship.rows.filter((row) => {
                        if (row.values[latIndex] != 0.0 && row.values[longIndex] != 0.0 && row.values[latIndex] !== null && row.values[longIndex] !== null) {
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
                                    points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], prevStatus, new MarineMapSinglePointData(ship.id, data, prevStatus, ship.link)));
                                    pointSegments.push(points);
                                    points = [];
                                }
                            }
                        }

                        points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], status, new MarineMapSinglePointData(ship.id, data, status, ship.link)));
                        var startPoint = { lat: dataFiltered[index].values[latIndex], long: dataFiltered[index].values[longIndex] };
                        if (index + 1 < dataFiltered.length) {
                            var endPoint = { lat: dataFiltered[index + 1].values[latIndex], long: dataFiltered[index + 1].values[longIndex] };
                            if (Math.abs(startPoint.long - endPoint.long) > 180) {
                                // console.log('date line crossing');
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
                                points.push(this.NewGeoPointWithStatus(temp_endpoint.lat, temp_endpoint.long, status, new MarineMapSinglePointData(ship.id, data,status, ship.link)));
                                pointSegments.push(points);
                                points = [];
                                points.push(this.NewGeoPointWithStatus(temp_startpoint.lat, temp_startpoint.long, status, new MarineMapSinglePointData(ship.id, data, status, ship.link)));
                            }
                        }

                    });
                    pointSegments.push(points);

                    var marker : ol.Feature = null;
                    if (typeof (this.shipMarkers[ship.id]) == 'undefined') {
                        marker = this.addMarker(locations[locations.length - 1], ship.id, ship.rows[ship.rows.length - 1].values[headingIndex]);
                        this.shipMarkers[ship.id] = marker;
                    }
                    else {
                        marker = this.shipMarkers[ship.id];
                        //marker.moveTo(this.map.getLayerPxFromLonLat(locations[locations.length - 1]));
                    }

                    var status = <number>ship.rows[ship.rows.length - 1].values[statusIndex];
                    (<any>marker).shipdata = new MarineMapSinglePointData(ship.id, ship.rows[ship.rows.length - 1], (statusIndex > -1 ? status : MarineMapStatus.Default), ship.link);

                    this.setMarkerUrl(marker, ship.rows[ship.rows.length - 1].values[headingIndex]);

                    this.plotTrail(ship.id, pointSegments);

                    if (model.data.length == 1) {                        
                        this.view.setCenter((<ol.geom.Point>marker.getGeometry()).getCoordinates());
                        this.view.setZoom(this.zoomOnClickLevel);
                    }
                    else {
                        this.view.setCenter(ol.proj.fromLonLat([0, 0]));
                        this.view.setZoom(1);
                    }
                });



                this.removeUnselectedShips(model);
            }
            catch (e) {
                console.error(e);
            }
        }

        private makeMarker(color: string)
        {
            var svg =  `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="21px" height="24px" viewBox="0 0 210 240" preserveAspectRatio="xMidYMid meet">
<g id="layer1" fill="#171717" stroke="none">
 <path d="M50 181 c0 -43 8 -77 27 -121 l27 -62 27 53 c22 43 28 68 29 122 0 37 -3 67 -8 67 -4 0 -17 -6 -28 -14 -17 -12 -22 -12 -39 0 -31 23 -35 17 -35 -45z m38 27 c9 -9 18 -9 37 0 25 12 25 11 24 -36 0 -26 -9 -65 -20 -87 l-19 -40 4 48 c2 32 0 47 -7 44 -7 -2 -10 -22 -9 -48 l3 -44 -21 44 c-20 42 -28 131 -12 131 4 0 13 -5 20 -12z"/>
 </g>
<g id="layer2" fill="${color}" stroke="none">
 <path d="M60 176 c0 -24 9 -63 20 -87 l21 -44 -3 44 c-1 26 2 46 9 48 7 3 9 -12 7 -44 l-4 -48 19 40 c11 22 20 61 20 87 1 47 1 48 -24 36 -19 -9 -28 -9 -37 0 -21 21 -28 13 -28 -32z"/>
 </g>
</svg>`;
            return btoa(svg);
        }

        private setMarkerUrl(marker: any, rotation) {
            
            var iconUrl = 'data:image/svg+xml;base64,'+ this.grayMarker;
            var status  = (<MarineMapSinglePointData>marker.shipdata).status;

            if (status === MarineMapStatus.Red) {
                iconUrl = 'data:image/svg+xml;base64,'+this.redMarker;
            }
            if (status === MarineMapStatus.Yellow) {
                iconUrl = 'data:image/svg+xml;base64,'+this.yellowMarker;
            }
            if (status === MarineMapStatus.Green) {
                iconUrl = 'data:image/svg+xml;base64,'+this.greenMarker;
            }
            
            var style = new ol.style.Style({
                    image: new ol.style.Icon({
                    anchor: [0.5, 0.5],
                    size: [21, 25],
                    offset: [0, 0],
                    opacity: 1,
                    scale: 1,
                    rotation: rotation * 0.0174532925, //deg to radians
                    src: iconUrl
                    })
                });

            marker.setStyle(style);
        }

        private addMarker(point: any, shipId: string, rotation : number)  {
            

            var f = new ol.Feature({
                geometry: new ol.geom.Point(point),
                name: shipId,            
            });
            
            f.setId(shipId);
            this.markerLayer.addFeature(f);
            return f;
        }


        private removeUnselectedShips(model: MarineMapDataModel) {
            //remove ships no longer in input data
            //debugger;
            for (var shipId in this.shipMarkers) {
                if (this.shipMarkers.hasOwnProperty(shipId)) {
                    var found = false;
                    $.each(model.data, function (i, ship) {
                        if (shipId == ship.id) {
                            found = true;
                        }
                    });
                    if (found == false) {
                        var marker = this.shipMarkers[shipId];
                        var f = this.markerLayer.getFeatureById(shipId);
                        if (f != null)
                        {
                            this.markerLayer.removeFeature(f);                                       
                        }
                        
                        (<any>marker).markers.getSource().clear();
                        this.map.removeLayer((<any>marker).markers);                        
                        delete this.shipMarkers[shipId];
                    }
                }
            }
        }

        private removeFromMarkerLayer(feature)
        {
            this.removeFeatureFromLayer(this.markerLayer, feature);
        }

        private removeFeature(feature)
        {
            this.removeFeatureFromLayer(this.vectorLayer, feature);
        }

        private removeFeatureFromLayer(layer, feature)
        {
            var f = layer.getFeatureById(feature.getId());
            if (f !== null) {
                layer.removeFeature(f);
            }
        }

        //Plot trail after ship
        private plotTrail(shipId: string, pointSegments: any[]) {
            let markers = (<any>this.shipMarkers[shipId]).markers;
            if (typeof (markers) === 'undefined') { //First time run
                let vectorLayer = new ol.source.Vector();
                markers = new ol.layer.Vector({
                    source: vectorLayer
                });
                (<any>this.shipMarkers[shipId]).markers = markers;
                this.map.addLayer(markers);
            }
            let vectorLayer = markers.getSource();           

            vectorLayer.clear();
            pointSegments.forEach((points, i) => {
                var feature = new ol.Feature({
                    geometry: new ol.geom.LineString(points)
                });
                
                (<any>feature).shipdata = points[0].data;
                feature.setStyle(this.getLineStyle(points[0].status))
                vectorLayer.addFeature(feature);
            });
        }

        private getLineStyle(color: MarineMapStatus) {
            var l = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: this.tailColors.getGray().solid.color,
                    width: 5,

                })
            });
            switch (color) {
                case MarineMapStatus.Green:
                    l.getStroke().setColor(this.tailColors.getGreen().solid.color);
                    break;
                case MarineMapStatus.Yellow:
                    l.getStroke().setColor(this.tailColors.getYellow().solid.color);
                    break;
                case MarineMapStatus.Red:
                    l.getStroke().setColor(this.tailColors.getRed().solid.color);
                    break;
            }

            return l;
        }
    }

    }

}