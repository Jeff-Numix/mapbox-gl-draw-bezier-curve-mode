import MapboxDraw from '@mapbox/mapbox-gl-draw';
const CommonSelectors = MapboxDraw.lib.CommonSelectors;
const Constants = MapboxDraw.constants;
const createVertex = MapboxDraw.lib.createVertex;
const doubleClickZoom = MapboxDraw.lib.doubleClickZoom;

import BezierGroup from '../utils/BezierGroup';
import BezierCurve from '../utils/BezierCurve';
import BezierNode from '../utils/BezierNode';
import createBezierControlPoint from '../utils/createBezierPoint';
import createBezierHandle from '../utils/createBezierHandle';
import createBezierHandleLine from '../utils/createBezierHandleLine';

import {mirrorHandle} from '../utils/bezierUtils';
import {isAltDown} from '../utils/additional_selectors';

const DrawBezierCurve = {};

let draw=null;

DrawBezierCurve.onSetup = function(opts) {
  opts = opts || {};
  const featureId = opts.featureId;
  if(featureId){
    console.log("option featureId is currently ignored on DrawBezierCurve");
  }

  let line;
  let direction = 'forward';
 
  const bezierGroup = new BezierGroup([new BezierCurve()]);

  line = this.newFeature(bezierGroup.geojson);

  this.addFeature(line);
  draw = this;
  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  this.activateUIButton(Constants.types.LINE);
  this.setActionableState({
    trash: true
  });
  const lastMouseOverVertexPath = -1;

  const state = {
    line,
    direction,
    lastMouseOverVertexPath
  };
  return state;
};

DrawBezierCurve.clickAnywhere = function(state, e) {
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];

  this.updateUIClasses({ mouse: Constants.cursors.ADD });

  const node1 = new BezierNode([e.lngLat.lng, e.lngLat.lat]);
  bezierCurve.nodes.push(node1);
  //if first node we prepare next node to match cursor position while its moving
  if(bezierCurve.nodes.length===1){
    const node2 = new BezierNode([e.lngLat.lng, e.lngLat.lat]);
    bezierCurve.nodes.push(node2);
  }
  bezierGroup.refreshFeature(state.line);

};

DrawBezierCurve.clickOnVertex = function(state, e) {
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];
  // In draw mode, if vertex is the first one, we want to close loop on it
  const isFirstVertex = (e.featureTarget.properties.coord_path === 0);
  if(isFirstVertex){
    // Close loop bezier Curve
    bezierCurve.closed=true;
  }
  bezierGroup.refreshFeature(state.line);
  return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
};

DrawBezierCurve.onMouseMove = function(state, e) {
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];

  // On mousemove that is not a drag, stop extended interactions.
  this.map.dragPan.enable();
  
  //move next node at cursor position
  if(bezierCurve.nodes.length>0){
    const lastNode = bezierCurve.nodes[bezierCurve.nodes.length-1];
    lastNode.coords = [e.lngLat.lng, e.lngLat.lat];
    bezierGroup.refreshFeature(state.line);    
  }
  if (CommonSelectors.isVertex(e)) {
    this.updateUIClasses({ mouse: Constants.cursors.POINTER });
    state.lastMouseOverVertexPath = e.featureTarget.properties.coord_path;
  }
  else {
    state.lastMouseOverVertexPath = -1;
  }
};

DrawBezierCurve.onMouseDown = function(state, e) {
  if (isAltDown(e)) {
    this.map.dragPan.disable();
  }
};

DrawBezierCurve.onMouseUp = function(state, e) {
  if(state.dragging){
    DrawBezierCurve.onEndDrag(state,e);
  }
};

DrawBezierCurve.onStartDrag = function(state, e) {
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];
  // Check if we start dragging on the first node,that means we should close the curve.
  if(!bezierCurve.closed && isCurveClosable(bezierCurve) && state.lastMouseOverVertexPath === 0){
    bezierCurve.closed=true;
    bezierCurve.nodes.pop();// delete last node as we will now edit the first node as we are closing the curve
    bezierGroup.refreshFeature(state.line);
  }
  state.dragging=true;
  //if no nodes we start a new bezier curve : so create a new node
  if(bezierCurve.nodes.length===0) {
    const lnglat = [e.lngLat.lng, e.lngLat.lat];
    const node = new BezierNode(lnglat, lnglat);
    bezierCurve.nodes.push(node);
    bezierGroup.refreshFeature(state.line);
  }
}

DrawBezierCurve.onDrag = function(state, e) {
  if (isAltDown(e)) {
    if(!state.dragging){
      DrawBezierCurve.onStartDrag(state,e);
      return;
    }

    const bezierGroup = getBezierGroup(state);
    const bezierCurve = bezierGroup.bezierCurves[0];

    const lnglat = [e.lngLat.lng, e.lngLat.lat]
    if(bezierCurve.nodes.length>0){
      if(!bezierCurve.closed) {
        const lastNode = bezierCurve.nodes[bezierCurve.nodes.length-1];
        lastNode.handle = lnglat;
      }
      else {
        // if curve closed : we should edit the first node instead
        const firstNode = bezierCurve.nodes[0];
        firstNode.handle = lnglat;
      }
      bezierGroup.refreshFeature(state.line);
    }
  }
}

DrawBezierCurve.onEndDrag = function(state,e) {
  state.dragging=false;
 
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];

  const lnglat = [e.lngLat.lng, e.lngLat.lat]
  if(!bezierCurve.closed) {
   // Create node at mouse pos
   const node = new BezierNode(lnglat);
   bezierCurve.nodes.push(node);
   bezierGroup.refreshFeature(state.line);
  }
  else {
    //if curve is closed we should return to simple select mode.
    // this mode will pop the last node so we need to add one.
    bezierCurve.nodes.push(new BezierNode(lnglat));// The node that will be immediately deleted by change mode > On Stop
    bezierGroup.refreshFeature(state.line);
    return draw.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  }
}

DrawBezierCurve.removeLastNode = function(state,e) {
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];
  bezierCurve.nodes.pop();
  bezierGroup.refreshFeature(state.line);
}

DrawBezierCurve.onTap = DrawBezierCurve.onClick = function(state, e) {
  // Right click or Mouse wheel click
  if(e.originalEvent.button===2 || e.originalEvent.button === 1) {
    DrawBezierCurve.removeLastNode(state,e);
    return;
  }
  if (CommonSelectors.isVertex(e)) return this.clickOnVertex(state, e);
  this.clickAnywhere(state, e);
};

DrawBezierCurve.onKeyUp = function(state, e) {

  if (CommonSelectors.isEnterKey(e)) {
    this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  } else if (CommonSelectors.isEscapeKey(e)) {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  }  
};

DrawBezierCurve.onStop = function(state) {
  doubleClickZoom.enable(this);
  this.activateUIButton();

  // check to see if we've deleted this feature
  if (this.getFeature(state.line.id) === undefined) return;

  //remove last added nodes
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];
  bezierCurve.removeLastNode();
  bezierGroup.refreshFeature(state.line);
  if (state.line.isValid()) {
    this.map.fire(Constants.events.CREATE, {
      features: [state.line.toGeoJSON()]
    });
  } else {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
  }
};

DrawBezierCurve.onTrash = function(state) {
  this.deleteFeature([state.line.id], { silent: true });
  this.changeMode(Constants.modes.SIMPLE_SELECT);
};

DrawBezierCurve.toDisplayFeatures = function(state, geojson, display) {
  const isActiveLine = geojson.properties.id === state.line.id;
  geojson.properties.active = (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  if (!isActiveLine) return display(geojson);
  const bezierGroup = getBezierGroup(state);
  const bezierCurve = bezierGroup.bezierCurves[0];
  if(state.dragging) {
    //if dragging : display current node & handles
    const node = bezierCurve.closed ? bezierCurve.nodes[0] : bezierCurve.nodes[bezierCurve.nodes.length-1]; // If curve is closed we should display the first node instead
    const path = bezierCurve.nodes.length-1;
    //display node: 
    display(createBezierControlPoint(state.line.id, node.coords, path, false));
    
    // Draw Handle lines
   if(node.handle){
      if(node.handle2) {
        display(createBezierHandleLine(state.line.id, [node.handle, node.coords, node.handle2]));
      } 
      else {
        display(createBezierHandleLine(state.line.id, [node.handle, mirrorHandle(node.coords, node.handle)]));
      }
    }
    // Draw Handles
    if(node.handle) {
      //display handle
      display(createBezierHandle(state.line.id, node.handle, path, false));
      //display mirror handle
      const handle2 = mirrorHandle(node.coords, node.handle);
      display(createBezierHandle(state.line.id, handle2, path, false));
    }
  }
  else {
    // Only render the line if it has at least one real coordinate
    if (bezierCurve.nodes.length < 2) return;
    const penultNode = bezierCurve.nodes[bezierCurve.nodes.length-2];//avant dernier node
    const path = bezierCurve.nodes.length-1;
    geojson.properties.meta = Constants.meta.FEATURE;
    display(createVertex(
      state.line.id, //parentId
      penultNode.coords,//coordinates
      `${path}`,//path
      false//selected
    ));
  }

  // Display first point to allow for finishing a curve into a closed loop
  if(!bezierCurve.closed && isCurveClosable(bezierCurve)) {
    const firstNode = bezierCurve.nodes[0];
    const path = 0;
    display(createBezierControlPoint(state.line.id, firstNode.coords, path, false));
  }

  display(geojson);
};

function getBezierGroup(state) {
  //Ensure the state bezierGroup is also modified
  let bezierGroupFromProps = state.line.properties.bezierGroup;
  if(bezierGroupFromProps == null) return  null;
   // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions
  bezierGroupFromProps = new BezierGroup(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps; 
}

function isCurveClosable(bezierCurve) {
  // Curve is closable if there is atleast 2 points with handles, or at least 3 points without handles
  // there is always 1 more node under mouse pos. so we have to count 1 more node
  if(bezierCurve.nodes.length<3){
    return false;
  }
  if(bezierCurve.nodes.length===3){
    const node1 = bezierCurve.nodes[0];
    const node2 = bezierCurve.nodes[1];
    if(!node1.handle && !node2.handle){
      return false;
    }
  }
  return true; 
}

export default DrawBezierCurve;
