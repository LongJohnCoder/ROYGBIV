var ResizeEventHandler = function(){
  window.addEventListener('resize', this.onResize);
}

ResizeEventHandler.prototype.onResize = function(){
  if (!(renderer && composer)){
    return;
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.oldAspect = camera.aspect;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  boundingClientRect = renderer.domElement.getBoundingClientRect();
  if (isDeployment){
    canvas.oldWidth = (canvas.width / screenResolution) + 'px';
    if (!isDeployment && terminal.isMadeVisible){
      ROYGBIV.terminal(false);
      ROYGBIV.terminal(true);
      if (!terminal.terminalPromptEnabled){
        ROYGBIV.terminalPrompt(false);
      }
    }
  }
  if (mode == 1){
    handleViewport();
    if (particleSystemRefHeight){
      GLOBAL_PS_REF_HEIGHT_UNIFORM.value = ((renderer.getCurrentViewport().w / screenResolution) / particleSystemRefHeight);
    }
    if (bloomOn){
      adjustPostProcessing(4, bloomResolutionScale);
    }
  }
  if (mode == 0){
    for (var areaName in areas){
      if (areas[areaName].text){
        areas[areaName].text.handleResize();
      }
    }
    for (var pointName in markedPoints){
      if (markedPoints[pointName].text){
        markedPoints[pointName].text.handleResize();
      }
    }
    for (var gridName in gridSelections){
      if (gridSelections[gridName].texts){
        for (var i = 0; i<gridSelections[gridName].texts.length; i++){
          gridSelections[gridName].texts[i].handleResize();
        }
      }
    }
  }else{
    for (var crosshairName in crosshairs){
      crosshairs[crosshairName].handleResize();
    }
  }
  for (var textName in addedTexts){
    addedTexts[textName].handleResize();
  }
}
