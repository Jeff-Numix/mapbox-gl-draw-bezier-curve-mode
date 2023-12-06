import MapboxDraw from '@mapbox/mapbox-gl-draw';
const Constants = MapboxDraw.constants;

export default function createBezierControlPoint (parentId, coordinates, path, selected) {
  return {
    type: Constants.geojsonTypes.FEATURE,
    properties: {
      meta: Constants.meta.VERTEX,
      parent: parentId,
      coord_path: path,
      bezierPoint: true,
      active: (selected) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE
    },
    geometry: {
      type: Constants.geojsonTypes.POINT,
      coordinates
    }
  };
}
