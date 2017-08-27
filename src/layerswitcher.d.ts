declare module ol
{
    module control {
         class LayerSwitcher extends ol.control.Control {
            constructor(any);
         }
    }

   
}

declare module olx {
 module layer {
        interface GroupOptions {
            title: string;
        }

        interface TileOptions {
            type?: string;
            title?: string;
        }
    }

    module source {
        interface OSMOptions
        {
            type?: string;
        }
    }
}