import './App.css';

import React, { useRef, useEffect, useState } from 'react';

import mapboxgl from '!mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from '@turf/turf';

import {
  SimpleSelectModeBezierOverride, 
  DirectModeBezierOverride, 
  DrawBezierCurve, 
  rawDataToBezierGroup,
  customStyles,
} from 'mapbox-gl-draw-bezier-curve-mode';


// import                                      './mapbox-gl-draw-bezier-curve/icon/bezier-curve.css';

import {extendDrawBar} from './utils/extendDrawBar.js';
import {demoData} from './demoData.js';
import { feature } from '@turf/turf';

// Token for demo purpose, replace by your own
mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94LWdsLWRyYXctYmV6aWVyLWN1cnZlLWRlbW8iLCJhIjoiY2t0OXJyd2szMWV5MjJwbjlyNGtsOXVpdiJ9.Hom5aMPuxvSJUaiUynqIVA';

function App() {
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(2.2972);
  const [lat, setLat] = useState(48.7742);
  const [zoom, setZoom] = useState(19.92);
  const [drawMode, setDrawMode] = useState('simple_select');
  const [selectionType, setSelectionType] = useState('');

  useEffect(() => {
    if (map.current) return; // initialize map only once

    ////////////////////////////////////////////////
    // Initialize Map & Draw
    ////////////////////////////////////////////////
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',//mapbox://styles/mapbox/streets-v11',
      center: [lng, lat],
      zoom: zoom
    });

    var draw = new MapboxDraw({
      displayControlsDefault: false,
      userProperties: true,
      modes: {
        ...MapboxDraw.modes,
        simple_select: SimpleSelectModeBezierOverride,
        direct_select: DirectModeBezierOverride,
        draw_bezier_curve: DrawBezierCurve,
      },
      styles: customStyles
    });

    ////////////////////////////////////////////////
    // Add DrawBar
    ////////////////////////////////////////////////
    // const drawLineString =     {on: "click", action: () => {draw.changeMode("draw_line_string")}, classes: ["mapbox-gl-draw_line"], title:'Polygon tool'};
    // const drawPolygon =  {on: "click", action: () => {draw.changeMode("draw_polygon")}, classes: ["mapbox-gl-draw_polygon"], title:'LineString tool'};
    const drawBezierBtn =   {on: "click", action: () => {draw.changeMode("draw_bezier_curve")}, classes: ["bezier-curve-icon"], title:'Bezier tool'};
    const drawPointBtn =    {on: "click", action: () => {draw.changeMode("draw_point")}, classes: ["mapbox-gl-draw_point"], title:'Marker tool'};
    const trashBtn =        {on: "click", action: () => {draw.trash()}, classes: ["mapbox-gl-draw_trash"], title:'Delete'};
    const combineBtn =      {on: "click", action: () => {draw.combineFeatures()}, classes: ["mapbox-gl-draw_combine"], title:'Combine'};
    const unCombineBtn =    {on: "click", action: () => {draw.uncombineFeatures()}, classes: ["mapbox-gl-draw_uncombine"], title:'Uncombine'};

    let drawBar = new extendDrawBar({
      draw: draw,
      buttons: [
        // drawLineString,
        // drawPolygon,
        drawBezierBtn,
        drawPointBtn,
        trashBtn,
        combineBtn,
        unCombineBtn],
    });
    map.current.addControl(drawBar);

    // Fix to allow deletion with Del Key when default trash icon is not shown. See https://github.com/mapbox/mapbox-gl-draw/issues/989
    draw.options.controls.trash=true;

    ////////////////////////////////////////////////
    // Map configuration & events
    ////////////////////////////////////////////////
    // Disable Rotation
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    // Prevent context menu from appearing on right click
    window.addEventListener('contextmenu', function (e) { 
      // do something here... eg : Show a context menu
      // console.log("show Context Menu");
      e.preventDefault(); 
    }, false);
    
    // Prevent firefox menu from appearing on Alt key up
    window.addEventListener('keyup', function (e) { 
      if(e.key === "Alt")
      {
        e.preventDefault();
      }
    }, false);

    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });

    map.current.on('draw.modechange', (e) => {
      // console.log("Mode Change : " + e.mode);
      setDrawMode(e.mode);
    });

    map.current.on('draw.selectionchange', (e) => {
      refreshSelectionType(e, setSelectionType);
    });

    map.current.on('draw.update', (e) => {
      refreshSelectionType(e, setSelectionType);
    });

    ///////////////////////////////////////////////////
    // Import some example bezier curves from demoData
    ///////////////////////////////////////////////////
    const bezierGroups = rawDataToBezierGroup(demoData);
    let featureId;
    bezierGroups.forEach(bezierGroup => {
      // Draw feature
      featureId = draw.add(bezierGroup.geojson)[0];
    });
    // Demo : Select last feature
    draw.changeMode('simple_select', { featureIds: [featureId] })


  });

  return (
    <div>
      <div className="sidebar">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}<br/>
        Draw mode: {drawMode}<br/>
        {(selectionType !== null && selectionType!=='') &&
                <div>
                Selection type : {selectionType}<br/>
                </div>
        }
      </div>
      <div ref={mapContainer} className="map-container" />
    </div>
  );

}

export default App;

function refreshSelectionType(e, setSelectionType) {
  const features = e.features;
  if(features.length>0){
    const feature1 = features[0];
    const ftype = getMultiSelectionFeatureType(e.features);
    if(ftype === "Mixed") {
      setSelectionType(ftype);
    }
    else if(feature1.properties.bezierGroup){
      const bezierGroup = feature1.properties.bezierGroup;// without functions
      let typeString = (bezierGroup.bezierCurves.length>1 ? `${ftype}(${bezierGroup.bezierCurves.length})` : `${ftype}`);
      typeString += " Length: " + getBezierLength(features);
      setSelectionType(typeString);
    }
    else if(feature.geometry){
        setSelectionType(feature.geometry.type);
    }
  }
  else {
    setSelectionType(null);
  }
}

function getBezierLength(features){
  let distKm=0
  features.forEach(feature => {
    if(feature.geometry){
      distKm += turf.length(feature.geometry, 'kilometers');
    }
  });
  if(distKm <0.001) return `${(distKm*100000).toLocaleString(undefined, { maximumFractionDigits: 2 })} cm`;
  if(distKm <1) return `${(distKm*1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} m`;
  return `${(distKm).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
}

function getFeatureType(feature){
  if(feature.properties.bezierGroup){
    const bezierGroup = feature.properties.bezierGroup;
    if(bezierGroup.bezierCurves.length>1){
      return "MultiBezierCurve";
    }
    else {
      return "BezierCurve";
    }
  }
  else {
    return feature.geometry.type;
  }
}

function getMultiSelectionFeatureType(features) {
  if(features.length>0){
    const feature1Type = getFeatureType(features[0]);
    for (let i = 1; i < features.length; i++) {
      const featureType = getFeatureType(features[i]);
      if(feature1Type!==featureType){return "Mixed"};
    }
    return feature1Type;
  }
  else {
    return "None";
  }
}