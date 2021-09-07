import BezierGroup from './BezierGroup';
import BezierCurve from './BezierCurve';
import BezierNode from './BezierNode';

// Convert input raw data to a bezier curve.
// Data should respect following format :
// BEZIERGROUP indicating we start a group of beziercurves
// BEZIERCURVE indicating we start a new bezier curve inside the group
// - One line per node.
// - Each node is represented by a pair of lat / lon separated by spaces
// - Value 1 & 2 = node coordinates
// - Value 3 & 4 (optional) = Bezier handle
// - Value 5 & 6 (optional) = Bezier handle2 (if handles are broken) 
// CLOSED to close the current bezier curve : this will loop to the first node.

export default function rawDataToBezierGroup(data) {
    const bezierGroups = [];
    let bezierGroup = new BezierGroup();
    let bezierCurve = new BezierCurve();

    const bezierGroupTextMatch = 'BEZIERGROUP';
    const bezierCurveTextMatch = 'BEZIERCURVE';
    const closedTextMatch = 'CLOSED';

    const lines = data.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // CHECK NEW BEZIERGROUP
        if(line === bezierGroupTextMatch){
            // Add bezierCurve to group
            if(bezierCurve.nodes.length>0) {
                bezierGroup.bezierCurves.push(bezierCurve);
                bezierCurve = new BezierCurve();
            }
            // Add bezierGroup to List if it is not the first one
            if(bezierGroup.bezierCurves.length>0){
                bezierGroups.push(bezierGroup);
                bezierGroup = new BezierGroup();
            }
        }
        // CHECK NEW BEZIERCURVE
        if(line === bezierCurveTextMatch){
            // Add bezierCurve to Group if it is not the first one
            if(bezierCurve.nodes.length>0){
                bezierGroup.bezierCurves.push(bezierCurve);
                bezierCurve = new BezierCurve();
            }
        }
        // CHECK CLOSED CURVE
        else if(line === closedTextMatch) {
            bezierCurve.closed = true;
        }
        // PARSE NODE DATA
        else {            
            const arr = line.split(' ');
            if(arr.length>=2){
                const lat = parseFloat(arr[0]);
                const lng = parseFloat(arr[1]);
                const node = new BezierNode([lng, lat]);
            
                if(arr.length>=4){
                    const lat = parseFloat(arr[2]);
                    const lng = parseFloat(arr[3]);
                    node.handle = [lng,lat];
                }
                if(arr.length>=6){
                    const lat = parseFloat(arr[4]);
                    const lng = parseFloat(arr[5]);
                    node.handle2 = [lng,lat];
                }
                if(node.coords){
                    bezierCurve.nodes.push(node);
                }
            }
        }
    }
    if(bezierCurve.nodes.length>0){
        // add last bezierCurve to group
        bezierGroup.bezierCurves.push(bezierCurve);
    }
    // add bezier Group to list
    bezierGroups.push(bezierGroup);
    return bezierGroups;
}