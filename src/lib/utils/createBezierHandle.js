import * as Constants from '@mapbox/mapbox-gl-draw/src/constants';

export default function createBezierHandle(parentId, coordinates, path, selected) {
  return {
    type: Constants.geojsonTypes.FEATURE,
    properties: {
      meta: Constants.meta.VERTEX,
      meta2:"handle",
      parent: parentId,
      coord_path: path,
      bezierHandle: true,
      active: (selected) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE
    },
    geometry: {
      type: Constants.geojsonTypes.POINT,
      coordinates
    }
  };
}