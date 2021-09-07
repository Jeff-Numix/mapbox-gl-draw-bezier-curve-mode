function isAltDown(e) {
  if (!e.originalEvent) return false;
  return e.originalEvent.altKey;
}

function isCtrlCDown(e) {
  if(e.ctrlKey && e.key==="c"){
    e.preventDefault();
    return true;
  }
  return false;
}

function isBackspaceDown(e) {
  if(e.keyCode === 8){
    e.preventDefault();
    return true;
  }
  return false;
}

export {isAltDown,isCtrlCDown, isBackspaceDown}