var TexturePack = function(name, directoryName, fileExtension, mapCallback, isPreLoaded, refTexturePack, scaleFactor, refTexturePackName){
  this.directoryName = directoryName;
  this.name = name;


  if (!DDS_SUPPORTED){
    if (fileExtension.toUpperCase() == "DDS"){
      fileExtension = compressedTextureFallbackFormat.replace(".", "");
    }
  }

  this.fileExtension = fileExtension;

  this.scaleFactor = scaleFactor;
  this.refTexturePackName = refTexturePackName;

  this.maxAttemptCount = 5;
  this.totalLoadedCount = 0;

  this.hasDiffuse = false;
  this.hasAlpha = false;
  this.hasAO = false;
  this.hasEmissive = false;
  this.hasHeight = false;

  if (isPreLoaded){
    this.isPreLoaded = isPreLoaded;
  }

  this.diffuseFilePath = texturePackRootDirectory+directoryName+"/"+"diffuse."+fileExtension.toLowerCase();
  this.alphaFilePath = texturePackRootDirectory+directoryName+"/"+"alpha."+fileExtension.toLowerCase();
  this.aoFilePath = texturePackRootDirectory+directoryName+"/"+"ao."+fileExtension.toLowerCase();
  this.emissiveFilePath = texturePackRootDirectory+directoryName+"/"+"emissive."+fileExtension.toLowerCase();
  this.heightFilePath = texturePackRootDirectory+directoryName+"/"+"height."+fileExtension.toLowerCase();

  if (fileExtension.toUpperCase() == "DDS"){
    this.loader = ddsLoader;
  }else if (fileExtension.toUpperCase() == "TGA"){
    this.loader = tgaLoader;
  }else{
    this.loader = textureLoader;
  }

  this.diffuseCanMapFlag = false;
  this.alphaCanMapFlag = false;
  this.aoCanMapFlag = false;
  this.emissiveCanMapFlag = false;
  this.heightCanMapFlag = false;

  if (mapCallback){
    this.mapCallback = mapCallback;
  }

  if (!refTexturePack){
    this.loadTextures();
  }else{
    if (refTexturePack.hasDiffuse){
      this.diffuseTexture = refTexturePack.diffuseTexture.clone();
      this.hasDiffuse = true;
    }
    if (refTexturePack.hasAlpha){
      this.alphaTexture = refTexturePack.alphaTexture.clone();
      this.hasAlpha = true;
    }
    if (refTexturePack.hasAO){
      this.aoTexture = refTexturePack.aoTexture.clone();
      this.hasAO = true;
    }
    if (refTexturePack.hasEmissive){
      this.emissiveTexture = refTexturePack.emissiveTexture.clone();
      this.hasEmissive = true;
    }
    if (refTexturePack.hasHeight){
      this.heightTexture = refTexturePack.heightTexture.clone();
      this.hasHeight = true;
    }
  }

}

TexturePack.prototype.export = function(){
  var exportObject = new Object();
  exportObject.directoryName = this.directoryName;
  exportObject.name = this.name;
  exportObject.fileExtension = this.fileExtension;
  exportObject.hasDiffuse = this.hasDiffuse;
  exportObject.hasAlpha = this.hasAlpha;
  exportObject.hasAO = this.hasAO;
  exportObject.hasEmissive = this.hasEmissive;
  exportObject.hasHeight = this.hasHeight;
  exportObject.diffuseFilePath = this.diffuseFilePath;
  exportObject.alphaFilePath = this.alphaFilePath;
  exportObject.aoFilePath = this.aoFilePath;
  exportObject.emissiveFilePath = this.emissiveFilePath;
  exportObject.heightFilePath = this.heightFilePath;
  if (this.scaleFactor){
    exportObject.scaleFactor = this.scaleFactor;
  }
  if (this.refTexturePackName){
    exportObject.refTexturePackName = this.refTexturePackName;
  }
  return exportObject;
}

TexturePack.prototype.destroy = function(){
  for (var addedObjectName in addedObjects){
    var addedObject = addedObjects[addedObjectName];
    if (addedObject.associatedTexturePack == name){
      addedObject.resetAssociatedTexturePack();
    }
  }
  if (this.hasDiffuse){
    this.diffuseTexture.dispose();
  }
  if (this.hasAlpha){
    this.alphaTexture.dispose();
  }
  if (this.hasAO){
    this.aoTexture.dispose();
  }
  if (this.hasEmissive){
    this.emissiveTexture.dispose();
  }
  if (this.hasHeight){
    this.heightTexture.dispose();
  }
  delete texturePacks[this.name];
}

TexturePack.prototype.readyCallback = function(){
  this.totalLoadedCount ++;
  if (this.maxAttemptCount == this.totalLoadedCount && this.mapCallback){
    this.mapCallback();
  }
}

TexturePack.prototype.mapDiffuse = function (that, textureData){
  that.diffuseTexture = textureData;
  diffuseTextureCache[that.name] = textureData;
  that.diffuseTexture.wrapS = THREE.RepeatWrapping;
  that.diffuseTexture.wrapT = THREE.RepeatWrapping;
  that.hasDiffuse = true;
  that.diffuseCanMapFlag = true;
  that.refreshMap();
}

TexturePack.prototype.mapHeight = function (that, textureData){
  that.heightTexture = textureData;
  heightTextureCache[that.name] = textureData;
  that.heightTexture.wrapS = THREE.RepeatWrapping;
  that.heightTexture.wrapT = THREE.RepeatWrapping;
  that.hasHeight = true;
  that.heightCanMapFlag = true;
  that.refreshMap();
}

TexturePack.prototype.mapAmbientOcculsion = function(that, textureData){
  that.aoTexture = textureData;
  that.aoTexture.wrapS = THREE.RepeatWrapping;
  that.aoTexture.wrapT = THREE.RepeatWrapping;
  that.hasAO = true;
  that.aoCanMapFlag = true;
  that.refreshMap();
}

TexturePack.prototype.mapAlpha = function(that, textureData){
  that.alphaTexture = textureData;
  that.alphaTexture.wrapS = THREE.RepeatWrapping;
  that.alphaTexture.wrapT = THREE.RepeatWrapping;
  that.hasAlpha = true;
  that.alphaCanMapFlag = true;
  that.refreshMap();
}

TexturePack.prototype.mapEmissive = function(that, textureData){
  that.emissiveTexture = textureData;
  that.emissiveTexture.wrapS = THREE.RepeatWrapping;
  that.emissiveTexture.wrapT = THREE.RepeatWrapping;
  that.hasEmissive = true;
  that.emissiveCanMapFlag = true;
  that.refreshMap();
}

TexturePack.prototype.loadTextures = function(){

  var that = this;

  //DIFFUSE
  var diffuseTextureCached = diffuseTextureCache[this.name];
  if (!diffuseTextureCached || (diffuseTextureCached && diffuseTextureCached == CACHE_NOT_PRESENT)){
    this.loader.load(this.diffuseFilePath,
      function(textureData){
        if (that.scaleFactor){
          textureData.image = that.rescaleTextureImage(textureData, that.scaleFactor);
        }
        that.mapDiffuse(that, textureData);
      },
      function(xhr){

      },
      function(xhr){
        diffuseTextureCache[that.name] = CACHE_NOT_PRESENT;
        that.hasDiffuse = false;
        that.diffuseCanMapFlag = true;
        that.refreshMap();
      }
    );
  }else{
    if (diffuseTextureCached != CACHE_NOT_PRESENT){
      texturePacks[this.name] = this;
      this.mapDiffuse(this, diffuseTextureCached);
    }
  }
  //ALPHA
  var alphaTextureCached = alphaTextureCache[this.name];
  if (!alphaTextureCached || (alphaTextureCached && alphaTextureCached == CACHE_NOT_PRESENT)){
    this.loader.load(this.alphaFilePath,
      function(textureData){
        if (that.scaleFactor){
          textureData.image = that.rescaleTextureImage(textureData, that.scaleFactor);
        }
        that.mapAlpha(that, textureData);
      },
      function(xhr){

      },
      function(xhr){
        alphaTextureCache[that.name] = CACHE_NOT_PRESENT;
        that.hasAlpha = false;
        that.alphaCanMapFlag = true;
        that.refreshMap();
      }
    );
  }else{
    if (alphaTextureCached != CACHE_NOT_PRESENT){
      this.mapAlpha(this, alphaTextureCached);
      texturePacks[this.name] = this;
    }
  }
  //AO
  var ambientOcculsionTextureCached = ambientOcculsionTextureCache[this.name];
  if (!ambientOcculsionTextureCached || (ambientOcculsionTextureCached && ambientOcculsionTextureCached == CACHE_NOT_PRESENT)){
    this.loader.load(this.aoFilePath,
      function(textureData){
        if (that.scaleFactor){
          textureData.image = that.rescaleTextureImage(textureData, that.scaleFactor);
        }
        that.mapAmbientOcculsion(that, textureData);
      },
      function(xhr){

      },
      function(xhr){
        ambientOcculsionTextureCache[that.name] = CACHE_NOT_PRESENT;
        that.hasAo = false;
        that.aoCanMapFlag = true;
        that.refreshMap();
      }
    );
  }else{
    if (ambientOcculsionTextureCached != CACHE_NOT_PRESENT){
      this.mapAmbientOcculsion(this, ambientOcculsionTextureCached);
      texturePacks[this.name] = this;
    }
  }
  //EMISSIVE
  var emissiveTextureCached = emissiveTextureCache[this.name];
  if (!emissiveTextureCached || (emissiveTextureCached && emissiveTextureCached == CACHE_NOT_PRESENT)){
    this.loader.load(this.emissiveFilePath,
      function(textureData){
        if (that.scaleFactor){
          textureData.image = that.rescaleTextureImage(textureData, that.scaleFactor);
        }
        that.mapEmissive(that, textureData);
      },
      function(xhr){

      },
      function(xhr){
        emissiveTextureCache[that.name] = CACHE_NOT_PRESENT;
        that.hasEmissive = false;
        that.emissiveCanMapFlag = true;
        that.refreshMap();
      }
    );
  }else{
    if (emissiveTextureCached != CACHE_NOT_PRESENT){
      this.mapEmissive(this, emissiveTextureCached);
      texturePacks[this.name] = this;
    }
  }
  //HEIGHT
  var heightTextureCached = heightTextureCache[this.name];
  if (!heightTextureCached || (heightTextureCached && heightTextureCached == CACHE_NOT_PRESENT)){
    this.loader.load(this.heightFilePath,
      function(textureData){
        if (that.scaleFactor){
          textureData.image = that.rescaleTextureImage(textureData, that.scaleFactor);
        }
        that.mapHeight(that, textureData);
      },
      function(xhr){

      },
      function(xhr){
        heightTextureCache[that.name] = CACHE_NOT_PRESENT;
        that.hasHeight = false;
        that.heightCanMapFlag = true;
        that.refreshMap();
      }
    );
  }else{
      if (heightTextureCached != CACHE_NOT_PRESENT){
        this.mapHeight(this, heightTextureCached);
        texturePacks[this.name] = this;
      }
  }

}

TexturePack.prototype.printInfo = function(){
  var diffuseSizeText = "";
  var alphaSizeText = "";
  var ambientOcculsionSizeText = "";
  var emissiveSizeText = "";
  var heightSizeText = "";
  if (this.hasDiffuse){
    var img = this.diffuseTexture.image;
    diffuseSizeText = " ["+img.width+"x"+img.height+"]";
  }
  if (this.hasAlpha){
    var img = this.alphaTexture.image;
    alphaSizeText = " ["+img.width+"x"+img.height+"]";  }
  if (this.hasAO){
    var img = this.aoTexture.image;
    ambientOcculsionSizeText = " ["+img.width+"x"+img.height+"]";
  }
  if (this.hasEmissive){
    var img = this.emissiveTexture.image;
    emissiveSizeText = " ["+img.width+"x"+img.height+"]";
  }
  if (this.hasHeight){
    var img = this.heightTexture.image;
    heightSizeText = " ["+img.width+"x"+img.height+"]";
  }
  terminal.printHeader(Text.TEXTUREPACK_INFO_HEADER, true);
  terminal.printInfo(Text.TEXTUREPACK_NAME.replace(
    Text.PARAM1, this.name
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_DIRNAME.replace(
    Text.PARAM1, this.directoryName
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_FILEEXTENSION.replace(
    Text.PARAM1, this.fileExtension
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_FILEPATHS, true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_DIFFUSE.replace(
    Text.PARAM1, this.diffuseFilePath
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_ALPHA.replace(
    Text.PARAM1, this.alphaFilePath
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_AO.replace(
    Text.PARAM1, this.aoFilePath
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_EMISSIVE.replace(
    Text.PARAM1, this.emissiveFilePath
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_HEIGHT.replace(
    Text.PARAM1, this.heightFilePath
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_TEXTURES, true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_DIFFUSE.replace(
    Text.PARAM1, this.hasDiffuse + diffuseSizeText
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_ALPHA.replace(
    Text.PARAM1, this.hasAlpha + alphaSizeText
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_AO.replace(
    Text.PARAM1, this.hasAO + ambientOcculsionSizeText
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_EMISSIVE.replace(
    Text.PARAM1, this.hasEmissive + emissiveSizeText
  ), true);
  terminal.printInfo(Text.TEXTUREPACK_INFO_TREE_HEIGHT.replace(
    Text.PARAM1, this.hasHeight + heightSizeText
  ), false);
}

TexturePack.prototype.isUsable = function(){
  return (
    this.hasDiffuse ||
    this.hasAlpha ||
    this.hasAO ||
    this.hasEmissive ||
    this.hasHeight
  );
}

TexturePack.prototype.refresh = function(){
  delete diffuseTextureCache[this.name];
  delete heightTextureCache[this.name];
  delete ambientOcculsionTextureCache[this.name];
  delete alphaTextureCache[this.name];
  delete emissiveTextureCache[this.name];
  this.loadTextures();
}

TexturePack.prototype.refreshMap = function(){
  if (!this.isPreLoaded){
    for (var addedObjectName in addedObjects){
      var addedObject = addedObjects[addedObjectName];
      if (addedObject.associatedTexturePack == this.name){
        addedObject.mapTexturePack(this);
      }
    }
  }
  this.readyCallback();
}

TexturePack.prototype.rescaleTextureImage = function(texture, scale){
  var tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = texture.image.width * scale;
  tmpCanvas.height = texture.image.height * scale;
  tmpCanvas.getContext("2d").drawImage(texture.image, 0, 0, texture.image.width, texture.image.height, 0, 0, tmpCanvas.width, tmpCanvas.height);
  return tmpCanvas;
}

TexturePack.prototype.rescale = function(scale){
  if (this.hasDiffuse){
    this.diffuseTexture.image = this.rescaleTextureImage(this.diffuseTexture, scale);
    this.diffuseTexture.needsUpdate = true;
  }
  if (this.hasAlpha){
    this.alphaTexture.image = this.rescaleTextureImage(this.alphaTexture, scale);
    this.alphaTexture.needsUpdate = true;
  }
  if (this.hasAO){
    this.aoTexture.image = this.rescaleTextureImage(this.aoTexture, scale);
    this.aoTexture.needsUpdate = true;
  }
  if (this.hasEmissive){
    this.emissiveTexture.image = this.rescaleTextureImage(this.emissiveTexture, scale);
    this.emissiveTexture.needsUpdate = true;
  }
  if (this.hasHeight){
    this.heightTexture.image = this.rescaleTextureImage(this.heightTexture, scale);
    this.heightTexture.needsUpdate = true;
  }
  this.scaleFactor = scale;
}
