/** Longitude then latitude, in degrees. */
export type LonLat = [number, number];

export interface Pilot {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** When the fix was taken, epoch ms. Stamped on arrival when omitted. Older or repeated fixes are ignored. */
  t?: number;
  /** Compass degrees, 0 is north. */
  heading: number;
  /** Knots. With it the map carries the aircraft forward between fixes; without, it uses the speed the last two fixes imply. */
  groundspeed?: number;
  /** Shown under the name for club pilots, as the sim reports it ("FL240", "8,500"). */
  altitude?: string;
  /** Flies with the viewer's club: drawn bright and named. */
  club?: boolean;
}

/** A pilot's planned flight. The part behind the pilot is drawn solid, the part ahead dotted. */
export interface Route {
  pilotId: string;
  from: LonLat;
  to: LonLat;
}

export interface Airport {
  code: string;
  name: string;
  lon: number;
  lat: number;
}
