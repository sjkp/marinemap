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

        constructor(elementId: string, private baseUrl: string, private zoomOnClickLevel: number, private colorTrails, private tailLength) {
            var raster = new ol.layer.Tile({
                source: new ol.source.OSM()
            });

            this.markerLayer = new ol.source.Vector();
            var markers = new ol.layer.Vector({
                source: this.markerLayer
            });

            markers.setZIndex(999);

            this.map = new ol.Map({
                layers: [raster, markers],
                target: elementId,
                view: new ol.View({
                    center: ol.proj.fromLonLat([0, 0]),
                    zoom: 1
                })
            });


            this.tooltip = document.getElementById('tooltip');
            this.overlay = new ol.Overlay({
                element: this.tooltip,
                offset: [10, 0],
                positioning: 'bottom-left'
            });
            this.map.addOverlay(this.overlay);

            

            this.map.on('click', this.displayTooltip);
        }

       
 
        public destroy() {

        }

        public resize() {
            setTimeout(() => { this.map.updateSize();}, 200);     
        }

        private displayTooltip = (evt) => {            
                var pixel = evt.pixel;
                var feature = this.map.forEachFeatureAtPixel(pixel, function(feature) {
                    return feature;
                });
                this.tooltip.style.display = feature ? '' : 'none';
                console.log(  this.tooltip.style.display)
                if (feature) {
                    this.overlay.setPosition(evt.coordinate);
                    
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
                    console.log("processing "+ ship.id);
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
                                points.push(this.NewGeoPointWithStatus(temp_endpoint.lat, temp_endpoint.long, status, new MarineMapSinglePointData(ship.id, data,status, ship.link)));
                                pointSegments.push(points);
                                points = [];
                                points.push(this.NewGeoPointWithStatus(temp_startpoint.lat, temp_startpoint.long, status, new MarineMapSinglePointData(ship.id, data, status, ship.link)));
                            }
                        }

                    });
                    pointSegments.push(points);

                    var marker = null;
                    if (typeof (this.shipMarkers[ship.id]) == 'undefined') {
                        marker = this.addMarker(locations[locations.length - 1], ship.id, ship.rows[ship.rows.length - 1].values[headingIndex]);
                        this.shipMarkers[ship.id] = marker;
                    }
                    else {
                        marker = this.shipMarkers[ship.id];
                        //marker.moveTo(this.map.getLayerPxFromLonLat(locations[locations.length - 1]));
                    }

                    var status = <number>ship.rows[ship.rows.length - 1].values[statusIndex];
                    marker.shipdata = new MarineMapSinglePointData(ship.id, ship.rows[ship.rows.length - 1], (statusIndex > -1 ? status : MarineMapStatus.Default), ship.link);

                    this.setMarkerUrl(marker, ship.rows[ship.rows.length - 1].values[headingIndex]);

                    this.plotTrail(ship.id, pointSegments);

                    if (model.data.length == 1) {
                        //    this.map.setCenter(marker.lonlat, this.zoomOnClickLevel);
                    }
                    else {
                        //    this.jumpTo(this.lon, this.lat, this.zoom);
                    }
                });



                this.removeUnselectedShips(model);
            }
            catch (e) {
                console.error(e);
            }
        }

        private setMarkerUrl(marker: any, rotation) {
            
            var iconUrl = this.baseUrl + '/resources/graypointer.png';
            var status  = (<MarineMapSinglePointData>marker.shipdata).status;

            if (status === MarineMapStatus.Red) {
                iconUrl = this.baseUrl + '/resources/redpointer.png';
            }
            if (status === MarineMapStatus.Yellow) {
                iconUrl = this.baseUrl + '/resources/yellowpointer.png';
            }
            if (status === MarineMapStatus.Green) {
                iconUrl = this.baseUrl + '/resources/greenpointer.png';
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
            console.log('found', f);
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
                    color: '#808080',
                    width: 5,

                })
            });
            switch (color) {
                case MarineMapStatus.Green:
                    l.getStroke().setColor('#00ff00');
                    break;
                case MarineMapStatus.Yellow:
                    l.getStroke().setColor('#ffff00');
                    break;
                case MarineMapStatus.Red:
                    l.getStroke().setColor('#ff0000');
                    break;
            }
            return l;
        }
    }

    }

}