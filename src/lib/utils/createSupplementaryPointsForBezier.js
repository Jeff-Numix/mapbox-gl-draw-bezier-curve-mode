import MapboxDraw from '@mapbox/mapbox-gl-draw';
const Constants = MapboxDraw.constants;
import {distance, abs} from 'mathjs';

import createBezierControlPoint from './createBezierPoint';
import createBezierHandle from './createBezierHandle';
import {mirrorHandle} from './bezierUtils';
import BezierGroup from './BezierGroup';
import createBezierHandleLine from './createBezierHandleLine';


export default function createSupplementaryPointsForBezier(geojson, options = {}) { 
  const {properties} = geojson;
  const bezierGroup = getBezierGroup(properties.user_bezierGroup);
  if (!bezierGroup) return null;

  const supplementaryPoints = [];

  let selectedCoordPaths = [];
  let bezierCurveId = 0;
  if(options.selectedPaths){
    selectedCoordPaths = options.selectedPaths;
  }
  const featureId = options.featureId;
  // Draw all control points
  bezierGroup.bezierCurves.forEach(bezierCurve => {
    
    for (let i = 0; i < bezierCurve.nodes.length; i++) {
      const node = bezierCurve.nodes[i];
      const coord_path = bezierGroup.bezierCurves.length>1 ? `${bezierCurveId}.${i}` : `${i}`;
      const selected = selectedCoordPaths.includes(coord_path);
      supplementaryPoints.push(createBezierControlPoint(properties.id, node.coords, coord_path, selected));
    }
    bezierCurveId++;
  });

  // Draw Selected node handles
  selectedCoordPaths.forEach(coordPath => {
    // Move Bezier Points
    const node = bezierGroup.getBezierCurveAndNodeFromCoordPath(coordPath).node;
    
    if(node.handle){
      const handleVertex = createBezierHandle(properties.id, node.handle, coordPath, false);
      handleVertex.properties.handle=true;
      handleVertex.properties.handleInverse=false;
      supplementaryPoints.push(handleVertex);
    }
    if(node.handle2 || node.handle){
      const inverseHandleVertex = createBezierHandle(properties.id, node.handle2 ? node.handle2 : mirrorHandle(node.coords, node.handle), coordPath, false);
      inverseHandleVertex.properties.handle=true;
      inverseHandleVertex.properties.handleInverse=true;
      supplementaryPoints.push(inverseHandleVertex);
    }
    // Draw Handle lines
    if(node.handle){
      if(node.handle2) {
        supplementaryPoints.push(createBezierHandleLine(properties.id, [node.handle, node.coords, node.handle2]));
      } 
      else {
        supplementaryPoints.push(createBezierHandleLine(properties.id, [node.handle, mirrorHandle(node.coords, node.handle)]));
      }
    }
  }); 

  // Draw mid points
  if(options.midpoints && featureId){
    for (let i = 0; i < bezierGroup.bezierCurves.length; i++) {
      const bezierCurve = bezierGroup.bezierCurves[i];
      // Loop into curve vertices by bezierSteps / 2 so we find the middle position
      let vertIndex=0;
      for (let j = 0; j < bezierCurve.nodes.length; j++) {
        const node = bezierCurve.nodes[j];
        const nextNodeIndex = j<bezierCurve.nodes.length-1 ? (j+1) : 0; 
        if(!bezierCurve.closed && nextNodeIndex===0) continue; //Ignore last point if curve is not closed

        const nextNode = bezierCurve.nodes[nextNodeIndex];
        //if node is Bezier, then we have n=beziersteps vertices
        //if node is not Bezier, then the same apply if nextnode is Bezier.
        let midPointCoords;
        if(node.handle || (!node.handle && nextNode.handle)){
          // Create a midPoint here

          // FIRST METHOD : less accurate to find the middle vertice position
          // const midPointVerticeIndex = vertIndex + parseInt(bezierCurve.bezierSteps/2);
          // midPointCoords = bezierCurve.verts[midPointVerticeIndex];

          // SECOND METHOD : more expensive but more accurate to find the middle vertice
          const nextNodeVerticeIndex = vertIndex + parseInt(bezierCurve.bezierSteps);
          midPointCoords = getMidPointVertex(bezierCurve.verts, vertIndex, nextNodeVerticeIndex);
          
          vertIndex += bezierCurve.bezierSteps;
        }
        else if (!node.handle && !nextNode.handle){ // This is two Points without bezier, there are no vertices inBetween
          // Create a midPoint between node & nextNode position
          midPointCoords = [(node.coords[0] + nextNode.coords[0])/2, (node.coords[1] + nextNode.coords[1])/2];
          vertIndex +=1;
        }

        if(midPointCoords) {
          const mid = {lng:midPointCoords[0], lat:midPointCoords[1]};
          const coordPath = bezierGroup.bezierCurves.length>1 ? `${i}.${j}` : `${j}`; 
          const midPoint = {
            type: Constants.geojsonTypes.FEATURE,
            properties: {
              meta: Constants.meta.MIDPOINT,
              parent: featureId,
              lng: mid.lng,
              lat: mid.lat,
              coord_path: coordPath
            },
            geometry: {
              type: Constants.geojsonTypes.POINT,
              coordinates: [mid.lng, mid.lat]
            }
          };
          supplementaryPoints.push(midPoint);
        }
      }
    }
  }
  return supplementaryPoints;
}

function getMidPointVertex(verts, startIndex, endIndex) {
  const pS = verts[startIndex];
  const pE = verts[endIndex];
  let smallestDistDiff = 99999999;
  let midVertexId = -1;
  for (let i = 1; i < endIndex-startIndex-1; i++) {
    const vIndex = startIndex+i;
    const pI = verts[vIndex];
    const distDiff = abs(distance(pS,pI) - distance(pE,pI));
    if(distDiff < smallestDistDiff){
      smallestDistDiff = distDiff;
      midVertexId = vIndex;
    }    
  }
  if(midVertexId!==-1){
    return verts[midVertexId];
  }
  return null;
}


function getBezierGroup(bezierGroupFromProps) {
  if(bezierGroupFromProps == null) return  null;
   // recreate bezier group from itself to ensure it has the functions : Bezier Group from the props has no functions
   bezierGroupFromProps = new BezierGroup(bezierGroupFromProps.bezierCurves);
  return bezierGroupFromProps;
}