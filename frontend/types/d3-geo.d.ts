// d3-geo ships no bundled types and @types/d3-geo isn't installed. We only use
// geoCentroid, so declare just that rather than pulling in a types package.
declare module 'd3-geo' {
  /** Spherical centroid of a GeoJSON feature, as [longitude, latitude]. */
  export function geoCentroid(feature: unknown): [number, number]
}
