import BezierGroup from './BezierGroup';

export default function copyBezierGroupToClipboard(selectedFeatures) {

    if(selectedFeatures.length >0){
        let copiedText='';

        selectedFeatures.forEach(feature => {
            if(feature && feature.properties.bezierGroup){

                // ReInstance beziergroup to keep all functions present
                const bezierGroup = new BezierGroup(feature.properties.bezierGroup.bezierCurves); 
                copiedText+=bezierGroup.getRawData();
            }
            else {
                console.error("No Bezier Group copied in Memory : feature1 is null or feature1 is not a bezier Group");
            }
        });

        if(copiedText!=='') {
            // Put Raw data in a textarea & copy it in memory
            const el = document.createElement('textarea');
            el.value = copiedText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);

            console.log("Selected Bezier Group copied In Memory");
        }   
    }
    else {
        console.error("No Bezier Group copied in Memory : selectedFeatures.length = 0");
    }

}