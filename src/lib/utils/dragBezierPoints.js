export default function dragBezierPoints(draw, delta) {
    draw.getSelected()
    .filter(feature => feature.properties.bezierGroup)
    .map(feature => feature.properties.bezierGroup)
    .forEach(bezierGroup => {
      bezierGroup.bezierCurves.forEach(bezierCurve => {
        bezierCurve.nodes.forEach(node => {
          node.coords[0] += delta.lng;
          node.coords[1] += delta.lat;
  
          if(node.handle){
            node.handle[0] += delta.lng;
            node.handle[1] += delta.lat;
          }
        });
      });
      
    });
}