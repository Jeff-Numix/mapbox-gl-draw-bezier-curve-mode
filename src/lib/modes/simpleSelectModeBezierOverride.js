import MapboxDraw from '@mapbox/mapbox-gl-draw';
const Constants = MapboxDraw.constants;
const createSupplementaryPoints = MapboxDraw.lib.createSupplementaryPoints;
const moveFeatures = MapboxDraw.lib.moveFeatures;

import dragBezierPoints from '../utils/dragBezierPoints';
import createSupplementaryPointsForBezier from '../utils/createSupplementaryPointsForBezier';
import copyBezierGroupToClipboard from '../utils/copyBezierGroupToClipboard';
import {isCtrlCDown} from '../utils/additional_selectors';
import BezierGroup from '../utils/BezierGroup';


const SimpleSelectModeBezierOverride = MapboxDraw.modes.simple_select;


SimpleSelectModeBezierOverride.dragMove = function(state, e) {
  // Dragging when drag move is enabled
  state.dragMoving = true;
  e.originalEvent.stopPropagation();

  const delta = {
    lng: e.lngLat.lng - state.dragMoveLocation.lng,
    lat: e.lngLat.lat - state.dragMoveLocation.lat
  };

  moveFeatures(this.getSelected(), delta);

  // Move bezier control points & handles
  dragBezierPoints(this, delta);
  
  state.dragMoveLocation = e.lngLat;
};

SimpleSelectModeBezierOverride.toDisplayFeatures = function(state, geojson, display) {
    geojson.properties.active = (this.isSelected(geojson.properties.id)) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
    display(geojson);
    this.fireActionable();
    if (geojson.properties.active !== Constants.activeStates.ACTIVE ||
      geojson.geometry.type === Constants.geojsonTypes.POINT) return;
    
    // If Bezier curve create supplementary points for bezier points instead
    const supplementaryPoints = geojson.properties.user_bezierGroup ? createSupplementaryPointsForBezier(geojson) : createSupplementaryPoints(geojson);
    if(supplementaryPoints){
      supplementaryPoints.forEach(display);
    }
};
  
SimpleSelectModeBezierOverride.onKeyDown = function(state, e) {
  if (isCtrlCDown(e)){
    copyBezierGroupToClipboard(this.getSelected());   
  }
}

SimpleSelectModeBezierOverride.onCombineFeatures = function() {
  const selectedFeatures = this.getSelected();

  if (selectedFeatures.length === 0 || selectedFeatures.length < 2) return;

  const featureType = selectedFeatures[0].type.replace('Multi', '');
  const isBezierGroup = (selectedFeatures[0].properties.bezierGroup != null);

  // Verify all features are of the same type
  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];

    // Check non corresponding features
    if (feature.type.replace('Multi', '') !== featureType) {
      return;
    }
    // Check BezierCurve compatibility
    if(isBezierGroup !== (feature.properties.bezierGroup!=null)){
      return;
    }
  }

  // Decide which onCombine we will use
  if(isBezierGroup){
    return this.onCombineFeaturesBezier();
  }
  else {
    return this.onCombineFeaturesDefault();
  }
}

SimpleSelectModeBezierOverride.onCombineFeaturesBezier = function(){
  const bezierCurves = [];
  const featuresCombined = [];
  const selectedFeatures = this.getSelected();

  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];
    const bezierGroup = feature.properties.bezierGroup;
    // Multi
    if (bezierGroup.bezierCurves.length>1) {
      bezierGroup.bezierCurves.forEach(bezierCurve => {
        bezierCurves.push(bezierCurve);
      });
    }
    // Single
    else {
      bezierCurves.push(bezierGroup.bezierCurves[0]);
    }
    featuresCombined.push(feature.toGeoJSON());
  }

  if (bezierCurves.length > 1) {

    const bezierGroup = new BezierGroup(bezierCurves);
    
    const multiFeature = this.newFeature(bezierGroup.geojson);
    multiFeature.incomingCoords(bezierGroup.vertices);
    multiFeature.properties.bezierGroup=bezierGroup;

    this.addFeature(multiFeature);
    this.deleteFeature(this.getSelectedIds(), { silent: true });
    this.setSelected([multiFeature.id]);

    this.map.fire(Constants.events.COMBINE_FEATURES, {
      createdFeatures: [multiFeature.toGeoJSON()],
      deletedFeatures: featuresCombined
    });
  }
  this.fireActionable();


}

SimpleSelectModeBezierOverride.onCombineFeaturesDefault = function() {
  const selectedFeatures = this.getSelected();
  const coordinates = [], featuresCombined = [];
  const featureType = selectedFeatures[0].type.replace('Multi', '');
  
  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];

      if (feature.type.includes('Multi')) {
        feature.getCoordinates().forEach((subcoords) => {
          coordinates.push(subcoords);
        });
      } else {
        coordinates.push(feature.getCoordinates());
      }
      featuresCombined.push(feature.toGeoJSON());
  }

  if (featuresCombined.length > 1) {
    const multiFeature = this.newFeature({
      type: Constants.geojsonTypes.FEATURE,
      properties: featuresCombined[0].properties,
      geometry: {
        type: `Multi${featureType}`,
        coordinates
      }
    });

    this.addFeature(multiFeature);
    this.deleteFeature(this.getSelectedIds(), { silent: true });
    this.setSelected([multiFeature.id]);

    this.map.fire(Constants.events.COMBINE_FEATURES, {
      createdFeatures: [multiFeature.toGeoJSON()],
      deletedFeatures: featuresCombined
    });
  }
  this.fireActionable();
};

SimpleSelectModeBezierOverride.onUncombineFeatures = function() {
  const selectedFeatures = this.getSelected();
  if (selectedFeatures.length === 0) return;

  const createdFeatures = [];
  const featuresUncombined = [];

  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];
    const bezierGroup = feature.properties.bezierGroup;
    if (this.isInstanceOf('MultiFeature', feature)) {
      // Bezier curve behaviour
      if(bezierGroup){
        bezierGroup.bezierCurves.forEach(bezierCurve => {
          
          const newBezierGroup = new BezierGroup([bezierCurve]);
          const subFeature = this.newFeature(newBezierGroup.geojson);
          this.addFeature(subFeature);
          createdFeatures.push(subFeature.toGeoJSON());
          this.select([subFeature.id]);
        });
        this.deleteFeature(feature.id, { silent: true });
      }
      // Default behaviour
      else {
        feature.getFeatures().forEach((subFeature) => {

          this.addFeature(subFeature);
          subFeature.properties = feature.properties;
          createdFeatures.push(subFeature.toGeoJSON());
          this.select([subFeature.id]);
        });
        this.deleteFeature(feature.id, { silent: true });
      }

      featuresUncombined.push(feature.toGeoJSON());
    }
  }

  if (createdFeatures.length > 1) {
    this.map.fire(Constants.events.UNCOMBINE_FEATURES, {
      createdFeatures,
      deletedFeatures: featuresUncombined
    });
  }
  this.fireActionable();
};

export default SimpleSelectModeBezierOverride;