/**
 * Web Mercator arithmetic for the Prospector map: where a coordinate sits on
 * screen, which tiles to draw, and what area is visible. Pure functions.
 *
 * A "view" is { latitude, longitude, zoom, width, height }: the point at the
 * centre of the panel, the zoom level, and the panel size in CSS pixels.
 */

export const TILE_SIZE = 256;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 18;
const MAX_LAT = 85.05112878;

export interface MapView { latitude: number; longitude: number; zoom: number; width: number; height: number }
export interface LatLng { latitude: number; longitude: number }

const clampLat = (v: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, v));
export const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z)));
const world = (z: number) => TILE_SIZE * 2 ** z;

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * world(z);
const latToY = (lat: number, z: number) => {
  const r = (clampLat(lat) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * world(z);
};
const xToLon = (x: number, z: number) => (x / world(z)) * 360 - 180;
const yToLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world(z)))) * 180) / Math.PI;

export function project(p: LatLng, v: MapView) {
  return {
    x: lonToX(p.longitude, v.zoom) - lonToX(v.longitude, v.zoom) + v.width / 2,
    y: latToY(p.latitude, v.zoom) - latToY(v.latitude, v.zoom) + v.height / 2,
  };
}

export function bounds(v: MapView) {
  const cx = lonToX(v.longitude, v.zoom);
  const cy = latToY(v.latitude, v.zoom);
  return {
    north: yToLat(Math.max(0, cy - v.height / 2), v.zoom),
    south: yToLat(Math.min(world(v.zoom), cy + v.height / 2), v.zoom),
    west: Math.max(-180, xToLon(cx - v.width / 2, v.zoom)),
    east: Math.min(180, xToLon(cx + v.width / 2, v.zoom)),
  };
}

/** Move the view by a drag of (dx, dy) pixels. */
export function pan(v: MapView, dx: number, dy: number): MapView {
  const x = lonToX(v.longitude, v.zoom) - dx;
  const y = Math.max(0, Math.min(world(v.zoom), latToY(v.latitude, v.zoom) - dy));
  let longitude = xToLon(x, v.zoom);
  longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return { ...v, latitude: yToLat(y, v.zoom), longitude };
}

/** Zoom in or out keeping the point under (px, py) where it is. */
export function zoomAt(v: MapView, delta: number, px = v.width / 2, py = v.height / 2): MapView {
  const zoom = clampZoom(v.zoom + delta);
  if (zoom === v.zoom) return v;
  const anchorLon = xToLon(lonToX(v.longitude, v.zoom) + px - v.width / 2, v.zoom);
  const anchorLat = yToLat(latToY(v.latitude, v.zoom) + py - v.height / 2, v.zoom);
  const cx = lonToX(anchorLon, zoom) - (px - v.width / 2);
  const cy = latToY(anchorLat, zoom) - (py - v.height / 2);
  return { ...v, zoom, longitude: xToLon(cx, zoom), latitude: yToLat(cy, zoom) };
}

/** A view that shows all the points, with some padding. */
export function fit(points: LatLng[], v: MapView, padding = 48): MapView {
  if (!points.length) return v;
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const north = Math.max(...lats), south = Math.min(...lats), east = Math.max(...lons), west = Math.min(...lons);
  const latitude = (north + south) / 2;
  const longitude = (east + west) / 2;
  let zoom = MAX_ZOOM - 3;
  for (; zoom > MIN_ZOOM; zoom -= 1) {
    const w = lonToX(east, zoom) - lonToX(west, zoom);
    const h = latToY(south, zoom) - latToY(north, zoom);
    if (w <= v.width - padding * 2 && h <= v.height - padding * 2) break;
  }
  return { ...v, latitude, longitude, zoom };
}

export function tiles(v: MapView, template: string) {
  const scale = 2 ** v.zoom;
  const left = lonToX(v.longitude, v.zoom) - v.width / 2;
  const top = latToY(v.latitude, v.zoom) - v.height / 2;
  const out: { key: string; src: string; left: number; top: number }[] = [];
  for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + v.height) / TILE_SIZE); y += 1) {
    if (y < 0 || y >= scale) continue;
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + v.width) / TILE_SIZE); x += 1) {
      const wx = ((x % scale) + scale) % scale;
      out.push({
        key: `${v.zoom}/${x}/${y}`,
        src: template.replace('{z}', String(v.zoom)).replace('{x}', String(wx)).replace('{y}', String(y)),
        left: x * TILE_SIZE - left,
        top: y * TILE_SIZE - top,
      });
    }
  }
  return out;
}
