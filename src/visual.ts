
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

module powerbi.extensibility.visual {
    
declare var initLayerSwitcher;
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
        setVisibleLayer(name: string);
    }

    

    export class TailColors {
        constructor(public green: string = '#00ff00', public yellow: string = '#ffff00', public red: string = '#ff0000', public gray: string = '#808080') {

        }

        public getGreen(): Fill {
            return {
                solid: {
                    color: this.green
                }
            };
        }

        public getRed(): Fill {
            return {
                solid: {
                    color: this.red
                }
            };
        }

        public getYellow(): Fill {
            return {
                solid: {
                    color: this.yellow
                }
            };
        }

        public getGray(): Fill {
            return {
                solid: {
                    color: this.gray
                }
            };
        }

        public equals(e : TailColors) : boolean
        {
            return this.getGray().solid.color === e.getGray().solid.color && 
                    this.getGreen().solid.color === e.getGreen().solid.color && 
                    this.getRed().solid.color === e.getRed().solid.color && 
                    this.getYellow().solid.color === e.getYellow().solid.color;
        }
    }


  

    export class Visual implements IVisual {



        public currentViewport: IViewport;
        // private legend: ILegend;
        private element: HTMLElement;
        private map: JQuery;
        private mapId: string;
        private openlayerMap: IMap;
        private useLiveData: boolean = false;
        private zoomOnClickLevel: number = 1;
        private colorTrails: boolean = true;
        private tailLength: number = 10;
        // private colors: IDataColorPalette;
        private dataView: DataView;
        private maxValue = 1;
        private hostServices: IVisualHost;

        private colors: TailColors;

        constructor(options: VisualConstructorOptions) {
            this.init(options);


           this.colors = new TailColors();
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
                var redrawNeeded = false;
               
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

                var newColor = this.getColor();
                if (!newColor.equals(this.colors) )
                {
                    this.colors = newColor;
                    redrawNeeded = true;
                    debugger;
                }

                
                
                if (redrawNeeded) {
                    console.log('redraw needed');
                    this.openlayerMap.destroy();
                    this.openlayerMap = new OpenLayer3Map.OpenLayers3Map(this.mapId, this.zoomOnClickLevel, this.colorTrails, this.tailLength, this.colors);
                    this.onResizing(this.currentViewport);
                    this.openlayerMap.plotdata(data);
                }
                console.log('map ' + this.getMap());

                this.openlayerMap.setVisibleLayer(this.getMap());
            }

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
            return Visual.getFieldNumber(this.dataView, 'settings', 'zoomOnClick', 1);
        }

        private getMap(): string {
            return Visual.getFieldText(this.dataView, 'settings', 'map', '0');
        }

        private getColor() : TailColors {
             
            return new TailColors(
                Visual.getObjectValue<Fill>(this.dataView, 'settings','greenIndicator', this.colors.getGreen()).solid.color,
                Visual.getObjectValue<Fill>(this.dataView, 'settings','yellowIndicator', this.colors.getYellow()).solid.color,
                Visual.getObjectValue<Fill>(this.dataView, 'settings','redIndicator', this.colors.getRed()).solid.color,
                Visual.getObjectValue<Fill>(this.dataView, 'settings','grayIndicator', this.colors.getGray()).solid.color
            );
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
                            useLiveData: Visual.getFieldBoolean(dataView, 'settings', 'useLiveData', false),
                            links: Visual.getFieldText(dataView, 'settings', 'links', ''),
                            colorTrails: Visual.getFieldBoolean(dataView, 'settings', 'colorTrails', false),
                            zoomOnClick: Visual.getFieldNumber(dataView, 'settings', 'zoomOnClick', 1),
                            tailLength: Visual.getFieldNumber(dataView, 'settings', 'tailLength', 10),
                            greenIndicator: Visual.getObjectValue(dataView, 'settings', 'greenIndicator', this.colors.getGreen()),
                            yellowIndicator: Visual.getObjectValue(dataView, 'settings', 'yellowIndicator', this.colors.getYellow()),
                            redIndicator: Visual.getObjectValue(dataView, 'settings', 'redIndicator', this.colors.getRed()),
                            grayIndicator: Visual.getObjectValue(dataView, 'settings', 'grayIndicator', this.colors.getGray()),
                            map: Visual.getObjectValue(dataView, 'settings', 'map', '0')                           
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
                initLayerSwitcher();
                this.openlayerMap = new OpenLayer3Map.OpenLayers3Map(this.mapId, this.zoomOnClickLevel, this.colorTrails, this.tailLength,this.colors);
                this.redrawCanvas();
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

        private static getObjectValue<T>(dataview: DataView, objectName: string, propertyName: string, defaultValue: T): T {
            
            if (dataview) {
                let  objects = dataview.metadata.objects;
                if (objects) {
                    let object = objects[objectName];
                    if (object) {
                        let property: T = <T>object[propertyName];
                        if (property !== undefined) {
                            return property;
                        }
                    }
                }
            }
            return defaultValue;
        }
    }
}