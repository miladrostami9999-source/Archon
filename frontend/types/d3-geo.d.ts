// d3-geo ships no bundled types and @types/d3-geo isn't installed. We only use
// geoCentroid and geoArea, so declare just those rather than pulling in a
// types package.
declare module 'd3-geo' {
  /** Spherical centroid of a GeoJSON feature, as [longitude, latitude]. */
  export function geoCentroid(feature: unknown): [number, number]
  /** Spherical area of a GeoJSON feature, in steradians (0 to 4π). */
  export function geoArea(feature: unknown): number
}
