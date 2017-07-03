
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

interface JQueryStatic {
    signalR: SignalR;
    connection: SignalR;

}

interface SignalR {
    locationHub: any;
    hub: any;
}

declare var OpenLayers: any;


module powerbi.extensibility.visual {
    

    export interface MarineMapCategoryData {
        id: string;
        rows: MarineMapDataRow[];
        link: string;
    }

    export interface MarineMapDataRow {
        values: any[];
    }

    export enum MarineMapColumnType {
        data,
        latitude,
        longitude,
        heading,
        link,
        time,
        category,
        status
    }

    export interface MarineMapColumnInfo {
        displayName: string;
        queryName: string;
        format: string;
        colIndex: number;
        type: MarineMapColumnType;
    }

    export interface MarineMapDataModel {
        columns: MarineMapColumnInfo[];
        data: MarineMapCategoryData[];
    };

    export enum MarineMapStatus {
        Default,
        Red,
        Yellow,
        Green
    }

    export class PopupBuilder {
        constructor(private columnInfos: MarineMapColumnInfo[], private data: MarineMapSinglePointData) {
        }

        public buildHtml(): string {
            var html = this.buildHeader(this.data.id);
            var lastDataPoint = this.data.data;
            console.log(lastDataPoint);
            html += '<ul>';
            var footerHtml = "";
            var link = this.data.link;
            $.each(this.columnInfos, (i, column) => {
                if (column.type == MarineMapColumnType.data) {
                    html += this.buildRow(column.displayName, lastDataPoint.values[column.colIndex]);
                }
                if (column.type == MarineMapColumnType.time) {
                    var date = new Date(lastDataPoint.values[column.colIndex]);
                    // var dateFormat = valueFormatter.create({format: "dd/MM/yyyy HH:mm:ss", value: date});
                    // footerHtml += dateFormat.format(date);
                    footerHtml += " " + this.formatDate(date);
                }
                if (column.type == MarineMapColumnType.status) {
                    footerHtml += '<span class="popup-footer-status">status: ' + lastDataPoint.values[column.colIndex] + '</span>';
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
        }

        private formatDate(date : Date) : string
        {
             return date.getDate() + "/" + (date.getMonth()+1) + "/" + date.getFullYear() +  " "+  this.prependZero(date.getHours()) + ":" + this.prependZero(date.getMinutes())
        }

        private prependZero(n : number)
        {
            if (n.toString().length === 1)
            {
                return "0"+n;
            }
            return n.toString();
        }

        private buildHeader(title: string) {
            return '<div class="popup-title">' + title +'</div>';
        }

        private buildRow(label: string, value: any) {
            return '<li><span>' + label + '</span><span>' + value + '</span ></li>';
        }

        private buildFooter(value: string) {
            return '<div class="popup-footer">' + value + '</div>'
        }

        private buildMoreInfo(link: string) {
            return '<div class="popup-moreinfo"><a href="' + link + '" target="_blank">More info</a></div>';
        }
    }

    export interface IMap
    {
        destroy() : void;
        resize(): void;
        plotdata(data : MarineMapDataModel );
    }

    




   export class OpenlayerMap implements IMap  {
            constructor(elementId: string, private baseUrl: string, private useSignalR: boolean, private zoomOnClickLevel : number, private colorTrails, private tailLength) {
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
            
            private getLineStyle(color: MarineMapStatus)
            {                
                var l = {
                    strokeColor: this.lineStyle.strokeColor,
                    strokeOpacity: this.lineStyle.strokeOpacity,
                    strokeWidth: this.lineStyle.strokeWidth
                };
                switch(color)
                {
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
            
            private NewGeoPointWithStatus(lat, lon, status)
            {
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
                    if (self.zoomOnClickLevel > 0)
                    {
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
                    $('#' + feature.id + 'close').click(function() {
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
            
            private setMarkerUrl(marker: any)
            {
                var statusColumn  : MarineMapColumnInfo = null;
                $.each(marker.columns, (i, column: MarineMapColumnInfo) => {
                    if (column.type == MarineMapColumnType.status)
                    {
                        statusColumn = column;
                        return;
                    }
                });
                if (statusColumn != null)
                {                
                    var data : MarineMapCategoryData = marker.shipdata;
                    var status : number = data.rows[data.rows.length-1].values[statusColumn.colIndex];
                        
                    if (status === MarineMapStatus.Red)
                    {
                        marker.setUrl(this.baseUrl + '/resources/redpointer.png');
                        return;
                    }
                    if (status === MarineMapStatus.Yellow)
                    {
                        marker.setUrl(this.baseUrl + '/resources/yellowpointer.png');
                        return;
                    }
                    if (status === MarineMapStatus.Green) 
                    {                        
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
                setTimeout(() => { this.map.updateSize();}, 200);                
            }
            
            public destroy(){
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
                    if (column.type == MarineMapColumnType.status)
                    {
                        statusIndex = column.colIndex;
                    }
                });
    
                if (longIndex == -1 || latIndex == -1) {
                    return;
                }
                //Insert new ships and update ship position
                $.each(model.data, (i, ship: MarineMapCategoryData) => {
                    var dataFiltered = ship.rows.filter((row) => {
                        if (row.values[latIndex] != 0.0 && row.values[longIndex] != 0.0)
                        {
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

                        if (this.colorTrails && statusIndex > -1)
                        {
                            status = data.values[statusIndex];
                            if (index > 0) {
                                var prevStatus = dataFiltered[index-1].values[statusIndex];
                                if (status != prevStatus)
                                {
                                    //Status color has changed, close the use of the old color by adding a extra point.
                                    points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], prevStatus));
                                    pointSegments.push(points);
                                    points = [];
                                }
                            }
                        } 
                        
                        points.push(this.NewGeoPointWithStatus(data.values[latIndex], data.values[longIndex], status));
                        var startPoint = {lat: dataFiltered[index].values[latIndex], long:  dataFiltered[index].values[longIndex]};
                        if (index +1 < dataFiltered.length)
                        {
                            var endPoint = {lat: dataFiltered[index+1].values[latIndex], long:  dataFiltered[index+1].values[longIndex]};
                            if (Math.abs(startPoint.long- endPoint.long)>180)
                            {
                                console.log('date line crossing');
                                    var midLat = (startPoint.lat + endPoint.lat) / 2


                                    var temp_endpoint = {long: startPoint.long,lat: midLat};
                                    var temp_startpoint ={long: startPoint.long,lat: midLat};

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
                    
                    if (model.data.length == 1)
                    {
                        this.map.setCenter(marker.lonlat, this.zoomOnClickLevel);
                    }
                    else
                    {
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
            private plotTrail(shipId: string, pointSegments: any[]){
                    
                
                    if (typeof (this.ships[shipId].polylines) != 'undefined') {
                        this.ships[shipId].polylines.forEach(feature => {
                            this.vectorLayer.destroyFeatures(feature);
                        });
                    }
                    else
                    {
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
            
            private rotateMarker(marker: any, rotation: number)
            {
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
                this.layer_cycle = new OpenLayers.Layer.OSM("Cycle",[
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
               
                this.markerLayer = new OpenLayers.Layer.Markers("Markers",{
                        displayOutsideMaxExtent: true,
                        wrapDateLine: false,
                        renderers: ['Canvas', 'VML']
                    });
                this.vectorLayer = new OpenLayers.Layer.Vector("Trails",{
                        displayOutsideMaxExtent: true,
                        wrapDateLine: false,
                        renderers: ['Canvas', 'VML']
                    });
    
                this.map.addLayers([this.layer_mapnik, this.layer_transport, this.layer_cycle, this.hybrid, this.layer_seamark, this.layer_weather_wind1, this.layer_weather_pressure1, this.layer_weather_air_temperature1, this.layer_weather_precipitation1, this.layer_weather_significant_wave_height1, this.vectorLayer, this.markerLayer]);
                this.map.addControl(new OpenLayers.Control.LayerSwitcher());
                this.jumpTo(this.lon, this.lat, this.zoom);
    
                if (this.useSignalR == true)
                {
                    this.initSignalR();
                }
            }
            
            private initSignalR()
            {
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

    export class Visual implements IVisual {



        public currentViewport: IViewport;
        // private legend: ILegend;
        private element: HTMLElement;
        private map: JQuery;
        private mapId: string;
        private openlayerMap: IMap;
        private static defaultBaseUri = 'https://jlvesselmon.azurewebsites.net/';
        private baseUri: string = Visual.defaultBaseUri;
        private useLiveData: boolean = false;
        private zoomOnClickLevel: number = 0;
        private colorTrails: boolean = true;
        private tailLength: number = 10;
        // private colors: IDataColorPalette;
        private dataView: DataView;
        private maxValue = 1;
        private hostServices: IVisualHost;

        constructor(options: VisualConstructorOptions) {
            this.init(options);

        }

        // Convert a DataView into a view model
        public static converter(dataView: DataView): MarineMapDataModel {
            if (typeof (dataView) == 'undefined' || dataView == null)
                return;
            console.log('converter', dataView);
            var table = dataView.table;
            console.log("rows: ", table.rows.length);
            // debug.assertValue(table, 'table');
            // debug.assertValue(table.rows, 'table.rows');

            var model: MarineMapDataModel = {
                columns: [],
                data: [],
            };
            var catagoryIndex = -1;
            if (dataView && dataView.metadata) {
                var linkAdded = false;
                for (var i: number = 0; i < dataView.metadata.columns.length; i++) {
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

            for (var i: number = 0; i < table.rows.length; i++) {
                var row: MarineMapDataRow = {
                    values: table.rows[i]
                };
                var category = table.rows[i][catagoryIndex];
                if (category == null)
                {
                    console.log("category was null at index ", catagoryIndex);
                    continue;
                }
                var categoryModel: MarineMapCategoryData = null;
                for (var j: number = 0; j < model.data.length; j++) {
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

        }

        /* One time setup*/
        public init(options: VisualConstructorOptions): void {
            this.element = options.element;
            //this.legend = powerbi.visuals.createLegend(options.element, options.interactivity && options.interactivity.isInteractiveLegend, null);
            this.hostServices = options.host;

            this.currentViewport = {width: 300, height: 300};

            this.initialize(this.element);
        }



        /* Called for data, size, formatting changes*/
        public update(options: VisualUpdateOptions) {
            if (this.currentViewport == null) {
                this.currentViewport = options.viewport;
            }
            this.dataView = options.dataViews[0];
            var viewport = options.viewport;
            if (this.openlayerMap != null) //Don't try to draw map until load is complete.
            {
                console.log('update');
                //Handle resizing of the visual.                    
                

                this.redrawCanvas();
            }
            this.onResizing(viewport);
        }

        public redrawCanvas = () => {
            //this.updateCanvasSize();
            console.log("colorTails", this.colorTrails);
            var data = Visual.converter(this.dataView);
            if (this.openlayerMap != null) {
                this.openlayerMap.plotdata(data);
                var newBaseUri = this.getBaseUri();
                var redrawNeeded = false;
                if (newBaseUri != this.baseUri) {
                    this.baseUri = newBaseUri;
                    redrawNeeded = true;
                }
                var newUseLiveData = this.getUseLiveData();
                if (newUseLiveData != this.useLiveData) {
                    this.useLiveData = newUseLiveData;
                    redrawNeeded = true;
                }
                var newColorTrails = this.getColorTrails();
                console.log('new color tails', newColorTrails);
                if (newColorTrails != this.colorTrails) {
                    this.colorTrails = newColorTrails;
                    redrawNeeded = true;
                }
                var newZoomOnClick = this.getZoomOnClick();
                if (newZoomOnClick != this.zoomOnClickLevel) {
                    this.zoomOnClickLevel = newZoomOnClick;
                    redrawNeeded = true;
                }
                var newTailLength = this.getTailLength();
                if (newTailLength != this.tailLength && typeof newTailLength === 'number' && newTailLength > 0 )
                {
                    this.tailLength = newTailLength;
                    redrawNeeded = true;
                }
                if (redrawNeeded) {
                    console.log('redraw needed');
                    this.openlayerMap.destroy();
                    this.openlayerMap = new OpenlayerMap(this.mapId, this.baseUri, this.useLiveData, this.zoomOnClickLevel, this.colorTrails, this.tailLength);
                    this.onResizing(this.currentViewport);
                    this.openlayerMap.plotdata(data);
                }
            }

        }

        private getBaseUri(): string {
            return Visual.getFieldText(this.dataView, 'settings', 'baseUri', this.baseUri);
        }

        private getUseLiveData(): boolean {
            return Visual.getFieldBoolean(this.dataView, 'settings', 'useLiveData',false);
        }

        private getColorTrails(): boolean {
            return Visual.getFieldBoolean(this.dataView, 'settings', 'colorTrails', true);
        }

        private getTailLength(): number {
            return Visual.getFieldNumber(this.dataView, 'settings', 'tailLength', 10);
        }

        private getZoomOnClick(): number {
            return Visual.getFieldNumber(this.dataView, 'settings', 'zoomOnClick', 0);
        }

        /*About to remove your visual, do clean up here */
        public destroy() {
            this.openlayerMap.destroy();
            this.map.remove();
        }

        /* Called when the view port resizes (apparently not called anymore, see update method) */
        public onResizing(viewport: IViewport): void {
            console.log(viewport.height + " " + viewport.width);
            if (this.currentViewport.width !== viewport.width || this.currentViewport.height !== viewport.height) {
                this.currentViewport = viewport;
                console.log('resize');
                var map = $('#' + this.mapId);
                map.height( this.currentViewport.height);
                map.width(this.currentViewport.width);
                this.openlayerMap.resize();
            }
        }

        //Make visual properties available in the property pane in Power BI
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            var instances: VisualObjectInstance[] = [];
            var dataView = this.dataView;
            switch (options.objectName) {
                case 'settings':
                    var settings: VisualObjectInstance = {
                        objectName: 'settings',
                        displayName: 'Settings',
                        selector: null,
                        properties: {
                            baseUri: Visual.getFieldText(dataView, 'settings', 'baseUri', Visual.defaultBaseUri),
                            useLiveData: Visual.getFieldBoolean(dataView, 'settings', 'useLiveData', false),
                            links: Visual.getFieldText(dataView, 'settings', 'links', ''),
                            colorTrails: Visual.getFieldBoolean(dataView, 'settings', 'colorTrails', false),
                            zoomOnClick: Visual.getFieldNumber(dataView, 'settings', 'zoomOnClick', 0),
                            tailLength: Visual.getFieldNumber(dataView, 'settings', 'tailLength', 10),
                            // radius: HeatMapChart.getFieldNumber(dataView, 'general', 'radius',5),
                            // blur: HeatMapChart.getFieldNumber(dataView, 'general', 'blur',15),
                            // maxWidth: HeatMapChart.getFieldNumber(dataView, 'general', 'maxWidth', this.canvasWidth),
                            // maxHeight: HeatMapChart.getFieldNumber(dataView, 'general', 'maxHeight', this.canvasHeight),
                            // maxValue: HeatMapChart.getFieldNumber(dataView, 'general', 'maxValue', 1)
                        }
                    };
                    instances.push(settings);
                    break;
            }

            return instances;
        }

        public canResizeTo(viewport: IViewport): boolean {
            return true;
        }

        private getViewPort(): IViewport {
            var currentViewport = this.currentViewport;
            // var legendMargins = this.legend.getMargins();

            var mapViewport = {
                width: currentViewport.width, //- legendMargins.width,
                height: currentViewport.height //- legendMargins.height,
            };

            return mapViewport;
        }

        private initialize = (container: HTMLElement): void => {            
            console.log('initialize');
            this.mapId = "openlayermap" + Math.random().toString(36).substr(2, 9);
            this.map = $('<div style="position: absolute;" class="marinemap-openlayer" id="' + this.mapId + '"></div>');

            this.map.width(this.currentViewport.width);
            this.map.height(this.currentViewport.height);

            $(container).append(this.map);
            $(container).append($('<div id="tooltip" class="tooltip"></div>'));
            // $.ajax({
            //     type: "GET",
            //     url: "https://cdnjs.cloudflare.com/ajax/libs/openlayers/2.13.1/OpenLayers.js",
            //     dataType: "script",
            //     cache: true
            // }).done(() => {
            //     console.log('openlayers loaded');
            //     $.ajax({
            //         type: "GET",
            //         url: "https://www.openstreetmap.org/openlayers/OpenStreetMap.js",
            //         dataType: "script",
            //         cache: true
            //     }).done(() => {

            //         var omap = new OpenlayerMap(this.mapId, this.baseUri, this.useLiveData, this.zoomOnClickLevel, this.colorTrails, this.tailLength);
            //         this.openlayerMap = omap;
            //         console.log('load complete', this.mapId);
            //         this.redrawCanvas();                   
            //     });
            // });

           //this.openlayerMap = new LeafletMap(this.mapId);
          
            // $.ajax({
            //     type: "GET",
            //     url: "https://unpkg.com/leaflet@1.0.3/dist/leaflet.js",
            //     dataType: "script",
            //     cache: true
            // }).done(() => {
            //     initRotateMarkerPlugin();
            //     this.openlayerMap = new LeafletMap(this.mapId, this.baseUri, this.zoomOnClickLevel, this.colorTrails, this.tailLength);
            // });

             $.ajax({
                type: "GET",
                url: "https://openlayers.org/en/v4.2.0/build/ol.js",
                dataType: "script",
                cache: true
            }).done(() => {
                this.openlayerMap = new OpenLayer3Map.OpenLayers3Map(this.mapId, this.baseUri, this.zoomOnClickLevel, this.colorTrails, this.tailLength);
            });
        }

        private static getLink = (dataView: DataView, id: PrimitiveValue): string => {
            var links = Visual.getFieldText(dataView, 'settings', 'links');
            var ret = null;
            if (links != null) {
                var linksArr = links.split(';');
                $.each(linksArr, (i, keyValue) => {
                    var pair = keyValue.split(',');
                    if (pair.length == 2 && pair[0] == id) {
                        ret = pair[1];
                        return;
                    }
                });
            }

            return ret;
        }


        private static getFieldText(dataView: DataView, field: string, property: string = 'text', defaultValue: string = ''): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var f = objects[field];
                    if (f) {
                        var text = <string>f[property];
                        if (text)
                            return text;
                    }
                }
            }
            return defaultValue;
        }

        private static getFieldNumber(dataView: DataView, field: string, property: string = 'text', defaultValue: number = 100): number {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var f = objects[field];
                    if (f !== undefined) {
                        return <number>f[property];                        
                    }
                }
            }
            return defaultValue;
        }

        private static getFieldBoolean(dataView: DataView, field: string, property: string = 'text', defaultValue: boolean = false): boolean {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var f = objects[field];
                    if (f !== undefined) {
                        
                            return <boolean>f[property];
                        
                    }
                }
            }
            return defaultValue;
        }
    }
}