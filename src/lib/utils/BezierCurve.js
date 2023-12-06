import MapboxDraw from '@mapbox/mapbox-gl-draw';
const Constants = MapboxDraw.constants;
import {mirrorHandle, bezierCurve4pts} from './bezierUtils';
import {random} from 'mathjs';

export default class BezierCurve {

    constructor(nodes=[], closed=false, name="", ) {
        this.nodes = nodes;
        this.name = name;
        this.closed = closed;
        this.bezierSteps = 19;
        this.nodesToDelete = [];
        this.nodesToMerge = [];
        this.nodesToSplit = [];
        this.verts = this.vertices;
    }

    get vertices(){
        const verts =[];
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
    
            if(i<this.nodes.length-1){
                const nextNode = this.nodes[i+1];
                verts.push(...this.getVerticesBetweenNodes(node, nextNode));
            }
            else if(i===this.nodes.length-1) // Last Node
            {
                verts.push(node.coords);
            }
        }
        // Finish by close loop lastNode to first node
        if(this.closed) {
            const node = this.nodes[this.nodes.length-1];
            const nextNode = this.nodes[0];
            verts.push(...this.getVerticesBetweenNodes(node, nextNode));
            // add last vertex at starting next node pos
            verts.push(nextNode.coords);
        }
        return verts;
    }

    getVerticesBetweenNodes(node, nextNode) {
        const verts =[];
        // Begin by adding a vertex at node position, it will do the job for POINT TO POINT
        verts.push(node.coords);

        // Bezier Curve management
        if(node.handle || nextNode.handle){

            const p1 = node.coords;
            let p2;
            let p3;
            const p4 = nextNode.coords;

            // p2
            if(node.handle){
                p2 = node.handle
            }
            else {
                // find p2 as half of vector towards next node handle (mirrored)
                const nextNodeHandle = nextNode.handle2 ? nextNode.handle2 : mirrorHandle(nextNode.coords,nextNode.handle);
                const p2X = node.coords[0] + (nextNodeHandle[0] - node.coords[0])*0.5;
                const p2Y = node.coords[1] + (nextNodeHandle[1] - node.coords[1])*0.5;
                p2 = [p2X, p2Y];
            }

            // p3
            if(nextNode.handle) {
                p3 = nextNode.handle2 ? nextNode.handle2 : mirrorHandle(nextNode.coords,nextNode.handle);
            }
            else {
                // find p3 as half vector towards node handle
                const p3X = nextNode.coords[0] + (node.handle[0] - nextNode.coords[0]) *0.5;
                const p3Y = nextNode.coords[1] + (node.handle[1] - nextNode.coords[1]) *0.5;
                p3 = [p3X, p3Y];
            }

            for (let s = 1; s < this.bezierSteps; s++) {
                const t = s/this.bezierSteps;
                const point = bezierCurve4pts(p1, p2, p3, p4, t);
                verts.push(point); 
            }

        }
        return verts;
    }

    reverseNodesArray(){
        // Reverse array of nodes
        this.nodes.reverse();
        // Mirror handles if any
        this.nodes.forEach(node => {
            if(node.handle && !node.handle2){
                node.handle = mirrorHandle(node.coords,node.handle);
            }
            else if (node.handle && node.handle2){
                // Inverse Handle2 & handle1
                const tmpHandle2 = node.handle2;
                node.handle2 = node.handle;
                node.handle = tmpHandle2;
            }

        });
    }

    get geojson() {
        const lineString = {
            type: Constants.geojsonTypes.FEATURE,
            properties: { bezierCurve:this},
            geometry: {
                type: Constants.geojsonTypes.LINE_STRING,
                coordinates: this.vertices
            }
        };

        return lineString;
    }    

    getDistance(){
        return random(0,100);
    }

    removeNode(node){
        this.removeNodes([node]);
    }
    
    removeNodes(nodes) {
        this.nodes = this.nodes.filter(item => !nodes.includes(item));
    }
    removeLastNode() {
        this.nodes.pop();
    }

    removeMarkedNodes(){
        this.removeNodes(this.nodesToDelete);
        // Clean list
        this.nodesToDelete=[];
    }

    mode_CombineMergeNodesAverage(curveId) {
        // Create groups of nodes that follow each other
        const groupOfNodes = this.getGroupOfFollowingNodes(curveId);
        // Create new node in between the nodes
        groupOfNodes.forEach(subGroup => {
            // Parse "0.1" to get right integer
            subGroup = subGroup.map(id => {
                return parseInt(id.split('.')[1]);
            });
            // Average coordinates & Handles if any
            let coordX=0,coordY=0;
            let numHandles=0;
            let coordHandleX=0, coordHandleY=0;
            for (let i = 0; i < subGroup.length; i++) {
                const node = this.nodes[subGroup[i]];
                if(node){
                    coordX += node.coords[0];
                    coordY += node.coords[1];
                    if(node.handle){
                        coordHandleX+= node.handle[0];
                        coordHandleY+= node.handle[1];
                        numHandles++;
                    }
                }
            }
            coordX = coordX / subGroup.length;
            coordY = coordY / subGroup.length;
            // move first node of list
            const moveNode = this.nodes[subGroup[0]];
            moveNode.coords = [coordX, coordY];
            // Move Handle if any
            if(numHandles>0){
                coordHandleX = coordHandleX / numHandles;
                coordHandleY = coordHandleY / numHandles;
                moveNode.handle = [coordHandleX, coordHandleY];
            }

            // Remove merged nodes
            const nodesToDelete = subGroup.map(id =>{
                return this.nodes[id];
            });
            nodesToDelete.shift();//remove first item as we are moving it
            this.removeNodes(nodesToDelete);
        });       
    }

    getGroupOfFollowingNodes(curveId){
        // Create groups of nodes that follow each other
        const group = [];
        let subGroup = [];

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            let nodeFound = false;

            for (let j = 0; j < this.nodesToMerge.length; j++) {
                const nodeToMerge = this.nodesToMerge[j];
                if(node === nodeToMerge){
                    subGroup.push(`${curveId}.${i}`);
                    nodeFound=true;
                }
            }

            if(!nodeFound && subGroup.length>0){
                group.push(subGroup);
                subGroup = [];
            }
        }
        if(subGroup.length>0){
            group.push(subGroup);
        }
        // LOOP Management : verify if extreme numbers connect, if so match them
        if(group.length>=2){
            const firstSubgroup = group[0];
            const firstId = parseInt(firstSubgroup[0].split('.')[1]);
            const lastSubgroup = group[group.length-1];
            const lastId = parseInt(lastSubgroup[lastSubgroup.length-1].split('.')[1]);
            if(firstId === 0 && lastId === this.nodes.length-1){
                //Add last Subgroup elements to first one
                firstSubgroup.unshift(...lastSubgroup);
                //Remove last subgroup
                group.pop();
            }
        }
        
        return group;
    }
    
    getNodeIndex(node) {
        for (let i = 0; i < this.nodes.length; i++) {
            if(node === this.nodes[i]){
                return i;
            }
        }
        return -1;
    }

    getRawData() {
        let data='';
        this.nodes.forEach(node => {
            let line ='';
            if(node.coords){
                line +=`${node.coords[1]} ${node.coords[0]}`;
            }
            if(node.handle){
                line +=` ${node.handle[1]} ${node.handle[0]}`;
            }
            if(node.handle2){
                line +=` ${node.handle2[1]} ${node.handle2[0]}`;
            }
            data += line+'\n';
        });
        if(this.closed) {
            data += 'CLOSED\n';
        }
        return data;
    }

    getNodeToSplitIndexes() {
        const splitIndexes =[];
        if(this.nodesToSplit!=null){
            for (let i = 0; i < this.nodesToSplit.length; i++) {
                const node = this.nodesToSplit[i];
                const nodeIndex = this.getNodeIndex(node);
                if(nodeIndex!==0 && nodeIndex!==this.nodes.length-1){ // Dont add first & last node because they are not valida candidate for split
                    splitIndexes.push(nodeIndex);
                }
            }
        }
        return splitIndexes;
    }
}