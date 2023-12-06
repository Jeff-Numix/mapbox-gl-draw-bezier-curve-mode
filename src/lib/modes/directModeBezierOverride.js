import MapboxDraw from '@mapbox/mapbox-gl-draw';
const CommonSelectors = MapboxDraw.lib.CommonSelectors;
const Constants = MapboxDraw.constants;
const constrainFeatureMovement = MapboxDraw.lib.constrainFeatureMovement;
const createSupplementaryPoints = MapboxDraw.lib.createSupplementaryPoints;
const doubleClickZoom = MapboxDraw.lib.doubleClickZoom;
const moveFeatures = MapboxDraw.lib.moveFeatures;

import dragBezierPoints from '../utils/dragBezierPoints';
import {mirrorHandle} from '../utils/bezierUtils';
import createSupplementaryPointsForBezier from '../utils/createSupplementaryPointsForBezier';
import copyBezierGroupToClipboard from '../utils/copyBezierGroupToClipboard';
import {isAltDown, isCtrlCDown} from '../utils/additional_selectors';
import BezierGroup from '../utils/BezierGroup';
import BezierNode from '../utils/BezierNode';

const DirectModeBezierOverride = MapboxDraw.modes.direct_select;
const isVertex = CommonSelectors.isOfMetaType(Constants.meta.VERTEX);
const isMidpoint = CommonSelectors.isOfMetaType(Constants.meta.MIDPOINT);
let draw=null;

DirectModeBezierOverride.onSetup = function(opts) {
  const featureId = opts.featureId;
  const feature = this.getFeature(featureId);
  draw = this;

  if (!feature) {
    throw new Error('You must provide a featureId to enter direct_select mode');
  }

  if (feature.type === Constants.geojsonTypes.POINT) {
    throw new TypeError('direct_select mode doesn\'t handle point features');
  }

  const state = {
    featureId,
    feature,
    dragMoveLocation: opts.startPos || null,
    dragMoving: false,
    canDragMove: false,
    selectedCoordPaths: opts.coordPath ? [opts.coordPath] : []
  };

  this.setSelectedCoordinates(this.pathsToCoordinates(featureId, state.selectedCoordPaths));
  this.setSelected(featureId);
  doubleClickZoom.disable(this);

  this.setActionableState({
    trash: true
  });

  return state;
};

DirectModeBezierOverride.onVertex = function (state, e) {
  this.startDragging(state, e);
  const props = e.featureTarget.properties;
  state.handleSelected = 0;
  const coordPath = props.coord_path;

  // Bezier Point or Handle Management
  if(props.bezierPoint || props.bezierHandle){
    
    const bezierGroup = getBezierGroup(state);
    const result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    const node = result.node;

    if(props.bezierPoint){
      if(isAltDown(e)){    
        if(node){      
          // If No Handles : Create new Handles (delayed in the drag event)
          if(!node.handle){
            state.createNewHandles=true;
          }
          // If Handle : Delete Handles
          else if (node.handle || node.handle2) {
            node.handle = node.handle2 = null;
            bezierGroup.refreshFeature(state.feature);
          }
        }
      }
      // state.selectedCoordPaths = [];
    }

    if(props.bezierHandle){
      state.handleSelected = (props.handleInverse ? -1 : 1);
      state.selectedCoordPaths = [props.coord_path];
      // Break Handle Symetry with Alt 
      if(isAltDown(e)){
        state.breakHandleSymetry=true;
      } 
      // Reenable handle Symetry with Shift
      else if (CommonSelectors.isShiftDown(e)){
        if(node){
          if(node.handle2){
            // if handle 2 was selected, copy inverse to handle 1
            if(state.handleSelected===-1){
              node.handle = mirrorHandle(node.coords, node.handle2);
            }
            node.handle2=undefined;
            bezierGroup.refreshFeature(state.feature);
          }
        }
      }   
      return;
    }  
  }

  //Select Vertex 
  const selectedIndex = state.selectedCoordPaths.indexOf(props.coord_path);
  if (!CommonSelectors.isShiftDown(e) && selectedIndex === -1) {
    state.selectedCoordPaths = [props.coord_path];
  } else if (CommonSelectors.isShiftDown(e) && selectedIndex === -1) {
    state.selectedCoordPaths.push(props.coord_path);
  }

  const selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
};

DirectModeBezierOverride.onMidpoint = function(state, e) {
  const bezierGroup = getBezierGroup(state);
  if (bezierGroup) {
    this.startDragging(state, e);
    const props = e.featureTarget.properties;
    //get bezierCurve & previous node
    const result = bezierGroup.getBezierCurveAndNodeFromCoordPath(props.coord_path);
    const bezierCurve = result.bezierCurve;
    const bezierCurveIndex = result.bezierCurveIndex;
    const nodeIndex = result.nodeIndex;

    const newNode = new BezierNode([props.lng, props.lat]);
    const newCoordPath = bezierGroup.bezierCurves.length>1 ? (`${bezierCurveIndex}.${nodeIndex+1}`) : (`${nodeIndex+1}`);
    // insert node into nodes
    bezierCurve.nodes.splice(nodeIndex+1, 0, newNode);
    bezierGroup.refreshFeature(state.feature);

    this.fireUpdate();
    state.selectedCoordPaths = [newCoordPath];
    const selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
    this.setSelectedCoordinates(selectedCoordinates);
  } else {
    // IF NOT A BEZIER GROUP : classic handling
    this.startDragging(state, e);
    const about = e.featureTarget.properties;
    state.feature.addCoordinate(about.coord_path, about.lng, about.lat);
    this.fireUpdate();
    state.selectedCoordPaths = [about.coord_path];
  }
};

DirectModeBezierOverride.dragFeature = function(state, e, delta) {
  moveFeatures(this.getSelected(), delta);

  // Move bezier control points & handles
  dragBezierPoints(this, delta);

  state.dragMoveLocation = e.lngLat;
};

DirectModeBezierOverride.dragVertex = function(state, e, delta) {
    const bezierGroup = getBezierGroup(state);
    if (bezierGroup) {
      
      if(state.createNewHandles){
        const coordPath = state.selectedCoordPaths[state.selectedCoordPaths.length-1]
        const node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;

        if(node){
          if(!node.handle && !node.handle2){
            node.handle = [node.coords[0], node.coords[1]];
          }
          state.createNewHandles=false;
          state.handleSelected=1;
        }    
      }

      if(state.handleSelected===0) { // Move Bezier Point
        state.selectedCoordPaths.forEach(coordPath => {
          // Move Bezier Points
          const node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;
          // Move main point only if no handle Selected (=0)
          node.coords[0] += delta.lng;
          node.coords[1] += delta.lat;
          if(node.handle){
            node.handle[0] += delta.lng;
            node.handle[1] += delta.lat;
          }
          if(node.handle2){
            node.handle2[0] += delta.lng;
            node.handle2[1] += delta.lat;
          }
        });
      }
      else { // Move Bezier Handles (only last selected)
          
        const coordPath = state.selectedCoordPaths[state.selectedCoordPaths.length-1]
        const node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;

        if(node){
          // If createSecondaryHandle and handle2 was not defined, create the handle2 by mirroring handle 1
          if(state.breakHandleSymetry && !node.handle2){
            state.breakHandleSymetry = false;
            node.handle2 = mirrorHandle(node.coords, node.handle);
          }

          if(!node.handle2){ // If no handle2 it means that handles are linked
            if(node.handle){
              node.handle[0] += delta.lng * state.handleSelected;
              node.handle[1] += delta.lat * state.handleSelected;
            }
          }
          else { // If handle 2 then they are unlinked, we should move them indepentely base on the handleSelected
            if(state.handleSelected===1){
              node.handle[0] += delta.lng;
              node.handle[1] += delta.lat;
            }
            else if(state.handleSelected===-1){
              node.handle2[0] += delta.lng;
              node.handle2[1] += delta.lat;
            }
          }
        }
      }
      
      bezierGroup.refreshFeature(state.feature);
      this.fireUpdate();
    } 
    // IF NOT A BEZIER GROUP : classic handling
    else {
        const selectedCoords = state.selectedCoordPaths.map(coord_path => state.feature.getCoordinate(coord_path));
        const selectedCoordPoints = selectedCoords.map(coords => ({
            type: Constants.geojsonTypes.FEATURE,
            properties: {},
            geometry: {
            type: Constants.geojsonTypes.POINT,
            coordinates: coords
            }
        }));

        const constrainedDelta = constrainFeatureMovement(selectedCoordPoints, delta);
        for (let i = 0; i < selectedCoords.length; i++) {
            const coord = selectedCoords[i];
            state.feature.updateCoordinate(state.selectedCoordPaths[i], coord[0] + constrainedDelta.lng, coord[1] + constrainedDelta.lat);
        }
    }
};

DirectModeBezierOverride.onKeyDown = function(state, e) {
  if (isCtrlCDown(e)){
    copyBezierGroupToClipboard(this.getSelected());   
  }
}

DirectModeBezierOverride.onTrash = function(state) {
  const bezierGroup = getBezierGroup(state);

  // Mark Nodes for deletion
  state.selectedCoordPaths.forEach(coordPath => {
    const result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    const bezierCurve = result.bezierCurve;
    const node = result.node;
    bezierCurve.nodesToDelete.push(node);
  });

  // Remove nodes
  bezierGroup.removeMarkedNodes();
  bezierGroup.refreshFeature(state.feature);

  this.fireUpdate();
  state.selectedCoordPaths = [];
  this.clearSelectedCoordinates();
  this.fireActionable(state);
  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }
};

DirectModeBezierOverride.onMouseMove = function(state, e) {
  // On mousemove that is not a drag, stop vertex movement.
  const isFeature = CommonSelectors.isActiveFeature(e);
  const onVertex = isVertex(e);
  const onMidpoint = isMidpoint(e);
  
  const noCoords = state.selectedCoordPaths.length === 0;
  if (onMidpoint) this.updateUIClasses({ mouse: Constants.cursors.ADD });
  else if (isFeature && noCoords) this.updateUIClasses({ mouse: Constants.cursors.MOVE });
  else if (onVertex && !noCoords) this.updateUIClasses({ mouse: Constants.cursors.MOVE });
  else this.updateUIClasses({ mouse: Constants.cursors.NONE });
  this.stopDragging(state);

  // Skip render
  return true;
};

DirectModeBezierOverride.onMouseOut = function(state) {
  // As soon as you mouse leaves the canvas, update the feature
  if (state.dragMoving) this.fireUpdate();

  // Skip render
  return true;
};


DirectModeBezierOverride.onCombineFeatures = function(state) {

  if(state.selectedCoordPaths.length===0) return;

  // Mark down nodes to merge for future processing
  const bezierGroup = getBezierGroup(state);
  state.selectedCoordPaths.forEach(coordPath => {
    const result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    const bezierCurve = result.bezierCurve;
    const node = result.node;
    bezierCurve.nodesToMerge.push(node);
  });
  // Merge nodes
  bezierGroup.mergeMarkedNodes();
  
  const feature = bezierGroup.refreshFeature(state.feature, draw, true); // Force recreate feature as we may go from a multiline string to a single string
  state.featureId = feature.id;
  state.feature = feature;

  this.fireUpdate();
  state.selectedCoordPaths = [];
 
  const selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
  this.fireActionable(state);
  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }
  this.doRender(state.featureId);
}

DirectModeBezierOverride.onUncombineFeatures = function(state) {
  if(state.selectedCoordPaths.length===0) return;

  // Mark down nodes to split for future processing
  const bezierGroup = getBezierGroup(state);
  state.selectedCoordPaths.forEach(coordPath => {
    const result = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath);
    const bezierCurve = result.bezierCurve;
    const node = result.node;
    bezierCurve.nodesToSplit.push(node);
  });
  // Split nodes
  bezierGroup.splitMarkedNodes();
  
  const feature = bezierGroup.refreshFeature(state.feature, draw, true); // Force recreate feature as we may go from a multiline string to a single string
  state.featureId = feature.id;
  state.feature = feature;

  this.fireUpdate();
  state.selectedCoordPaths = [];
  const selectedCoordinates = this.pathsToCoordinates(state.featureId, state.selectedCoordPaths);
  this.setSelectedCoordinates(selectedCoordinates);
  this.fireActionable(state);
  if (state.feature.isValid() === false) {
    this.deleteFeature([state.featureId]);
    this.changeMode(Constants.modes.SIMPLE_SELECT, {});
  }
  this.doRender(state.featureId);
}

DirectModeBezierOverride.toDisplayFeatures = function (state, geojson, display) {
  if (state.featureId === geojson.properties.id) {
    geojson.properties.active = Constants.activeStates.ACTIVE;
    //If Bezier curve create supplementary points for bezier points instead
    const supplementaryPoints = geojson.properties.user_bezierGroup ? 
    (createSupplementaryPointsForBezier(geojson, {
      featureId:state.featureId,
      midpoints: true,
      selectedPaths: state.selectedCoordPaths
    })) : 
    createSupplementaryPoints(geojson, {
        map: this.map,
        midpoints: true,
        selectedPaths: state.selectedCoordPaths
      });
    supplementaryPoints.forEach(display);
    display(geojson);
  } else {
    geojson.properties.active = Constants.activeStates.INACTIVE;
    display(geojson);
  }
  this.fireActionable(state);
}



function getBezierGroup(state) {
  //Ensure the state bezierGroup is also modified
  let bezierGroupFromProps = state.feature.properties.bezierGroup;
  if(bezierGroupFromProps == null) return  null;
   // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions
   bezierGroupFromProps = new BezierGroup(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps;
}


export default DirectModeBezierOverride; 