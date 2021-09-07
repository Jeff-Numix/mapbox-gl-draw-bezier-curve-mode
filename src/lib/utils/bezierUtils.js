const mirrorHandle = function(bezierPoint, bezierHandle){
    // Mirrors the handle relative to the point
    return [(bezierPoint[0]*2 - bezierHandle[0]), (bezierPoint[1]*2 - bezierHandle[1])];
}

const bezierCurve4pts = function (p1, p2, p3, p4, t) {
    //Mathematic formula : P = (1−t)^3*P1 + 3(1−t)^2*t*P2 +3(1−t)*t^2*P3 + t^3*P4
    //See https://javascript.info/bezier-curve#maths
    const x = Math.pow((1-t), 3)*p1[0] + 3*Math.pow((1-t),2)*t*p2[0] + 3*(1-t)*Math.pow(t, 2)*p3[0] + Math.pow(t,3)*p4[0];
    const y = Math.pow((1-t), 3)*p1[1] + 3*Math.pow((1-t),2)*t*p2[1] + 3*(1-t)*Math.pow(t, 2)*p3[1] + Math.pow(t,3)*p4[1];
    return [x,y];
}

export {mirrorHandle, bezierCurve4pts}