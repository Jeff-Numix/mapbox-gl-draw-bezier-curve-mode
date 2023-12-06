import MapboxDraw from '@mapbox/mapbox-gl-draw';
const Constants = MapboxDraw.constants;

export default function createBezierHandleLine(parentId, coordinates) {
  return {
    type: Constants.geojsonTypes.FEATURE,
    properties: {
      meta: Constants.meta.LINE_STRING,
      meta2:"handle-line",
      parent: parentId,
    },
    geometry: {
      type: Constants.geojsonTypes.LINE_STRING,
      coordinates
    }
  };
}