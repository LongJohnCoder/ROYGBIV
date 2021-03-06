var AddedText = function(name, font, text, position, color, alpha, characterSize, strlenParameter){
  this.isAddedText = true;
  if (IS_WORKER_CONTEXT){
    return this;
  }
  this.twoDimensionalParameters = new THREE.Vector2();
  this.twoDimensionalSize = new THREE.Vector4();
  this.webglSpaceSize = new THREE.Vector2();
  this.shaderMargin = new THREE.Vector2();
  this.name = name;
  this.font = font;
  this.text = text;
  this.position = position;
  this.color = color;
  this.alpha = alpha;
  this.characterSize = characterSize;
  this.geometry = new THREE.BufferGeometry();
  this.hasBackground = false;
  var strlen = strlenParameter;
  if (typeof strlen == UNDEFINED){
    strlen = text.length;
  }
  this.strlen = strlen;

  var charIndices = new Float32Array(strlen);
  for (var i = 0; i<strlen; i++){
    charIndices[i] = i;
  }
  this.charIndices = charIndices;
  this.offsetBetweenLines = DEFAULT_OFFSET_BETWEEN_LINES;
  this.offsetBetweenChars = DEFAULT_OFFSET_BETWEEN_CHARS;

  var charIndicesBufferAttribute = new THREE.BufferAttribute(charIndices, 1);
  charIndicesBufferAttribute.setDynamic(false);
  this.geometry.addAttribute('charIndex', charIndicesBufferAttribute);
  this.geometry.setDrawRange(0, strlen);

  var xOffsetsArray = [];
  var yOffsetsArray = [];
  var uvsArray = [];
  for (var i = 0; i<strlen; i++){
    xOffsetsArray.push(0);
    yOffsetsArray.push(0);
    uvsArray.push(new THREE.Vector4());
  }

  this.material = new THREE.RawShaderMaterial({
    vertexShader: this.setShaderPrecision(ShaderContent.textVertexShader.replace("#define STR_LEN 1", "#define STR_LEN "+strlen)),
    fragmentShader: this.setShaderPrecision(ShaderContent.textFragmentShader),
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      modelViewMatrix: new THREE.Uniform(new THREE.Matrix4()),
      projectionMatrix: GLOBAL_PROJECTION_UNIFORM,
      cameraQuaternion: GLOBAL_CAMERA_QUATERNION_UNIFORM,
      color: new THREE.Uniform(color),
      alpha: new THREE.Uniform(alpha),
      uvRanges: new THREE.Uniform(uvsArray),
      glyphTexture: this.getGlyphUniform(),
      xOffsets: new THREE.Uniform(xOffsetsArray),
      yOffsets: new THREE.Uniform(yOffsetsArray),
      currentViewport: GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM,
      charSize: new THREE.Uniform(this.characterSize)
    }
  });
  this.topLeft = new THREE.Vector3(0, 0, 0);
  this.bottomRight = new THREE.Vector3();
  this.bottomLeft = new THREE.Vector3();
  this.topRight = new THREE.Vector3();
  this.constructText();
  this.handleUVUniform();
  this.mesh = new THREE.Points(this.geometry, this.material);
  this.mesh.position.copy(position);
  this.mesh.frustumCulled = false;
  scene.add(this.mesh);
  this.material.uniforms.modelViewMatrix.value = this.mesh.modelViewMatrix;

  this.tmpObj = {};
  this.destroyedGrids = new Object();
  this.isClickable = false;

  this.lastUpdateQuaternion = new THREE.Quaternion().copy(camera.quaternion);
  this.lastUpdatePosition = new THREE.Vector3().copy(this.position);
  this.lastUpdateCameraPosition = new THREE.Vector3().copy(camera.position);

  this.reusableVector = new THREE.Vector3();
  this.makeFirstUpdate = true;
  this.isAffectedByFog = false;
  this.marginMode = MARGIN_MODE_2D_TEXT_TOP_LEFT;
  this.marginPercentWidth = 50;
  this.marginPercentHeight = 50;
  this.maxWidthPercent = 100;
  this.maxHeightPercent = 100;

  webglCallbackHandler.registerEngineObject(this);
}

AddedText.prototype.destroy = function(){
  for (var gridName in this.destroyedGrids){
    if (this.destroyedGrids[gridName].createdAddedTextName == this.name){
      delete this.destroyedGrids[gridName].createdAddedTextName;
    }
  }
  scene.remove(this.mesh);
  this.material.dispose();
  this.geometry.dispose();
  if (this.bbHelper){
    this.bbHelper.material.dispose();
    this.bbHelper.geometry.dispose();
  }
  if (this.rectangle){
    this.rectangle.material.dispose();
    this.rectangle.geometry.dispose();
  }
  rayCaster.refresh();
  delete addedTexts[this.name];
  if (this.is2D){
    delete addedTexts2D[this.name];
  }
}

AddedText.prototype.constructText = function(){
  var xOffset = 0;
  var yOffset = 0;
  var xOffsets = this.material.uniforms.xOffsets.value;
  var yOffsets = this.material.uniforms.yOffsets.value;
  var xMax = 0;
  var yMin = 0;
  var i = 0;
  var i2 = 0;
  while (i2 < this.text.length && i<this.strlen){
    if (this.text.charAt(i2) == "\n"){
      yOffset-= this.offsetBetweenLines;
      xOffset = 0;
    }else{
      xOffsets[i] = xOffset;
      yOffsets[i] = yOffset;
      if (xOffset > xMax){
        xMax = xOffset;
      }
      if (yOffset < yMin){
        yMin = yOffset;
      }
      xOffset += this.offsetBetweenChars;
      i ++;
    }
    i2 ++;
  }
  this.bottomRight.x = xMax;
  this.bottomRight.y = yMin;
  this.bottomRight.z = -1;
  this.bottomLeft.x = 0;
  this.bottomLeft.y = yMin;
  this.topRight.x = xMax;
  this.topRight.y = 0;

  this.xMax = xMax;
  this.yMin = yMin;

  this.twoDimensionalParameters.x = (xMax / screenResolution);
  this.twoDimensionalParameters.y = (yMin / screenResolution);
}

AddedText.prototype.exportLightweight = function(){
  var exportObj = new Object();
  exportObj.name = this.name;
  exportObj.charSize = this.characterSize;
  exportObj.topLeft = this.topLeft;
  exportObj.topRight = this.topRight;
  exportObj.bottomLeft = this.bottomLeft;
  exportObj.bottomRight = this.bottomRight;
  exportObj.position = this.mesh.position;
  exportObj.initPosition = this.position;
  exportObj.isClickable = this.isClickable;
  return exportObj;
}

AddedText.prototype.export = function(){
  var exportObj = new Object();
  exportObj.name = this.name;
  exportObj.fontName = this.font.name;
  exportObj.text = this.text;
  exportObj.positionX = this.position.x;
  exportObj.positionY = this.position.y;
  exportObj.positionZ = this.position.z;
  exportObj.colorR = this.color.r;
  exportObj.colorG = this.color.g;
  exportObj.colorB = this.color.b;
  exportObj.alpha = this.alpha;
  exportObj.charSize = this.characterSize;
  exportObj.strlen = this.strlen;
  exportObj.offsetBetweenChars = this.offsetBetweenChars;
  exportObj.offsetBetweenLines = this.offsetBetweenLines;
  exportObj.refCharSize = this.refCharSize;
  exportObj.refInnerHeight = this.refInnerHeight;
  exportObj.hasBackground = this.hasBackground;
  exportObj.refCharOffset = this.refCharOffset;
  exportObj.refLineOffset = this.refLineOffset;
  if (this.hasBackground){
    exportObj.backgroundColorR = this.material.uniforms.backgroundColor.value.r;
    exportObj.backgroundColorG = this.material.uniforms.backgroundColor.value.g;
    exportObj.backgroundColorB = this.material.uniforms.backgroundColor.value.b;
    exportObj.backgroundAlpha = this.material.uniforms.backgroundAlpha.value;
  }
  exportObj.gsName = this.gsName;
  exportObj.isClickable = this.isClickable;
  exportObj.isAffectedByFog = this.isAffectedByFog;
  exportObj.is2D = this.is2D;
  exportObj.shaderMarginX = this.shaderMargin.x;
  exportObj.shaderMarginY = this.shaderMargin.y;
  exportObj.marginMode = this.marginMode;
  exportObj.marginPercentWidth = this.marginPercentWidth;
  exportObj.marginPercentHeight = this.marginPercentHeight;
  exportObj.maxWidthPercent = this.maxWidthPercent;
  exportObj.maxHeightPercent = this.maxHeightPercent;
  var exportDestroyedGrids = new Object();
  for (var gridName in this.destroyedGrids){
    exportDestroyedGrids[gridName] = this.destroyedGrids[gridName].export();
  }
  exportObj["destroyedGrids"] = exportDestroyedGrids;
  return exportObj;
}

AddedText.prototype.getGlyphUniform = function(){
  var uuid = this.font.textureMerger.mergedTexture.uuid;
  if (textureUniformCache[uuid]){
    return textureUniformCache[uuid];
  }
  var glyphUniform = new THREE.Uniform(this.font.textureMerger.mergedTexture);
  textureUniformCache[uuid] = glyphUniform;
  return glyphUniform;
}

AddedText.prototype.handleUVUniform = function(){
  var uvRangesArray = this.material.uniforms.uvRanges.value;
  var i2 = 0;
  for (var i = 0; i<this.text.length; i++){
    var curChar = this.text.charAt(i);
    if (curChar != "\n"){
      var curRange = this.font.textureMerger.ranges[curChar];
      if (curRange){
        uvRangesArray[i2++].set(
          curRange.startU, curRange.endU, curRange.startV, curRange.endV
        );
      }else{
        uvRangesArray[i2++].set(-500, -500, -500, -500);
      }
    }
    if (i2 >= this.strlen){
      break;
    }
  }
  for (var i = i2; i<this.strlen; i++){
    uvRangesArray[i].set(-500, -500, -500, -500);
  }
}

AddedText.prototype.setMarginBetweenChars = function(value){
  this.offsetBetweenChars = value;
  this.constructText();
  if (this.is2D){
    this.refCharOffset = value;
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
  }else{
    this.handleBoundingBox();
  }
}

AddedText.prototype.setMarginBetweenLines = function(value){
  this.offsetBetweenLines = value;
  this.constructText();
  if (this.is2D){
    this.refLineOffset = value;
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
  }else{
    this.handleBoundingBox();
  }
}

AddedText.prototype.setText = function(newText, fromScript){
  if (fromScript && (typeof this.oldText == UNDEFINED)){
    this.oldText = this.text;
  }
  this.text = newText;
  this.constructText();
  this.handleUVUniform();
  if (this.is2D){
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
    this.handleResize();
  }else{
    this.handleBoundingBox();
  }
}

AddedText.prototype.setColor = function(colorString, fromScript){
  if (fromScript && (typeof this.oldColorR == UNDEFINED)){
    this.oldColorR = this.material.uniforms.color.value.r;
    this.oldColorG = this.material.uniforms.color.value.g;
    this.oldColorB = this.material.uniforms.color.value.b;
  }
  this.material.uniforms.color.value.set(colorString);
}

AddedText.prototype.setAlpha = function(alpha, fromScript){
  if (fromScript && (typeof this.oldAlpha == UNDEFINED)){
    this.oldAlpha = this.alpha;
  }
  if (alpha > 1){
    alpha = 1;
  }else if (alpha < 0){
    alpha = 0;
  }
  this.material.uniforms.alpha.value = alpha;
  this.alpha = alpha;
}

AddedText.prototype.setBackground = function(backgroundColorString, backgroundAlpha, fromScript){
  if (backgroundAlpha > 1){
    backgroundAlpha = 1;
  }else if (backgroundAlpha < 0){
    backgroundAlpha = 0;
  }
  if (fromScript && (typeof this.oldBackgroundR == UNDEFINED)){
    this.oldBackgroundR = this.material.uniforms.backgroundColor.value.r;
    this.oldBackgroundG = this.material.uniforms.backgroundColor.value.g;
    this.oldBackgroundB = this.material.uniforms.backgroundColor.value.b;
    this.oldBackgroundAlpha = this.material.uniforms.backgroundAlpha.value;
  }
  if (fromScript && (typeof this.oldBackgroundStatus == UNDEFINED)){
    this.oldBackgroundStatus = this.hasBackground ? this.hasBackground: false;
  }
  if (!this.material.uniforms.backgroundColor){
    this.injectMacro("HAS_BACKGROUND", false, true);
    this.material.uniforms.backgroundColor = new THREE.Uniform(new THREE.Color(backgroundColorString));
    this.material.uniforms.backgroundAlpha = new THREE.Uniform(backgroundAlpha);
  }else{
    this.material.uniforms.backgroundColor.value.set(backgroundColorString);
    this.material.uniforms.backgroundAlpha.value = backgroundAlpha;
  }
  if (!fromScript){
    this.hasBackground = true;
  }
}

AddedText.prototype.removeBackground = function(fromScript){
  if (fromScript && (typeof this.oldBackgroundStatus == UNDEFINED)){
    this.oldBackgroundStatus = this.material.uniforms.hasBackgroundColorFlag.value;
  }
  if (this.material.uniforms.backgroundColor){
    this.removeMacro("HAS_BACKGROUND", false, true);
    delete this.material.uniforms.backgroundColor;
    delete this.material.uniforms.backgroundAlpha;
  }
  if (!fromScript){
    this.hasBackground = false;
  }
}

AddedText.prototype.setCharSize = function(value){
  this.material.uniforms.charSize.value = value;
  this.characterSize = value;
  if (this.is2D){
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
  }else{
    this.handleBoundingBox();
  }
}

AddedText.prototype.handleResize = function(){
  this.setCharSize(this.refCharSize * ((renderer.getCurrentViewport().w / screenResolution)/this.refInnerHeight));
  if (this.is2D){
    if (typeof this.refCharOffset == UNDEFINED){
      this.refCharOffset = this.offsetBetweenChars;
    }
    if (typeof this.refLineOffset == UNDEFINED){
      this.refLineOffset = this.offsetBetweenLines;
    }
    this.offsetBetweenChars = this.refCharOffset * ((renderer.getCurrentViewport().w)/this.refInnerHeight);
    this.offsetBetweenLines = this.refLineOffset * ((renderer.getCurrentViewport().w)/this.refInnerHeight);
    if (renderer.getCurrentViewport().z / screenResolution < window.innerWidth){
       this.offsetBetweenChars = this.offsetBetweenChars * (window.innerWidth / (renderer.getCurrentViewport().z / screenResolution));
    }
    if (renderer.getCurrentViewport().w / screenResolution < window.innerHeight){
       this.offsetBetweenLines = this.offsetBetweenLines * (window.innerHeight / (renderer.getCurrentViewport().w / screenResolution));
    }
    this.constructText();
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
    if (!(typeof this.maxWidthPercent == UNDEFINED)){
      var iteration = 1;
      while (this.getWidthPercent() > this.maxWidthPercent){
        var a = this.characterSize;
        this.setCharSize((this.characterSize - 0.5));
        this.offsetBetweenChars = this.offsetBetweenChars * (this.characterSize / a);
        this.constructText();
        this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
        iteration ++;
        if (!isDeployment && textManipulationParameters){
          textManipulationParameters["Char size"] = this.characterSize;
          textManipulationParameters["Char margin"] = this.offsetBetweenChars;
        }
      }
    }
    if (!(typeof this.maxHeightPercent == UNDEFINED)){
      var iteration = 1;
      while (this.getHeightPercent() > this.maxHeightPercent){
        var a = this.characterSize;
        this.setCharSize((this.characterSize - 0.5));
        this.offsetBetweenLines = this.offsetBetweenLines * (this.characterSize / a);
        this.constructText();
        this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
        iteration ++;
        if (!isDeployment && textManipulationParameters){
          textManipulationParameters["Char size"] = this.characterSize;
          textManipulationParameters["Line margin"] = this.offsetBetweenLines;
        }
      }
    }
  }
}

AddedText.prototype.getWidthPercent = function(){
  return (((this.webglSpaceSize.x) * (100)) / (2));
}

AddedText.prototype.getHeightPercent = function(){
  return (((this.webglSpaceSize.y) * (100)) / (2));
}

AddedText.prototype.calculateCharSize = function(){
  var currentViewport = renderer.getCurrentViewport();
  REUSABLE_VECTOR.copy(this.mesh.position);
  REUSABLE_VECTOR.applyQuaternion(this.mesh.quaternion);
  REUSABLE_VECTOR.applyMatrix4(this.mesh.modelViewMatrix);
  var pointSizePixels =  500 * this.characterSize / REUSABLE_VECTOR.length();
  var verticalFOV = THREE.Math.degToRad(camera.fov);
  var height = 2 * Math.tan(verticalFOV / 2) * this.position.distanceTo(camera.position);
  var width = height * camera.aspect;
  var w = width * pointSizePixels /(currentViewport.z / screenResolution);
  var h = height * pointSizePixels / (currentViewport.w / screenResolution);
  this.tmpObj.width = w;
  this.tmpObj.height = h;
  return this.tmpObj;
}

AddedText.prototype.intersectsLine = function(line){
  if (this.plane.intersectLine(line, REUSABLE_VECTOR)){
    if (this.triangles[0].containsPoint(REUSABLE_VECTOR) || this.triangles[1].containsPoint(REUSABLE_VECTOR)){
      return REUSABLE_VECTOR;
    }
  }
  return false;
}

AddedText.prototype.getCenterCoordinates = function(){
  this.handleBoundingBox();
  this.boundingBox.getCenter(this.reusableVector);
  return this.reusableVector;
}

AddedText.prototype.handleBoundingBox = function(){
  if (this.is2D){
    return;
  }
  if (mode == 1 && !IS_WORKER_CONTEXT && rayCaster.isRaycasterWorkerBridge){
    return;
  }
  if (!this.boundingBox){
    this.boundingBox = new THREE.Box3();
    this.bbHelper = new THREE.Box3Helper(this.boundingBox);
    this.plane = new THREE.Plane();
    this.triangles = [new THREE.Triangle(), new THREE.Triangle()];
  }else{
    this.boundingBox.makeEmpty();
  }
  var cSize = this.calculateCharSize();
  REUSABLE_VECTOR.copy(this.topLeft)
  REUSABLE_VECTOR_2.copy(this.bottomRight);
  REUSABLE_VECTOR_3.copy(this.topRight);
  REUSABLE_VECTOR_4.copy(this.bottomLeft);
  REUSABLE_VECTOR.x -= cSize.width / 2;
  REUSABLE_VECTOR.y += cSize.height / 2;
  REUSABLE_VECTOR_2.x += cSize.width / 2;
  REUSABLE_VECTOR_2.y -= cSize.height / 2;
  REUSABLE_VECTOR_3.x += cSize.width / 2;
  REUSABLE_VECTOR_3.y += cSize.height / 2;
  REUSABLE_VECTOR_4.x -= cSize.width / 2;
  REUSABLE_VECTOR_4.y -= cSize.height / 2;

  REUSABLE_VECTOR.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_2.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_3.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_4.applyQuaternion(camera.quaternion);

  REUSABLE_VECTOR.add(this.mesh.position);
  REUSABLE_VECTOR_2.add(this.mesh.position);
  REUSABLE_VECTOR_3.add(this.mesh.position);
  REUSABLE_VECTOR_4.add(this.mesh.position);

  this.boundingBox.expandByPoint(REUSABLE_VECTOR);
  this.boundingBox.expandByPoint(REUSABLE_VECTOR_2);
  this.boundingBox.expandByPoint(REUSABLE_VECTOR_3);
  this.boundingBox.expandByPoint(REUSABLE_VECTOR_4);

  REUSABLE_VECTOR.copy(this.topLeft)
  REUSABLE_VECTOR_2.copy(this.bottomRight);
  REUSABLE_VECTOR_3.copy(this.topRight);
  REUSABLE_VECTOR_4.copy(this.bottomLeft);
  REUSABLE_VECTOR.z = 0, REUSABLE_VECTOR_2.z = 0, REUSABLE_VECTOR_3.z = 0, REUSABLE_VECTOR_4.z = 0;
  REUSABLE_VECTOR.x -= cSize.width / 2;
  REUSABLE_VECTOR.y += cSize.height / 2;
  REUSABLE_VECTOR_2.x += cSize.width / 2;
  REUSABLE_VECTOR_2.y -= cSize.height / 2;
  REUSABLE_VECTOR_3.x += cSize.width / 2;
  REUSABLE_VECTOR_3.y += cSize.height / 2;
  REUSABLE_VECTOR_4.x -= cSize.width / 2;
  REUSABLE_VECTOR_4.y -= cSize.height / 2;

  REUSABLE_VECTOR.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_2.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_3.applyQuaternion(camera.quaternion);
  REUSABLE_VECTOR_4.applyQuaternion(camera.quaternion);

  REUSABLE_VECTOR.add(this.mesh.position);
  REUSABLE_VECTOR_2.add(this.mesh.position);
  REUSABLE_VECTOR_3.add(this.mesh.position);
  REUSABLE_VECTOR_4.add(this.mesh.position);

  this.plane.setFromCoplanarPoints(REUSABLE_VECTOR, REUSABLE_VECTOR_2, REUSABLE_VECTOR_3);
  this.triangles[0].set(REUSABLE_VECTOR, REUSABLE_VECTOR_2, REUSABLE_VECTOR_3);
  this.triangles[1].set(REUSABLE_VECTOR, REUSABLE_VECTOR_2, REUSABLE_VECTOR_4);

  this.lastUpdateQuaternion.copy(camera.quaternion);
  this.lastUpdatePosition.copy(this.mesh.position);
  this.lastUpdateCameraPosition.copy(camera.position);
}

AddedText.prototype.needsUpdate = function(){
  if (this.makeFirstUpdate){
    this.makeFirstUpdate = false;
    return true;
  }
  return !(
    this.lastUpdateQuaternion.x == camera.quaternion.x &&
    this.lastUpdateQuaternion.y == camera.quaternion.y &&
    this.lastUpdateQuaternion.z == camera.quaternion.z &&
    this.lastUpdateQuaternion.w == camera.quaternion.w &&
    this.lastUpdatePosition.x == this.mesh.position.x &&
    this.lastUpdatePosition.y == this.mesh.position.y &&
    this.lastUpdatePosition.z == this.mesh.position.z &&
    this.lastUpdateCameraPosition.x == camera.position.x &&
    this.lastUpdateCameraPosition.y == camera.position.y &&
    this.lastUpdateCameraPosition.z == camera.position.z
  )
}

AddedText.prototype.debugTriangles = function(triangleIndex){
  this.handleBoundingBox();
  var s1 = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial({color: "red"}));
  var s2 = s1.clone(), s3 = s1.clone();
  var sCenter = new THREE.Mesh(new THREE.SphereGeometry(20), new THREE.MeshBasicMaterial({color: "lime"}));
  var triangle = this.triangles[triangleIndex];
  scene.add(s1);
  scene.add(s2);
  scene.add(s3);
  scene.add(sCenter);
  s1.position.copy(triangle.a);
  s2.position.copy(triangle.b);
  s3.position.copy(triangle.c);
  sCenter.position.copy(this.getCenterCoordinates());
}

AddedText.prototype.hide = function(){
  this.mesh.visible = false;
  if (mode == 0 && this.bbHelper){
    scene.remove(this.bbHelper);
  }
  if (mode == 0 && this.rectangle){
    scene.remove(this.rectangle.mesh);
  }
  if (mode == 1 && this.isClickable && !this.is2D){
    rayCaster.hide(this);
  }
}

AddedText.prototype.show = function(){
  this.mesh.visible = true;
  if (mode == 1 && this.isClickable){
    if (!this.boundingBox){
      this.handleBoundingBox();
    }
    if (!this.is2D){
      rayCaster.show(this);
    }
  }
}

AddedText.prototype.restore = function(){
  if (!(typeof this.oldText == UNDEFINED)){
    this.setText(this.oldText);
    delete this.oldText;
  }
  if (!(typeof this.oldColorR == UNDEFINED)){
    this.material.uniforms.color.value.setRGB(
      this.oldColorR, this.oldColorG, this.oldColorB
    );
    delete this.oldColorR;
    delete this.oldColorG;
    delete this.oldColorB;
  }
  if (!(typeof this.oldAlpha == UNDEFINED)){
    this.setAlpha(this.oldAlpha);
    delete this.oldAlpha;
  }
  if (!(typeof this.oldBackgroundStatus == UNDEFINED)){
    this.hasBackground = this.oldBackgroundStatus;
    delete this.oldBackgroundStatus;
  }
  if (!(typeof this.oldBackgroundR == UNDEFINED)){
    this.material.uniforms.backgroundColor.value.setRGB(
      this.oldBackgroundR, this.oldBackgroundG, this.oldBackgroundB
    );
    this.material.uniforms.backgroundAlpha.value = this.oldBackgroundAlpha;
    delete this.oldBackgroundR;
    delete this.oldBackgroundG;
    delete this.oldBackgroundB;
    delete this.oldBackgroundAlpha;
  }
  this.mesh.position.copy(this.position);
}

AddedText.prototype.setAffectedByFog = function(val){
  this.isAffectedByFog = val;
}

AddedText.prototype.set2DStatus = function(is2D){
  if (is2D == this.is2D){
    return;
  }
  this.is2D = is2D;
  if (is2D){
    this.injectMacro("IS_TWO_DIMENSIONAL", true, false);
    this.set2DCoordinates(this.marginPercentWidth, this.marginPercentHeight);
    if (typeof this.oldIsClickable == UNDEFINED){
      this.oldIsClickable = this.isClickable;
    }
    this.isClickable = false;
    addedTexts2D[this.name] = this;
  }else{
    this.removeMacro("IS_TWO_DIMENSIONAL", true, false);
    delete this.mesh.material.uniforms.margin2D;
    this.isClickable = this.oldIsClickable;
    delete this.oldIsClickable;
    if (!(typeof this.refCharOffset == UNDEFINED)){
      this.setMarginBetweenChars(this.refCharOffset);
      delete this.refCharOffset;
    }
    if (!(typeof this.refLineOffset == UNDEFINED)){
      this.setMarginBetweenLines(this.refLineOffset);
      delete this.refLineOffset;
    }
    delete addedTexts2D[this.name];
  }
  if (is2D){
    if (this.bbHelper){
      scene.remove(this.bbHelper);
    }
  }
  rayCaster.refresh();
}

AddedText.prototype.set2DCoordinates = function(marginPercentWidth, marginPercentHeight){
  GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.set(0, 0, window.innerWidth * screenResolution, window.innerHeight * screenResolution);
  this.marginPercentWidth = marginPercentWidth;
  this.marginPercentHeight = marginPercentHeight;
  var isFromLeft = false, isFromTop = false;
  if (this.marginMode == MARGIN_MODE_2D_TEXT_TOP_LEFT){
    isFromLeft = true;
    isFromTop = true;
  }
  var curViewport = REUSABLE_QUATERNION.set(0, 0, window.innerWidth, window.innerHeight);
  if (isFromLeft){
    var tmpX = ((curViewport.z - curViewport.x) / 2.0) + curViewport.x + this.twoDimensionalParameters.x;
    var widthX = (((tmpX - curViewport.x) * 2.0) / curViewport.z) - 1.0;
    var marginX = (((marginPercentWidth) * (2)) / (100)) -1;
    var cSizeX = (this.characterSize / (renderer.getCurrentViewport().z / screenResolution));
    this.cSizeX = cSizeX;
    marginX += cSizeX;
    if (marginX + widthX > 1){
      marginX = 1 - widthX - cSizeX;
    }
    this.setShaderMargin(true, marginX);
  }else{
    marginPercentWidth = marginPercentWidth + 100;
    var tmpX = ((curViewport.z - curViewport.x) / 2.0) + curViewport.x + this.twoDimensionalParameters.x;
    var widthX = (((tmpX - curViewport.x) * 2.0) / curViewport.z) - 1.0;
    var marginX = (((marginPercentWidth) * (2)) / (100)) -1;
    var cSizeX = (this.characterSize / (renderer.getCurrentViewport().z / screenResolution));
    this.cSizeX = cSizeX;
    marginX += cSizeX + widthX;
    marginX = 2 - marginX;
    if (marginX < -1){
      marginX = -1 + cSizeX;
    }
    this.setShaderMargin(true, marginX);
  }
  if (isFromTop){
    marginPercentHeight = 100 - marginPercentHeight;
    var tmpY = ((curViewport.w - curViewport.y) / 2.0) + curViewport.y + this.twoDimensionalParameters.y;
    var heightY = (((tmpY - curViewport.y) * 2.0) / curViewport.w) - 1.0;
    var marginY = (((marginPercentHeight) * (2)) / (100)) -1;
    var cSizeY = (this.characterSize / (renderer.getCurrentViewport().w / screenResolution));
    this.cSizeY = cSizeY;
    marginY -= cSizeY;
    if (marginY + heightY < -1){
      marginY = -1 - heightY + cSizeY;
    }
    this.setShaderMargin(false, marginY);
  }else{
    var tmpY = ((curViewport.w - curViewport.y) / 2.0) + curViewport.y + this.twoDimensionalParameters.y;
    var heightY = (((tmpY - curViewport.y) * 2.0) / curViewport.w) - 1.0;
    var marginY = (((marginPercentHeight) * (2)) / (100)) -1;
    var cSizeY = (this.characterSize / (renderer.getCurrentViewport().w / screenResolution));
    this.cSizeY = cSizeY;
    marginY -= cSizeY;
    if (marginY + heightY < -1){
      marginY = -1 - heightY + cSizeY;
    }
    this.setShaderMargin(false, marginY);
  }

  // CONVERTED FROM TEXT VERTEX SHADER CODE
  var oldPosX = ((GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.z - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x) / 2.0) + GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x + this.xMax;
  var oldPosY = ((GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.w - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y) / 2.0) + GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y + this.yMin;
  var x = (((oldPosX - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x) * 2.0) / GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.z) - 1.0;
  var y = (((oldPosY - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y) * 2.0) / GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.w) - 1.0;
  this.twoDimensionalSize.z = x + this.shaderMargin.x + this.cSizeX;
  this.twoDimensionalSize.w = y + this.shaderMargin.y - this.cSizeY;
  oldPosX = ((GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.z - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x) / 2.0) + GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x;
  oldPosY = ((GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.w - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y) / 2.0) + GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y;
  x = (((oldPosX - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.x) * 2.0) / GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.z) - 1.0;
  y = (((oldPosY - GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.y) * 2.0) / GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.w) - 1.0;
  this.twoDimensionalSize.x = x + this.shaderMargin.x - this.cSizeX;
  this.twoDimensionalSize.y = y + this.shaderMargin.y + this.cSizeY;
  this.webglSpaceSize.set(
    this.twoDimensionalSize.z - this.twoDimensionalSize.x,
    this.twoDimensionalSize.y - this.twoDimensionalSize.w
  );
  if (!this.rectangle){
    this.rectangle = new Rectangle(0, 0, 0, 0);
  }
  this.rectangle = this.rectangle.set(
    this.twoDimensionalSize.x, this.twoDimensionalSize.y,
    this.twoDimensionalSize.z, this.twoDimensionalSize.w,
    this.webglSpaceSize.x, this.webglSpaceSize.y
  );
  this.rectangle.updateMesh(0.005);
}

AddedText.prototype.debugCornerPoints = function(representativeCharacter, cornerIndex){
  this.handleResize();
  if (cornerIndex == 0){
    representativeCharacter.setShaderMargin(true, this.twoDimensionalSize.x);
    representativeCharacter.setShaderMargin(false, this.twoDimensionalSize.y);
  }else{
    representativeCharacter.setShaderMargin(true, this.twoDimensionalSize.z);
    representativeCharacter.setShaderMargin(false, this.twoDimensionalSize.w);
  }
}

AddedText.prototype.injectMacro = function(macro, insertVertexShader, insertFragmentShader){
  if (insertVertexShader){
    this.material.vertexShader = this.material.vertexShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  if (insertFragmentShader){
    this.material.fragmentShader = this.material.fragmentShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  this.material.needsUpdate = true;
}

AddedText.prototype.removeMacro = function(macro, removeVertexShader, removeFragmentShader){
  if (removeVertexShader){
    this.material.vertexShader = this.material.vertexShader.replace("\n#define "+macro, "");
  }
  if (removeFragmentShader){
    this.material.fragmentShader = this.material.fragmentShader.replace("\n#define "+macro, "");
  }
  this.material.needsUpdate = true;
}

AddedText.prototype.setShaderMargin = function(isMarginX, value){
  if (!this.mesh.material.uniforms.margin2D){
    this.mesh.material.uniforms.margin2D = new THREE.Uniform(new THREE.Vector2());
    this.mesh.material.needsUpdate = true;
  }
  if (isMarginX){
    this.shaderMargin.x = value;
    this.mesh.material.uniforms.margin2D.value.x = value;
  }else{
    this.shaderMargin.y = value;
    this.mesh.material.uniforms.margin2D.value.y = value;
  }
}

AddedText.prototype.setFog = function(){
  if (this.is2D || !this.isAffectedByFog){
    return;
  }
  if (!this.mesh.material.uniforms.fogInfo){
    this.injectMacro("HAS_FOG", false, true);
    this.mesh.material.uniforms.fogInfo = GLOBAL_FOG_UNIFORM;
  }
  if (fogBlendWithSkybox){
    if (!this.mesh.material.uniforms.cubeTexture){
      this.injectMacro("HAS_SKYBOX_FOG", true, true);
      this.mesh.material.uniforms.worldMatrix = new THREE.Uniform(this.mesh.matrixWorld);
      this.mesh.material.uniforms.cubeTexture = GLOBAL_CUBE_TEXTURE_UNIFORM;
      this.mesh.material.uniforms.cameraPosition = GLOBAL_CAMERA_POSITION_UNIFORM;
    }
  }
  this.mesh.material.needsUpdate = true;
}

AddedText.prototype.removeFog = function(){
  if (this.is2D || !this.isAffectedByFog){
    return;
  }
  this.removeMacro("HAS_FOG", false, true);
  this.removeMacro("HAS_SKYBOX_FOG", true, true);
  delete this.mesh.material.uniforms.fogInfo;
  delete this.mesh.material.uniforms.cubeTexture;
  delete this.mesh.material.uniforms.worldMatrix;
  delete this.mesh.material.uniforms.cameraPosition;
  this.mesh.material.needsUpdate = true;
}

AddedText.prototype.setShaderPrecision = function(shaderCode){
  if (isMobile && HIGH_PRECISION_SUPPORTED){
    return shaderCode.replace("precision lowp float;", "precision highp float;").replace("precision lowp int;", "precision highp int;");
  }
  return shaderCode;
}
