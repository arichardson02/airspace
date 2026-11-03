"use client";

import { useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import { Map, type LonLat } from "@fs-career/ui/map";
import { rise } from "@fs-career/ui/motion";
import { Page } from "@fs-career/ui/shell";

// The whole globe, turned to the Atlantic. Pilots will come from the live feed once the backend serves one.
const CENTER: LonLat = [-40, 30];
const START = { center: CENTER, zoom: 1.6 };

// The map fills the page under the headline, as tall as the window allows.
export function LiveMap(): ReactElement {
  const [view, setView] = useState(START);

  return (
    <Page title="Live Map" sub="Nobody is flying right now. Pilots show up here the moment they take off.">
      <motion.div
        {...rise(0.16)}
        className="surface mt-7 h-[calc(100dvh-15rem)] min-h-[420px] overflow-hidden rounded-[18px]"
      >
        <Map
          center={view.center}
          zoom={view.zoom}
          onViewChange={(center, zoom) => {
            setView({ center, zoom });
          }}
          pilots={[]}
        />
      </motion.div>
    </Page>
  );
}
