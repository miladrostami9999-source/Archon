// d3-geo ships no bundled types and @types/d3-geo isn't installed. We only use
// geoCentroid and geoBounds, so declare just those rather than pulling in a
// types package.
declare module 'd3-geo' {
  /** Spherical centroid of a GeoJSON feature, as [longitude, latitude]. */
  export function geoCentroid(feature: unknown): [number, number]
  /** Spherical bounding box of a GeoJSON feature: [[west, south], [east, north]]. */
  export function geoBounds(feature: unknown): [[number, number], [number, number]]
}
