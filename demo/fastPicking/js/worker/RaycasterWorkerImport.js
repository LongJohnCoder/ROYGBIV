var RayCaster = function(){
  this.binHandler = new WorldBinHandler();
  this.origin = new THREE.Vector3();
  this.direction = new THREE.Vector3();
  this.oldPosition = new THREE.Vector3();
  this.updateBuffer = new Map();
  this.ready = false;
}

RayCaster.prototype.onReady = function(){
  this.ready = true;
  if (this.onReadyCallback){
    this.onReadyCallback();
  }
}

RayCaster.prototype.flush = function(){
}

RayCaster.prototype.refresh = function(){
  if (!projectLoaded){
    return;
  }
  this.ready = false;
  this.binHandler = new WorldBinHandler();
  for (var objName in addedObjects){
    var addedObject = addedObjects[objName];
    if (mode == 1 && !addedObject.isIntersectable){
      continue;
    }
    if (!addedObject.boundingBoxes){
      addedObject.generateBoundingBoxes();
    }
    this.binHandler.insert(addedObject.boundingBoxes[0], objName);
  }
  for (var objName in objectGroups){
    var objectGroup = objectGroups[objName];
    if (mode == 1 && !objectGroup.isIntersectable){
      continue;
    }
    if (!objectGroup.boundingBoxes){
      objectGroup.generateBoundingBoxes();
    }
    for (var i = 0; i<objectGroup.boundingBoxes.length; i++){
      this.binHandler.insert(objectGroup.boundingBoxes[i], objectGroup.boundingBoxes[i].roygbivObjectName, objName);
    }
  }
  if (mode == 0){
    for (var gsName in gridSystems){
      var gridSystem = gridSystems[gsName];
      this.binHandler.insert(gridSystem.boundingBox, gridSystem.name);
    }
    for (var txtName in addedTexts){
      var addedText = addedTexts[txtName];
      if (!addedText.is2D){
        this.binHandler.insert(addedText.boundingBox, txtName);
      }
    }
  }else{
    for (var txtName in addedTexts){
      var addedText = addedTexts[txtName];
      if (addedText.isClickable && !addedText.is2D){
        this.binHandler.insert(addedText.boundingBox, txtName);
      }
    }
  }
  this.onReady();
}

RayCaster.prototype.updateObject = function(obj, forceUpdate){
  if (forceUpdate){
    this.binHandler.updateObject(obj);
    return;
  }
  this.updateBuffer.set(obj.name, obj);
}

RayCaster.prototype.onBeforeUpdate = function(){

}

RayCaster.prototype.issueUpdate = function(obj){
  if (!(mode == 1 && (obj.isAddedObject || obj.isObjectGroup) && !obj.isIntersectable)){
    rayCaster.binHandler.updateObject(obj);
  }
}

RayCaster.prototype.findIntersections = function(from, direction, intersectGridSystems, callbackFunction){
  intersectionPoint = 0, intersectionObject = 0;
  this.origin.copy(from);
  this.direction.copy(direction);
  this.oldPosition.copy(this.origin);
  var iterate = true;
  while (iterate){
    REUSABLE_LINE.set(this.oldPosition, this.origin);
    var results = this.binHandler.query(this.origin);
    for (var objName in results){
      var result = results[objName];
      if (result == 5){
        var obj = addedObjects[objName];
        if (obj){
          if (!(mode == 0 && keyboardBuffer["Shift"])){
            intersectionPoint = obj.intersectsLine(REUSABLE_LINE);
            if (intersectionPoint){
              intersectionObject = objName;
              callbackFunction(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z, intersectionObject);
              return;
            }
          }
        }
      }else if (result == 10){
        var gs = gridSystems[objName];
        if (gs && intersectGridSystems){
          intersectionPoint = gs.intersectsLine(REUSABLE_LINE);
          if (intersectionPoint){
            intersectionObject = objName;
            callbackFunction(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z, intersectionObject);
            return;
          }
        }
      }else if (result == 20){
        var addedText = addedTexts[objName];
        if (addedText && addedText.plane){
          intersectionPoint = addedText.intersectsLine(REUSABLE_LINE);
          if (intersectionPoint){
            intersectionObject = objName;
            callbackFunction(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z, intersectionObject);
            return;
          }
        }
      }else{
        if (!(mode == 0 && keyboardBuffer["Shift"])){
          var parent = objectGroups[objName];
          if (parent){
            for (var childName in result){
              var obj = parent.group[childName];
              if (obj){
                if (!(mode == 0 && keyboardBuffer["Shift"])){
                  intersectionPoint = obj.intersectsLine(REUSABLE_LINE);
                  if (intersectionPoint){
                    intersectionObject = objName;
                    callbackFunction(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z, intersectionObject);
                    return;
                  }
                }
              }
            }
          }
        }
      }
    }
    this.oldPosition.copy(this.origin);
    this.origin.addScaledVector(this.direction, RAYCASTER_STEP_AMOUNT);
    iterate = LIMIT_BOUNDING_BOX.containsPoint(this.origin);
  }
  callbackFunction(0, 0, 0, null);
}

RayCaster.prototype.hide = function(object){
  this.binHandler.hide(object);
}

RayCaster.prototype.show = function(object){
  this.binHandler.show(object);
}

RayCaster.prototype.query = function(point){
  this.binHandler.query(point);
}
var WorldBinHandler = function(){
  this.bin = new Map();
}

WorldBinHandler.prototype.deleteObjectFromBin = function(binInfo, objName){
  for (var x of binInfo.keys()){
    for (var y of binInfo.get(x).keys()){
      for (var z of binInfo.get(x).get(y).keys()){
        if (this.bin.has(x) && this.bin.get(x).has(y) && this.bin.get(x).get(y).has(z)){
          this.bin.get(x).get(y).get(z).delete(objName);
          if (this.bin.get(x).get(y).get(z).size == 0){
            this.bin.get(x).get(y).delete(z);
          }
          if (this.bin.get(x).get(y).size == 0){
            this.bin.get(x).delete(y);
          }
          if (this.bin.get(x).size == 0){
            this.bin.delete(x);
          }
        }
      }
    }
  }
  for (var x of binInfo.keys()){
    binInfo.delete(x);
  }
}

WorldBinHandler.prototype.updateObject = function(obj){
  if (obj.isAddedObject){
    this.deleteObjectFromBin(obj.binInfo, obj.name);
    obj.mesh.updateMatrixWorld();
    obj.updateBoundingBoxes();
    for (var i = 0; i<obj.boundingBoxes.length; i++){
      this.insert(obj.boundingBoxes[i], obj.name);
    }
  }else if (obj.isObjectGroup){
    this.deleteObjectFromBin(obj.binInfo, obj.name);
    if (!obj.boundingBoxes){
      obj.generateBoundingBoxes();
    }
    obj.graphicsGroup.updateMatrixWorld();
    obj.updateBoundingBoxes();
    for (var i = 0; i<obj.boundingBoxes.length; i++){
      this.insert(obj.boundingBoxes[i], obj.boundingBoxes[i].roygbivObjectName, obj.name);
    }
  }else if (obj.isAddedText){
    this.deleteObjectFromBin(obj.binInfo, obj.name);
    if (!obj.boundingBox){
      obj.handleBoundingBox();
    }
    this.insert(obj.boundingBox, obj.name);
  }
}

WorldBinHandler.prototype.show = function(obj){
  if (obj.isAddedObject){
    if (mode == 1 && !obj.isIntersectable){
      return;
    }
    for (var i = 0; i<obj.boundingBoxes.length; i++){
      this.insert(obj.boundingBoxes[i], obj.name);
    }
  }else if (obj.isObjectGroup){
    if (mode == 1 && !obj.isIntersectable){
      return;
    }
    for (var i = 0; i<obj.boundingBoxes.length; i++){
      this.insert(obj.boundingBoxes[i], obj.boundingBoxes[i].roygbivObjectName, obj.name);
    }
  }else if (obj.isAddedText){
    this.insert(obj.boundingBox, obj.name);
  }
}

WorldBinHandler.prototype.hide = function(obj){
  if (mode == 1 && (obj.isAddedObject || obj.isObjectGroup) && !obj.isIntersectable){
    return;
  }
  this.deleteObjectFromBin(obj.binInfo, obj.name);
}

WorldBinHandler.prototype.visualize = function(selectedScene, customBin){
  if (customBin){
    this.bin = customBin;
  }
  for (var minX of this.bin.keys()){
    for (var minY of this.bin.get(minX).keys()){
      for (var minZ of this.bin.get(minX).get(minY).keys()){
        for (var objName of this.bin.get(minX).get(minY).get(minZ)){
          var minX = parseInt(minX);
          var minY = parseInt(minY);
          var minZ = parseInt(minZ);
          var bb = new THREE.Box3(
            new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(minX+BIN_SIZE, minY+BIN_SIZE, minZ+BIN_SIZE)
          );
          if (!this.visualObjects){
            this.visualObjects = [];
          }
          var b3h = new THREE.Box3Helper(bb, new THREE.Color("lime"));
          selectedScene.add(b3h);
          this.visualObjects.push(b3h);
        }
      }
    }
  }
}

WorldBinHandler.prototype.queryArea = function(point){
  var x = point.x;
  var y = point.y;
  var z = point.z;
  var rX = Math.round(x / BIN_SIZE) * BIN_SIZE;
  var rY = Math.round(y / BIN_SIZE) * BIN_SIZE;
  var rZ = Math.round(z / BIN_SIZE) * BIN_SIZE;
  var minX, maxX;
  if (rX <= x){
    minX = rX;
    maxX = rX + BIN_SIZE;
  }else{
    maxX = rX;
    minX = rX - BIN_SIZE;
  }
  var minY, maxY;
  if (rY <= y){
    minY = rY;
    maxY = rY + BIN_SIZE;
  }else{
    maxY = rY;
    minY = rY - BIN_SIZE;
  }
  var minZ, maxZ;
  if (rZ <= z){
    minZ = rZ;
    maxZ = rZ + BIN_SIZE;
  }else{
    maxZ = rZ;
    minZ = rZ - BIN_SIZE;
  }
  if (this.bin.has(minX) && this.bin.get(minX).has(minY)){
    var res = this.bin.get(minX).get(minY).get(minZ);
    if (res){
      for (var areaName of res.keys()){
        var area = areas[areaName];
        if (area.boundingBox.containsPoint(point)){
          return areaName;
        }
      }
    }
  }
}

WorldBinHandler.prototype.query = function(point){
  var x = point.x;
  var y = point.y;
  var z = point.z;
  var rX = Math.round(x / BIN_SIZE) * BIN_SIZE;
  var rY = Math.round(y / BIN_SIZE) * BIN_SIZE;
  var rZ = Math.round(z / BIN_SIZE) * BIN_SIZE;

  var minX, maxX;
  if (rX <= x){
    minX = rX;
    maxX = rX + BIN_SIZE;
  }else{
    maxX = rX;
    minX = rX - BIN_SIZE;
  }
  var minY, maxY;
  if (rY <= y){
    minY = rY;
    maxY = rY + BIN_SIZE;
  }else{
    maxY = rY;
    minY = rY - BIN_SIZE;
  }
  var minZ, maxZ;
  if (rZ <= z){
    minZ = rZ;
    maxZ = rZ + BIN_SIZE;
  }else{
    maxZ = rZ;
    minZ = rZ - BIN_SIZE;
  }

  var results = new Object();

  for (var xDiff = -BIN_SIZE; xDiff <= BIN_SIZE; xDiff += BIN_SIZE){
    for (var yDiff = -BIN_SIZE; yDiff <= BIN_SIZE; yDiff += BIN_SIZE){
      for (var zDiff = -BIN_SIZE; zDiff <= BIN_SIZE; zDiff += BIN_SIZE){
        var keyX = (minX + xDiff);
        var keyY = (minY + yDiff);
        var keyZ = (minZ + zDiff);
        if (this.bin.has(keyX) && this.bin.get(keyX).has(keyY)){
          var res = this.bin.get(keyX).get(keyY).get(keyZ);
          if (res){
            for (var objName of res.keys()){
              if (addedObjects[objName]){
                results[objName] = 5;
              }else if (objectGroups[objName]){
                if (!results[objName]){
                  results[objName] = new Object();
                }
                for (var childObjName of res.get(objName).keys()){
                  results[objName][childObjName] = 5;
                }
              }else if (gridSystems[objName]){
                results[objName] = 10;
              }else if (addedTexts[objName]){
                results[objName] = 20;
              }
            }
          }
        }
      }
    }
  }
  return results;
}

WorldBinHandler.prototype.insert = function(boundingBox, objName, parentName){
  if (!LIMIT_BOUNDING_BOX.containsBox(boundingBox)){
    return;
  }
  var minX = boundingBox.min.x;
  var minY = boundingBox.min.y;
  var minZ = boundingBox.min.z;
  var maxX = boundingBox.max.x;
  var maxY = boundingBox.max.y;
  var maxZ = boundingBox.max.z;

  var round = Math.round(minX / BIN_SIZE) * BIN_SIZE;
  var minXLower, minXUpper;
  if (round <= minX){
    minXLower = round;
    minXUpper = minXLower + BIN_SIZE;
  }else{
    minXUpper = round;
    minXLower = round - BIN_SIZE;
  }

  round = Math.round(maxX / BIN_SIZE) * BIN_SIZE;
  var maxXLower, maxXUpper;
  if (round < maxX){
    maxXLower = round;
    maxXUpper = maxXLower + BIN_SIZE;
  }else{
    maxXUpper = round;
    maxXLower = round - BIN_SIZE;
  }
  if (minXLower > maxXLower){
    maxXLower = minXLower;
  }

  round = Math.round(minY/BIN_SIZE) * BIN_SIZE;
  var minYLower, minYUpper;
  if (round <= minY){
    minYLower = round;
    minYUpper = minYLower + BIN_SIZE;
  }else{
    minYUpper = round;
    minYLower = round - BIN_SIZE;
  }

  round = Math.round(maxY/BIN_SIZE) * BIN_SIZE;
  var maxYLower, maxYUpper;
  if (round < maxY){
    maxYLower = round;
    maxYUpper = maxYLower + BIN_SIZE;
  }else{
    maxYUpper = round;
    maxYLower = round - BIN_SIZE;
  }
  if (minYLower > maxYLower){
    maxYLower = minYLower;
  }

  round = Math.round(minZ/BIN_SIZE) * BIN_SIZE;
  var minZLower, minZUpper;
  if (round <= minZ){
    minZLower = round;
    minZUpper = minZLower + BIN_SIZE;
  }else{
    minZUpper = round;
    minZLower = round - BIN_SIZE;
  }

  round = Math.round(maxZ/BIN_SIZE) * BIN_SIZE;
  var maxZLower, maxZUpper;
  if (round < maxZ){
    maxZLower = round;
    maxZUpper = maxZLower + BIN_SIZE;
  }else{
    maxZUpper = round;
    maxZLower = round - BIN_SIZE;
  }
  if (minZLower > maxZLower){
    maxZLower = minZLower;
  }


  for (var x = minXLower; x<= maxXLower; x+= BIN_SIZE){
    for (var y = minYLower; y<= maxYLower; y+= BIN_SIZE){
      for (var z = minZLower; z <= maxZLower; z+= BIN_SIZE){
        if (!this.bin.has(x)){
          this.bin.set(x, new Map());
        }
        if (!this.bin.get(x).has(y)){
          this.bin.get(x).set(y, new Map());
        }
        if (!this.bin.get(x).get(y).has(z)){
          this.bin.get(x).get(y).set(z, new Map());
        }
        if (!parentName){
          this.bin.get(x).get(y).get(z).set(objName, true);
        }else{
          var newMap = new Map();
          newMap.set(objName, true);
          this.bin.get(x).get(y).get(z).set(parentName, newMap);
        }
        var obj;
        if (!this.isAreaBinHandler){
          obj = addedObjects[objName];
          if (!obj){
            obj = objectGroups[parentName];
          }
          if (!obj){
            obj = addedTexts[objName];
          }
        }else{
          obj = areas[objName];
        }
        if (obj){
          if (!obj.binInfo){
            obj.binInfo = new Map();
          }
          if (!obj.binInfo.has(x)){
            obj.binInfo.set(x, new Map());
          }
          if (!obj.binInfo.get(x).has(y)){
            obj.binInfo.get(x).set(y, new Map());
          }
          obj.binInfo.get(x).get(y).set(z, true);
        }
      }
    }
  }

}
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t(e.THREE={})}(this,function(e){"use strict";function t(){}void 0===Number.EPSILON&&(Number.EPSILON=Math.pow(2,-52)),void 0===Number.isInteger&&(Number.isInteger=function(e){return"number"==typeof e&&isFinite(e)&&Math.floor(e)===e}),void 0===Math.sign&&(Math.sign=function(e){return e<0?-1:0<e?1:+e}),"name"in Function.prototype==!1&&Object.defineProperty(Function.prototype,"name",{get:function(){return this.toString().match(/^\s*function\s*([^\(\s]*)/)[1]}}),void 0===Object.assign&&(Object.assign=function(e){if(null==e)throw new TypeError("Cannot convert undefined or null to object");for(var t=Object(e),i=1;i<arguments.length;i++){var n=arguments[i];if(null!=n)for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t}),Object.assign(t.prototype,{addEventListener:function(e,t){void 0===this._listeners&&(this._listeners={});var i=this._listeners;void 0===i[e]&&(i[e]=[]),-1===i[e].indexOf(t)&&i[e].push(t)},hasEventListener:function(e,t){if(void 0===this._listeners)return!1;var i=this._listeners;return void 0!==i[e]&&-1!==i[e].indexOf(t)},removeEventListener:function(e,t){if(void 0!==this._listeners){var i=this._listeners[e];if(void 0!==i){var n=i.indexOf(t);-1!==n&&i.splice(n,1)}}},dispatchEvent:function(e){if(void 0!==this._listeners){var t=this._listeners[e.type];if(void 0!==t){e.target=this;for(var i=t.slice(0),n=0,r=i.length;n<r;n++)i[n].call(this,e)}}}});var i,n,l,u,r,a,o,s,c,h,d,p,f,m,g,v,y,x,w,b,j=0,W=1,X=2,D=1,F=2,B=0,Ae=1,Z=2,Le=0,_=2,q=0,Y=1,J=2,Q=3,K=4,$=5,M=100,E=101,T=102,S=103,A=104,L=200,R=201,C=202,P=203,O=204,I=205,N=206,U=207,H=208,z=209,G=210,ee=0,te=1,ie=2,ne=3,re=4,ae=5,oe=6,se=7,k=0,V=1,ce=2,he=0,Re=1,le=2,ue=3,de=4,pe=301,fe=302,me=303,ge=304,ve=305,ye=306,xe=307,we=1e3,be=1001,_e=1002,Me=1003,Ee=1004,Te=1005,Se=1006,Ce=1007,Pe=1008,Oe=1009,Ie=1010,Ne=1011,Be=1012,Ue=1013,De=1014,Fe=1015,He=1016,ze=1017,Ge=1018,ke=1019,Ve=1020,je=1021,We=1022,Xe=1023,qe=1024,Ye=1025,Ze=Xe,Je=1026,Qe=1027,Ke=33776,$e=33777,et=33778,tt=33779,it=35840,nt=35841,rt=35842,at=35843,ot=36196,st=37808,ct=37809,ht=37810,lt=37811,ut=37812,dt=37813,pt=37814,ft=37815,mt=37816,gt=37817,vt=37818,yt=37819,xt=37820,wt=37821,bt=2300,_t=2301,Mt=2400,Et=2401,Tt=2402,St=0,At=3e3,Lt=3001,Rt=3007,Ct=3002,Pt=3004,Ot=3005,It=3006,Nt=3200,Bt=3201,Ut={DEG2RAD:Math.PI/180,RAD2DEG:180/Math.PI,generateUUID:function(){for(var r=[],e=0;e<256;e++)r[e]=(e<16?"0":"")+e.toString(16);return function(){var e=4294967295*Math.random()|0,t=4294967295*Math.random()|0,i=4294967295*Math.random()|0,n=4294967295*Math.random()|0;return(r[255&e]+r[e>>8&255]+r[e>>16&255]+r[e>>24&255]+"-"+r[255&t]+r[t>>8&255]+"-"+r[t>>16&15|64]+r[t>>24&255]+"-"+r[63&i|128]+r[i>>8&255]+"-"+r[i>>16&255]+r[i>>24&255]+r[255&n]+r[n>>8&255]+r[n>>16&255]+r[n>>24&255]).toUpperCase()}}(),clamp:function(e,t,i){return Math.max(t,Math.min(i,e))},euclideanModulo:function(e,t){return(e%t+t)%t},mapLinear:function(e,t,i,n,r){return n+(e-t)*(r-n)/(i-t)},lerp:function(e,t,i){return(1-i)*e+i*t},smoothstep:function(e,t,i){return e<=t?0:i<=e?1:(e=(e-t)/(i-t))*e*(3-2*e)},smootherstep:function(e,t,i){return e<=t?0:i<=e?1:(e=(e-t)/(i-t))*e*e*(e*(6*e-15)+10)},randInt:function(e,t){return e+Math.floor(Math.random()*(t-e+1))},randFloat:function(e,t){return e+Math.random()*(t-e)},randFloatSpread:function(e){return e*(.5-Math.random())},degToRad:function(e){return e*Ut.DEG2RAD},radToDeg:function(e){return e*Ut.RAD2DEG},isPowerOfTwo:function(e){return 0==(e&e-1)&&0!==e},ceilPowerOfTwo:function(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))},floorPowerOfTwo:function(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}};function Dt(e,t){this.x=e||0,this.y=t||0}function Ft(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],0<arguments.length&&console.error("THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.")}function Ht(e,t,i,n){this._x=e||0,this._y=t||0,this._z=i||0,this._w=void 0!==n?n:1}function zt(e,t,i){this.x=e||0,this.y=t||0,this.z=i||0}function Gt(){this.elements=[1,0,0,0,1,0,0,0,1],0<arguments.length&&console.error("THREE.Matrix3: the constructor no longer reads arguments. use .set() instead.")}Object.defineProperties(Dt.prototype,{width:{get:function(){return this.x},set:function(e){this.x=e}},height:{get:function(){return this.y},set:function(e){this.y=e}}}),Object.assign(Dt.prototype,{isVector2:!0,set:function(e,t){return this.x=e,this.y=t,this},setScalar:function(e){return this.x=e,this.y=e,this},setX:function(e){return this.x=e,this},setY:function(e){return this.y=e,this},setComponent:function(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this},getComponent:function(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}},clone:function(){return new this.constructor(this.x,this.y)},copy:function(e){return this.x=e.x,this.y=e.y,this},add:function(e,t){return void 0!==t?(console.warn("THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this)},addScalar:function(e){return this.x+=e,this.y+=e,this},addVectors:function(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this},addScaledVector:function(e,t){return this.x+=e.x*t,this.y+=e.y*t,this},sub:function(e,t){return void 0!==t?(console.warn("THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this)},subScalar:function(e){return this.x-=e,this.y-=e,this},subVectors:function(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this},multiply:function(e){return this.x*=e.x,this.y*=e.y,this},multiplyScalar:function(e){return this.x*=e,this.y*=e,this},divide:function(e){return this.x/=e.x,this.y/=e.y,this},divideScalar:function(e){return this.multiplyScalar(1/e)},applyMatrix3:function(e){var t=this.x,i=this.y,n=e.elements;return this.x=n[0]*t+n[3]*i+n[6],this.y=n[1]*t+n[4]*i+n[7],this},min:function(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this},max:function(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this},clamp:function(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this},clampScalar:(i=new Dt,n=new Dt,function(e,t){return i.set(e,e),n.set(t,t),this.clamp(i,n)}),clampLength:function(e,t){var i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))},floor:function(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this},ceil:function(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this},round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this},roundToZero:function(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this},negate:function(){return this.x=-this.x,this.y=-this.y,this},dot:function(e){return this.x*e.x+this.y*e.y},lengthSq:function(){return this.x*this.x+this.y*this.y},length:function(){return Math.sqrt(this.x*this.x+this.y*this.y)},manhattanLength:function(){return Math.abs(this.x)+Math.abs(this.y)},normalize:function(){return this.divideScalar(this.length()||1)},angle:function(){var e=Math.atan2(this.y,this.x);return e<0&&(e+=2*Math.PI),e},distanceTo:function(e){return Math.sqrt(this.distanceToSquared(e))},distanceToSquared:function(e){var t=this.x-e.x,i=this.y-e.y;return t*t+i*i},manhattanDistanceTo:function(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)},setLength:function(e){return this.normalize().multiplyScalar(e)},lerp:function(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this},lerpVectors:function(e,t,i){return this.subVectors(t,e).multiplyScalar(i).add(e)},equals:function(e){return e.x===this.x&&e.y===this.y},fromArray:function(e,t){return void 0===t&&(t=0),this.x=e[t],this.y=e[t+1],this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this.x,e[t+1]=this.y,e},fromBufferAttribute:function(e,t,i){return void 0!==i&&console.warn("THREE.Vector2: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this},rotateAround:function(e,t){var i=Math.cos(t),n=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*i-a*n+e.x,this.y=r*n+a*i+e.y,this}}),Object.assign(Ft.prototype,{isMatrix4:!0,set:function(e,t,i,n,r,a,o,s,c,h,l,u,d,p,f,m){var g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=n,g[1]=r,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=h,g[10]=l,g[14]=u,g[3]=d,g[7]=p,g[11]=f,g[15]=m,this},identity:function(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this},clone:function(){return(new Ft).fromArray(this.elements)},copy:function(e){var t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this},copyPosition:function(e){var t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this},extractBasis:function(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this},makeBasis:function(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this},extractRotation:(c=new zt,function(e){var t=this.elements,i=e.elements,n=1/c.setFromMatrixColumn(e,0).length(),r=1/c.setFromMatrixColumn(e,1).length(),a=1/c.setFromMatrixColumn(e,2).length();return t[0]=i[0]*n,t[1]=i[1]*n,t[2]=i[2]*n,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,this}),makeRotationFromEuler:function(e){e&&e.isEuler||console.error("THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.");var t=this.elements,i=e.x,n=e.y,r=e.z,a=Math.cos(i),o=Math.sin(i),s=Math.cos(n),c=Math.sin(n),h=Math.cos(r),l=Math.sin(r);if("XYZ"===e.order){var u=a*h,d=a*l,p=o*h,f=o*l;t[0]=s*h,t[4]=-s*l,t[8]=c,t[1]=d+p*c,t[5]=u-f*c,t[9]=-o*s,t[2]=f-u*c,t[6]=p+d*c,t[10]=a*s}else if("YXZ"===e.order){var m=s*h,g=s*l,v=c*h,y=c*l;t[0]=m+y*o,t[4]=v*o-g,t[8]=a*c,t[1]=a*l,t[5]=a*h,t[9]=-o,t[2]=g*o-v,t[6]=y+m*o,t[10]=a*s}else if("ZXY"===e.order){m=s*h,g=s*l,v=c*h,y=c*l;t[0]=m-y*o,t[4]=-a*l,t[8]=v+g*o,t[1]=g+v*o,t[5]=a*h,t[9]=y-m*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if("ZYX"===e.order){u=a*h,d=a*l,p=o*h,f=o*l;t[0]=s*h,t[4]=p*c-d,t[8]=u*c+f,t[1]=s*l,t[5]=f*c+u,t[9]=d*c-p,t[2]=-c,t[6]=o*s,t[10]=a*s}else if("YZX"===e.order){var x=a*s,w=a*c,b=o*s,_=o*c;t[0]=s*h,t[4]=_-x*l,t[8]=b*l+w,t[1]=l,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=w*l+b,t[10]=x-_*l}else if("XZY"===e.order){x=a*s,w=a*c,b=o*s,_=o*c;t[0]=s*h,t[4]=-l,t[8]=c*h,t[1]=x*l+_,t[5]=a*h,t[9]=w*l-b,t[2]=b*l-w,t[6]=o*h,t[10]=_*l+x}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this},makeRotationFromQuaternion:function(e){var t=this.elements,i=e._x,n=e._y,r=e._z,a=e._w,o=i+i,s=n+n,c=r+r,h=i*o,l=i*s,u=i*c,d=n*s,p=n*c,f=r*c,m=a*o,g=a*s,v=a*c;return t[0]=1-(d+f),t[4]=l-v,t[8]=u+g,t[1]=l+v,t[5]=1-(h+f),t[9]=p-m,t[2]=u-g,t[6]=p+m,t[10]=1-(h+d),t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this},lookAt:(a=new zt,o=new zt,s=new zt,function(e,t,i){var n=this.elements;return s.subVectors(e,t),0===s.lengthSq()&&(s.z=1),s.normalize(),a.crossVectors(i,s),0===a.lengthSq()&&(1===Math.abs(i.z)?s.x+=1e-4:s.z+=1e-4,s.normalize(),a.crossVectors(i,s)),a.normalize(),o.crossVectors(s,a),n[0]=a.x,n[4]=o.x,n[8]=s.x,n[1]=a.y,n[5]=o.y,n[9]=s.y,n[2]=a.z,n[6]=o.z,n[10]=s.z,this}),multiply:function(e,t){return void 0!==t?(console.warn("THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead."),this.multiplyMatrices(e,t)):this.multiplyMatrices(this,e)},premultiply:function(e){return this.multiplyMatrices(e,this)},multiplyMatrices:function(e,t){var i=e.elements,n=t.elements,r=this.elements,a=i[0],o=i[4],s=i[8],c=i[12],h=i[1],l=i[5],u=i[9],d=i[13],p=i[2],f=i[6],m=i[10],g=i[14],v=i[3],y=i[7],x=i[11],w=i[15],b=n[0],_=n[4],M=n[8],E=n[12],T=n[1],S=n[5],A=n[9],L=n[13],R=n[2],C=n[6],P=n[10],O=n[14],I=n[3],N=n[7],B=n[11],U=n[15];return r[0]=a*b+o*T+s*R+c*I,r[4]=a*_+o*S+s*C+c*N,r[8]=a*M+o*A+s*P+c*B,r[12]=a*E+o*L+s*O+c*U,r[1]=h*b+l*T+u*R+d*I,r[5]=h*_+l*S+u*C+d*N,r[9]=h*M+l*A+u*P+d*B,r[13]=h*E+l*L+u*O+d*U,r[2]=p*b+f*T+m*R+g*I,r[6]=p*_+f*S+m*C+g*N,r[10]=p*M+f*A+m*P+g*B,r[14]=p*E+f*L+m*O+g*U,r[3]=v*b+y*T+x*R+w*I,r[7]=v*_+y*S+x*C+w*N,r[11]=v*M+y*A+x*P+w*B,r[15]=v*E+y*L+x*O+w*U,this},multiplyScalar:function(e){var t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this},applyToBufferAttribute:(r=new zt,function(e){for(var t=0,i=e.count;t<i;t++)r.x=e.getX(t),r.y=e.getY(t),r.z=e.getZ(t),r.applyMatrix4(this),e.setXYZ(t,r.x,r.y,r.z);return e}),determinant:function(){var e=this.elements,t=e[0],i=e[4],n=e[8],r=e[12],a=e[1],o=e[5],s=e[9],c=e[13],h=e[2],l=e[6],u=e[10],d=e[14];return e[3]*(+r*s*l-n*c*l-r*o*u+i*c*u+n*o*d-i*s*d)+e[7]*(+t*s*d-t*c*u+r*a*u-n*a*d+n*c*h-r*s*h)+e[11]*(+t*c*l-t*o*d-r*a*l+i*a*d+r*o*h-i*c*h)+e[15]*(-n*o*h-t*s*l+t*o*u+n*a*l-i*a*u+i*s*h)},transpose:function(){var e,t=this.elements;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this},setPosition:function(e){var t=this.elements;return t[12]=e.x,t[13]=e.y,t[14]=e.z,this},getInverse:function(e,t){var i=this.elements,n=e.elements,r=n[0],a=n[1],o=n[2],s=n[3],c=n[4],h=n[5],l=n[6],u=n[7],d=n[8],p=n[9],f=n[10],m=n[11],g=n[12],v=n[13],y=n[14],x=n[15],w=p*y*u-v*f*u+v*l*m-h*y*m-p*l*x+h*f*x,b=g*f*u-d*y*u-g*l*m+c*y*m+d*l*x-c*f*x,_=d*v*u-g*p*u+g*h*m-c*v*m-d*h*x+c*p*x,M=g*p*l-d*v*l-g*h*f+c*v*f+d*h*y-c*p*y,E=r*w+a*b+o*_+s*M;if(0===E){var T="THREE.Matrix4: .getInverse() can't invert matrix, determinant is 0";if(!0===t)throw new Error(T);return console.warn(T),this.identity()}var S=1/E;return i[0]=w*S,i[1]=(v*f*s-p*y*s-v*o*m+a*y*m+p*o*x-a*f*x)*S,i[2]=(h*y*s-v*l*s+v*o*u-a*y*u-h*o*x+a*l*x)*S,i[3]=(p*l*s-h*f*s-p*o*u+a*f*u+h*o*m-a*l*m)*S,i[4]=b*S,i[5]=(d*y*s-g*f*s+g*o*m-r*y*m-d*o*x+r*f*x)*S,i[6]=(g*l*s-c*y*s-g*o*u+r*y*u+c*o*x-r*l*x)*S,i[7]=(c*f*s-d*l*s+d*o*u-r*f*u-c*o*m+r*l*m)*S,i[8]=_*S,i[9]=(g*p*s-d*v*s-g*a*m+r*v*m+d*a*x-r*p*x)*S,i[10]=(c*v*s-g*h*s+g*a*u-r*v*u-c*a*x+r*h*x)*S,i[11]=(d*h*s-c*p*s-d*a*u+r*p*u+c*a*m-r*h*m)*S,i[12]=M*S,i[13]=(d*v*o-g*p*o+g*a*f-r*v*f-d*a*y+r*p*y)*S,i[14]=(g*h*o-c*v*o-g*a*l+r*v*l+c*a*y-r*h*y)*S,i[15]=(c*p*o-d*h*o+d*a*l-r*p*l-c*a*f+r*h*f)*S,this},scale:function(e){var t=this.elements,i=e.x,n=e.y,r=e.z;return t[0]*=i,t[4]*=n,t[8]*=r,t[1]*=i,t[5]*=n,t[9]*=r,t[2]*=i,t[6]*=n,t[10]*=r,t[3]*=i,t[7]*=n,t[11]*=r,this},getMaxScaleOnAxis:function(){var e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],n=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,n))},makeTranslation:function(e,t,i){return this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this},makeRotationX:function(e){var t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this},makeRotationY:function(e){var t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this},makeRotationZ:function(e){var t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this},makeRotationAxis:function(e,t){var i=Math.cos(t),n=Math.sin(t),r=1-i,a=e.x,o=e.y,s=e.z,c=r*a,h=r*o;return this.set(c*a+i,c*o-n*s,c*s+n*o,0,c*o+n*s,h*o+i,h*s-n*a,0,c*s-n*o,h*s+n*a,r*s*s+i,0,0,0,0,1),this},makeScale:function(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this},makeShear:function(e,t,i){return this.set(1,t,i,0,e,1,i,0,e,t,1,0,0,0,0,1),this},compose:function(e,t,i){return this.makeRotationFromQuaternion(t),this.scale(i),this.setPosition(e),this},decompose:(l=new zt,u=new Ft,function(e,t,i){var n=this.elements,r=l.set(n[0],n[1],n[2]).length(),a=l.set(n[4],n[5],n[6]).length(),o=l.set(n[8],n[9],n[10]).length();this.determinant()<0&&(r=-r),e.x=n[12],e.y=n[13],e.z=n[14],u.copy(this);var s=1/r,c=1/a,h=1/o;return u.elements[0]*=s,u.elements[1]*=s,u.elements[2]*=s,u.elements[4]*=c,u.elements[5]*=c,u.elements[6]*=c,u.elements[8]*=h,u.elements[9]*=h,u.elements[10]*=h,t.setFromRotationMatrix(u),i.x=r,i.y=a,i.z=o,this}),makePerspective:function(e,t,i,n,r,a){void 0===a&&console.warn("THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.");var o=this.elements,s=2*r/(t-e),c=2*r/(i-n),h=(t+e)/(t-e),l=(i+n)/(i-n),u=-(a+r)/(a-r),d=-2*a*r/(a-r);return o[0]=s,o[4]=0,o[8]=h,o[12]=0,o[1]=0,o[5]=c,o[9]=l,o[13]=0,o[2]=0,o[6]=0,o[10]=u,o[14]=d,o[3]=0,o[7]=0,o[11]=-1,o[15]=0,this},makeOrthographic:function(e,t,i,n,r,a){var o=this.elements,s=1/(t-e),c=1/(i-n),h=1/(a-r),l=(t+e)*s,u=(i+n)*c,d=(a+r)*h;return o[0]=2*s,o[4]=0,o[8]=0,o[12]=-l,o[1]=0,o[5]=2*c,o[9]=0,o[13]=-u,o[2]=0,o[6]=0,o[10]=-2*h,o[14]=-d,o[3]=0,o[7]=0,o[11]=0,o[15]=1,this},equals:function(e){for(var t=this.elements,i=e.elements,n=0;n<16;n++)if(t[n]!==i[n])return!1;return!0},fromArray:function(e,t){void 0===t&&(t=0);for(var i=0;i<16;i++)this.elements[i]=e[i+t];return this},toArray:function(e,t){void 0===e&&(e=[]),void 0===t&&(t=0);var i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}),Object.assign(Ht,{slerp:function(e,t,i,n){return i.copy(e).slerp(t,n)},slerpFlat:function(e,t,i,n,r,a,o){var s=i[n+0],c=i[n+1],h=i[n+2],l=i[n+3],u=r[a+0],d=r[a+1],p=r[a+2],f=r[a+3];if(l!==f||s!==u||c!==d||h!==p){var m=1-o,g=s*u+c*d+h*p+l*f,v=0<=g?1:-1,y=1-g*g;if(y>Number.EPSILON){var x=Math.sqrt(y),w=Math.atan2(x,g*v);m=Math.sin(m*w)/x,o=Math.sin(o*w)/x}var b=o*v;if(s=s*m+u*b,c=c*m+d*b,h=h*m+p*b,l=l*m+f*b,m===1-o){var _=1/Math.sqrt(s*s+c*c+h*h+l*l);s*=_,c*=_,h*=_,l*=_}}e[t]=s,e[t+1]=c,e[t+2]=h,e[t+3]=l}}),Object.defineProperties(Ht.prototype,{x:{get:function(){return this._x},set:function(e){this._x=e,this.onChangeCallback()}},y:{get:function(){return this._y},set:function(e){this._y=e,this.onChangeCallback()}},z:{get:function(){return this._z},set:function(e){this._z=e,this.onChangeCallback()}},w:{get:function(){return this._w},set:function(e){this._w=e,this.onChangeCallback()}}}),Object.assign(Ht.prototype,{set:function(e,t,i,n){return this._x=e,this._y=t,this._z=i,this._w=n,this.onChangeCallback(),this},clone:function(){return new this.constructor(this._x,this._y,this._z,this._w)},copy:function(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this.onChangeCallback(),this},setFromEuler:function(e,t){if(!e||!e.isEuler)throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");var i=e._x,n=e._y,r=e._z,a=e.order,o=Math.cos,s=Math.sin,c=o(i/2),h=o(n/2),l=o(r/2),u=s(i/2),d=s(n/2),p=s(r/2);return"XYZ"===a?(this._x=u*h*l+c*d*p,this._y=c*d*l-u*h*p,this._z=c*h*p+u*d*l,this._w=c*h*l-u*d*p):"YXZ"===a?(this._x=u*h*l+c*d*p,this._y=c*d*l-u*h*p,this._z=c*h*p-u*d*l,this._w=c*h*l+u*d*p):"ZXY"===a?(this._x=u*h*l-c*d*p,this._y=c*d*l+u*h*p,this._z=c*h*p+u*d*l,this._w=c*h*l-u*d*p):"ZYX"===a?(this._x=u*h*l-c*d*p,this._y=c*d*l+u*h*p,this._z=c*h*p-u*d*l,this._w=c*h*l+u*d*p):"YZX"===a?(this._x=u*h*l+c*d*p,this._y=c*d*l+u*h*p,this._z=c*h*p-u*d*l,this._w=c*h*l-u*d*p):"XZY"===a&&(this._x=u*h*l-c*d*p,this._y=c*d*l-u*h*p,this._z=c*h*p+u*d*l,this._w=c*h*l+u*d*p),!1!==t&&this.onChangeCallback(),this},setFromAxisAngle:function(e,t){var i=t/2,n=Math.sin(i);return this._x=e.x*n,this._y=e.y*n,this._z=e.z*n,this._w=Math.cos(i),this.onChangeCallback(),this},setFromRotationMatrix:function(e){var t,i=e.elements,n=i[0],r=i[4],a=i[8],o=i[1],s=i[5],c=i[9],h=i[2],l=i[6],u=i[10],d=n+s+u;return 0<d?(t=.5/Math.sqrt(d+1),this._w=.25/t,this._x=(l-c)*t,this._y=(a-h)*t,this._z=(o-r)*t):s<n&&u<n?(t=2*Math.sqrt(1+n-s-u),this._w=(l-c)/t,this._x=.25*t,this._y=(r+o)/t,this._z=(a+h)/t):u<s?(t=2*Math.sqrt(1+s-n-u),this._w=(a-h)/t,this._x=(r+o)/t,this._y=.25*t,this._z=(c+l)/t):(t=2*Math.sqrt(1+u-n-s),this._w=(o-r)/t,this._x=(a+h)/t,this._y=(c+l)/t,this._z=.25*t),this.onChangeCallback(),this},setFromUnitVectors:(d=new zt,function(e,t){return void 0===d&&(d=new zt),(h=e.dot(t)+1)<1e-6?(h=0,Math.abs(e.x)>Math.abs(e.z)?d.set(-e.y,e.x,0):d.set(0,-e.z,e.y)):d.crossVectors(e,t),this._x=d.x,this._y=d.y,this._z=d.z,this._w=h,this.normalize()}),inverse:function(){return this.conjugate()},conjugate:function(){return this._x*=-1,this._y*=-1,this._z*=-1,this.onChangeCallback(),this},dot:function(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w},lengthSq:function(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w},length:function(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)},normalize:function(){var e=this.length();return 0===e?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this.onChangeCallback(),this},multiply:function(e,t){return void 0!==t?(console.warn("THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead."),this.multiplyQuaternions(e,t)):this.multiplyQuaternions(this,e)},premultiply:function(e){return this.multiplyQuaternions(e,this)},multiplyQuaternions:function(e,t){var i=e._x,n=e._y,r=e._z,a=e._w,o=t._x,s=t._y,c=t._z,h=t._w;return this._x=i*h+a*o+n*c-r*s,this._y=n*h+a*s+r*o-i*c,this._z=r*h+a*c+i*s-n*o,this._w=a*h-i*o-n*s-r*c,this.onChangeCallback(),this},slerp:function(e,t){if(0===t)return this;if(1===t)return this.copy(e);var i=this._x,n=this._y,r=this._z,a=this._w,o=a*e._w+i*e._x+n*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),1<=o)return this._w=a,this._x=i,this._y=n,this._z=r,this;var s=Math.sqrt(1-o*o);if(Math.abs(s)<.001)return this._w=.5*(a+this._w),this._x=.5*(i+this._x),this._y=.5*(n+this._y),this._z=.5*(r+this._z),this;var c=Math.atan2(s,o),h=Math.sin((1-t)*c)/s,l=Math.sin(t*c)/s;return this._w=a*h+this._w*l,this._x=i*h+this._x*l,this._y=n*h+this._y*l,this._z=r*h+this._z*l,this.onChangeCallback(),this},equals:function(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w},fromArray:function(e,t){return void 0===t&&(t=0),this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this.onChangeCallback(),this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e},onChange:function(e){return this.onChangeCallback=e,this},onChangeCallback:function(){}}),Object.assign(zt.prototype,{isVector3:!0,set:function(e,t,i){return this.x=e,this.y=t,this.z=i,this},setScalar:function(e){return this.x=e,this.y=e,this.z=e,this},setX:function(e){return this.x=e,this},setY:function(e){return this.y=e,this},setZ:function(e){return this.z=e,this},setComponent:function(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this},getComponent:function(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}},clone:function(){return new this.constructor(this.x,this.y,this.z)},copy:function(e){return this.x=e.x,this.y=e.y,this.z=e.z,this},add:function(e,t){return void 0!==t?(console.warn("THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this)},addScalar:function(e){return this.x+=e,this.y+=e,this.z+=e,this},addVectors:function(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this},addScaledVector:function(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this},sub:function(e,t){return void 0!==t?(console.warn("THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this)},subScalar:function(e){return this.x-=e,this.y-=e,this.z-=e,this},subVectors:function(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this},multiply:function(e,t){return void 0!==t?(console.warn("THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead."),this.multiplyVectors(e,t)):(this.x*=e.x,this.y*=e.y,this.z*=e.z,this)},multiplyScalar:function(e){return this.x*=e,this.y*=e,this.z*=e,this},multiplyVectors:function(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this},applyEuler:(w=new Ht,function(e){return e&&e.isEuler||console.error("THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order."),this.applyQuaternion(w.setFromEuler(e))}),applyAxisAngle:(x=new Ht,function(e,t){return this.applyQuaternion(x.setFromAxisAngle(e,t))}),applyMatrix3:function(e){var t=this.x,i=this.y,n=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*n,this.y=r[1]*t+r[4]*i+r[7]*n,this.z=r[2]*t+r[5]*i+r[8]*n,this},applyMatrix4:function(e){var t=this.x,i=this.y,n=this.z,r=e.elements,a=1/(r[3]*t+r[7]*i+r[11]*n+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*n+r[12])*a,this.y=(r[1]*t+r[5]*i+r[9]*n+r[13])*a,this.z=(r[2]*t+r[6]*i+r[10]*n+r[14])*a,this},applyQuaternion:function(e){var t=this.x,i=this.y,n=this.z,r=e.x,a=e.y,o=e.z,s=e.w,c=s*t+a*n-o*i,h=s*i+o*t-r*n,l=s*n+r*i-a*t,u=-r*t-a*i-o*n;return this.x=c*s+u*-r+h*-o-l*-a,this.y=h*s+u*-a+l*-r-c*-o,this.z=l*s+u*-o+c*-a-h*-r,this},project:(y=new Ft,function(e){return y.multiplyMatrices(e.projectionMatrix,y.getInverse(e.matrixWorld)),this.applyMatrix4(y)}),unproject:(v=new Ft,function(e){return v.multiplyMatrices(e.matrixWorld,v.getInverse(e.projectionMatrix)),this.applyMatrix4(v)}),transformDirection:function(e){var t=this.x,i=this.y,n=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*n,this.y=r[1]*t+r[5]*i+r[9]*n,this.z=r[2]*t+r[6]*i+r[10]*n,this.normalize()},divide:function(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this},divideScalar:function(e){return this.multiplyScalar(1/e)},min:function(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this},max:function(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this},clamp:function(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this},clampScalar:(m=new zt,g=new zt,function(e,t){return m.set(e,e,e),g.set(t,t,t),this.clamp(m,g)}),clampLength:function(e,t){var i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))},floor:function(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this},ceil:function(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this},round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this},roundToZero:function(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this},negate:function(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this},dot:function(e){return this.x*e.x+this.y*e.y+this.z*e.z},lengthSq:function(){return this.x*this.x+this.y*this.y+this.z*this.z},length:function(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)},manhattanLength:function(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)},normalize:function(){return this.divideScalar(this.length()||1)},setLength:function(e){return this.normalize().multiplyScalar(e)},lerp:function(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this},lerpVectors:function(e,t,i){return this.subVectors(t,e).multiplyScalar(i).add(e)},cross:function(e,t){return void 0!==t?(console.warn("THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead."),this.crossVectors(e,t)):this.crossVectors(this,e)},crossVectors:function(e,t){var i=e.x,n=e.y,r=e.z,a=t.x,o=t.y,s=t.z;return this.x=n*s-r*o,this.y=r*a-i*s,this.z=i*o-n*a,this},projectOnVector:function(e){var t=e.dot(this)/e.lengthSq();return this.copy(e).multiplyScalar(t)},projectOnPlane:(f=new zt,function(e){return f.copy(this).projectOnVector(e),this.sub(f)}),reflect:(p=new zt,function(e){return this.sub(p.copy(e).multiplyScalar(2*this.dot(e)))}),angleTo:function(e){var t=this.dot(e)/Math.sqrt(this.lengthSq()*e.lengthSq());return Math.acos(Ut.clamp(t,-1,1))},distanceTo:function(e){return Math.sqrt(this.distanceToSquared(e))},distanceToSquared:function(e){var t=this.x-e.x,i=this.y-e.y,n=this.z-e.z;return t*t+i*i+n*n},manhattanDistanceTo:function(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)},setFromSpherical:function(e){var t=Math.sin(e.phi)*e.radius;return this.x=t*Math.sin(e.theta),this.y=Math.cos(e.phi)*e.radius,this.z=t*Math.cos(e.theta),this},setFromCylindrical:function(e){return this.x=e.radius*Math.sin(e.theta),this.y=e.y,this.z=e.radius*Math.cos(e.theta),this},setFromMatrixPosition:function(e){var t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this},setFromMatrixScale:function(e){var t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),n=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=n,this},setFromMatrixColumn:function(e,t){return this.fromArray(e.elements,4*t)},equals:function(e){return e.x===this.x&&e.y===this.y&&e.z===this.z},fromArray:function(e,t){return void 0===t&&(t=0),this.x=e[t],this.y=e[t+1],this.z=e[t+2],this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e},fromBufferAttribute:function(e,t,i){return void 0!==i&&console.warn("THREE.Vector3: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}}),Object.assign(Gt.prototype,{isMatrix3:!0,set:function(e,t,i,n,r,a,o,s,c){var h=this.elements;return h[0]=e,h[1]=n,h[2]=o,h[3]=t,h[4]=r,h[5]=s,h[6]=i,h[7]=a,h[8]=c,this},identity:function(){return this.set(1,0,0,0,1,0,0,0,1),this},clone:function(){return(new this.constructor).fromArray(this.elements)},copy:function(e){var t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this},setFromMatrix4:function(e){var t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this},applyToBufferAttribute:(b=new zt,function(e){for(var t=0,i=e.count;t<i;t++)b.x=e.getX(t),b.y=e.getY(t),b.z=e.getZ(t),b.applyMatrix3(this),e.setXYZ(t,b.x,b.y,b.z);return e}),multiply:function(e){return this.multiplyMatrices(this,e)},premultiply:function(e){return this.multiplyMatrices(e,this)},multiplyMatrices:function(e,t){var i=e.elements,n=t.elements,r=this.elements,a=i[0],o=i[3],s=i[6],c=i[1],h=i[4],l=i[7],u=i[2],d=i[5],p=i[8],f=n[0],m=n[3],g=n[6],v=n[1],y=n[4],x=n[7],w=n[2],b=n[5],_=n[8];return r[0]=a*f+o*v+s*w,r[3]=a*m+o*y+s*b,r[6]=a*g+o*x+s*_,r[1]=c*f+h*v+l*w,r[4]=c*m+h*y+l*b,r[7]=c*g+h*x+l*_,r[2]=u*f+d*v+p*w,r[5]=u*m+d*y+p*b,r[8]=u*g+d*x+p*_,this},multiplyScalar:function(e){var t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this},determinant:function(){var e=this.elements,t=e[0],i=e[1],n=e[2],r=e[3],a=e[4],o=e[5],s=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-i*r*h+i*o*s+n*r*c-n*a*s},getInverse:function(e,t){e&&e.isMatrix4&&console.error("THREE.Matrix3: .getInverse() no longer takes a Matrix4 argument.");var i=e.elements,n=this.elements,r=i[0],a=i[1],o=i[2],s=i[3],c=i[4],h=i[5],l=i[6],u=i[7],d=i[8],p=d*c-h*u,f=h*l-d*s,m=u*s-c*l,g=r*p+a*f+o*m;if(0===g){var v="THREE.Matrix3: .getInverse() can't invert matrix, determinant is 0";if(!0===t)throw new Error(v);return console.warn(v),this.identity()}var y=1/g;return n[0]=p*y,n[1]=(o*u-d*a)*y,n[2]=(h*a-o*c)*y,n[3]=f*y,n[4]=(d*r-o*l)*y,n[5]=(o*s-h*r)*y,n[6]=m*y,n[7]=(a*l-u*r)*y,n[8]=(c*r-a*s)*y,this},transpose:function(){var e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this},getNormalMatrix:function(e){return this.setFromMatrix4(e).getInverse(this).transpose()},transposeIntoArray:function(e){var t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this},setUvTransform:function(e,t,i,n,r,a,o){var s=Math.cos(r),c=Math.sin(r);this.set(i*s,i*c,-i*(s*a+c*o)+a+e,-n*c,n*s,-n*(-c*a+s*o)+o+t,0,0,1)},scale:function(e,t){var i=this.elements;return i[0]*=e,i[3]*=e,i[6]*=e,i[1]*=t,i[4]*=t,i[7]*=t,this},rotate:function(e){var t=Math.cos(e),i=Math.sin(e),n=this.elements,r=n[0],a=n[3],o=n[6],s=n[1],c=n[4],h=n[7];return n[0]=t*r+i*s,n[3]=t*a+i*c,n[6]=t*o+i*h,n[1]=-i*r+t*s,n[4]=-i*a+t*c,n[7]=-i*o+t*h,this},translate:function(e,t){var i=this.elements;return i[0]+=e*i[2],i[3]+=e*i[5],i[6]+=e*i[8],i[1]+=t*i[2],i[4]+=t*i[5],i[7]+=t*i[8],this},equals:function(e){for(var t=this.elements,i=e.elements,n=0;n<9;n++)if(t[n]!==i[n])return!1;return!0},fromArray:function(e,t){void 0===t&&(t=0);for(var i=0;i<9;i++)this.elements[i]=e[i+t];return this},toArray:function(e,t){void 0===e&&(e=[]),void 0===t&&(t=0);var i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}});var kt,Vt,jt,Wt,Xt,qt,Yt,Zt,Jt,Qt,Kt,$t,ei,ti,ii,ni,ri=0;function ai(e,t,i,n,r,a,o,s,c,h){Object.defineProperty(this,"id",{value:ri++}),this.uuid=Ut.generateUUID(),this.name="",this.image=void 0!==e?e:ai.DEFAULT_IMAGE,this.mipmaps=[],this.mapping=void 0!==t?t:ai.DEFAULT_MAPPING,this.wrapS=void 0!==i?i:be,this.wrapT=void 0!==n?n:be,this.magFilter=void 0!==r?r:Se,this.minFilter=void 0!==a?a:Pe,this.anisotropy=void 0!==c?c:1,this.format=void 0!==o?o:Xe,this.type=void 0!==s?s:Oe,this.offset=new Dt(0,0),this.repeat=new Dt(1,1),this.center=new Dt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Gt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.encoding=void 0!==h?h:At,this.version=0,this.onUpdate=null}function oi(e,t,i,n){this.x=e||0,this.y=t||0,this.z=i||0,this.w=void 0!==n?n:1}function si(e,t,i){this.width=e,this.height=t,this.scissor=new oi(0,0,e,t),this.scissorTest=!1,this.viewport=new oi(0,0,e,t),void 0===(i=i||{}).minFilter&&(i.minFilter=Se),this.texture=new ai(void 0,void 0,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.encoding),this.texture.generateMipmaps=void 0===i.generateMipmaps||i.generateMipmaps,this.depthBuffer=void 0===i.depthBuffer||i.depthBuffer,this.stencilBuffer=void 0===i.stencilBuffer||i.stencilBuffer,this.depthTexture=void 0!==i.depthTexture?i.depthTexture:null}function ci(e,t,i){si.call(this,e,t,i),this.activeCubeFace=0,this.activeMipMapLevel=0}function hi(e,t,i,n,r,a,o,s,c,h,l,u){ai.call(this,null,a,o,s,c,h,n,r,l,u),this.image={data:e,width:t,height:i},this.magFilter=void 0!==c?c:Me,this.minFilter=void 0!==h?h:Me,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}function li(e,t){this.min=void 0!==e?e:new zt(1/0,1/0,1/0),this.max=void 0!==t?t:new zt(-1/0,-1/0,-1/0)}function ui(e,t){this.center=void 0!==e?e:new zt,this.radius=void 0!==t?t:0}function di(e,t){this.normal=void 0!==e?e:new zt(1,0,0),this.constant=void 0!==t?t:0}function pi(e,t,i,n,r,a){this.planes=[void 0!==e?e:new di,void 0!==t?t:new di,void 0!==i?i:new di,void 0!==n?n:new di,void 0!==r?r:new di,void 0!==a?a:new di]}ai.DEFAULT_IMAGE=void 0,ai.DEFAULT_MAPPING=300,ai.prototype=Object.assign(Object.create(t.prototype),{constructor:ai,isTexture:!0,updateMatrix:function(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.name=e.name,this.image=e.image,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.encoding=e.encoding,this},toJSON:function(e){var t=void 0===e||"string"==typeof e;if(!t&&void 0!==e.textures[this.uuid])return e.textures[this.uuid];var i={metadata:{version:4.5,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,mapping:this.mapping,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY};if(void 0!==this.image){var n=this.image;void 0===n.uuid&&(n.uuid=Ut.generateUUID()),t||void 0!==e.images[n.uuid]||(e.images[n.uuid]={uuid:n.uuid,url:function(e){var t;if(e instanceof HTMLCanvasElement)t=e;else{(t=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")).width=e.width,t.height=e.height;var i=t.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height)}return 2048<t.width||2048<t.height?t.toDataURL("image/jpeg",.6):t.toDataURL("image/png")}(n)}),i.image=n.uuid}return t||(e.textures[this.uuid]=i),i},dispose:function(){this.dispatchEvent({type:"dispose"})},transformUv:function(e){if(300===this.mapping){if(e.applyMatrix3(this.matrix),e.x<0||1<e.x)switch(this.wrapS){case we:e.x=e.x-Math.floor(e.x);break;case be:e.x=e.x<0?0:1;break;case _e:1===Math.abs(Math.floor(e.x)%2)?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x)}if(e.y<0||1<e.y)switch(this.wrapT){case we:e.y=e.y-Math.floor(e.y);break;case be:e.y=e.y<0?0:1;break;case _e:1===Math.abs(Math.floor(e.y)%2)?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y)}this.flipY&&(e.y=1-e.y)}}}),Object.defineProperty(ai.prototype,"needsUpdate",{set:function(e){!0===e&&this.version++}}),Object.assign(oi.prototype,{isVector4:!0,set:function(e,t,i,n){return this.x=e,this.y=t,this.z=i,this.w=n,this},setScalar:function(e){return this.x=e,this.y=e,this.z=e,this.w=e,this},setX:function(e){return this.x=e,this},setY:function(e){return this.y=e,this},setZ:function(e){return this.z=e,this},setW:function(e){return this.w=e,this},setComponent:function(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this},getComponent:function(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}},clone:function(){return new this.constructor(this.x,this.y,this.z,this.w)},copy:function(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=void 0!==e.w?e.w:1,this},add:function(e,t){return void 0!==t?(console.warn("THREE.Vector4: .add() now only accepts one argument. Use .addVectors( a, b ) instead."),this.addVectors(e,t)):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this)},addScalar:function(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this},addVectors:function(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this},addScaledVector:function(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this},sub:function(e,t){return void 0!==t?(console.warn("THREE.Vector4: .sub() now only accepts one argument. Use .subVectors( a, b ) instead."),this.subVectors(e,t)):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this)},subScalar:function(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this},subVectors:function(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this},multiplyScalar:function(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this},applyMatrix4:function(e){var t=this.x,i=this.y,n=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*n+a[12]*r,this.y=a[1]*t+a[5]*i+a[9]*n+a[13]*r,this.z=a[2]*t+a[6]*i+a[10]*n+a[14]*r,this.w=a[3]*t+a[7]*i+a[11]*n+a[15]*r,this},divideScalar:function(e){return this.multiplyScalar(1/e)},setAxisAngleFromQuaternion:function(e){this.w=2*Math.acos(e.w);var t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this},setAxisAngleFromRotationMatrix:function(e){var t,i,n,r,a=e.elements,o=a[0],s=a[4],c=a[8],h=a[1],l=a[5],u=a[9],d=a[2],p=a[6],f=a[10];if(Math.abs(s-h)<.01&&Math.abs(c-d)<.01&&Math.abs(u-p)<.01){if(Math.abs(s+h)<.1&&Math.abs(c+d)<.1&&Math.abs(u+p)<.1&&Math.abs(o+l+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;var m=(o+1)/2,g=(l+1)/2,v=(f+1)/2,y=(s+h)/4,x=(c+d)/4,w=(u+p)/4;return g<m&&v<m?m<.01?(i=0,r=n=.707106781):(n=y/(i=Math.sqrt(m)),r=x/i):v<g?g<.01?(n=0,r=i=.707106781):(i=y/(n=Math.sqrt(g)),r=w/n):v<.01?(n=i=.707106781,r=0):(i=x/(r=Math.sqrt(v)),n=w/r),this.set(i,n,r,t),this}var b=Math.sqrt((p-u)*(p-u)+(c-d)*(c-d)+(h-s)*(h-s));return Math.abs(b)<.001&&(b=1),this.x=(p-u)/b,this.y=(c-d)/b,this.z=(h-s)/b,this.w=Math.acos((o+l+f-1)/2),this},min:function(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this},max:function(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this},clamp:function(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this},clampScalar:function(e,t){return void 0===kt&&(kt=new oi,Vt=new oi),kt.set(e,e,e,e),Vt.set(t,t,t,t),this.clamp(kt,Vt)},clampLength:function(e,t){var i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))},floor:function(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this},ceil:function(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this},round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this},roundToZero:function(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this.w=this.w<0?Math.ceil(this.w):Math.floor(this.w),this},negate:function(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this},dot:function(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w},lengthSq:function(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w},length:function(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)},manhattanLength:function(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)},normalize:function(){return this.divideScalar(this.length()||1)},setLength:function(e){return this.normalize().multiplyScalar(e)},lerp:function(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this},lerpVectors:function(e,t,i){return this.subVectors(t,e).multiplyScalar(i).add(e)},equals:function(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w},fromArray:function(e,t){return void 0===t&&(t=0),this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e},fromBufferAttribute:function(e,t,i){return void 0!==i&&console.warn("THREE.Vector4: offset has been removed from .fromBufferAttribute()."),this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}}),si.prototype=Object.assign(Object.create(t.prototype),{constructor:si,isWebGLRenderTarget:!0,setSize:function(e,t){this.width===e&&this.height===t||(this.width=e,this.height=t,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.width=e.width,this.height=e.height,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.depthTexture=e.depthTexture,this},dispose:function(){this.dispatchEvent({type:"dispose"})}}),((ci.prototype=Object.create(si.prototype)).constructor=ci).prototype.isWebGLRenderTargetCube=!0,((hi.prototype=Object.create(ai.prototype)).constructor=hi).prototype.isDataTexture=!0,Object.assign(li.prototype,{isBox3:!0,set:function(e,t){return this.min.copy(e),this.max.copy(t),this},setFromArray:function(e){for(var t=1/0,i=1/0,n=1/0,r=-1/0,a=-1/0,o=-1/0,s=0,c=e.length;s<c;s+=3){var h=e[s],l=e[s+1],u=e[s+2];h<t&&(t=h),l<i&&(i=l),u<n&&(n=u),r<h&&(r=h),a<l&&(a=l),o<u&&(o=u)}return this.min.set(t,i,n),this.max.set(r,a,o),this},setFromBufferAttribute:function(e){for(var t=1/0,i=1/0,n=1/0,r=-1/0,a=-1/0,o=-1/0,s=0,c=e.count;s<c;s++){var h=e.getX(s),l=e.getY(s),u=e.getZ(s);h<t&&(t=h),l<i&&(i=l),u<n&&(n=u),r<h&&(r=h),a<l&&(a=l),o<u&&(o=u)}return this.min.set(t,i,n),this.max.set(r,a,o),this},setFromPoints:function(e){this.makeEmpty();for(var t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this},setFromCenterAndSize:(qt=new zt,function(e,t){var i=qt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}),setFromObject:function(e){return this.makeEmpty(),this.expandByObject(e)},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.min.copy(e.min),this.max.copy(e.max),this},makeEmpty:function(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this},isEmpty:function(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z},getCenter:function(e){return void 0===e&&(console.warn("THREE.Box3: .getCenter() target is now required"),e=new zt),this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)},getSize:function(e){return void 0===e&&(console.warn("THREE.Box3: .getSize() target is now required"),e=new zt),this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)},expandByPoint:function(e){return this.min.min(e),this.max.max(e),this},expandByVector:function(e){return this.min.sub(e),this.max.add(e),this},expandByScalar:function(e){return this.min.addScalar(-e),this.max.addScalar(e),this},expandByObject:function(){var r,a,o,s=new zt;function t(e){var t=e.geometry;if(void 0!==t)if(t.isGeometry){var i=t.vertices;for(a=0,o=i.length;a<o;a++)s.copy(i[a]),s.applyMatrix4(e.matrixWorld),r.expandByPoint(s)}else if(t.isBufferGeometry){var n=t.attributes.position;if(void 0!==n)for(a=0,o=n.count;a<o;a++)s.fromBufferAttribute(n,a).applyMatrix4(e.matrixWorld),r.expandByPoint(s)}}return function(e){return r=this,e.updateMatrixWorld(!0),e.traverse(t),this}}(),containsPoint:function(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)},containsBox:function(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z},getParameter:function(e,t){return void 0===t&&(console.warn("THREE.Box3: .getParameter() target is now required"),t=new zt),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))},intersectsBox:function(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)},intersectsSphere:(Xt=new zt,function(e){return this.clampPoint(e.center,Xt),Xt.distanceToSquared(e.center)<=e.radius*e.radius}),intersectsPlane:function(e){var t,i;return 0<e.normal.x?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),0<e.normal.y?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),0<e.normal.z?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=e.constant&&i>=e.constant},intersectsTriangle:function(){var s=new zt,c=new zt,h=new zt,i=new zt,n=new zt,r=new zt,l=new zt,a=new zt,u=new zt,o=new zt;function d(e){var t,i;for(t=0,i=e.length-3;t<=i;t+=3){l.fromArray(e,t);var n=u.x*Math.abs(l.x)+u.y*Math.abs(l.y)+u.z*Math.abs(l.z),r=s.dot(l),a=c.dot(l),o=h.dot(l);if(Math.max(-Math.max(r,a,o),Math.min(r,a,o))>n)return!1}return!0}return function(e){if(this.isEmpty())return!1;this.getCenter(a),u.subVectors(this.max,a),s.subVectors(e.a,a),c.subVectors(e.b,a),h.subVectors(e.c,a),i.subVectors(c,s),n.subVectors(h,c),r.subVectors(s,h);var t=[0,-i.z,i.y,0,-n.z,n.y,0,-r.z,r.y,i.z,0,-i.x,n.z,0,-n.x,r.z,0,-r.x,-i.y,i.x,0,-n.y,n.x,0,-r.y,r.x,0];return!!d(t)&&(!!d(t=[1,0,0,0,1,0,0,0,1])&&(o.crossVectors(i,n),d(t=[o.x,o.y,o.z])))}}(),clampPoint:function(e,t){return void 0===t&&(console.warn("THREE.Box3: .clampPoint() target is now required"),t=new zt),t.copy(e).clamp(this.min,this.max)},distanceToPoint:(Wt=new zt,function(e){return Wt.copy(e).clamp(this.min,this.max).sub(e).length()}),getBoundingSphere:(jt=new zt,function(e){return void 0===e&&(console.warn("THREE.Box3: .getBoundingSphere() target is now required"),e=new ui),this.getCenter(e.center),e.radius=.5*this.getSize(jt).length(),e}),intersect:function(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this},union:function(e){return this.min.min(e.min),this.max.max(e.max),this},applyMatrix4:function(e){if(this.isEmpty())return this;var t=e.elements,i=t[0]*this.min.x,n=t[1]*this.min.x,r=t[2]*this.min.x,a=t[0]*this.max.x,o=t[1]*this.max.x,s=t[2]*this.max.x,c=t[4]*this.min.y,h=t[5]*this.min.y,l=t[6]*this.min.y,u=t[4]*this.max.y,d=t[5]*this.max.y,p=t[6]*this.max.y,f=t[8]*this.min.z,m=t[9]*this.min.z,g=t[10]*this.min.z,v=t[8]*this.max.z,y=t[9]*this.max.z,x=t[10]*this.max.z;return this.min.x=Math.min(i,a)+Math.min(c,u)+Math.min(f,v)+t[12],this.min.y=Math.min(n,o)+Math.min(h,d)+Math.min(m,y)+t[13],this.min.z=Math.min(r,s)+Math.min(l,p)+Math.min(g,x)+t[14],this.max.x=Math.max(i,a)+Math.max(c,u)+Math.max(f,v)+t[12],this.max.y=Math.max(n,o)+Math.max(h,d)+Math.max(m,y)+t[13],this.max.z=Math.max(r,s)+Math.max(l,p)+Math.max(g,x)+t[14],this},translate:function(e){return this.min.add(e),this.max.add(e),this},equals:function(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}),Object.assign(ui.prototype,{set:function(e,t){return this.center.copy(e),this.radius=t,this},setFromPoints:(Yt=new li,function(e,t){var i=this.center;void 0!==t?i.copy(t):Yt.setFromPoints(e).getCenter(i);for(var n=0,r=0,a=e.length;r<a;r++)n=Math.max(n,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(n),this}),clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.center.copy(e.center),this.radius=e.radius,this},empty:function(){return this.radius<=0},containsPoint:function(e){return e.distanceToSquared(this.center)<=this.radius*this.radius},distanceToPoint:function(e){return e.distanceTo(this.center)-this.radius},intersectsSphere:function(e){var t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t},intersectsBox:function(e){return e.intersectsSphere(this)},intersectsPlane:function(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius},clampPoint:function(e,t){var i=this.center.distanceToSquared(e);return void 0===t&&(console.warn("THREE.Sphere: .clampPoint() target is now required"),t=new zt),t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t},getBoundingBox:function(e){return void 0===e&&(console.warn("THREE.Sphere: .getBoundingBox() target is now required"),e=new li),e.set(this.center,this.center),e.expandByScalar(this.radius),e},applyMatrix4:function(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this},translate:function(e){return this.center.add(e),this},equals:function(e){return e.center.equals(this.center)&&e.radius===this.radius}}),Object.assign(di.prototype,{set:function(e,t){return this.normal.copy(e),this.constant=t,this},setComponents:function(e,t,i,n){return this.normal.set(e,t,i),this.constant=n,this},setFromNormalAndCoplanarPoint:function(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this},setFromCoplanarPoints:(Kt=new zt,$t=new zt,function(e,t,i){var n=Kt.subVectors(i,t).cross($t.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(n,e),this}),clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.normal.copy(e.normal),this.constant=e.constant,this},normalize:function(){var e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this},negate:function(){return this.constant*=-1,this.normal.negate(),this},distanceToPoint:function(e){return this.normal.dot(e)+this.constant},distanceToSphere:function(e){return this.distanceToPoint(e.center)-e.radius},projectPoint:function(e,t){return void 0===t&&(console.warn("THREE.Plane: .projectPoint() target is now required"),t=new zt),t.copy(this.normal).multiplyScalar(-this.distanceToPoint(e)).add(e)},intersectLine:(Qt=new zt,function(e,t){void 0===t&&(console.warn("THREE.Plane: .intersectLine() target is now required"),t=new zt);var i=e.delta(Qt),n=this.normal.dot(i);if(0===n)return 0===this.distanceToPoint(e.start)?t.copy(e.start):void 0;var r=-(e.start.dot(this.normal)+this.constant)/n;return r<0||1<r?void 0:t.copy(i).multiplyScalar(r).add(e.start)}),intersectsLine:function(e){var t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&0<i||i<0&&0<t},intersectsBox:function(e){return e.intersectsPlane(this)},intersectsSphere:function(e){return e.intersectsPlane(this)},coplanarPoint:function(e){return void 0===e&&(console.warn("THREE.Plane: .coplanarPoint() target is now required"),e=new zt),e.copy(this.normal).multiplyScalar(-this.constant)},applyMatrix4:(Zt=new zt,Jt=new Gt,function(e,t){var i=t||Jt.getNormalMatrix(e),n=this.coplanarPoint(Zt).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-n.dot(r),this}),translate:function(e){return this.constant-=e.dot(this.normal),this},equals:function(e){return e.normal.equals(this.normal)&&e.constant===this.constant}}),Object.assign(pi.prototype,{set:function(e,t,i,n,r,a){var o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(n),o[4].copy(r),o[5].copy(a),this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){for(var t=this.planes,i=0;i<6;i++)t[i].copy(e.planes[i]);return this},setFromMatrix:function(e){var t=this.planes,i=e.elements,n=i[0],r=i[1],a=i[2],o=i[3],s=i[4],c=i[5],h=i[6],l=i[7],u=i[8],d=i[9],p=i[10],f=i[11],m=i[12],g=i[13],v=i[14],y=i[15];return t[0].setComponents(o-n,l-s,f-u,y-m).normalize(),t[1].setComponents(o+n,l+s,f+u,y+m).normalize(),t[2].setComponents(o+r,l+c,f+d,y+g).normalize(),t[3].setComponents(o-r,l-c,f-d,y-g).normalize(),t[4].setComponents(o-a,l-h,f-p,y-v).normalize(),t[5].setComponents(o+a,l+h,f+p,y+v).normalize(),this},intersectsObject:(ni=new ui,function(e){var t=e.geometry;return null===t.boundingSphere&&t.computeBoundingSphere(),ni.copy(t.boundingSphere).applyMatrix4(e.matrixWorld),this.intersectsSphere(ni)}),intersectsSprite:(ii=new ui,function(e){return ii.center.set(0,0,0),ii.radius=.7071067811865476,ii.applyMatrix4(e.matrixWorld),this.intersectsSphere(ii)}),intersectsSphere:function(e){for(var t=this.planes,i=e.center,n=-e.radius,r=0;r<6;r++){if(t[r].distanceToPoint(i)<n)return!1}return!0},intersectsBox:(ei=new zt,ti=new zt,function(e){for(var t=this.planes,i=0;i<6;i++){var n=t[i];ei.x=0<n.normal.x?e.min.x:e.max.x,ti.x=0<n.normal.x?e.max.x:e.min.x,ei.y=0<n.normal.y?e.min.y:e.max.y,ti.y=0<n.normal.y?e.max.y:e.min.y,ei.z=0<n.normal.z?e.min.z:e.max.z,ti.z=0<n.normal.z?e.max.z:e.min.z;var r=n.distanceToPoint(ei),a=n.distanceToPoint(ti);if(r<0&&a<0)return!1}return!0}),containsPoint:function(e){for(var t=this.planes,i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}});var fi,mi={alphamap_fragment:"#ifdef USE_ALPHAMAP\n\tdiffuseColor.a *= texture2D( alphaMap, vUv ).g;\n#endif\n",alphamap_pars_fragment:"#ifdef USE_ALPHAMAP\n\tuniform sampler2D alphaMap;\n#endif\n",alphatest_fragment:"#ifdef ALPHATEST\n\tif ( diffuseColor.a < ALPHATEST ) discard;\n#endif\n",aomap_fragment:"#ifdef USE_AOMAP\n\tfloat ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;\n\treflectedLight.indirectDiffuse *= ambientOcclusion;\n\t#if defined( USE_ENVMAP ) && defined( PHYSICAL )\n\t\tfloat dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\t\treflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );\n\t#endif\n#endif\n",aomap_pars_fragment:"#ifdef USE_AOMAP\n\tuniform sampler2D aoMap;\n\tuniform float aoMapIntensity;\n#endif",begin_vertex:"\nvec3 transformed = vec3( position );\n",beginnormal_vertex:"\nvec3 objectNormal = vec3( normal );\n",bsdfs:"float punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n\tif( decayExponent > 0.0 ) {\n#if defined ( PHYSICALLY_CORRECT_LIGHTS )\n\t\tfloat distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n\t\tfloat maxDistanceCutoffFactor = pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n\t\treturn distanceFalloff * maxDistanceCutoffFactor;\n#else\n\t\treturn pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );\n#endif\n\t}\n\treturn 1.0;\n}\nvec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {\n\treturn RECIPROCAL_PI * diffuseColor;\n}\nvec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {\n\tfloat fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );\n\treturn ( 1.0 - specularColor ) * fresnel + specularColor;\n}\nfloat G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {\n\tfloat a2 = pow2( alpha );\n\tfloat gl = dotNL + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n\tfloat gv = dotNV + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n\treturn 1.0 / ( gl * gv );\n}\nfloat G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\n\tfloat a2 = pow2( alpha );\n\tfloat gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n\tfloat gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n\treturn 0.5 / max( gv + gl, EPSILON );\n}\nfloat D_GGX( const in float alpha, const in float dotNH ) {\n\tfloat a2 = pow2( alpha );\n\tfloat denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;\n\treturn RECIPROCAL_PI * a2 / pow2( denom );\n}\nvec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {\n\tfloat alpha = pow2( roughness );\n\tvec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );\n\tfloat dotNL = saturate( dot( geometry.normal, incidentLight.direction ) );\n\tfloat dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\tfloat dotNH = saturate( dot( geometry.normal, halfDir ) );\n\tfloat dotLH = saturate( dot( incidentLight.direction, halfDir ) );\n\tvec3 F = F_Schlick( specularColor, dotLH );\n\tfloat G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n\tfloat D = D_GGX( alpha, dotNH );\n\treturn F * ( G * D );\n}\nvec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {\n\tconst float LUT_SIZE  = 64.0;\n\tconst float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;\n\tconst float LUT_BIAS  = 0.5 / LUT_SIZE;\n\tfloat dotNV = saturate( dot( N, V ) );\n\tvec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );\n\tuv = uv * LUT_SCALE + LUT_BIAS;\n\treturn uv;\n}\nfloat LTC_ClippedSphereFormFactor( const in vec3 f ) {\n\tfloat l = length( f );\n\treturn max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );\n}\nvec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {\n\tfloat x = dot( v1, v2 );\n\tfloat y = abs( x );\n\tfloat a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;\n\tfloat b = 3.4175940 + ( 4.1616724 + y ) * y;\n\tfloat v = a / b;\n\tfloat theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;\n\treturn cross( v1, v2 ) * theta_sintheta;\n}\nvec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {\n\tvec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];\n\tvec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];\n\tvec3 lightNormal = cross( v1, v2 );\n\tif( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );\n\tvec3 T1, T2;\n\tT1 = normalize( V - N * dot( V, N ) );\n\tT2 = - cross( N, T1 );\n\tmat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );\n\tvec3 coords[ 4 ];\n\tcoords[ 0 ] = mat * ( rectCoords[ 0 ] - P );\n\tcoords[ 1 ] = mat * ( rectCoords[ 1 ] - P );\n\tcoords[ 2 ] = mat * ( rectCoords[ 2 ] - P );\n\tcoords[ 3 ] = mat * ( rectCoords[ 3 ] - P );\n\tcoords[ 0 ] = normalize( coords[ 0 ] );\n\tcoords[ 1 ] = normalize( coords[ 1 ] );\n\tcoords[ 2 ] = normalize( coords[ 2 ] );\n\tcoords[ 3 ] = normalize( coords[ 3 ] );\n\tvec3 vectorFormFactor = vec3( 0.0 );\n\tvectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );\n\tvectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );\n\tvectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );\n\tvectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );\n\tfloat result = LTC_ClippedSphereFormFactor( vectorFormFactor );\n\treturn vec3( result );\n}\nvec3 BRDF_Specular_GGX_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness ) {\n\tfloat dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\tconst vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );\n\tconst vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );\n\tvec4 r = roughness * c0 + c1;\n\tfloat a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;\n\tvec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;\n\treturn specularColor * AB.x + AB.y;\n}\nfloat G_BlinnPhong_Implicit( ) {\n\treturn 0.25;\n}\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n\treturn RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n}\nvec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {\n\tvec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );\n\tfloat dotNH = saturate( dot( geometry.normal, halfDir ) );\n\tfloat dotLH = saturate( dot( incidentLight.direction, halfDir ) );\n\tvec3 F = F_Schlick( specularColor, dotLH );\n\tfloat G = G_BlinnPhong_Implicit( );\n\tfloat D = D_BlinnPhong( shininess, dotNH );\n\treturn F * ( G * D );\n}\nfloat GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {\n\treturn ( 2.0 / pow2( ggxRoughness + 0.0001 ) - 2.0 );\n}\nfloat BlinnExponentToGGXRoughness( const in float blinnExponent ) {\n\treturn sqrt( 2.0 / ( blinnExponent + 2.0 ) );\n}\n",bumpmap_pars_fragment:"#ifdef USE_BUMPMAP\n\tuniform sampler2D bumpMap;\n\tuniform float bumpScale;\n\tvec2 dHdxy_fwd() {\n\t\tvec2 dSTdx = dFdx( vUv );\n\t\tvec2 dSTdy = dFdy( vUv );\n\t\tfloat Hll = bumpScale * texture2D( bumpMap, vUv ).x;\n\t\tfloat dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;\n\t\tfloat dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;\n\t\treturn vec2( dBx, dBy );\n\t}\n\tvec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {\n\t\tvec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );\n\t\tvec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );\n\t\tvec3 vN = surf_norm;\n\t\tvec3 R1 = cross( vSigmaY, vN );\n\t\tvec3 R2 = cross( vN, vSigmaX );\n\t\tfloat fDet = dot( vSigmaX, R1 );\n\t\tfDet *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\t\tvec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n\t\treturn normalize( abs( fDet ) * surf_norm - vGrad );\n\t}\n#endif\n",clipping_planes_fragment:"#if NUM_CLIPPING_PLANES > 0\n\tvec4 plane;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n\t\tplane = clippingPlanes[ i ];\n\t\tif ( dot( vViewPosition, plane.xyz ) > plane.w ) discard;\n\t}\n\t#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n\t\tbool clipped = true;\n\t\t#pragma unroll_loop\n\t\tfor ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n\t\t\tplane = clippingPlanes[ i ];\n\t\t\tclipped = ( dot( vViewPosition, plane.xyz ) > plane.w ) && clipped;\n\t\t}\n\t\tif ( clipped ) discard;\n\t#endif\n#endif\n",clipping_planes_pars_fragment:"#if NUM_CLIPPING_PLANES > 0\n\t#if ! defined( PHYSICAL ) && ! defined( PHONG )\n\t\tvarying vec3 vViewPosition;\n\t#endif\n\tuniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n#endif\n",clipping_planes_pars_vertex:"#if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG )\n\tvarying vec3 vViewPosition;\n#endif\n",clipping_planes_vertex:"#if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG )\n\tvViewPosition = - mvPosition.xyz;\n#endif\n",color_fragment:"#ifdef USE_COLOR\n\tdiffuseColor.rgb *= vColor;\n#endif",color_pars_fragment:"#ifdef USE_COLOR\n\tvarying vec3 vColor;\n#endif\n",color_pars_vertex:"#ifdef USE_COLOR\n\tvarying vec3 vColor;\n#endif",color_vertex:"#ifdef USE_COLOR\n\tvColor.xyz = color.xyz;\n#endif",common:"#define PI 3.14159265359\n#define PI2 6.28318530718\n#define PI_HALF 1.5707963267949\n#define RECIPROCAL_PI 0.31830988618\n#define RECIPROCAL_PI2 0.15915494\n#define LOG2 1.442695\n#define EPSILON 1e-6\n#define saturate(a) clamp( a, 0.0, 1.0 )\n#define whiteCompliment(a) ( 1.0 - saturate( a ) )\nfloat pow2( const in float x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }\nhighp float rand( const in vec2 uv ) {\n\tconst highp float a = 12.9898, b = 78.233, c = 43758.5453;\n\thighp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n\treturn fract(sin(sn) * c);\n}\nstruct IncidentLight {\n\tvec3 color;\n\tvec3 direction;\n\tbool visible;\n};\nstruct ReflectedLight {\n\tvec3 directDiffuse;\n\tvec3 directSpecular;\n\tvec3 indirectDiffuse;\n\tvec3 indirectSpecular;\n};\nstruct GeometricContext {\n\tvec3 position;\n\tvec3 normal;\n\tvec3 viewDir;\n};\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n\treturn normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n}\nvec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {\n\treturn normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );\n}\nvec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\n\tfloat distance = dot( planeNormal, point - pointOnPlane );\n\treturn - distance * planeNormal + point;\n}\nfloat sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\n\treturn sign( dot( point - pointOnPlane, planeNormal ) );\n}\nvec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {\n\treturn lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;\n}\nmat3 transposeMat3( const in mat3 m ) {\n\tmat3 tmp;\n\ttmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );\n\ttmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );\n\ttmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );\n\treturn tmp;\n}\nfloat linearToRelativeLuminance( const in vec3 color ) {\n\tvec3 weights = vec3( 0.2126, 0.7152, 0.0722 );\n\treturn dot( weights, color.rgb );\n}\n",cube_uv_reflection_fragment:"#ifdef ENVMAP_TYPE_CUBE_UV\n#define cubeUV_textureSize (1024.0)\nint getFaceFromDirection(vec3 direction) {\n\tvec3 absDirection = abs(direction);\n\tint face = -1;\n\tif( absDirection.x > absDirection.z ) {\n\t\tif(absDirection.x > absDirection.y )\n\t\t\tface = direction.x > 0.0 ? 0 : 3;\n\t\telse\n\t\t\tface = direction.y > 0.0 ? 1 : 4;\n\t}\n\telse {\n\t\tif(absDirection.z > absDirection.y )\n\t\t\tface = direction.z > 0.0 ? 2 : 5;\n\t\telse\n\t\t\tface = direction.y > 0.0 ? 1 : 4;\n\t}\n\treturn face;\n}\n#define cubeUV_maxLods1  (log2(cubeUV_textureSize*0.25) - 1.0)\n#define cubeUV_rangeClamp (exp2((6.0 - 1.0) * 2.0))\nvec2 MipLevelInfo( vec3 vec, float roughnessLevel, float roughness ) {\n\tfloat scale = exp2(cubeUV_maxLods1 - roughnessLevel);\n\tfloat dxRoughness = dFdx(roughness);\n\tfloat dyRoughness = dFdy(roughness);\n\tvec3 dx = dFdx( vec * scale * dxRoughness );\n\tvec3 dy = dFdy( vec * scale * dyRoughness );\n\tfloat d = max( dot( dx, dx ), dot( dy, dy ) );\n\td = clamp(d, 1.0, cubeUV_rangeClamp);\n\tfloat mipLevel = 0.5 * log2(d);\n\treturn vec2(floor(mipLevel), fract(mipLevel));\n}\n#define cubeUV_maxLods2 (log2(cubeUV_textureSize*0.25) - 2.0)\n#define cubeUV_rcpTextureSize (1.0 / cubeUV_textureSize)\nvec2 getCubeUV(vec3 direction, float roughnessLevel, float mipLevel) {\n\tmipLevel = roughnessLevel > cubeUV_maxLods2 - 3.0 ? 0.0 : mipLevel;\n\tfloat a = 16.0 * cubeUV_rcpTextureSize;\n\tvec2 exp2_packed = exp2( vec2( roughnessLevel, mipLevel ) );\n\tvec2 rcp_exp2_packed = vec2( 1.0 ) / exp2_packed;\n\tfloat powScale = exp2_packed.x * exp2_packed.y;\n\tfloat scale = rcp_exp2_packed.x * rcp_exp2_packed.y * 0.25;\n\tfloat mipOffset = 0.75*(1.0 - rcp_exp2_packed.y) * rcp_exp2_packed.x;\n\tbool bRes = mipLevel == 0.0;\n\tscale =  bRes && (scale < a) ? a : scale;\n\tvec3 r;\n\tvec2 offset;\n\tint face = getFaceFromDirection(direction);\n\tfloat rcpPowScale = 1.0 / powScale;\n\tif( face == 0) {\n\t\tr = vec3(direction.x, -direction.z, direction.y);\n\t\toffset = vec2(0.0+mipOffset,0.75 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? a : offset.y;\n\t}\n\telse if( face == 1) {\n\t\tr = vec3(direction.y, direction.x, direction.z);\n\t\toffset = vec2(scale+mipOffset, 0.75 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? a : offset.y;\n\t}\n\telse if( face == 2) {\n\t\tr = vec3(direction.z, direction.x, direction.y);\n\t\toffset = vec2(2.0*scale+mipOffset, 0.75 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? a : offset.y;\n\t}\n\telse if( face == 3) {\n\t\tr = vec3(direction.x, direction.z, direction.y);\n\t\toffset = vec2(0.0+mipOffset,0.5 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? 0.0 : offset.y;\n\t}\n\telse if( face == 4) {\n\t\tr = vec3(direction.y, direction.x, -direction.z);\n\t\toffset = vec2(scale+mipOffset, 0.5 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? 0.0 : offset.y;\n\t}\n\telse {\n\t\tr = vec3(direction.z, -direction.x, direction.y);\n\t\toffset = vec2(2.0*scale+mipOffset, 0.5 * rcpPowScale);\n\t\toffset.y = bRes && (offset.y < 2.0*a) ? 0.0 : offset.y;\n\t}\n\tr = normalize(r);\n\tfloat texelOffset = 0.5 * cubeUV_rcpTextureSize;\n\tvec2 s = ( r.yz / abs( r.x ) + vec2( 1.0 ) ) * 0.5;\n\tvec2 base = offset + vec2( texelOffset );\n\treturn base + s * ( scale - 2.0 * texelOffset );\n}\n#define cubeUV_maxLods3 (log2(cubeUV_textureSize*0.25) - 3.0)\nvec4 textureCubeUV(vec3 reflectedDirection, float roughness ) {\n\tfloat roughnessVal = roughness* cubeUV_maxLods3;\n\tfloat r1 = floor(roughnessVal);\n\tfloat r2 = r1 + 1.0;\n\tfloat t = fract(roughnessVal);\n\tvec2 mipInfo = MipLevelInfo(reflectedDirection, r1, roughness);\n\tfloat s = mipInfo.y;\n\tfloat level0 = mipInfo.x;\n\tfloat level1 = level0 + 1.0;\n\tlevel1 = level1 > 5.0 ? 5.0 : level1;\n\tlevel0 += min( floor( s + 0.5 ), 5.0 );\n\tvec2 uv_10 = getCubeUV(reflectedDirection, r1, level0);\n\tvec4 color10 = envMapTexelToLinear(texture2D(envMap, uv_10));\n\tvec2 uv_20 = getCubeUV(reflectedDirection, r2, level0);\n\tvec4 color20 = envMapTexelToLinear(texture2D(envMap, uv_20));\n\tvec4 result = mix(color10, color20, t);\n\treturn vec4(result.rgb, 1.0);\n}\n#endif\n",defaultnormal_vertex:"vec3 transformedNormal = normalMatrix * objectNormal;\n#ifdef FLIP_SIDED\n\ttransformedNormal = - transformedNormal;\n#endif\n",displacementmap_pars_vertex:"#ifdef USE_DISPLACEMENTMAP\n\tuniform sampler2D displacementMap;\n\tuniform float displacementScale;\n\tuniform float displacementBias;\n#endif\n",displacementmap_vertex:"#ifdef USE_DISPLACEMENTMAP\n\tvec2 transformedUV = ( uvTransform * vec3( uv, 1 ) ).xy;\n\ttransformed += normalize( objectNormal ) * ( texture2D( displacementMap, transformedUV ).x * displacementScale + displacementBias );\n#endif\n",emissivemap_fragment:"#ifdef USE_EMISSIVEMAP\n\tvec4 emissiveColor = texture2D( emissiveMap, vUv );\n\temissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;\n\ttotalEmissiveRadiance *= emissiveColor.rgb;\n#endif\n",emissivemap_pars_fragment:"#ifdef USE_EMISSIVEMAP\n\tuniform sampler2D emissiveMap;\n#endif\n",encodings_fragment:"  gl_FragColor = linearToOutputTexel( gl_FragColor );\n",encodings_pars_fragment:"\nvec4 LinearToLinear( in vec4 value ) {\n\treturn value;\n}\nvec4 GammaToLinear( in vec4 value, in float gammaFactor ) {\n\treturn vec4( pow( value.xyz, vec3( gammaFactor ) ), value.w );\n}\nvec4 LinearToGamma( in vec4 value, in float gammaFactor ) {\n\treturn vec4( pow( value.xyz, vec3( 1.0 / gammaFactor ) ), value.w );\n}\nvec4 sRGBToLinear( in vec4 value ) {\n\treturn vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.w );\n}\nvec4 LinearTosRGB( in vec4 value ) {\n\treturn vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.w );\n}\nvec4 RGBEToLinear( in vec4 value ) {\n\treturn vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );\n}\nvec4 LinearToRGBE( in vec4 value ) {\n\tfloat maxComponent = max( max( value.r, value.g ), value.b );\n\tfloat fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );\n\treturn vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );\n}\nvec4 RGBMToLinear( in vec4 value, in float maxRange ) {\n\treturn vec4( value.xyz * value.w * maxRange, 1.0 );\n}\nvec4 LinearToRGBM( in vec4 value, in float maxRange ) {\n\tfloat maxRGB = max( value.x, max( value.g, value.b ) );\n\tfloat M      = clamp( maxRGB / maxRange, 0.0, 1.0 );\n\tM            = ceil( M * 255.0 ) / 255.0;\n\treturn vec4( value.rgb / ( M * maxRange ), M );\n}\nvec4 RGBDToLinear( in vec4 value, in float maxRange ) {\n\treturn vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );\n}\nvec4 LinearToRGBD( in vec4 value, in float maxRange ) {\n\tfloat maxRGB = max( value.x, max( value.g, value.b ) );\n\tfloat D      = max( maxRange / maxRGB, 1.0 );\n\tD            = min( floor( D ) / 255.0, 1.0 );\n\treturn vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );\n}\nconst mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );\nvec4 LinearToLogLuv( in vec4 value )  {\n\tvec3 Xp_Y_XYZp = value.rgb * cLogLuvM;\n\tXp_Y_XYZp = max(Xp_Y_XYZp, vec3(1e-6, 1e-6, 1e-6));\n\tvec4 vResult;\n\tvResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;\n\tfloat Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;\n\tvResult.w = fract(Le);\n\tvResult.z = (Le - (floor(vResult.w*255.0))/255.0)/255.0;\n\treturn vResult;\n}\nconst mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );\nvec4 LogLuvToLinear( in vec4 value ) {\n\tfloat Le = value.z * 255.0 + value.w;\n\tvec3 Xp_Y_XYZp;\n\tXp_Y_XYZp.y = exp2((Le - 127.0) / 2.0);\n\tXp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;\n\tXp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;\n\tvec3 vRGB = Xp_Y_XYZp.rgb * cLogLuvInverseM;\n\treturn vec4( max(vRGB, 0.0), 1.0 );\n}\n",envmap_fragment:"#ifdef USE_ENVMAP\n\t#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )\n\t\tvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );\n\t\tvec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n\t\t#ifdef ENVMAP_MODE_REFLECTION\n\t\t\tvec3 reflectVec = reflect( cameraToVertex, worldNormal );\n\t\t#else\n\t\t\tvec3 reflectVec = refract( cameraToVertex, worldNormal, refractionRatio );\n\t\t#endif\n\t#else\n\t\tvec3 reflectVec = vReflect;\n\t#endif\n\t#ifdef ENVMAP_TYPE_CUBE\n\t\tvec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n\t#elif defined( ENVMAP_TYPE_EQUIREC )\n\t\tvec2 sampleUV;\n\t\treflectVec = normalize( reflectVec );\n\t\tsampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n\t\tsampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;\n\t\tvec4 envColor = texture2D( envMap, sampleUV );\n\t#elif defined( ENVMAP_TYPE_SPHERE )\n\t\treflectVec = normalize( reflectVec );\n\t\tvec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0, 0.0, 1.0 ) );\n\t\tvec4 envColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5 );\n\t#else\n\t\tvec4 envColor = vec4( 0.0 );\n\t#endif\n\tenvColor = envMapTexelToLinear( envColor );\n\t#ifdef ENVMAP_BLENDING_MULTIPLY\n\t\toutgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n\t#elif defined( ENVMAP_BLENDING_MIX )\n\t\toutgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n\t#elif defined( ENVMAP_BLENDING_ADD )\n\t\toutgoingLight += envColor.xyz * specularStrength * reflectivity;\n\t#endif\n#endif\n",envmap_pars_fragment:"#if defined( USE_ENVMAP ) || defined( PHYSICAL )\n\tuniform float reflectivity;\n\tuniform float envMapIntensity;\n#endif\n#ifdef USE_ENVMAP\n\t#if ! defined( PHYSICAL ) && ( defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) )\n\t\tvarying vec3 vWorldPosition;\n\t#endif\n\t#ifdef ENVMAP_TYPE_CUBE\n\t\tuniform samplerCube envMap;\n\t#else\n\t\tuniform sampler2D envMap;\n\t#endif\n\tuniform float flipEnvMap;\n\tuniform int maxMipLevel;\n\t#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( PHYSICAL )\n\t\tuniform float refractionRatio;\n\t#else\n\t\tvarying vec3 vReflect;\n\t#endif\n#endif\n",envmap_pars_vertex:"#ifdef USE_ENVMAP\n\t#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )\n\t\tvarying vec3 vWorldPosition;\n\t#else\n\t\tvarying vec3 vReflect;\n\t\tuniform float refractionRatio;\n\t#endif\n#endif\n",envmap_vertex:"#ifdef USE_ENVMAP\n\t#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )\n\t\tvWorldPosition = worldPosition.xyz;\n\t#else\n\t\tvec3 cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n\t\tvec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n\t\t#ifdef ENVMAP_MODE_REFLECTION\n\t\t\tvReflect = reflect( cameraToVertex, worldNormal );\n\t\t#else\n\t\t\tvReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n\t\t#endif\n\t#endif\n#endif\n",fog_vertex:"\n#ifdef USE_FOG\nfogDepth = -mvPosition.z;\n#endif",fog_pars_vertex:"#ifdef USE_FOG\n  varying float fogDepth;\n#endif\n",fog_fragment:"#ifdef USE_FOG\n\t#ifdef FOG_EXP2\n\t\tfloat fogFactor = whiteCompliment( exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 ) );\n\t#else\n\t\tfloat fogFactor = smoothstep( fogNear, fogFar, fogDepth );\n\t#endif\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif\n",fog_pars_fragment:"#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float fogDepth;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif\n",gradientmap_pars_fragment:"#ifdef TOON\n\tuniform sampler2D gradientMap;\n\tvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n\t\tfloat dotNL = dot( normal, lightDirection );\n\t\tvec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n\t\t#ifdef USE_GRADIENTMAP\n\t\t\treturn texture2D( gradientMap, coord ).rgb;\n\t\t#else\n\t\t\treturn ( coord.x < 0.7 ) ? vec3( 0.7 ) : vec3( 1.0 );\n\t\t#endif\n\t}\n#endif\n",lightmap_fragment:"#ifdef USE_LIGHTMAP\n\treflectedLight.indirectDiffuse += PI * texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n#endif\n",lightmap_pars_fragment:"#ifdef USE_LIGHTMAP\n\tuniform sampler2D lightMap;\n\tuniform float lightMapIntensity;\n#endif",lights_lambert_vertex:"vec3 diffuse = vec3( 1.0 );\nGeometricContext geometry;\ngeometry.position = mvPosition.xyz;\ngeometry.normal = normalize( transformedNormal );\ngeometry.viewDir = normalize( -mvPosition.xyz );\nGeometricContext backGeometry;\nbackGeometry.position = geometry.position;\nbackGeometry.normal = -geometry.normal;\nbackGeometry.viewDir = geometry.viewDir;\nvLightFront = vec3( 0.0 );\n#ifdef DOUBLE_SIDED\n\tvLightBack = vec3( 0.0 );\n#endif\nIncidentLight directLight;\nfloat dotNL;\nvec3 directLightColor_Diffuse;\n#if NUM_POINT_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\t\tgetPointDirectLightIrradiance( pointLights[ i ], geometry, directLight );\n\t\tdotNL = dot( geometry.normal, directLight.direction );\n\t\tdirectLightColor_Diffuse = PI * directLight.color;\n\t\tvLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n\t\t#ifdef DOUBLE_SIDED\n\t\t\tvLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n\t\t#endif\n\t}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\t\tgetSpotDirectLightIrradiance( spotLights[ i ], geometry, directLight );\n\t\tdotNL = dot( geometry.normal, directLight.direction );\n\t\tdirectLightColor_Diffuse = PI * directLight.color;\n\t\tvLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n\t\t#ifdef DOUBLE_SIDED\n\t\t\tvLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n\t\t#endif\n\t}\n#endif\n#if NUM_DIR_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tgetDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );\n\t\tdotNL = dot( geometry.normal, directLight.direction );\n\t\tdirectLightColor_Diffuse = PI * directLight.color;\n\t\tvLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n\t\t#ifdef DOUBLE_SIDED\n\t\t\tvLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n\t\t#endif\n\t}\n#endif\n#if NUM_HEMI_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\t\tvLightFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n\t\t#ifdef DOUBLE_SIDED\n\t\t\tvLightBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );\n\t\t#endif\n\t}\n#endif\n",lights_pars_begin:"uniform vec3 ambientLightColor;\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n\tvec3 irradiance = ambientLightColor;\n\t#ifndef PHYSICALLY_CORRECT_LIGHTS\n\t\tirradiance *= PI;\n\t#endif\n\treturn irradiance;\n}\n#if NUM_DIR_LIGHTS > 0\n\tstruct DirectionalLight {\n\t\tvec3 direction;\n\t\tvec3 color;\n\t\tint shadow;\n\t\tfloat shadowBias;\n\t\tfloat shadowRadius;\n\t\tvec2 shadowMapSize;\n\t};\n\tuniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n\tvoid getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {\n\t\tdirectLight.color = directionalLight.color;\n\t\tdirectLight.direction = directionalLight.direction;\n\t\tdirectLight.visible = true;\n\t}\n#endif\n#if NUM_POINT_LIGHTS > 0\n\tstruct PointLight {\n\t\tvec3 position;\n\t\tvec3 color;\n\t\tfloat distance;\n\t\tfloat decay;\n\t\tint shadow;\n\t\tfloat shadowBias;\n\t\tfloat shadowRadius;\n\t\tvec2 shadowMapSize;\n\t\tfloat shadowCameraNear;\n\t\tfloat shadowCameraFar;\n\t};\n\tuniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n\tvoid getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {\n\t\tvec3 lVector = pointLight.position - geometry.position;\n\t\tdirectLight.direction = normalize( lVector );\n\t\tfloat lightDistance = length( lVector );\n\t\tdirectLight.color = pointLight.color;\n\t\tdirectLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );\n\t\tdirectLight.visible = ( directLight.color != vec3( 0.0 ) );\n\t}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n\tstruct SpotLight {\n\t\tvec3 position;\n\t\tvec3 direction;\n\t\tvec3 color;\n\t\tfloat distance;\n\t\tfloat decay;\n\t\tfloat coneCos;\n\t\tfloat penumbraCos;\n\t\tint shadow;\n\t\tfloat shadowBias;\n\t\tfloat shadowRadius;\n\t\tvec2 shadowMapSize;\n\t};\n\tuniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n\tvoid getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight  ) {\n\t\tvec3 lVector = spotLight.position - geometry.position;\n\t\tdirectLight.direction = normalize( lVector );\n\t\tfloat lightDistance = length( lVector );\n\t\tfloat angleCos = dot( directLight.direction, spotLight.direction );\n\t\tif ( angleCos > spotLight.coneCos ) {\n\t\t\tfloat spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n\t\t\tdirectLight.color = spotLight.color;\n\t\t\tdirectLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );\n\t\t\tdirectLight.visible = true;\n\t\t} else {\n\t\t\tdirectLight.color = vec3( 0.0 );\n\t\t\tdirectLight.visible = false;\n\t\t}\n\t}\n#endif\n#if NUM_RECT_AREA_LIGHTS > 0\n\tstruct RectAreaLight {\n\t\tvec3 color;\n\t\tvec3 position;\n\t\tvec3 halfWidth;\n\t\tvec3 halfHeight;\n\t};\n\tuniform sampler2D ltc_1;\tuniform sampler2D ltc_2;\n\tuniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n#endif\n#if NUM_HEMI_LIGHTS > 0\n\tstruct HemisphereLight {\n\t\tvec3 direction;\n\t\tvec3 skyColor;\n\t\tvec3 groundColor;\n\t};\n\tuniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n\tvec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {\n\t\tfloat dotNL = dot( geometry.normal, hemiLight.direction );\n\t\tfloat hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n\t\tvec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n\t\t#ifndef PHYSICALLY_CORRECT_LIGHTS\n\t\t\tirradiance *= PI;\n\t\t#endif\n\t\treturn irradiance;\n\t}\n#endif\n",lights_pars_maps:"#if defined( USE_ENVMAP ) && defined( PHYSICAL )\n\tvec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {\n\t\tvec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );\n\t\t#ifdef ENVMAP_TYPE_CUBE\n\t\t\tvec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );\n\t\t\t#ifdef TEXTURE_LOD_EXT\n\t\t\t\tvec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );\n\t\t\t#else\n\t\t\t\tvec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );\n\t\t\t#endif\n\t\t\tenvMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n\t\t#elif defined( ENVMAP_TYPE_CUBE_UV )\n\t\t\tvec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );\n\t\t\tvec4 envMapColor = textureCubeUV( queryVec, 1.0 );\n\t\t#else\n\t\t\tvec4 envMapColor = vec4( 0.0 );\n\t\t#endif\n\t\treturn PI * envMapColor.rgb * envMapIntensity;\n\t}\n\tfloat getSpecularMIPLevel( const in float blinnShininessExponent, const in int maxMIPLevel ) {\n\t\tfloat maxMIPLevelScalar = float( maxMIPLevel );\n\t\tfloat desiredMIPLevel = maxMIPLevelScalar + 0.79248 - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );\n\t\treturn clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );\n\t}\n\tvec3 getLightProbeIndirectRadiance( const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {\n\t\t#ifdef ENVMAP_MODE_REFLECTION\n\t\t\tvec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );\n\t\t#else\n\t\t\tvec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );\n\t\t#endif\n\t\treflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n\t\tfloat specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );\n\t\t#ifdef ENVMAP_TYPE_CUBE\n\t\t\tvec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );\n\t\t\t#ifdef TEXTURE_LOD_EXT\n\t\t\t\tvec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );\n\t\t\t#else\n\t\t\t\tvec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );\n\t\t\t#endif\n\t\t\tenvMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n\t\t#elif defined( ENVMAP_TYPE_CUBE_UV )\n\t\t\tvec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );\n\t\t\tvec4 envMapColor = textureCubeUV(queryReflectVec, BlinnExponentToGGXRoughness(blinnShininessExponent));\n\t\t#elif defined( ENVMAP_TYPE_EQUIREC )\n\t\t\tvec2 sampleUV;\n\t\t\tsampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n\t\t\tsampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;\n\t\t\t#ifdef TEXTURE_LOD_EXT\n\t\t\t\tvec4 envMapColor = texture2DLodEXT( envMap, sampleUV, specularMIPLevel );\n\t\t\t#else\n\t\t\t\tvec4 envMapColor = texture2D( envMap, sampleUV, specularMIPLevel );\n\t\t\t#endif\n\t\t\tenvMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n\t\t#elif defined( ENVMAP_TYPE_SPHERE )\n\t\t\tvec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0,0.0,1.0 ) );\n\t\t\t#ifdef TEXTURE_LOD_EXT\n\t\t\t\tvec4 envMapColor = texture2DLodEXT( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );\n\t\t\t#else\n\t\t\t\tvec4 envMapColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );\n\t\t\t#endif\n\t\t\tenvMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n\t\t#endif\n\t\treturn envMapColor.rgb * envMapIntensity;\n\t}\n#endif\n",lights_phong_fragment:"BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;\n",lights_phong_pars_fragment:"varying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\nstruct BlinnPhongMaterial {\n\tvec3\tdiffuseColor;\n\tvec3\tspecularColor;\n\tfloat\tspecularShininess;\n\tfloat\tspecularStrength;\n};\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n\t#ifdef TOON\n\t\tvec3 irradiance = getGradientIrradiance( geometry.normal, directLight.direction ) * directLight.color;\n\t#else\n\t\tfloat dotNL = saturate( dot( geometry.normal, directLight.direction ) );\n\t\tvec3 irradiance = dotNL * directLight.color;\n\t#endif\n\t#ifndef PHYSICALLY_CORRECT_LIGHTS\n\t\tirradiance *= PI;\n\t#endif\n\treflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n\treflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;\n}\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n\treflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\n#define RE_Direct\t\t\t\tRE_Direct_BlinnPhong\n#define RE_IndirectDiffuse\t\tRE_IndirectDiffuse_BlinnPhong\n#define Material_LightProbeLOD( material )\t(0)\n",lights_physical_fragment:"PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );\nmaterial.specularRoughness = clamp( roughnessFactor, 0.04, 1.0 );\n#ifdef STANDARD\n\tmaterial.specularColor = mix( vec3( DEFAULT_SPECULAR_COEFFICIENT ), diffuseColor.rgb, metalnessFactor );\n#else\n\tmaterial.specularColor = mix( vec3( MAXIMUM_SPECULAR_COEFFICIENT * pow2( reflectivity ) ), diffuseColor.rgb, metalnessFactor );\n\tmaterial.clearCoat = saturate( clearCoat );\tmaterial.clearCoatRoughness = clamp( clearCoatRoughness, 0.04, 1.0 );\n#endif\n",lights_physical_pars_fragment:"struct PhysicalMaterial {\n\tvec3\tdiffuseColor;\n\tfloat\tspecularRoughness;\n\tvec3\tspecularColor;\n\t#ifndef STANDARD\n\t\tfloat clearCoat;\n\t\tfloat clearCoatRoughness;\n\t#endif\n};\n#define MAXIMUM_SPECULAR_COEFFICIENT 0.16\n#define DEFAULT_SPECULAR_COEFFICIENT 0.04\nfloat clearCoatDHRApprox( const in float roughness, const in float dotNL ) {\n\treturn DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );\n}\n#if NUM_RECT_AREA_LIGHTS > 0\n\tvoid RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n\t\tvec3 normal = geometry.normal;\n\t\tvec3 viewDir = geometry.viewDir;\n\t\tvec3 position = geometry.position;\n\t\tvec3 lightPos = rectAreaLight.position;\n\t\tvec3 halfWidth = rectAreaLight.halfWidth;\n\t\tvec3 halfHeight = rectAreaLight.halfHeight;\n\t\tvec3 lightColor = rectAreaLight.color;\n\t\tfloat roughness = material.specularRoughness;\n\t\tvec3 rectCoords[ 4 ];\n\t\trectCoords[ 0 ] = lightPos - halfWidth - halfHeight;\t\trectCoords[ 1 ] = lightPos + halfWidth - halfHeight;\n\t\trectCoords[ 2 ] = lightPos + halfWidth + halfHeight;\n\t\trectCoords[ 3 ] = lightPos - halfWidth + halfHeight;\n\t\tvec2 uv = LTC_Uv( normal, viewDir, roughness );\n\t\tvec4 t1 = texture2D( ltc_1, uv );\n\t\tvec4 t2 = texture2D( ltc_2, uv );\n\t\tmat3 mInv = mat3(\n\t\t\tvec3( t1.x, 0, t1.y ),\n\t\t\tvec3(    0, 1,    0 ),\n\t\t\tvec3( t1.z, 0, t1.w )\n\t\t);\n\t\tvec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );\n\t\treflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );\n\t\treflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );\n\t}\n#endif\nvoid RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n\tfloat dotNL = saturate( dot( geometry.normal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;\n\t#ifndef PHYSICALLY_CORRECT_LIGHTS\n\t\tirradiance *= PI;\n\t#endif\n\t#ifndef STANDARD\n\t\tfloat clearCoatDHR = material.clearCoat * clearCoatDHRApprox( material.clearCoatRoughness, dotNL );\n\t#else\n\t\tfloat clearCoatDHR = 0.0;\n\t#endif\n\treflectedLight.directSpecular += ( 1.0 - clearCoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry, material.specularColor, material.specularRoughness );\n\treflectedLight.directDiffuse += ( 1.0 - clearCoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n\t#ifndef STANDARD\n\t\treflectedLight.directSpecular += irradiance * material.clearCoat * BRDF_Specular_GGX( directLight, geometry, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearCoatRoughness );\n\t#endif\n}\nvoid RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n\treflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 clearCoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n\t#ifndef STANDARD\n\t\tfloat dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\t\tfloat dotNL = dotNV;\n\t\tfloat clearCoatDHR = material.clearCoat * clearCoatDHRApprox( material.clearCoatRoughness, dotNL );\n\t#else\n\t\tfloat clearCoatDHR = 0.0;\n\t#endif\n\treflectedLight.indirectSpecular += ( 1.0 - clearCoatDHR ) * radiance * BRDF_Specular_GGX_Environment( geometry, material.specularColor, material.specularRoughness );\n\t#ifndef STANDARD\n\t\treflectedLight.indirectSpecular += clearCoatRadiance * material.clearCoat * BRDF_Specular_GGX_Environment( geometry, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearCoatRoughness );\n\t#endif\n}\n#define RE_Direct\t\t\t\tRE_Direct_Physical\n#define RE_Direct_RectArea\t\tRE_Direct_RectArea_Physical\n#define RE_IndirectDiffuse\t\tRE_IndirectDiffuse_Physical\n#define RE_IndirectSpecular\t\tRE_IndirectSpecular_Physical\n#define Material_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.specularRoughness )\n#define Material_ClearCoat_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.clearCoatRoughness )\nfloat computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {\n\treturn saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );\n}\n",lights_fragment_begin:"\nGeometricContext geometry;\ngeometry.position = - vViewPosition;\ngeometry.normal = normal;\ngeometry.viewDir = normalize( vViewPosition );\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n\tPointLight pointLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\t\tpointLight = pointLights[ i ];\n\t\tgetPointDirectLightIrradiance( pointLight, geometry, directLight );\n\t\t#ifdef USE_SHADOWMAP\n\t\tdirectLight.color *= all( bvec2( pointLight.shadow, directLight.visible ) ) ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n\tSpotLight spotLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\t\tspotLight = spotLights[ i ];\n\t\tgetSpotDirectLightIrradiance( spotLight, geometry, directLight );\n\t\t#ifdef USE_SHADOWMAP\n\t\tdirectLight.color *= all( bvec2( spotLight.shadow, directLight.visible ) ) ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n\tDirectionalLight directionalLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\t#ifdef USE_SHADOWMAP\n\t\tdirectLight.color *= all( bvec2( directionalLight.shadow, directLight.visible ) ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\tRectAreaLight rectAreaLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\t\trectAreaLight = rectAreaLights[ i ];\n\t\tRE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\n\t}\n#endif\n#if defined( RE_IndirectDiffuse )\n\tvec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\t#if ( NUM_HEMI_LIGHTS > 0 )\n\t\t#pragma unroll_loop\n\t\tfor ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\t\t\tirradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n\t\t}\n\t#endif\n#endif\n#if defined( RE_IndirectSpecular )\n\tvec3 radiance = vec3( 0.0 );\n\tvec3 clearCoatRadiance = vec3( 0.0 );\n#endif\n",lights_fragment_maps:"#if defined( RE_IndirectDiffuse )\n\t#ifdef USE_LIGHTMAP\n\t\tvec3 lightMapIrradiance = texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n\t\t#ifndef PHYSICALLY_CORRECT_LIGHTS\n\t\t\tlightMapIrradiance *= PI;\n\t\t#endif\n\t\tirradiance += lightMapIrradiance;\n\t#endif\n\t#if defined( USE_ENVMAP ) && defined( PHYSICAL ) && defined( ENVMAP_TYPE_CUBE_UV )\n\t\tirradiance += getLightProbeIndirectIrradiance( geometry, maxMipLevel );\n\t#endif\n#endif\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n\tradiance += getLightProbeIndirectRadiance( geometry, Material_BlinnShininessExponent( material ), maxMipLevel );\n\t#ifndef STANDARD\n\t\tclearCoatRadiance += getLightProbeIndirectRadiance( geometry, Material_ClearCoat_BlinnShininessExponent( material ), maxMipLevel );\n\t#endif\n#endif\n",lights_fragment_end:"#if defined( RE_IndirectDiffuse )\n\tRE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );\n#endif\n#if defined( RE_IndirectSpecular )\n\tRE_IndirectSpecular( radiance, clearCoatRadiance, geometry, material, reflectedLight );\n#endif\n",logdepthbuf_fragment:"#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )\n\tgl_FragDepthEXT = log2( vFragDepth ) * logDepthBufFC * 0.5;\n#endif",logdepthbuf_pars_fragment:"#ifdef USE_LOGDEPTHBUF\n\tuniform float logDepthBufFC;\n\t#ifdef USE_LOGDEPTHBUF_EXT\n\t\tvarying float vFragDepth;\n\t#endif\n#endif\n",logdepthbuf_pars_vertex:"#ifdef USE_LOGDEPTHBUF\n\t#ifdef USE_LOGDEPTHBUF_EXT\n\t\tvarying float vFragDepth;\n\t#endif\n\tuniform float logDepthBufFC;\n#endif",logdepthbuf_vertex:"#ifdef USE_LOGDEPTHBUF\n\t#ifdef USE_LOGDEPTHBUF_EXT\n\t\tvFragDepth = 1.0 + gl_Position.w;\n\t#else\n\t\tgl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;\n\t\tgl_Position.z *= gl_Position.w;\n\t#endif\n#endif\n",map_fragment:"#ifdef USE_MAP\n\tvec4 texelColor = texture2D( map, vUv );\n\ttexelColor = mapTexelToLinear( texelColor );\n\tdiffuseColor *= texelColor;\n#endif\n",map_pars_fragment:"#ifdef USE_MAP\n\tuniform sampler2D map;\n#endif\n",map_particle_fragment:"#ifdef USE_MAP\n\tvec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n\tvec4 mapTexel = texture2D( map, uv );\n\tdiffuseColor *= mapTexelToLinear( mapTexel );\n#endif\n",map_particle_pars_fragment:"#ifdef USE_MAP\n\tuniform mat3 uvTransform;\n\tuniform sampler2D map;\n#endif\n",metalnessmap_fragment:"float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n\tvec4 texelMetalness = texture2D( metalnessMap, vUv );\n\tmetalnessFactor *= texelMetalness.b;\n#endif\n",metalnessmap_pars_fragment:"#ifdef USE_METALNESSMAP\n\tuniform sampler2D metalnessMap;\n#endif",morphnormal_vertex:"#ifdef USE_MORPHNORMALS\n\tobjectNormal += ( morphNormal0 - normal ) * morphTargetInfluences[ 0 ];\n\tobjectNormal += ( morphNormal1 - normal ) * morphTargetInfluences[ 1 ];\n\tobjectNormal += ( morphNormal2 - normal ) * morphTargetInfluences[ 2 ];\n\tobjectNormal += ( morphNormal3 - normal ) * morphTargetInfluences[ 3 ];\n#endif\n",morphtarget_pars_vertex:"#ifdef USE_MORPHTARGETS\n\t#ifndef USE_MORPHNORMALS\n\tuniform float morphTargetInfluences[ 8 ];\n\t#else\n\tuniform float morphTargetInfluences[ 4 ];\n\t#endif\n#endif",morphtarget_vertex:"#ifdef USE_MORPHTARGETS\n\ttransformed += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];\n\ttransformed += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];\n\ttransformed += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];\n\ttransformed += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];\n\t#ifndef USE_MORPHNORMALS\n\ttransformed += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];\n\ttransformed += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];\n\ttransformed += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];\n\ttransformed += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];\n\t#endif\n#endif\n",normal_fragment_begin:"#ifdef FLAT_SHADED\n\tvec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );\n\tvec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );\n\tvec3 normal = normalize( cross( fdx, fdy ) );\n#else\n\tvec3 normal = normalize( vNormal );\n\t#ifdef DOUBLE_SIDED\n\t\tnormal = normal * ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\t#endif\n#endif\n",normal_fragment_maps:"#ifdef USE_NORMALMAP\n\tnormal = perturbNormal2Arb( -vViewPosition, normal );\n#elif defined( USE_BUMPMAP )\n\tnormal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );\n#endif\n",normalmap_pars_fragment:"#ifdef USE_NORMALMAP\n\tuniform sampler2D normalMap;\n\tuniform vec2 normalScale;\n\tvec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {\n\t\tvec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n\t\tvec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n\t\tvec2 st0 = dFdx( vUv.st );\n\t\tvec2 st1 = dFdy( vUv.st );\n\t\tfloat scale = sign( st1.t * st0.s - st0.t * st1.s );\n\t\tvec3 S = normalize( ( q0 * st1.t - q1 * st0.t ) * scale );\n\t\tvec3 T = normalize( ( - q0 * st1.s + q1 * st0.s ) * scale );\n\t\tvec3 N = normalize( surf_norm );\n\t\tmat3 tsn = mat3( S, T, N );\n\t\tvec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\n\t\tmapN.xy *= normalScale;\n\t\tmapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\t\treturn normalize( tsn * mapN );\n\t}\n#endif\n",packing:"vec3 packNormalToRGB( const in vec3 normal ) {\n\treturn normalize( normal ) * 0.5 + 0.5;\n}\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n\treturn 2.0 * rgb.xyz - 1.0;\n}\nconst float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;\nconst vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );\nconst vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );\nconst float ShiftRight8 = 1. / 256.;\nvec4 packDepthToRGBA( const in float v ) {\n\tvec4 r = vec4( fract( v * PackFactors ), v );\n\tr.yzw -= r.xyz * ShiftRight8;\treturn r * PackUpscale;\n}\nfloat unpackRGBAToDepth( const in vec4 v ) {\n\treturn dot( v, UnpackFactors );\n}\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n\treturn ( viewZ + near ) / ( near - far );\n}\nfloat orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {\n\treturn linearClipZ * ( near - far ) - near;\n}\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n\treturn (( near + viewZ ) * far ) / (( far - near ) * viewZ );\n}\nfloat perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {\n\treturn ( near * far ) / ( ( far - near ) * invClipZ - far );\n}\n",premultiplied_alpha_fragment:"#ifdef PREMULTIPLIED_ALPHA\n\tgl_FragColor.rgb *= gl_FragColor.a;\n#endif\n",project_vertex:"vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );\ngl_Position = projectionMatrix * mvPosition;\n",dithering_fragment:"#if defined( DITHERING )\n  gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n#endif\n",dithering_pars_fragment:"#if defined( DITHERING )\n\tvec3 dithering( vec3 color ) {\n\t\tfloat grid_position = rand( gl_FragCoord.xy );\n\t\tvec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n\t\tdither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n\t\treturn color + dither_shift_RGB;\n\t}\n#endif\n",roughnessmap_fragment:"float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n\tvec4 texelRoughness = texture2D( roughnessMap, vUv );\n\troughnessFactor *= texelRoughness.g;\n#endif\n",roughnessmap_pars_fragment:"#ifdef USE_ROUGHNESSMAP\n\tuniform sampler2D roughnessMap;\n#endif",shadowmap_pars_fragment:"#ifdef USE_SHADOWMAP\n\t#if NUM_DIR_LIGHTS > 0\n\t\tuniform sampler2D directionalShadowMap[ NUM_DIR_LIGHTS ];\n\t\tvarying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];\n\t#endif\n\t#if NUM_SPOT_LIGHTS > 0\n\t\tuniform sampler2D spotShadowMap[ NUM_SPOT_LIGHTS ];\n\t\tvarying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];\n\t#endif\n\t#if NUM_POINT_LIGHTS > 0\n\t\tuniform sampler2D pointShadowMap[ NUM_POINT_LIGHTS ];\n\t\tvarying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];\n\t#endif\n\tfloat texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n\t\treturn step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\n\t}\n\tfloat texture2DShadowLerp( sampler2D depths, vec2 size, vec2 uv, float compare ) {\n\t\tconst vec2 offset = vec2( 0.0, 1.0 );\n\t\tvec2 texelSize = vec2( 1.0 ) / size;\n\t\tvec2 centroidUV = floor( uv * size + 0.5 ) / size;\n\t\tfloat lb = texture2DCompare( depths, centroidUV + texelSize * offset.xx, compare );\n\t\tfloat lt = texture2DCompare( depths, centroidUV + texelSize * offset.xy, compare );\n\t\tfloat rb = texture2DCompare( depths, centroidUV + texelSize * offset.yx, compare );\n\t\tfloat rt = texture2DCompare( depths, centroidUV + texelSize * offset.yy, compare );\n\t\tvec2 f = fract( uv * size + 0.5 );\n\t\tfloat a = mix( lb, lt, f.y );\n\t\tfloat b = mix( rb, rt, f.y );\n\t\tfloat c = mix( a, b, f.x );\n\t\treturn c;\n\t}\n\tfloat getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n\t\tfloat shadow = 1.0;\n\t\tshadowCoord.xyz /= shadowCoord.w;\n\t\tshadowCoord.z += shadowBias;\n\t\tbvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );\n\t\tbool inFrustum = all( inFrustumVec );\n\t\tbvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\n\t\tbool frustumTest = all( frustumTestVec );\n\t\tif ( frustumTest ) {\n\t\t#if defined( SHADOWMAP_TYPE_PCF )\n\t\t\tvec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n\t\t\tfloat dx0 = - texelSize.x * shadowRadius;\n\t\t\tfloat dy0 = - texelSize.y * shadowRadius;\n\t\t\tfloat dx1 = + texelSize.x * shadowRadius;\n\t\t\tfloat dy1 = + texelSize.y * shadowRadius;\n\t\t\tshadow = (\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\n\t\t\t\ttexture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\n\t\t\t) * ( 1.0 / 9.0 );\n\t\t#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\tvec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n\t\t\tfloat dx0 = - texelSize.x * shadowRadius;\n\t\t\tfloat dy0 = - texelSize.y * shadowRadius;\n\t\t\tfloat dx1 = + texelSize.x * shadowRadius;\n\t\t\tfloat dy1 = + texelSize.y * shadowRadius;\n\t\t\tshadow = (\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy, shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\n\t\t\t\ttexture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\n\t\t\t) * ( 1.0 / 9.0 );\n\t\t#else\n\t\t\tshadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );\n\t\t#endif\n\t\t}\n\t\treturn shadow;\n\t}\n\tvec2 cubeToUV( vec3 v, float texelSizeY ) {\n\t\tvec3 absV = abs( v );\n\t\tfloat scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );\n\t\tabsV *= scaleToCube;\n\t\tv *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );\n\t\tvec2 planar = v.xy;\n\t\tfloat almostATexel = 1.5 * texelSizeY;\n\t\tfloat almostOne = 1.0 - almostATexel;\n\t\tif ( absV.z >= almostOne ) {\n\t\t\tif ( v.z > 0.0 )\n\t\t\t\tplanar.x = 4.0 - v.x;\n\t\t} else if ( absV.x >= almostOne ) {\n\t\t\tfloat signX = sign( v.x );\n\t\t\tplanar.x = v.z * signX + 2.0 * signX;\n\t\t} else if ( absV.y >= almostOne ) {\n\t\t\tfloat signY = sign( v.y );\n\t\t\tplanar.x = v.x + 2.0 * signY + 2.0;\n\t\t\tplanar.y = v.z * signY - 2.0;\n\t\t}\n\t\treturn vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );\n\t}\n\tfloat getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n\t\tvec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );\n\t\tvec3 lightToPosition = shadowCoord.xyz;\n\t\tfloat dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );\t\tdp += shadowBias;\n\t\tvec3 bd3D = normalize( lightToPosition );\n\t\t#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT )\n\t\t\tvec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;\n\t\t\treturn (\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +\n\t\t\t\ttexture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )\n\t\t\t) * ( 1.0 / 9.0 );\n\t\t#else\n\t\t\treturn texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );\n\t\t#endif\n\t}\n#endif\n",shadowmap_pars_vertex:"#ifdef USE_SHADOWMAP\n\t#if NUM_DIR_LIGHTS > 0\n\t\tuniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHTS ];\n\t\tvarying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];\n\t#endif\n\t#if NUM_SPOT_LIGHTS > 0\n\t\tuniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHTS ];\n\t\tvarying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];\n\t#endif\n\t#if NUM_POINT_LIGHTS > 0\n\t\tuniform mat4 pointShadowMatrix[ NUM_POINT_LIGHTS ];\n\t\tvarying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];\n\t#endif\n#endif\n",shadowmap_vertex:"#ifdef USE_SHADOWMAP\n\t#if NUM_DIR_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tvDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * worldPosition;\n\t}\n\t#endif\n\t#if NUM_SPOT_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\t\tvSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * worldPosition;\n\t}\n\t#endif\n\t#if NUM_POINT_LIGHTS > 0\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\t\tvPointShadowCoord[ i ] = pointShadowMatrix[ i ] * worldPosition;\n\t}\n\t#endif\n#endif\n",shadowmask_pars_fragment:"float getShadowMask() {\n\tfloat shadow = 1.0;\n\t#ifdef USE_SHADOWMAP\n\t#if NUM_DIR_LIGHTS > 0\n\tDirectionalLight directionalLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tshadow *= bool( directionalLight.shadow ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t}\n\t#endif\n\t#if NUM_SPOT_LIGHTS > 0\n\tSpotLight spotLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\t\tspotLight = spotLights[ i ];\n\t\tshadow *= bool( spotLight.shadow ) ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n\t}\n\t#endif\n\t#if NUM_POINT_LIGHTS > 0\n\tPointLight pointLight;\n\t#pragma unroll_loop\n\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\t\tpointLight = pointLights[ i ];\n\t\tshadow *= bool( pointLight.shadow ) ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n\t}\n\t#endif\n\t#endif\n\treturn shadow;\n}\n",skinbase_vertex:"#ifdef USE_SKINNING\n\tmat4 boneMatX = getBoneMatrix( skinIndex.x );\n\tmat4 boneMatY = getBoneMatrix( skinIndex.y );\n\tmat4 boneMatZ = getBoneMatrix( skinIndex.z );\n\tmat4 boneMatW = getBoneMatrix( skinIndex.w );\n#endif",skinning_pars_vertex:"#ifdef USE_SKINNING\n\tuniform mat4 bindMatrix;\n\tuniform mat4 bindMatrixInverse;\n\t#ifdef BONE_TEXTURE\n\t\tuniform sampler2D boneTexture;\n\t\tuniform int boneTextureSize;\n\t\tmat4 getBoneMatrix( const in float i ) {\n\t\t\tfloat j = i * 4.0;\n\t\t\tfloat x = mod( j, float( boneTextureSize ) );\n\t\t\tfloat y = floor( j / float( boneTextureSize ) );\n\t\t\tfloat dx = 1.0 / float( boneTextureSize );\n\t\t\tfloat dy = 1.0 / float( boneTextureSize );\n\t\t\ty = dy * ( y + 0.5 );\n\t\t\tvec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );\n\t\t\tvec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );\n\t\t\tvec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );\n\t\t\tvec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );\n\t\t\tmat4 bone = mat4( v1, v2, v3, v4 );\n\t\t\treturn bone;\n\t\t}\n\t#else\n\t\tuniform mat4 boneMatrices[ MAX_BONES ];\n\t\tmat4 getBoneMatrix( const in float i ) {\n\t\t\tmat4 bone = boneMatrices[ int(i) ];\n\t\t\treturn bone;\n\t\t}\n\t#endif\n#endif\n",skinning_vertex:"#ifdef USE_SKINNING\n\tvec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n\tvec4 skinned = vec4( 0.0 );\n\tskinned += boneMatX * skinVertex * skinWeight.x;\n\tskinned += boneMatY * skinVertex * skinWeight.y;\n\tskinned += boneMatZ * skinVertex * skinWeight.z;\n\tskinned += boneMatW * skinVertex * skinWeight.w;\n\ttransformed = ( bindMatrixInverse * skinned ).xyz;\n#endif\n",skinnormal_vertex:"#ifdef USE_SKINNING\n\tmat4 skinMatrix = mat4( 0.0 );\n\tskinMatrix += skinWeight.x * boneMatX;\n\tskinMatrix += skinWeight.y * boneMatY;\n\tskinMatrix += skinWeight.z * boneMatZ;\n\tskinMatrix += skinWeight.w * boneMatW;\n\tskinMatrix  = bindMatrixInverse * skinMatrix * bindMatrix;\n\tobjectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n#endif\n",specularmap_fragment:"float specularStrength;\n#ifdef USE_SPECULARMAP\n\tvec4 texelSpecular = texture2D( specularMap, vUv );\n\tspecularStrength = texelSpecular.r;\n#else\n\tspecularStrength = 1.0;\n#endif",specularmap_pars_fragment:"#ifdef USE_SPECULARMAP\n\tuniform sampler2D specularMap;\n#endif",tonemapping_fragment:"#if defined( TONE_MAPPING )\n  gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n#endif\n",tonemapping_pars_fragment:"#ifndef saturate\n\t#define saturate(a) clamp( a, 0.0, 1.0 )\n#endif\nuniform float toneMappingExposure;\nuniform float toneMappingWhitePoint;\nvec3 LinearToneMapping( vec3 color ) {\n\treturn toneMappingExposure * color;\n}\nvec3 ReinhardToneMapping( vec3 color ) {\n\tcolor *= toneMappingExposure;\n\treturn saturate( color / ( vec3( 1.0 ) + color ) );\n}\n#define Uncharted2Helper( x ) max( ( ( x * ( 0.15 * x + 0.10 * 0.50 ) + 0.20 * 0.02 ) / ( x * ( 0.15 * x + 0.50 ) + 0.20 * 0.30 ) ) - 0.02 / 0.30, vec3( 0.0 ) )\nvec3 Uncharted2ToneMapping( vec3 color ) {\n\tcolor *= toneMappingExposure;\n\treturn saturate( Uncharted2Helper( color ) / Uncharted2Helper( vec3( toneMappingWhitePoint ) ) );\n}\nvec3 OptimizedCineonToneMapping( vec3 color ) {\n\tcolor *= toneMappingExposure;\n\tcolor = max( vec3( 0.0 ), color - 0.004 );\n\treturn pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n}\n",uv_pars_fragment:"#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )\n\tvarying vec2 vUv;\n#endif",uv_pars_vertex:"#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )\n\tvarying vec2 vUv;\n\tuniform mat3 uvTransform;\n#else\n \t#if defined( USE_DISPLACEMENTMAP )\n\t\tuniform mat3 uvTransform;\n\t#endif\n#endif\n",uv_vertex:"#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )\n\tvUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n#endif\n",uv2_pars_fragment:"#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n\tvarying vec2 vUv2;\n#endif",uv2_pars_vertex:"#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n\tattribute vec2 uv2;\n\tvarying vec2 vUv2;\n#endif",uv2_vertex:"#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n\tvUv2 = uv2;\n#endif",worldpos_vertex:"#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )\n\tvec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );\n#endif\n",cube_frag:"uniform samplerCube tCube;\nuniform float tFlip;\nuniform float opacity;\nvarying vec3 vWorldPosition;\nvoid main() {\n\tgl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );\n\tgl_FragColor.a *= opacity;\n}\n",cube_vert:"varying vec3 vWorldPosition;\n#include <common>\nvoid main() {\n\tvWorldPosition = transformDirection( position, modelMatrix );\n\t#include <begin_vertex>\n\t#include <project_vertex>\n\tgl_Position.z = gl_Position.w;\n}\n",depth_frag:"#if DEPTH_PACKING == 3200\n\tuniform float opacity;\n#endif\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( 1.0 );\n\t#if DEPTH_PACKING == 3200\n\t\tdiffuseColor.a = opacity;\n\t#endif\n\t#include <map_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <logdepthbuf_fragment>\n\t#if DEPTH_PACKING == 3200\n\t\tgl_FragColor = vec4( vec3( 1.0 - gl_FragCoord.z ), opacity );\n\t#elif DEPTH_PACKING == 3201\n\t\tgl_FragColor = packDepthToRGBA( gl_FragCoord.z );\n\t#endif\n}\n",depth_vert:"#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <skinbase_vertex>\n\t#ifdef USE_DISPLACEMENTMAP\n\t\t#include <beginnormal_vertex>\n\t\t#include <morphnormal_vertex>\n\t\t#include <skinnormal_vertex>\n\t#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <displacementmap_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n}\n",distanceRGBA_frag:"#define DISTANCE\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main () {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( 1.0 );\n\t#include <map_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\tfloat dist = length( vWorldPosition - referencePosition );\n\tdist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n\tdist = saturate( dist );\n\tgl_FragColor = packDepthToRGBA( dist );\n}\n",distanceRGBA_vert:"#define DISTANCE\nvarying vec3 vWorldPosition;\n#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <skinbase_vertex>\n\t#ifdef USE_DISPLACEMENTMAP\n\t\t#include <beginnormal_vertex>\n\t\t#include <morphnormal_vertex>\n\t\t#include <skinnormal_vertex>\n\t#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <displacementmap_vertex>\n\t#include <project_vertex>\n\t#include <worldpos_vertex>\n\t#include <clipping_planes_vertex>\n\tvWorldPosition = worldPosition.xyz;\n}\n",equirect_frag:"uniform sampler2D tEquirect;\nvarying vec3 vWorldPosition;\n#include <common>\nvoid main() {\n\tvec3 direction = normalize( vWorldPosition );\n\tvec2 sampleUV;\n\tsampleUV.y = asin( clamp( direction.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n\tsampleUV.x = atan( direction.z, direction.x ) * RECIPROCAL_PI2 + 0.5;\n\tgl_FragColor = texture2D( tEquirect, sampleUV );\n}\n",equirect_vert:"varying vec3 vWorldPosition;\n#include <common>\nvoid main() {\n\tvWorldPosition = transformDirection( position, modelMatrix );\n\t#include <begin_vertex>\n\t#include <project_vertex>\n}\n",linedashed_frag:"uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tif ( mod( vLineDistance, totalSize ) > dashSize ) {\n\t\tdiscard;\n\t}\n\tvec3 outgoingLight = vec3( 0.0 );\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\t#include <logdepthbuf_fragment>\n\t#include <color_fragment>\n\toutgoingLight = diffuseColor.rgb;\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <premultiplied_alpha_fragment>\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n}\n",linedashed_vert:"uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <color_vertex>\n\tvLineDistance = scale * lineDistance;\n\tvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n\tgl_Position = projectionMatrix * mvPosition;\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\t#include <fog_vertex>\n}\n",meshbasic_frag:"uniform vec3 diffuse;\nuniform float opacity;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n\t#include <color_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <specularmap_fragment>\n\tReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\t#ifdef USE_LIGHTMAP\n\t\treflectedLight.indirectDiffuse += texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n\t#else\n\t\treflectedLight.indirectDiffuse += vec3( 1.0 );\n\t#endif\n\t#include <aomap_fragment>\n\treflectedLight.indirectDiffuse *= diffuseColor.rgb;\n\tvec3 outgoingLight = reflectedLight.indirectDiffuse;\n\t#include <envmap_fragment>\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <premultiplied_alpha_fragment>\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n}\n",meshbasic_vert:"#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <uv2_vertex>\n\t#include <color_vertex>\n\t#include <skinbase_vertex>\n\t#ifdef USE_ENVMAP\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinnormal_vertex>\n\t#include <defaultnormal_vertex>\n\t#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <worldpos_vertex>\n\t#include <clipping_planes_vertex>\n\t#include <envmap_vertex>\n\t#include <fog_vertex>\n}\n",meshlambert_frag:"uniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\n\tvarying vec3 vLightBack;\n#endif\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <lights_pars_maps>\n#include <fog_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\tReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\tvec3 totalEmissiveRadiance = emissive;\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n\t#include <color_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <specularmap_fragment>\n\t#include <emissivemap_fragment>\n\treflectedLight.indirectDiffuse = getAmbientLightIrradiance( ambientLightColor );\n\t#include <lightmap_fragment>\n\treflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );\n\t#ifdef DOUBLE_SIDED\n\t\treflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;\n\t#else\n\t\treflectedLight.directDiffuse = vLightFront;\n\t#endif\n\treflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();\n\t#include <aomap_fragment>\n\tvec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n\t#include <envmap_fragment>\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n\t#include <premultiplied_alpha_fragment>\n\t#include <dithering_fragment>\n}\n",meshlambert_vert:"#define LAMBERT\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\n\tvarying vec3 vLightBack;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <lights_pars_maps>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <uv2_vertex>\n\t#include <color_vertex>\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinbase_vertex>\n\t#include <skinnormal_vertex>\n\t#include <defaultnormal_vertex>\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\t#include <worldpos_vertex>\n\t#include <envmap_vertex>\n\t#include <lights_lambert_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}\n",meshphong_frag:"#define PHONG\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_pars_fragment>\n#include <gradientmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <lights_pars_maps>\n#include <lights_phong_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\tReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\tvec3 totalEmissiveRadiance = emissive;\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n\t#include <color_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <specularmap_fragment>\n\t#include <normal_fragment_begin>\n\t#include <normal_fragment_maps>\n\t#include <emissivemap_fragment>\n\t#include <lights_phong_fragment>\n\t#include <lights_fragment_begin>\n\t#include <lights_fragment_maps>\n\t#include <lights_fragment_end>\n\t#include <aomap_fragment>\n\tvec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n\t#include <envmap_fragment>\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n\t#include <premultiplied_alpha_fragment>\n\t#include <dithering_fragment>\n}\n",meshphong_vert:"#define PHONG\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <uv2_vertex>\n\t#include <color_vertex>\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinbase_vertex>\n\t#include <skinnormal_vertex>\n\t#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n\tvNormal = normalize( transformedNormal );\n#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <displacementmap_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\tvViewPosition = - mvPosition.xyz;\n\t#include <worldpos_vertex>\n\t#include <envmap_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}\n",meshphysical_frag:"#define PHYSICAL\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n#ifndef STANDARD\n\tuniform float clearCoat;\n\tuniform float clearCoatRoughness;\n#endif\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <cube_uv_reflection_fragment>\n#include <lights_pars_begin>\n#include <lights_pars_maps>\n#include <lights_physical_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\tReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\tvec3 totalEmissiveRadiance = emissive;\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n\t#include <color_fragment>\n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <roughnessmap_fragment>\n\t#include <metalnessmap_fragment>\n\t#include <normal_fragment_begin>\n\t#include <normal_fragment_maps>\n\t#include <emissivemap_fragment>\n\t#include <lights_physical_fragment>\n\t#include <lights_fragment_begin>\n\t#include <lights_fragment_maps>\n\t#include <lights_fragment_end>\n\t#include <aomap_fragment>\n\tvec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n\t#include <premultiplied_alpha_fragment>\n\t#include <dithering_fragment>\n}\n",meshphysical_vert:"#define PHYSICAL\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <uv2_vertex>\n\t#include <color_vertex>\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinbase_vertex>\n\t#include <skinnormal_vertex>\n\t#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n\tvNormal = normalize( transformedNormal );\n#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <displacementmap_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\tvViewPosition = - mvPosition.xyz;\n\t#include <worldpos_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}\n",normal_frag:"#define NORMAL\nuniform float opacity;\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\n\tvarying vec3 vViewPosition;\n#endif\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <packing>\n#include <uv_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\nvoid main() {\n\t#include <logdepthbuf_fragment>\n\t#include <normal_fragment_begin>\n\t#include <normal_fragment_maps>\n\tgl_FragColor = vec4( packNormalToRGB( normal ), opacity );\n}\n",normal_vert:"#define NORMAL\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\n\tvarying vec3 vViewPosition;\n#endif\n#ifndef FLAT_SHADED\n\tvarying vec3 vNormal;\n#endif\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\nvoid main() {\n\t#include <uv_vertex>\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n\t#include <skinbase_vertex>\n\t#include <skinnormal_vertex>\n\t#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n\tvNormal = normalize( transformedNormal );\n#endif\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <displacementmap_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\n\tvViewPosition = - mvPosition.xyz;\n#endif\n}\n",points_frag:"uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <color_pars_fragment>\n#include <map_particle_pars_fragment>\n#include <fog_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n\t#include <clipping_planes_fragment>\n\tvec3 outgoingLight = vec3( 0.0 );\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\t#include <logdepthbuf_fragment>\n\t#include <map_particle_fragment>\n\t#include <color_fragment>\n\t#include <alphatest_fragment>\n\toutgoingLight = diffuseColor.rgb;\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\t#include <premultiplied_alpha_fragment>\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\t#include <fog_fragment>\n}\n",points_vert:"uniform float size;\nuniform float scale;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n\t#include <color_vertex>\n\t#include <begin_vertex>\n\t#include <project_vertex>\n\t#ifdef USE_SIZEATTENUATION\n\t\tgl_PointSize = size * ( scale / - mvPosition.z );\n\t#else\n\t\tgl_PointSize = size;\n\t#endif\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\t#include <worldpos_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}\n",shadow_frag:"uniform vec3 color;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\nvoid main() {\n\tgl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );\n\t#include <fog_fragment>\n}\n",shadow_vert:"#include <fog_pars_vertex>\n#include <shadowmap_pars_vertex>\nvoid main() {\n\t#include <begin_vertex>\n\t#include <project_vertex>\n\t#include <worldpos_vertex>\n\t#include <shadowmap_vertex>\n\t#include <fog_vertex>\n}\n"},gi={merge:function(e){for(var t={},i=0;i<e.length;i++){var n=this.clone(e[i]);for(var r in n)t[r]=n[r]}return t},clone:function(e){var t={};for(var i in e)for(var n in t[i]={},e[i]){var r=e[i][n];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture)?t[i][n]=r.clone():Array.isArray(r)?t[i][n]=r.slice():t[i][n]=r}return t}},vi={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074};function yi(e,t,i){return void 0===t&&void 0===i?this.set(e):this.setRGB(e,t,i)}Object.assign(yi.prototype,{isColor:!0,r:1,g:1,b:1,set:function(e){return e&&e.isColor?this.copy(e):"number"==typeof e?this.setHex(e):"string"==typeof e&&this.setStyle(e),this},setScalar:function(e){return this.r=e,this.g=e,this.b=e,this},setHex:function(e){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(255&e)/255,this},setRGB:function(e,t,i){return this.r=e,this.g=t,this.b=i,this},setHSL:function(){function a(e,t,i){return i<0&&(i+=1),1<i&&(i-=1),i<1/6?e+6*(t-e)*i:i<.5?t:i<2/3?e+6*(t-e)*(2/3-i):e}return function(e,t,i){if(e=Ut.euclideanModulo(e,1),t=Ut.clamp(t,0,1),i=Ut.clamp(i,0,1),0===t)this.r=this.g=this.b=i;else{var n=i<=.5?i*(1+t):i+t-i*t,r=2*i-n;this.r=a(r,n,e+1/3),this.g=a(r,n,e),this.b=a(r,n,e-1/3)}return this}}(),setStyle:function(t){function e(e){void 0!==e&&parseFloat(e)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}var i;if(i=/^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/.exec(t)){var n,r=i[1],a=i[2];switch(r){case"rgb":case"rgba":if(n=/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(a))return this.r=Math.min(255,parseInt(n[1],10))/255,this.g=Math.min(255,parseInt(n[2],10))/255,this.b=Math.min(255,parseInt(n[3],10))/255,e(n[5]),this;if(n=/^(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(a))return this.r=Math.min(100,parseInt(n[1],10))/100,this.g=Math.min(100,parseInt(n[2],10))/100,this.b=Math.min(100,parseInt(n[3],10))/100,e(n[5]),this;break;case"hsl":case"hsla":if(n=/^([0-9]*\.?[0-9]+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(a)){var o=parseFloat(n[1])/360,s=parseInt(n[2],10)/100,c=parseInt(n[3],10)/100;return e(n[5]),this.setHSL(o,s,c)}}}else if(i=/^\#([A-Fa-f0-9]+)$/.exec(t)){var h,l=(h=i[1]).length;if(3===l)return this.r=parseInt(h.charAt(0)+h.charAt(0),16)/255,this.g=parseInt(h.charAt(1)+h.charAt(1),16)/255,this.b=parseInt(h.charAt(2)+h.charAt(2),16)/255,this;if(6===l)return this.r=parseInt(h.charAt(0)+h.charAt(1),16)/255,this.g=parseInt(h.charAt(2)+h.charAt(3),16)/255,this.b=parseInt(h.charAt(4)+h.charAt(5),16)/255,this}t&&0<t.length&&(void 0!==(h=vi[t])?this.setHex(h):console.warn("THREE.Color: Unknown color "+t));return this},clone:function(){return new this.constructor(this.r,this.g,this.b)},copy:function(e){return this.r=e.r,this.g=e.g,this.b=e.b,this},copyGammaToLinear:function(e,t){return void 0===t&&(t=2),this.r=Math.pow(e.r,t),this.g=Math.pow(e.g,t),this.b=Math.pow(e.b,t),this},copyLinearToGamma:function(e,t){void 0===t&&(t=2);var i=0<t?1/t:1;return this.r=Math.pow(e.r,i),this.g=Math.pow(e.g,i),this.b=Math.pow(e.b,i),this},convertGammaToLinear:function(e){return this.copyGammaToLinear(this,e),this},convertLinearToGamma:function(e){return this.copyLinearToGamma(this,e),this},getHex:function(){return 255*this.r<<16^255*this.g<<8^255*this.b<<0},getHexString:function(){return("000000"+this.getHex().toString(16)).slice(-6)},getHSL:function(e){void 0===e&&(console.warn("THREE.Color: .getHSL() target is now required"),e={h:0,s:0,l:0});var t,i,n=this.r,r=this.g,a=this.b,o=Math.max(n,r,a),s=Math.min(n,r,a),c=(s+o)/2;if(s===o)i=t=0;else{var h=o-s;switch(i=c<=.5?h/(o+s):h/(2-o-s),o){case n:t=(r-a)/h+(r<a?6:0);break;case r:t=(a-n)/h+2;break;case a:t=(n-r)/h+4}t/=6}return e.h=t,e.s=i,e.l=c,e},getStyle:function(){return"rgb("+(255*this.r|0)+","+(255*this.g|0)+","+(255*this.b|0)+")"},offsetHSL:(fi={},function(e,t,i){return this.getHSL(fi),fi.h+=e,fi.s+=t,fi.l+=i,this.setHSL(fi.h,fi.s,fi.l),this}),add:function(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this},addColors:function(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this},addScalar:function(e){return this.r+=e,this.g+=e,this.b+=e,this},sub:function(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this},multiply:function(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this},multiplyScalar:function(e){return this.r*=e,this.g*=e,this.b*=e,this},lerp:function(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this},equals:function(e){return e.r===this.r&&e.g===this.g&&e.b===this.b},fromArray:function(e,t){return void 0===t&&(t=0),this.r=e[t],this.g=e[t+1],this.b=e[t+2],this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e},toJSON:function(){return this.getHex()}});var xi,wi,bi={common:{diffuse:{value:new yi(15658734)},opacity:{value:1},map:{value:null},uvTransform:{value:new Gt},alphaMap:{value:null}},specularmap:{specularMap:{value:null}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},refractionRatio:{value:.98},maxMipLevel:{value:0}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1}},emissivemap:{emissiveMap:{value:null}},bumpmap:{bumpMap:{value:null},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalScale:{value:new Dt(1,1)}},displacementmap:{displacementMap:{value:null},displacementScale:{value:1},displacementBias:{value:0}},roughnessmap:{roughnessMap:{value:null}},metalnessmap:{metalnessMap:{value:null}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new yi(16777215)}},lights:{ambientLightColor:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{},shadow:{},shadowBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{},shadow:{},shadowBias:{},shadowRadius:{},shadowMapSize:{}}},spotShadowMap:{value:[]},spotShadowMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{},shadow:{},shadowBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}}},points:{diffuse:{value:new yi(15658734)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},uvTransform:{value:new Gt}}},_i={basic:{uniforms:gi.merge([bi.common,bi.specularmap,bi.envmap,bi.aomap,bi.lightmap,bi.fog]),vertexShader:mi.meshbasic_vert,fragmentShader:mi.meshbasic_frag},lambert:{uniforms:gi.merge([bi.common,bi.specularmap,bi.envmap,bi.aomap,bi.lightmap,bi.emissivemap,bi.fog,bi.lights,{emissive:{value:new yi(0)}}]),vertexShader:mi.meshlambert_vert,fragmentShader:mi.meshlambert_frag},phong:{uniforms:gi.merge([bi.common,bi.specularmap,bi.envmap,bi.aomap,bi.lightmap,bi.emissivemap,bi.bumpmap,bi.normalmap,bi.displacementmap,bi.gradientmap,bi.fog,bi.lights,{emissive:{value:new yi(0)},specular:{value:new yi(1118481)},shininess:{value:30}}]),vertexShader:mi.meshphong_vert,fragmentShader:mi.meshphong_frag},standard:{uniforms:gi.merge([bi.common,bi.envmap,bi.aomap,bi.lightmap,bi.emissivemap,bi.bumpmap,bi.normalmap,bi.displacementmap,bi.roughnessmap,bi.metalnessmap,bi.fog,bi.lights,{emissive:{value:new yi(0)},roughness:{value:.5},metalness:{value:.5},envMapIntensity:{value:1}}]),vertexShader:mi.meshphysical_vert,fragmentShader:mi.meshphysical_frag},points:{uniforms:gi.merge([bi.points,bi.fog]),vertexShader:mi.points_vert,fragmentShader:mi.points_frag},dashed:{uniforms:gi.merge([bi.common,bi.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:mi.linedashed_vert,fragmentShader:mi.linedashed_frag},depth:{uniforms:gi.merge([bi.common,bi.displacementmap]),vertexShader:mi.depth_vert,fragmentShader:mi.depth_frag},normal:{uniforms:gi.merge([bi.common,bi.bumpmap,bi.normalmap,bi.displacementmap,{opacity:{value:1}}]),vertexShader:mi.normal_vert,fragmentShader:mi.normal_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:mi.cube_vert,fragmentShader:mi.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:mi.equirect_vert,fragmentShader:mi.equirect_frag},distanceRGBA:{uniforms:gi.merge([bi.common,bi.displacementmap,{referencePosition:{value:new zt},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:mi.distanceRGBA_vert,fragmentShader:mi.distanceRGBA_frag},shadow:{uniforms:gi.merge([bi.lights,bi.fog,{color:{value:new yi(0)},opacity:{value:1}}]),vertexShader:mi.shadow_vert,fragmentShader:mi.shadow_frag}};function Mi(c){var n=new WeakMap;return{get:function(e){return e.isInterleavedBufferAttribute&&(e=e.data),n.get(e)},remove:function(e){e.isInterleavedBufferAttribute&&(e=e.data);var t=n.get(e);t&&(c.deleteBuffer(t.buffer),n.delete(e))},update:function(e,t){e.isInterleavedBufferAttribute&&(e=e.data);var i=n.get(e);void 0===i?n.set(e,function(e,t){var i=e.array,n=e.dynamic?c.DYNAMIC_DRAW:c.STATIC_DRAW,r=c.createBuffer();c.bindBuffer(t,r),c.bufferData(t,i,n),e.onUploadCallback();var a=c.FLOAT;return i instanceof Float32Array?a=c.FLOAT:i instanceof Float64Array?console.warn("THREE.WebGLAttributes: Unsupported data buffer format: Float64Array."):i instanceof Uint16Array?a=c.UNSIGNED_SHORT:i instanceof Int16Array?a=c.SHORT:i instanceof Uint32Array?a=c.UNSIGNED_INT:i instanceof Int32Array?a=c.INT:i instanceof Int8Array?a=c.BYTE:i instanceof Uint8Array&&(a=c.UNSIGNED_BYTE),{buffer:r,type:a,bytesPerElement:i.BYTES_PER_ELEMENT,version:e.version}}(e,t)):i.version<e.version&&(function(e,t,i){var n=t.array,r=t.updateRange;if(c.bindBuffer(i,e),!1===t.dynamic)c.bufferData(i,n,c.STATIC_DRAW);else if(void 0===r.offset&&void 0===r.count){for(var a=0;a<r.length;a++){var o=r[a].count,s=r[a].offset;0!=o&&-1!=o?s>=n.length||o>n.length?console.error("THREE.WebGLObjects.updateBuffer: Buffer overflow."):c.bufferSubData(i,s*n.BYTES_PER_ELEMENT,n.subarray(s,s+o)):0==r&&console.error("THREE.WebGLObjects.updateBuffer: dynamic THREE.BufferAttribute marked as needsUpdate but updateRange.count is 0 for index "+a+", ensure you are using set methods or updating manually.")}r||c.bufferSubData(i,0,n),t.updateRange.length=0}else-1===r.count?c.bufferSubData(i,0,n):0===r.count?console.error("THREE.WebGLObjects.updateBuffer: dynamic THREE.BufferAttribute marked as needsUpdate but updateRange.count is 0, ensure you are using set methods or updating manually."):(c.bufferSubData(i,r.offset*n.BYTES_PER_ELEMENT,n.subarray(r.offset,r.offset+r.count)),r.count=-1)}(i.buffer,e,t),i.version=e.version)}}}function Ei(e,t,i,n){this._x=e||0,this._y=t||0,this._z=i||0,this._order=n||Ei.DefaultOrder}function Ti(){this.mask=1}_i.physical={uniforms:gi.merge([_i.standard.uniforms,{clearCoat:{value:0},clearCoatRoughness:{value:0}}]),vertexShader:mi.meshphysical_vert,fragmentShader:mi.meshphysical_frag},Ei.RotationOrders=["XYZ","YZX","ZXY","XZY","YXZ","ZYX"],Ei.DefaultOrder="XYZ",Object.defineProperties(Ei.prototype,{x:{get:function(){return this._x},set:function(e){this._x=e,this.onChangeCallback()}},y:{get:function(){return this._y},set:function(e){this._y=e,this.onChangeCallback()}},z:{get:function(){return this._z},set:function(e){this._z=e,this.onChangeCallback()}},order:{get:function(){return this._order},set:function(e){this._order=e,this.onChangeCallback()}}}),Object.assign(Ei.prototype,{isEuler:!0,set:function(e,t,i,n){return this._x=e,this._y=t,this._z=i,this._order=n||this._order,this.onChangeCallback(),this},clone:function(){return new this.constructor(this._x,this._y,this._z,this._order)},copy:function(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this.onChangeCallback(),this},setFromRotationMatrix:function(e,t,i){var n=Ut.clamp,r=e.elements,a=r[0],o=r[4],s=r[8],c=r[1],h=r[5],l=r[9],u=r[2],d=r[6],p=r[10];return"XYZ"===(t=t||this._order)?(this._y=Math.asin(n(s,-1,1)),Math.abs(s)<.99999?(this._x=Math.atan2(-l,p),this._z=Math.atan2(-o,a)):(this._x=Math.atan2(d,h),this._z=0)):"YXZ"===t?(this._x=Math.asin(-n(l,-1,1)),Math.abs(l)<.99999?(this._y=Math.atan2(s,p),this._z=Math.atan2(c,h)):(this._y=Math.atan2(-u,a),this._z=0)):"ZXY"===t?(this._x=Math.asin(n(d,-1,1)),Math.abs(d)<.99999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-o,h)):(this._y=0,this._z=Math.atan2(c,a))):"ZYX"===t?(this._y=Math.asin(-n(u,-1,1)),Math.abs(u)<.99999?(this._x=Math.atan2(d,p),this._z=Math.atan2(c,a)):(this._x=0,this._z=Math.atan2(-o,h))):"YZX"===t?(this._z=Math.asin(n(c,-1,1)),Math.abs(c)<.99999?(this._x=Math.atan2(-l,h),this._y=Math.atan2(-u,a)):(this._x=0,this._y=Math.atan2(s,p))):"XZY"===t?(this._z=Math.asin(-n(o,-1,1)),Math.abs(o)<.99999?(this._x=Math.atan2(d,h),this._y=Math.atan2(s,a)):(this._x=Math.atan2(-l,p),this._y=0)):console.warn("THREE.Euler: .setFromRotationMatrix() given unsupported order: "+t),this._order=t,!1!==i&&this.onChangeCallback(),this},setFromQuaternion:(wi=new Ft,function(e,t,i){return wi.makeRotationFromQuaternion(e),this.setFromRotationMatrix(wi,t,i)}),setFromVector3:function(e,t){return this.set(e.x,e.y,e.z,t||this._order)},reorder:(xi=new Ht,function(e){return xi.setFromEuler(this),this.setFromQuaternion(xi,e)}),equals:function(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order},fromArray:function(e){return this._x=e[0],this._y=e[1],this._z=e[2],void 0!==e[3]&&(this._order=e[3]),this.onChangeCallback(),this},toArray:function(e,t){return void 0===e&&(e=[]),void 0===t&&(t=0),e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e},toVector3:function(e){return e?e.set(this._x,this._y,this._z):new zt(this._x,this._y,this._z)},onChange:function(e){return this.onChangeCallback=e,this},onChangeCallback:function(){}}),Object.assign(Ti.prototype,{set:function(e){this.mask=1<<e|0},enable:function(e){this.mask|=1<<e|0},toggle:function(e){this.mask^=1<<e|0},disable:function(e){this.mask&=~(1<<e|0)},test:function(e){return 0!=(this.mask&e.mask)}});var Si,Ai,Li,Ri,Ci,Pi,Oi,Ii,Ni,Bi,Ui,Di,Fi,Hi,zi,Gi,ki,Vi,ji=0;function Wi(){Object.defineProperty(this,"id",{value:ji++}),this.uuid=Ut.generateUUID(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Wi.DefaultUp.clone();var e=new zt,t=new Ei,i=new Ht,n=new zt(1,1,1);t.onChange(function(){i.setFromEuler(t,!1)}),i.onChange(function(){t.setFromQuaternion(i,void 0,!1)}),Object.defineProperties(this,{position:{enumerable:!0,value:e},rotation:{enumerable:!0,value:t},quaternion:{enumerable:!0,value:i},scale:{enumerable:!0,value:n},modelViewMatrix:{value:new Ft},normalMatrix:{value:new Gt}}),this.matrix=new Ft,this.matrixWorld=new Ft,this.matrixAutoUpdate=Wi.DefaultMatrixAutoUpdate,this.matrixWorldNeedsUpdate=!1,this.layers=new Ti,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.userData={}}function Xi(){Wi.call(this),this.type="Camera",this.matrixWorldInverse=new Ft,this.projectionMatrix=new Ft}function qi(e,t,i,n,r,a){Xi.call(this),this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=n,this.near=void 0!==r?r:.1,this.far=void 0!==a?a:2e3,this.updateProjectionMatrix()}function Yi(e,t,i,n,r,a){this.a=e,this.b=t,this.c=i,this.normal=n&&n.isVector3?n:new zt,this.vertexNormals=Array.isArray(n)?n:[],this.color=r&&r.isColor?r:new yi,this.vertexColors=Array.isArray(r)?r:[],this.materialIndex=void 0!==a?a:0}Wi.DefaultUp=new zt(0,1,0),Wi.DefaultMatrixAutoUpdate=!0,Wi.prototype=Object.assign(Object.create(t.prototype),{constructor:Wi,isObject3D:!0,onBeforeRender:function(){},onAfterRender:function(){},applyMatrix:function(e){this.matrix.multiplyMatrices(e,this.matrix),this.matrix.decompose(this.position,this.quaternion,this.scale)},applyQuaternion:function(e){return this.quaternion.premultiply(e),this},setRotationFromAxisAngle:function(e,t){this.quaternion.setFromAxisAngle(e,t)},setRotationFromEuler:function(e){this.quaternion.setFromEuler(e,!0)},setRotationFromMatrix:function(e){this.quaternion.setFromRotationMatrix(e)},setRotationFromQuaternion:function(e){this.quaternion.copy(e)},rotateOnAxis:(ki=new Ht,function(e,t){return ki.setFromAxisAngle(e,t),this.quaternion.multiply(ki),this}),rotateOnWorldAxis:(Gi=new Ht,function(e,t){return Gi.setFromAxisAngle(e,t),this.quaternion.premultiply(Gi),this}),rotateX:(zi=new zt(1,0,0),function(e){return this.rotateOnAxis(zi,e)}),rotateY:(Hi=new zt(0,1,0),function(e){return this.rotateOnAxis(Hi,e)}),rotateZ:(Fi=new zt(0,0,1),function(e){return this.rotateOnAxis(Fi,e)}),translateOnAxis:(Di=new zt,function(e,t){return Di.copy(e).applyQuaternion(this.quaternion),this.position.add(Di.multiplyScalar(t)),this}),translateX:(Ui=new zt(1,0,0),function(e){return this.translateOnAxis(Ui,e)}),translateY:(Bi=new zt(0,1,0),function(e){return this.translateOnAxis(Bi,e)}),translateZ:(Ni=new zt(0,0,1),function(e){return this.translateOnAxis(Ni,e)}),localToWorld:function(e){return e.applyMatrix4(this.matrixWorld)},worldToLocal:(Ii=new Ft,function(e){return e.applyMatrix4(Ii.getInverse(this.matrixWorld))}),lookAt:(Pi=new Ft,Oi=new zt,function(e,t,i){e.isVector3?Oi.copy(e):Oi.set(e,t,i),this.isCamera?Pi.lookAt(this.position,Oi,this.up):Pi.lookAt(Oi,this.position,this.up),this.quaternion.setFromRotationMatrix(Pi)}),add:function(e){if(1<arguments.length){for(var t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?console.error("THREE.Object3D.add: object can't be added as a child of itself.",e):e&&e.isObject3D?(null!==e.parent&&e.parent.remove(e),e.parent=this,e.dispatchEvent({type:"added"}),this.children.push(e)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this},remove:function(e){if(1<arguments.length){for(var t=0;t<arguments.length;t++)this.remove(arguments[t]);return this}var i=this.children.indexOf(e);return-1!==i&&(e.parent=null,e.dispatchEvent({type:"removed"}),this.children.splice(i,1)),this},getObjectById:function(e){return this.getObjectByProperty("id",e)},getObjectByName:function(e){return this.getObjectByProperty("name",e)},getObjectByProperty:function(e,t){if(this[e]===t)return this;for(var i=0,n=this.children.length;i<n;i++){var r=this.children[i].getObjectByProperty(e,t);if(void 0!==r)return r}},getWorldPosition:function(e){return void 0===e&&(console.warn("THREE.Object3D: .getWorldPosition() target is now required"),e=new zt),this.updateMatrixWorld(!0),e.setFromMatrixPosition(this.matrixWorld)},getWorldQuaternion:(Ri=new zt,Ci=new zt,function(e){return void 0===e&&(console.warn("THREE.Object3D: .getWorldQuaternion() target is now required"),e=new Ht),this.updateMatrixWorld(!0),this.matrixWorld.decompose(Ri,e,Ci),e}),getWorldScale:(Ai=new zt,Li=new Ht,function(e){return void 0===e&&(console.warn("THREE.Object3D: .getWorldScale() target is now required"),e=new zt),this.updateMatrixWorld(!0),this.matrixWorld.decompose(Ai,Li,e),e}),getWorldDirection:(Si=new Ht,function(e){return void 0===e&&(console.warn("THREE.Object3D: .getWorldDirection() target is now required"),e=new zt),this.getWorldQuaternion(Si),e.set(0,0,1).applyQuaternion(Si)}),raycast:function(){},traverse:function(e){e(this);for(var t=this.children,i=0,n=t.length;i<n;i++)t[i].traverse(e)},traverseVisible:function(e){if(!1!==this.visible){e(this);for(var t=this.children,i=0,n=t.length;i<n;i++)t[i].traverseVisible(e)}},traverseAncestors:function(e){var t=this.parent;null!==t&&(e(t),t.traverseAncestors(e))},updateMatrix:function(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0},updateMatrixWorld:function(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(null===this.parent?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e=!(this.matrixWorldNeedsUpdate=!1));for(var t=this.children,i=0,n=t.length;i<n;i++)t[i].updateMatrixWorld(e)},toJSON:function(i){var e=void 0===i||"string"==typeof i,t={};e&&(i={geometries:{},materials:{},textures:{},images:{},shapes:{}},t.metadata={version:4.5,type:"Object",generator:"Object3D.toJSON"});var n={};function r(e,t){return void 0===e[t.uuid]&&(e[t.uuid]=t.toJSON(i)),t.uuid}if(n.uuid=this.uuid,n.type=this.type,""!==this.name&&(n.name=this.name),!0===this.castShadow&&(n.castShadow=!0),!0===this.receiveShadow&&(n.receiveShadow=!0),!1===this.visible&&(n.visible=!1),!1===this.frustumCulled&&(n.frustumCulled=!1),0!==this.renderOrder&&(n.renderOrder=this.renderOrder),"{}"!==JSON.stringify(this.userData)&&(n.userData=this.userData),n.matrix=this.matrix.toArray(),!1===this.matrixAutoUpdate&&(n.matrixAutoUpdate=!1),void 0!==this.geometry){n.geometry=r(i.geometries,this.geometry);var a=this.geometry.parameters;if(void 0!==a&&void 0!==a.shapes){var o=a.shapes;if(Array.isArray(o))for(var s=0,c=o.length;s<c;s++){var h=o[s];r(i.shapes,h)}else r(i.shapes,o)}}if(void 0!==this.material)if(Array.isArray(this.material)){var l=[];for(s=0,c=this.material.length;s<c;s++)l.push(r(i.materials,this.material[s]));n.material=l}else n.material=r(i.materials,this.material);if(0<this.children.length){n.children=[];for(s=0;s<this.children.length;s++)n.children.push(this.children[s].toJSON(i).object)}if(e){var u=m(i.geometries),d=m(i.materials),p=m(i.textures),f=m(i.images);o=m(i.shapes);0<u.length&&(t.geometries=u),0<d.length&&(t.materials=d),0<p.length&&(t.textures=p),0<f.length&&(t.images=f),0<o.length&&(t.shapes=o)}return t.object=n,t;function m(e){var t=[];for(var i in e){var n=e[i];delete n.metadata,t.push(n)}return t}},clone:function(e){return(new this.constructor).copy(this,e)},copy:function(e,t){if(void 0===t&&(t=!0),this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.userData=JSON.parse(JSON.stringify(e.userData)),!0===t)for(var i=0;i<e.children.length;i++){var n=e.children[i];this.add(n.clone())}return this}}),Xi.prototype=Object.assign(Object.create(Wi.prototype),{constructor:Xi,isCamera:!0,copy:function(e,t){return Wi.prototype.copy.call(this,e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this},getWorldDirection:(Vi=new Ht,function(e){return void 0===e&&(console.warn("THREE.Camera: .getWorldDirection() target is now required"),e=new zt),this.getWorldQuaternion(Vi),e.set(0,0,-1).applyQuaternion(Vi)}),updateMatrixWorld:function(e){Wi.prototype.updateMatrixWorld.call(this,e),this.matrixWorldInverse.getInverse(this.matrixWorld)},clone:function(){return(new this.constructor).copy(this)}}),qi.prototype=Object.assign(Object.create(Xi.prototype),{constructor:qi,isOrthographicCamera:!0,copy:function(e,t){return Xi.prototype.copy.call(this,e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=null===e.view?null:Object.assign({},e.view),this},setViewOffset:function(e,t,i,n,r,a){null===this.view&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()},clearViewOffset:function(){null!==this.view&&(this.view.enabled=!1),this.updateProjectionMatrix()},updateProjectionMatrix:function(){var e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,n=(this.top+this.bottom)/2,r=i-e,a=i+e,o=n+t,s=n-t;if(null!==this.view&&this.view.enabled){var c=this.zoom/(this.view.width/this.view.fullWidth),h=this.zoom/(this.view.height/this.view.fullHeight),l=(this.right-this.left)/this.view.width,u=(this.top-this.bottom)/this.view.height;a=(r+=l*(this.view.offsetX/c))+l*(this.view.width/c),s=(o-=u*(this.view.offsetY/h))-u*(this.view.height/h)}this.projectionMatrix.makeOrthographic(r,a,o,s,this.near,this.far)},toJSON:function(e){var t=Wi.prototype.toJSON.call(this,e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,null!==this.view&&(t.object.view=Object.assign({},this.view)),t}}),Object.assign(Yi.prototype,{clone:function(){return(new this.constructor).copy(this)},copy:function(e){this.a=e.a,this.b=e.b,this.c=e.c,this.normal.copy(e.normal),this.color.copy(e.color),this.materialIndex=e.materialIndex;for(var t=0,i=e.vertexNormals.length;t<i;t++)this.vertexNormals[t]=e.vertexNormals[t].clone();for(t=0,i=e.vertexColors.length;t<i;t++)this.vertexColors[t]=e.vertexColors[t].clone();return this}});var Zi,Ji,Qi,Ki,$i,en,tn,nn=0;function rn(){Object.defineProperty(this,"id",{value:nn+=2}),this.uuid=Ut.generateUUID(),this.name="",this.type="Geometry",this.vertices=[],this.colors=[],this.faces=[],this.faceVertexUvs=[[]],this.morphTargets=[],this.morphNormals=[],this.skinWeights=[],this.skinIndices=[],this.lineDistances=[],this.boundingBox=null,this.boundingSphere=null,this.elementsNeedUpdate=!1,this.verticesNeedUpdate=!1,this.uvsNeedUpdate=!1,this.normalsNeedUpdate=!1,this.colorsNeedUpdate=!1,this.lineDistancesNeedUpdate=!1,this.groupsNeedUpdate=!1}function an(e,t,i){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.name="",this.array=e,this.itemSize=t,this.count=void 0!==e?e.length/t:0,this.normalized=!0===i,this.dynamic=!1,this.updateRange=[],this.version=0}function on(e,t,i){an.call(this,new Int8Array(e),t,i)}function sn(e,t,i){an.call(this,new Uint8Array(e),t,i)}function cn(e,t,i){an.call(this,new Uint8ClampedArray(e),t,i)}function hn(e,t,i){an.call(this,new Int16Array(e),t,i)}function ln(e,t,i){an.call(this,new Uint16Array(e),t,i)}function un(e,t,i){an.call(this,new Int32Array(e),t,i)}function dn(e,t,i){an.call(this,new Uint32Array(e),t,i)}function pn(e,t,i){an.call(this,new Float32Array(e),t,i)}function fn(e,t,i){an.call(this,new Float64Array(e),t,i)}function mn(){this.vertices=[],this.normals=[],this.colors=[],this.uvs=[],this.uvs2=[],this.groups=[],this.morphTargets={},this.skinWeights=[],this.skinIndices=[],this.boundingBox=null,this.boundingSphere=null,this.verticesNeedUpdate=!1,this.normalsNeedUpdate=!1,this.colorsNeedUpdate=!1,this.uvsNeedUpdate=!1,this.groupsNeedUpdate=!1}function gn(e){if(0===e.length)return-1/0;for(var t=e[0],i=1,n=e.length;i<n;++i)e[i]>t&&(t=e[i]);return t}rn.prototype=Object.assign(Object.create(t.prototype),{constructor:rn,isGeometry:!0,applyMatrix:function(e){for(var t=(new Gt).getNormalMatrix(e),i=0,n=this.vertices.length;i<n;i++){this.vertices[i].applyMatrix4(e)}for(i=0,n=this.faces.length;i<n;i++){var r=this.faces[i];r.normal.applyMatrix3(t).normalize();for(var a=0,o=r.vertexNormals.length;a<o;a++)r.vertexNormals[a].applyMatrix3(t).normalize()}return null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this.verticesNeedUpdate=!0,this.normalsNeedUpdate=!0,this},rotateX:(tn=new Ft,function(e){return tn.makeRotationX(e),this.applyMatrix(tn),this}),rotateY:(en=new Ft,function(e){return en.makeRotationY(e),this.applyMatrix(en),this}),rotateZ:($i=new Ft,function(e){return $i.makeRotationZ(e),this.applyMatrix($i),this}),translate:(Ki=new Ft,function(e,t,i){return Ki.makeTranslation(e,t,i),this.applyMatrix(Ki),this}),scale:(Qi=new Ft,function(e,t,i){return Qi.makeScale(e,t,i),this.applyMatrix(Qi),this}),lookAt:(Ji=new Wi,function(e){Ji.lookAt(e),Ji.updateMatrix(),this.applyMatrix(Ji.matrix)}),fromBufferGeometry:function(e){var a=this,t=null!==e.index?e.index.array:void 0,i=e.attributes,n=i.position.array,o=void 0!==i.normal?i.normal.array:void 0,s=void 0!==i.color?i.color.array:void 0,c=void 0!==i.uv?i.uv.array:void 0,h=void 0!==i.uv2?i.uv2.array:void 0;void 0!==h&&(this.faceVertexUvs[1]=[]);for(var l=[],u=[],d=[],r=0,p=0;r<n.length;r+=3,p+=2)a.vertices.push(new zt(n[r],n[r+1],n[r+2])),void 0!==o&&l.push(new zt(o[r],o[r+1],o[r+2])),void 0!==s&&a.colors.push(new yi(s[r],s[r+1],s[r+2])),void 0!==c&&u.push(new Dt(c[p],c[p+1])),void 0!==h&&d.push(new Dt(h[p],h[p+1]));function f(e,t,i,n){var r=new Yi(e,t,i,void 0!==o?[l[e].clone(),l[t].clone(),l[i].clone()]:[],void 0!==s?[a.colors[e].clone(),a.colors[t].clone(),a.colors[i].clone()]:[],n);a.faces.push(r),void 0!==c&&a.faceVertexUvs[0].push([u[e].clone(),u[t].clone(),u[i].clone()]),void 0!==h&&a.faceVertexUvs[1].push([d[e].clone(),d[t].clone(),d[i].clone()])}var m=e.groups;if(0<m.length)for(r=0;r<m.length;r++)for(var g=m[r],v=g.start,y=(p=v,v+g.count);p<y;p+=3)void 0!==t?f(t[p],t[p+1],t[p+2],g.materialIndex):f(p,p+1,p+2,g.materialIndex);else if(void 0!==t)for(r=0;r<t.length;r+=3)f(t[r],t[r+1],t[r+2]);else for(r=0;r<n.length/3;r+=3)f(r,r+1,r+2);return this.computeFaceNormals(),null!==e.boundingBox&&(this.boundingBox=e.boundingBox.clone()),null!==e.boundingSphere&&(this.boundingSphere=e.boundingSphere.clone()),this},center:(Zi=new zt,function(){return this.computeBoundingBox(),this.boundingBox.getCenter(Zi).negate(),this.translate(Zi.x,Zi.y,Zi.z),this}),normalize:function(){this.computeBoundingSphere();var e=this.boundingSphere.center,t=this.boundingSphere.radius,i=0===t?1:1/t,n=new Ft;return n.set(i,0,0,-i*e.x,0,i,0,-i*e.y,0,0,i,-i*e.z,0,0,0,1),this.applyMatrix(n),this},computeFaceNormals:function(){for(var e=new zt,t=new zt,i=0,n=this.faces.length;i<n;i++){var r=this.faces[i],a=this.vertices[r.a],o=this.vertices[r.b],s=this.vertices[r.c];e.subVectors(s,o),t.subVectors(a,o),e.cross(t),e.normalize(),r.normal.copy(e)}},computeVertexNormals:function(e){var t,i,n,r,a,o;for(void 0===e&&(e=!0),o=new Array(this.vertices.length),t=0,i=this.vertices.length;t<i;t++)o[t]=new zt;if(e){var s,c,h,l=new zt,u=new zt;for(n=0,r=this.faces.length;n<r;n++)a=this.faces[n],s=this.vertices[a.a],c=this.vertices[a.b],h=this.vertices[a.c],l.subVectors(h,c),u.subVectors(s,c),l.cross(u),o[a.a].add(l),o[a.b].add(l),o[a.c].add(l)}else for(this.computeFaceNormals(),n=0,r=this.faces.length;n<r;n++)o[(a=this.faces[n]).a].add(a.normal),o[a.b].add(a.normal),o[a.c].add(a.normal);for(t=0,i=this.vertices.length;t<i;t++)o[t].normalize();for(n=0,r=this.faces.length;n<r;n++){var d=(a=this.faces[n]).vertexNormals;3===d.length?(d[0].copy(o[a.a]),d[1].copy(o[a.b]),d[2].copy(o[a.c])):(d[0]=o[a.a].clone(),d[1]=o[a.b].clone(),d[2]=o[a.c].clone())}0<this.faces.length&&(this.normalsNeedUpdate=!0)},computeFlatVertexNormals:function(){var e,t,i;for(this.computeFaceNormals(),e=0,t=this.faces.length;e<t;e++){var n=(i=this.faces[e]).vertexNormals;3===n.length?(n[0].copy(i.normal),n[1].copy(i.normal),n[2].copy(i.normal)):(n[0]=i.normal.clone(),n[1]=i.normal.clone(),n[2]=i.normal.clone())}0<this.faces.length&&(this.normalsNeedUpdate=!0)},computeMorphNormals:function(){var e,t,i,n,r;for(i=0,n=this.faces.length;i<n;i++)for((r=this.faces[i]).__originalFaceNormal?r.__originalFaceNormal.copy(r.normal):r.__originalFaceNormal=r.normal.clone(),r.__originalVertexNormals||(r.__originalVertexNormals=[]),e=0,t=r.vertexNormals.length;e<t;e++)r.__originalVertexNormals[e]?r.__originalVertexNormals[e].copy(r.vertexNormals[e]):r.__originalVertexNormals[e]=r.vertexNormals[e].clone();var a=new rn;for(a.faces=this.faces,e=0,t=this.morphTargets.length;e<t;e++){if(!this.morphNormals[e]){this.morphNormals[e]={},this.morphNormals[e].faceNormals=[],this.morphNormals[e].vertexNormals=[];var o=this.morphNormals[e].faceNormals,s=this.morphNormals[e].vertexNormals;for(i=0,n=this.faces.length;i<n;i++)c=new zt,h={a:new zt,b:new zt,c:new zt},o.push(c),s.push(h)}var c,h,l=this.morphNormals[e];for(a.vertices=this.morphTargets[e].vertices,a.computeFaceNormals(),a.computeVertexNormals(),i=0,n=this.faces.length;i<n;i++)r=this.faces[i],c=l.faceNormals[i],h=l.vertexNormals[i],c.copy(r.normal),h.a.copy(r.vertexNormals[0]),h.b.copy(r.vertexNormals[1]),h.c.copy(r.vertexNormals[2])}for(i=0,n=this.faces.length;i<n;i++)(r=this.faces[i]).normal=r.__originalFaceNormal,r.vertexNormals=r.__originalVertexNormals},computeBoundingBox:function(){null===this.boundingBox&&(this.boundingBox=new li),this.boundingBox.setFromPoints(this.vertices)},computeBoundingSphere:function(){null===this.boundingSphere&&(this.boundingSphere=new ui),this.boundingSphere.setFromPoints(this.vertices)},merge:function(e,t,i){if(e&&e.isGeometry){var n,r=this.vertices.length,a=this.vertices,o=e.vertices,s=this.faces,c=e.faces,h=this.faceVertexUvs[0],l=e.faceVertexUvs[0],u=this.colors,d=e.colors;void 0===i&&(i=0),void 0!==t&&(n=(new Gt).getNormalMatrix(t));for(var p=0,f=o.length;p<f;p++){var m=o[p].clone();void 0!==t&&m.applyMatrix4(t),a.push(m)}for(p=0,f=d.length;p<f;p++)u.push(d[p].clone());for(p=0,f=c.length;p<f;p++){var g,v,y,x=c[p],w=x.vertexNormals,b=x.vertexColors;(g=new Yi(x.a+r,x.b+r,x.c+r)).normal.copy(x.normal),void 0!==n&&g.normal.applyMatrix3(n).normalize();for(var _=0,M=w.length;_<M;_++)v=w[_].clone(),void 0!==n&&v.applyMatrix3(n).normalize(),g.vertexNormals.push(v);g.color.copy(x.color);for(_=0,M=b.length;_<M;_++)y=b[_],g.vertexColors.push(y.clone());g.materialIndex=x.materialIndex+i,s.push(g)}for(p=0,f=l.length;p<f;p++){var E=l[p],T=[];if(void 0!==E){for(_=0,M=E.length;_<M;_++)T.push(E[_].clone());h.push(T)}}}else console.error("THREE.Geometry.merge(): geometry not an instance of THREE.Geometry.",e)},mergeMesh:function(e){e&&e.isMesh?(e.matrixAutoUpdate&&e.updateMatrix(),this.merge(e.geometry,e.matrix)):console.error("THREE.Geometry.mergeMesh(): mesh not an instance of THREE.Mesh.",e)},mergeVertices:function(){var e,t,i,n,r,a,o,s,c={},h=[],l=[],u=Math.pow(10,4);for(i=0,n=this.vertices.length;i<n;i++)e=this.vertices[i],void 0===c[t=Math.round(e.x*u)+"_"+Math.round(e.y*u)+"_"+Math.round(e.z*u)]?(c[t]=i,h.push(this.vertices[i]),l[i]=h.length-1):l[i]=l[c[t]];var d=[];for(i=0,n=this.faces.length;i<n;i++){(r=this.faces[i]).a=l[r.a],r.b=l[r.b],r.c=l[r.c],a=[r.a,r.b,r.c];for(var p=0;p<3;p++)if(a[p]===a[(p+1)%3]){d.push(i);break}}for(i=d.length-1;0<=i;i--){var f=d[i];for(this.faces.splice(f,1),o=0,s=this.faceVertexUvs.length;o<s;o++)this.faceVertexUvs[o].splice(f,1)}var m=this.vertices.length-h.length;return this.vertices=h,m},setFromPoints:function(e){this.vertices=[];for(var t=0,i=e.length;t<i;t++){var n=e[t];this.vertices.push(new zt(n.x,n.y,n.z||0))}return this},sortFacesByMaterialIndex:function(){for(var e=this.faces,t=e.length,i=0;i<t;i++)e[i]._id=i;e.sort(function(e,t){return e.materialIndex-t.materialIndex});var n,r,a=this.faceVertexUvs[0],o=this.faceVertexUvs[1];a&&a.length===t&&(n=[]),o&&o.length===t&&(r=[]);for(i=0;i<t;i++){var s=e[i]._id;n&&n.push(a[s]),r&&r.push(o[s])}n&&(this.faceVertexUvs[0]=n),r&&(this.faceVertexUvs[1]=r)},toJSON:function(){var e={metadata:{version:4.5,type:"Geometry",generator:"Geometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,""!==this.name&&(e.name=this.name),void 0!==this.parameters){var t=this.parameters;for(var i in t)void 0!==t[i]&&(e[i]=t[i]);return e}for(var n=[],r=0;r<this.vertices.length;r++){var a=this.vertices[r];n.push(a.x,a.y,a.z)}var o=[],s=[],c={},h=[],l={},u=[],d={};for(r=0;r<this.faces.length;r++){var p=this.faces[r],f=void 0!==this.faceVertexUvs[0][r],m=0<p.normal.length(),g=0<p.vertexNormals.length,v=1!==p.color.r||1!==p.color.g||1!==p.color.b,y=0<p.vertexColors.length,x=0;if(x=M(x=M(x=M(x=M(x=M(x=M(x=M(x=M(x,0,0),1,!0),2,!1),3,f),4,m),5,g),6,v),7,y),o.push(x),o.push(p.a,p.b,p.c),o.push(p.materialIndex),f){var w=this.faceVertexUvs[0][r];o.push(S(w[0]),S(w[1]),S(w[2]))}if(m&&o.push(E(p.normal)),g){var b=p.vertexNormals;o.push(E(b[0]),E(b[1]),E(b[2]))}if(v&&o.push(T(p.color)),y){var _=p.vertexColors;o.push(T(_[0]),T(_[1]),T(_[2]))}}function M(e,t,i){return i?e|1<<t:e&~(1<<t)}function E(e){var t=e.x.toString()+e.y.toString()+e.z.toString();return void 0!==c[t]||(c[t]=s.length/3,s.push(e.x,e.y,e.z)),c[t]}function T(e){var t=e.r.toString()+e.g.toString()+e.b.toString();return void 0!==l[t]||(l[t]=h.length,h.push(e.getHex())),l[t]}function S(e){var t=e.x.toString()+e.y.toString();return void 0!==d[t]||(d[t]=u.length/2,u.push(e.x,e.y)),d[t]}return e.data={},e.data.vertices=n,e.data.normals=s,0<h.length&&(e.data.colors=h),0<u.length&&(e.data.uvs=[u]),e.data.faces=o,e},clone:function(){return(new rn).copy(this)},copy:function(e){var t,i,n,r,a,o;this.vertices=[],this.colors=[],this.faces=[],this.faceVertexUvs=[[]],this.morphTargets=[],this.morphNormals=[],this.skinWeights=[],this.skinIndices=[],this.lineDistances=[],this.boundingBox=null,this.boundingSphere=null,this.name=e.name;var s=e.vertices;for(t=0,i=s.length;t<i;t++)this.vertices.push(s[t].clone());var c=e.colors;for(t=0,i=c.length;t<i;t++)this.colors.push(c[t].clone());var h=e.faces;for(t=0,i=h.length;t<i;t++)this.faces.push(h[t].clone());for(t=0,i=e.faceVertexUvs.length;t<i;t++){var l=e.faceVertexUvs[t];for(void 0===this.faceVertexUvs[t]&&(this.faceVertexUvs[t]=[]),n=0,r=l.length;n<r;n++){var u=l[n],d=[];for(a=0,o=u.length;a<o;a++){var p=u[a];d.push(p.clone())}this.faceVertexUvs[t].push(d)}}var f=e.morphTargets;for(t=0,i=f.length;t<i;t++){var m={};if(m.name=f[t].name,void 0!==f[t].vertices)for(m.vertices=[],n=0,r=f[t].vertices.length;n<r;n++)m.vertices.push(f[t].vertices[n].clone());if(void 0!==f[t].normals)for(m.normals=[],n=0,r=f[t].normals.length;n<r;n++)m.normals.push(f[t].normals[n].clone());this.morphTargets.push(m)}var g=e.morphNormals;for(t=0,i=g.length;t<i;t++){var v={};if(void 0!==g[t].vertexNormals)for(v.vertexNormals=[],n=0,r=g[t].vertexNormals.length;n<r;n++){var y=g[t].vertexNormals[n],x={};x.a=y.a.clone(),x.b=y.b.clone(),x.c=y.c.clone(),v.vertexNormals.push(x)}if(void 0!==g[t].faceNormals)for(v.faceNormals=[],n=0,r=g[t].faceNormals.length;n<r;n++)v.faceNormals.push(g[t].faceNormals[n].clone());this.morphNormals.push(v)}var w=e.skinWeights;for(t=0,i=w.length;t<i;t++)this.skinWeights.push(w[t].clone());var b=e.skinIndices;for(t=0,i=b.length;t<i;t++)this.skinIndices.push(b[t].clone());var _=e.lineDistances;for(t=0,i=_.length;t<i;t++)this.lineDistances.push(_[t]);var M=e.boundingBox;null!==M&&(this.boundingBox=M.clone());var E=e.boundingSphere;return null!==E&&(this.boundingSphere=E.clone()),this.elementsNeedUpdate=e.elementsNeedUpdate,this.verticesNeedUpdate=e.verticesNeedUpdate,this.uvsNeedUpdate=e.uvsNeedUpdate,this.normalsNeedUpdate=e.normalsNeedUpdate,this.colorsNeedUpdate=e.colorsNeedUpdate,this.lineDistancesNeedUpdate=e.lineDistancesNeedUpdate,this.groupsNeedUpdate=e.groupsNeedUpdate,this},dispose:function(){this.dispatchEvent({type:"dispose"})}}),Object.defineProperty(an.prototype,"needsUpdate",{set:function(e){!0===e&&this.version++}}),Object.assign(an.prototype,{isBufferAttribute:!0,onUploadCallback:function(){},setArray:function(e){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");return this.count=void 0!==e?e.length/this.itemSize:0,this.array=e,this},setDynamic:function(e){return this.dynamic=e,this},copy:function(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.dynamic=e.dynamic,this},copyAt:function(e,t,i){e*=this.itemSize,i*=t.itemSize;for(var n=0,r=this.itemSize;n<r;n++)this.array[e+n]=t.array[i+n];return this},copyArray:function(e){return this.array.set(e),this},copyColorsArray:function(e){for(var t=this.array,i=0,n=0,r=e.length;n<r;n++){var a=e[n];void 0===a&&(console.warn("THREE.BufferAttribute.copyColorsArray(): color is undefined",n),a=new yi),t[i++]=a.r,t[i++]=a.g,t[i++]=a.b}return this},copyVector2sArray:function(e){for(var t=this.array,i=0,n=0,r=e.length;n<r;n++){var a=e[n];void 0===a&&(console.warn("THREE.BufferAttribute.copyVector2sArray(): vector is undefined",n),a=new Dt),t[i++]=a.x,t[i++]=a.y}return this},copyVector3sArray:function(e){for(var t=this.array,i=0,n=0,r=e.length;n<r;n++){var a=e[n];void 0===a&&(console.warn("THREE.BufferAttribute.copyVector3sArray(): vector is undefined",n),a=new zt),t[i++]=a.x,t[i++]=a.y,t[i++]=a.z}return this},copyVector4sArray:function(e){for(var t=this.array,i=0,n=0,r=e.length;n<r;n++){var a=e[n];void 0===a&&(console.warn("THREE.BufferAttribute.copyVector4sArray(): vector is undefined",n),a=new oi),t[i++]=a.x,t[i++]=a.y,t[i++]=a.z,t[i++]=a.w}return this},set:function(e,t){return void 0===t&&(t=0),this.array.set(e,t),this},getX:function(e){return this.array[e*this.itemSize]},setX:function(e,t){return this.array[e*this.itemSize]=t,this},getY:function(e){return this.array[e*this.itemSize+1]},setY:function(e,t){return this.array[e*this.itemSize+1]=t,this},getZ:function(e){return this.array[e*this.itemSize+2]},setZ:function(e,t){return this.array[e*this.itemSize+2]=t,this},getW:function(e){return this.array[e*this.itemSize+3]},setW:function(e,t){return this.array[e*this.itemSize+3]=t,this},setXY:function(e,t,i){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=i,this},setXYZ:function(e,t,i,n){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=n,this},setXYZW:function(e,t,i,n,r){return e*=this.itemSize,this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=n,this.array[e+3]=r,this},onUpload:function(e){return this.onUploadCallback=e,this},clone:function(){return new this.constructor(this.array,this.itemSize).copy(this)}}),(on.prototype=Object.create(an.prototype)).constructor=on,(sn.prototype=Object.create(an.prototype)).constructor=sn,(cn.prototype=Object.create(an.prototype)).constructor=cn,(hn.prototype=Object.create(an.prototype)).constructor=hn,(ln.prototype=Object.create(an.prototype)).constructor=ln,(un.prototype=Object.create(an.prototype)).constructor=un,(dn.prototype=Object.create(an.prototype)).constructor=dn,(pn.prototype=Object.create(an.prototype)).constructor=pn,(fn.prototype=Object.create(an.prototype)).constructor=fn,Object.assign(mn.prototype,{computeGroups:function(e){for(var t,i=[],n=void 0,r=e.faces,a=0;a<r.length;a++){var o=r[a];o.materialIndex!==n&&(n=o.materialIndex,void 0!==t&&(t.count=3*a-t.start,i.push(t)),t={start:3*a,materialIndex:n})}void 0!==t&&(t.count=3*a-t.start,i.push(t)),this.groups=i},fromGeometry:function(e){var t,i=e.faces,n=e.vertices,r=e.faceVertexUvs,a=r[0]&&0<r[0].length,o=r[1]&&0<r[1].length,s=e.morphTargets,c=s.length;if(0<c){t=[];for(var h=0;h<c;h++)t[h]=[];this.morphTargets.position=t}var l,u=e.morphNormals,d=u.length;if(0<d){l=[];for(h=0;h<d;h++)l[h]=[];this.morphTargets.normal=l}var p=e.skinIndices,f=e.skinWeights,m=p.length===n.length,g=f.length===n.length;for(h=0;h<i.length;h++){var v=i[h];this.vertices.push(n[v.a],n[v.b],n[v.c]);var y=v.vertexNormals;if(3===y.length)this.normals.push(y[0],y[1],y[2]);else{var x=v.normal;this.normals.push(x,x,x)}var w,b=v.vertexColors;if(3===b.length)this.colors.push(b[0],b[1],b[2]);else{var _=v.color;this.colors.push(_,_,_)}if(!0===a)void 0!==(w=r[0][h])?this.uvs.push(w[0],w[1],w[2]):(console.warn("THREE.DirectGeometry.fromGeometry(): Undefined vertexUv ",h),this.uvs.push(new Dt,new Dt,new Dt));if(!0===o)void 0!==(w=r[1][h])?this.uvs2.push(w[0],w[1],w[2]):(console.warn("THREE.DirectGeometry.fromGeometry(): Undefined vertexUv2 ",h),this.uvs2.push(new Dt,new Dt,new Dt));for(var M=0;M<c;M++){var E=s[M].vertices;t[M].push(E[v.a],E[v.b],E[v.c])}for(M=0;M<d;M++){var T=u[M].vertexNormals[h];l[M].push(T.a,T.b,T.c)}m&&this.skinIndices.push(p[v.a],p[v.b],p[v.c]),g&&this.skinWeights.push(f[v.a],f[v.b],f[v.c])}return this.computeGroups(e),this.verticesNeedUpdate=e.verticesNeedUpdate,this.normalsNeedUpdate=e.normalsNeedUpdate,this.colorsNeedUpdate=e.colorsNeedUpdate,this.uvsNeedUpdate=e.uvsNeedUpdate,this.groupsNeedUpdate=e.groupsNeedUpdate,this}});var vn,yn,xn,wn,bn,_n,Mn,En,Tn,Sn,An=1;function Ln(){Object.defineProperty(this,"id",{value:An+=2}),this.uuid=Ut.generateUUID(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0}}function Rn(e,t,i,n,r,a){rn.call(this),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:n,heightSegments:r,depthSegments:a},this.fromBufferGeometry(new Cn(e,t,i,n,r,a)),this.mergeVertices()}function Cn(e,t,i,n,r,a){Ln.call(this),this.type="BoxBufferGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:n,heightSegments:r,depthSegments:a};var R=this;e=e||1,t=t||1,i=i||1,n=Math.floor(n)||1,r=Math.floor(r)||1,a=Math.floor(a)||1;var C=[],P=[],O=[],I=[],N=0,B=0;function o(e,t,i,n,r,a,o,s,c,h,l){var u,d,p=a/c,f=o/h,m=a/2,g=o/2,v=s/2,y=c+1,x=h+1,w=0,b=0,_=new zt;for(d=0;d<x;d++){var M=d*f-g;for(u=0;u<y;u++){var E=u*p-m;_[e]=E*n,_[t]=M*r,_[i]=v,P.push(_.x,_.y,_.z),_[e]=0,_[t]=0,_[i]=0<s?1:-1,O.push(_.x,_.y,_.z),I.push(u/c),I.push(1-d/h),w+=1}}for(d=0;d<h;d++)for(u=0;u<c;u++){var T=N+u+y*d,S=N+u+y*(d+1),A=N+(u+1)+y*(d+1),L=N+(u+1)+y*d;C.push(T,S,L),C.push(S,A,L),b+=6}R.addGroup(B,b,l),B+=b,N+=w}o("z","y","x",-1,-1,i,t,e,a,r,0),o("z","y","x",1,-1,i,t,-e,a,r,1),o("x","z","y",1,1,e,i,t,n,a,2),o("x","z","y",1,-1,e,i,-t,n,a,3),o("x","y","z",1,-1,e,t,i,n,r,4),o("x","y","z",-1,-1,e,t,-i,n,r,5),this.setIndex(C),this.addAttribute("position",new pn(P,3)),this.addAttribute("normal",new pn(O,3)),this.addAttribute("uv",new pn(I,2))}function Pn(e,t,i,n){rn.call(this),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:n},this.fromBufferGeometry(new On(e,t,i,n)),this.mergeVertices()}function On(e,t,i,n){Ln.call(this),this.type="PlaneBufferGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:n};var r,a,o=(e=e||1)/2,s=(t=t||1)/2,c=Math.floor(i)||1,h=Math.floor(n)||1,l=c+1,u=h+1,d=e/c,p=t/h,f=[],m=[],g=[],v=[];for(a=0;a<u;a++){var y=a*p-s;for(r=0;r<l;r++){var x=r*d-o;m.push(x,-y,0),g.push(0,0,1),v.push(r/c),v.push(1-a/h)}}for(a=0;a<h;a++)for(r=0;r<c;r++){var w=r+l*a,b=r+l*(a+1),_=r+1+l*(a+1),M=r+1+l*a;f.push(w,b,M),f.push(b,_,M)}this.setIndex(f),this.addAttribute("position",new pn(m,3)),this.addAttribute("normal",new pn(g,3)),this.addAttribute("uv",new pn(v,2))}Ln.prototype=Object.assign(Object.create(t.prototype),{constructor:Ln,isBufferGeometry:!0,getIndex:function(){return this.index},setIndex:function(e){Array.isArray(e)?this.index=new(65535<gn(e)?dn:ln)(e,1):this.index=e},addAttribute:function(e,t){return t&&t.isBufferAttribute||t&&t.isInterleavedBufferAttribute?("index"===e?(console.warn("THREE.BufferGeometry.addAttribute: Use .setIndex() for index attribute."),this.setIndex(t)):this.attributes[e]=t,this):(console.warn("THREE.BufferGeometry: .addAttribute() now expects ( name, attribute )."),this.addAttribute(e,new an(t,arguments[2])))},getAttribute:function(e){return this.attributes[e]},removeAttribute:function(e){return delete this.attributes[e],this},addGroup:function(e,t,i){this.groups.push({start:e,count:t,materialIndex:void 0!==i?i:0})},clearGroups:function(){this.groups=[]},setDrawRange:function(e,t){this.drawRange.start=e,this.drawRange.count=t},applyMatrix:function(e){var t=this.attributes.position;void 0!==t&&(e.applyToBufferAttribute(t),t.needsUpdate=!0);var i=this.attributes.normal;void 0!==i&&((new Gt).getNormalMatrix(e).applyToBufferAttribute(i),i.needsUpdate=!0);return null!==this.boundingBox&&this.computeBoundingBox(),null!==this.boundingSphere&&this.computeBoundingSphere(),this},rotateX:(Sn=new Ft,function(e){return Sn.makeRotationX(e),this.applyMatrix(Sn),this}),rotateY:(Tn=new Ft,function(e){return Tn.makeRotationY(e),this.applyMatrix(Tn),this}),rotateZ:(En=new Ft,function(e){return En.makeRotationZ(e),this.applyMatrix(En),this}),translate:(Mn=new Ft,function(e,t,i){return Mn.makeTranslation(e,t,i),this.applyMatrix(Mn),this}),scale:(_n=new Ft,function(e,t,i){return _n.makeScale(e,t,i),this.applyMatrix(_n),this}),lookAt:(bn=new Wi,function(e){bn.lookAt(e),bn.updateMatrix(),this.applyMatrix(bn.matrix)}),center:(wn=new zt,function(){return this.computeBoundingBox(),this.boundingBox.getCenter(wn).negate(),this.translate(wn.x,wn.y,wn.z),this}),setFromObject:function(e){var t=e.geometry;if(e.isPoints||e.isLine){var i=new pn(3*t.vertices.length,3),n=new pn(3*t.colors.length,3);if(this.addAttribute("position",i.copyVector3sArray(t.vertices)),this.addAttribute("color",n.copyColorsArray(t.colors)),t.lineDistances&&t.lineDistances.length===t.vertices.length){var r=new pn(t.lineDistances.length,1);this.addAttribute("lineDistance",r.copyArray(t.lineDistances))}null!==t.boundingSphere&&(this.boundingSphere=t.boundingSphere.clone()),null!==t.boundingBox&&(this.boundingBox=t.boundingBox.clone())}else e.isMesh&&t&&t.isGeometry&&this.fromGeometry(t);return this},setFromPoints:function(e){for(var t=[],i=0,n=e.length;i<n;i++){var r=e[i];t.push(r.x,r.y,r.z||0)}return this.addAttribute("position",new pn(t,3)),this},updateFromObject:function(e){var t,i=e.geometry;if(e.isMesh){var n=i.__directGeometry;if(!0===i.elementsNeedUpdate&&(n=void 0,i.elementsNeedUpdate=!1),void 0===n)return this.fromGeometry(i);n.verticesNeedUpdate=i.verticesNeedUpdate,n.normalsNeedUpdate=i.normalsNeedUpdate,n.colorsNeedUpdate=i.colorsNeedUpdate,n.uvsNeedUpdate=i.uvsNeedUpdate,n.groupsNeedUpdate=i.groupsNeedUpdate,i.verticesNeedUpdate=!1,i.normalsNeedUpdate=!1,i.colorsNeedUpdate=!1,i.uvsNeedUpdate=!1,i.groupsNeedUpdate=!1,i=n}return!0===i.verticesNeedUpdate&&(void 0!==(t=this.attributes.position)&&(t.copyVector3sArray(i.vertices),t.needsUpdate=!0),i.verticesNeedUpdate=!1),!0===i.normalsNeedUpdate&&(void 0!==(t=this.attributes.normal)&&(t.copyVector3sArray(i.normals),t.needsUpdate=!0),i.normalsNeedUpdate=!1),!0===i.colorsNeedUpdate&&(void 0!==(t=this.attributes.color)&&(t.copyColorsArray(i.colors),t.needsUpdate=!0),i.colorsNeedUpdate=!1),i.uvsNeedUpdate&&(void 0!==(t=this.attributes.uv)&&(t.copyVector2sArray(i.uvs),t.needsUpdate=!0),i.uvsNeedUpdate=!1),i.lineDistancesNeedUpdate&&(void 0!==(t=this.attributes.lineDistance)&&(t.copyArray(i.lineDistances),t.needsUpdate=!0),i.lineDistancesNeedUpdate=!1),i.groupsNeedUpdate&&(i.computeGroups(e.geometry),this.groups=i.groups,i.groupsNeedUpdate=!1),this},fromGeometry:function(e){return e.__directGeometry=(new mn).fromGeometry(e),this.fromDirectGeometry(e.__directGeometry)},fromDirectGeometry:function(e){var t=new Float32Array(3*e.vertices.length);if(this.addAttribute("position",new an(t,3).copyVector3sArray(e.vertices)),0<e.normals.length){var i=new Float32Array(3*e.normals.length);this.addAttribute("normal",new an(i,3).copyVector3sArray(e.normals))}if(0<e.colors.length){var n=new Float32Array(3*e.colors.length);this.addAttribute("color",new an(n,3).copyColorsArray(e.colors))}if(0<e.uvs.length){var r=new Float32Array(2*e.uvs.length);this.addAttribute("uv",new an(r,2).copyVector2sArray(e.uvs))}if(0<e.uvs2.length){var a=new Float32Array(2*e.uvs2.length);this.addAttribute("uv2",new an(a,2).copyVector2sArray(e.uvs2))}for(var o in this.groups=e.groups,e.morphTargets){for(var s=[],c=e.morphTargets[o],h=0,l=c.length;h<l;h++){var u=c[h],d=new pn(3*u.length,3);s.push(d.copyVector3sArray(u))}this.morphAttributes[o]=s}if(0<e.skinIndices.length){var p=new pn(4*e.skinIndices.length,4);this.addAttribute("skinIndex",p.copyVector4sArray(e.skinIndices))}if(0<e.skinWeights.length){var f=new pn(4*e.skinWeights.length,4);this.addAttribute("skinWeight",f.copyVector4sArray(e.skinWeights))}return null!==e.boundingSphere&&(this.boundingSphere=e.boundingSphere.clone()),null!==e.boundingBox&&(this.boundingBox=e.boundingBox.clone()),this},computeBoundingBox:function(){null===this.boundingBox&&(this.boundingBox=new li);var e=this.attributes.position;void 0!==e?this.boundingBox.setFromBufferAttribute(e):this.boundingBox.makeEmpty(),(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox: Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)},computeBoundingSphere:(yn=new li,xn=new zt,function(){null===this.boundingSphere&&(this.boundingSphere=new ui);var e=this.attributes.position;if(e){var t=this.boundingSphere.center;yn.setFromBufferAttribute(e),yn.getCenter(t);for(var i=0,n=0,r=e.count;n<r;n++)xn.x=e.getX(n),xn.y=e.getY(n),xn.z=e.getZ(n),i=Math.max(i,t.distanceToSquared(xn));this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}),computeFaceNormals:function(){},computeVertexNormals:function(){var e=this.index,t=this.attributes,i=this.groups;if(t.position){var n=t.position.array;if(void 0===t.normal)this.addAttribute("normal",new an(new Float32Array(n.length),3));else for(var r=t.normal.array,a=0,o=r.length;a<o;a++)r[a]=0;var s,c,h,l=t.normal.array,u=new zt,d=new zt,p=new zt,f=new zt,m=new zt;if(e){var g=e.array;0===i.length&&this.addGroup(0,g.length);for(var v=0,y=i.length;v<y;++v){var x=i[v],w=x.start;for(a=w,o=w+x.count;a<o;a+=3)s=3*g[a+0],c=3*g[a+1],h=3*g[a+2],u.fromArray(n,s),d.fromArray(n,c),p.fromArray(n,h),f.subVectors(p,d),m.subVectors(u,d),f.cross(m),l[s]+=f.x,l[s+1]+=f.y,l[s+2]+=f.z,l[c]+=f.x,l[c+1]+=f.y,l[c+2]+=f.z,l[h]+=f.x,l[h+1]+=f.y,l[h+2]+=f.z}}else for(a=0,o=n.length;a<o;a+=9)u.fromArray(n,a),d.fromArray(n,a+3),p.fromArray(n,a+6),f.subVectors(p,d),m.subVectors(u,d),f.cross(m),l[a]=f.x,l[a+1]=f.y,l[a+2]=f.z,l[a+3]=f.x,l[a+4]=f.y,l[a+5]=f.z,l[a+6]=f.x,l[a+7]=f.y,l[a+8]=f.z;this.normalizeNormals(),t.normal.needsUpdate=!0}},merge:function(e,t){if(e&&e.isBufferGeometry){void 0===t&&(t=0,console.warn("THREE.BufferGeometry.merge(): Overwriting original geometry, starting at offset=0. Use BufferGeometryUtils.mergeBufferGeometries() for lossless merge."));var i=this.attributes;for(var n in i)if(void 0!==e.attributes[n])for(var r=i[n].array,a=e.attributes[n],o=a.array,s=0,c=a.itemSize*t;s<o.length;s++,c++)r[c]=o[s];return this}console.error("THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.",e)},normalizeNormals:(vn=new zt,function(){for(var e=this.attributes.normal,t=0,i=e.count;t<i;t++)vn.x=e.getX(t),vn.y=e.getY(t),vn.z=e.getZ(t),vn.normalize(),e.setXYZ(t,vn.x,vn.y,vn.z)}),toNonIndexed:function(){if(null===this.index)return console.warn("THREE.BufferGeometry.toNonIndexed(): Geometry is already non-indexed."),this;var e=new Ln,t=this.index.array,i=this.attributes;for(var n in i){for(var r=i[n],a=r.array,o=r.itemSize,s=new a.constructor(t.length*o),c=0,h=0,l=0,u=t.length;l<u;l++){c=t[l]*o;for(var d=0;d<o;d++)s[h++]=a[c++]}e.addAttribute(n,new an(s,o))}var p=this.groups;for(l=0,u=p.length;l<u;l++){var f=p[l];e.addGroup(f.start,f.count,f.materialIndex)}return e},toJSON:function(){var e={metadata:{version:4.5,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,""!==this.name&&(e.name=this.name),void 0!==this.parameters){var t=this.parameters;for(var i in t)void 0!==t[i]&&(e[i]=t[i]);return e}e.data={attributes:{}};var n=this.index;if(null!==n){var r=Array.prototype.slice.call(n.array);e.data.index={type:n.array.constructor.name,array:r}}var a=this.attributes;for(var i in a){var o=a[i];r=Array.prototype.slice.call(o.array);e.data.attributes[i]={itemSize:o.itemSize,type:o.array.constructor.name,array:r,normalized:o.normalized}}var s=this.groups;0<s.length&&(e.data.groups=JSON.parse(JSON.stringify(s)));var c=this.boundingSphere;return null!==c&&(e.data.boundingSphere={center:c.center.toArray(),radius:c.radius}),e},clone:function(){return(new Ln).copy(this)},copy:function(e){var t,i,n;this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.name=e.name;var r=e.index;null!==r&&this.setIndex(r.clone());var a=e.attributes;for(t in a){var o=a[t];this.addAttribute(t,o.clone())}var s=e.morphAttributes;for(t in s){var c=[],h=s[t];for(i=0,n=h.length;i<n;i++)c.push(h[i].clone());this.morphAttributes[t]=c}var l=e.groups;for(i=0,n=l.length;i<n;i++){var u=l[i];this.addGroup(u.start,u.count,u.materialIndex)}var d=e.boundingBox;null!==d&&(this.boundingBox=d.clone());var p=e.boundingSphere;return null!==p&&(this.boundingSphere=p.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this},dispose:function(){this.dispatchEvent({type:"dispose"})}}),(Rn.prototype=Object.create(rn.prototype)).constructor=Rn,(Cn.prototype=Object.create(Ln.prototype)).constructor=Cn,(Pn.prototype=Object.create(rn.prototype)).constructor=Pn,(On.prototype=Object.create(Ln.prototype)).constructor=On;var In,Nn,Bn,Un,Dn,Fn,Hn,zn,Gn,kn,Vn,jn,Wn,Xn,qn,Yn,Zn,Jn,Qn,Kn,$n,er,tr,ir,nr=0;function rr(){Object.defineProperty(this,"id",{value:nr++}),this.uuid=Ut.generateUUID(),this.name="",this.type="Material",this.fog=!0,this.lights=!0,this.blending=Y,this.side=B,this.flatShading=!1,this.vertexColors=Le,this.opacity=1,this.transparent=!1,this.blendSrc=O,this.blendDst=I,this.blendEquation=M,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.depthFunc=ne,this.depthTest=!0,this.depthWrite=!0,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaTest=0,this.premultipliedAlpha=!1,this.overdraw=0,this.visible=!0,this.userData={},this.needsUpdate=!0}function ar(e){rr.call(this),this.type="MeshBasicMaterial",this.color=new yi(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=k,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.lights=!1,this.setValues(e)}function or(e){rr.call(this),this.type="ShaderMaterial",this.defines={},this.uniforms={},this.vertexShader="void main() {\n\tgl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",this.fragmentShader="void main() {\n\tgl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}",this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv2:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,void 0!==e&&(void 0!==e.attributes&&console.error("THREE.ShaderMaterial: attributes should now be defined in THREE.BufferGeometry instead."),this.setValues(e))}function sr(e,t){this.origin=void 0!==e?e:new zt,this.direction=void 0!==t?t:new zt}function cr(e,t){this.start=void 0!==e?e:new zt,this.end=void 0!==t?t:new zt}function hr(e,t,i){this.a=void 0!==e?e:new zt,this.b=void 0!==t?t:new zt,this.c=void 0!==i?i:new zt}function lr(e,t){Wi.call(this),this.type="Mesh",this.geometry=void 0!==e?e:new Ln,this.material=void 0!==t?t:new ar({color:16777215*Math.random()}),this.drawMode=St,this.updateMorphTargets()}function ur(a,i,o,n){var s,c,h,l=new yi(0),u=0;function d(e,t){i.buffers.color.setClear(e.r,e.g,e.b,t,n)}return{getClearColor:function(){return l},setClearColor:function(e,t){l.set(e),d(l,u=void 0!==t?t:1)},getClearAlpha:function(){return u},setClearAlpha:function(e){d(l,u=e)},render:function(e,t,i,n){var r=t.background;null===r?d(l,u):r&&r.isColor&&(d(r,1),n=!0),(a.autoClear||n)&&a.clear(a.autoClearColor,a.autoClearDepth,a.autoClearStencil),r&&r.isCubeTexture?(void 0===h&&((h=new lr(new Cn(1,1,1),new or({uniforms:_i.cube.uniforms,vertexShader:_i.cube.vertexShader,fragmentShader:_i.cube.fragmentShader,side:Ae,depthTest:!0,depthWrite:!1,fog:!1}))).geometry.removeAttribute("normal"),h.geometry.removeAttribute("uv"),h.onBeforeRender=function(e,t,i){this.matrixWorld.copyPosition(i.matrixWorld)},o.update(h)),h.material.uniforms.tCube.value=r,e.push(h,h.geometry,h.material,0,null)):r&&r.isTexture&&(void 0===s&&(s=new qi(-1,1,1,-1,0,1),c=new lr(new On(2,2),new ar({depthTest:!1,depthWrite:!1,fog:!1})),o.update(c)),c.material.map=r,a.renderBufferDirect(s,null,c.geometry,c.material,c,null))}}}function dr(e,r,a){var o;this.setMode=function(e){o=e},this.render=function(e,t){window.webglCallbackHandler.onBeforeDrawArrays(o,e,t),a.update(t,o)},this.renderInstances=function(e,t,i){var n=r.get("ANGLE_instanced_arrays");null!==n?(window.webglCallbackHandler.onBeforeDrawArraysInstancedANGLE(n,o,t,i,e.maxInstancedCount),a.update(i,o,e.maxInstancedCount)):console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.")}}function pr(t,i,e){var n;function r(e){return"lowp"}var a=void 0!==e.precision?e.precision:"highp";"lowp"!==a&&(a="lowp");var o=!0===e.logarithmicDepthBuffer,s=t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS),c=t.getParameter(t.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=t.getParameter(t.MAX_TEXTURE_SIZE),l=t.getParameter(t.MAX_CUBE_MAP_TEXTURE_SIZE),u=t.getParameter(t.MAX_VERTEX_ATTRIBS),d=t.getParameter(t.MAX_VERTEX_UNIFORM_VECTORS),p=t.getParameter(t.MAX_VARYING_VECTORS),f=t.getParameter(t.MAX_FRAGMENT_UNIFORM_VECTORS),m=0<c,g=!!i.get("OES_texture_float");return{getMaxAnisotropy:function(){if(void 0!==n)return n;var e=i.get("EXT_texture_filter_anisotropic");return n=null!==e?t.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT):0},getMaxPrecision:r,precision:a,logarithmicDepthBuffer:o,maxTextures:s,maxVertexTextures:c,maxTextureSize:h,maxCubemapSize:l,maxAttributes:u,maxVertexUniforms:d,maxVaryings:p,maxFragmentUniforms:f,vertexTextures:m,floatFragmentTextures:g,floatVertexTextures:m&&g}}function fr(){var l=this,u=null,d=0,p=!1,f=!1,m=new di,g=new Gt,v={value:null,needsUpdate:!1};function y(){v.value!==u&&(v.value=u,v.needsUpdate=0<d),l.numPlanes=d,l.numIntersection=0}function x(e,t,i,n){var r=null!==e?e.length:0,a=null;if(0!==r){if(a=v.value,!0!==n||null===a){var o=i+4*r,s=t.matrixWorldInverse;g.getNormalMatrix(s),(null===a||a.length<o)&&(a=new Float32Array(o));for(var c=0,h=i;c!==r;++c,h+=4)m.copy(e[c]).applyMatrix4(s,g),m.normal.toArray(a,h),a[h+3]=m.constant}v.value=a,v.needsUpdate=!0}return l.numPlanes=r,a}this.uniform=v,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t,i){var n=0!==e.length||t||0!==d||p;return p=t,u=x(e,i,0),d=e.length,n},this.beginShadows=function(){f=!0,x(null)},this.endShadows=function(){f=!1,y()},this.setState=function(e,t,i,n,r,a){if(!p||null===e||0===e.length||f&&!i)f?x(null):y();else{var o=f?0:d,s=4*o,c=r.clippingState||null;v.value=c,c=x(e,n,s,a);for(var h=0;h!==s;++h)c[h]=u[h];r.clippingState=c,this.numIntersection=t?this.numPlanes:0,this.numPlanes+=o}}}function mr(i){var n={};return{get:function(e){if(void 0!==n[e])return n[e];var t;switch(e){case"WEBGL_depth_texture":t=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":t=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":t=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":t=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:t=i.getExtension(e)}return n[e]=t}}}function gr(u,d,a){var o={},p={};function s(e){var t=e.target,i=o[t.id];for(var n in null!==i.index&&d.remove(i.index),i.attributes)d.remove(i.attributes[n]);t.removeEventListener("dispose",s),delete o[t.id];var r=p[t.id];r&&(d.remove(r),delete p[t.id]),(r=p[i.id])&&(d.remove(r),delete p[i.id]),a.memory.geometries--}return{get:function(e,t){var i=o[t.id];return i||(t.addEventListener("dispose",s),t.isBufferGeometry?i=t:t.isGeometry&&(void 0===t._bufferGeometry&&(t._bufferGeometry=(new Ln).setFromObject(e)),i=t._bufferGeometry),o[t.id]=i,a.memory.geometries++,i)},update:function(e){var t=e.index,i=e.attributes;for(var n in null!==t&&d.update(t,u.ELEMENT_ARRAY_BUFFER),i)d.update(i[n],u.ARRAY_BUFFER);var r=e.morphAttributes;for(var n in r)for(var a=r[n],o=0,s=a.length;o<s;o++)d.update(a[o],u.ARRAY_BUFFER)},getWireframeAttribute:function(e){var t=p[e.id];if(t)return t;var i,n=[],r=e.index,a=e.attributes;if(null!==r)for(var o=0,s=(i=r.array).length;o<s;o+=3){var c=i[o+0],h=i[o+1],l=i[o+2];n.push(c,h,h,l,l,c)}else for(o=0,s=(i=a.position.array).length/3-1;o<s;o+=3)c=o+0,h=o+1,l=o+2,n.push(c,h,h,l,l,c);return t=new(65535<gn(n)?dn:ln)(n,1),d.update(t,u.ELEMENT_ARRAY_BUFFER),p[e.id]=t}}}function vr(e,r,a){var o,s,c;this.setMode=function(e){o=e},this.setIndex=function(e){s=e.type,c=e.bytesPerElement},this.render=function(e,t){window.webglCallbackHandler.onBeforeDrawElements(o,t,s,e*c),a.update(t,o)},this.renderInstances=function(e,t,i){var n=r.get("ANGLE_instanced_arrays");null!==n?(window.webglCallbackHandler.onBeforeDrawElementsInstancedANGLE(n,o,i,s,t*c,e.maxInstancedCount),a.update(i,o,e.maxInstancedCount)):console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.")}}function yr(n){var r={frame:0,calls:0,triangles:0,points:0,lines:0};return{memory:{geometries:0,textures:0},render:r,programs:null,autoReset:!0,reset:function(){r.frame++,r.calls=0,r.triangles=0,r.points=0,r.lines=0},update:function(e,t,i){switch(i=i||1,r.calls++,t){case n.TRIANGLES:r.triangles+=i*(e/3);break;case n.TRIANGLE_STRIP:case n.TRIANGLE_FAN:r.triangles+=i*(e-2);break;case n.LINES:r.lines+=i*(e/2);break;case n.LINE_STRIP:r.lines+=i*(e-1);break;case n.LINE_LOOP:r.lines+=i*e;break;case n.POINTS:r.points+=i*e;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",t)}}}}function xr(e,t){return Math.abs(t[1])-Math.abs(e[1])}function wr(p){var f={},m=new Float32Array(8);return{update:function(e,t,i,n){var r=e.morphTargetInfluences,a=r.length,o=f[t.id];if(void 0===o){o=[];for(var s=0;s<a;s++)o[s]=[s,0];f[t.id]=o}var c=i.morphTargets&&t.morphAttributes.position,h=i.morphNormals&&t.morphAttributes.normal;for(s=0;s<a;s++)0!==(l=o[s])[1]&&(c&&t.removeAttribute("morphTarget"+s),h&&t.removeAttribute("morphNormal"+s));for(s=0;s<a;s++)(l=o[s])[0]=s,l[1]=r[s];for(o.sort(xr),s=0;s<8;s++){var l;if(l=o[s]){var u=l[0],d=l[1];if(d){c&&t.addAttribute("morphTarget"+s,c[u]),h&&t.addAttribute("morphNormal"+s,h[u]),m[s]=d;continue}}m[s]=0}n.getUniforms().setValue(p,"morphTargetInfluences",m)}}}function br(r,a){var o={};return{update:function(e){var t=a.render.frame,i=e.geometry,n=r.get(e,i);return o[n.id]!==t&&(i.isGeometry&&n.updateFromObject(e),r.update(n),o[n.id]=t),n},dispose:function(){o={}}}}function _r(e,t,i,n,r,a,o,s,c,h){ai.call(this,e=void 0!==e?e:[],t=void 0!==t?t:pe,i,n,r,a,o,s,c,h),this.flipY=!1}rr.prototype=Object.assign(Object.create(t.prototype),{constructor:rr,isMaterial:!0,onBeforeCompile:function(){},setValues:function(e){if(void 0!==e)for(var t in e){var i=e[t];if(void 0!==i)if("shading"!==t){var n=this[t];void 0!==n?n&&n.isColor?n.set(i):n&&n.isVector3&&i&&i.isVector3?n.copy(i):this[t]="overdraw"===t?Number(i):i:console.warn("THREE."+this.type+": '"+t+"' is not a property of this material.")}else console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=1===i;else console.warn("THREE.Material: '"+t+"' parameter is undefined.")}},toJSON:function(e){var t=void 0===e||"string"==typeof e;t&&(e={textures:{},images:{}});var i={metadata:{version:4.5,type:"Material",generator:"Material.toJSON"}};function n(e){var t=[];for(var i in e){var n=e[i];delete n.metadata,t.push(n)}return t}if(i.uuid=this.uuid,i.type=this.type,""!==this.name&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),void 0!==this.roughness&&(i.roughness=this.roughness),void 0!==this.metalness&&(i.metalness=this.metalness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),1!==this.emissiveIntensity&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),void 0!==this.shininess&&(i.shininess=this.shininess),void 0!==this.clearCoat&&(i.clearCoat=this.clearCoat),void 0!==this.clearCoatRoughness&&(i.clearCoatRoughness=this.clearCoatRoughness),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,i.reflectivity=this.reflectivity),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),void 0!==this.size&&(i.size=this.size),void 0!==this.sizeAttenuation&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Y&&(i.blending=this.blending),!0===this.flatShading&&(i.flatShading=this.flatShading),this.side!==B&&(i.side=this.side),this.vertexColors!==Le&&(i.vertexColors=this.vertexColors),this.opacity<1&&(i.opacity=this.opacity),!0===this.transparent&&(i.transparent=this.transparent),i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,0!==this.rotation&&(i.rotation=this.rotation),1!==this.linewidth&&(i.linewidth=this.linewidth),void 0!==this.dashSize&&(i.dashSize=this.dashSize),void 0!==this.gapSize&&(i.gapSize=this.gapSize),void 0!==this.scale&&(i.scale=this.scale),!0===this.dithering&&(i.dithering=!0),0<this.alphaTest&&(i.alphaTest=this.alphaTest),!0===this.premultipliedAlpha&&(i.premultipliedAlpha=this.premultipliedAlpha),!0===this.wireframe&&(i.wireframe=this.wireframe),1<this.wireframeLinewidth&&(i.wireframeLinewidth=this.wireframeLinewidth),"round"!==this.wireframeLinecap&&(i.wireframeLinecap=this.wireframeLinecap),"round"!==this.wireframeLinejoin&&(i.wireframeLinejoin=this.wireframeLinejoin),!0===this.morphTargets&&(i.morphTargets=!0),!0===this.skinning&&(i.skinning=!0),!1===this.visible&&(i.visible=!1),"{}"!==JSON.stringify(this.userData)&&(i.userData=this.userData),t){var r=n(e.textures),a=n(e.images);0<r.length&&(i.textures=r),0<a.length&&(i.images=a)}return i},clone:function(){return(new this.constructor).copy(this)},copy:function(e){this.name=e.name,this.fog=e.fog,this.lights=e.lights,this.blending=e.blending,this.side=e.side,this.flatShading=e.flatShading,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.premultipliedAlpha=e.premultipliedAlpha,this.overdraw=e.overdraw,this.visible=e.visible,this.userData=JSON.parse(JSON.stringify(e.userData)),this.clipShadows=e.clipShadows,this.clipIntersection=e.clipIntersection;var t=e.clippingPlanes,i=null;if(null!==t){var n=t.length;i=new Array(n);for(var r=0;r!==n;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.shadowSide=e.shadowSide,this},dispose:function(){this.dispatchEvent({type:"dispose"})}}),((ar.prototype=Object.create(rr.prototype)).constructor=ar).prototype.isMeshBasicMaterial=!0,ar.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this},((or.prototype=Object.create(rr.prototype)).constructor=or).prototype.isShaderMaterial=!0,or.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=gi.clone(e.uniforms),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.lights=e.lights,this.clipping=e.clipping,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.extensions=e.extensions,this},or.prototype.toJSON=function(e){var t=rr.prototype.toJSON.call(this,e);return t.uniforms=this.uniforms,t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t},Object.assign(sr.prototype,{set:function(e,t){return this.origin.copy(e),this.direction.copy(t),this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this},at:function(e,t){return void 0===t&&(console.warn("THREE.Ray: .at() target is now required"),t=new zt),t.copy(this.direction).multiplyScalar(e).add(this.origin)},lookAt:function(e){return this.direction.copy(e).sub(this.origin).normalize(),this},recast:(Vn=new zt,function(e){return this.origin.copy(this.at(e,Vn)),this}),closestPointToPoint:function(e,t){void 0===t&&(console.warn("THREE.Ray: .closestPointToPoint() target is now required"),t=new zt),t.subVectors(e,this.origin);var i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.direction).multiplyScalar(i).add(this.origin)},distanceToPoint:function(e){return Math.sqrt(this.distanceSqToPoint(e))},distanceSqToPoint:(kn=new zt,function(e){var t=kn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(kn.copy(this.direction).multiplyScalar(t).add(this.origin),kn.distanceToSquared(e))}),distanceSqToSegment:(Hn=new zt,zn=new zt,Gn=new zt,function(e,t,i,n){Hn.copy(e).add(t).multiplyScalar(.5),zn.copy(t).sub(e).normalize(),Gn.copy(this.origin).sub(Hn);var r,a,o,s,c=.5*e.distanceTo(t),h=-this.direction.dot(zn),l=Gn.dot(this.direction),u=-Gn.dot(zn),d=Gn.lengthSq(),p=Math.abs(1-h*h);if(0<p)if(a=h*l-u,s=c*p,0<=(r=h*u-l))if(-s<=a)if(a<=s){var f=1/p;o=(r*=f)*(r+h*(a*=f)+2*l)+a*(h*r+a+2*u)+d}else a=c,o=-(r=Math.max(0,-(h*a+l)))*r+a*(a+2*u)+d;else a=-c,o=-(r=Math.max(0,-(h*a+l)))*r+a*(a+2*u)+d;else a<=-s?o=-(r=Math.max(0,-(-h*c+l)))*r+(a=0<r?-c:Math.min(Math.max(-c,-u),c))*(a+2*u)+d:a<=s?(r=0,o=(a=Math.min(Math.max(-c,-u),c))*(a+2*u)+d):o=-(r=Math.max(0,-(h*c+l)))*r+(a=0<r?c:Math.min(Math.max(-c,-u),c))*(a+2*u)+d;else a=0<h?-c:c,o=-(r=Math.max(0,-(h*a+l)))*r+a*(a+2*u)+d;return i&&i.copy(this.direction).multiplyScalar(r).add(this.origin),n&&n.copy(zn).multiplyScalar(a).add(Hn),o}),intersectSphere:(Fn=new zt,function(e,t){Fn.subVectors(e.center,this.origin);var i=Fn.dot(this.direction),n=Fn.dot(Fn)-i*i,r=e.radius*e.radius;if(r<n)return null;var a=Math.sqrt(r-n),o=i-a,s=i+a;return o<0&&s<0?null:o<0?this.at(s,t):this.at(o,t)}),intersectsSphere:function(e){return this.distanceToPoint(e.center)<=e.radius},distanceToPlane:function(e){var t=e.normal.dot(this.direction);if(0===t)return 0===e.distanceToPoint(this.origin)?0:null;var i=-(this.origin.dot(e.normal)+e.constant)/t;return 0<=i?i:null},intersectPlane:function(e,t){var i=this.distanceToPlane(e);return null===i?null:this.at(i,t)},intersectsPlane:function(e){var t=e.distanceToPoint(this.origin);return 0===t||e.normal.dot(this.direction)*t<0},intersectBox:function(e,t){var i,n,r,a,o,s,c=1/this.direction.x,h=1/this.direction.y,l=1/this.direction.z,u=this.origin;return 0<=c?(i=(e.min.x-u.x)*c,n=(e.max.x-u.x)*c):(i=(e.max.x-u.x)*c,n=(e.min.x-u.x)*c),0<=h?(r=(e.min.y-u.y)*h,a=(e.max.y-u.y)*h):(r=(e.max.y-u.y)*h,a=(e.min.y-u.y)*h),a<i||n<r?null:((i<r||i!=i)&&(i=r),(a<n||n!=n)&&(n=a),0<=l?(o=(e.min.z-u.z)*l,s=(e.max.z-u.z)*l):(o=(e.max.z-u.z)*l,s=(e.min.z-u.z)*l),s<i||n<o?null:((i<o||i!=i)&&(i=o),(s<n||n!=n)&&(n=s),n<0?null:this.at(0<=i?i:n,t)))},intersectsBox:(Dn=new zt,function(e){return null!==this.intersectBox(e,Dn)}),intersectTriangle:(In=new zt,Nn=new zt,Bn=new zt,Un=new zt,function(e,t,i,n,r){Nn.subVectors(t,e),Bn.subVectors(i,e),Un.crossVectors(Nn,Bn);var a,o=this.direction.dot(Un);if(0<o){if(n)return null;a=1}else{if(!(o<0))return null;a=-1,o=-o}In.subVectors(this.origin,e);var s=a*this.direction.dot(Bn.crossVectors(In,Bn));if(s<0)return null;var c=a*this.direction.dot(Nn.cross(In));if(c<0)return null;if(o<s+c)return null;var h=-a*In.dot(Un);return h<0?null:this.at(h/o,r)}),applyMatrix4:function(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this},equals:function(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}}),Object.assign(cr.prototype,{set:function(e,t){return this.start.copy(e),this.end.copy(t),this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.start.copy(e.start),this.end.copy(e.end),this},getCenter:function(e){return void 0===e&&(console.warn("THREE.Line3: .getCenter() target is now required"),e=new zt),e.addVectors(this.start,this.end).multiplyScalar(.5)},delta:function(e){return void 0===e&&(console.warn("THREE.Line3: .delta() target is now required"),e=new zt),e.subVectors(this.end,this.start)},distanceSq:function(){return this.start.distanceToSquared(this.end)},distance:function(){return this.start.distanceTo(this.end)},at:function(e,t){return void 0===t&&(console.warn("THREE.Line3: .at() target is now required"),t=new zt),this.delta(t).multiplyScalar(e).add(this.start)},closestPointToPointParameter:(jn=new zt,Wn=new zt,function(e,t){jn.subVectors(e,this.start),Wn.subVectors(this.end,this.start);var i=Wn.dot(Wn),n=Wn.dot(jn)/i;return t&&(n=Ut.clamp(n,0,1)),n}),closestPointToPoint:function(e,t,i){var n=this.closestPointToPointParameter(e,t);return void 0===i&&(console.warn("THREE.Line3: .closestPointToPoint() target is now required"),i=new zt),this.delta(i).multiplyScalar(n).add(this.start)},applyMatrix4:function(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this},equals:function(e){return e.start.equals(this.start)&&e.end.equals(this.end)}}),Object.assign(hr,{getNormal:(Jn=new zt,function(e,t,i,n){void 0===n&&(console.warn("THREE.Triangle: .getNormal() target is now required"),n=new zt),n.subVectors(i,t),Jn.subVectors(e,t),n.cross(Jn);var r=n.lengthSq();return 0<r?n.multiplyScalar(1/Math.sqrt(r)):n.set(0,0,0)}),getBarycoord:(qn=new zt,Yn=new zt,Zn=new zt,function(e,t,i,n,r){qn.subVectors(n,t),Yn.subVectors(i,t),Zn.subVectors(e,t);var a=qn.dot(qn),o=qn.dot(Yn),s=qn.dot(Zn),c=Yn.dot(Yn),h=Yn.dot(Zn),l=a*c-o*o;if(void 0===r&&(console.warn("THREE.Triangle: .getBarycoord() target is now required"),r=new zt),0===l)return r.set(-2,-1,-1);var u=1/l,d=(c*s-o*h)*u,p=(a*h-o*s)*u;return r.set(1-d-p,p,d)}),containsPoint:(Xn=new zt,function(e,t,i,n){return hr.getBarycoord(e,t,i,n,Xn),0<=Xn.x&&0<=Xn.y&&Xn.x+Xn.y<=1})}),Object.assign(hr.prototype,{set:function(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this},setFromPointsAndIndices:function(e,t,i,n){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[n]),this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this},getArea:(tr=new zt,ir=new zt,function(){return tr.subVectors(this.c,this.b),ir.subVectors(this.a,this.b),.5*tr.cross(ir).length()}),getMidpoint:function(e){return void 0===e&&(console.warn("THREE.Triangle: .getMidpoint() target is now required"),e=new zt),e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)},getNormal:function(e){return hr.getNormal(this.a,this.b,this.c,e)},getPlane:function(e){return void 0===e&&(console.warn("THREE.Triangle: .getPlane() target is now required"),e=new zt),e.setFromCoplanarPoints(this.a,this.b,this.c)},getBarycoord:function(e,t){return hr.getBarycoord(e,this.a,this.b,this.c,t)},containsPoint:function(e){return hr.containsPoint(e,this.a,this.b,this.c)},intersectsBox:function(e){return e.intersectsTriangle(this)},closestPointToPoint:(Qn=new di,Kn=[new cr,new cr,new cr],$n=new zt,er=new zt,function(e,t){void 0===t&&(console.warn("THREE.Triangle: .closestPointToPoint() target is now required"),t=new zt);var i=1/0;if(Qn.setFromCoplanarPoints(this.a,this.b,this.c),Qn.projectPoint(e,$n),!0===this.containsPoint($n))t.copy($n);else{Kn[0].set(this.a,this.b),Kn[1].set(this.b,this.c),Kn[2].set(this.c,this.a);for(var n=0;n<Kn.length;n++){Kn[n].closestPointToPoint($n,!0,er);var r=$n.distanceToSquared(er);r<i&&(i=r,t.copy(er))}}return t}),equals:function(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}),lr.prototype=Object.assign(Object.create(Wi.prototype),{constructor:lr,isMesh:!0,setDrawMode:function(e){this.drawMode=e},copy:function(e){return Wi.prototype.copy.call(this,e),this.drawMode=e.drawMode,void 0!==e.morphTargetInfluences&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),void 0!==e.morphTargetDictionary&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this},updateMorphTargets:function(){var e,t,i,n=this.geometry;if(n.isBufferGeometry){var r=n.morphAttributes,a=Object.keys(r);if(0<a.length){var o=r[a[0]];if(void 0!==o)for(this.morphTargetInfluences=[],this.morphTargetDictionary={},e=0,t=o.length;e<t;e++)i=o[e].name||String(e),this.morphTargetInfluences.push(0),this.morphTargetDictionary[i]=e}}else{var s=n.morphTargets;if(void 0!==s&&0<s.length)for(this.morphTargetInfluences=[],this.morphTargetDictionary={},e=0,t=s.length;e<t;e++)i=s[e].name||String(e),this.morphTargetInfluences.push(0),this.morphTargetDictionary[i]=e}},raycast:function(){var I=new Ft,N=new sr,B=new ui,U=new zt,D=new zt,F=new zt,H=new zt,z=new zt,G=new zt,k=new Dt,V=new Dt,j=new Dt,s=new zt,W=new zt,h=new zt;function X(e,t,i,n,r,a,o){return hr.getBarycoord(e,t,i,n,s),r.multiplyScalar(s.x),a.multiplyScalar(s.y),o.multiplyScalar(s.z),r.add(a).add(o),r.clone()}function q(e,t,i,n,r,a,o,s){if(null===(t.side===Ae?n.intersectTriangle(o,a,r,!0,s):n.intersectTriangle(r,a,o,t.side!==Z,s)))return null;h.copy(s),h.applyMatrix4(e.matrixWorld);var c=i.ray.origin.distanceTo(h);return c<i.near||c>i.far?null:{distance:c,point:h.clone(),object:e}}function Y(e,t,i,n,r,a,o,s){U.fromBufferAttribute(n,a),D.fromBufferAttribute(n,o),F.fromBufferAttribute(n,s);var c=q(e,e.material,t,i,U,D,F,W);if(c){r&&(k.fromBufferAttribute(r,a),V.fromBufferAttribute(r,o),j.fromBufferAttribute(r,s),c.uv=X(W,U,D,F,k,V,j));var h=new Yi(a,o,s);hr.getNormal(U,D,F,h.normal),c.face=h}return c}return function(e,t){var i,n=this.geometry,r=this.material,a=this.matrixWorld;if(void 0!==r&&(null===n.boundingSphere&&n.computeBoundingSphere(),B.copy(n.boundingSphere),B.applyMatrix4(a),!1!==e.ray.intersectsSphere(B)&&(I.getInverse(a),N.copy(e.ray).applyMatrix4(I),null===n.boundingBox||!1!==N.intersectsBox(n.boundingBox))))if(n.isBufferGeometry){var o,s,c,h,l,u=n.index,d=n.attributes.position,p=n.attributes.uv;if(null!==u)for(h=0,l=u.count;h<l;h+=3)o=u.getX(h),s=u.getX(h+1),c=u.getX(h+2),(i=Y(this,e,N,d,p,o,s,c))&&(i.faceIndex=Math.floor(h/3),t.push(i));else if(void 0!==d)for(h=0,l=d.count;h<l;h+=3)(i=Y(this,e,N,d,p,o=h,s=h+1,c=h+2))&&(i.faceIndex=Math.floor(h/3),t.push(i))}else if(n.isGeometry){var f,m,g,v,y=Array.isArray(r),x=n.vertices,w=n.faces,b=n.faceVertexUvs[0];0<b.length&&(v=b);for(var _=0,M=w.length;_<M;_++){var E=w[_],T=y?r[E.materialIndex]:r;if(void 0!==T){if(f=x[E.a],m=x[E.b],g=x[E.c],!0===T.morphTargets){var S=n.morphTargets,A=this.morphTargetInfluences;U.set(0,0,0),D.set(0,0,0),F.set(0,0,0);for(var L=0,R=S.length;L<R;L++){var C=A[L];if(0!==C){var P=S[L].vertices;U.addScaledVector(H.subVectors(P[E.a],f),C),D.addScaledVector(z.subVectors(P[E.b],m),C),F.addScaledVector(G.subVectors(P[E.c],g),C)}}U.add(f),D.add(m),F.add(g),f=U,m=D,g=F}if(i=q(this,T,e,N,f,m,g,W)){if(v&&v[_]){var O=v[_];k.copy(O[0]),V.copy(O[1]),j.copy(O[2]),i.uv=X(W,f,m,g,k,V,j)}i.face=E,i.faceIndex=_,t.push(i)}}}}}}(),clone:function(){return new this.constructor(this.geometry,this.material).copy(this)}}),((_r.prototype=Object.create(ai.prototype)).constructor=_r).prototype.isCubeTexture=!0,Object.defineProperty(_r.prototype,"images",{get:function(){return this.image},set:function(e){this.image=e}});var Mr=new ai,Er=new _r;function Tr(){this.seq=[],this.map={}}var Sr=[],Ar=[],Lr=new Float32Array(16),Rr=new Float32Array(9),Cr=new Float32Array(4);function Pr(e,t,i){var n=e[0];if(n<=0||0<n)return e;var r=t*i,a=Sr[r];if(void 0===a&&(a=new Float32Array(r),Sr[r]=a),0!==t){n.toArray(a,0);for(var o=1,s=0;o!==t;++o)s+=i,e[o].toArray(a,s)}return a}function Or(e,t){if(e.length!==t.length)return!1;for(var i=0,n=e.length;i<n;i++)if(e[i]!==t[i])return!1;return!0}function Ir(e,t){for(var i=0,n=t.length;i<n;i++)e[i]=t[i]}function Nr(e,t){var i=Ar[t];void 0===i&&(i=new Int32Array(t),Ar[t]=i);for(var n=0;n!==t;++n)i[n]=e.allocTextureUnit();return i}function Br(e,t){var i=this.cache;i[0]!==t&&(window.webglCallbackHandler.onBeforeUniform1f(this.addr,t),i[0]=t)}function Ur(e,t){var i=this.cache;i[0]!==t&&(window.webglCallbackHandler.onBeforeUniform1i(this.addr,t),i[0]=t)}function Dr(e,t){var i=this.cache;if(void 0!==t.x)i[0]===t.x&&i[1]===t.y||(window.webglCallbackHandler.onBeforeUniform2f(this.addr,t.x,t.y),i[0]=t.x,i[1]=t.y);else{if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniform2fv(this.addr,t),Ir(i,t)}}function Fr(e,t){var i=this.cache;if(void 0!==t.x)i[0]===t.x&&i[1]===t.y&&i[2]===t.z||(window.webglCallbackHandler.onBeforeUniform3f(this.addr,t.x,t.y,t.z),i[0]=t.x,i[1]=t.y,i[2]=t.z);else if(void 0!==t.r)i[0]===t.r&&i[1]===t.g&&i[2]===t.b||(window.webglCallbackHandler.onBeforeUniform3f(this.addr,t.r,t.g,t.b),i[0]=t.r,i[1]=t.g,i[2]=t.b);else{if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniform3fv(this.addr,t),Ir(i,t)}}function Hr(e,t){var i=this.cache;if(void 0!==t.x)i[0]===t.x&&i[1]===t.y&&i[2]===t.z&&i[3]===t.w||(window.webglCallbackHandler.onBeforeUniform4f(this.addr,t.x,t.y,t.z,t.w),i[0]=t.x,i[1]=t.y,i[2]=t.z,i[3]=t.w);else{if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniform4fv(this.addr,t),Ir(i,t)}}function zr(e,t){var i=this.cache,n=t.elements;if(void 0===n){if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniformMatrix2fv(this.addr,!1,t),Ir(i,t)}else{if(Or(i,n))return;Cr.set(n),window.webglCallbackHandler.onBeforeUniformMatrix2fv(this.addr,!1,Cr),Ir(i,n)}}function Gr(e,t){var i=this.cache,n=t.elements;if(void 0===n){if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniformMatrix3fv(this.addr,!1,t),Ir(i,t)}else{if(Or(i,n))return;Rr.set(n),window.webglCallbackHandler.onBeforeUniformMatrix3fv(this.addr,!1,Rr),Ir(i,n)}}function kr(e,t){var i=this.cache,n=t.elements;if(void 0===n){if(Or(i,t))return;window.webglCallbackHandler.onBeforeUniformMatrix4fv(this.addr,!1,t),Ir(i,t)}else{if(Or(i,n))return;Lr.set(n),window.webglCallbackHandler.onBeforeUniformMatrix4fv(this.addr,!1,Lr),Ir(i,n)}}function Vr(e,t,i){var n=this.cache,r=i.allocTextureUnit();n[0]!==r&&(window.webglCallbackHandler.onBeforeUniform1i(this.addr,r),n[0]=r),i.setTexture2D(t||Mr,r)}function jr(e,t,i){var n=this.cache,r=i.allocTextureUnit();n[0]!==r&&(window.webglCallbackHandler.onBeforeUniform1i(this.addr,r),n[0]=r),i.setTextureCube(t||Er,r)}function Wr(e,t){var i=this.cache;Or(i,t)||(window.webglCallbackHandler.onBeforeUniform2iv(this.addr,t),Ir(i,t))}function Xr(e,t){var i=this.cache;Or(i,t)||(window.webglCallbackHandler.onBeforeUniform3iv(this.addr,t),Ir(i,t))}function qr(e,t){var i=this.cache;Or(i,t)||(window.webglCallbackHandler.onBeforeUniform4iv(this.addr,t),Ir(i,t))}function Yr(e,t){var i=this.cache;Or(i,t)||(window.webglCallbackHandler.onBeforeUniform1fv(this.addr,t),Ir(i,t))}function Zr(e,t){var i=this.cache;Or(i,t)||(window.webglCallbackHandler.onBeforeUniform1iv(this.addr,t),Ir(i,t))}function Jr(e,t){var i=this.cache,n=Pr(t,this.size,2);Or(i,n)||(window.webglCallbackHandler.onBeforeUniform2fv(this.addr,n),this.updateCache(n))}function Qr(e,t){var i=this.cache,n=Pr(t,this.size,3);Or(i,n)||(window.webglCallbackHandler.onBeforeUniform3fv(this.addr,n),this.updateCache(n))}function Kr(e,t){var i=this.cache,n=Pr(t,this.size,4);Or(i,n)||(window.webglCallbackHandler.onBeforeUniform4fv(this.addr,n),this.updateCache(n))}function $r(e,t){var i=this.cache,n=Pr(t,this.size,4);Or(i,n)||(window.webglCallbackHandler.onBeforeUniformMatrix2fv(this.addr,!1,n),this.updateCache(n))}function ea(e,t){var i=this.cache,n=Pr(t,this.size,9);Or(i,n)||(window.webglCallbackHandler.onBeforeUniformMatrix3fv(this.addr,!1,n),this.updateCache(n))}function ta(e,t){var i=this.cache,n=Pr(t,this.size,16);Or(i,n)||(window.webglCallbackHandler.onBeforeUniformMatrix4fv(this.addr,!1,n),this.updateCache(n))}function ia(e,t,i){var n=this.cache,r=t.length,a=Nr(i,r);!1===Or(n,a)&&(window.webglCallbackHandler.onBeforeUniform1iv(this.addr,a),Ir(n,a));for(var o=0;o!==r;++o)i.setTexture2D(t[o]||Mr,a[o])}function na(e,t,i){var n=this.cache,r=t.length,a=Nr(i,r);!1===Or(n,a)&&(window.webglCallbackHandler.onBeforeUniform1iv(this.addr,a),Ir(n,a));for(var o=0;o!==r;++o)i.setTextureCube(t[o]||Er,a[o])}function ra(e,t,i){this.id=e,this.addr=i,this.cache=[],this.setValue=function(e){switch(e){case 5126:return Br;case 35664:return Dr;case 35665:return Fr;case 35666:return Hr;case 35674:return zr;case 35675:return Gr;case 35676:return kr;case 35678:case 36198:return Vr;case 35680:return jr;case 5124:case 35670:return Ur;case 35667:case 35671:return Wr;case 35668:case 35672:return Xr;case 35669:case 35673:return qr}}(t.type)}function aa(e,t,i){this.id=e,this.addr=i,this.cache=[],this.size=t.size,this.setValue=function(e){switch(e){case 5126:return Yr;case 35664:return Jr;case 35665:return Qr;case 35666:return Kr;case 35674:return $r;case 35675:return ea;case 35676:return ta;case 35678:return ia;case 35680:return na;case 5124:case 35670:return Zr;case 35667:case 35671:return Wr;case 35668:case 35672:return Xr;case 35669:case 35673:return qr}}(t.type)}function oa(e){this.id=e,Tr.call(this)}aa.prototype.updateCache=function(e){var t=this.cache;e instanceof Float32Array&&t.length!==e.length&&(this.cache=new Float32Array(e.length)),Ir(t,e)},oa.prototype.setValue=function(e,t){for(var i=this.seq,n=0,r=i.length;n!==r;++n){var a=i[n];a.setValue(e,t[a.id])}};var sa=/([\w\d_]+)(\])?(\[|\.)?/g;function ca(e,t){e.seq.push(t),e.map[t.id]=t}function ha(e,t,i){var n=e.name,r=n.length;for(sa.lastIndex=0;;){var a=sa.exec(n),o=sa.lastIndex,s=a[1],c="]"===a[2],h=a[3];if(c&&(s|=0),void 0===h||"["===h&&o+2===r){ca(i,void 0===h?new ra(s,e,t):new aa(s,e,t));break}var l=i.map[s];void 0===l&&ca(i,l=new oa(s)),i=l}}function la(e,t,i){Tr.call(this),this.renderer=i;for(var n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS),r=0;r<n;++r){var a=e.getActiveUniform(t,r);ha(a,e.getUniformLocation(t,a.name),this)}}function ua(e,t,i){var n=e.createShader(t);window.webglCallbackHandler.onCreateShader(),window.webglCallbackHandler.onBeforeShaderSource(n,i),window.webglCallbackHandler.onBeforeCompileShader(n);var r=!1;if(!1===e.getShaderParameter(n,e.COMPILE_STATUS)&&(console.error("THREE.WebGLShader: Shader couldn't compile."),r=!0),""!==e.getShaderInfoLog(n)){var a=e.getShaderInfoLog(n),o=function(e){for(var t=e.split("\n"),i=0;i<t.length;i++)t[i]=i+1+": "+t[i];return t.join("\n")}(i);console.warn("THREE.WebGLShader: gl.getShaderInfoLog()",t===e.VERTEX_SHADER?"vertex":"fragment",a,o),r?window.webglCallbackHandler.onShaderCompilationError(t,a,o):window.webglCallbackHandler.onShaderCompilationWarning(t,a,o)}return n}la.prototype.setValue=function(e,t,i){var n=this.map[t];void 0!==n&&n.setValue(e,i,this.renderer)},la.prototype.setOptional=function(e,t,i){var n=t[i];void 0!==n&&this.setValue(e,i,n)},la.upload=function(e,t,i,n){for(var r=0,a=t.length;r!==a;++r){var o=t[r],s=i[o.id];!1!==s.needsUpdate&&o.setValue(e,s.value,n)}},la.seqWithValue=function(e,t){for(var i=[],n=0,r=e.length;n!==r;++n){var a=e[n];a.id in t&&i.push(a)}return i};var da=0;function pa(e){switch(e){case At:return["Linear","( value )"];case Lt:return["sRGB","( value )"];case Ct:return["RGBE","( value )"];case Pt:return["RGBM","( value, 7.0 )"];case Ot:return["RGBM","( value, 16.0 )"];case It:return["RGBD","( value, 256.0 )"];case Rt:return["Gamma","( value, float( GAMMA_FACTOR ) )"];default:throw new Error("unsupported encoding: "+e)}}function fa(e,t){var i=pa(t);return"vec4 "+e+"( vec4 value ) { return "+i[0]+"ToLinear"+i[1]+"; }"}function ma(e){return""!==e}function ga(e,t){return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights)}function va(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}function ya(e){return e.replace(/^[ \t]*#include +<([\w\d.]+)>/gm,function(e,t){var i=mi[t];if(void 0===i)throw new Error("Can not resolve #include <"+t+">");return ya(i)})}function xa(e){return e.replace(/#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g,function(e,t,i,n){for(var r="",a=parseInt(t);a<parseInt(i);a++)r+=n.replace(/\[ i \]/g,"[ "+a+" ]");return r})}function wa(e,t,i,n,r,a){var o=e.context,s=n.defines,c=r.vertexShader,h=r.fragmentShader,l="SHADOWMAP_TYPE_BASIC";a.shadowMapType===D?l="SHADOWMAP_TYPE_PCF":a.shadowMapType===F&&(l="SHADOWMAP_TYPE_PCF_SOFT");var u="ENVMAP_TYPE_CUBE",d="ENVMAP_MODE_REFLECTION",p="ENVMAP_BLENDING_MULTIPLY";if(a.envMap){switch(n.envMap.mapping){case pe:case fe:u="ENVMAP_TYPE_CUBE";break;case ye:case xe:u="ENVMAP_TYPE_CUBE_UV";break;case me:case ge:u="ENVMAP_TYPE_EQUIREC";break;case ve:u="ENVMAP_TYPE_SPHERE"}switch(n.envMap.mapping){case fe:case ge:d="ENVMAP_MODE_REFRACTION"}switch(n.combine){case k:p="ENVMAP_BLENDING_MULTIPLY";break;case V:p="ENVMAP_BLENDING_MIX";break;case ce:p="ENVMAP_BLENDING_ADD"}}var f,m,g,v,y,x,w,b,_=0<e.gammaFactor?e.gammaFactor:1,M=(f=n.extensions,m=a,g=t,[(f=f||{}).derivatives||m.envMapCubeUV||m.bumpMap||m.normalMap||m.flatShading?"#extension GL_OES_standard_derivatives : enable":"",(f.fragDepth||m.logarithmicDepthBuffer)&&g.get("EXT_frag_depth")?"#extension GL_EXT_frag_depth : enable":"",f.drawBuffers&&g.get("WEBGL_draw_buffers")?"#extension GL_EXT_draw_buffers : require":"",(f.shaderTextureLOD||m.envMap)&&g.get("EXT_shader_texture_lod")?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ma).join("\n")),E=function(e){var t=[];for(var i in e){var n=e[i];!1!==n&&t.push("#define "+i+" "+n)}return t.join("\n")}(s),T=o.createProgram();window.webglCallbackHandler.onCreateProgram(),n.isRawShaderMaterial?(0<(v=[E].filter(ma).join("\n")).length&&(v+="\n"),0<(y=[M,E].filter(ma).join("\n")).length&&(y+="\n")):(v=["precision "+a.precision+" float;","precision "+a.precision+" int;","#define SHADER_NAME "+r.name,E,a.supportsVertexTextures?"#define VERTEX_TEXTURES":"","#define GAMMA_FACTOR "+_,"#define MAX_BONES "+a.maxBones,a.useFog&&a.fog?"#define USE_FOG":"",a.useFog&&a.fogExp?"#define FOG_EXP2":"",a.map?"#define USE_MAP":"",a.envMap?"#define USE_ENVMAP":"",a.envMap?"#define "+d:"",a.lightMap?"#define USE_LIGHTMAP":"",a.aoMap?"#define USE_AOMAP":"",a.emissiveMap?"#define USE_EMISSIVEMAP":"",a.bumpMap?"#define USE_BUMPMAP":"",a.normalMap?"#define USE_NORMALMAP":"",a.displacementMap&&a.supportsVertexTextures?"#define USE_DISPLACEMENTMAP":"",a.specularMap?"#define USE_SPECULARMAP":"",a.roughnessMap?"#define USE_ROUGHNESSMAP":"",a.metalnessMap?"#define USE_METALNESSMAP":"",a.alphaMap?"#define USE_ALPHAMAP":"",a.vertexColors?"#define USE_COLOR":"",a.flatShading?"#define FLAT_SHADED":"",a.skinning?"#define USE_SKINNING":"",a.useVertexTexture?"#define BONE_TEXTURE":"",a.morphTargets?"#define USE_MORPHTARGETS":"",a.morphNormals&&!1===a.flatShading?"#define USE_MORPHNORMALS":"",a.doubleSided?"#define DOUBLE_SIDED":"",a.flipSided?"#define FLIP_SIDED":"",a.shadowMapEnabled?"#define USE_SHADOWMAP":"",a.shadowMapEnabled?"#define "+l:"",a.sizeAttenuation?"#define USE_SIZEATTENUATION":"",a.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",a.logarithmicDepthBuffer&&t.get("EXT_frag_depth")?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_COLOR","\tattribute vec3 color;","#endif","#ifdef USE_MORPHTARGETS","\tattribute vec3 morphTarget0;","\tattribute vec3 morphTarget1;","\tattribute vec3 morphTarget2;","\tattribute vec3 morphTarget3;","\t#ifdef USE_MORPHNORMALS","\t\tattribute vec3 morphNormal0;","\t\tattribute vec3 morphNormal1;","\t\tattribute vec3 morphNormal2;","\t\tattribute vec3 morphNormal3;","\t#else","\t\tattribute vec3 morphTarget4;","\t\tattribute vec3 morphTarget5;","\t\tattribute vec3 morphTarget6;","\t\tattribute vec3 morphTarget7;","\t#endif","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif","\n"].filter(ma).join("\n"),y=[M,"precision "+a.precision+" float;","precision "+a.precision+" int;","#define SHADER_NAME "+r.name,E,a.alphaTest?"#define ALPHATEST "+a.alphaTest+(a.alphaTest%1?"":".0"):"","#define GAMMA_FACTOR "+_,a.useFog&&a.fog?"#define USE_FOG":"",a.useFog&&a.fogExp?"#define FOG_EXP2":"",a.map?"#define USE_MAP":"",a.envMap?"#define USE_ENVMAP":"",a.envMap?"#define "+u:"",a.envMap?"#define "+d:"",a.envMap?"#define "+p:"",a.lightMap?"#define USE_LIGHTMAP":"",a.aoMap?"#define USE_AOMAP":"",a.emissiveMap?"#define USE_EMISSIVEMAP":"",a.bumpMap?"#define USE_BUMPMAP":"",a.normalMap?"#define USE_NORMALMAP":"",a.specularMap?"#define USE_SPECULARMAP":"",a.roughnessMap?"#define USE_ROUGHNESSMAP":"",a.metalnessMap?"#define USE_METALNESSMAP":"",a.alphaMap?"#define USE_ALPHAMAP":"",a.vertexColors?"#define USE_COLOR":"",a.gradientMap?"#define USE_GRADIENTMAP":"",a.flatShading?"#define FLAT_SHADED":"",a.doubleSided?"#define DOUBLE_SIDED":"",a.flipSided?"#define FLIP_SIDED":"",a.shadowMapEnabled?"#define USE_SHADOWMAP":"",a.shadowMapEnabled?"#define "+l:"",a.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",a.physicallyCorrectLights?"#define PHYSICALLY_CORRECT_LIGHTS":"",a.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",a.logarithmicDepthBuffer&&t.get("EXT_frag_depth")?"#define USE_LOGDEPTHBUF_EXT":"",a.envMap&&t.get("EXT_shader_texture_lod")?"#define TEXTURE_LOD_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;",a.toneMapping!==he?"#define TONE_MAPPING":"",a.toneMapping!==he?mi.tonemapping_pars_fragment:"",a.toneMapping!==he?function(e,t){var i;switch(t){case Re:i="Linear";break;case le:i="Reinhard";break;case ue:i="Uncharted2";break;case de:i="OptimizedCineon";break;default:throw new Error("unsupported toneMapping: "+t)}return"vec3 "+e+"( vec3 color ) { return "+i+"ToneMapping( color ); }"}("toneMapping",a.toneMapping):"",a.dithering?"#define DITHERING":"",a.outputEncoding||a.mapEncoding||a.envMapEncoding||a.emissiveMapEncoding?mi.encodings_pars_fragment:"",a.mapEncoding?fa("mapTexelToLinear",a.mapEncoding):"",a.envMapEncoding?fa("envMapTexelToLinear",a.envMapEncoding):"",a.emissiveMapEncoding?fa("emissiveMapTexelToLinear",a.emissiveMapEncoding):"",a.outputEncoding?(x="linearToOutputTexel",w=a.outputEncoding,b=pa(w),"vec4 "+x+"( vec4 value ) { return LinearTo"+b[0]+b[1]+"; }"):"",a.depthPacking?"#define DEPTH_PACKING "+n.depthPacking:"","\n"].filter(ma).join("\n")),c=va(c=ga(c=ya(c),a),a),h=va(h=ga(h=ya(h),a),a);var S=v+(c=xa(c)),A=y+(h=xa(h)),L=ua(o,o.VERTEX_SHADER,S),R=ua(o,o.FRAGMENT_SHADER,A);window.webglCallbackHandler.onBeforeAttachShader(T,L),window.webglCallbackHandler.onBeforeAttachShader(T,R),void 0!==n.index0AttributeName?o.bindAttribLocation(T,0,n.index0AttributeName):!0===a.morphTargets&&o.bindAttribLocation(T,0,"position"),window.webglCallbackHandler.onBeforeLinkProgram(T);var C,P,O=o.getProgramInfoLog(T).trim(),I=o.getShaderInfoLog(L).trim(),N=o.getShaderInfoLog(R).trim(),B=!0,U=!0;return!1===o.getProgramParameter(T,o.LINK_STATUS)?(B=!1,console.error("THREE.WebGLProgram: shader error: ",o.getError(),"gl.VALIDATE_STATUS",o.getProgramParameter(T,o.VALIDATE_STATUS),"gl.getProgramInfoLog",O,I,N)):""!==O?console.warn("THREE.WebGLProgram: gl.getProgramInfoLog()",O):""!==I&&""!==N||(U=!1),U&&(this.diagnostics={runnable:B,material:n,programLog:O,vertexShader:{log:I,prefix:v},fragmentShader:{log:N,prefix:y}}),o.deleteShader(L),o.deleteShader(R),this.getUniforms=function(){return void 0===C&&(C=new la(o,T,e)),C},this.getAttributes=function(){return void 0===P&&(P=function(e,t){for(var i={},n=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES),r=0;r<n;r++){var a=e.getActiveAttrib(t,r).name;i[a]=e.getAttribLocation(t,a)}return i}(o,T)),P},this.destroy=function(){o.deleteProgram(T),this.program=void 0},Object.defineProperties(this,{uniforms:{get:function(){return console.warn("THREE.WebGLProgram: .uniforms is now .getUniforms()."),this.getUniforms()}},attributes:{get:function(){return console.warn("THREE.WebGLProgram: .attributes is now .getAttributes()."),this.getAttributes()}}}),this.name=r.name,this.id=da++,this.code=i,this.usedTimes=1,this.program=T,this.vertexShader=L,this.fragmentShader=R,this}function ba(u,c,d){var h=[],p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"phong",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow"},a=["precision","supportsVertexTextures","map","mapEncoding","envMap","envMapMode","envMapEncoding","lightMap","aoMap","emissiveMap","emissiveMapEncoding","bumpMap","normalMap","displacementMap","specularMap","roughnessMap","metalnessMap","gradientMap","alphaMap","combine","vertexColors","fog","useFog","fogExp","flatShading","sizeAttenuation","logarithmicDepthBuffer","skinning","maxBones","useVertexTexture","morphTargets","morphNormals","maxMorphTargets","maxMorphNormals","premultipliedAlpha","numDirLights","numPointLights","numSpotLights","numHemiLights","numRectAreaLights","shadowMapEnabled","shadowMapType","toneMapping","physicallyCorrectLights","alphaTest","doubleSided","flipSided","numClippingPlanes","numClipIntersection","depthPacking","dithering"];function f(e,t){var i;return e?e.isTexture?i=e.encoding:e.isWebGLRenderTarget&&(console.warn("THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead."),i=e.texture.encoding):i=At,i===At&&t&&(i=Rt),i}this.getParameters=function(e,t,i,n,r,a,o){var s=p[e.type],c=o.isSkinnedMesh?function(e){var t=e.skeleton.bones;if(d.floatVertexTextures)return 1024;var i=d.maxVertexUniforms,n=Math.floor((i-20)/4),r=Math.min(n,t.length);return r<t.length?(console.warn("THREE.WebGLRenderer: Skeleton has "+t.length+" bones. This GPU supports "+r+"."),0):r}(o):0,h=d.precision;null!==e.precision&&(h=d.getMaxPrecision(e.precision))!==e.precision&&console.warn("THREE.WebGLProgram.getParameters:",e.precision,"not supported, using",h,"instead.");var l=u.getRenderTarget();return{shaderID:s,precision:h,supportsVertexTextures:d.vertexTextures,outputEncoding:f(l?l.texture:null,u.gammaOutput),map:!!e.map,mapEncoding:f(e.map,u.gammaInput),envMap:!!e.envMap,envMapMode:e.envMap&&e.envMap.mapping,envMapEncoding:f(e.envMap,u.gammaInput),envMapCubeUV:!!e.envMap&&(e.envMap.mapping===ye||e.envMap.mapping===xe),lightMap:!!e.lightMap,aoMap:!!e.aoMap,emissiveMap:!!e.emissiveMap,emissiveMapEncoding:f(e.emissiveMap,u.gammaInput),bumpMap:!!e.bumpMap,normalMap:!!e.normalMap,displacementMap:!!e.displacementMap,roughnessMap:!!e.roughnessMap,metalnessMap:!!e.metalnessMap,specularMap:!!e.specularMap,alphaMap:!!e.alphaMap,gradientMap:!!e.gradientMap,combine:e.combine,vertexColors:e.vertexColors,fog:!!n,useFog:e.fog,fogExp:n&&n.isFogExp2,flatShading:e.flatShading,sizeAttenuation:e.sizeAttenuation,logarithmicDepthBuffer:d.logarithmicDepthBuffer,skinning:e.skinning&&0<c,maxBones:c,useVertexTexture:d.floatVertexTextures,morphTargets:e.morphTargets,morphNormals:e.morphNormals,maxMorphTargets:u.maxMorphTargets,maxMorphNormals:u.maxMorphNormals,numDirLights:t.directional.length,numPointLights:t.point.length,numSpotLights:t.spot.length,numRectAreaLights:t.rectArea.length,numHemiLights:t.hemi.length,numClippingPlanes:r,numClipIntersection:a,dithering:e.dithering,shadowMapEnabled:u.shadowMap.enabled&&o.receiveShadow&&0<i.length,shadowMapType:u.shadowMap.type,toneMapping:u.toneMapping,physicallyCorrectLights:u.physicallyCorrectLights,premultipliedAlpha:e.premultipliedAlpha,alphaTest:e.alphaTest,doubleSided:e.side===Z,flipSided:e.side===Ae,depthPacking:void 0!==e.depthPacking&&e.depthPacking}},this.getProgramCode=function(e,t){var i=[];if(t.shaderID?i.push(t.shaderID):(i.push(e.fragmentShader),i.push(e.vertexShader)),void 0!==e.defines)for(var n in e.defines)i.push(n),i.push(e.defines[n]);for(var r=0;r<a.length;r++)i.push(t[a[r]]);return i.push(e.onBeforeCompile.toString()),i.push(u.gammaOutput),i.join()},this.acquireProgram=function(e,t,i,n){for(var r,a=0,o=h.length;a<o;a++){var s=h[a];if(s.code===n){++(r=s).usedTimes;break}}return void 0===r&&(r=new wa(u,c,n,e,t,i),h.push(r)),r},this.releaseProgram=function(e){if(0==--e.usedTimes){var t=h.indexOf(e);h[t]=h[h.length-1],h.pop(),e.destroy()}},this.programs=h}function _a(){var n=new WeakMap;return{get:function(e){var t=n.get(e);return void 0===t&&(t={},n.set(e,t)),t},remove:function(e){n.delete(e)},update:function(e,t,i){n.get(e)[t]=i},dispose:function(){n=new WeakMap}}}function Ma(e,t){return e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.program&&t.program&&e.program!==t.program?e.program.id-t.program.id:e.material.id!==t.material.id?e.material.id-t.material.id:e.z!==t.z?e.z-t.z:e.id-t.id}function Ea(e,t){return e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:e.id-t.id}function Ta(){var o=[],s=0,c=[],h=[];return{opaque:c,transparent:h,init:function(){s=0,c.length=0,h.length=0},push:function(e,t,i,n,r){var a=o[s];void 0===a?(a={id:e.id,object:e,geometry:t,material:i,program:i.program,renderOrder:e.renderOrder,z:n,group:r},o[s]=a):(a.id=e.id,a.object=e,a.geometry=t,a.material=i,a.program=i.program,a.renderOrder=e.renderOrder,a.z=n,a.group=r),e.addedObject?e.addedObject.mesh.material.uniforms.forcedColor&&-50==e.addedObject.mesh.material.uniforms.forcedColor.value.x?1==e.addedObject.mesh.material.uniforms.alpha.value?(c.push(a),e.addedObject.listedAsOpaque=!0):(h.push(a),e.addedObject.listedAsOpaque=!1):e.addedObject.mesh.material.uniforms.forcedColor&&1==e.addedObject.mesh.material.uniforms.forcedColor.value.x?(c.push(a),e.addedObject.listedAsOpaque=!0):(h.push(a),e.addedObject.listedAsOpaque=!1):(!0===i.transparent?h:c).push(a),s++},sort:function(){1<c.length&&c.sort(Ma),1<h.length&&h.sort(Ea)}}}function Sa(){var r={};return{get:function(e,t){var i,n=r[e.id];return void 0===n?(i=new Ta,r[e.id]={},r[e.id][t.id]=i):(i=n[t.id])||(i=new Ta,n[t.id]=i),i},dispose:function(){r={}}}}function Aa(){var i={};return{get:function(e){if(void 0!==i[e.id])return i[e.id];var t;switch(e.type){case"DirectionalLight":t={direction:new zt,color:new yi,shadow:!1,shadowBias:0,shadowRadius:1,shadowMapSize:new Dt};break;case"SpotLight":t={position:new zt,direction:new zt,color:new yi,distance:0,coneCos:0,penumbraCos:0,decay:0,shadow:!1,shadowBias:0,shadowRadius:1,shadowMapSize:new Dt};break;case"PointLight":t={position:new zt,color:new yi,distance:0,decay:0,shadow:!1,shadowBias:0,shadowRadius:1,shadowMapSize:new Dt,shadowCameraNear:1,shadowCameraFar:1e3};break;case"HemisphereLight":t={direction:new zt,skyColor:new yi,groundColor:new yi};break;case"RectAreaLight":t={color:new yi,position:new zt,halfWidth:new zt,halfHeight:new zt}}return i[e.id]=t}}}var La,Ra,Ca,Pa,Oa,Ia,Na,Ba,Ua,Da,Fa,Ha,za,Ga,ka,Va,ja,Wa,Xa=0;function qa(){var b=new Aa,_={id:Xa++,hash:{stateID:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,shadowsLength:-1},ambient:[0,0,0],directional:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotShadowMap:[],spotShadowMatrix:[],rectArea:[],point:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[]},M=new zt,E=new Ft,T=new Ft;return{setup:function(e,t,i){for(var n=0,r=0,a=0,o=0,s=0,c=0,h=0,l=0,u=i.matrixWorldInverse,d=0,p=e.length;d<p;d++){var f=e[d],m=f.color,g=f.intensity,v=f.distance,y=f.shadow&&f.shadow.map?f.shadow.map.texture:null;if(f.isAmbientLight)n+=m.r*g,r+=m.g*g,a+=m.b*g;else if(f.isDirectionalLight){if((w=b.get(f)).color.copy(f.color).multiplyScalar(f.intensity),w.direction.setFromMatrixPosition(f.matrixWorld),M.setFromMatrixPosition(f.target.matrixWorld),w.direction.sub(M),w.direction.transformDirection(u),w.shadow=f.castShadow,f.castShadow){var x=f.shadow;w.shadowBias=x.bias,w.shadowRadius=x.radius,w.shadowMapSize=x.mapSize}_.directionalShadowMap[o]=y,_.directionalShadowMatrix[o]=f.shadow.matrix,_.directional[o]=w,o++}else if(f.isSpotLight)(w=b.get(f)).position.setFromMatrixPosition(f.matrixWorld),w.position.applyMatrix4(u),w.color.copy(m).multiplyScalar(g),w.distance=v,w.direction.setFromMatrixPosition(f.matrixWorld),M.setFromMatrixPosition(f.target.matrixWorld),w.direction.sub(M),w.direction.transformDirection(u),w.coneCos=Math.cos(f.angle),w.penumbraCos=Math.cos(f.angle*(1-f.penumbra)),w.decay=0===f.distance?0:f.decay,w.shadow=f.castShadow,f.castShadow&&(x=f.shadow,w.shadowBias=x.bias,w.shadowRadius=x.radius,w.shadowMapSize=x.mapSize),_.spotShadowMap[c]=y,_.spotShadowMatrix[c]=f.shadow.matrix,_.spot[c]=w,c++;else if(f.isRectAreaLight)(w=b.get(f)).color.copy(m).multiplyScalar(g),w.position.setFromMatrixPosition(f.matrixWorld),w.position.applyMatrix4(u),T.identity(),E.copy(f.matrixWorld),E.premultiply(u),T.extractRotation(E),w.halfWidth.set(.5*f.width,0,0),w.halfHeight.set(0,.5*f.height,0),w.halfWidth.applyMatrix4(T),w.halfHeight.applyMatrix4(T),_.rectArea[h]=w,h++;else if(f.isPointLight)(w=b.get(f)).position.setFromMatrixPosition(f.matrixWorld),w.position.applyMatrix4(u),w.color.copy(f.color).multiplyScalar(f.intensity),w.distance=f.distance,w.decay=0===f.distance?0:f.decay,w.shadow=f.castShadow,f.castShadow&&(x=f.shadow,w.shadowBias=x.bias,w.shadowRadius=x.radius,w.shadowMapSize=x.mapSize,w.shadowCameraNear=x.camera.near,w.shadowCameraFar=x.camera.far),_.pointShadowMap[s]=y,_.pointShadowMatrix[s]=f.shadow.matrix,_.point[s]=w,s++;else if(f.isHemisphereLight){var w;(w=b.get(f)).direction.setFromMatrixPosition(f.matrixWorld),w.direction.transformDirection(u),w.direction.normalize(),w.skyColor.copy(f.color).multiplyScalar(g),w.groundColor.copy(f.groundColor).multiplyScalar(g),_.hemi[l]=w,l++}}_.ambient[0]=n,_.ambient[1]=r,_.ambient[2]=a,_.directional.length=o,_.spot.length=c,_.rectArea.length=h,_.point.length=s,_.hemi.length=l,_.hash.stateID=_.id,_.hash.directionalLength=o,_.hash.pointLength=s,_.hash.spotLength=c,_.hash.rectAreaLength=h,_.hash.hemiLength=l,_.hash.shadowsLength=t.length},state:_}}function Ya(){var t=new qa,i=[],n=[],r=[];return{init:function(){i.length=0,n.length=0,r.length=0},state:{lightsArray:i,shadowsArray:n,spritesArray:r,lights:t},setupLights:function(e){t.setup(i,n,e)},pushLight:function(e){i.push(e)},pushShadow:function(e){n.push(e)},pushSprite:function(e){r.push(e)}}}function Za(){var n={};return{get:function(e,t){var i;return void 0===n[e.id]?(i=new Ya,n[e.id]={},n[e.id][t.id]=i):void 0===n[e.id][t.id]?(i=new Ya,n[e.id][t.id]=i):i=n[e.id][t.id],i},dispose:function(){n={}}}}function Ja(e){rr.call(this),this.type="MeshDepthMaterial",this.depthPacking=Nt,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.setValues(e)}function Qa(e){rr.call(this),this.type="MeshDistanceMaterial",this.referencePosition=new zt,this.nearDistance=1,this.farDistance=1e3,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.fog=!1,this.lights=!1,this.setValues(e)}function Ka(x,m,e){for(var w=new pi,b=new Ft,_=new Dt,M=new Dt(e,e),E=new zt,T=new zt,v=1,y=2,t=1+(v|y),S=new Array(t),A=new Array(t),L={},R={0:Ae,1:B,2:Z},C=[new zt(1,0,0),new zt(-1,0,0),new zt(0,0,1),new zt(0,0,-1),new zt(0,1,0),new zt(0,-1,0)],P=[new zt(0,1,0),new zt(0,1,0),new zt(0,1,0),new zt(0,1,0),new zt(0,0,1),new zt(0,0,-1)],O=[new oi,new oi,new oi,new oi,new oi,new oi],i=0;i!==t;++i){var n=0!=(i&v),r=0!=(i&y),a=new Ja({depthPacking:Bt,morphTargets:n,skinning:r});S[i]=a;var o=new Qa({morphTargets:n,skinning:r});A[i]=o}var I=this;function g(e,t,i,n,r,a){var o=e.geometry,s=null,c=S,h=e.customDepthMaterial;if(i&&(c=A,h=e.customDistanceMaterial),h)s=h;else{var l=!1;t.morphTargets&&(o&&o.isBufferGeometry?l=o.morphAttributes&&o.morphAttributes.position&&0<o.morphAttributes.position.length:o&&o.isGeometry&&(l=o.morphTargets&&0<o.morphTargets.length)),e.isSkinnedMesh&&!1===t.skinning&&console.warn("THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false:",e);var u=e.isSkinnedMesh&&t.skinning,d=0;l&&(d|=v),u&&(d|=y),s=c[d]}if(x.localClippingEnabled&&!0===t.clipShadows&&0!==t.clippingPlanes.length){var p=s.uuid,f=t.uuid,m=L[p];void 0===m&&(m={},L[p]=m);var g=m[f];void 0===g&&(g=s.clone(),m[f]=g),s=g}return s.visible=t.visible,s.wireframe=t.wireframe,s.side=null!=t.shadowSide?t.shadowSide:R[t.side],s.clipShadows=t.clipShadows,s.clippingPlanes=t.clippingPlanes,s.clipIntersection=t.clipIntersection,s.wireframeLinewidth=t.wireframeLinewidth,s.linewidth=t.linewidth,i&&s.isMeshDistanceMaterial&&(s.referencePosition.copy(n),s.nearDistance=r,s.farDistance=a),s}function N(e,t,i,n){if(!1!==e.visible){if(e.layers.test(t.layers)&&(e.isMesh||e.isLine||e.isPoints)&&e.castShadow&&(!e.frustumCulled||w.intersectsObject(e))){e.modelViewMatrix.multiplyMatrices(i.matrixWorldInverse,e.matrixWorld);var r=m.update(e),a=e.material;if(Array.isArray(a))for(var o=r.groups,s=0,c=o.length;s<c;s++){var h=o[s],l=a[h.materialIndex];if(l&&l.visible){var u=g(e,l,n,T,i.near,i.far);x.renderBufferDirect(i,null,r,u,e,h)}}else if(a.visible){u=g(e,a,n,T,i.near,i.far);x.renderBufferDirect(i,null,r,u,e,null)}}for(var d=e.children,p=0,f=d.length;p<f;p++)N(d[p],t,i,n)}}this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=D,this.render=function(e,t,i){if(!1!==I.enabled&&(!1!==I.autoUpdate||!1!==I.needsUpdate)&&0!==e.length){var n,r=x.context,a=x.state;a.disable(r.BLEND),a.buffers.color.setClear(1,1,1,1),a.buffers.depth.setTest(!0),a.setScissorTest(!1);for(var o=0,s=e.length;o<s;o++){var c=e[o],h=c.shadow,l=c&&c.isPointLight;if(void 0!==h){var u=h.camera;if(_.copy(h.mapSize),_.min(M),l){var d=_.x,p=_.y;O[0].set(2*d,p,d,p),O[1].set(0,p,d,p),O[2].set(3*d,p,d,p),O[3].set(d,p,d,p),O[4].set(3*d,0,d,p),O[5].set(d,0,d,p),_.x*=4,_.y*=2}if(null===h.map){var f={minFilter:Me,magFilter:Me,format:Xe};h.map=new si(_.x,_.y,f),h.map.texture.name=c.name+".shadowMap",u.updateProjectionMatrix()}h.isSpotLightShadow&&h.update(c);var m=h.map,g=h.matrix;T.setFromMatrixPosition(c.matrixWorld),u.position.copy(T),l?(n=6,g.makeTranslation(-T.x,-T.y,-T.z)):(n=1,E.setFromMatrixPosition(c.target.matrixWorld),u.lookAt(E),u.updateMatrixWorld(),g.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),g.multiply(u.projectionMatrix),g.multiply(u.matrixWorldInverse)),x.setRenderTarget(m),x.clear();for(var v=0;v<n;v++){if(l){E.copy(u.position),E.add(C[v]),u.up.copy(P[v]),u.lookAt(E),u.updateMatrixWorld();var y=O[v];a.viewport(y)}b.multiplyMatrices(u.projectionMatrix,u.matrixWorldInverse),w.setFromMatrix(b),N(t,i,u,l)}}else console.warn("THREE.WebGLShadowMap:",c,"has no shadow.")}I.needsUpdate=!1}}}function $a(e,t,i,n,r,a,o,s,c){ai.call(this,e,t,i,n,r,a,o,s,c),this.needsUpdate=!0}function eo(p,f,m,g,s){var v,y,x,w,b,_,M=new zt,E=new Ht,T=new zt;function S(){var e,t,i,n=new Float32Array([-.5,-.5,0,0,.5,-.5,1,0,.5,.5,1,1,-.5,.5,0,1]),r=new Uint16Array([0,1,2,0,2,3]);v=f.createBuffer(),y=f.createBuffer(),f.bindBuffer(f.ARRAY_BUFFER,v),f.bufferData(f.ARRAY_BUFFER,n,f.STATIC_DRAW),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,y),f.bufferData(f.ELEMENT_ARRAY_BUFFER,r,f.STATIC_DRAW),e=f.createProgram(),t=f.createShader(f.VERTEX_SHADER),i=f.createShader(f.FRAGMENT_SHADER),f.shaderSource(t,["precision "+s.precision+" float;","#define SHADER_NAME SpriteMaterial","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform float rotation;","uniform vec2 center;","uniform vec2 scale;","uniform vec2 uvOffset;","uniform vec2 uvScale;","attribute vec2 position;","attribute vec2 uv;","varying vec2 vUV;","varying float fogDepth;","void main() {","\tvUV = uvOffset + uv * uvScale;","\tvec2 alignedPosition = ( position - center ) * scale;","\tvec2 rotatedPosition;","\trotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;","\trotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;","\tvec4 mvPosition;","\tmvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );","\tmvPosition.xy += rotatedPosition;","\tgl_Position = projectionMatrix * mvPosition;","\tfogDepth = - mvPosition.z;","}"].join("\n")),f.shaderSource(i,["precision "+s.precision+" float;","#define SHADER_NAME SpriteMaterial","uniform vec3 color;","uniform sampler2D map;","uniform float opacity;","uniform int fogType;","uniform vec3 fogColor;","uniform float fogDensity;","uniform float fogNear;","uniform float fogFar;","uniform float alphaTest;","varying vec2 vUV;","varying float fogDepth;","void main() {","\tvec4 texture = texture2D( map, vUV );","\tgl_FragColor = vec4( color * texture.xyz, texture.a * opacity );","\tif ( gl_FragColor.a < alphaTest ) discard;","\tif ( fogType > 0 ) {","\t\tfloat fogFactor = 0.0;","\t\tif ( fogType == 1 ) {","\t\t\tfogFactor = smoothstep( fogNear, fogFar, fogDepth );","\t\t} else {","\t\t\tconst float LOG2 = 1.442695;","\t\t\tfogFactor = exp2( - fogDensity * fogDensity * fogDepth * fogDepth * LOG2 );","\t\t\tfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );","\t\t}","\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );","\t}","}"].join("\n")),f.compileShader(t),f.compileShader(i),f.attachShader(e,t),f.attachShader(e,i),f.linkProgram(e),x=e,w={position:f.getAttribLocation(x,"position"),uv:f.getAttribLocation(x,"uv")},b={uvOffset:f.getUniformLocation(x,"uvOffset"),uvScale:f.getUniformLocation(x,"uvScale"),rotation:f.getUniformLocation(x,"rotation"),center:f.getUniformLocation(x,"center"),scale:f.getUniformLocation(x,"scale"),color:f.getUniformLocation(x,"color"),map:f.getUniformLocation(x,"map"),opacity:f.getUniformLocation(x,"opacity"),modelViewMatrix:f.getUniformLocation(x,"modelViewMatrix"),projectionMatrix:f.getUniformLocation(x,"projectionMatrix"),fogType:f.getUniformLocation(x,"fogType"),fogDensity:f.getUniformLocation(x,"fogDensity"),fogNear:f.getUniformLocation(x,"fogNear"),fogFar:f.getUniformLocation(x,"fogFar"),fogColor:f.getUniformLocation(x,"fogColor"),fogDepth:f.getUniformLocation(x,"fogDepth"),alphaTest:f.getUniformLocation(x,"alphaTest")};var a=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");a.width=8,a.height=8;var o=a.getContext("2d");o.fillStyle="white",o.fillRect(0,0,8,8),_=new $a(a)}function A(e,t){return e.renderOrder!==t.renderOrder?e.renderOrder-t.renderOrder:e.z!==t.z?t.z-e.z:t.id-e.id}this.render=function(e,t,i){if(0!==e.length){void 0===x&&S(),m.useProgram(x),m.initAttributes(),m.enableAttribute(w.position),m.enableAttribute(w.uv),m.disableUnusedAttributes(),m.disable(f.CULL_FACE),m.enable(f.BLEND),f.bindBuffer(f.ARRAY_BUFFER,v),f.vertexAttribPointer(w.position,2,f.FLOAT,!1,16,0),f.vertexAttribPointer(w.uv,2,f.FLOAT,!1,16,8),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,y),f.uniformMatrix4fv(b.projectionMatrix,!1,i.projectionMatrix.elements),m.activeTexture(f.TEXTURE0),f.uniform1i(b.map,0);var n=0,r=0,a=t.fog;a?(f.uniform3f(b.fogColor,a.color.r,a.color.g,a.color.b),a.isFog?(f.uniform1f(b.fogNear,a.near),f.uniform1f(b.fogFar,a.far),f.uniform1i(b.fogType,1),r=n=1):a.isFogExp2&&(f.uniform1f(b.fogDensity,a.density),f.uniform1i(b.fogType,2),r=n=2)):(f.uniform1i(b.fogType,0),r=n=0);for(var o=0,s=e.length;o<s;o++){(l=e[o]).modelViewMatrix.multiplyMatrices(i.matrixWorldInverse,l.matrixWorld),l.z=-l.modelViewMatrix.elements[14]}e.sort(A);var c=[],h=[];for(o=0,s=e.length;o<s;o++){var l,u=(l=e[o]).material;if(!1!==u.visible){l.onBeforeRender(p,t,i,void 0,u,void 0),f.uniform1f(b.alphaTest,u.alphaTest),f.uniformMatrix4fv(b.modelViewMatrix,!1,l.modelViewMatrix.elements),l.matrixWorld.decompose(M,E,T),c[0]=T.x,c[1]=T.y,h[0]=l.center.x-.5,h[1]=l.center.y-.5;var d=0;t.fog&&u.fog&&(d=r),n!==d&&(f.uniform1i(b.fogType,d),n=d),null!==u.map?(f.uniform2f(b.uvOffset,u.map.offset.x,u.map.offset.y),f.uniform2f(b.uvScale,u.map.repeat.x,u.map.repeat.y)):(f.uniform2f(b.uvOffset,0,0),f.uniform2f(b.uvScale,1,1)),f.uniform1f(b.opacity,u.opacity),f.uniform3f(b.color,u.color.r,u.color.g,u.color.b),f.uniform1f(b.rotation,u.rotation),f.uniform2fv(b.center,h),f.uniform2fv(b.scale,c),m.setBlending(u.blending,u.blendEquation,u.blendSrc,u.blendDst,u.blendEquationAlpha,u.blendSrcAlpha,u.blendDstAlpha,u.premultipliedAlpha),m.buffers.depth.setTest(u.depthTest),m.buffers.depth.setMask(u.depthWrite),m.buffers.color.setMask(u.colorWrite),g.setTexture2D(u.map||_,0),f.drawElements(f.TRIANGLES,6,f.UNSIGNED_SHORT,0),l.onAfterRender(p,t,i,void 0,u,void 0)}}m.enable(f.CULL_FACE),m.reset()}}}function to(l,i,c){var n=new function(){var t=!1,a=new oi,i=null,o=new oi(0,0,0,0);return{setMask:function(e){i===e||t||(l.colorMask(e,e,e,e),i=e)},setLocked:function(e){t=e},setClear:function(e,t,i,n,r){!0===r&&(e*=n,t*=n,i*=n),a.set(e,t,i,n),!1===o.equals(a)&&(l.clearColor(e,t,i,n),o.copy(a))},reset:function(){t=!1,i=null,o.set(-1,0,0,0)}}},r=new function(){var t=!1,i=null,n=null,r=null;return{setTest:function(e){e?D(l.DEPTH_TEST):F(l.DEPTH_TEST)},setMask:function(e){i===e||t||(l.depthMask(e),i=e)},setFunc:function(e){if(n!==e){if(e)switch(e){case ee:l.depthFunc(l.NEVER);break;case te:l.depthFunc(l.ALWAYS);break;case ie:l.depthFunc(l.LESS);break;case ne:l.depthFunc(l.LEQUAL);break;case re:l.depthFunc(l.EQUAL);break;case ae:l.depthFunc(l.GEQUAL);break;case oe:l.depthFunc(l.GREATER);break;case se:l.depthFunc(l.NOTEQUAL);break;default:l.depthFunc(l.LEQUAL)}else l.depthFunc(l.LEQUAL);n=e}},setLocked:function(e){t=e},setClear:function(e){r!==e&&(l.clearDepth(e),r=e)},reset:function(){t=!1,r=n=i=null}}},t=new function(){var t=!1,i=null,n=null,r=null,a=null,o=null,s=null,c=null,h=null;return{setTest:function(e){e?D(l.STENCIL_TEST):F(l.STENCIL_TEST)},setMask:function(e){i===e||t||(l.stencilMask(e),i=e)},setFunc:function(e,t,i){n===e&&r===t&&a===i||(l.stencilFunc(e,t,i),n=e,r=t,a=i)},setOp:function(e,t,i){o===e&&s===t&&c===i||(l.stencilOp(e,t,i),o=e,s=t,c=i)},setLocked:function(e){t=e},setClear:function(e){h!==e&&(l.clearStencil(e),h=e)},reset:function(){t=!1,h=c=s=o=a=r=n=i=null}}},e=l.getParameter(l.MAX_VERTEX_ATTRIBS),a=new Uint8Array(e),o=new Uint8Array(e),s=new Uint8Array(e),h={},u=null,d=null,p=null,f=null,m=null,g=null,v=null,y=null,x=null,w=!1,b=null,_=null,M=null,E=null,T=null,S=l.getParameter(l.MAX_COMBINED_TEXTURE_IMAGE_UNITS),A=!1,L=0,R=l.getParameter(l.VERSION);-1!==R.indexOf("WebGL")?(L=parseFloat(/^WebGL\ ([0-9])/.exec(R)[1]),A=1<=L):-1!==R.indexOf("OpenGL ES")&&(L=parseFloat(/^OpenGL\ ES\ ([0-9])/.exec(R)[1]),A=2<=L);var C=null,P={},O=new oi,I=new oi;function N(e,t,i){var n=new Uint8Array(4),r=l.createTexture();window.webglCallbackHandler?window.webglCallbackHandler.onBeforeBindTexture(e,r,0):l.bindTexture(e,r),l.texParameteri(e,l.TEXTURE_MIN_FILTER,l.NEAREST),l.texParameteri(e,l.TEXTURE_MAG_FILTER,l.NEAREST);for(var a=0;a<i;a++)l.texImage2D(t+a,0,l.RGBA,1,1,0,l.RGBA,l.UNSIGNED_BYTE,n);return r}var B={};function U(e,t){(a[e]=1,0===o[e]&&(l.enableVertexAttribArray(e),o[e]=1),s[e]!==t)&&(i.get("ANGLE_instanced_arrays").vertexAttribDivisorANGLE(e,t),s[e]=t)}function D(e){!0!==h[e]&&(l.enable(e),h[e]=!0)}function F(e){!1!==h[e]&&(l.disable(e),h[e]=!1)}function H(e,t,i,n,r,a,o,s){if(e!==q){if(D(l.BLEND),e!==$){if(e!==p||s!==w)switch(e){case J:s?(window.webglCallbackHandler.onBeforeBlendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD,1),window.webglCallbackHandler.onBeforeBlendFuncSeparate(l.ONE,l.ONE,l.ONE,l.ONE,1)):(window.webglCallbackHandler.onBeforeBlendEquation(l.FUNC_ADD,0),window.webglCallbackHandler.onBeforeBlendFunc(l.SRC_ALPHA,l.ONE,0));break;case Q:s?(window.webglCallbackHandler.onBeforeBlendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD,2),window.webglCallbackHandler.onBeforeBlendFuncSeparate(l.ZERO,l.ZERO,l.ONE_MINUS_SRC_COLOR,l.ONE_MINUS_SRC_ALPHA,2)):(window.webglCallbackHandler.onBeforeBlendEquation(l.FUNC_ADD,1),window.webglCallbackHandler.onBeforeBlendFunc(l.ZERO,l.ONE_MINUS_SRC_COLOR,1));break;case K:s?(window.webglCallbackHandler.onBeforeBlendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD,3),window.webglCallbackHandler.onBeforeBlendFuncSeparate(l.ZERO,l.SRC_COLOR,l.ZERO,l.SRC_ALPHA,3)):(window.webglCallbackHandler.onBeforeBlendEquation(l.FUNC_ADD,2),window.webglCallbackHandler.onBeforeBlendFunc(l.ZERO,l.SRC_COLOR,2));break;default:s?(window.webglCallbackHandler.onBeforeBlendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD,4),window.webglCallbackHandler.onBeforeBlendFuncSeparate(l.ONE,l.ONE_MINUS_SRC_ALPHA,l.ONE,l.ONE_MINUS_SRC_ALPHA,4)):window.webglCallbackHandler?(window.webglCallbackHandler.onBeforeBlendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD,5),window.webglCallbackHandler.onBeforeBlendFuncSeparate(l.SRC_ALPHA,l.ONE_MINUS_SRC_ALPHA,l.ONE,l.ONE_MINUS_SRC_ALPHA,5)):(l.blendEquationSeparate(l.FUNC_ADD,l.FUNC_ADD),l.blendFuncSeparate(l.SRC_ALPHA,l.ONE_MINUS_SRC_ALPHA,l.ONE,l.ONE_MINUS_SRC_ALPHA))}x=y=v=g=m=f=null}else r=r||t,a=a||i,o=o||n,t===f&&r===v||(window.webglCallbackHandler.onBeforeBlendEquationSeparate(c.convert(t),c.convert(r),0),f=t,v=r),i===m&&n===g&&a===y&&o===x||(window.webglCallbackHandler.onBeforeBlendFuncSeparate(c.convert(i),c.convert(n),c.convert(a),c.convert(o),0),m=i,g=n,y=a,x=o);p=e,w=s}else F(l.BLEND)}function z(e){b!==e&&(e?l.frontFace(l.CW):l.frontFace(l.CCW),b=e)}function G(e){e!==j?(D(l.CULL_FACE),e!==_&&(e===W?l.cullFace(l.BACK):e===X?l.cullFace(l.FRONT):l.cullFace(l.FRONT_AND_BACK))):F(l.CULL_FACE),_=e}function k(e,t,i){e?(D(l.POLYGON_OFFSET_FILL),E===t&&T===i||(l.polygonOffset(t,i),E=t,T=i)):F(l.POLYGON_OFFSET_FILL)}function V(e){void 0===e&&(e=l.TEXTURE0+S-1),C!==e&&(window.webglCallbackHandler.onBeforeActiveTexture(e),C=e)}return B[l.TEXTURE_2D]=N(l.TEXTURE_2D,l.TEXTURE_2D,1),B[l.TEXTURE_CUBE_MAP]=N(l.TEXTURE_CUBE_MAP,l.TEXTURE_CUBE_MAP_POSITIVE_X,6),n.setClear(0,0,0,1),r.setClear(1),t.setClear(0),D(l.DEPTH_TEST),r.setFunc(ne),z(!1),G(W),D(l.CULL_FACE),D(l.BLEND),H(Y),{buffers:{color:n,depth:r,stencil:t},initAttributes:function(){for(var e=0,t=a.length;e<t;e++)a[e]=0},enableAttribute:function(e){U(e,0)},enableAttributeAndDivisor:U,disableUnusedAttributes:function(){for(var e=0,t=o.length;e!==t;++e)o[e]!==a[e]&&(l.disableVertexAttribArray(e),o[e]=0)},enable:D,disable:F,getCompressedTextureFormats:function(){if(null===u&&(u=[],i.get("WEBGL_compressed_texture_pvrtc")||i.get("WEBGL_compressed_texture_s3tc")||i.get("WEBGL_compressed_texture_etc1")||i.get("WEBGL_compressed_texture_astc")))for(var e=l.getParameter(l.COMPRESSED_TEXTURE_FORMATS),t=0;t<e.length;t++)u.push(e[t]);return u},useProgram:function(e){return d!==e&&(window.webglCallbackHandler.onBeforeUseProgram(e),d=e,!0)},setBlending:H,setMaterial:function(e,t){e.side===Z?F(l.CULL_FACE):D(l.CULL_FACE);var i=e.side===Ae;t&&(i=!i),z(i),!0===e.transparent?H(e.blending,e.blendEquation,e.blendSrc,e.blendDst,e.blendEquationAlpha,e.blendSrcAlpha,e.blendDstAlpha,e.premultipliedAlpha):H(q),r.setFunc(e.depthFunc),r.setTest(e.depthTest),r.setMask(e.depthWrite),n.setMask(e.colorWrite),k(e.polygonOffset,e.polygonOffsetFactor,e.polygonOffsetUnits)},setFlipSided:z,setCullFace:G,setLineWidth:function(e){e!==M&&(A&&l.lineWidth(e),M=e)},setPolygonOffset:k,setScissorTest:function(e){e?D(l.SCISSOR_TEST):F(l.SCISSOR_TEST)},activeTexture:V,bindTexture:function(e,t){null===C&&V();var i=P[C];void 0===i&&(i={type:void 0,texture:void 0},P[C]=i),i.type===e&&i.texture===t||(window.webglCallbackHandler.onBeforeBindTexture(e,t||B[e]),i.type=e,i.texture=t)},compressedTexImage2D:function(){try{l.compressedTexImage2D.apply(l,arguments)}catch(e){console.error("THREE.WebGLState:",e)}},texImage2D:function(){try{l.texImage2D.apply(l,arguments)}catch(e){console.error("THREE.WebGLState:",e)}},scissor:function(e){!1===O.equals(e)&&(l.scissor(e.x,e.y,e.z,e.w),O.copy(e))},viewport:function(e){!1===I.equals(e)&&(l.viewport(e.x,e.y,e.z,e.w),I.copy(e))},reset:function(){for(var e=0;e<o.length;e++)1===o[e]&&(l.disableVertexAttribArray(e),o[e]=0);h={},P={},_=b=p=d=C=u=null,n.reset(),r.reset(),t.reset()}}}function io(m,r,g,v,y,x,w){var f,b="undefined"!=typeof WebGL2RenderingContext&&m instanceof WebGL2RenderingContext,s={};function _(e,t){if(e.width>t||e.height>t){if("data"in e)return void console.warn("THREE.WebGLRenderer: image in DataTexture is too big ("+e.width+"x"+e.height+").");var i=t/Math.max(e.width,e.height),n=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");return n.width=Math.floor(e.width*i),n.height=Math.floor(e.height*i),n.getContext("2d").drawImage(e,0,0,e.width,e.height,0,0,n.width,n.height),console.warn("THREE.WebGLRenderer: image is too big ("+e.width+"x"+e.height+"). Resized to "+n.width+"x"+n.height,e),n}return e}function M(e){return Ut.isPowerOfTwo(e.width)&&Ut.isPowerOfTwo(e.height)}function E(e,t){return e.generateMipmaps&&t&&e.minFilter!==Me&&e.minFilter!==Se}function T(e,t,i,n){m.generateMipmap(e),v.get(t).__maxMipLevel=Math.log(Math.max(i,n))*Math.LOG2E}function a(e){return e===Me||e===Ee||e===Te?m.NEAREST:m.LINEAR}function S(e){var t=e.target;t.removeEventListener("dispose",S),function(e){var t=v.get(e);if(e.image&&t.__image__webglTextureCube)m.deleteTexture(t.__image__webglTextureCube);else{if(void 0===t.__webglInit)return;m.deleteTexture(t.__webglTexture)}v.remove(e)}(t),t.isVideoTexture&&delete s[t.id],w.memory.textures--}function o(e){var t=e.target;t.removeEventListener("dispose",o),function(e){var t=v.get(e),i=v.get(e.texture);if(!e)return;void 0!==i.__webglTexture&&m.deleteTexture(i.__webglTexture);e.depthTexture&&e.depthTexture.dispose();if(e.isWebGLRenderTargetCube)for(var n=0;n<6;n++)m.deleteFramebuffer(t.__webglFramebuffer[n]),t.__webglDepthbuffer&&m.deleteRenderbuffer(t.__webglDepthbuffer[n]);else m.deleteFramebuffer(t.__webglFramebuffer),t.__webglDepthbuffer&&m.deleteRenderbuffer(t.__webglDepthbuffer);v.remove(e.texture),v.remove(e)}(t),w.memory.textures--}function c(e,t){var i,n,r,a=v.get(e);if(e.isVideoTexture&&(n=(i=e).id,r=w.render.frame,s[n]!==r&&(s[n]=r,i.update())),0<e.version&&a.__version!==e.version){var o=e.image;if(void 0===o)return;if(!1!==o.complete)return void function(e,t,i){void 0===e.__webglInit&&(e.__webglInit=!0,t.addEventListener("dispose",S),e.__webglTexture=m.createTexture(),w.memory.textures++);g.activeTexture(m.TEXTURE0+i),g.bindTexture(m.TEXTURE_2D,e.__webglTexture),m.pixelStorei(m.UNPACK_FLIP_Y_WEBGL,t.flipY),m.pixelStorei(m.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),m.pixelStorei(m.UNPACK_ALIGNMENT,t.unpackAlignment);var n=_(t.image,y.maxTextureSize);a=t,(a.wrapS!==be||a.wrapT!==be||a.minFilter!==Me&&a.minFilter!==Se)&&!1===M(n)&&(n=(r=n)instanceof HTMLImageElement||r instanceof HTMLCanvasElement||r instanceof ImageBitmap?(void 0===f&&(f=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")),f.width=Ut.floorPowerOfTwo(r.width),f.height=Ut.floorPowerOfTwo(r.height),f.getContext("2d").drawImage(r,0,0,f.width,f.height),console.warn("THREE.WebGLRenderer: image is not power of two ("+r.width+"x"+r.height+"). Resized to "+f.width+"x"+f.height,r),f):r);var r;var a;var o=M(n),s=x.convert(t.format),c=x.convert(t.type);A(m.TEXTURE_2D,t,o);var h,l=t.mipmaps;if(t.isDepthTexture){var u=m.DEPTH_COMPONENT;if(t.type===Fe){if(!b)throw new Error("Float Depth Texture only supported in WebGL2.0");u=m.DEPTH_COMPONENT32F}else b&&(u=m.DEPTH_COMPONENT16);t.format===Je&&u===m.DEPTH_COMPONENT&&t.type!==Be&&t.type!==De&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),t.type=Be,c=x.convert(t.type)),t.format===Qe&&(u=m.DEPTH_STENCIL,t.type!==Ve&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),t.type=Ve,c=x.convert(t.type))),g.texImage2D(m.TEXTURE_2D,0,u,n.width,n.height,0,s,c,null)}else if(t.isDataTexture)if(0<l.length&&o){for(var d=0,p=l.length;d<p;d++)h=l[d],g.texImage2D(m.TEXTURE_2D,d,s,h.width,h.height,0,s,c,h.data);t.generateMipmaps=!1,e.__maxMipLevel=l.length-1}else g.texImage2D(m.TEXTURE_2D,0,s,n.width,n.height,0,s,c,n.data),e.__maxMipLevel=0;else if(t.isCompressedTexture){for(var d=0,p=l.length;d<p;d++)h=l[d],t.format!==Xe&&t.format!==We?-1<g.getCompressedTextureFormats().indexOf(s)?g.compressedTexImage2D(m.TEXTURE_2D,d,s,h.width,h.height,0,h.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):g.texImage2D(m.TEXTURE_2D,d,s,h.width,h.height,0,s,c,h.data);e.__maxMipLevel=l.length-1}else if(0<l.length&&o){for(var d=0,p=l.length;d<p;d++)h=l[d],g.texImage2D(m.TEXTURE_2D,d,s,s,c,h);t.generateMipmaps=!1,e.__maxMipLevel=l.length-1}else g.texImage2D(m.TEXTURE_2D,0,s,s,c,n),e.__maxMipLevel=0;E(t,o)&&T(m.TEXTURE_2D,t,n.width,n.height);e.__version=t.version,t.onUpdate&&t.onUpdate(t)}(a,e,t);console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete",e)}g.activeTexture(m.TEXTURE0+t),g.bindTexture(m.TEXTURE_2D,a.__webglTexture)}function A(e,t,i){var n;if(i?(m.texParameteri(e,m.TEXTURE_WRAP_S,x.convert(t.wrapS)),m.texParameteri(e,m.TEXTURE_WRAP_T,x.convert(t.wrapT)),m.texParameteri(e,m.TEXTURE_MAG_FILTER,x.convert(t.magFilter)),m.texParameteri(e,m.TEXTURE_MIN_FILTER,x.convert(t.minFilter))):(m.texParameteri(e,m.TEXTURE_WRAP_S,m.CLAMP_TO_EDGE),m.texParameteri(e,m.TEXTURE_WRAP_T,m.CLAMP_TO_EDGE),t.wrapS===be&&t.wrapT===be||console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping.",t),m.texParameteri(e,m.TEXTURE_MAG_FILTER,a(t.magFilter)),m.texParameteri(e,m.TEXTURE_MIN_FILTER,a(t.minFilter)),t.minFilter!==Me&&t.minFilter!==Se&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.",t)),n=r.get("EXT_texture_filter_anisotropic")){if(t.type===Fe&&null===r.get("OES_texture_float_linear"))return;if(t.type===He&&null===r.get("OES_texture_half_float_linear"))return;(1<t.anisotropy||v.get(t).__currentAnisotropy)&&(m.texParameterf(e,n.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(t.anisotropy,y.getMaxAnisotropy())),v.get(t).__currentAnisotropy=t.anisotropy)}}function h(e,t,i,n){var r=x.convert(t.texture.format),a=x.convert(t.texture.type);g.texImage2D(n,0,r,t.width,t.height,0,r,a,null),m.bindFramebuffer(m.FRAMEBUFFER,e),m.framebufferTexture2D(m.FRAMEBUFFER,i,n,v.get(t.texture).__webglTexture,0),m.bindFramebuffer(m.FRAMEBUFFER,null)}function l(e,t){m.bindRenderbuffer(m.RENDERBUFFER,e),t.depthBuffer&&!t.stencilBuffer?(m.renderbufferStorage(m.RENDERBUFFER,m.DEPTH_COMPONENT16,t.width,t.height),m.framebufferRenderbuffer(m.FRAMEBUFFER,m.DEPTH_ATTACHMENT,m.RENDERBUFFER,e)):t.depthBuffer&&t.stencilBuffer?(m.renderbufferStorage(m.RENDERBUFFER,m.DEPTH_STENCIL,t.width,t.height),m.framebufferRenderbuffer(m.FRAMEBUFFER,m.DEPTH_STENCIL_ATTACHMENT,m.RENDERBUFFER,e)):m.renderbufferStorage(m.RENDERBUFFER,m.RGBA4,t.width,t.height),m.bindRenderbuffer(m.RENDERBUFFER,null)}function u(e){var t=v.get(e),i=!0===e.isWebGLRenderTargetCube;if(e.depthTexture){if(i)throw new Error("target.depthTexture not supported in Cube render targets");!function(e,t){if(t&&t.isWebGLRenderTargetCube)throw new Error("Depth Texture with cube render targets is not supported");if(m.bindFramebuffer(m.FRAMEBUFFER,e),!t.depthTexture||!t.depthTexture.isDepthTexture)throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");v.get(t.depthTexture).__webglTexture&&t.depthTexture.image.width===t.width&&t.depthTexture.image.height===t.height||(t.depthTexture.image.width=t.width,t.depthTexture.image.height=t.height,t.depthTexture.needsUpdate=!0),c(t.depthTexture,0);var i=v.get(t.depthTexture).__webglTexture;if(t.depthTexture.format===Je)m.framebufferTexture2D(m.FRAMEBUFFER,m.DEPTH_ATTACHMENT,m.TEXTURE_2D,i,0);else{if(t.depthTexture.format!==Qe)throw new Error("Unknown depthTexture format");m.framebufferTexture2D(m.FRAMEBUFFER,m.DEPTH_STENCIL_ATTACHMENT,m.TEXTURE_2D,i,0)}}(t.__webglFramebuffer,e)}else if(i){t.__webglDepthbuffer=[];for(var n=0;n<6;n++)m.bindFramebuffer(m.FRAMEBUFFER,t.__webglFramebuffer[n]),t.__webglDepthbuffer[n]=m.createRenderbuffer(),l(t.__webglDepthbuffer[n],e)}else m.bindFramebuffer(m.FRAMEBUFFER,t.__webglFramebuffer),t.__webglDepthbuffer=m.createRenderbuffer(),l(t.__webglDepthbuffer,e);m.bindFramebuffer(m.FRAMEBUFFER,null)}this.setTexture2D=c,this.setTextureCube=function(e,t){var i=v.get(e);if(6===e.image.length)if(0<e.version&&i.__version!==e.version){i.__image__webglTextureCube||(e.addEventListener("dispose",S),i.__image__webglTextureCube=m.createTexture(),w.memory.textures++),g.activeTexture(m.TEXTURE0+t),g.bindTexture(m.TEXTURE_CUBE_MAP,i.__image__webglTextureCube),m.pixelStorei(m.UNPACK_FLIP_Y_WEBGL,e.flipY);for(var n=e&&e.isCompressedTexture,r=e.image[0]&&e.image[0].isDataTexture,a=[],o=0;o<6;o++)a[o]=n||r?r?e.image[o].image:e.image[o]:_(e.image[o],y.maxCubemapSize);var s=a[0],c=M(s),h=x.convert(e.format),l=x.convert(e.type);for(A(m.TEXTURE_CUBE_MAP,e,c),o=0;o<6;o++)if(n)for(var u,d=a[o].mipmaps,p=0,f=d.length;p<f;p++)u=d[p],e.format!==Xe&&e.format!==We?-1<g.getCompressedTextureFormats().indexOf(h)?g.compressedTexImage2D(m.TEXTURE_CUBE_MAP_POSITIVE_X+o,p,h,u.width,u.height,0,u.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):g.texImage2D(m.TEXTURE_CUBE_MAP_POSITIVE_X+o,p,h,u.width,u.height,0,h,l,u.data);else r?g.texImage2D(m.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,h,a[o].width,a[o].height,0,h,l,a[o].data):g.texImage2D(m.TEXTURE_CUBE_MAP_POSITIVE_X+o,0,h,h,l,a[o]);i.__maxMipLevel=n?d.length-1:0,E(e,c)&&T(m.TEXTURE_CUBE_MAP,e,s.width,s.height),i.__version=e.version,e.onUpdate&&e.onUpdate(e)}else g.activeTexture(m.TEXTURE0+t),g.bindTexture(m.TEXTURE_CUBE_MAP,i.__image__webglTextureCube)},this.setTextureCubeDynamic=function(e,t){g.activeTexture(m.TEXTURE0+t),g.bindTexture(m.TEXTURE_CUBE_MAP,v.get(e).__webglTexture)},this.setupRenderTarget=function(e){var t=v.get(e),i=v.get(e.texture);e.addEventListener("dispose",o),i.__webglTexture=m.createTexture(),w.memory.textures++;var n=!0===e.isWebGLRenderTargetCube,r=M(e);if(n){t.__webglFramebuffer=[];for(var a=0;a<6;a++)t.__webglFramebuffer[a]=m.createFramebuffer()}else t.__webglFramebuffer=m.createFramebuffer();if(n){for(g.bindTexture(m.TEXTURE_CUBE_MAP,i.__webglTexture),A(m.TEXTURE_CUBE_MAP,e.texture,r),a=0;a<6;a++)h(t.__webglFramebuffer[a],e,m.COLOR_ATTACHMENT0,m.TEXTURE_CUBE_MAP_POSITIVE_X+a);E(e.texture,r)&&T(m.TEXTURE_CUBE_MAP,e.texture,e.width,e.height),g.bindTexture(m.TEXTURE_CUBE_MAP,null)}else g.bindTexture(m.TEXTURE_2D,i.__webglTexture),A(m.TEXTURE_2D,e.texture,r),h(t.__webglFramebuffer,e,m.COLOR_ATTACHMENT0,m.TEXTURE_2D),E(e.texture,r)&&T(m.TEXTURE_2D,e.texture,e.width,e.height),g.bindTexture(m.TEXTURE_2D,null);e.depthBuffer&&u(e)},this.updateRenderTargetMipmap=function(e){var t=e.texture;if(E(t,M(e))){var i=e.isWebGLRenderTargetCube?m.TEXTURE_CUBE_MAP:m.TEXTURE_2D,n=v.get(t).__webglTexture;g.bindTexture(i,n),T(i,t,e.width,e.height),g.bindTexture(i,null)}}}function no(i,n){return{convert:function(e){var t;if(e===we)return i.REPEAT;if(e===be)return i.CLAMP_TO_EDGE;if(e===_e)return i.MIRRORED_REPEAT;if(e===Me)return i.NEAREST;if(e===Ee)return i.NEAREST_MIPMAP_NEAREST;if(e===Te)return i.NEAREST_MIPMAP_LINEAR;if(e===Se)return i.LINEAR;if(e===Ce)return i.LINEAR_MIPMAP_NEAREST;if(e===Pe)return i.LINEAR_MIPMAP_LINEAR;if(e===Oe)return i.UNSIGNED_BYTE;if(e===ze)return i.UNSIGNED_SHORT_4_4_4_4;if(e===Ge)return i.UNSIGNED_SHORT_5_5_5_1;if(e===ke)return i.UNSIGNED_SHORT_5_6_5;if(e===Ie)return i.BYTE;if(e===Ne)return i.SHORT;if(e===Be)return i.UNSIGNED_SHORT;if(e===Ue)return i.INT;if(e===De)return i.UNSIGNED_INT;if(e===Fe)return i.FLOAT;if(e===He&&null!==(t=n.get("OES_texture_half_float")))return t.HALF_FLOAT_OES;if(e===je)return i.ALPHA;if(e===We)return i.RGB;if(e===Xe)return i.RGBA;if(e===qe)return i.LUMINANCE;if(e===Ye)return i.LUMINANCE_ALPHA;if(e===Je)return i.DEPTH_COMPONENT;if(e===Qe)return i.DEPTH_STENCIL;if(e===M)return i.FUNC_ADD;if(e===E)return i.FUNC_SUBTRACT;if(e===T)return i.FUNC_REVERSE_SUBTRACT;if(e===L)return i.ZERO;if(e===R)return i.ONE;if(e===C)return i.SRC_COLOR;if(e===P)return i.ONE_MINUS_SRC_COLOR;if(e===O)return i.SRC_ALPHA;if(e===I)return i.ONE_MINUS_SRC_ALPHA;if(e===N)return i.DST_ALPHA;if(e===U)return i.ONE_MINUS_DST_ALPHA;if(e===H)return i.DST_COLOR;if(e===z)return i.ONE_MINUS_DST_COLOR;if(e===G)return i.SRC_ALPHA_SATURATE;if((e===Ke||e===$e||e===et||e===tt)&&null!==(t=n.get("WEBGL_compressed_texture_s3tc"))){if(e===Ke)return t.COMPRESSED_RGB_S3TC_DXT1_EXT;if(e===$e)return t.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(e===et)return t.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(e===tt)return t.COMPRESSED_RGBA_S3TC_DXT5_EXT}if((e===it||e===nt||e===rt||e===at)&&null!==(t=n.get("WEBGL_compressed_texture_pvrtc"))){if(e===it)return t.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(e===nt)return t.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(e===rt)return t.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(e===at)return t.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}if(e===ot&&null!==(t=n.get("WEBGL_compressed_texture_etc1")))return t.COMPRESSED_RGB_ETC1_WEBGL;if((e===st||e===ct||e===ht||e===lt||e===ut||e===dt||e===pt||e===ft||e===mt||e===gt||e===vt||e===yt||e===xt||e===wt)&&null!==(t=n.get("WEBGL_compressed_texture_astc")))return e;if((e===S||e===A)&&null!==(t=n.get("EXT_blend_minmax"))){if(e===S)return t.MIN_EXT;if(e===A)return t.MAX_EXT}return e===Ve&&null!==(t=n.get("WEBGL_depth_texture"))?t.UNSIGNED_INT_24_8_WEBGL:0}}}function ro(e,t,i,n){Xi.call(this),this.type="PerspectiveCamera",this.fov=void 0!==e?e:50,this.zoom=1,this.near=void 0!==i?i:.1,this.far=void 0!==n?n:2e3,this.focus=10,this.aspect=void 0!==t?t:1,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}function ao(e){ro.call(this),this.cameras=e||[]}function oo(n){var s=this,c=null,h=null,l=null,u=new Ft,d=new Ft;"undefined"!=typeof window&&"VRFrameData"in window&&(h=new window.VRFrameData,window.addEventListener("vrdisplaypresentchange",e,!1));var p=new Ft,f=new Ht,m=new zt,g=new ro;g.bounds=new oi(0,0,.5,1),g.layers.enable(1);var v=new ro;v.bounds=new oi(.5,0,.5,1),v.layers.enable(2);var r,a,y=new ao([g,v]);function o(){return null!==c&&!0===c.isPresenting}function e(){if(o()){var e=c.getEyeParameters("left"),t=e.renderWidth,i=e.renderHeight;a=n.getPixelRatio(),r=n.getSize(),n.setDrawingBufferSize(2*t,i,1)}else s.enabled&&n.setDrawingBufferSize(r.width,r.height,a)}y.layers.enable(1),y.layers.enable(2),this.enabled=!1,this.userHeight=1.6,this.getDevice=function(){return c},this.setDevice=function(e){void 0!==e&&(c=e)},this.setPoseTarget=function(e){void 0!==e&&(l=e)},this.getCamera=function(e){if(null===c)return e;c.depthNear=e.near,c.depthFar=e.far,c.getFrameData(h);var t=c.stageParameters;t?u.fromArray(t.sittingToStandingTransform):u.makeTranslation(0,s.userHeight,0);var i=h.pose,n=null!==l?l:e;if(n.matrix.copy(u),n.matrix.decompose(n.position,n.quaternion,n.scale),null!==i.orientation&&(f.fromArray(i.orientation),n.quaternion.multiply(f)),null!==i.position&&(f.setFromRotationMatrix(u),m.fromArray(i.position),m.applyQuaternion(f),n.position.add(m)),n.updateMatrixWorld(),!1===c.isPresenting)return e;g.near=e.near,v.near=e.near,g.far=e.far,v.far=e.far,y.matrixWorld.copy(e.matrixWorld),y.matrixWorldInverse.copy(e.matrixWorldInverse),g.matrixWorldInverse.fromArray(h.leftViewMatrix),v.matrixWorldInverse.fromArray(h.rightViewMatrix),d.getInverse(u),g.matrixWorldInverse.multiply(d),v.matrixWorldInverse.multiply(d);var r=n.parent;null!==r&&(p.getInverse(r.matrixWorld),g.matrixWorldInverse.multiply(p),v.matrixWorldInverse.multiply(p)),g.matrixWorld.getInverse(g.matrixWorldInverse),v.matrixWorld.getInverse(v.matrixWorldInverse),g.projectionMatrix.fromArray(h.leftProjectionMatrix),v.projectionMatrix.fromArray(h.rightProjectionMatrix),y.projectionMatrix.copy(g.projectionMatrix);var a=c.getLayers();if(a.length){var o=a[0];null!==o.leftBounds&&4===o.leftBounds.length&&g.bounds.fromArray(o.leftBounds),null!==o.rightBounds&&4===o.rightBounds.length&&v.bounds.fromArray(o.rightBounds)}return y},this.getStandingMatrix=function(){return u},this.isPresenting=o,this.requestAnimationFrame=function(e){c.requestAnimationFrame(e)},this.submitFrame=function(){o()&&c.submitFrame()},this.dispose=function(){"undefined"!=typeof window&&window.removeEventListener("vrdisplaypresentchange",e)}}function so(l){var t=null,u=null,d=null,p=null;function i(){return null!==u&&null!==d}var e=new ro;e.layers.enable(1),e.viewport=new oi;var n=new ro;n.layers.enable(2),n.viewport=new oi;var f=new ao([e,n]);f.layers.enable(1),f.layers.enable(2),this.enabled=!1,this.getDevice=function(){return t},this.setDevice=function(e){void 0!==e&&(t=e),l.setCompatibleXRDevice(e)},this.setSession=function(e){null!==(u=e)&&(u.baseLayer=new XRWebGLLayer(u,l),u.requestFrameOfReference("stage").then(function(e){d=e,u.exclusive}))},this.getCamera=function(e){return i()?f:e},this.isPresenting=i,this.requestAnimationFrame=function(h){u.requestAnimationFrame(function(e,t){p=t.getDevicePose(d);for(var i=u.baseLayer,n=t.views,r=0;r<n.length;r++){var a=n[r],o=i.getViewport(a),s=p.getViewMatrix(a),c=f.cameras[r];c.projectionMatrix.fromArray(a.projectionMatrix),c.matrixWorldInverse.fromArray(s),c.matrixWorld.getInverse(c.matrixWorldInverse),c.viewport.set(o.x,o.y,o.width,o.height),0===r&&(f.matrixWorld.copy(c.matrixWorld),f.matrixWorldInverse.copy(c.matrixWorldInverse),f.projectionMatrix.copy(c.projectionMatrix))}l.bindFramebuffer(l.FRAMEBUFFER,u.baseLayer.framebuffer),h()})},this.getStandingMatrix=function(){return console.warn("THREE.WebXRManager: getStandingMatrix() is no longer needed."),new THREE.Matrix4},this.submitFrame=function(){}}function co(e){var n=void 0!==(e=e||{}).canvas?e.canvas:document.createElementNS("http://www.w3.org/1999/xhtml","canvas"),t=void 0!==e.context?e.context:null,i=void 0!==e.alpha&&e.alpha,r=void 0===e.depth||e.depth,a=void 0===e.stencil||e.stencil,o=void 0!==e.antialias&&e.antialias,s=void 0===e.premultipliedAlpha||e.premultipliedAlpha,c=void 0!==e.preserveDrawingBuffer&&e.preserveDrawingBuffer,h=void 0!==e.powerPreference?e.powerPreference:"default",m=null,D=null;this.domElement=n,this.context=null,this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.gammaFactor=2,this.gammaInput=!1,this.gammaOutput=!1,this.physicallyCorrectLights=!1,this.toneMapping=Re,this.toneMappingExposure=1,this.toneMappingWhitePoint=1,this.maxMorphTargets=8,this.maxMorphNormals=4;var F,S,H,z,l,G,u,A,L,g,v,d,p,f,R,C,P,y,x,k=this,w=!1,b=null,_=null,V=-1,O=null,I=null,N=null,j=null,W=null,M=new oi,E=new oi,T=null,X=0,B=n.width,q=n.height,Y=1,U=new oi(0,0,B,q),Z=new oi(0,0,B,q),J=!1,Q=new pi,K=new fr,$=!1,ee=!1,te=new Ft,ie=new zt;function ne(){return null===b?Y:1}try{var re={alpha:i,depth:r,stencil:a,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:h};if(n.addEventListener("webglcontextlost",ce,!1),n.addEventListener("webglcontextrestored",he,!1),null===(F=t||n.getContext("webgl",re)||n.getContext("experimental-webgl",re)))throw null!==n.getContext("webgl")?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.");void 0===F.getShaderPrecisionFormat&&(F.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(e){console.error("THREE.WebGLRenderer: "+e.message)}function ae(){(S=new mr(F)).get("WEBGL_depth_texture"),S.get("OES_texture_float"),S.get("OES_texture_float_linear"),S.get("OES_texture_half_float"),S.get("OES_texture_half_float_linear"),S.get("OES_standard_derivatives"),S.get("OES_element_index_uint"),S.get("ANGLE_instanced_arrays"),x=new no(F,S),H=new pr(F,S,e),(z=new to(F,S,x)).scissor(E.copy(Z).multiplyScalar(Y)),z.viewport(M.copy(U).multiplyScalar(Y)),l=new yr(F),G=new _a,u=new io(F,S,z,G,H,x,l),A=new Mi(F),L=new gr(F,A,l),g=new br(L,l),R=new wr(F),v=new ba(k,S,H),d=new Sa,p=new Za,f=new ur(k,z,g,s),C=new dr(F,S,l),P=new vr(F,S,l),y=new eo(k,F,z,u,H),l.programs=v.programs,k.context=F,k.capabilities=H,k.extensions=S,k.properties=G,k.renderLists=d,k.state=z,k.info=l}ae();var oe="xr"in navigator?new so(F):new oo(k);this.vr=oe;var se=new Ka(k,g,H.maxTextureSize);function ce(e){e.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),w=!0}function he(){console.log("THREE.WebGLRenderer: Context Restored."),w=!1,ae()}function le(e){var t,i=e.target;i.removeEventListener("dispose",le),ue(t=i),G.remove(t)}function ue(e){var t=G.get(e).program;(e.program=void 0)!==t&&v.releaseProgram(t)}this.shadowMap=se,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){var e=S.get("WEBGL_lose_context");e&&e.loseContext()},this.forceContextRestore=function(){var e=S.get("WEBGL_lose_context");e&&e.restoreContext()},this.getPixelRatio=function(){return Y},this.setPixelRatio=function(e){void 0!==e&&(Y=e,this.setSize(B,q,!1))},this.getSize=function(){return{width:B,height:q}},this.setSize=function(e,t,i){oe.isPresenting()?console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting."):(B=e,q=t,n.width=e*Y,n.height=t*Y,!1!==i&&(n.style.width=e+"px",n.style.height=t+"px"),this.setViewport(0,0,e,t))},this.getDrawingBufferSize=function(){return{width:B*Y,height:q*Y}},this.setDrawingBufferSize=function(e,t,i){B=e,q=t,Y=i,n.width=e*i,n.height=t*i,this.setViewport(0,0,e,t)},this.getCurrentViewport=function(){return M},this.setViewport=function(e,t,i,n){U.set(e,q-t-n,i,n),z.viewport(M.copy(U).multiplyScalar(Y))},this.setScissor=function(e,t,i,n){Z.set(e,q-t-n,i,n),z.scissor(E.copy(Z).multiplyScalar(Y))},this.setScissorTest=function(e){z.setScissorTest(J=e)},this.getClearColor=function(){return f.getClearColor()},this.setClearColor=function(){f.setClearColor.apply(f,arguments)},this.getClearAlpha=function(){return f.getClearAlpha()},this.setClearAlpha=function(){f.setClearAlpha.apply(f,arguments)},this.clear=function(e,t,i){var n=0;(void 0===e||e)&&(n|=F.COLOR_BUFFER_BIT),(void 0===t||t)&&(n|=F.DEPTH_BUFFER_BIT),(void 0===i||i)&&(n|=F.STENCIL_BUFFER_BIT),F.clear(n)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.clearTarget=function(e,t,i,n){this.setRenderTarget(e),this.clear(t,i,n)},this.dispose=function(){n.removeEventListener("webglcontextlost",ce,!1),n.removeEventListener("webglcontextrestored",he,!1),d.dispose(),p.dispose(),G.dispose(),g.dispose(),oe.dispose(),ve()},this.renderBufferImmediate=function(e,t,i){z.initAttributes();var n=G.get(e);e.hasPositions&&!n.position&&(n.position=F.createBuffer(),window.webglCallbackHandler.onCreateBuffer()),e.hasNormals&&!n.normal&&(n.normal=F.createBuffer(),window.webglCallbackHandler.onCreateBuffer()),e.hasUvs&&!n.uv&&(n.uv=F.createBuffer(),window.webglCallbackHandler.onCreateBuffer()),e.hasColors&&!n.color&&(n.color=F.createBuffer(),window.webglCallbackHandler.onCreateBuffer());var r=t.getAttributes();if(e.hasPositions&&(window.webglCallbackHandler.onBeforeBindBuffer(!1,n.position,0),F.bufferData(F.ARRAY_BUFFER,e.positionArray,F.DYNAMIC_DRAW),z.enableAttribute(r.position),window.webglCallbackHandler.onBeforeVertexAttribPointer(r.position,3,F.FLOAT,!1,0,0,n.position,0)),e.hasNormals){if(window.webglCallbackHandler.onBeforeBindBuffer(!1,n.normal,1),!i.isMeshPhongMaterial&&!i.isMeshStandardMaterial&&!i.isMeshNormalMaterial&&!0===i.flatShading)for(var a=0,o=3*e.count;a<o;a+=9){var s=e.normalArray,c=(s[a+0]+s[a+3]+s[a+6])/3,h=(s[a+1]+s[a+4]+s[a+7])/3,l=(s[a+2]+s[a+5]+s[a+8])/3;s[a+0]=c,s[a+1]=h,s[a+2]=l,s[a+3]=c,s[a+4]=h,s[a+5]=l,s[a+6]=c,s[a+7]=h,s[a+8]=l}F.bufferData(F.ARRAY_BUFFER,e.normalArray,F.DYNAMIC_DRAW),z.enableAttribute(r.normal),window.webglCallbackHandler.onBeforeVertexAttribPointer(r.normal,3,F.FLOAT,!1,0,0,n.normal,1)}e.hasUvs&&i.map&&(window.webglCallbackHandler.onBeforeBindBuffer(!1,n.uv,2),F.bufferData(F.ARRAY_BUFFER,e.uvArray,F.DYNAMIC_DRAW),z.enableAttribute(r.uv),window.webglCallbackHandler.onBeforeVertexAttribPointer(r.uv,2,F.FLOAT,!1,0,0,n.uv,2)),e.hasColors&&i.vertexColors!==Le&&(window.webglCallbackHandler.onBeforeBindBuffer(!1,n.color,3),F.bufferData(F.ARRAY_BUFFER,e.colorArray,F.DYNAMIC_DRAW),z.enableAttribute(r.color),window.webglCallbackHandler.onBeforeVertexAttribPointer(r.color,3,F.FLOAT,!1,0,0,n.color,3)),z.disableUnusedAttributes(),window.webglCallbackHandler.onBeforeDrawArrays(F.TRIANGLES,0,e.count),e.count=0},this.renderBufferDirect=function(e,t,i,n,r,a){var o=r.isMesh&&r.matrixWorld.determinant()<0;z.setMaterial(n,o);var s=Me(e,t,n,r),c=i.id,h=s.id,l=!0===n.wireframe,u=!1;c==O&&h==I&&l==N||(O=c,I=h,N=l,u=!0),r.morphTargetInfluences&&(R.update(r,i,n,s),u=!0);var d,p=i.index,f=i.attributes.position,m=1;!0===n.wireframe&&(p=L.getWireframeAttribute(i),m=2);var g=C;null!==p&&(d=A.get(p),(g=P).setIndex(d)),u&&(!function(e,t,i){if(i&&i.isInstancedBufferGeometry&&null===S.get("ANGLE_instanced_arrays"))return console.error("THREE.WebGLRenderer.setupVertexAttributes: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");z.initAttributes();var n=i.attributes,r=t.getAttributes(),a=e.defaultAttributeValues;for(var o in r){var s=r[o];if(0<=s){var c=n[o];if(void 0!==c){var h=c.normalized,l=c.itemSize,u=A.get(c);if(void 0===u)continue;var d=u.buffer,p=u.type,f=u.bytesPerElement;if(c.isInterleavedBufferAttribute){var m=c.data,g=m.stride,v=c.offset;m&&m.isInstancedInterleavedBuffer?(z.enableAttributeAndDivisor(s,m.meshPerAttribute),void 0===i.maxInstancedCount&&(i.maxInstancedCount=m.meshPerAttribute*m.count)):z.enableAttribute(s),window.webglCallbackHandler.onBeforeBindBuffer(!1,d,5),window.webglCallbackHandler.onBeforeVertexAttribPointer(s,l,p,h,g*f,v*f,d,4)}else c.isInstancedBufferAttribute?(z.enableAttributeAndDivisor(s,c.meshPerAttribute),void 0===i.maxInstancedCount&&(i.maxInstancedCount=c.meshPerAttribute*c.count)):z.enableAttribute(s),window.webglCallbackHandler.onBeforeBindBuffer(!1,d,6),window.webglCallbackHandler.onBeforeVertexAttribPointer(s,l,p,h,0,0,d,5)}else if(void 0!==a){var y=a[o];if(void 0!==y)switch(y.length){case 2:F.vertexAttrib2fv(s,y);break;case 3:F.vertexAttrib3fv(s,y);break;case 4:F.vertexAttrib4fv(s,y);break;default:F.vertexAttrib1fv(s,y)}}}}z.disableUnusedAttributes()}(n,s,i),null!==p&&window.webglCallbackHandler.onBeforeBindBuffer(!0,d.buffer,4));var v=1/0;null!==p?v=p.count:void 0!==f&&(v=f.count);var y=i.drawRange.start*m,x=i.drawRange.count*m,w=null!==a?a.start*m:0,b=null!==a?a.count*m:1/0,_=Math.max(y,w),M=Math.min(v,y+x,w+b)-1,E=Math.max(0,M-_+1);if(0!==E){if(r.isMesh)if(!0===n.wireframe)z.setLineWidth(n.wireframeLinewidth*ne()),g.setMode(F.LINES);else switch(r.drawMode){case St:g.setMode(F.TRIANGLES);break;case 1:g.setMode(F.TRIANGLE_STRIP);break;case 2:g.setMode(F.TRIANGLE_FAN)}else if(r.isLine){var T=n.linewidth;void 0===T&&(T=1),z.setLineWidth(T*ne()),r.isLineSegments?g.setMode(F.LINES):r.isLineLoop?g.setMode(F.LINE_LOOP):g.setMode(F.LINE_STRIP)}else r.isPoints&&g.setMode(F.POINTS);i&&i.isInstancedBufferGeometry?0<i.maxInstancedCount&&g.renderInstances(i,_,E):g.render(_,E)}};var de,pe,fe,me=!(this.compile=function(i,e){(D=p.get(i,e)).init(),i.traverse(function(e){e.isLight&&(D.pushLight(e),e.castShadow&&D.pushShadow(e))}),D.setupLights(e),i.traverse(function(e){if(e.material)if(Array.isArray(e.material))for(var t=0;t<e.material.length;t++)_e(e.material[t],i.fog,e);else _e(e.material,i.fog,e)})}),ge=null;function ve(){me=!1}function ye(){oe.isPresenting()?oe.requestAnimationFrame(xe):window.requestAnimationFrame(xe)}function xe(e){!1!==me&&(ge(e),ye())}function we(e,t,i,n){for(var r=0,a=e.length;r<a;r++){var o=e[r],s=o.object,c=o.geometry,h=void 0===n?o.material:n,l=o.group;if(i.isArrayCamera)for(var u=(W=i).cameras,d=0,p=u.length;d<p;d++){var f=u[d];if(s.layers.test(f.layers)){if("viewport"in f)z.viewport(M.copy(f.viewport));else{var m=f.bounds,g=m.x*B,v=m.y*q,y=m.z*B,x=m.w*q;z.viewport(M.set(g,v,y,x).multiplyScalar(Y))}be(s,t,f,c,h,l)}}else W=null,be(s,t,i,c,h,l)}}function be(e,t,i,n,r,a){if(e.onBeforeRender(k,t,i,n,r,a),D=p.get(t,W||i),e.modelViewMatrix.multiplyMatrices(i.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),e.isImmediateRenderObject){var o=e.isMesh&&e.matrixWorld.determinant()<0;z.setMaterial(r,o);var s=Me(i,t.fog,r,e);N=I=O=null,c=s,h=r,e.render(function(e){k.renderBufferImmediate(e,c,h)})}else k.renderBufferDirect(i,t.fog,n,r,e,a);var c,h;e.onAfterRender(k,t,i,n,r,a),D=p.get(t,W||i)}function _e(e,t,i){var n=G.get(e);void 0===n.lightsHash&&(n.lightsHash={});var r=D.state.lights,a=D.state.shadowsArray,o=v.getParameters(e,r.state,a,t,K.numPlanes,K.numIntersection,i),s=v.getProgramCode(e,o),c=n.program,h=!0;if(void 0===c)e.addEventListener("dispose",le);else if(c.code!==s)ue(e);else if(n.lightsHash.stateID!==r.state.hash.stateID||n.lightsHash.directionalLength!==r.state.hash.directionalLength||n.lightsHash.pointLength!==r.state.hash.pointLength||n.lightsHash.spotLength!==r.state.hash.spotLength||n.lightsHash.rectAreaLength!==r.state.hash.rectAreaLength||n.lightsHash.hemiLength!==r.state.hash.hemiLength||n.lightsHash.shadowsLength!==r.state.hash.shadowsLength)G.update(e,"lightsHash",r.state.hash),h=!1;else{if(void 0!==o.shaderID)return;h=!1}if(h){if(o.shaderID){var l=_i[o.shaderID];n.shader={name:e.type,uniforms:gi.clone(l.uniforms),vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}}else n.shader={name:e.type,uniforms:e.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader};e.onBeforeCompile(n.shader,k),c=v.acquireProgram(e,n.shader,o,s),n.program=c,e.program=c}var u=c.getAttributes();if(e.morphTargets)for(var d=e.numSupportedMorphTargets=0;d<k.maxMorphTargets;d++)0<=u["morphTarget"+d]&&e.numSupportedMorphTargets++;if(e.morphNormals)for(d=e.numSupportedMorphNormals=0;d<k.maxMorphNormals;d++)0<=u["morphNormal"+d]&&e.numSupportedMorphNormals++;var p=n.shader.uniforms;(e.isShaderMaterial||e.isRawShaderMaterial)&&!0!==e.clipping||(n.numClippingPlanes=K.numPlanes,n.numIntersection=K.numIntersection,p.clippingPlanes=K.uniform),n.fog=t,n.lightsHash.stateID=r.state.hash.stateID,n.lightsHash.directionalLength=r.state.hash.directionalLength,n.lightsHash.pointLength=r.state.hash.pointLength,n.lightsHash.spotLength=r.state.hash.spotLength,n.lightsHash.rectAreaLength=r.state.hash.rectAreaLength,n.lightsHash.hemiLength=r.state.hash.hemiLength,n.lightsHash.shadowsLength=r.state.hash.shadowsLength,e.lights&&(p.ambientLightColor.value=r.state.ambient,p.directionalLights.value=r.state.directional,p.spotLights.value=r.state.spot,p.rectAreaLights.value=r.state.rectArea,p.pointLights.value=r.state.point,p.hemisphereLights.value=r.state.hemi,p.directionalShadowMap.value=r.state.directionalShadowMap,p.directionalShadowMatrix.value=r.state.directionalShadowMatrix,p.spotShadowMap.value=r.state.spotShadowMap,p.spotShadowMatrix.value=r.state.spotShadowMatrix,p.pointShadowMap.value=r.state.pointShadowMap,p.pointShadowMatrix.value=r.state.pointShadowMatrix);var f=n.program.getUniforms(),m=la.seqWithValue(f.seq,p);n.uniformsList=m}function Me(e,t,i,n){X=0;var r=G.get(i),a=D.state.lights;if($&&(ee||e!==j)){var o=e===j&&i.id===V;K.setState(i.clippingPlanes,i.clipIntersection,i.clipShadows,e,r,o)}!1===i.needsUpdate&&(void 0===r.program?i.needsUpdate=!0:i.fog&&r.fog!==t?i.needsUpdate=!0:i.lights&&r.lightsHash.stateID!==a.state.hash.stateID||r.lightsHash.directionalLength!==a.state.hash.directionalLength||r.lightsHash.pointLength!==a.state.hash.pointLength||r.lightsHash.spotLength!==a.state.hash.spotLength||r.lightsHash.rectAreaLength!==a.state.hash.rectAreaLength||r.lightsHash.shadowsLength!==a.state.hash.shadowsLength?i.needsUpdate=!0:void 0===r.numClippingPlanes||r.numClippingPlanes===K.numPlanes&&r.numIntersection===K.numIntersection||(i.needsUpdate=!0)),i.needsUpdate&&(_e(i,t,n),i.needsUpdate=!1);var s,c,h,l,u,d,p,f,m,g,v,y,x,w,b,_,M,E,T=!1,S=!1,A=!1,L=r.program,R=L.getUniforms(),C=r.shader.uniforms;if(z.useProgram(L.program)&&(A=S=T=!0),i.id!==V&&(V=i.id,S=!0),T||e!==j){if(R.setValue(F,"projectionMatrix",e.projectionMatrix),H.logarithmicDepthBuffer&&R.setValue(F,"logDepthBufFC",2/(Math.log(e.far+1)/Math.LN2)),j!==(W||e)&&(j=W||e,A=S=!0),i.isShaderMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.envMap){var P=R.map.cameraPosition;void 0!==P&&P.setValue(F,ie.setFromMatrixPosition(e.matrixWorld))}(i.isMeshPhongMaterial||i.isMeshLambertMaterial||i.isMeshBasicMaterial||i.isMeshStandardMaterial||i.isShaderMaterial||i.skinning)&&R.setValue(F,"viewMatrix",e.matrixWorldInverse)}if(i.skinning){R.setOptional(F,n,"bindMatrix"),R.setOptional(F,n,"bindMatrixInverse");var O=n.skeleton;if(O){var I=O.bones;if(H.floatVertexTextures){if(void 0===O.boneTexture){var N=Math.sqrt(4*I.length);N=Ut.ceilPowerOfTwo(N),N=Math.max(N,4);var B=new Float32Array(N*N*4);B.set(O.boneMatrices);var U=new hi(B,N,N,Xe,Fe);U.needsUpdate=!0,O.boneMatrices=B,O.boneTexture=U,O.boneTextureSize=N}R.setValue(F,"boneTexture",O.boneTexture),R.setValue(F,"boneTextureSize",O.boneTextureSize)}else R.setOptional(F,O,"boneMatrices")}}return S&&(R.setValue(F,"toneMappingExposure",k.toneMappingExposure),R.setValue(F,"toneMappingWhitePoint",k.toneMappingWhitePoint),i.lights&&(E=A,(M=C).ambientLightColor.needsUpdate=E,M.directionalLights.needsUpdate=E,M.pointLights.needsUpdate=E,M.spotLights.needsUpdate=E,M.rectAreaLights.needsUpdate=E,M.hemisphereLights.needsUpdate=E),t&&i.fog&&(_=t,(b=C).fogColor.value=_.color,_.isFog?(b.fogNear.value=_.near,b.fogFar.value=_.far):_.isFogExp2&&(b.fogDensity.value=_.density)),i.isMeshBasicMaterial?Ee(C,i):i.isMeshLambertMaterial?(Ee(C,i),x=C,(w=i).emissiveMap&&(x.emissiveMap.value=w.emissiveMap)):i.isMeshPhongMaterial?(Ee(C,i),i.isMeshToonMaterial?(Te(v=C,y=i),y.gradientMap&&(v.gradientMap.value=y.gradientMap)):Te(C,i)):i.isMeshStandardMaterial?(Ee(C,i),i.isMeshPhysicalMaterial?(g=i,(m=C).clearCoat.value=g.clearCoat,m.clearCoatRoughness.value=g.clearCoatRoughness,Se(m,g)):Se(C,i)):i.isMeshDepthMaterial?(Ee(C,i),p=C,(f=i).displacementMap&&(p.displacementMap.value=f.displacementMap,p.displacementScale.value=f.displacementScale,p.displacementBias.value=f.displacementBias)):i.isMeshDistanceMaterial?(Ee(C,i),function(e,t){t.displacementMap&&(e.displacementMap.value=t.displacementMap,e.displacementScale.value=t.displacementScale,e.displacementBias.value=t.displacementBias);e.referencePosition.value.copy(t.referencePosition),e.nearDistance.value=t.nearDistance,e.farDistance.value=t.farDistance}(C,i)):i.isMeshNormalMaterial?(Ee(C,i),function(e,t){t.bumpMap&&(e.bumpMap.value=t.bumpMap,e.bumpScale.value=t.bumpScale,t.side===Ae&&(e.bumpScale.value*=-1));t.normalMap&&(e.normalMap.value=t.normalMap,e.normalScale.value.copy(t.normalScale),t.side===Ae&&e.normalScale.value.negate());t.displacementMap&&(e.displacementMap.value=t.displacementMap,e.displacementScale.value=t.displacementScale,e.displacementBias.value=t.displacementBias)}(C,i)):i.isLineBasicMaterial?(d=i,(u=C).diffuse.value=d.color,u.opacity.value=d.opacity,i.isLineDashedMaterial&&(l=i,(h=C).dashSize.value=l.dashSize,h.totalSize.value=l.dashSize+l.gapSize,h.scale.value=l.scale)):i.isPointsMaterial?(c=i,(s=C).diffuse.value=c.color,s.opacity.value=c.opacity,s.size.value=c.size*Y,s.scale.value=.5*q,s.map.value=c.map,null!==c.map&&(!0===c.map.matrixAutoUpdate&&c.map.updateMatrix(),s.uvTransform.value.copy(c.map.matrix))):i.isShadowMaterial&&(C.color.value=i.color,C.opacity.value=i.opacity),void 0!==C.ltc_1&&(C.ltc_1.value=bi.LTC_1),void 0!==C.ltc_2&&(C.ltc_2.value=bi.LTC_2),la.upload(F,r.uniformsList,C,k)),i.isShaderMaterial&&!0===i.uniformsNeedUpdate&&(la.upload(F,r.uniformsList,C,k),i.uniformsNeedUpdate=!1),R.setValue(F,"modelViewMatrix",n.modelViewMatrix),R.setValue(F,"normalMatrix",n.normalMatrix),R.setValue(F,"modelMatrix",n.matrixWorld),L}function Ee(e,t){var i;e.opacity.value=t.opacity,t.color&&(e.diffuse.value=t.color),t.emissive&&e.emissive.value.copy(t.emissive).multiplyScalar(t.emissiveIntensity),t.map&&(e.map.value=t.map),t.alphaMap&&(e.alphaMap.value=t.alphaMap),t.specularMap&&(e.specularMap.value=t.specularMap),t.envMap&&(e.envMap.value=t.envMap,e.flipEnvMap.value=t.envMap&&t.envMap.isCubeTexture?-1:1,e.reflectivity.value=t.reflectivity,e.refractionRatio.value=t.refractionRatio,e.maxMipLevel.value=G.get(t.envMap).__maxMipLevel),t.lightMap&&(e.lightMap.value=t.lightMap,e.lightMapIntensity.value=t.lightMapIntensity),t.aoMap&&(e.aoMap.value=t.aoMap,e.aoMapIntensity.value=t.aoMapIntensity),t.map?i=t.map:t.specularMap?i=t.specularMap:t.displacementMap?i=t.displacementMap:t.normalMap?i=t.normalMap:t.bumpMap?i=t.bumpMap:t.roughnessMap?i=t.roughnessMap:t.metalnessMap?i=t.metalnessMap:t.alphaMap?i=t.alphaMap:t.emissiveMap?i=t.emissiveMap:t.displacementMap&&(i=t.displacementMap),void 0!==i&&(i.isWebGLRenderTarget&&(i=i.texture),!0===i.matrixAutoUpdate&&i.updateMatrix(),e.uvTransform.value.copy(i.matrix))}function Te(e,t){e.specular.value=t.specular,e.shininess.value=Math.max(t.shininess,1e-4),t.emissiveMap&&(e.emissiveMap.value=t.emissiveMap),t.bumpMap&&(e.bumpMap.value=t.bumpMap,e.bumpScale.value=t.bumpScale,t.side===Ae&&(e.bumpScale.value*=-1)),t.normalMap&&(e.normalMap.value=t.normalMap,e.normalScale.value.copy(t.normalScale),t.side===Ae&&e.normalScale.value.negate()),t.displacementMap&&(e.displacementMap.value=t.displacementMap,e.displacementScale.value=t.displacementScale,e.displacementBias.value=t.displacementBias)}function Se(e,t){e.roughness.value=t.roughness,e.metalness.value=t.metalness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap),t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap),t.emissiveMap&&(e.emissiveMap.value=t.emissiveMap),t.bumpMap&&(e.bumpMap.value=t.bumpMap,e.bumpScale.value=t.bumpScale,t.side===Ae&&(e.bumpScale.value*=-1)),t.normalMap&&(e.normalMap.value=t.normalMap,e.normalScale.value.copy(t.normalScale),t.side===Ae&&e.normalScale.value.negate()),t.displacementMap&&(e.displacementMap.value=t.displacementMap,e.displacementScale.value=t.displacementScale,e.displacementBias.value=t.displacementBias),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}this.animate=function(e){null!==(ge=e)?me||(ye(),me=!0):ve()},this.render=function(e,t,i,n){if(t&&t.isCamera){if(!w){V=-1,!(j=N=O=I=null)===e.autoUpdate&&e.updateMatrixWorld(),null===t.parent&&t.updateMatrixWorld(),oe.enabled&&(t=oe.getCamera(t)),(D=p.get(e,t)).init(),e.onBeforeRender(k,e,t,i),te.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),Q.setFromMatrix(te),ee=this.localClippingEnabled,$=K.init(this.clippingPlanes,ee,t),(m=d.get(e,t)).init(),function e(t,i,n){if(!1===t.visible)return;var r=t.layers.test(i.layers);if(r)if(t.isLight)D.pushLight(t),t.castShadow&&D.pushShadow(t);else if(t.isSprite)t.frustumCulled&&!Q.intersectsSprite(t)||D.pushSprite(t);else if(t.isImmediateRenderObject)n&&ie.setFromMatrixPosition(t.matrixWorld).applyMatrix4(te),m.push(t,null,t.material,ie.z,null);else if((t.isMesh||t.isLine||t.isPoints)&&(t.isSkinnedMesh&&t.skeleton.update(),!t.frustumCulled||Q.intersectsObject(t))){n&&ie.setFromMatrixPosition(t.matrixWorld).applyMatrix4(te);var a=g.update(t),o=t.material;if(Array.isArray(o))for(var s=a.groups,c=0,h=s.length;c<h;c++){var l=s[c],u=o[l.materialIndex];u&&u.visible&&m.push(t,a,u,ie.z,l)}else o.visible&&m.push(t,a,o,ie.z,null)}var d=t.children;for(var c=0,h=d.length;c<h;c++){var p=d[c];if(window.areaConfigurationsHandler.updateNeeded&&(p.addedObject&&p.addedObject.applyAreaConfiguration(window.areaConfigurationsHandler.currentArea),p.objectGroupName)){var f=window.objectGroups[p.objectGroupName];f.applyAreaConfiguration(window.areaConfigurationsHandler.currentArea)}p.visible&&e(p,i,n)}}(e,t,k.sortObjects),!0===k.sortObjects&&m.sort(),$&&K.beginShadows();var r=D.state.shadowsArray;se.render(r,e,t),D.setupLights(t),$&&K.endShadows(),this.info.autoReset&&this.info.reset(),void 0===i&&(i=null),this.setRenderTarget(i),f.render(m,e,t,n);var a=m.opaque,o=m.transparent;if(e.overrideMaterial){var s=e.overrideMaterial;a.length&&we(a,e,t,s),o.length&&we(o,e,t,s)}else a.length&&we(a,e,t),o.length&&we(o,e,t);var c=D.state.spritesArray;y.render(c,e,t),i&&u.updateRenderTargetMipmap(i),z.buffers.depth.setTest(!0),z.buffers.depth.setMask(!0),z.buffers.color.setMask(!0),z.setPolygonOffset(!1),e.onAfterRender(k,e,t),oe.enabled&&oe.submitFrame(),D=m=null}}else console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.")},this.allocTextureUnit=function(){var e=X;return e>=H.maxTextures&&console.warn("THREE.WebGLRenderer: Trying to use "+e+" texture units while this GPU supports only "+H.maxTextures),X+=1,e},this.setTexture2D=(de=!1,function(e,t){e&&e.isWebGLRenderTarget&&(de||(console.warn("THREE.WebGLRenderer.setTexture2D: don't use render targets as textures. Use their .texture property instead."),de=!0),e=e.texture),u.setTexture2D(e,t)}),this.setTexture=(pe=!1,function(e,t){pe||(console.warn("THREE.WebGLRenderer: .setTexture is deprecated, use setTexture2D instead."),pe=!0),u.setTexture2D(e,t)}),this.setTextureCube=(fe=!1,function(e,t){e&&e.isWebGLRenderTargetCube&&(fe||(console.warn("THREE.WebGLRenderer.setTextureCube: don't use cube render targets as textures. Use their .texture property instead."),fe=!0),e=e.texture),e&&e.isCubeTexture||Array.isArray(e.image)&&6===e.image.length?u.setTextureCube(e,t):u.setTextureCubeDynamic(e,t)}),this.getRenderTarget=function(){return b},this.setRenderTarget=function(e){(b=e)&&void 0===G.get(e).__webglFramebuffer&&u.setupRenderTarget(e);var t=null,i=!1;if(e){var n=G.get(e).__webglFramebuffer;e.isWebGLRenderTargetCube?(t=n[e.activeCubeFace],i=!0):t=n,M.copy(e.viewport),E.copy(e.scissor),T=e.scissorTest}else M.copy(U).multiplyScalar(Y),E.copy(Z).multiplyScalar(Y),T=J;if(_!==t&&(F.bindFramebuffer(F.FRAMEBUFFER,t),_=t),z.viewport(M),z.scissor(E),z.setScissorTest(T),i){var r=G.get(e.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+e.activeCubeFace,r.__webglTexture,e.activeMipMapLevel)}},this.readRenderTargetPixels=function(e,t,i,n,r,a){if(e&&e.isWebGLRenderTarget){var o=G.get(e).__webglFramebuffer;if(o){var s=!1;o!==_&&(F.bindFramebuffer(F.FRAMEBUFFER,o),s=!0);try{var c=e.texture,h=c.format,l=c.type;if(h!==Xe&&x.convert(h)!==F.getParameter(F.IMPLEMENTATION_COLOR_READ_FORMAT))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");if(!(l===Oe||x.convert(l)===F.getParameter(F.IMPLEMENTATION_COLOR_READ_TYPE)||l===Fe&&(S.get("OES_texture_float")||S.get("WEBGL_color_buffer_float"))||l===He&&S.get("EXT_color_buffer_half_float")))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");F.checkFramebufferStatus(F.FRAMEBUFFER)===F.FRAMEBUFFER_COMPLETE?0<=t&&t<=e.width-n&&0<=i&&i<=e.height-r&&F.readPixels(t,i,n,r,x.convert(h),x.convert(l),a):console.error("THREE.WebGLRenderer.readRenderTargetPixels: readPixels from renderTarget failed. Framebuffer not complete.")}finally{s&&F.bindFramebuffer(F.FRAMEBUFFER,_)}}}else console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.")},this.copyFramebufferToTexture=function(e,t,i){var n=t.image.width,r=t.image.height,a=x.convert(t.format);this.setTexture2D(t,0),F.copyTexImage2D(F.TEXTURE_2D,i||0,a,e.x,e.y,n,r,0)},this.copyTextureToTexture=function(e,t,i,n){var r=t.image.width,a=t.image.height,o=x.convert(i.format),s=x.convert(i.type);this.setTexture2D(i,0),t.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,n||0,e.x,e.y,r,a,o,s,t.image.data):F.texSubImage2D(F.TEXTURE_2D,n||0,e.x,e.y,o,s,t.image)}}function ho(e,t){this.name="",this.color=new yi(e),this.density=void 0!==t?t:25e-5}function lo(e,t,i){this.name="",this.color=new yi(e),this.near=void 0!==t?t:1,this.far=void 0!==i?i:1e3}function uo(){Wi.call(this),this.type="Scene",this.background=null,this.fog=null,this.overrideMaterial=null,this.autoUpdate=!0}function po(e){rr.call(this),this.type="SpriteMaterial",this.color=new yi(16777215),this.map=null,this.rotation=0,this.fog=!1,this.lights=!1,this.setValues(e)}function fo(e){Wi.call(this),this.type="Sprite",this.material=void 0!==e?e:new po,this.center=new Dt(.5,.5)}function mo(){Wi.call(this),this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]}})}function go(e,t){if(e=e||[],this.bones=e.slice(0),this.boneMatrices=new Float32Array(16*this.bones.length),void 0===t)this.calculateInverses();else if(this.bones.length===t.length)this.boneInverses=t.slice(0);else{console.warn("THREE.Skeleton boneInverses is the wrong length."),this.boneInverses=[];for(var i=0,n=this.bones.length;i<n;i++)this.boneInverses.push(new Ft)}}function vo(){Wi.call(this),this.type="Bone"}function yo(e,t){lr.call(this,e,t),this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new Ft,this.bindMatrixInverse=new Ft;var i=new go(this.initBones());this.bind(i,this.matrixWorld),this.normalizeSkinWeights()}function xo(e){rr.call(this),this.type="LineBasicMaterial",this.color=new yi(16777215),this.linewidth=1,this.linecap="round",this.linejoin="round",this.lights=!1,this.setValues(e)}function wo(e,t,i){if(1===i)return console.warn("THREE.Line: parameter THREE.LinePieces no longer supported. Created THREE.LineSegments instead."),new bo(e,t);Wi.call(this),this.type="Line",this.geometry=void 0!==e?e:new Ln,this.material=void 0!==t?t:new xo({color:16777215*Math.random()})}function bo(e,t){wo.call(this,e,t),this.type="LineSegments"}function _o(e,t){wo.call(this,e,t),this.type="LineLoop"}function Mo(e){rr.call(this),this.type="PointsMaterial",this.color=new yi(16777215),this.map=null,this.size=1,this.sizeAttenuation=!0,this.lights=!1,this.setValues(e)}function Eo(e,t){Wi.call(this),this.type="Points",this.geometry=void 0!==e?e:new Ln,this.material=void 0!==t?t:new Mo({color:16777215*Math.random()})}function To(){Wi.call(this),this.type="Group"}function So(e,t,i,n,r,a,o,s,c){ai.call(this,e,t,i,n,r,a,o,s,c),this.generateMipmaps=!1}function Ao(e,t,i,n,r,a,o,s,c,h,l,u){ai.call(this,null,a,o,s,c,h,n,r,l,u),this.image={width:t,height:i},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}function Lo(e,t,i,n,r,a,o,s,c,h){if((h=void 0!==h?h:Je)!==Je&&h!==Qe)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");void 0===i&&h===Je&&(i=Be),void 0===i&&h===Qe&&(i=Ve),ai.call(this,null,n,r,a,o,s,h,i,c),this.image={width:e,height:t},this.magFilter=void 0!==o?o:Me,this.minFilter=void 0!==s?s:Me,this.flipY=!1,this.generateMipmaps=!1}function Ro(e){Ln.call(this),this.type="WireframeGeometry";var t,i,n,r,a,o,s,c,h,l,u=[],d=[0,0],p={},f=["a","b","c"];if(e&&e.isGeometry){var m=e.faces;for(t=0,n=m.length;t<n;t++){var g=m[t];for(i=0;i<3;i++)s=g[f[i]],c=g[f[(i+1)%3]],d[0]=Math.min(s,c),d[1]=Math.max(s,c),void 0===p[h=d[0]+","+d[1]]&&(p[h]={index1:d[0],index2:d[1]})}for(h in p)o=p[h],l=e.vertices[o.index1],u.push(l.x,l.y,l.z),l=e.vertices[o.index2],u.push(l.x,l.y,l.z)}else if(e&&e.isBufferGeometry){var v,y,x,w,b,_;if(l=new zt,null!==e.index){for(v=e.attributes.position,y=e.index,0===(x=e.groups).length&&(x=[{start:0,count:y.count,materialIndex:0}]),r=0,a=x.length;r<a;++r)for(n=(t=(w=x[r]).start)+w.count;t<n;t+=3)for(i=0;i<3;i++)s=y.getX(t+i),c=y.getX(t+(i+1)%3),d[0]=Math.min(s,c),d[1]=Math.max(s,c),void 0===p[h=d[0]+","+d[1]]&&(p[h]={index1:d[0],index2:d[1]});for(h in p)o=p[h],l.fromBufferAttribute(v,o.index1),u.push(l.x,l.y,l.z),l.fromBufferAttribute(v,o.index2),u.push(l.x,l.y,l.z)}else for(t=0,n=(v=e.attributes.position).count/3;t<n;t++)for(i=0;i<3;i++)b=3*t+i,l.fromBufferAttribute(v,b),u.push(l.x,l.y,l.z),_=3*t+(i+1)%3,l.fromBufferAttribute(v,_),u.push(l.x,l.y,l.z)}this.addAttribute("position",new pn(u,3))}function Co(e,t,i){rn.call(this),this.type="ParametricGeometry",this.parameters={func:e,slices:t,stacks:i},this.fromBufferGeometry(new Po(e,t,i)),this.mergeVertices()}function Po(e,t,i){Ln.call(this),this.type="ParametricBufferGeometry",this.parameters={func:e,slices:t,stacks:i};var n,r,a=[],o=[],s=[],c=[],h=new zt,l=new zt,u=new zt,d=new zt,p=new zt,f=t+1;for(n=0;n<=i;n++){var m=n/i;for(r=0;r<=t;r++){var g=r/t;e(g,m,l),o.push(l.x,l.y,l.z),0<=g-1e-5?(e(g-1e-5,m,u),d.subVectors(l,u)):(e(g+1e-5,m,u),d.subVectors(u,l)),0<=m-1e-5?(e(g,m-1e-5,u),p.subVectors(l,u)):(e(g,m+1e-5,u),p.subVectors(u,l)),h.crossVectors(d,p).normalize(),s.push(h.x,h.y,h.z),c.push(g,m)}}for(n=0;n<i;n++)for(r=0;r<t;r++){var v=n*f+r,y=n*f+r+1,x=(n+1)*f+r+1,w=(n+1)*f+r;a.push(v,y,w),a.push(y,x,w)}this.setIndex(a),this.addAttribute("position",new pn(o,3)),this.addAttribute("normal",new pn(s,3)),this.addAttribute("uv",new pn(c,2))}function Oo(e,t,i,n){rn.call(this),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:n},this.fromBufferGeometry(new Io(e,t,i,n)),this.mergeVertices()}function Io(n,a,e,t){Ln.call(this),this.type="PolyhedronBufferGeometry",this.parameters={vertices:n,indices:a,radius:e,detail:t},e=e||1;var l=[],u=[];function o(e,t,i,n){var r,a,o=Math.pow(2,n),s=[];for(r=0;r<=o;r++){s[r]=[];var c=e.clone().lerp(i,r/o),h=t.clone().lerp(i,r/o),l=o-r;for(a=0;a<=l;a++)s[r][a]=0===a&&r===o?c:c.clone().lerp(h,a/l)}for(r=0;r<o;r++)for(a=0;a<2*(o-r)-1;a++){var u=Math.floor(a/2);a%2==0?(d(s[r][u+1]),d(s[r+1][u]),d(s[r][u])):(d(s[r][u+1]),d(s[r+1][u+1]),d(s[r+1][u]))}}function d(e){l.push(e.x,e.y,e.z)}function s(e,t){var i=3*e;t.x=n[i+0],t.y=n[i+1],t.z=n[i+2]}function p(e,t,i,n){n<0&&1===e.x&&(u[t]=e.x-1),0===i.x&&0===i.z&&(u[t]=n/2/Math.PI+.5)}function f(e){return Math.atan2(e.z,-e.x)}!function(e){for(var t=new zt,i=new zt,n=new zt,r=0;r<a.length;r+=3)s(a[r+0],t),s(a[r+1],i),s(a[r+2],n),o(t,i,n,e)}(t=t||0),function(e){for(var t=new zt,i=0;i<l.length;i+=3)t.x=l[i+0],t.y=l[i+1],t.z=l[i+2],t.normalize().multiplyScalar(e),l[i+0]=t.x,l[i+1]=t.y,l[i+2]=t.z}(e),function(){for(var e=new zt,t=0;t<l.length;t+=3){e.x=l[t+0],e.y=l[t+1],e.z=l[t+2];var i=f(e)/2/Math.PI+.5,n=(r=e,Math.atan2(-r.y,Math.sqrt(r.x*r.x+r.z*r.z))/Math.PI+.5);u.push(i,1-n)}var r;(function(){for(var e=new zt,t=new zt,i=new zt,n=new zt,r=new Dt,a=new Dt,o=new Dt,s=0,c=0;s<l.length;s+=9,c+=6){e.set(l[s+0],l[s+1],l[s+2]),t.set(l[s+3],l[s+4],l[s+5]),i.set(l[s+6],l[s+7],l[s+8]),r.set(u[c+0],u[c+1]),a.set(u[c+2],u[c+3]),o.set(u[c+4],u[c+5]),n.copy(e).add(t).add(i).divideScalar(3);var h=f(n);p(r,c+0,e,h),p(a,c+2,t,h),p(o,c+4,i,h)}})(),function(){for(var e=0;e<u.length;e+=6){var t=u[e+0],i=u[e+2],n=u[e+4],r=Math.max(t,i,n),a=Math.min(t,i,n);.9<r&&a<.1&&(t<.2&&(u[e+0]+=1),i<.2&&(u[e+2]+=1),n<.2&&(u[e+4]+=1))}}()}(),this.addAttribute("position",new pn(l,3)),this.addAttribute("normal",new pn(l.slice(),3)),this.addAttribute("uv",new pn(u,2)),0===t?this.computeVertexNormals():this.normalizeNormals()}function No(e,t){rn.call(this),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t},this.fromBufferGeometry(new Bo(e,t)),this.mergeVertices()}function Bo(e,t){Io.call(this,[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],[2,1,0,0,3,2,1,3,0,2,3,1],e,t),this.type="TetrahedronBufferGeometry",this.parameters={radius:e,detail:t}}function Uo(e,t){rn.call(this),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t},this.fromBufferGeometry(new Do(e,t)),this.mergeVertices()}function Do(e,t){Io.call(this,[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type="OctahedronBufferGeometry",this.parameters={radius:e,detail:t}}function Fo(e,t){rn.call(this),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t},this.fromBufferGeometry(new Ho(e,t)),this.mergeVertices()}function Ho(e,t){var i=(1+Math.sqrt(5))/2;Io.call(this,[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type="IcosahedronBufferGeometry",this.parameters={radius:e,detail:t}}function zo(e,t){rn.call(this),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t},this.fromBufferGeometry(new Go(e,t)),this.mergeVertices()}function Go(e,t){var i=(1+Math.sqrt(5))/2,n=1/i;Io.call(this,[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-n,-i,0,-n,i,0,n,-i,0,n,i,-n,-i,0,-n,i,0,n,-i,0,n,i,0,-i,0,-n,i,0,-n,-i,0,n,i,0,n],[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9],e,t),this.type="DodecahedronBufferGeometry",this.parameters={radius:e,detail:t}}function ko(e,t,i,n,r,a){rn.call(this),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:i,radialSegments:n,closed:r},void 0!==a&&console.warn("THREE.TubeGeometry: taper has been removed.");var o=new Vo(e,t,i,n,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals,this.fromBufferGeometry(o),this.mergeVertices()}function Vo(o,s,c,h,e){Ln.call(this),this.type="TubeBufferGeometry",this.parameters={path:o,tubularSegments:s,radius:c,radialSegments:h,closed:e},s=s||64,c=c||1,h=h||8,e=e||!1;var l=o.computeFrenetFrames(s,e);this.tangents=l.tangents,this.normals=l.normals,this.binormals=l.binormals;var r,u,d=new zt,p=new zt,t=new Dt,f=new zt,m=[],g=[],i=[],a=[];function n(e){f=o.getPointAt(e/s,f);var t=l.normals[e],i=l.binormals[e];for(u=0;u<=h;u++){var n=u/h*Math.PI*2,r=Math.sin(n),a=-Math.cos(n);p.x=a*t.x+r*i.x,p.y=a*t.y+r*i.y,p.z=a*t.z+r*i.z,p.normalize(),g.push(p.x,p.y,p.z),d.x=f.x+c*p.x,d.y=f.y+c*p.y,d.z=f.z+c*p.z,m.push(d.x,d.y,d.z)}}!function(){for(r=0;r<s;r++)n(r);n(!1===e?s:0),function(){for(r=0;r<=s;r++)for(u=0;u<=h;u++)t.x=r/s,t.y=u/h,i.push(t.x,t.y)}(),function(){for(u=1;u<=s;u++)for(r=1;r<=h;r++){var e=(h+1)*(u-1)+(r-1),t=(h+1)*u+(r-1),i=(h+1)*u+r,n=(h+1)*(u-1)+r;a.push(e,t,n),a.push(t,i,n)}}()}(),this.setIndex(a),this.addAttribute("position",new pn(m,3)),this.addAttribute("normal",new pn(g,3)),this.addAttribute("uv",new pn(i,2))}function jo(e,t,i,n,r,a,o){rn.call(this),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:i,radialSegments:n,p:r,q:a},void 0!==o&&console.warn("THREE.TorusKnotGeometry: heightScale has been deprecated. Use .scale( x, y, z ) instead."),this.fromBufferGeometry(new Wo(e,t,i,n,r,a)),this.mergeVertices()}function Wo(e,t,i,n,r,a){Ln.call(this),this.type="TorusKnotBufferGeometry",this.parameters={radius:e,tube:t,tubularSegments:i,radialSegments:n,p:r,q:a},e=e||1,t=t||.4,i=Math.floor(i)||64,n=Math.floor(n)||8,r=r||2,a=a||3;var o,s,c=[],h=[],l=[],u=[],d=new zt,p=new zt,f=new zt,m=new zt,g=new zt,v=new zt,y=new zt;for(o=0;o<=i;++o){var x=o/i*r*Math.PI*2;for(A(x,r,a,e,f),A(x+.01,r,a,e,m),v.subVectors(m,f),y.addVectors(m,f),g.crossVectors(v,y),y.crossVectors(g,v),g.normalize(),y.normalize(),s=0;s<=n;++s){var w=s/n*Math.PI*2,b=-t*Math.cos(w),_=t*Math.sin(w);d.x=f.x+(b*y.x+_*g.x),d.y=f.y+(b*y.y+_*g.y),d.z=f.z+(b*y.z+_*g.z),h.push(d.x,d.y,d.z),p.subVectors(d,f).normalize(),l.push(p.x,p.y,p.z),u.push(o/i),u.push(s/n)}}for(s=1;s<=i;s++)for(o=1;o<=n;o++){var M=(n+1)*(s-1)+(o-1),E=(n+1)*s+(o-1),T=(n+1)*s+o,S=(n+1)*(s-1)+o;c.push(M,E,S),c.push(E,T,S)}function A(e,t,i,n,r){var a=Math.cos(e),o=Math.sin(e),s=i/t*e,c=Math.cos(s);r.x=n*(2+c)*.5*a,r.y=n*(2+c)*o*.5,r.z=n*Math.sin(s)*.5}this.setIndex(c),this.addAttribute("position",new pn(h,3)),this.addAttribute("normal",new pn(l,3)),this.addAttribute("uv",new pn(u,2))}function Xo(e,t,i,n,r){rn.call(this),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:n,arc:r},this.fromBufferGeometry(new qo(e,t,i,n,r)),this.mergeVertices()}function qo(e,t,i,n,r){Ln.call(this),this.type="TorusBufferGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:n,arc:r},e=e||1,t=t||.4,i=Math.floor(i)||8,n=Math.floor(n)||6,r=r||2*Math.PI;var a,o,s=[],c=[],h=[],l=[],u=new zt,d=new zt,p=new zt;for(a=0;a<=i;a++)for(o=0;o<=n;o++){var f=o/n*r,m=a/i*Math.PI*2;d.x=(e+t*Math.cos(m))*Math.cos(f),d.y=(e+t*Math.cos(m))*Math.sin(f),d.z=t*Math.sin(m),c.push(d.x,d.y,d.z),u.x=e*Math.cos(f),u.y=e*Math.sin(f),p.subVectors(d,u).normalize(),h.push(p.x,p.y,p.z),l.push(o/n),l.push(a/i)}for(a=1;a<=i;a++)for(o=1;o<=n;o++){var g=(n+1)*a+o-1,v=(n+1)*(a-1)+o-1,y=(n+1)*(a-1)+o,x=(n+1)*a+o;s.push(g,v,x),s.push(v,y,x)}this.setIndex(s),this.addAttribute("position",new pn(c,3)),this.addAttribute("normal",new pn(h,3)),this.addAttribute("uv",new pn(l,2))}((Ja.prototype=Object.create(rr.prototype)).constructor=Ja).prototype.isMeshDepthMaterial=!0,Ja.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.depthPacking=e.depthPacking,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this},((Qa.prototype=Object.create(rr.prototype)).constructor=Qa).prototype.isMeshDistanceMaterial=!0,Qa.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.referencePosition.copy(e.referencePosition),this.nearDistance=e.nearDistance,this.farDistance=e.farDistance,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this},(($a.prototype=Object.create(ai.prototype)).constructor=$a).prototype.isCanvasTexture=!0,ro.prototype=Object.assign(Object.create(Xi.prototype),{constructor:ro,isPerspectiveCamera:!0,copy:function(e,t){return Xi.prototype.copy.call(this,e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=null===e.view?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this},setFocalLength:function(e){var t=.5*this.getFilmHeight()/e;this.fov=2*Ut.RAD2DEG*Math.atan(t),this.updateProjectionMatrix()},getFocalLength:function(){var e=Math.tan(.5*Ut.DEG2RAD*this.fov);return.5*this.getFilmHeight()/e},getEffectiveFOV:function(){return 2*Ut.RAD2DEG*Math.atan(Math.tan(.5*Ut.DEG2RAD*this.fov)/this.zoom)},getFilmWidth:function(){return this.filmGauge*Math.min(this.aspect,1)},getFilmHeight:function(){return this.filmGauge/Math.max(this.aspect,1)},setViewOffset:function(e,t,i,n,r,a){this.aspect=e/t,null===this.view&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()},clearViewOffset:function(){null!==this.view&&(this.view.enabled=!1),this.updateProjectionMatrix()},updateProjectionMatrix:function(){var e=this.near,t=e*Math.tan(.5*Ut.DEG2RAD*this.fov)/this.zoom,i=2*t,n=this.aspect*i,r=-.5*n,a=this.view;if(null!==this.view&&this.view.enabled){var o=a.fullWidth,s=a.fullHeight;r+=a.offsetX*n/o,t-=a.offsetY*i/s,n*=a.width/o,i*=a.height/s}var c=this.filmOffset;0!==c&&(r+=e*c/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+n,t,t-i,e,this.far)},toJSON:function(e){var t=Wi.prototype.toJSON.call(this,e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,null!==this.view&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}),ao.prototype=Object.assign(Object.create(ro.prototype),{constructor:ao,isArrayCamera:!0}),ho.prototype.isFogExp2=!0,ho.prototype.clone=function(){return new ho(this.color,this.density)},ho.prototype.toJSON=function(){return{type:"FogExp2",color:this.color.getHex(),density:this.density}},lo.prototype.isFog=!0,lo.prototype.clone=function(){return new lo(this.color,this.near,this.far)},lo.prototype.toJSON=function(){return{type:"Fog",color:this.color.getHex(),near:this.near,far:this.far}},uo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:uo,copy:function(e,t){return Wi.prototype.copy.call(this,e,t),null!==e.background&&(this.background=e.background.clone()),null!==e.fog&&(this.fog=e.fog.clone()),null!==e.overrideMaterial&&(this.overrideMaterial=e.overrideMaterial.clone()),this.autoUpdate=e.autoUpdate,this.matrixAutoUpdate=e.matrixAutoUpdate,this},toJSON:function(e){var t=Wi.prototype.toJSON.call(this,e);return null!==this.background&&(t.object.background=this.background.toJSON(e)),null!==this.fog&&(t.object.fog=this.fog.toJSON()),t}}),((po.prototype=Object.create(rr.prototype)).constructor=po).prototype.isSpriteMaterial=!0,po.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.map=e.map,this.rotation=e.rotation,this},fo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:fo,isSprite:!0,raycast:(La=new zt,Ra=new zt,Ca=new zt,function(e,t){Ra.setFromMatrixPosition(this.matrixWorld),e.ray.closestPointToPoint(Ra,La),Ca.setFromMatrixScale(this.matrixWorld);var i=Ca.x*Ca.y/4;if(!(Ra.distanceToSquared(La)>i)){var n=e.ray.origin.distanceTo(La);n<e.near||n>e.far||t.push({distance:n,point:La.clone(),face:null,object:this})}}),clone:function(){return new this.constructor(this.material).copy(this)},copy:function(e){return Wi.prototype.copy.call(this,e),void 0!==e.center&&this.center.copy(e.center),this}}),mo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:mo,copy:function(e){Wi.prototype.copy.call(this,e,!1);for(var t=e.levels,i=0,n=t.length;i<n;i++){var r=t[i];this.addLevel(r.object.clone(),r.distance)}return this},addLevel:function(e,t){void 0===t&&(t=0),t=Math.abs(t);for(var i=this.levels,n=0;n<i.length&&!(t<i[n].distance);n++);i.splice(n,0,{distance:t,object:e}),this.add(e)},getObjectForDistance:function(e){for(var t=this.levels,i=1,n=t.length;i<n&&!(e<t[i].distance);i++);return t[i-1].object},raycast:(Ia=new zt,function(e,t){Ia.setFromMatrixPosition(this.matrixWorld);var i=e.ray.origin.distanceTo(Ia);this.getObjectForDistance(i).raycast(e,t)}),update:(Pa=new zt,Oa=new zt,function(e){var t=this.levels;if(1<t.length){Pa.setFromMatrixPosition(e.matrixWorld),Oa.setFromMatrixPosition(this.matrixWorld);var i=Pa.distanceTo(Oa);t[0].object.visible=!0;for(var n=1,r=t.length;n<r&&i>=t[n].distance;n++)t[n-1].object.visible=!1,t[n].object.visible=!0;for(;n<r;n++)t[n].object.visible=!1}}),toJSON:function(e){var t=Wi.prototype.toJSON.call(this,e);t.object.levels=[];for(var i=this.levels,n=0,r=i.length;n<r;n++){var a=i[n];t.object.levels.push({object:a.object.uuid,distance:a.distance})}return t}}),Object.assign(go.prototype,{calculateInverses:function(){this.boneInverses=[];for(var e=0,t=this.bones.length;e<t;e++){var i=new Ft;this.bones[e]&&i.getInverse(this.bones[e].matrixWorld),this.boneInverses.push(i)}},pose:function(){var e,t,i;for(t=0,i=this.bones.length;t<i;t++)(e=this.bones[t])&&e.matrixWorld.getInverse(this.boneInverses[t]);for(t=0,i=this.bones.length;t<i;t++)(e=this.bones[t])&&(e.parent&&e.parent.isBone?(e.matrix.getInverse(e.parent.matrixWorld),e.matrix.multiply(e.matrixWorld)):e.matrix.copy(e.matrixWorld),e.matrix.decompose(e.position,e.quaternion,e.scale))},update:(Na=new Ft,Ba=new Ft,function(){for(var e=this.bones,t=this.boneInverses,i=this.boneMatrices,n=this.boneTexture,r=0,a=e.length;r<a;r++){var o=e[r]?e[r].matrixWorld:Ba;Na.multiplyMatrices(o,t[r]),Na.toArray(i,16*r)}void 0!==n&&(n.needsUpdate=!0)}),clone:function(){return new go(this.bones,this.boneInverses)},getBoneByName:function(e){for(var t=0,i=this.bones.length;t<i;t++){var n=this.bones[t];if(n.name===e)return n}}}),vo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:vo,isBone:!0}),yo.prototype=Object.assign(Object.create(lr.prototype),{constructor:yo,isSkinnedMesh:!0,initBones:function(){var e,t,i,n,r=[];if(this.geometry&&void 0!==this.geometry.bones){for(i=0,n=this.geometry.bones.length;i<n;i++)t=this.geometry.bones[i],e=new vo,r.push(e),e.name=t.name,e.position.fromArray(t.pos),e.quaternion.fromArray(t.rotq),void 0!==t.scl&&e.scale.fromArray(t.scl);for(i=0,n=this.geometry.bones.length;i<n;i++)-1!==(t=this.geometry.bones[i]).parent&&null!==t.parent&&void 0!==r[t.parent]?r[t.parent].add(r[i]):this.add(r[i])}return this.updateMatrixWorld(!0),r},bind:function(e,t){this.skeleton=e,void 0===t&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.getInverse(t)},pose:function(){this.skeleton.pose()},normalizeSkinWeights:function(){var e,t;if(this.geometry&&this.geometry.isGeometry)for(t=0;t<this.geometry.skinWeights.length;t++){var i=this.geometry.skinWeights[t];(e=1/i.manhattanLength())!==1/0?i.multiplyScalar(e):i.set(1,0,0,0)}else if(this.geometry&&this.geometry.isBufferGeometry){var n=new oi,r=this.geometry.attributes.skinWeight;for(t=0;t<r.count;t++)n.x=r.getX(t),n.y=r.getY(t),n.z=r.getZ(t),n.w=r.getW(t),(e=1/n.manhattanLength())!==1/0?n.multiplyScalar(e):n.set(1,0,0,0),r.setXYZW(t,n.x,n.y,n.z,n.w)}},updateMatrixWorld:function(e){lr.prototype.updateMatrixWorld.call(this,e),"attached"===this.bindMode?this.bindMatrixInverse.getInverse(this.matrixWorld):"detached"===this.bindMode?this.bindMatrixInverse.getInverse(this.bindMatrix):console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)},clone:function(){return new this.constructor(this.geometry,this.material).copy(this)}}),((xo.prototype=Object.create(rr.prototype)).constructor=xo).prototype.isLineBasicMaterial=!0,xo.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this},wo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:wo,isLine:!0,computeLineDistances:(Ha=new zt,za=new zt,function(){var e=this.geometry;if(e.isBufferGeometry)if(null===e.index){for(var t=e.attributes.position,i=[0],n=1,r=t.count;n<r;n++)Ha.fromBufferAttribute(t,n-1),za.fromBufferAttribute(t,n),i[n]=i[n-1],i[n]+=Ha.distanceTo(za);e.addAttribute("lineDistance",new pn(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else if(e.isGeometry){var a=e.vertices;for((i=e.lineDistances)[0]=0,n=1,r=a.length;n<r;n++)i[n]=i[n-1],i[n]+=a[n-1].distanceTo(a[n])}return this}),raycast:(Ua=new Ft,Da=new sr,Fa=new ui,function(e,t){var i=e.linePrecision,n=i*i,r=this.geometry,a=this.matrixWorld;if(null===r.boundingSphere&&r.computeBoundingSphere(),Fa.copy(r.boundingSphere),Fa.applyMatrix4(a),!1!==e.ray.intersectsSphere(Fa)){Ua.getInverse(a),Da.copy(e.ray).applyMatrix4(Ua);var o=new zt,s=new zt,c=new zt,h=new zt,l=this&&this.isLineSegments?2:1;if(r.isBufferGeometry){var u=r.index,d=r.attributes.position.array;if(null!==u)for(var p=u.array,f=0,m=p.length-1;f<m;f+=l){var g=p[f],v=p[f+1];o.fromArray(d,3*g),s.fromArray(d,3*v),n<Da.distanceSqToSegment(o,s,h,c)||(h.applyMatrix4(this.matrixWorld),(w=e.ray.origin.distanceTo(h))<e.near||w>e.far||t.push({distance:w,point:c.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this}))}else for(f=0,m=d.length/3-1;f<m;f+=l)o.fromArray(d,3*f),s.fromArray(d,3*f+3),n<Da.distanceSqToSegment(o,s,h,c)||(h.applyMatrix4(this.matrixWorld),(w=e.ray.origin.distanceTo(h))<e.near||w>e.far||t.push({distance:w,point:c.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this}))}else if(r.isGeometry){var y=r.vertices,x=y.length;for(f=0;f<x-1;f+=l){var w;n<Da.distanceSqToSegment(y[f],y[f+1],h,c)||(h.applyMatrix4(this.matrixWorld),(w=e.ray.origin.distanceTo(h))<e.near||w>e.far||t.push({distance:w,point:c.clone().applyMatrix4(this.matrixWorld),index:f,face:null,faceIndex:null,object:this}))}}}}),clone:function(){return new this.constructor(this.geometry,this.material).copy(this)}}),bo.prototype=Object.assign(Object.create(wo.prototype),{constructor:bo,isLineSegments:!0,computeLineDistances:(Ga=new zt,ka=new zt,function(){var e=this.geometry;if(e.isBufferGeometry)if(null===e.index){for(var t=e.attributes.position,i=[],n=0,r=t.count;n<r;n+=2)Ga.fromBufferAttribute(t,n),ka.fromBufferAttribute(t,n+1),i[n]=0===n?0:i[n-1],i[n+1]=i[n]+Ga.distanceTo(ka);e.addAttribute("lineDistance",new pn(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");else if(e.isGeometry){var a=e.vertices;for(i=e.lineDistances,n=0,r=a.length;n<r;n+=2)Ga.copy(a[n]),ka.copy(a[n+1]),i[n]=0===n?0:i[n-1],i[n+1]=i[n]+Ga.distanceTo(ka)}return this})}),_o.prototype=Object.assign(Object.create(wo.prototype),{constructor:_o,isLineLoop:!0}),((Mo.prototype=Object.create(rr.prototype)).constructor=Mo).prototype.isPointsMaterial=!0,Mo.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.map=e.map,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this},Eo.prototype=Object.assign(Object.create(Wi.prototype),{constructor:Eo,isPoints:!0,raycast:(Va=new Ft,ja=new sr,Wa=new ui,function(r,a){var o=this,e=this.geometry,s=this.matrixWorld,t=r.params.Points.threshold;if(null===e.boundingSphere&&e.computeBoundingSphere(),Wa.copy(e.boundingSphere),Wa.applyMatrix4(s),Wa.radius+=t,!1!==r.ray.intersectsSphere(Wa)){Va.getInverse(s),ja.copy(r.ray).applyMatrix4(Va);var i=t/((this.scale.x+this.scale.y+this.scale.z)/3),c=i*i,n=new zt,h=new zt;if(e.isBufferGeometry){var l=e.index,u=e.attributes.position.array;if(null!==l)for(var d=l.array,p=0,f=d.length;p<f;p++){var m=d[p];n.fromArray(u,3*m),y(n,m)}else{p=0;for(var g=u.length/3;p<g;p++)n.fromArray(u,3*p),y(n,p)}}else{var v=e.vertices;for(p=0,g=v.length;p<g;p++)y(v[p],p)}}function y(e,t){var i=ja.distanceSqToPoint(e);if(i<c){ja.closestPointToPoint(e,h),h.applyMatrix4(s);var n=r.ray.origin.distanceTo(h);if(n<r.near||n>r.far)return;a.push({distance:n,distanceToRay:Math.sqrt(i),point:h.clone(),index:t,face:null,object:o})}}}),clone:function(){return new this.constructor(this.geometry,this.material).copy(this)}}),To.prototype=Object.assign(Object.create(Wi.prototype),{constructor:To,isGroup:!0}),So.prototype=Object.assign(Object.create(ai.prototype),{constructor:So,isVideoTexture:!0,update:function(){var e=this.image;e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}}),((Ao.prototype=Object.create(ai.prototype)).constructor=Ao).prototype.isCompressedTexture=!0,((Lo.prototype=Object.create(ai.prototype)).constructor=Lo).prototype.isDepthTexture=!0,(Ro.prototype=Object.create(Ln.prototype)).constructor=Ro,(Co.prototype=Object.create(rn.prototype)).constructor=Co,(Po.prototype=Object.create(Ln.prototype)).constructor=Po,(Oo.prototype=Object.create(rn.prototype)).constructor=Oo,(Io.prototype=Object.create(Ln.prototype)).constructor=Io,(No.prototype=Object.create(rn.prototype)).constructor=No,(Bo.prototype=Object.create(Io.prototype)).constructor=Bo,(Uo.prototype=Object.create(rn.prototype)).constructor=Uo,(Do.prototype=Object.create(Io.prototype)).constructor=Do,(Fo.prototype=Object.create(rn.prototype)).constructor=Fo,(Ho.prototype=Object.create(Io.prototype)).constructor=Ho,(zo.prototype=Object.create(rn.prototype)).constructor=zo,(Go.prototype=Object.create(Io.prototype)).constructor=Go,(ko.prototype=Object.create(rn.prototype)).constructor=ko,(Vo.prototype=Object.create(Ln.prototype)).constructor=Vo,(jo.prototype=Object.create(rn.prototype)).constructor=jo,(Wo.prototype=Object.create(Ln.prototype)).constructor=Wo,(Xo.prototype=Object.create(rn.prototype)).constructor=Xo,(qo.prototype=Object.create(Ln.prototype)).constructor=qo;var Yo=function(e,t,i){i=i||2;var n,r,a,o,s,c,h,l=t&&t.length,u=l?t[0]*i:e.length,d=Zo(e,0,u,i,!0),p=[];if(!d)return p;if(l&&(d=function(e,t,i,n){var r,a,o,s,c,h=[];for(r=0,a=t.length;r<a;r++)o=t[r]*n,s=r<a-1?t[r+1]*n:e.length,(c=Zo(e,o,s,n,!1))===c.next&&(c.steiner=!0),h.push(as(c));for(h.sort(is),r=0;r<h.length;r++)ns(h[r],i),i=Jo(i,i.next);return i}(e,t,d,i)),e.length>80*i){n=a=e[0],r=o=e[1];for(var f=i;f<u;f+=i)(s=e[f])<n&&(n=s),(c=e[f+1])<r&&(r=c),a<s&&(a=s),o<c&&(o=c);h=0!==(h=Math.max(a-n,o-r))?1/h:0}return Qo(d,p,i,n,r,h),p};function Zo(e,t,i,n,r){var a,o;if(r===0<function(e,t,i,n){for(var r=0,a=t,o=i-n;a<i;a+=n)r+=(e[o]-e[a])*(e[a+1]+e[o+1]),o=a;return r}(e,t,i,n))for(a=t;a<i;a+=n)o=ds(a,e[a],e[a+1],o);else for(a=i-n;t<=a;a-=n)o=ds(a,e[a],e[a+1],o);return o&&cs(o,o.next)&&(ps(o),o=o.next),o}function Jo(e,t){if(!e)return e;t||(t=e);var i,n=e;do{if(i=!1,n.steiner||!cs(n,n.next)&&0!==ss(n.prev,n,n.next))n=n.next;else{if(ps(n),(n=t=n.prev)===n.next)break;i=!0}}while(i||n!==t);return t}function Qo(e,t,i,n,r,a,o){if(e){!o&&a&&function(e,t,i,n){var r=e;for(;null===r.z&&(r.z=rs(r.x,r.y,t,i,n)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next,r!==e;);r.prevZ.nextZ=null,r.prevZ=null,function(e){var t,i,n,r,a,o,s,c,h=1;do{for(i=e,a=e=null,o=0;i;){for(o++,n=i,t=s=0;t<h&&(s++,n=n.nextZ);t++);for(c=h;0<s||0<c&&n;)0!==s&&(0===c||!n||i.z<=n.z)?(i=(r=i).nextZ,s--):(n=(r=n).nextZ,c--),a?a.nextZ=r:e=r,r.prevZ=a,a=r;i=n}a.nextZ=null,h*=2}while(1<o)}(r)}(e,n,r,a);for(var s,c,h=e;e.prev!==e.next;)if(s=e.prev,c=e.next,a?$o(e,n,r,a):Ko(e))t.push(s.i/i),t.push(e.i/i),t.push(c.i/i),ps(e),e=c.next,h=c.next;else if((e=c)===h){o?1===o?Qo(e=es(e,t,i),t,i,n,r,a,2):2===o&&ts(e,t,i,n,r,a):Qo(Jo(e),t,i,n,r,a,1);break}}}function Ko(e){var t=e.prev,i=e,n=e.next;if(0<=ss(t,i,n))return!1;for(var r=e.next.next;r!==e.prev;){if(os(t.x,t.y,i.x,i.y,n.x,n.y,r.x,r.y)&&0<=ss(r.prev,r,r.next))return!1;r=r.next}return!0}function $o(e,t,i,n){var r=e.prev,a=e,o=e.next;if(0<=ss(r,a,o))return!1;for(var s=r.x<a.x?r.x<o.x?r.x:o.x:a.x<o.x?a.x:o.x,c=r.y<a.y?r.y<o.y?r.y:o.y:a.y<o.y?a.y:o.y,h=r.x>a.x?r.x>o.x?r.x:o.x:a.x>o.x?a.x:o.x,l=r.y>a.y?r.y>o.y?r.y:o.y:a.y>o.y?a.y:o.y,u=rs(s,c,t,i,n),d=rs(h,l,t,i,n),p=e.nextZ;p&&p.z<=d;){if(p!==e.prev&&p!==e.next&&os(r.x,r.y,a.x,a.y,o.x,o.y,p.x,p.y)&&0<=ss(p.prev,p,p.next))return!1;p=p.nextZ}for(p=e.prevZ;p&&p.z>=u;){if(p!==e.prev&&p!==e.next&&os(r.x,r.y,a.x,a.y,o.x,o.y,p.x,p.y)&&0<=ss(p.prev,p,p.next))return!1;p=p.prevZ}return!0}function es(e,t,i){var n=e;do{var r=n.prev,a=n.next.next;!cs(r,a)&&hs(r,n,n.next,a)&&ls(r,a)&&ls(a,r)&&(t.push(r.i/i),t.push(n.i/i),t.push(a.i/i),ps(n),ps(n.next),n=e=a),n=n.next}while(n!==e);return n}function ts(e,t,i,n,r,a){var o,s,c=e;do{for(var h=c.next.next;h!==c.prev;){if(c.i!==h.i&&(s=h,(o=c).next.i!==s.i&&o.prev.i!==s.i&&!function(e,t){var i=e;do{if(i.i!==e.i&&i.next.i!==e.i&&i.i!==t.i&&i.next.i!==t.i&&hs(i,i.next,e,t))return!0;i=i.next}while(i!==e);return!1}(o,s)&&ls(o,s)&&ls(s,o)&&function(e,t){var i=e,n=!1,r=(e.x+t.x)/2,a=(e.y+t.y)/2;for(;i.y>a!=i.next.y>a&&i.next.y!==i.y&&r<(i.next.x-i.x)*(a-i.y)/(i.next.y-i.y)+i.x&&(n=!n),i=i.next,i!==e;);return n}(o,s))){var l=us(c,h);return c=Jo(c,c.next),l=Jo(l,l.next),Qo(c,t,i,n,r,a),void Qo(l,t,i,n,r,a)}h=h.next}c=c.next}while(c!==e)}function is(e,t){return e.x-t.x}function ns(e,t){if(t=function(e,t){var i,n=t,r=e.x,a=e.y,o=-1/0;do{if(a<=n.y&&a>=n.next.y&&n.next.y!==n.y){var s=n.x+(a-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(s<=r&&o<s){if((o=s)===r){if(a===n.y)return n;if(a===n.next.y)return n.next}i=n.x<n.next.x?n:n.next}}n=n.next}while(n!==t);if(!i)return null;if(r===o)return i.prev;var c,h=i,l=i.x,u=i.y,d=1/0;n=i.next;for(;n!==h;)r>=n.x&&n.x>=l&&r!==n.x&&os(a<u?r:o,a,l,u,a<u?o:r,a,n.x,n.y)&&((c=Math.abs(a-n.y)/(r-n.x))<d||c===d&&n.x>i.x)&&ls(n,e)&&(i=n,d=c),n=n.next;return i}(e,t)){var i=us(t,e);Jo(i,i.next)}}function rs(e,t,i,n,r){return(e=1431655765&((e=858993459&((e=252645135&((e=16711935&((e=32767*(e-i)*r)|e<<8))|e<<4))|e<<2))|e<<1))|(t=1431655765&((t=858993459&((t=252645135&((t=16711935&((t=32767*(t-n)*r)|t<<8))|t<<4))|t<<2))|t<<1))<<1}function as(e){for(var t=e,i=e;t.x<i.x&&(i=t),(t=t.next)!==e;);return i}function os(e,t,i,n,r,a,o,s){return 0<=(r-o)*(t-s)-(e-o)*(a-s)&&0<=(e-o)*(n-s)-(i-o)*(t-s)&&0<=(i-o)*(a-s)-(r-o)*(n-s)}function ss(e,t,i){return(t.y-e.y)*(i.x-t.x)-(t.x-e.x)*(i.y-t.y)}function cs(e,t){return e.x===t.x&&e.y===t.y}function hs(e,t,i,n){return!!(cs(e,t)&&cs(i,n)||cs(e,n)&&cs(i,t))||0<ss(e,t,i)!=0<ss(e,t,n)&&0<ss(i,n,e)!=0<ss(i,n,t)}function ls(e,t){return ss(e.prev,e,e.next)<0?0<=ss(e,t,e.next)&&0<=ss(e,e.prev,t):ss(e,t,e.prev)<0||ss(e,e.next,t)<0}function us(e,t){var i=new fs(e.i,e.x,e.y),n=new fs(t.i,t.x,t.y),r=e.next,a=t.prev;return(e.next=t).prev=e,(i.next=r).prev=i,(n.next=i).prev=n,(a.next=n).prev=a,n}function ds(e,t,i,n){var r=new fs(e,t,i);return n?(r.next=n.next,(r.prev=n).next.prev=r,n.next=r):(r.prev=r).next=r,r}function ps(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function fs(e,t,i){this.i=e,this.x=t,this.y=i,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}var ms={area:function(e){for(var t=e.length,i=0,n=t-1,r=0;r<t;n=r++)i+=e[n].x*e[r].y-e[r].x*e[n].y;return.5*i},isClockWise:function(e){return ms.area(e)<0},triangulateShape:function(e,t){var i=[],n=[],r=[];gs(e),vs(i,e);var a=e.length;t.forEach(gs);for(var o=0;o<t.length;o++)n.push(a),a+=t[o].length,vs(i,t[o]);var s=Yo(i,n);for(o=0;o<s.length;o+=3)r.push(s.slice(o,o+3));return r}};function gs(e){var t=e.length;2<t&&e[t-1].equals(e[0])&&e.pop()}function vs(e,t){for(var i=0;i<t.length;i++)e.push(t[i].x),e.push(t[i].y)}function ys(e,t){rn.call(this),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},this.fromBufferGeometry(new xs(e,t)),this.mergeVertices()}function xs(e,J){Ln.call(this),this.type="ExtrudeBufferGeometry",this.parameters={shapes:e,options:J},e=Array.isArray(e)?e:[e];for(var Q=this,K=[],$=[],t=0,i=e.length;t<i;t++){n(e[t])}function n(e){var n=[],t=void 0!==J.curveSegments?J.curveSegments:12,c=void 0!==J.steps?J.steps:1,i=void 0!==J.depth?J.depth:100,r=void 0===J.bevelEnabled||J.bevelEnabled,a=void 0!==J.bevelThickness?J.bevelThickness:6,o=void 0!==J.bevelSize?J.bevelSize:a-2,h=void 0!==J.bevelSegments?J.bevelSegments:3,s=J.extrudePath,l=void 0!==J.UVGenerator?J.UVGenerator:ws;void 0!==J.amount&&(console.warn("THREE.ExtrudeBufferGeometry: amount has been renamed to depth."),i=J.amount);var u,d,p,f,m,g,v,y,x=!1;s&&(u=s.getSpacedPoints(c),r=!(x=!0),d=s.computeFrenetFrames(c,!1),p=new zt,f=new zt,m=new zt),r||(o=a=h=0);var w=e.extractPoints(t),b=w.shape,_=w.holes;if(!ms.isClockWise(b))for(b=b.reverse(),v=0,y=_.length;v<y;v++)g=_[v],ms.isClockWise(g)&&(_[v]=g.reverse());var M=ms.triangulateShape(b,_),E=b;for(v=0,y=_.length;v<y;v++)g=_[v],b=b.concat(g);function T(e,t,i){return t||console.error("THREE.ExtrudeGeometry: vec does not exist"),t.clone().multiplyScalar(i).add(e)}var S,A,L,R,C,P,O=b.length,I=M.length;function N(e,t,i){var n,r,a,o=e.x-t.x,s=e.y-t.y,c=i.x-e.x,h=i.y-e.y,l=o*o+s*s,u=o*h-s*c;if(Math.abs(u)>Number.EPSILON){var d=Math.sqrt(l),p=Math.sqrt(c*c+h*h),f=t.x-s/d,m=t.y+o/d,g=((i.x-h/p-f)*h-(i.y+c/p-m)*c)/(o*h-s*c),v=(n=f+o*g-e.x)*n+(r=m+s*g-e.y)*r;if(v<=2)return new Dt(n,r);a=Math.sqrt(v/2)}else{var y=!1;o>Number.EPSILON?c>Number.EPSILON&&(y=!0):o<-Number.EPSILON?c<-Number.EPSILON&&(y=!0):Math.sign(s)===Math.sign(h)&&(y=!0),y?(n=-s,r=o,a=Math.sqrt(l)):(n=o,r=s,a=Math.sqrt(l/2))}return new Dt(n/a,r/a)}for(var B=[],U=0,D=E.length,F=D-1,H=U+1;U<D;U++,F++,H++)F===D&&(F=0),H===D&&(H=0),B[U]=N(E[U],E[F],E[H]);var z,G,k=[],V=B.concat();for(v=0,y=_.length;v<y;v++){for(g=_[v],z=[],U=0,F=(D=g.length)-1,H=U+1;U<D;U++,F++,H++)F===D&&(F=0),H===D&&(H=0),z[U]=N(g[U],g[F],g[H]);k.push(z),V=V.concat(z)}for(S=0;S<h;S++){for(L=S/h,R=a*Math.cos(L*Math.PI/2),A=o*Math.sin(L*Math.PI/2),U=0,D=E.length;U<D;U++)W((C=T(E[U],B[U],A)).x,C.y,-R);for(v=0,y=_.length;v<y;v++)for(g=_[v],z=k[v],U=0,D=g.length;U<D;U++)W((C=T(g[U],z[U],A)).x,C.y,-R)}for(A=o,U=0;U<O;U++)C=r?T(b[U],V[U],A):b[U],x?(f.copy(d.normals[0]).multiplyScalar(C.x),p.copy(d.binormals[0]).multiplyScalar(C.y),m.copy(u[0]).add(f).add(p),W(m.x,m.y,m.z)):W(C.x,C.y,0);for(G=1;G<=c;G++)for(U=0;U<O;U++)C=r?T(b[U],V[U],A):b[U],x?(f.copy(d.normals[G]).multiplyScalar(C.x),p.copy(d.binormals[G]).multiplyScalar(C.y),m.copy(u[G]).add(f).add(p),W(m.x,m.y,m.z)):W(C.x,C.y,i/c*G);for(S=h-1;0<=S;S--){for(L=S/h,R=a*Math.cos(L*Math.PI/2),A=o*Math.sin(L*Math.PI/2),U=0,D=E.length;U<D;U++)W((C=T(E[U],B[U],A)).x,C.y,i+R);for(v=0,y=_.length;v<y;v++)for(g=_[v],z=k[v],U=0,D=g.length;U<D;U++)C=T(g[U],z[U],A),x?W(C.x,C.y+u[c-1].y,u[c-1].x+R):W(C.x,C.y,i+R)}function j(e,t){var i,n;for(U=e.length;0<=--U;){(n=(i=U)-1)<0&&(n=e.length-1);var r=0,a=c+2*h;for(r=0;r<a;r++){var o=O*r,s=O*(r+1);q(t+i+o,t+n+o,t+n+s,t+i+s)}}}function W(e,t,i){n.push(e),n.push(t),n.push(i)}function X(e,t,i){Y(e),Y(t),Y(i);var n=K.length/3,r=l.generateTopUV(Q,K,n-3,n-2,n-1);Z(r[0]),Z(r[1]),Z(r[2])}function q(e,t,i,n){Y(e),Y(t),Y(n),Y(t),Y(i),Y(n);var r=K.length/3,a=l.generateSideWallUV(Q,K,r-6,r-3,r-2,r-1);Z(a[0]),Z(a[1]),Z(a[3]),Z(a[1]),Z(a[2]),Z(a[3])}function Y(e){K.push(n[3*e+0]),K.push(n[3*e+1]),K.push(n[3*e+2])}function Z(e){$.push(e.x),$.push(e.y)}!function(){var e=K.length/3;if(r){var t=0,i=O*t;for(U=0;U<I;U++)X((P=M[U])[2]+i,P[1]+i,P[0]+i);for(i=O*(t=c+2*h),U=0;U<I;U++)X((P=M[U])[0]+i,P[1]+i,P[2]+i)}else{for(U=0;U<I;U++)X((P=M[U])[2],P[1],P[0]);for(U=0;U<I;U++)X((P=M[U])[0]+O*c,P[1]+O*c,P[2]+O*c)}Q.addGroup(e,K.length/3-e,0)}(),function(){var e=K.length/3,t=0;for(j(E,t),t+=E.length,v=0,y=_.length;v<y;v++)j(g=_[v],t),t+=g.length;Q.addGroup(e,K.length/3-e,1)}()}this.addAttribute("position",new pn(K,3)),this.addAttribute("uv",new pn($,2)),this.computeVertexNormals()}(ys.prototype=Object.create(rn.prototype)).constructor=ys,(xs.prototype=Object.create(Ln.prototype)).constructor=xs;var ws={generateTopUV:function(e,t,i,n,r){var a=t[3*i],o=t[3*i+1],s=t[3*n],c=t[3*n+1],h=t[3*r],l=t[3*r+1];return[new Dt(a,o),new Dt(s,c),new Dt(h,l)]},generateSideWallUV:function(e,t,i,n,r,a){var o=t[3*i],s=t[3*i+1],c=t[3*i+2],h=t[3*n],l=t[3*n+1],u=t[3*n+2],d=t[3*r],p=t[3*r+1],f=t[3*r+2],m=t[3*a],g=t[3*a+1],v=t[3*a+2];return Math.abs(s-l)<.01?[new Dt(o,1-c),new Dt(h,1-u),new Dt(d,1-f),new Dt(m,1-v)]:[new Dt(s,1-c),new Dt(l,1-u),new Dt(p,1-f),new Dt(g,1-v)]}};function bs(e,t){rn.call(this),this.type="TextGeometry",this.parameters={text:e,parameters:t},this.fromBufferGeometry(new _s(e,t)),this.mergeVertices()}function _s(e,t){var i=(t=t||{}).font;if(!i||!i.isFont)return console.error("THREE.TextGeometry: font parameter is not an instance of THREE.Font."),new rn;var n=i.generateShapes(e,t.size,t.curveSegments);t.depth=void 0!==t.height?t.height:50,void 0===t.bevelThickness&&(t.bevelThickness=10),void 0===t.bevelSize&&(t.bevelSize=8),void 0===t.bevelEnabled&&(t.bevelEnabled=!1),xs.call(this,n,t),this.type="TextBufferGeometry"}function Ms(e,t,i,n,r,a,o){rn.call(this),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:n,phiLength:r,thetaStart:a,thetaLength:o},this.fromBufferGeometry(new Es(e,t,i,n,r,a,o)),this.mergeVertices()}function Es(e,t,i,n,r,a,o){Ln.call(this),this.type="SphereBufferGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:n,phiLength:r,thetaStart:a,thetaLength:o},e=e||1,t=Math.max(3,Math.floor(t)||8),i=Math.max(2,Math.floor(i)||6),n=void 0!==n?n:0,r=void 0!==r?r:2*Math.PI;var s,c,h=(a=void 0!==a?a:0)+(o=void 0!==o?o:Math.PI),l=0,u=[],d=new zt,p=new zt,f=[],m=[],g=[],v=[];for(c=0;c<=i;c++){var y=[],x=c/i;for(s=0;s<=t;s++){var w=s/t;d.x=-e*Math.cos(n+w*r)*Math.sin(a+x*o),d.y=e*Math.cos(a+x*o),d.z=e*Math.sin(n+w*r)*Math.sin(a+x*o),m.push(d.x,d.y,d.z),p.set(d.x,d.y,d.z).normalize(),g.push(p.x,p.y,p.z),v.push(w,1-x),y.push(l++)}u.push(y)}for(c=0;c<i;c++)for(s=0;s<t;s++){var b=u[c][s+1],_=u[c][s],M=u[c+1][s],E=u[c+1][s+1];(0!==c||0<a)&&f.push(b,_,E),(c!==i-1||h<Math.PI)&&f.push(_,M,E)}this.setIndex(f),this.addAttribute("position",new pn(m,3)),this.addAttribute("normal",new pn(g,3)),this.addAttribute("uv",new pn(v,2))}function Ts(e,t,i,n,r,a){rn.call(this),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:i,phiSegments:n,thetaStart:r,thetaLength:a},this.fromBufferGeometry(new Ss(e,t,i,n,r,a)),this.mergeVertices()}function Ss(e,t,i,n,r,a){Ln.call(this),this.type="RingBufferGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:i,phiSegments:n,thetaStart:r,thetaLength:a},e=e||.5,t=t||1,r=void 0!==r?r:0,a=void 0!==a?a:2*Math.PI,i=void 0!==i?Math.max(3,i):8;var o,s,c,h=[],l=[],u=[],d=[],p=e,f=(t-e)/(n=void 0!==n?Math.max(1,n):1),m=new zt,g=new Dt;for(s=0;s<=n;s++){for(c=0;c<=i;c++)o=r+c/i*a,m.x=p*Math.cos(o),m.y=p*Math.sin(o),l.push(m.x,m.y,m.z),u.push(0,0,1),g.x=(m.x/t+1)/2,g.y=(m.y/t+1)/2,d.push(g.x,g.y);p+=f}for(s=0;s<n;s++){var v=s*(i+1);for(c=0;c<i;c++){var y=o=c+v,x=o+i+1,w=o+i+2,b=o+1;h.push(y,x,b),h.push(x,w,b)}}this.setIndex(h),this.addAttribute("position",new pn(l,3)),this.addAttribute("normal",new pn(u,3)),this.addAttribute("uv",new pn(d,2))}function As(e,t,i,n){rn.call(this),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:i,phiLength:n},this.fromBufferGeometry(new Ls(e,t,i,n)),this.mergeVertices()}function Ls(e,t,i,n){Ln.call(this),this.type="LatheBufferGeometry",this.parameters={points:e,segments:t,phiStart:i,phiLength:n},t=Math.floor(t)||12,i=i||0,n=n||2*Math.PI,n=Ut.clamp(n,0,2*Math.PI);var r,a,o,s=[],c=[],h=[],l=1/t,u=new zt,d=new Dt;for(a=0;a<=t;a++){var p=i+a*l*n,f=Math.sin(p),m=Math.cos(p);for(o=0;o<=e.length-1;o++)u.x=e[o].x*f,u.y=e[o].y,u.z=e[o].x*m,c.push(u.x,u.y,u.z),d.x=a/t,d.y=o/(e.length-1),h.push(d.x,d.y)}for(a=0;a<t;a++)for(o=0;o<e.length-1;o++){var g=r=o+a*e.length,v=r+e.length,y=r+e.length+1,x=r+1;s.push(g,v,x),s.push(v,y,x)}if(this.setIndex(s),this.addAttribute("position",new pn(c,3)),this.addAttribute("uv",new pn(h,2)),this.computeVertexNormals(),n===2*Math.PI){var w=this.attributes.normal.array,b=new zt,_=new zt,M=new zt;for(r=t*e.length*3,o=a=0;a<e.length;a++,o+=3)b.x=w[o+0],b.y=w[o+1],b.z=w[o+2],_.x=w[r+o+0],_.y=w[r+o+1],_.z=w[r+o+2],M.addVectors(b,_).normalize(),w[o+0]=w[r+o+0]=M.x,w[o+1]=w[r+o+1]=M.y,w[o+2]=w[r+o+2]=M.z}}function Rs(e,t){rn.call(this),this.type="ShapeGeometry","object"==typeof t&&(console.warn("THREE.ShapeGeometry: Options parameter has been removed."),t=t.curveSegments),this.parameters={shapes:e,curveSegments:t},this.fromBufferGeometry(new Cs(e,t)),this.mergeVertices()}function Cs(e,f){Ln.call(this),this.type="ShapeBufferGeometry",this.parameters={shapes:e,curveSegments:f},f=f||12;var m=[],g=[],v=[],y=[],t=0,x=0;if(!1===Array.isArray(e))n(e);else for(var i=0;i<e.length;i++)n(e[i]),this.addGroup(t,x,i),t+=x,x=0;function n(e){var t,i,n,r=g.length/3,a=e.extractPoints(f),o=a.shape,s=a.holes;if(!1===ms.isClockWise(o))for(o=o.reverse(),t=0,i=s.length;t<i;t++)n=s[t],!0===ms.isClockWise(n)&&(s[t]=n.reverse());var c=ms.triangulateShape(o,s);for(t=0,i=s.length;t<i;t++)n=s[t],o=o.concat(n);for(t=0,i=o.length;t<i;t++){var h=o[t];g.push(h.x,h.y,0),v.push(0,0,1),y.push(h.x,h.y)}for(t=0,i=c.length;t<i;t++){var l=c[t],u=l[0]+r,d=l[1]+r,p=l[2]+r;m.push(u,d,p),x+=3}}this.setIndex(m),this.addAttribute("position",new pn(g,3)),this.addAttribute("normal",new pn(v,3)),this.addAttribute("uv",new pn(y,2))}function Ps(e,t){if(t.shapes=[],Array.isArray(e))for(var i=0,n=e.length;i<n;i++){var r=e[i];t.shapes.push(r.uuid)}else t.shapes.push(e.uuid);return t}function Os(e,t){Ln.call(this),this.type="EdgesGeometry",this.parameters={thresholdAngle:t},t=void 0!==t?t:1;var i,n,r,a,o=[],s=Math.cos(Ut.DEG2RAD*t),c=[0,0],h={},l=["a","b","c"];e.isBufferGeometry?(a=new rn).fromBufferGeometry(e):a=e.clone(),a.mergeVertices(),a.computeFaceNormals();for(var u=a.vertices,d=a.faces,p=0,f=d.length;p<f;p++)for(var m=d[p],g=0;g<3;g++)i=m[l[g]],n=m[l[(g+1)%3]],c[0]=Math.min(i,n),c[1]=Math.max(i,n),void 0===h[r=c[0]+","+c[1]]?h[r]={index1:c[0],index2:c[1],face1:p,face2:void 0}:h[r].face2=p;for(r in h){var v=h[r];if(void 0===v.face2||d[v.face1].normal.dot(d[v.face2].normal)<=s){var y=u[v.index1];o.push(y.x,y.y,y.z),y=u[v.index2],o.push(y.x,y.y,y.z)}}this.addAttribute("position",new pn(o,3))}function Is(e,t,i,n,r,a,o,s){rn.call(this),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:s},this.fromBufferGeometry(new Ns(e,t,i,n,r,a,o,s)),this.mergeVertices()}function Ns(v,y,x,w,b,e,_,M){Ln.call(this),this.type="CylinderBufferGeometry",this.parameters={radiusTop:v,radiusBottom:y,height:x,radialSegments:w,heightSegments:b,openEnded:e,thetaStart:_,thetaLength:M};var E=this;v=void 0!==v?v:1,y=void 0!==y?y:1,x=x||1,w=Math.floor(w)||8,b=Math.floor(b)||1,e=void 0!==e&&e,_=void 0!==_?_:0,M=void 0!==M?M:2*Math.PI;var T=[],S=[],A=[],L=[],R=0,C=[],P=x/2,O=0;function t(e){var t,i,n,r=new Dt,a=new zt,o=0,s=!0===e?v:y,c=!0===e?1:-1;for(i=R,t=1;t<=w;t++)S.push(0,P*c,0),A.push(0,c,0),L.push(.5,.5),R++;for(n=R,t=0;t<=w;t++){var h=t/w*M+_,l=Math.cos(h),u=Math.sin(h);a.x=s*u,a.y=P*c,a.z=s*l,S.push(a.x,a.y,a.z),A.push(0,c,0),r.x=.5*l+.5,r.y=.5*u*c+.5,L.push(r.x,r.y),R++}for(t=0;t<w;t++){var d=i+t,p=n+t;!0===e?T.push(p,p+1,d):T.push(p+1,p,d),o+=3}E.addGroup(O,o,!0===e?1:2),O+=o}!function(){var e,t,i=new zt,n=new zt,r=0,a=(y-v)/x;for(t=0;t<=b;t++){var o=[],s=t/b,c=s*(y-v)+v;for(e=0;e<=w;e++){var h=e/w,l=h*M+_,u=Math.sin(l),d=Math.cos(l);n.x=c*u,n.y=-s*x+P,n.z=c*d,S.push(n.x,n.y,n.z),i.set(u,a,d).normalize(),A.push(i.x,i.y,i.z),L.push(h,1-s),o.push(R++)}C.push(o)}for(e=0;e<w;e++)for(t=0;t<b;t++){var p=C[t][e],f=C[t+1][e],m=C[t+1][e+1],g=C[t][e+1];T.push(p,f,g),T.push(f,m,g),r+=6}E.addGroup(O,r,0),O+=r}(),!1===e&&(0<v&&t(!0),0<y&&t(!1)),this.setIndex(T),this.addAttribute("position",new pn(S,3)),this.addAttribute("normal",new pn(A,3)),this.addAttribute("uv",new pn(L,2))}function Bs(e,t,i,n,r,a,o){Is.call(this,0,e,t,i,n,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:n,openEnded:r,thetaStart:a,thetaLength:o}}function Us(e,t,i,n,r,a,o){Ns.call(this,0,e,t,i,n,r,a,o),this.type="ConeBufferGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:n,openEnded:r,thetaStart:a,thetaLength:o}}function Ds(e,t,i,n){rn.call(this),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:n},this.fromBufferGeometry(new Fs(e,t,i,n)),this.mergeVertices()}function Fs(e,t,i,n){Ln.call(this),this.type="CircleBufferGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:n},e=e||1,t=void 0!==t?Math.max(3,t):8,i=void 0!==i?i:0,n=void 0!==n?n:2*Math.PI;var r,a,o=[],s=[],c=[],h=[],l=new zt,u=new Dt;for(s.push(0,0,0),c.push(0,0,1),h.push(.5,.5),a=0,r=3;a<=t;a++,r+=3){var d=i+a/t*n;l.x=e*Math.cos(d),l.y=e*Math.sin(d),s.push(l.x,l.y,l.z),c.push(0,0,1),u.x=(s[r]/e+1)/2,u.y=(s[r+1]/e+1)/2,h.push(u.x,u.y)}for(r=1;r<=t;r++)o.push(r,r+1,0);this.setIndex(o),this.addAttribute("position",new pn(s,3)),this.addAttribute("normal",new pn(c,3)),this.addAttribute("uv",new pn(h,2))}(bs.prototype=Object.create(rn.prototype)).constructor=bs,(_s.prototype=Object.create(xs.prototype)).constructor=_s,(Ms.prototype=Object.create(rn.prototype)).constructor=Ms,(Es.prototype=Object.create(Ln.prototype)).constructor=Es,(Ts.prototype=Object.create(rn.prototype)).constructor=Ts,(Ss.prototype=Object.create(Ln.prototype)).constructor=Ss,(As.prototype=Object.create(rn.prototype)).constructor=As,(Ls.prototype=Object.create(Ln.prototype)).constructor=Ls,((Rs.prototype=Object.create(rn.prototype)).constructor=Rs).prototype.toJSON=function(){var e=rn.prototype.toJSON.call(this);return Ps(this.parameters.shapes,e)},((Cs.prototype=Object.create(Ln.prototype)).constructor=Cs).prototype.toJSON=function(){var e=Ln.prototype.toJSON.call(this);return Ps(this.parameters.shapes,e)},(Os.prototype=Object.create(Ln.prototype)).constructor=Os,(Is.prototype=Object.create(rn.prototype)).constructor=Is,(Ns.prototype=Object.create(Ln.prototype)).constructor=Ns,(Bs.prototype=Object.create(Is.prototype)).constructor=Bs,(Us.prototype=Object.create(Ns.prototype)).constructor=Us,(Ds.prototype=Object.create(rn.prototype)).constructor=Ds,(Fs.prototype=Object.create(Ln.prototype)).constructor=Fs;var Hs=Object.freeze({WireframeGeometry:Ro,ParametricGeometry:Co,ParametricBufferGeometry:Po,TetrahedronGeometry:No,TetrahedronBufferGeometry:Bo,OctahedronGeometry:Uo,OctahedronBufferGeometry:Do,IcosahedronGeometry:Fo,IcosahedronBufferGeometry:Ho,DodecahedronGeometry:zo,DodecahedronBufferGeometry:Go,PolyhedronGeometry:Oo,PolyhedronBufferGeometry:Io,TubeGeometry:ko,TubeBufferGeometry:Vo,TorusKnotGeometry:jo,TorusKnotBufferGeometry:Wo,TorusGeometry:Xo,TorusBufferGeometry:qo,TextGeometry:bs,TextBufferGeometry:_s,SphereGeometry:Ms,SphereBufferGeometry:Es,RingGeometry:Ts,RingBufferGeometry:Ss,PlaneGeometry:Pn,PlaneBufferGeometry:On,LatheGeometry:As,LatheBufferGeometry:Ls,ShapeGeometry:Rs,ShapeBufferGeometry:Cs,ExtrudeGeometry:ys,ExtrudeBufferGeometry:xs,EdgesGeometry:Os,ConeGeometry:Bs,ConeBufferGeometry:Us,CylinderGeometry:Is,CylinderBufferGeometry:Ns,CircleGeometry:Ds,CircleBufferGeometry:Fs,BoxGeometry:Rn,BoxBufferGeometry:Cn});function zs(e){rr.call(this),this.type="ShadowMaterial",this.color=new yi(0),this.transparent=!0,this.setValues(e)}function Gs(e){or.call(this,e),this.type="RawShaderMaterial"}function ks(e){rr.call(this),this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new yi(16777215),this.roughness=.5,this.metalness=.5,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new yi(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalScale=new Dt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}function Vs(e){ks.call(this),this.defines={PHYSICAL:""},this.type="MeshPhysicalMaterial",this.reflectivity=.5,this.clearCoat=0,this.clearCoatRoughness=0,this.setValues(e)}function js(e){rr.call(this),this.type="MeshPhongMaterial",this.color=new yi(16777215),this.specular=new yi(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new yi(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalScale=new Dt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=k,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}function Ws(e){js.call(this),this.defines={TOON:""},this.type="MeshToonMaterial",this.gradientMap=null,this.setValues(e)}function Xs(e){rr.call(this),this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalScale=new Dt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}function qs(e){rr.call(this),this.type="MeshLambertMaterial",this.color=new yi(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new yi(0),this.emissiveIntensity=1,this.emissiveMap=null,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=k,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}function Ys(e){xo.call(this),this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}((zs.prototype=Object.create(rr.prototype)).constructor=zs).prototype.isShadowMaterial=!0,zs.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this},((Gs.prototype=Object.create(or.prototype)).constructor=Gs).prototype.isRawShaderMaterial=!0,((ks.prototype=Object.create(rr.prototype)).constructor=ks).prototype.isMeshStandardMaterial=!0,ks.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this},((Vs.prototype=Object.create(ks.prototype)).constructor=Vs).prototype.isMeshPhysicalMaterial=!0,Vs.prototype.copy=function(e){return ks.prototype.copy.call(this,e),this.defines={PHYSICAL:""},this.reflectivity=e.reflectivity,this.clearCoat=e.clearCoat,this.clearCoatRoughness=e.clearCoatRoughness,this},((js.prototype=Object.create(rr.prototype)).constructor=js).prototype.isMeshPhongMaterial=!0,js.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this},((Ws.prototype=Object.create(js.prototype)).constructor=Ws).prototype.isMeshToonMaterial=!0,Ws.prototype.copy=function(e){return js.prototype.copy.call(this,e),this.gradientMap=e.gradientMap,this},((Xs.prototype=Object.create(rr.prototype)).constructor=Xs).prototype.isMeshNormalMaterial=!0,Xs.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this},((qs.prototype=Object.create(rr.prototype)).constructor=qs).prototype.isMeshLambertMaterial=!0,qs.prototype.copy=function(e){return rr.prototype.copy.call(this,e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this},((Ys.prototype=Object.create(xo.prototype)).constructor=Ys).prototype.isLineDashedMaterial=!0,Ys.prototype.copy=function(e){return xo.prototype.copy.call(this,e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this};var Zs=Object.freeze({ShadowMaterial:zs,SpriteMaterial:po,RawShaderMaterial:Gs,ShaderMaterial:or,PointsMaterial:Mo,MeshPhysicalMaterial:Vs,MeshStandardMaterial:ks,MeshPhongMaterial:js,MeshToonMaterial:Ws,MeshNormalMaterial:Xs,MeshLambertMaterial:qs,MeshDepthMaterial:Ja,MeshDistanceMaterial:Qa,MeshBasicMaterial:ar,LineDashedMaterial:Ys,LineBasicMaterial:xo,Material:rr}),Js={enabled:!1,files:{},add:function(e,t){!1!==this.enabled&&(this.files[e]=t)},get:function(e){if(!1!==this.enabled)return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function Qs(e,t,i){var n=this,r=!1,a=0,o=0,s=void 0;this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.itemStart=function(e){o++,!1===r&&void 0!==n.onStart&&n.onStart(e,a,o),r=!0},this.itemEnd=function(e){a++,void 0!==n.onProgress&&n.onProgress(e,a,o),a===o&&(r=!1,void 0!==n.onLoad&&n.onLoad())},this.itemError=function(e){void 0!==n.onError&&n.onError(e)},this.resolveURL=function(e){return s?s(e):e},this.setURLModifier=function(e){return s=e,this}}var Ks=new Qs,$s={};function ec(e){this.manager=void 0!==e?e:Ks}function tc(e){this.manager=void 0!==e?e:Ks,this._parser=null}function ic(e){this.manager=void 0!==e?e:Ks,this._parser=null}function nc(e){this.manager=void 0!==e?e:Ks}function rc(e){this.manager=void 0!==e?e:Ks}function ac(e){this.manager=void 0!==e?e:Ks}function oc(){this.type="Curve",this.arcLengthDivisions=200}function sc(e,t,i,n,r,a,o,s){oc.call(this),this.type="EllipseCurve",this.aX=e||0,this.aY=t||0,this.xRadius=i||1,this.yRadius=n||1,this.aStartAngle=r||0,this.aEndAngle=a||2*Math.PI,this.aClockwise=o||!1,this.aRotation=s||0}function cc(e,t,i,n,r,a){sc.call(this,e,t,i,i,n,r,a),this.type="ArcCurve"}function hc(){var r=0,a=0,o=0,s=0;function h(e,t,i,n){o=-3*(r=e)+3*t-2*(a=i)-n,s=2*e-2*t+i+n}return{initCatmullRom:function(e,t,i,n,r){h(t,i,r*(i-e),r*(n-t))},initNonuniformCatmullRom:function(e,t,i,n,r,a,o){var s=(t-e)/r-(i-e)/(r+a)+(i-t)/a,c=(i-t)/a-(n-t)/(a+o)+(n-i)/o;h(t,i,s*=a,c*=a)},calc:function(e){var t=e*e;return r+a*e+o*t+s*(t*e)}}}Object.assign(ec.prototype,{load:function(o,e,t,i){void 0===o&&(o=""),void 0!==this.path&&(o=this.path+o),o=this.manager.resolveURL(o);var s=this,n=Js.get(o);if(void 0!==n)return s.manager.itemStart(o),setTimeout(function(){e&&e(n),s.manager.itemEnd(o)},0),n;if(void 0===$s[o]){var r=o.match(/^data:(.*?)(;base64)?,(.*)$/);if(r){var a=r[1],c=!!r[2],h=r[3];h=window.decodeURIComponent(h),c&&(h=window.atob(h));try{var l,u=(this.responseType||"").toLowerCase();switch(u){case"arraybuffer":case"blob":for(var d=new Uint8Array(h.length),p=0;p<h.length;p++)d[p]=h.charCodeAt(p);l="blob"===u?new Blob([d.buffer],{type:a}):d.buffer;break;case"document":var f=new DOMParser;l=f.parseFromString(h,a);break;case"json":l=JSON.parse(h);break;default:l=h}window.setTimeout(function(){e&&e(l),s.manager.itemEnd(o)},0)}catch(e){window.setTimeout(function(){i&&i(e),s.manager.itemEnd(o),s.manager.itemError(o)},0)}}else{$s[o]=[],$s[o].push({onLoad:e,onProgress:t,onError:i});var m=new XMLHttpRequest;for(var g in m.open("GET",o,!0),m.addEventListener("load",function(e){var t=this.response;Js.add(o,t);var i=$s[o];if(delete $s[o],200===this.status||0===this.status){0===this.status&&console.warn("THREE.FileLoader: HTTP Status 0 received.");for(var n=0,r=i.length;n<r;n++){(a=i[n]).onLoad&&a.onLoad(t)}s.manager.itemEnd(o)}else{for(n=0,r=i.length;n<r;n++){var a;(a=i[n]).onError&&a.onError(e)}s.manager.itemEnd(o),s.manager.itemError(o)}},!1),m.addEventListener("progress",function(e){for(var t=$s[o],i=0,n=t.length;i<n;i++){var r=t[i];r.onProgress&&r.onProgress(e)}},!1),m.addEventListener("error",function(e){var t=$s[o];delete $s[o];for(var i=0,n=t.length;i<n;i++){var r=t[i];r.onError&&r.onError(e)}s.manager.itemEnd(o),s.manager.itemError(o)},!1),void 0!==this.responseType&&(m.responseType=this.responseType),void 0!==this.withCredentials&&(m.withCredentials=this.withCredentials),m.overrideMimeType&&m.overrideMimeType(void 0!==this.mimeType?this.mimeType:"text/plain"),this.requestHeader)m.setRequestHeader(g,this.requestHeader[g]);m.send(null)}return s.manager.itemStart(o),m}$s[o].push({onLoad:e,onProgress:t,onError:i})},setPath:function(e){return this.path=e,this},setResponseType:function(e){return this.responseType=e,this},setWithCredentials:function(e){return this.withCredentials=e,this},setMimeType:function(e){return this.mimeType=e,this},setRequestHeader:function(e){return this.requestHeader=e,this}}),Object.assign(tc.prototype,{load:function(e,a,t,n){var o=this,s=[],c=new Ao;c.image=s;var r=new ec(this.manager);function i(i){r.load(e[i],function(e){var t=o._parser(e,!0);s[i]={width:t.width,height:t.height,format:t.format,mipmaps:t.mipmaps},6===(h+=1)&&(1===t.mipmapCount&&(c.minFilter=Se),c.format=t.format,c.needsUpdate=!0,a&&a(c))},t,n)}if(r.setPath(this.path),r.setResponseType("arraybuffer"),Array.isArray(e))for(var h=0,l=0,u=e.length;l<u;++l)i(l);else r.load(e,function(e){var t=o._parser(e,!0);if(t.isCubemap)for(var i=t.mipmaps.length/t.mipmapCount,n=0;n<i;n++){s[n]={mipmaps:[]};for(var r=0;r<t.mipmapCount;r++)s[n].mipmaps.push(t.mipmaps[n*t.mipmapCount+r]),s[n].format=t.format,s[n].width=t.width,s[n].height=t.height}else c.image.width=t.width,c.image.height=t.height,c.mipmaps=t.mipmaps;1===t.mipmapCount&&(c.minFilter=Se),c.format=t.format,c.needsUpdate=!0,a&&a(c)},t,n);return c},setPath:function(e){return this.path=e,this}}),Object.assign(ic.prototype,{load:function(e,i,t,n){var r=this,a=new hi,o=new ec(this.manager);return o.setResponseType("arraybuffer"),o.load(e,function(e){var t=r._parser(e);t&&(void 0!==t.image?a.image=t.image:void 0!==t.data&&(a.image.width=t.width,a.image.height=t.height,a.image.data=t.data),a.wrapS=void 0!==t.wrapS?t.wrapS:be,a.wrapT=void 0!==t.wrapT?t.wrapT:be,a.magFilter=void 0!==t.magFilter?t.magFilter:Se,a.minFilter=void 0!==t.minFilter?t.minFilter:Pe,a.anisotropy=void 0!==t.anisotropy?t.anisotropy:1,void 0!==t.format&&(a.format=t.format),void 0!==t.type&&(a.type=t.type),void 0!==t.mipmaps&&(a.mipmaps=t.mipmaps),1===t.mipmapCount&&(a.minFilter=Se),a.needsUpdate=!0,i&&i(a,t))},t,n),a}}),Object.assign(nc.prototype,{crossOrigin:"Anonymous",load:function(t,e,i,n){void 0===t&&(t=""),void 0!==this.path&&(t=this.path+t),t=this.manager.resolveURL(t);var r=this,a=Js.get(t);if(void 0!==a)return r.manager.itemStart(t),setTimeout(function(){e&&e(a),r.manager.itemEnd(t)},0),a;var o=document.createElementNS("http://www.w3.org/1999/xhtml","img");return o.addEventListener("load",function(){Js.add(t,this),e&&e(this),r.manager.itemEnd(t)},!1),o.addEventListener("error",function(e){n&&n(e),r.manager.itemEnd(t),r.manager.itemError(t)},!1),"data:"!==t.substr(0,5)&&void 0!==this.crossOrigin&&(o.crossOrigin=this.crossOrigin),r.manager.itemStart(t),o.src=t,o},setCrossOrigin:function(e){return this.crossOrigin=e,this},setPath:function(e){return this.path=e,this}}),Object.assign(rc.prototype,{crossOrigin:"Anonymous",load:function(e,i,t,n){var r=new _r,a=new nc(this.manager);a.setCrossOrigin(this.crossOrigin),a.setPath(this.path);var o=0;function s(t){a.load(e[t],function(e){r.images[t]=e,6===++o&&(r.needsUpdate=!0,i&&i(r))},void 0,n)}for(var c=0;c<e.length;++c)s(c);return r},setCrossOrigin:function(e){return this.crossOrigin=e,this},setPath:function(e){return this.path=e,this}}),Object.assign(ac.prototype,{crossOrigin:"Anonymous",load:function(i,n,e,t){var r=new ai,a=new nc(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(i,function(e){r.image=e;var t=0<i.search(/\.(jpg|jpeg)$/)||0===i.search(/^data\:image\/jpeg/);r.format=t?We:Xe,r.needsUpdate=!0,void 0!==n&&n(r)},e,t),r},setCrossOrigin:function(e){return this.crossOrigin=e,this},setPath:function(e){return this.path=e,this}}),Object.assign(oc.prototype,{getPoint:function(){return console.warn("THREE.Curve: .getPoint() not implemented."),null},getPointAt:function(e,t){var i=this.getUtoTmapping(e);return this.getPoint(i,t)},getPoints:function(e){void 0===e&&(e=5);for(var t=[],i=0;i<=e;i++)t.push(this.getPoint(i/e));return t},getSpacedPoints:function(e){void 0===e&&(e=5);for(var t=[],i=0;i<=e;i++)t.push(this.getPointAt(i/e));return t},getLength:function(){var e=this.getLengths();return e[e.length-1]},getLengths:function(e){if(void 0===e&&(e=this.arcLengthDivisions),this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;var t,i,n=[],r=this.getPoint(0),a=0;for(n.push(0),i=1;i<=e;i++)a+=(t=this.getPoint(i/e)).distanceTo(r),n.push(a),r=t;return this.cacheArcLengths=n},updateArcLengths:function(){this.needsUpdate=!0,this.getLengths()},getUtoTmapping:function(e,t){var i,n=this.getLengths(),r=0,a=n.length;i=t||e*n[a-1];for(var o,s=0,c=a-1;s<=c;)if((o=n[r=Math.floor(s+(c-s)/2)]-i)<0)s=r+1;else{if(!(0<o)){c=r;break}c=r-1}if(n[r=c]===i)return r/(a-1);var h=n[r];return(r+(i-h)/(n[r+1]-h))/(a-1)},getTangent:function(e){var t=e-1e-4,i=e+1e-4;t<0&&(t=0),1<i&&(i=1);var n=this.getPoint(t);return this.getPoint(i).clone().sub(n).normalize()},getTangentAt:function(e){var t=this.getUtoTmapping(e);return this.getTangent(t)},computeFrenetFrames:function(e,t){var i,n,r,a=new zt,o=[],s=[],c=[],h=new zt,l=new Ft;for(i=0;i<=e;i++)n=i/e,o[i]=this.getTangentAt(n),o[i].normalize();s[0]=new zt,c[0]=new zt;var u=Number.MAX_VALUE,d=Math.abs(o[0].x),p=Math.abs(o[0].y),f=Math.abs(o[0].z);for(d<=u&&(u=d,a.set(1,0,0)),p<=u&&(u=p,a.set(0,1,0)),f<=u&&a.set(0,0,1),h.crossVectors(o[0],a).normalize(),s[0].crossVectors(o[0],h),c[0].crossVectors(o[0],s[0]),i=1;i<=e;i++)s[i]=s[i-1].clone(),c[i]=c[i-1].clone(),h.crossVectors(o[i-1],o[i]),h.length()>Number.EPSILON&&(h.normalize(),r=Math.acos(Ut.clamp(o[i-1].dot(o[i]),-1,1)),s[i].applyMatrix4(l.makeRotationAxis(h,r))),c[i].crossVectors(o[i],s[i]);if(!0===t)for(r=Math.acos(Ut.clamp(s[0].dot(s[e]),-1,1)),r/=e,0<o[0].dot(h.crossVectors(s[0],s[e]))&&(r=-r),i=1;i<=e;i++)s[i].applyMatrix4(l.makeRotationAxis(o[i],r*i)),c[i].crossVectors(o[i],s[i]);return{tangents:o,normals:s,binormals:c}},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.arcLengthDivisions=e.arcLengthDivisions,this},toJSON:function(){var e={metadata:{version:4.5,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e},fromJSON:function(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}),((sc.prototype=Object.create(oc.prototype)).constructor=sc).prototype.isEllipseCurve=!0,sc.prototype.getPoint=function(e,t){for(var i=t||new Dt,n=2*Math.PI,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;r<0;)r+=n;for(;n<r;)r-=n;r<Number.EPSILON&&(r=a?0:n),!0!==this.aClockwise||a||(r===n?r=-n:r-=n);var o=this.aStartAngle+e*r,s=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(0!==this.aRotation){var h=Math.cos(this.aRotation),l=Math.sin(this.aRotation),u=s-this.aX,d=c-this.aY;s=u*h-d*l+this.aX,c=u*l+d*h+this.aY}return i.set(s,c)},sc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this},sc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e},sc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this},((cc.prototype=Object.create(sc.prototype)).constructor=cc).prototype.isArcCurve=!0;var lc=new zt,uc=new hc,dc=new hc,pc=new hc;function fc(e,t,i,n){oc.call(this),this.type="CatmullRomCurve3",this.points=e||[],this.closed=t||!1,this.curveType=i||"centripetal",this.tension=n||.5}function mc(e,t,i,n,r){var a=.5*(n-t),o=.5*(r-i),s=e*e;return(2*i-2*n+a+o)*(e*s)+(-3*i+3*n-2*a-o)*s+a*e+i}function gc(e,t,i,n){return(o=1-e)*o*t+2*(1-(a=e))*a*i+(r=e)*r*n;var r,a,o}function vc(e,t,i,n,r){return(h=1-e)*h*h*t+3*(c=1-(s=e))*c*s*i+3*(1-(o=e))*o*o*n+(a=e)*a*a*r;var a,o,s,c,h}function yc(e,t,i,n){oc.call(this),this.type="CubicBezierCurve",this.v0=e||new Dt,this.v1=t||new Dt,this.v2=i||new Dt,this.v3=n||new Dt}function xc(e,t,i,n){oc.call(this),this.type="CubicBezierCurve3",this.v0=e||new zt,this.v1=t||new zt,this.v2=i||new zt,this.v3=n||new zt}function wc(e,t){oc.call(this),this.type="LineCurve",this.v1=e||new Dt,this.v2=t||new Dt}function bc(e,t){oc.call(this),this.type="LineCurve3",this.v1=e||new zt,this.v2=t||new zt}function _c(e,t,i){oc.call(this),this.type="QuadraticBezierCurve",this.v0=e||new Dt,this.v1=t||new Dt,this.v2=i||new Dt}function Mc(e,t,i){oc.call(this),this.type="QuadraticBezierCurve3",this.v0=e||new zt,this.v1=t||new zt,this.v2=i||new zt}function Ec(e){oc.call(this),this.type="SplineCurve",this.points=e||[]}((fc.prototype=Object.create(oc.prototype)).constructor=fc).prototype.isCatmullRomCurve3=!0,fc.prototype.getPoint=function(e,t){var i,n,r,a,o=t||new zt,s=this.points,c=s.length,h=(c-(this.closed?0:1))*e,l=Math.floor(h),u=h-l;if(this.closed?l+=0<l?0:(Math.floor(Math.abs(l)/c)+1)*c:0===u&&l===c-1&&(l=c-2,u=1),this.closed||0<l?i=s[(l-1)%c]:(lc.subVectors(s[0],s[1]).add(s[0]),i=lc),n=s[l%c],r=s[(l+1)%c],this.closed||l+2<c?a=s[(l+2)%c]:(lc.subVectors(s[c-1],s[c-2]).add(s[c-1]),a=lc),"centripetal"===this.curveType||"chordal"===this.curveType){var d="chordal"===this.curveType?.5:.25,p=Math.pow(i.distanceToSquared(n),d),f=Math.pow(n.distanceToSquared(r),d),m=Math.pow(r.distanceToSquared(a),d);f<1e-4&&(f=1),p<1e-4&&(p=f),m<1e-4&&(m=f),uc.initNonuniformCatmullRom(i.x,n.x,r.x,a.x,p,f,m),dc.initNonuniformCatmullRom(i.y,n.y,r.y,a.y,p,f,m),pc.initNonuniformCatmullRom(i.z,n.z,r.z,a.z,p,f,m)}else"catmullrom"===this.curveType&&(uc.initCatmullRom(i.x,n.x,r.x,a.x,this.tension),dc.initCatmullRom(i.y,n.y,r.y,a.y,this.tension),pc.initCatmullRom(i.z,n.z,r.z,a.z,this.tension));return o.set(uc.calc(u),dc.calc(u),pc.calc(u)),o},fc.prototype.copy=function(e){oc.prototype.copy.call(this,e),this.points=[];for(var t=0,i=e.points.length;t<i;t++){var n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this},fc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);e.points=[];for(var t=0,i=this.points.length;t<i;t++){var n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e},fc.prototype.fromJSON=function(e){oc.prototype.fromJSON.call(this,e),this.points=[];for(var t=0,i=e.points.length;t<i;t++){var n=e.points[t];this.points.push((new zt).fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this},((yc.prototype=Object.create(oc.prototype)).constructor=yc).prototype.isCubicBezierCurve=!0,yc.prototype.getPoint=function(e,t){var i=t||new Dt,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(vc(e,n.x,r.x,a.x,o.x),vc(e,n.y,r.y,a.y,o.y)),i},yc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this},yc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e},yc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this},((xc.prototype=Object.create(oc.prototype)).constructor=xc).prototype.isCubicBezierCurve3=!0,xc.prototype.getPoint=function(e,t){var i=t||new zt,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(vc(e,n.x,r.x,a.x,o.x),vc(e,n.y,r.y,a.y,o.y),vc(e,n.z,r.z,a.z,o.z)),i},xc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this},xc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e},xc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this},((wc.prototype=Object.create(oc.prototype)).constructor=wc).prototype.isLineCurve=!0,wc.prototype.getPoint=function(e,t){var i=t||new Dt;return 1===e?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i},wc.prototype.getPointAt=function(e,t){return this.getPoint(e,t)},wc.prototype.getTangent=function(){return this.v2.clone().sub(this.v1).normalize()},wc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v1.copy(e.v1),this.v2.copy(e.v2),this},wc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e},wc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this},((bc.prototype=Object.create(oc.prototype)).constructor=bc).prototype.isLineCurve3=!0,bc.prototype.getPoint=function(e,t){var i=t||new zt;return 1===e?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i},bc.prototype.getPointAt=function(e,t){return this.getPoint(e,t)},bc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v1.copy(e.v1),this.v2.copy(e.v2),this},bc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e},bc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this},((_c.prototype=Object.create(oc.prototype)).constructor=_c).prototype.isQuadraticBezierCurve=!0,_c.prototype.getPoint=function(e,t){var i=t||new Dt,n=this.v0,r=this.v1,a=this.v2;return i.set(gc(e,n.x,r.x,a.x),gc(e,n.y,r.y,a.y)),i},_c.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this},_c.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e},_c.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this},((Mc.prototype=Object.create(oc.prototype)).constructor=Mc).prototype.isQuadraticBezierCurve3=!0,Mc.prototype.getPoint=function(e,t){var i=t||new zt,n=this.v0,r=this.v1,a=this.v2;return i.set(gc(e,n.x,r.x,a.x),gc(e,n.y,r.y,a.y),gc(e,n.z,r.z,a.z)),i},Mc.prototype.copy=function(e){return oc.prototype.copy.call(this,e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this},Mc.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e},Mc.prototype.fromJSON=function(e){return oc.prototype.fromJSON.call(this,e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this},((Ec.prototype=Object.create(oc.prototype)).constructor=Ec).prototype.isSplineCurve=!0,Ec.prototype.getPoint=function(e,t){var i=t||new Dt,n=this.points,r=(n.length-1)*e,a=Math.floor(r),o=r-a,s=n[0===a?a:a-1],c=n[a],h=n[a>n.length-2?n.length-1:a+1],l=n[a>n.length-3?n.length-1:a+2];return i.set(mc(o,s.x,c.x,h.x,l.x),mc(o,s.y,c.y,h.y,l.y)),i},Ec.prototype.copy=function(e){oc.prototype.copy.call(this,e),this.points=[];for(var t=0,i=e.points.length;t<i;t++){var n=e.points[t];this.points.push(n.clone())}return this},Ec.prototype.toJSON=function(){var e=oc.prototype.toJSON.call(this);e.points=[];for(var t=0,i=this.points.length;t<i;t++){var n=this.points[t];e.points.push(n.toArray())}return e},Ec.prototype.fromJSON=function(e){oc.prototype.fromJSON.call(this,e),this.points=[];for(var t=0,i=e.points.length;t<i;t++){var n=e.points[t];this.points.push((new Dt).fromArray(n))}return this};var Tc=Object.freeze({ArcCurve:cc,CatmullRomCurve3:fc,CubicBezierCurve:yc,CubicBezierCurve3:xc,EllipseCurve:sc,LineCurve:wc,LineCurve3:bc,QuadraticBezierCurve:_c,QuadraticBezierCurve3:Mc,SplineCurve:Ec});function Sc(){oc.call(this),this.type="CurvePath",this.curves=[],this.autoClose=!1}function Ac(e){Sc.call(this),this.type="Path",this.currentPoint=new Dt,e&&this.setFromPoints(e)}function Lc(e){Ac.call(this,e),this.uuid=Ut.generateUUID(),this.type="Shape",this.holes=[]}function Rc(e,t){Wi.call(this),this.type="Light",this.color=new yi(e),this.intensity=void 0!==t?t:1,this.receiveShadow=void 0}function Cc(e,t,i){Rc.call(this,e,i),this.type="HemisphereLight",this.castShadow=void 0,this.position.copy(Wi.DefaultUp),this.updateMatrix(),this.groundColor=new yi(t)}function Pc(e){this.camera=e,this.bias=0,this.radius=1,this.mapSize=new Dt(512,512),this.map=null,this.matrix=new Ft}function Oc(){Pc.call(this,new ro(50,1,.5,500))}function Ic(e,t,i,n,r,a){Rc.call(this,e,t),this.type="SpotLight",this.position.copy(Wi.DefaultUp),this.updateMatrix(),this.target=new Wi,Object.defineProperty(this,"power",{get:function(){return this.intensity*Math.PI},set:function(e){this.intensity=e/Math.PI}}),this.distance=void 0!==i?i:0,this.angle=void 0!==n?n:Math.PI/3,this.penumbra=void 0!==r?r:0,this.decay=void 0!==a?a:1,this.shadow=new Oc}function Nc(e,t,i,n){Rc.call(this,e,t),this.type="PointLight",Object.defineProperty(this,"power",{get:function(){return 4*this.intensity*Math.PI},set:function(e){this.intensity=e/(4*Math.PI)}}),this.distance=void 0!==i?i:0,this.decay=void 0!==n?n:1,this.shadow=new Pc(new ro(90,1,.5,500))}function Bc(){Pc.call(this,new qi(-5,5,5,-5,.5,500))}function Uc(e,t){Rc.call(this,e,t),this.type="DirectionalLight",this.position.copy(Wi.DefaultUp),this.updateMatrix(),this.target=new Wi,this.shadow=new Bc}function Dc(e,t){Rc.call(this,e,t),this.type="AmbientLight",this.castShadow=void 0}function Fc(e,t,i,n){Rc.call(this,e,t),this.type="RectAreaLight",this.width=void 0!==i?i:10,this.height=void 0!==n?n:10}function Hc(e,t,i,n){Jc.call(this,e,t,i,n)}function zc(e,t,i){Jc.call(this,e,t,i)}function Gc(e,t,i,n){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=void 0!==n?n:new t.constructor(i),this.sampleValues=t,this.valueSize=i}function kc(e,t,i,n){Gc.call(this,e,t,i,n)}function Vc(e,t,i,n){Jc.call(this,e,t,i,n)}function jc(e,t,i,n){Jc.call(this,e,t,i,n)}function Wc(e,t,i,n){Jc.call(this,e,t,i,n)}function Xc(e,t,i,n){Gc.call(this,e,t,i,n),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0}function qc(e,t,i,n){Gc.call(this,e,t,i,n)}function Yc(e,t,i,n){Gc.call(this,e,t,i,n)}Sc.prototype=Object.assign(Object.create(oc.prototype),{constructor:Sc,add:function(e){this.curves.push(e)},closePath:function(){var e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);e.equals(t)||this.curves.push(new wc(t,e))},getPoint:function(e){for(var t=e*this.getLength(),i=this.getCurveLengths(),n=0;n<i.length;){if(i[n]>=t){var r=i[n]-t,a=this.curves[n],o=a.getLength(),s=0===o?0:1-r/o;return a.getPointAt(s)}n++}return null},getLength:function(){var e=this.getCurveLengths();return e[e.length-1]},updateArcLengths:function(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()},getCurveLengths:function(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;for(var e=[],t=0,i=0,n=this.curves.length;i<n;i++)t+=this.curves[i].getLength(),e.push(t);return this.cacheLengths=e},getSpacedPoints:function(e){void 0===e&&(e=40);for(var t=[],i=0;i<=e;i++)t.push(this.getPoint(i/e));return this.autoClose&&t.push(t[0]),t},getPoints:function(e){e=e||12;for(var t,i=[],n=0,r=this.curves;n<r.length;n++)for(var a=r[n],o=a&&a.isEllipseCurve?2*e:a&&a.isLineCurve?1:a&&a.isSplineCurve?e*a.points.length:e,s=a.getPoints(o),c=0;c<s.length;c++){var h=s[c];t&&t.equals(h)||(i.push(h),t=h)}return this.autoClose&&1<i.length&&!i[i.length-1].equals(i[0])&&i.push(i[0]),i},copy:function(e){oc.prototype.copy.call(this,e),this.curves=[];for(var t=0,i=e.curves.length;t<i;t++){var n=e.curves[t];this.curves.push(n.clone())}return this.autoClose=e.autoClose,this},toJSON:function(){var e=oc.prototype.toJSON.call(this);e.autoClose=this.autoClose,e.curves=[];for(var t=0,i=this.curves.length;t<i;t++){var n=this.curves[t];e.curves.push(n.toJSON())}return e},fromJSON:function(e){oc.prototype.fromJSON.call(this,e),this.autoClose=e.autoClose,this.curves=[];for(var t=0,i=e.curves.length;t<i;t++){var n=e.curves[t];this.curves.push((new Tc[n.type]).fromJSON(n))}return this}}),Ac.prototype=Object.assign(Object.create(Sc.prototype),{constructor:Ac,setFromPoints:function(e){this.moveTo(e[0].x,e[0].y);for(var t=1,i=e.length;t<i;t++)this.lineTo(e[t].x,e[t].y)},moveTo:function(e,t){this.currentPoint.set(e,t)},lineTo:function(e,t){var i=new wc(this.currentPoint.clone(),new Dt(e,t));this.curves.push(i),this.currentPoint.set(e,t)},quadraticCurveTo:function(e,t,i,n){var r=new _c(this.currentPoint.clone(),new Dt(e,t),new Dt(i,n));this.curves.push(r),this.currentPoint.set(i,n)},bezierCurveTo:function(e,t,i,n,r,a){var o=new yc(this.currentPoint.clone(),new Dt(e,t),new Dt(i,n),new Dt(r,a));this.curves.push(o),this.currentPoint.set(r,a)},splineThru:function(e){var t=new Ec([this.currentPoint.clone()].concat(e));this.curves.push(t),this.currentPoint.copy(e[e.length-1])},arc:function(e,t,i,n,r,a){var o=this.currentPoint.x,s=this.currentPoint.y;this.absarc(e+o,t+s,i,n,r,a)},absarc:function(e,t,i,n,r,a){this.absellipse(e,t,i,i,n,r,a)},ellipse:function(e,t,i,n,r,a,o,s){var c=this.currentPoint.x,h=this.currentPoint.y;this.absellipse(e+c,t+h,i,n,r,a,o,s)},absellipse:function(e,t,i,n,r,a,o,s){var c=new sc(e,t,i,n,r,a,o,s);if(0<this.curves.length){var h=c.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(c);var l=c.getPoint(1);this.currentPoint.copy(l)},copy:function(e){return Sc.prototype.copy.call(this,e),this.currentPoint.copy(e.currentPoint),this},toJSON:function(){var e=Sc.prototype.toJSON.call(this);return e.currentPoint=this.currentPoint.toArray(),e},fromJSON:function(e){return Sc.prototype.fromJSON.call(this,e),this.currentPoint.fromArray(e.currentPoint),this}}),Lc.prototype=Object.assign(Object.create(Ac.prototype),{constructor:Lc,getPointsHoles:function(e){for(var t=[],i=0,n=this.holes.length;i<n;i++)t[i]=this.holes[i].getPoints(e);return t},extractPoints:function(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}},copy:function(e){Ac.prototype.copy.call(this,e),this.holes=[];for(var t=0,i=e.holes.length;t<i;t++){var n=e.holes[t];this.holes.push(n.clone())}return this},toJSON:function(){var e=Ac.prototype.toJSON.call(this);e.uuid=this.uuid,e.holes=[];for(var t=0,i=this.holes.length;t<i;t++){var n=this.holes[t];e.holes.push(n.toJSON())}return e},fromJSON:function(e){Ac.prototype.fromJSON.call(this,e),this.uuid=e.uuid,this.holes=[];for(var t=0,i=e.holes.length;t<i;t++){var n=e.holes[t];this.holes.push((new Ac).fromJSON(n))}return this}}),Rc.prototype=Object.assign(Object.create(Wi.prototype),{constructor:Rc,isLight:!0,copy:function(e){return Wi.prototype.copy.call(this,e),this.color.copy(e.color),this.intensity=e.intensity,this},toJSON:function(e){var t=Wi.prototype.toJSON.call(this,e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,void 0!==this.groundColor&&(t.object.groundColor=this.groundColor.getHex()),void 0!==this.distance&&(t.object.distance=this.distance),void 0!==this.angle&&(t.object.angle=this.angle),void 0!==this.decay&&(t.object.decay=this.decay),void 0!==this.penumbra&&(t.object.penumbra=this.penumbra),void 0!==this.shadow&&(t.object.shadow=this.shadow.toJSON()),t}}),Cc.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Cc,isHemisphereLight:!0,copy:function(e){return Rc.prototype.copy.call(this,e),this.groundColor.copy(e.groundColor),this}}),Object.assign(Pc.prototype,{copy:function(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this},clone:function(){return(new this.constructor).copy(this)},toJSON:function(){var e={};return 0!==this.bias&&(e.bias=this.bias),1!==this.radius&&(e.radius=this.radius),512===this.mapSize.x&&512===this.mapSize.y||(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}),Oc.prototype=Object.assign(Object.create(Pc.prototype),{constructor:Oc,isSpotLightShadow:!0,update:function(e){var t=this.camera,i=2*Ut.RAD2DEG*e.angle,n=this.mapSize.width/this.mapSize.height,r=e.distance||t.far;i===t.fov&&n===t.aspect&&r===t.far||(t.fov=i,t.aspect=n,t.far=r,t.updateProjectionMatrix())}}),Ic.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Ic,isSpotLight:!0,copy:function(e){return Rc.prototype.copy.call(this,e),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}),Nc.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Nc,isPointLight:!0,copy:function(e){return Rc.prototype.copy.call(this,e),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}),Bc.prototype=Object.assign(Object.create(Pc.prototype),{constructor:Bc}),Uc.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Uc,isDirectionalLight:!0,copy:function(e){return Rc.prototype.copy.call(this,e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}),Dc.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Dc,isAmbientLight:!0}),Fc.prototype=Object.assign(Object.create(Rc.prototype),{constructor:Fc,isRectAreaLight:!0,copy:function(e){return Rc.prototype.copy.call(this,e),this.width=e.width,this.height=e.height,this},toJSON:function(e){var t=Rc.prototype.toJSON.call(this,e);return t.object.width=this.width,t.object.height=this.height,t}}),Hc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:Hc,ValueTypeName:"string",ValueBufferType:Array,DefaultInterpolation:bt,InterpolantFactoryMethodLinear:void 0,InterpolantFactoryMethodSmooth:void 0}),zc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:zc,ValueTypeName:"bool",ValueBufferType:Array,DefaultInterpolation:bt,InterpolantFactoryMethodLinear:void 0,InterpolantFactoryMethodSmooth:void 0}),Object.assign(Gc.prototype,{evaluate:function(e){var t=this.parameterPositions,i=this._cachedIndex,n=t[i],r=t[i-1];e:{t:{var a;i:{n:if(!(e<n)){for(var o=i+2;;){if(void 0===n){if(e<r)break n;return i=t.length,this._cachedIndex=i,this.afterEnd_(i-1,e,r)}if(i===o)break;if(r=n,e<(n=t[++i]))break t}a=t.length;break i}if(r<=e)break e;var s=t[1];e<s&&(i=2,r=s);for(o=i-2;;){if(void 0===r)return this._cachedIndex=0,this.beforeStart_(0,e,n);if(i===o)break;if(n=r,(r=t[--i-1])<=e)break t}a=i,i=0}for(;i<a;){var c=i+a>>>1;e<t[c]?a=c:i=c+1}if(n=t[i],void 0===(r=t[i-1]))return this._cachedIndex=0,this.beforeStart_(0,e,n);if(void 0===n)return i=t.length,this._cachedIndex=i,this.afterEnd_(i-1,r,e)}this._cachedIndex=i,this.intervalChanged_(i,r,n)}return this.interpolate_(i,r,e,n)},settings:null,DefaultSettings_:{},getSettings_:function(){return this.settings||this.DefaultSettings_},copySampleValue_:function(e){for(var t=this.resultBuffer,i=this.sampleValues,n=this.valueSize,r=e*n,a=0;a!==n;++a)t[a]=i[r+a];return t},interpolate_:function(){throw new Error("call to abstract method")},intervalChanged_:function(){}}),Object.assign(Gc.prototype,{beforeStart_:Gc.prototype.copySampleValue_,afterEnd_:Gc.prototype.copySampleValue_}),kc.prototype=Object.assign(Object.create(Gc.prototype),{constructor:kc,interpolate_:function(e,t,i,n){for(var r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=(i-t)/(n-t),h=s+o;s!==h;s+=4)Ht.slerpFlat(r,0,a,s-o,a,s,c);return r}}),Vc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:Vc,ValueTypeName:"quaternion",DefaultInterpolation:_t,InterpolantFactoryMethodLinear:function(e){return new kc(this.times,this.values,this.getValueSize(),e)},InterpolantFactoryMethodSmooth:void 0}),jc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:jc,ValueTypeName:"color"}),Wc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:Wc,ValueTypeName:"number"}),Xc.prototype=Object.assign(Object.create(Gc.prototype),{constructor:Xc,DefaultSettings_:{endingStart:Mt,endingEnd:Mt},intervalChanged_:function(e,t,i){var n=this.parameterPositions,r=e-2,a=e+1,o=n[r],s=n[a];if(void 0===o)switch(this.getSettings_().endingStart){case Et:r=e,o=2*t-i;break;case Tt:o=t+n[r=n.length-2]-n[r+1];break;default:r=e,o=i}if(void 0===s)switch(this.getSettings_().endingEnd){case Et:a=e,s=2*i-t;break;case Tt:s=i+n[a=1]-n[0];break;default:a=e-1,s=t}var c=.5*(i-t),h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-i),this._offsetPrev=r*h,this._offsetNext=a*h},interpolate_:function(e,t,i,n){for(var r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,h=this._offsetPrev,l=this._offsetNext,u=this._weightPrev,d=this._weightNext,p=(i-t)/(n-t),f=p*p,m=f*p,g=-u*m+2*u*f-u*p,v=(1+u)*m+(-1.5-2*u)*f+(-.5+u)*p+1,y=(-1-d)*m+(1.5+d)*f+.5*p,x=d*m-d*f,w=0;w!==o;++w)r[w]=g*a[h+w]+v*a[c+w]+y*a[s+w]+x*a[l+w];return r}}),qc.prototype=Object.assign(Object.create(Gc.prototype),{constructor:qc,interpolate_:function(e,t,i,n){for(var r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,h=(i-t)/(n-t),l=1-h,u=0;u!==o;++u)r[u]=a[c+u]*l+a[s+u]*h;return r}}),Yc.prototype=Object.assign(Object.create(Gc.prototype),{constructor:Yc,interpolate_:function(e){return this.copySampleValue_(e-1)}});var Zc={arraySlice:function(e,t,i){return Zc.isTypedArray(e)?new e.constructor(e.subarray(t,void 0!==i?i:e.length)):e.slice(t,i)},convertArray:function(e,t,i){return!e||!i&&e.constructor===t?e:"number"==typeof t.BYTES_PER_ELEMENT?new t(e):Array.prototype.slice.call(e)},isTypedArray:function(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)},getKeyframeOrder:function(i){for(var e=i.length,t=new Array(e),n=0;n!==e;++n)t[n]=n;return t.sort(function(e,t){return i[e]-i[t]}),t},sortedArray:function(e,t,i){for(var n=e.length,r=new e.constructor(n),a=0,o=0;o!==n;++a)for(var s=i[a]*t,c=0;c!==t;++c)r[o++]=e[s+c];return r},flattenJSON:function(e,t,i,n){for(var r=1,a=e[0];void 0!==a&&void 0===a[n];)a=e[r++];if(void 0!==a){var o=a[n];if(void 0!==o)if(Array.isArray(o))for(;void 0!==(o=a[n])&&(t.push(a.time),i.push.apply(i,o)),void 0!==(a=e[r++]););else if(void 0!==o.toArray)for(;void 0!==(o=a[n])&&(t.push(a.time),o.toArray(i,i.length)),void 0!==(a=e[r++]););else for(;void 0!==(o=a[n])&&(t.push(a.time),i.push(o)),void 0!==(a=e[r++]););}}};function Jc(e,t,i,n){if(void 0===e)throw new Error("THREE.KeyframeTrack: track name is undefined");if(void 0===t||0===t.length)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Zc.convertArray(t,this.TimeBufferType),this.values=Zc.convertArray(i,this.ValueBufferType),this.setInterpolation(n||this.DefaultInterpolation),this.validate(),this.optimize()}function Qc(e,t,i,n){Jc.call(this,e,t,i,n)}function Kc(e,t,i){this.name=e,this.tracks=i,this.duration=void 0!==t?t:-1,this.uuid=Ut.generateUUID(),this.duration<0&&this.resetDuration(),this.optimize()}function $c(e){this.manager=void 0!==e?e:Ks,this.textures={}}function eh(e){this.manager=void 0!==e?e:Ks}Object.assign(Jc,{parse:function(e){if(void 0===e.type)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");var t=Jc._getTrackTypeForValueTypeName(e.type);if(void 0===e.times){var i=[],n=[];Zc.flattenJSON(e.keys,i,n,"value"),e.times=i,e.values=n}return void 0!==t.parse?t.parse(e):new t(e.name,e.times,e.values,e.interpolation)},toJSON:function(e){var t,i=e.constructor;if(void 0!==i.toJSON)t=i.toJSON(e);else{t={name:e.name,times:Zc.convertArray(e.times,Array),values:Zc.convertArray(e.values,Array)};var n=e.getInterpolation();n!==e.DefaultInterpolation&&(t.interpolation=n)}return t.type=e.ValueTypeName,t},_getTrackTypeForValueTypeName:function(e){switch(e.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Wc;case"vector":case"vector2":case"vector3":case"vector4":return Qc;case"color":return jc;case"quaternion":return Vc;case"bool":case"boolean":return zc;case"string":return Hc}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+e)}}),Object.assign(Jc.prototype,{constructor:Jc,TimeBufferType:Float32Array,ValueBufferType:Float32Array,DefaultInterpolation:_t,InterpolantFactoryMethodDiscrete:function(e){return new Yc(this.times,this.values,this.getValueSize(),e)},InterpolantFactoryMethodLinear:function(e){return new qc(this.times,this.values,this.getValueSize(),e)},InterpolantFactoryMethodSmooth:function(e){return new Xc(this.times,this.values,this.getValueSize(),e)},setInterpolation:function(e){var t;switch(e){case bt:t=this.InterpolantFactoryMethodDiscrete;break;case _t:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth}if(void 0!==t)this.createInterpolant=t;else{var i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(void 0===this.createInterpolant){if(e===this.DefaultInterpolation)throw new Error(i);this.setInterpolation(this.DefaultInterpolation)}console.warn("THREE.KeyframeTrack:",i)}},getInterpolation:function(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return bt;case this.InterpolantFactoryMethodLinear:return _t;case this.InterpolantFactoryMethodSmooth:return 2302}},getValueSize:function(){return this.values.length/this.times.length},shift:function(e){if(0!==e)for(var t=this.times,i=0,n=t.length;i!==n;++i)t[i]+=e;return this},scale:function(e){if(1!==e)for(var t=this.times,i=0,n=t.length;i!==n;++i)t[i]*=e;return this},trim:function(e,t){for(var i=this.times,n=i.length,r=0,a=n-1;r!==n&&i[r]<e;)++r;for(;-1!==a&&i[a]>t;)--a;if(++a,0!==r||a!==n){a<=r&&(r=(a=Math.max(a,1))-1);var o=this.getValueSize();this.times=Zc.arraySlice(i,r,a),this.values=Zc.arraySlice(this.values,r*o,a*o)}return this},validate:function(){var e=!0,t=this.getValueSize();t-Math.floor(t)!=0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);var i=this.times,n=this.values,r=i.length;0===r&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);for(var a=null,o=0;o!==r;o++){var s=i[o];if("number"==typeof s&&isNaN(s)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,s),e=!1;break}if(null!==a&&s<a){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,s,a),e=!1;break}a=s}if(void 0!==n&&Zc.isTypedArray(n)){o=0;for(var c=n.length;o!==c;++o){var h=n[o];if(isNaN(h)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,h),e=!1;break}}}return e},optimize:function(){for(var e=this.times,t=this.values,i=this.getValueSize(),n=2302===this.getInterpolation(),r=1,a=e.length-1,o=1;o<a;++o){var s=!1,c=e[o];if(c!==e[o+1]&&(1!==o||c!==c[0]))if(n)s=!0;else for(var h=o*i,l=h-i,u=h+i,d=0;d!==i;++d){var p=t[h+d];if(p!==t[l+d]||p!==t[u+d]){s=!0;break}}if(s){if(o!==r){e[r]=e[o];var f=o*i,m=r*i;for(d=0;d!==i;++d)t[m+d]=t[f+d]}++r}}if(0<a){e[r]=e[a];for(f=a*i,m=r*i,d=0;d!==i;++d)t[m+d]=t[f+d];++r}return r!==e.length&&(this.times=Zc.arraySlice(e,0,r),this.values=Zc.arraySlice(t,0,r*i)),this}}),Qc.prototype=Object.assign(Object.create(Jc.prototype),{constructor:Qc,ValueTypeName:"vector"}),Object.assign(Kc,{parse:function(e){for(var t=[],i=e.tracks,n=1/(e.fps||1),r=0,a=i.length;r!==a;++r)t.push(Jc.parse(i[r]).scale(n));return new Kc(e.name,e.duration,t)},toJSON:function(e){for(var t=[],i=e.tracks,n={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid},r=0,a=i.length;r!==a;++r)t.push(Jc.toJSON(i[r]));return n},CreateFromMorphTargetSequence:function(e,t,i,n){for(var r=t.length,a=[],o=0;o<r;o++){var s=[],c=[];s.push((o+r-1)%r,o,(o+1)%r),c.push(0,1,0);var h=Zc.getKeyframeOrder(s);s=Zc.sortedArray(s,1,h),c=Zc.sortedArray(c,1,h),n||0!==s[0]||(s.push(r),c.push(c[0])),a.push(new Wc(".morphTargetInfluences["+t[o].name+"]",s,c).scale(1/i))}return new Kc(e,-1,a)},findByName:function(e,t){var i=e;if(!Array.isArray(e)){var n=e;i=n.geometry&&n.geometry.animations||n.animations}for(var r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null},CreateClipsFromMorphTargetSequences:function(e,t,i){for(var n={},r=/^([\w-]*?)([\d]+)$/,a=0,o=e.length;a<o;a++){var s=e[a],c=s.name.match(r);if(c&&1<c.length){var h=n[u=c[1]];h||(n[u]=h=[]),h.push(s)}}var l=[];for(var u in n)l.push(Kc.CreateFromMorphTargetSequence(u,n[u],t,i));return l},parseAnimation:function(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;for(var i=function(e,t,i,n,r){if(0!==i.length){var a=[],o=[];Zc.flattenJSON(i,a,o,n),0!==a.length&&r.push(new e(t,a,o))}},n=[],r=e.name||"default",a=e.length||-1,o=e.fps||30,s=e.hierarchy||[],c=0;c<s.length;c++){var h=s[c].keys;if(h&&0!==h.length)if(h[0].morphTargets){for(var l={},u=0;u<h.length;u++)if(h[u].morphTargets)for(var d=0;d<h[u].morphTargets.length;d++)l[h[u].morphTargets[d]]=-1;for(var p in l){var f=[],m=[];for(d=0;d!==h[u].morphTargets.length;++d){var g=h[u];f.push(g.time),m.push(g.morphTarget===p?1:0)}n.push(new Wc(".morphTargetInfluence["+p+"]",f,m))}a=l.length*(o||1)}else{var v=".bones["+t[c].name+"]";i(Qc,v+".position",h,"pos",n),i(Vc,v+".quaternion",h,"rot",n),i(Qc,v+".scale",h,"scl",n)}}return 0===n.length?null:new Kc(r,a,n)}}),Object.assign(Kc.prototype,{resetDuration:function(){for(var e=0,t=0,i=this.tracks.length;t!==i;++t){var n=this.tracks[t];e=Math.max(e,n.times[n.times.length-1])}this.duration=e},trim:function(){for(var e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this},optimize:function(){for(var e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}}),Object.assign($c.prototype,{load:function(e,t,i,n){var r=this;new ec(r.manager).load(e,function(e){t(r.parse(JSON.parse(e)))},i,n)},setTextures:function(e){this.textures=e},parse:function(e){var t=this.textures;function i(e){return void 0===t[e]&&console.warn("THREE.MaterialLoader: Undefined texture",e),t[e]}var n=new Zs[e.type];if(void 0!==e.uuid&&(n.uuid=e.uuid),void 0!==e.name&&(n.name=e.name),void 0!==e.color&&n.color.setHex(e.color),void 0!==e.roughness&&(n.roughness=e.roughness),void 0!==e.metalness&&(n.metalness=e.metalness),void 0!==e.emissive&&n.emissive.setHex(e.emissive),void 0!==e.specular&&n.specular.setHex(e.specular),void 0!==e.shininess&&(n.shininess=e.shininess),void 0!==e.clearCoat&&(n.clearCoat=e.clearCoat),void 0!==e.clearCoatRoughness&&(n.clearCoatRoughness=e.clearCoatRoughness),void 0!==e.uniforms&&(n.uniforms=e.uniforms),void 0!==e.vertexShader&&(n.vertexShader=e.vertexShader),void 0!==e.fragmentShader&&(n.fragmentShader=e.fragmentShader),void 0!==e.vertexColors&&(n.vertexColors=e.vertexColors),void 0!==e.fog&&(n.fog=e.fog),void 0!==e.flatShading&&(n.flatShading=e.flatShading),void 0!==e.blending&&(n.blending=e.blending),void 0!==e.side&&(n.side=e.side),void 0!==e.opacity&&(n.opacity=e.opacity),void 0!==e.transparent&&(n.transparent=e.transparent),void 0!==e.alphaTest&&(n.alphaTest=e.alphaTest),void 0!==e.depthTest&&(n.depthTest=e.depthTest),void 0!==e.depthWrite&&(n.depthWrite=e.depthWrite),void 0!==e.colorWrite&&(n.colorWrite=e.colorWrite),void 0!==e.wireframe&&(n.wireframe=e.wireframe),void 0!==e.wireframeLinewidth&&(n.wireframeLinewidth=e.wireframeLinewidth),void 0!==e.wireframeLinecap&&(n.wireframeLinecap=e.wireframeLinecap),void 0!==e.wireframeLinejoin&&(n.wireframeLinejoin=e.wireframeLinejoin),void 0!==e.rotation&&(n.rotation=e.rotation),1!==e.linewidth&&(n.linewidth=e.linewidth),void 0!==e.dashSize&&(n.dashSize=e.dashSize),void 0!==e.gapSize&&(n.gapSize=e.gapSize),void 0!==e.scale&&(n.scale=e.scale),void 0!==e.polygonOffset&&(n.polygonOffset=e.polygonOffset),void 0!==e.polygonOffsetFactor&&(n.polygonOffsetFactor=e.polygonOffsetFactor),void 0!==e.polygonOffsetUnits&&(n.polygonOffsetUnits=e.polygonOffsetUnits),void 0!==e.skinning&&(n.skinning=e.skinning),void 0!==e.morphTargets&&(n.morphTargets=e.morphTargets),void 0!==e.dithering&&(n.dithering=e.dithering),void 0!==e.visible&&(n.visible=e.visible),void 0!==e.userData&&(n.userData=e.userData),void 0!==e.shading&&(n.flatShading=1===e.shading),void 0!==e.size&&(n.size=e.size),void 0!==e.sizeAttenuation&&(n.sizeAttenuation=e.sizeAttenuation),void 0!==e.map&&(n.map=i(e.map)),void 0!==e.alphaMap&&(n.alphaMap=i(e.alphaMap),n.transparent=!0),void 0!==e.bumpMap&&(n.bumpMap=i(e.bumpMap)),void 0!==e.bumpScale&&(n.bumpScale=e.bumpScale),void 0!==e.normalMap&&(n.normalMap=i(e.normalMap)),void 0!==e.normalScale){var r=e.normalScale;!1===Array.isArray(r)&&(r=[r,r]),n.normalScale=(new Dt).fromArray(r)}return void 0!==e.displacementMap&&(n.displacementMap=i(e.displacementMap)),void 0!==e.displacementScale&&(n.displacementScale=e.displacementScale),void 0!==e.displacementBias&&(n.displacementBias=e.displacementBias),void 0!==e.roughnessMap&&(n.roughnessMap=i(e.roughnessMap)),void 0!==e.metalnessMap&&(n.metalnessMap=i(e.metalnessMap)),void 0!==e.emissiveMap&&(n.emissiveMap=i(e.emissiveMap)),void 0!==e.emissiveIntensity&&(n.emissiveIntensity=e.emissiveIntensity),void 0!==e.specularMap&&(n.specularMap=i(e.specularMap)),void 0!==e.envMap&&(n.envMap=i(e.envMap)),void 0!==e.reflectivity&&(n.reflectivity=e.reflectivity),void 0!==e.lightMap&&(n.lightMap=i(e.lightMap)),void 0!==e.lightMapIntensity&&(n.lightMapIntensity=e.lightMapIntensity),void 0!==e.aoMap&&(n.aoMap=i(e.aoMap)),void 0!==e.aoMapIntensity&&(n.aoMapIntensity=e.aoMapIntensity),void 0!==e.gradientMap&&(n.gradientMap=i(e.gradientMap)),n}}),Object.assign(eh.prototype,{load:function(e,t,i,n){var r=this;new ec(r.manager).load(e,function(e){t(r.parse(JSON.parse(e)))},i,n)},parse:function(e){var t=new Ln,i=e.data.index;if(void 0!==i){var n=new ah[i.type](i.array);t.setIndex(new an(n,1))}var r=e.data.attributes;for(var a in r){var o=r[a];n=new ah[o.type](o.array);t.addAttribute(a,new an(n,o.itemSize,o.normalized))}var s=e.data.groups||e.data.drawcalls||e.data.offsets;if(void 0!==s)for(var c=0,h=s.length;c!==h;++c){var l=s[c];t.addGroup(l.start,l.count,l.materialIndex)}var u=e.data.boundingSphere;if(void 0!==u){var d=new zt;void 0!==u.center&&d.fromArray(u.center),t.boundingSphere=new ui(d,u.radius)}return t}});var th,ih,nh,rh,ah={Int8Array:Int8Array,Uint8Array:Uint8Array,Uint8ClampedArray:"undefined"!=typeof Uint8ClampedArray?Uint8ClampedArray:Uint8Array,Int16Array:Int16Array,Uint16Array:Uint16Array,Int32Array:Int32Array,Uint32Array:Uint32Array,Float32Array:Float32Array,Float64Array:Float64Array};function oh(){}oh.Handlers={handlers:[],add:function(e,t){this.handlers.push(e,t)},get:function(e){for(var t=this.handlers,i=0,n=t.length;i<n;i+=2){var r=t[i],a=t[i+1];if(r.test(e))return a}return null}},Object.assign(oh.prototype,{crossOrigin:void 0,onLoadStart:function(){},onLoadProgress:function(){},onLoadComplete:function(){},initMaterials:function(e,t,i){for(var n=[],r=0;r<e.length;++r)n[r]=this.createMaterial(e[r],t,i);return n},createMaterial:(th={NoBlending:q,NormalBlending:Y,AdditiveBlending:J,SubtractiveBlending:Q,MultiplyBlending:K,CustomBlending:$},ih=new yi,nh=new ac,rh=new $c,function(e,h,l){var u={};function t(e,t,i,n,r){var a,o=h+e,s=oh.Handlers.get(o);null!==s?a=s.load(o):(nh.setCrossOrigin(l),a=nh.load(o)),void 0!==t&&(a.repeat.fromArray(t),1!==t[0]&&(a.wrapS=we),1!==t[1]&&(a.wrapT=we)),void 0!==i&&a.offset.fromArray(i),void 0!==n&&("repeat"===n[0]&&(a.wrapS=we),"mirror"===n[0]&&(a.wrapS=_e),"repeat"===n[1]&&(a.wrapT=we),"mirror"===n[1]&&(a.wrapT=_e)),void 0!==r&&(a.anisotropy=r);var c=Ut.generateUUID();return u[c]=a,c}var i={uuid:Ut.generateUUID(),type:"MeshLambertMaterial"};for(var n in e){var r=e[n];switch(n){case"DbgColor":case"DbgIndex":case"opticalDensity":case"illumination":break;case"DbgName":i.name=r;break;case"blending":i.blending=th[r];break;case"colorAmbient":case"mapAmbient":console.warn("THREE.Loader.createMaterial:",n,"is no longer supported.");break;case"colorDiffuse":i.color=ih.fromArray(r).getHex();break;case"colorSpecular":i.specular=ih.fromArray(r).getHex();break;case"colorEmissive":i.emissive=ih.fromArray(r).getHex();break;case"specularCoef":i.shininess=r;break;case"shading":"basic"===r.toLowerCase()&&(i.type="MeshBasicMaterial"),"phong"===r.toLowerCase()&&(i.type="MeshPhongMaterial"),"standard"===r.toLowerCase()&&(i.type="MeshStandardMaterial");break;case"mapDiffuse":i.map=t(r,e.mapDiffuseRepeat,e.mapDiffuseOffset,e.mapDiffuseWrap,e.mapDiffuseAnisotropy);break;case"mapDiffuseRepeat":case"mapDiffuseOffset":case"mapDiffuseWrap":case"mapDiffuseAnisotropy":break;case"mapEmissive":i.emissiveMap=t(r,e.mapEmissiveRepeat,e.mapEmissiveOffset,e.mapEmissiveWrap,e.mapEmissiveAnisotropy);break;case"mapEmissiveRepeat":case"mapEmissiveOffset":case"mapEmissiveWrap":case"mapEmissiveAnisotropy":break;case"mapLight":i.lightMap=t(r,e.mapLightRepeat,e.mapLightOffset,e.mapLightWrap,e.mapLightAnisotropy);break;case"mapLightRepeat":case"mapLightOffset":case"mapLightWrap":case"mapLightAnisotropy":break;case"mapAO":i.aoMap=t(r,e.mapAORepeat,e.mapAOOffset,e.mapAOWrap,e.mapAOAnisotropy);break;case"mapAORepeat":case"mapAOOffset":case"mapAOWrap":case"mapAOAnisotropy":break;case"mapBump":i.bumpMap=t(r,e.mapBumpRepeat,e.mapBumpOffset,e.mapBumpWrap,e.mapBumpAnisotropy);break;case"mapBumpScale":i.bumpScale=r;break;case"mapBumpRepeat":case"mapBumpOffset":case"mapBumpWrap":case"mapBumpAnisotropy":break;case"mapNormal":i.normalMap=t(r,e.mapNormalRepeat,e.mapNormalOffset,e.mapNormalWrap,e.mapNormalAnisotropy);break;case"mapNormalFactor":i.normalScale=r;break;case"mapNormalRepeat":case"mapNormalOffset":case"mapNormalWrap":case"mapNormalAnisotropy":break;case"mapSpecular":i.specularMap=t(r,e.mapSpecularRepeat,e.mapSpecularOffset,e.mapSpecularWrap,e.mapSpecularAnisotropy);break;case"mapSpecularRepeat":case"mapSpecularOffset":case"mapSpecularWrap":case"mapSpecularAnisotropy":break;case"mapMetalness":i.metalnessMap=t(r,e.mapMetalnessRepeat,e.mapMetalnessOffset,e.mapMetalnessWrap,e.mapMetalnessAnisotropy);break;case"mapMetalnessRepeat":case"mapMetalnessOffset":case"mapMetalnessWrap":case"mapMetalnessAnisotropy":break;case"mapRoughness":i.roughnessMap=t(r,e.mapRoughnessRepeat,e.mapRoughnessOffset,e.mapRoughnessWrap,e.mapRoughnessAnisotropy);break;case"mapRoughnessRepeat":case"mapRoughnessOffset":case"mapRoughnessWrap":case"mapRoughnessAnisotropy":break;case"mapAlpha":i.alphaMap=t(r,e.mapAlphaRepeat,e.mapAlphaOffset,e.mapAlphaWrap,e.mapAlphaAnisotropy);break;case"mapAlphaRepeat":case"mapAlphaOffset":case"mapAlphaWrap":case"mapAlphaAnisotropy":break;case"flipSided":i.side=Ae;break;case"doubleSided":i.side=Z;break;case"transparency":console.warn("THREE.Loader.createMaterial: transparency has been renamed to opacity"),i.opacity=r;break;case"depthTest":case"depthWrite":case"colorWrite":case"opacity":case"reflectivity":case"transparent":case"visible":case"wireframe":i[n]=r;break;case"vertexColors":!0===r&&(i.vertexColors=_),"face"===r&&(i.vertexColors=1);break;default:console.error("THREE.Loader.createMaterial: Unsupported",n,r)}}return"MeshBasicMaterial"===i.type&&delete i.emissive,"MeshPhongMaterial"!==i.type&&delete i.specular,i.opacity<1&&(i.transparent=!0),rh.setTextures(u),rh.parse(i)})});var sh={decodeText:function(e){if("undefined"!=typeof TextDecoder)return(new TextDecoder).decode(e);for(var t="",i=0,n=e.length;i<n;i++)t+=String.fromCharCode(e[i]);return decodeURIComponent(escape(t))},extractUrlBase:function(e){var t=e.lastIndexOf("/");return-1===t?"./":e.substr(0,t+1)}};function ch(e){"boolean"==typeof e&&(console.warn("THREE.JSONLoader: showStatus parameter has been removed from constructor."),e=void 0),this.manager=void 0!==e?e:Ks,this.withCredentials=!1}function hh(e){this.manager=void 0!==e?e:Ks,this.texturePath=""}Object.assign(ch.prototype,{load:function(a,o,e,t){var s=this,c=this.texturePath&&"string"==typeof this.texturePath?this.texturePath:sh.extractUrlBase(a),i=new ec(this.manager);i.setWithCredentials(this.withCredentials),i.load(a,function(e){var t=JSON.parse(e),i=t.metadata;if(void 0!==i){var n=i.type;if(void 0!==n&&"object"===n.toLowerCase())return void console.error("THREE.JSONLoader: "+a+" should be loaded with THREE.ObjectLoader instead.")}var r=s.parse(t,c);o(r.geometry,r.materials)},e,t)},setTexturePath:function(e){this.texturePath=e},parse:function(e,t){void 0!==e.data&&(e=e.data),void 0!==e.scale?e.scale=1/e.scale:e.scale=1;var i=new rn;return function(e,t){function i(e,t){return e&1<<t}var n,r,a,o,s,c,h,l,u,d,p,f,m,g,v,y,x,w,b,_,M,E,T,S,A,L=e.faces,R=e.vertices,C=e.normals,P=e.colors,O=e.scale,I=0;if(void 0!==e.uvs){for(n=0;n<e.uvs.length;n++)e.uvs[n].length&&I++;for(n=0;n<I;n++)t.faceVertexUvs[n]=[]}for(o=0,s=R.length;o<s;)(w=new zt).x=R[o++]*O,w.y=R[o++]*O,w.z=R[o++]*O,t.vertices.push(w);for(o=0,s=L.length;o<s;)if(p=i(d=L[o++],0),f=i(d,1),m=i(d,3),g=i(d,4),v=i(d,5),y=i(d,6),x=i(d,7),p){if((_=new Yi).a=L[o],_.b=L[o+1],_.c=L[o+3],(M=new Yi).a=L[o+1],M.b=L[o+2],M.c=L[o+3],o+=4,f&&(u=L[o++],_.materialIndex=u,M.materialIndex=u),a=t.faces.length,m)for(n=0;n<I;n++)for(S=e.uvs[n],t.faceVertexUvs[n][a]=[],t.faceVertexUvs[n][a+1]=[],r=0;r<4;r++)A=new Dt(S[2*(l=L[o++])],S[2*l+1]),2!==r&&t.faceVertexUvs[n][a].push(A),0!==r&&t.faceVertexUvs[n][a+1].push(A);if(g&&(h=3*L[o++],_.normal.set(C[h++],C[h++],C[h]),M.normal.copy(_.normal)),v)for(n=0;n<4;n++)h=3*L[o++],T=new zt(C[h++],C[h++],C[h]),2!==n&&_.vertexNormals.push(T),0!==n&&M.vertexNormals.push(T);if(y&&(E=P[c=L[o++]],_.color.setHex(E),M.color.setHex(E)),x)for(n=0;n<4;n++)E=P[c=L[o++]],2!==n&&_.vertexColors.push(new yi(E)),0!==n&&M.vertexColors.push(new yi(E));t.faces.push(_),t.faces.push(M)}else{if((b=new Yi).a=L[o++],b.b=L[o++],b.c=L[o++],f&&(u=L[o++],b.materialIndex=u),a=t.faces.length,m)for(n=0;n<I;n++)for(S=e.uvs[n],t.faceVertexUvs[n][a]=[],r=0;r<3;r++)A=new Dt(S[2*(l=L[o++])],S[2*l+1]),t.faceVertexUvs[n][a].push(A);if(g&&(h=3*L[o++],b.normal.set(C[h++],C[h++],C[h])),v)for(n=0;n<3;n++)h=3*L[o++],T=new zt(C[h++],C[h++],C[h]),b.vertexNormals.push(T);if(y&&(c=L[o++],b.color.setHex(P[c])),x)for(n=0;n<3;n++)c=L[o++],b.vertexColors.push(new yi(P[c]));t.faces.push(b)}}(e,i),function(e,t){var i=void 0!==e.influencesPerVertex?e.influencesPerVertex:2;if(e.skinWeights)for(var n=0,r=e.skinWeights.length;n<r;n+=i){var a=e.skinWeights[n],o=1<i?e.skinWeights[n+1]:0,s=2<i?e.skinWeights[n+2]:0,c=3<i?e.skinWeights[n+3]:0;t.skinWeights.push(new oi(a,o,s,c))}if(e.skinIndices)for(n=0,r=e.skinIndices.length;n<r;n+=i){var h=e.skinIndices[n],l=1<i?e.skinIndices[n+1]:0,u=2<i?e.skinIndices[n+2]:0,d=3<i?e.skinIndices[n+3]:0;t.skinIndices.push(new oi(h,l,u,d))}t.bones=e.bones,t.bones&&0<t.bones.length&&(t.skinWeights.length!==t.skinIndices.length||t.skinIndices.length!==t.vertices.length)&&console.warn("When skinning, number of vertices ("+t.vertices.length+"), skinIndices ("+t.skinIndices.length+"), and skinWeights ("+t.skinWeights.length+") should match.")}(e,i),function(e,t){var i=e.scale;if(void 0!==e.morphTargets)for(var n=0,r=e.morphTargets.length;n<r;n++){t.morphTargets[n]={},t.morphTargets[n].name=e.morphTargets[n].name,t.morphTargets[n].vertices=[];for(var a=t.morphTargets[n].vertices,o=e.morphTargets[n].vertices,s=0,c=o.length;s<c;s+=3){var h=new zt;h.x=o[s]*i,h.y=o[s+1]*i,h.z=o[s+2]*i,a.push(h)}}if(void 0!==e.morphColors&&0<e.morphColors.length){console.warn('THREE.JSONLoader: "morphColors" no longer supported. Using them as face colors.');var l=t.faces,u=e.morphColors[0].colors;for(n=0,r=l.length;n<r;n++)l[n].color.fromArray(u,3*n)}}(e,i),function(e,t){var i=[],n=[];void 0!==e.animation&&n.push(e.animation),void 0!==e.animations&&(e.animations.length?n=n.concat(e.animations):n.push(e.animations));for(var r=0;r<n.length;r++){var a=Kc.parseAnimation(n[r],t.bones);a&&i.push(a)}if(t.morphTargets){var o=Kc.CreateClipsFromMorphTargetSequences(t.morphTargets,10);i=i.concat(o)}0<i.length&&(t.animations=i)}(e,i),i.computeFaceNormals(),i.computeBoundingSphere(),void 0===e.materials||0===e.materials.length?{geometry:i}:{geometry:i,materials:oh.prototype.initMaterials(e.materials,t,this.crossOrigin)}}}),Object.assign(hh.prototype,{load:function(n,r,e,a){""===this.texturePath&&(this.texturePath=n.substring(0,n.lastIndexOf("/")+1));var o=this;new ec(o.manager).load(n,function(e){var t=null;try{t=JSON.parse(e)}catch(e){return void 0!==a&&a(e),void console.error("THREE:ObjectLoader: Can't parse "+n+".",e.message)}var i=t.metadata;void 0!==i&&void 0!==i.type&&"geometry"!==i.type.toLowerCase()?o.parse(t,r):console.error("THREE.ObjectLoader: Can't load "+n+". Use THREE.JSONLoader instead.")},e,a)},setTexturePath:function(e){return this.texturePath=e,this},setCrossOrigin:function(e){return this.crossOrigin=e,this},parse:function(e,t){var i=this.parseShape(e.shapes),n=this.parseGeometries(e.geometries,i),r=this.parseImages(e.images,function(){void 0!==t&&t(s)}),a=this.parseTextures(e.textures,r),o=this.parseMaterials(e.materials,a),s=this.parseObject(e.object,n,o);return e.animations&&(s.animations=this.parseAnimations(e.animations)),void 0!==e.images&&0!==e.images.length||void 0!==t&&t(s),s},parseShape:function(e){var t={};if(void 0!==e)for(var i=0,n=e.length;i<n;i++){var r=(new Lc).fromJSON(e[i]);t[r.uuid]=r}return t},parseGeometries:function(e,t){var i={};if(void 0!==e)for(var n=new ch,r=new eh,a=0,o=e.length;a<o;a++){var s,c=e[a];switch(c.type){case"PlaneGeometry":case"PlaneBufferGeometry":s=new Hs[c.type](c.width,c.height,c.widthSegments,c.heightSegments);break;case"BoxGeometry":case"BoxBufferGeometry":case"CubeGeometry":s=new Hs[c.type](c.width,c.height,c.depth,c.widthSegments,c.heightSegments,c.depthSegments);break;case"CircleGeometry":case"CircleBufferGeometry":s=new Hs[c.type](c.radius,c.segments,c.thetaStart,c.thetaLength);break;case"CylinderGeometry":case"CylinderBufferGeometry":s=new Hs[c.type](c.radiusTop,c.radiusBottom,c.height,c.radialSegments,c.heightSegments,c.openEnded,c.thetaStart,c.thetaLength);break;case"ConeGeometry":case"ConeBufferGeometry":s=new Hs[c.type](c.radius,c.height,c.radialSegments,c.heightSegments,c.openEnded,c.thetaStart,c.thetaLength);break;case"SphereGeometry":case"SphereBufferGeometry":s=new Hs[c.type](c.radius,c.widthSegments,c.heightSegments,c.phiStart,c.phiLength,c.thetaStart,c.thetaLength);break;case"DodecahedronGeometry":case"DodecahedronBufferGeometry":case"IcosahedronGeometry":case"IcosahedronBufferGeometry":case"OctahedronGeometry":case"OctahedronBufferGeometry":case"TetrahedronGeometry":case"TetrahedronBufferGeometry":s=new Hs[c.type](c.radius,c.detail);break;case"RingGeometry":case"RingBufferGeometry":s=new Hs[c.type](c.innerRadius,c.outerRadius,c.thetaSegments,c.phiSegments,c.thetaStart,c.thetaLength);break;case"TorusGeometry":case"TorusBufferGeometry":s=new Hs[c.type](c.radius,c.tube,c.radialSegments,c.tubularSegments,c.arc);break;case"TorusKnotGeometry":case"TorusKnotBufferGeometry":s=new Hs[c.type](c.radius,c.tube,c.tubularSegments,c.radialSegments,c.p,c.q);break;case"LatheGeometry":case"LatheBufferGeometry":s=new Hs[c.type](c.points,c.segments,c.phiStart,c.phiLength);break;case"PolyhedronGeometry":case"PolyhedronBufferGeometry":s=new Hs[c.type](c.vertices,c.indices,c.radius,c.details);break;case"ShapeGeometry":case"ShapeBufferGeometry":for(var h=[],l=0,u=c.shapes.length;l<u;l++){var d=t[c.shapes[l]];h.push(d)}s=new Hs[c.type](h,c.curveSegments);break;case"BufferGeometry":s=r.parse(c);break;case"Geometry":s=n.parse(c,this.texturePath).geometry;break;default:console.warn('THREE.ObjectLoader: Unsupported geometry type "'+c.type+'"');continue}s.uuid=c.uuid,void 0!==c.name&&(s.name=c.name),i[c.uuid]=s}return i},parseMaterials:function(e,t){var i={};if(void 0!==e){var n=new $c;n.setTextures(t);for(var r=0,a=e.length;r<a;r++){var o=e[r];if("MultiMaterial"===o.type){for(var s=[],c=0;c<o.materials.length;c++)s.push(n.parse(o.materials[c]));i[o.uuid]=s}else i[o.uuid]=n.parse(o)}}return i},parseAnimations:function(e){for(var t=[],i=0;i<e.length;i++){var n=e[i],r=Kc.parse(n);void 0!==n.uuid&&(r.uuid=n.uuid),t.push(r)}return t},parseImages:function(e,t){var i=this,n={};function r(e){return i.manager.itemStart(e),a.load(e,function(){i.manager.itemEnd(e)},void 0,function(){i.manager.itemEnd(e),i.manager.itemError(e)})}if(void 0!==e&&0<e.length){var a=new nc(new Qs(t));a.setCrossOrigin(this.crossOrigin);for(var o=0,s=e.length;o<s;o++){var c=e[o],h=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(c.url)?c.url:i.texturePath+c.url;n[c.uuid]=r(h)}}return n},parseTextures:function(e,t){function i(e,t){return"number"==typeof e?e:(console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.",e),t[e])}var n={};if(void 0!==e)for(var r=0,a=e.length;r<a;r++){var o=e[r];void 0===o.image&&console.warn('THREE.ObjectLoader: No "image" specified for',o.uuid),void 0===t[o.image]&&console.warn("THREE.ObjectLoader: Undefined image",o.image);var s=new ai(t[o.image]);s.needsUpdate=!0,s.uuid=o.uuid,void 0!==o.name&&(s.name=o.name),void 0!==o.mapping&&(s.mapping=i(o.mapping,uh)),void 0!==o.offset&&s.offset.fromArray(o.offset),void 0!==o.repeat&&s.repeat.fromArray(o.repeat),void 0!==o.center&&s.center.fromArray(o.center),void 0!==o.rotation&&(s.rotation=o.rotation),void 0!==o.wrap&&(s.wrapS=i(o.wrap[0],dh),s.wrapT=i(o.wrap[1],dh)),void 0!==o.format&&(s.format=o.format),void 0!==o.minFilter&&(s.minFilter=i(o.minFilter,ph)),void 0!==o.magFilter&&(s.magFilter=i(o.magFilter,ph)),void 0!==o.anisotropy&&(s.anisotropy=o.anisotropy),void 0!==o.flipY&&(s.flipY=o.flipY),n[o.uuid]=s}return n},parseObject:function(e,t,a){var i;function n(e){return void 0===t[e]&&console.warn("THREE.ObjectLoader: Undefined geometry",e),t[e]}function r(e){if(void 0!==e){if(Array.isArray(e)){for(var t=[],i=0,n=e.length;i<n;i++){var r=e[i];void 0===a[r]&&console.warn("THREE.ObjectLoader: Undefined material",r),t.push(a[r])}return t}return void 0===a[e]&&console.warn("THREE.ObjectLoader: Undefined material",e),a[e]}}switch(e.type){case"Scene":i=new uo,void 0!==e.background&&Number.isInteger(e.background)&&(i.background=new yi(e.background)),void 0!==e.fog&&("Fog"===e.fog.type?i.fog=new lo(e.fog.color,e.fog.near,e.fog.far):"FogExp2"===e.fog.type&&(i.fog=new ho(e.fog.color,e.fog.density)));break;case"PerspectiveCamera":i=new ro(e.fov,e.aspect,e.near,e.far),void 0!==e.focus&&(i.focus=e.focus),void 0!==e.zoom&&(i.zoom=e.zoom),void 0!==e.filmGauge&&(i.filmGauge=e.filmGauge),void 0!==e.filmOffset&&(i.filmOffset=e.filmOffset),void 0!==e.view&&(i.view=Object.assign({},e.view));break;case"OrthographicCamera":i=new qi(e.left,e.right,e.top,e.bottom,e.near,e.far),void 0!==e.zoom&&(i.zoom=e.zoom),void 0!==e.view&&(i.view=Object.assign({},e.view));break;case"AmbientLight":i=new Dc(e.color,e.intensity);break;case"DirectionalLight":i=new Uc(e.color,e.intensity);break;case"PointLight":i=new Nc(e.color,e.intensity,e.distance,e.decay);break;case"RectAreaLight":i=new Fc(e.color,e.intensity,e.width,e.height);break;case"SpotLight":i=new Ic(e.color,e.intensity,e.distance,e.angle,e.penumbra,e.decay);break;case"HemisphereLight":i=new Cc(e.color,e.groundColor,e.intensity);break;case"SkinnedMesh":console.warn("THREE.ObjectLoader.parseObject() does not support SkinnedMesh yet.");case"Mesh":var o=n(e.geometry),s=r(e.material);i=o.bones&&0<o.bones.length?new yo(o,s):new lr(o,s);break;case"LOD":i=new mo;break;case"Line":i=new wo(n(e.geometry),r(e.material),e.mode);break;case"LineLoop":i=new _o(n(e.geometry),r(e.material));break;case"LineSegments":i=new bo(n(e.geometry),r(e.material));break;case"PointCloud":case"Points":i=new Eo(n(e.geometry),r(e.material));break;case"Sprite":i=new fo(r(e.material));break;case"Group":i=new To;break;default:i=new Wi}if(i.uuid=e.uuid,void 0!==e.name&&(i.name=e.name),void 0!==e.matrix?(i.matrix.fromArray(e.matrix),void 0!==e.matrixAutoUpdate&&(i.matrixAutoUpdate=e.matrixAutoUpdate),i.matrixAutoUpdate&&i.matrix.decompose(i.position,i.quaternion,i.scale)):(void 0!==e.position&&i.position.fromArray(e.position),void 0!==e.rotation&&i.rotation.fromArray(e.rotation),void 0!==e.quaternion&&i.quaternion.fromArray(e.quaternion),void 0!==e.scale&&i.scale.fromArray(e.scale)),void 0!==e.castShadow&&(i.castShadow=e.castShadow),void 0!==e.receiveShadow&&(i.receiveShadow=e.receiveShadow),e.shadow&&(void 0!==e.shadow.bias&&(i.shadow.bias=e.shadow.bias),void 0!==e.shadow.radius&&(i.shadow.radius=e.shadow.radius),void 0!==e.shadow.mapSize&&i.shadow.mapSize.fromArray(e.shadow.mapSize),void 0!==e.shadow.camera&&(i.shadow.camera=this.parseObject(e.shadow.camera))),void 0!==e.visible&&(i.visible=e.visible),void 0!==e.frustumCulled&&(i.frustumCulled=e.frustumCulled),void 0!==e.renderOrder&&(i.renderOrder=e.renderOrder),void 0!==e.userData&&(i.userData=e.userData),void 0!==e.children)for(var c=e.children,h=0;h<c.length;h++)i.add(this.parseObject(c[h],t,a));if("LOD"===e.type)for(var l=e.levels,u=0;u<l.length;u++){var d=l[u],p=i.getObjectByProperty("uuid",d.object);void 0!==p&&i.addLevel(p,d.distance)}return i}});var lh,uh={UVMapping:300,CubeReflectionMapping:pe,CubeRefractionMapping:fe,EquirectangularReflectionMapping:me,EquirectangularRefractionMapping:ge,SphericalReflectionMapping:ve,CubeUVReflectionMapping:ye,CubeUVRefractionMapping:xe},dh={RepeatWrapping:we,ClampToEdgeWrapping:be,MirroredRepeatWrapping:_e},ph={NearestFilter:Me,NearestMipMapNearestFilter:Ee,NearestMipMapLinearFilter:Te,LinearFilter:Se,LinearMipMapNearestFilter:Ce,LinearMipMapLinearFilter:Pe};function fh(e){"undefined"==typeof createImageBitmap&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),"undefined"==typeof fetch&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.manager=void 0!==e?e:Ks,this.options=void 0}function mh(){this.type="ShapePath",this.color=new yi,this.subPaths=[],this.currentPath=null}function gh(e){this.type="Font",this.data=e}function vh(e,t,i,n,r,a){var o=a.glyphs[e]||a.glyphs["?"];if(o){var s,c,h,l,u,d,p,f,m=new mh;if(o.o)for(var g=o._cachedOutline||(o._cachedOutline=o.o.split(" ")),v=0,y=g.length;v<y;){switch(g[v++]){case"m":s=g[v++]*i+n,c=g[v++]*i+r,m.moveTo(s,c);break;case"l":s=g[v++]*i+n,c=g[v++]*i+r,m.lineTo(s,c);break;case"q":h=g[v++]*i+n,l=g[v++]*i+r,u=g[v++]*i+n,d=g[v++]*i+r,m.quadraticCurveTo(u,d,h,l);break;case"b":h=g[v++]*i+n,l=g[v++]*i+r,u=g[v++]*i+n,d=g[v++]*i+r,p=g[v++]*i+n,f=g[v++]*i+r,m.bezierCurveTo(u,d,p,f,h,l)}}return{offsetX:o.ha*i,path:m}}}function yh(e){this.manager=void 0!==e?e:Ks}fh.prototype={constructor:fh,setOptions:function(e){return this.options=e,this},load:function(t,i,e,n){void 0===t&&(t=""),void 0!==this.path&&(t=this.path+t),t=this.manager.resolveURL(t);var r=this,a=Js.get(t);if(void 0!==a)return r.manager.itemStart(t),setTimeout(function(){i&&i(a),r.manager.itemEnd(t)},0),a;fetch(t).then(function(e){return e.blob()}).then(function(e){return createImageBitmap(e,r.options)}).then(function(e){Js.add(t,e),i&&i(e),r.manager.itemEnd(t)}).catch(function(e){n&&n(e),r.manager.itemEnd(t),r.manager.itemError(t)})},setCrossOrigin:function(){return this},setPath:function(e){return this.path=e,this}},Object.assign(mh.prototype,{moveTo:function(e,t){this.currentPath=new Ac,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t)},lineTo:function(e,t){this.currentPath.lineTo(e,t)},quadraticCurveTo:function(e,t,i,n){this.currentPath.quadraticCurveTo(e,t,i,n)},bezierCurveTo:function(e,t,i,n,r,a){this.currentPath.bezierCurveTo(e,t,i,n,r,a)},splineThru:function(e){this.currentPath.splineThru(e)},toShapes:function(e,t){function i(e){for(var t=[],i=0,n=e.length;i<n;i++){var r=e[i],a=new Lc;a.curves=r.curves,t.push(a)}return t}function n(e,t){for(var i=t.length,n=!1,r=i-1,a=0;a<i;r=a++){var o=t[r],s=t[a],c=s.x-o.x,h=s.y-o.y;if(Math.abs(h)>Number.EPSILON){if(h<0&&(o=t[a],c=-c,s=t[r],h=-h),e.y<o.y||e.y>s.y)continue;if(e.y===o.y){if(e.x===o.x)return!0}else{var l=h*(e.x-o.x)-c*(e.y-o.y);if(0===l)return!0;if(l<0)continue;n=!n}}else{if(e.y!==o.y)continue;if(s.x<=e.x&&e.x<=o.x||o.x<=e.x&&e.x<=s.x)return!0}}return n}var r=ms.isClockWise,a=this.subPaths;if(0===a.length)return[];if(!0===t)return i(a);var o,s,c,h=[];if(1===a.length)return s=a[0],(c=new Lc).curves=s.curves,h.push(c),h;var l=!r(a[0].getPoints());l=e?!l:l;var u,d,p=[],f=[],m=[],g=0;f[g]=void 0,m[g]=[];for(var v=0,y=a.length;v<y;v++)o=r(u=(s=a[v]).getPoints()),(o=e?!o:o)?(!l&&f[g]&&g++,f[g]={s:new Lc,p:u},f[g].s.curves=s.curves,l&&g++,m[g]=[]):m[g].push({h:s,p:u[0]});if(!f[0])return i(a);if(1<f.length){for(var x=!1,w=[],b=0,_=f.length;b<_;b++)p[b]=[];for(b=0,_=f.length;b<_;b++)for(var M=m[b],E=0;E<M.length;E++){for(var T=M[E],S=!0,A=0;A<f.length;A++)n(T.p,f[A].p)&&(b!==A&&w.push({froms:b,tos:A,hole:E}),S?(S=!1,p[A].push(T)):x=!0);S&&p[b].push(T)}0<w.length&&(x||(m=p))}v=0;for(var L=f.length;v<L;v++){c=f[v].s,h.push(c);for(var R=0,C=(d=m[v]).length;R<C;R++)c.holes.push(d[R].h)}return h}}),Object.assign(gh.prototype,{isFont:!0,generateShapes:function(e,t,i){void 0===t&&(t=100),void 0===i&&(i=4);for(var n=[],r=function(e,t,i,n){for(var r=String(e).split(""),a=t/n.resolution,o=(n.boundingBox.yMax-n.boundingBox.yMin+n.underlineThickness)*a,s=[],c=0,h=0,l=0;l<r.length;l++){var u=r[l];if("\n"===u)c=0,h-=o;else{var d=vh(u,i,a,c,h,n);c+=d.offsetX,s.push(d.path)}}return s}(e,t,i,this.data),a=0,o=r.length;a<o;a++)Array.prototype.push.apply(n,r[a].toShapes());return n}}),Object.assign(yh.prototype,{load:function(e,n,t,i){var r=this,a=new ec(this.manager);a.setPath(this.path),a.load(e,function(t){var i;try{i=JSON.parse(t)}catch(e){console.warn("THREE.FontLoader: typeface.js support is being deprecated. Use typeface.json instead."),i=JSON.parse(t.substring(65,t.length-2))}var e=r.parse(i);n&&n(e)},t,i)},parse:function(e){return new gh(e)},setPath:function(e){return this.path=e,this}});var xh,wh,bh,_h,Mh,Eh,Th,Sh,Ah,Lh,Rh,Ch,Ph,Oh,Ih,Nh={getContext:function(){return void 0===lh&&(lh=new(window.AudioContext||window.webkitAudioContext)),lh},setContext:function(e){lh=e}};function Bh(e){this.manager=void 0!==e?e:Ks}function Uh(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new ro,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new ro,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1}function Dh(e,t,i){Wi.call(this),this.type="CubeCamera";var r=new ro(90,1,e,t);r.up.set(0,-1,0),r.lookAt(new zt(1,0,0)),this.add(r);var a=new ro(90,1,e,t);a.up.set(0,-1,0),a.lookAt(new zt(-1,0,0)),this.add(a);var o=new ro(90,1,e,t);o.up.set(0,0,1),o.lookAt(new zt(0,1,0)),this.add(o);var s=new ro(90,1,e,t);s.up.set(0,0,-1),s.lookAt(new zt(0,-1,0)),this.add(s);var c=new ro(90,1,e,t);c.up.set(0,-1,0),c.lookAt(new zt(0,0,1)),this.add(c);var h=new ro(90,1,e,t);h.up.set(0,-1,0),h.lookAt(new zt(0,0,-1)),this.add(h);var n={format:We,magFilter:Se,minFilter:Se};this.renderTarget=new ci(i,i,n),this.renderTarget.texture.name="CubeCamera",this.update=function(e,t){null===this.parent&&this.updateMatrixWorld();var i=this.renderTarget,n=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,i.activeCubeFace=0,e.render(t,r,i),i.activeCubeFace=1,e.render(t,a,i),i.activeCubeFace=2,e.render(t,o,i),i.activeCubeFace=3,e.render(t,s,i),i.activeCubeFace=4,e.render(t,c,i),i.texture.generateMipmaps=n,i.activeCubeFace=5,e.render(t,h,i),e.setRenderTarget(null)},this.clear=function(e,t,i,n){for(var r=this.renderTarget,a=0;a<6;a++)r.activeCubeFace=a,e.setRenderTarget(r),e.clear(t,i,n);e.setRenderTarget(null)}}function Fh(){Wi.call(this),this.type="AudioListener",this.context=Nh.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null}function Hh(e){Wi.call(this),this.type="Audio",this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.loop=!1,this.startTime=0,this.offset=0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.sourceType="empty",this.filters=[]}function zh(e){Hh.call(this,e),this.panner=this.context.createPanner(),this.panner.connect(this.gain)}function Gh(e,t){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=void 0!==t?t:2048,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}function kh(e,t,i){this.binding=e,this.valueSize=i;var n,r=Float64Array;switch(t){case"quaternion":n=this._slerp;break;case"string":case"bool":r=Array,n=this._select;break;default:n=this._lerp}this.buffer=new r(4*i),this._mixBufferRegion=n,this.cumulativeWeight=0,this.useCount=0,this.referenceCount=0}Object.assign(Bh.prototype,{load:function(e,t,i,n){var r=new ec(this.manager);r.setResponseType("arraybuffer"),r.load(e,function(e){Nh.getContext().decodeAudioData(e,function(e){t(e)})},i,n)}}),Object.assign(Uh.prototype,{update:(Ah=new Ft,Lh=new Ft,function(e){if(xh!==this||wh!==e.focus||bh!==e.fov||_h!==e.aspect*this.aspect||Mh!==e.near||Eh!==e.far||Th!==e.zoom||Sh!==this.eyeSep){xh=this,wh=e.focus,bh=e.fov,_h=e.aspect*this.aspect,Mh=e.near,Eh=e.far,Th=e.zoom;var t,i,n=e.projectionMatrix.clone(),r=(Sh=this.eyeSep/2)*Mh/wh,a=Mh*Math.tan(Ut.DEG2RAD*bh*.5)/Th;Lh.elements[12]=-Sh,Ah.elements[12]=Sh,t=-a*_h+r,i=a*_h+r,n.elements[0]=2*Mh/(i-t),n.elements[8]=(i+t)/(i-t),this.cameraL.projectionMatrix.copy(n),t=-a*_h-r,i=a*_h-r,n.elements[0]=2*Mh/(i-t),n.elements[8]=(i+t)/(i-t),this.cameraR.projectionMatrix.copy(n)}this.cameraL.matrixWorld.copy(e.matrixWorld).multiply(Lh),this.cameraR.matrixWorld.copy(e.matrixWorld).multiply(Ah)})}),(Dh.prototype=Object.create(Wi.prototype)).constructor=Dh,Fh.prototype=Object.assign(Object.create(Wi.prototype),{constructor:Fh,getInput:function(){return this.gain},removeFilter:function(){null!==this.filter&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null)},getFilter:function(){return this.filter},setFilter:function(e){null!==this.filter?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=e,this.gain.connect(this.filter),this.filter.connect(this.context.destination)},getMasterVolume:function(){return this.gain.gain.value},setMasterVolume:function(e){this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01)},updateMatrixWorld:(Rh=new zt,Ch=new Ht,Ph=new zt,Oh=new zt,function(e){Wi.prototype.updateMatrixWorld.call(this,e);var t=this.context.listener,i=this.up;this.matrixWorld.decompose(Rh,Ch,Ph),Oh.set(0,0,-1).applyQuaternion(Ch),t.positionX?(t.positionX.setValueAtTime(Rh.x,this.context.currentTime),t.positionY.setValueAtTime(Rh.y,this.context.currentTime),t.positionZ.setValueAtTime(Rh.z,this.context.currentTime),t.forwardX.setValueAtTime(Oh.x,this.context.currentTime),t.forwardY.setValueAtTime(Oh.y,this.context.currentTime),t.forwardZ.setValueAtTime(Oh.z,this.context.currentTime),t.upX.setValueAtTime(i.x,this.context.currentTime),t.upY.setValueAtTime(i.y,this.context.currentTime),t.upZ.setValueAtTime(i.z,this.context.currentTime)):(t.setPosition(Rh.x,Rh.y,Rh.z),t.setOrientation(Oh.x,Oh.y,Oh.z,i.x,i.y,i.z))})}),Hh.prototype=Object.assign(Object.create(Wi.prototype),{constructor:Hh,getOutput:function(){return this.gain},setNodeSource:function(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this},setMediaElementSource:function(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this},setBuffer:function(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this},play:function(){if(!0!==this.isPlaying){if(!1!==this.hasPlaybackControl){var e=this.context.createBufferSource();return e.buffer=this.buffer,e.loop=this.loop,e.onended=this.onEnded.bind(this),e.playbackRate.setValueAtTime(this.playbackRate,this.startTime),this.startTime=this.context.currentTime,e.start(this.startTime,this.offset),this.isPlaying=!0,this.source=e,this.connect()}console.warn("THREE.Audio: this Audio has no playback control.")}else console.warn("THREE.Audio: Audio is already playing.")},pause:function(){if(!1!==this.hasPlaybackControl)return!0===this.isPlaying&&(this.source.stop(),this.offset+=(this.context.currentTime-this.startTime)*this.playbackRate,this.isPlaying=!1),this;console.warn("THREE.Audio: this Audio has no playback control.")},stop:function(){if(!1!==this.hasPlaybackControl)return this.source.stop(),this.offset=0,this.isPlaying=!1,this;console.warn("THREE.Audio: this Audio has no playback control.")},connect:function(){if(0<this.filters.length){this.source.connect(this.filters[0]);for(var e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this},disconnect:function(){if(0<this.filters.length){this.source.disconnect(this.filters[0]);for(var e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this},getFilters:function(){return this.filters},setFilters:function(e){return e||(e=[]),!0===this.isPlaying?(this.disconnect(),this.filters=e,this.connect()):this.filters=e,this},getFilter:function(){return this.getFilters()[0]},setFilter:function(e){return this.setFilters(e?[e]:[])},setPlaybackRate:function(e){if(!1!==this.hasPlaybackControl)return this.playbackRate=e,!0===this.isPlaying&&this.source.playbackRate.setValueAtTime(this.playbackRate,this.context.currentTime),this;console.warn("THREE.Audio: this Audio has no playback control.")},getPlaybackRate:function(){return this.playbackRate},onEnded:function(){this.isPlaying=!1},getLoop:function(){return!1===this.hasPlaybackControl?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop},setLoop:function(e){if(!1!==this.hasPlaybackControl)return this.loop=e,!0===this.isPlaying&&(this.source.loop=this.loop),this;console.warn("THREE.Audio: this Audio has no playback control.")},getVolume:function(){return this.gain.gain.value},setVolume:function(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}}),zh.prototype=Object.assign(Object.create(Hh.prototype),{constructor:zh,getOutput:function(){return this.panner},getRefDistance:function(){return this.panner.refDistance},setRefDistance:function(e){this.panner.refDistance=e},getRolloffFactor:function(){return this.panner.rolloffFactor},setRolloffFactor:function(e){this.panner.rolloffFactor=e},getDistanceModel:function(){return this.panner.distanceModel},setDistanceModel:function(e){this.panner.distanceModel=e},getMaxDistance:function(){return this.panner.maxDistance},setMaxDistance:function(e){this.panner.maxDistance=e},updateMatrixWorld:(Ih=new zt,function(e){Wi.prototype.updateMatrixWorld.call(this,e),Ih.setFromMatrixPosition(this.matrixWorld),this.panner.setPosition(Ih.x,Ih.y,Ih.z)})}),Object.assign(Gh.prototype,{getFrequencyData:function(){return this.analyser.getByteFrequencyData(this.data),this.data},getAverageFrequency:function(){for(var e=0,t=this.getFrequencyData(),i=0;i<t.length;i++)e+=t[i];return e/t.length}}),Object.assign(kh.prototype,{accumulate:function(e,t){var i=this.buffer,n=this.valueSize,r=e*n+n,a=this.cumulativeWeight;if(0===a){for(var o=0;o!==n;++o)i[r+o]=i[o];a=t}else{var s=t/(a+=t);this._mixBufferRegion(i,r,0,s,n)}this.cumulativeWeight=a},apply:function(e){var t=this.valueSize,i=this.buffer,n=e*t+t,r=this.cumulativeWeight,a=this.binding;if(this.cumulativeWeight=0,r<1){var o=3*t;this._mixBufferRegion(i,n,o,1-r,t)}for(var s=t,c=t+t;s!==c;++s)if(i[s]!==i[s+t]){a.setValue(i,n);break}},saveOriginalState:function(){var e=this.binding,t=this.buffer,i=this.valueSize,n=3*i;e.getValue(t,n);for(var r=i,a=n;r!==a;++r)t[r]=t[n+r%i];this.cumulativeWeight=0},restoreOriginalState:function(){var e=3*this.valueSize;this.binding.setValue(this.buffer,e)},_select:function(e,t,i,n,r){if(.5<=n)for(var a=0;a!==r;++a)e[t+a]=e[i+a]},_slerp:function(e,t,i,n){Ht.slerpFlat(e,t,e,t,e,i,n)},_lerp:function(e,t,i,n,r){for(var a=1-n,o=0;o!==r;++o){var s=t+o;e[s]=e[s]*a+e[i+o]*n}}});var Vh,jh,Wh,Xh,qh,Yh,Zh,Jh,Qh,Kh,$h,el,tl,il,nl,rl,al,ol,sl,cl,hl,ll,ul,dl,pl,fl,ml,gl,vl,yl,xl,wl,bl,_l="\\[\\]\\.:\\/";function Ml(e,t,i){var n=i||El.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,n)}function El(e,t,i){this.path=t,this.parsedPath=i||El.parseTrackName(t),this.node=El.findNode(e,this.parsedPath.nodeName)||e,this.rootNode=e}function Tl(){this.uuid=Ut.generateUUID(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;var e={};this._indicesByUUID=e;for(var t=0,i=arguments.length;t!==i;++t)e[arguments[t].uuid]=t;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};var n=this;this.stats={objects:{get total(){return n._objects.length},get inUse(){return this.total-n.nCachedObjects_}},get bindingsPerObject(){return n._bindings.length}}}function Sl(e,t,i){this._mixer=e,this._clip=t,this._localRoot=i||null;for(var n=t.tracks,r=n.length,a=new Array(r),o={endingStart:Mt,endingEnd:Mt},s=0;s!==r;++s){var c=n[s].createInterpolant(null);(a[s]=c).settings=o}this._interpolantSettings=o,this._interpolants=a,this._propertyBindings=new Array(r),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=2201,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}function Al(e){this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}function Ll(e){"string"==typeof e&&(console.warn("THREE.Uniform: Type parameter is no longer needed."),e=arguments[1]),this.value=e}function Rl(){Ln.call(this),this.type="InstancedBufferGeometry",this.maxInstancedCount=void 0}function Cl(e,t,i,n){this.data=e,this.itemSize=t,this.offset=i,this.normalized=!0===n}function Pl(e,t){this.array=e,this.stride=t,this.count=void 0!==e?e.length/t:0,this.dynamic=!1,this.updateRange={offset:0,count:-1},this.version=0}function Ol(e,t,i){Pl.call(this,e,t),this.meshPerAttribute=i||1}function Il(e,t,i){an.call(this,e,t),this.meshPerAttribute=i||1}function Nl(e,t,i,n){this.ray=new sr(e,t),this.near=i||0,this.far=n||1/0,this.params={Mesh:{},Line:{},LOD:{},Points:{threshold:1},Sprite:{}},Object.defineProperties(this.params,{PointCloud:{get:function(){return console.warn("THREE.Raycaster: params.PointCloud has been renamed to params.Points."),this.Points}}})}function Bl(e,t){return e.distance-t.distance}function Ul(e,t,i,n){if(!1!==e.visible&&(e.raycast(t,i),!0===n))for(var r=e.children,a=0,o=r.length;a<o;a++)Ul(r[a],t,i,!0)}function Dl(e){this.autoStart=void 0===e||e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}function Fl(e,t,i){return this.radius=void 0!==e?e:1,this.phi=void 0!==t?t:0,this.theta=void 0!==i?i:0,this}function Hl(e,t,i){return this.radius=void 0!==e?e:1,this.theta=void 0!==t?t:0,this.y=void 0!==i?i:0,this}function zl(e,t){this.min=void 0!==e?e:new Dt(1/0,1/0),this.max=void 0!==t?t:new Dt(-1/0,-1/0)}function Gl(e){Wi.call(this),this.material=e,this.render=function(){}}function kl(e,t,i,n){this.object=e,this.size=void 0!==t?t:1;var r=void 0!==i?i:16711680,a=void 0!==n?n:1,o=0,s=this.object.geometry;s&&s.isGeometry?o=3*s.faces.length:s&&s.isBufferGeometry&&(o=s.attributes.normal.count);var c=new Ln,h=new pn(2*o*3,3);c.addAttribute("position",h),bo.call(this,c,new xo({color:r,linewidth:a})),this.matrixAutoUpdate=!1,this.update()}function Vl(e,t){Wi.call(this),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=t;for(var i=new Ln,n=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1],r=0,a=1;r<32;r++,a++){var o=r/32*Math.PI*2,s=a/32*Math.PI*2;n.push(Math.cos(o),Math.sin(o),1,Math.cos(s),Math.sin(s),1)}i.addAttribute("position",new pn(n,3));var c=new xo({fog:!1});this.cone=new bo(i,c),this.add(this.cone),this.update()}function jl(e){for(var t=function e(t){var i=[];t&&t.isBone&&i.push(t);for(var n=0;n<t.children.length;n++)i.push.apply(i,e(t.children[n]));return i}(e),i=new Ln,n=[],r=[],a=new yi(0,0,1),o=new yi(0,1,0),s=0;s<t.length;s++){var c=t[s];c.parent&&c.parent.isBone&&(n.push(0,0,0),n.push(0,0,0),r.push(a.r,a.g,a.b),r.push(o.r,o.g,o.b))}i.addAttribute("position",new pn(n,3)),i.addAttribute("color",new pn(r,3));var h=new xo({vertexColors:_,depthTest:!1,depthWrite:!1,transparent:!0});bo.call(this,i,h),this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}function Wl(e,t,i){this.light=e,this.light.updateMatrixWorld(),this.color=i;var n=new Es(t,4,2),r=new ar({wireframe:!0,fog:!1});lr.call(this,n,r),this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}function Xl(e,t){Wi.call(this),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=t;var i=new xo({fog:!1}),n=new Ln;n.addAttribute("position",new an(new Float32Array(15),3)),this.line=new wo(n,i),this.add(this.line),this.update()}function ql(e,t,i){Wi.call(this),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=i;var n=new Do(t);n.rotateY(.5*Math.PI),this.material=new ar({wireframe:!0,fog:!1}),void 0===this.color&&(this.material.vertexColors=_);var r=n.getAttribute("position"),a=new Float32Array(3*r.count);n.addAttribute("color",new an(a,3)),this.add(new lr(n,this.material)),this.update()}function Yl(e,t,i,n){e=e||10,t=t||10,i=new yi(void 0!==i?i:4473924),n=new yi(void 0!==n?n:8947848);for(var r=t/2,a=e/t,o=e/2,s=[],c=[],h=0,l=0,u=-o;h<=t;h++,u+=a){s.push(-o,0,u,o,0,u),s.push(u,0,-o,u,0,o);var d=h===r?i:n;d.toArray(c,l),l+=3,d.toArray(c,l),l+=3,d.toArray(c,l),l+=3,d.toArray(c,l),l+=3}var p=new Ln;p.addAttribute("position",new pn(s,3)),p.addAttribute("color",new pn(c,3));var f=new xo({vertexColors:_});bo.call(this,p,f)}function Zl(e,t,i,n,r,a){e=e||10,t=t||16,i=i||8,n=n||64,r=new yi(void 0!==r?r:4473924),a=new yi(void 0!==a?a:8947848);var o,s,c,h,l,u,d,p=[],f=[];for(h=0;h<=t;h++)c=h/t*(2*Math.PI),o=Math.sin(c)*e,s=Math.cos(c)*e,p.push(0,0,0),p.push(o,0,s),d=1&h?r:a,f.push(d.r,d.g,d.b),f.push(d.r,d.g,d.b);for(h=0;h<=i;h++)for(d=1&h?r:a,u=e-e/i*h,l=0;l<n;l++)c=l/n*(2*Math.PI),o=Math.sin(c)*u,s=Math.cos(c)*u,p.push(o,0,s),f.push(d.r,d.g,d.b),c=(l+1)/n*(2*Math.PI),o=Math.sin(c)*u,s=Math.cos(c)*u,p.push(o,0,s),f.push(d.r,d.g,d.b);var m=new Ln;m.addAttribute("position",new pn(p,3)),m.addAttribute("color",new pn(f,3));var g=new xo({vertexColors:_});bo.call(this,m,g)}function Jl(e,t,i,n){this.object=e,this.size=void 0!==t?t:1;var r=void 0!==i?i:16776960,a=void 0!==n?n:1,o=0,s=this.object.geometry;s&&s.isGeometry?o=s.faces.length:console.warn("THREE.FaceNormalsHelper: only THREE.Geometry is supported. Use THREE.VertexNormalsHelper, instead.");var c=new Ln,h=new pn(2*o*3,3);c.addAttribute("position",h),bo.call(this,c,new xo({color:r,linewidth:a})),this.matrixAutoUpdate=!1,this.update()}function Ql(e,t,i){Wi.call(this),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=i,void 0===t&&(t=1);var n=new Ln;n.addAttribute("position",new pn([-t,t,0,t,t,0,t,-t,0,-t,-t,0,-t,t,0],3));var r=new xo({fog:!1});this.lightPlane=new wo(n,r),this.add(this.lightPlane),(n=new Ln).addAttribute("position",new pn([0,0,0,0,0,1],3)),this.targetLine=new wo(n,r),this.add(this.targetLine),this.update()}function Kl(e){var t=new Ln,i=new xo({color:16777215,vertexColors:1}),n=[],r=[],a={},o=new yi(16755200),s=new yi(16711680),c=new yi(43775),h=new yi(16777215),l=new yi(3355443);function u(e,t,i){d(e,i),d(t,i)}function d(e,t){n.push(0,0,0),r.push(t.r,t.g,t.b),void 0===a[e]&&(a[e]=[]),a[e].push(n.length/3-1)}u("n1","n2",o),u("n2","n4",o),u("n4","n3",o),u("n3","n1",o),u("f1","f2",o),u("f2","f4",o),u("f4","f3",o),u("f3","f1",o),u("n1","f1",o),u("n2","f2",o),u("n3","f3",o),u("n4","f4",o),u("p","n1",s),u("p","n2",s),u("p","n3",s),u("p","n4",s),u("u1","u2",c),u("u2","u3",c),u("u3","u1",c),u("c","t",h),u("p","c",l),u("cn1","cn2",l),u("cn3","cn4",l),u("cf1","cf2",l),u("cf3","cf4",l),t.addAttribute("position",new pn(n,3)),t.addAttribute("color",new pn(r,3)),bo.call(this,t,i),this.camera=e,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=a,this.update()}function $l(e,t){this.object=e,void 0===t&&(t=16776960);var i=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),n=new Float32Array(24),r=new Ln;r.setIndex(new an(i,1)),r.addAttribute("position",new an(n,3)),bo.call(this,r,new xo({color:t})),this.matrixAutoUpdate=!1,this.update()}function eu(e,t){this.type="Box3Helper",this.box=e;var i=void 0!==t?t:16776960,n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),r=new Ln;r.setIndex(new an(n,1)),r.addAttribute("position",new pn([1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],3)),bo.call(this,r,new xo({color:i})),this.geometry.computeBoundingSphere()}function tu(e,t,i){this.type="PlaneHelper",this.plane=e,this.size=void 0===t?1:t;var n=void 0!==i?i:16776960,r=new Ln;r.addAttribute("position",new pn([1,-1,1,-1,1,1,-1,-1,1,1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,1,0,0,1,0,0,0],3)),r.computeBoundingSphere(),wo.call(this,r,new xo({color:n}));var a=new Ln;a.addAttribute("position",new pn([1,1,1,-1,1,1,-1,-1,1,1,1,1,-1,-1,1,1,-1,1],3)),a.computeBoundingSphere(),this.add(new lr(a,new ar({color:n,opacity:.2,transparent:!0,depthWrite:!1})))}function iu(e,t,i,n,r,a){Wi.call(this),void 0===n&&(n=16776960),void 0===i&&(i=1),void 0===r&&(r=.2*i),void 0===a&&(a=.2*r),void 0===yl&&((yl=new Ln).addAttribute("position",new pn([0,0,0,0,1,0],3)),(xl=new Ns(0,.5,1,5,1)).translate(0,-.5,0)),this.position.copy(t),this.line=new wo(yl,new xo({color:n})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new lr(xl,new ar({color:n})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(i,r,a)}function nu(e){var t=[0,0,0,e=e||1,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=new Ln;i.addAttribute("position",new pn(t,3)),i.addAttribute("color",new pn([1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],3));var n=new xo({vertexColors:_});bo.call(this,i,n)}Object.assign(Ml.prototype,{getValue:function(e,t){this.bind();var i=this._targetGroup.nCachedObjects_,n=this._bindings[i];void 0!==n&&n.getValue(e,t)},setValue:function(e,t){for(var i=this._bindings,n=this._targetGroup.nCachedObjects_,r=i.length;n!==r;++n)i[n].setValue(e,t)},bind:function(){for(var e=this._bindings,t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()},unbind:function(){for(var e=this._bindings,t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}}),Object.assign(El,{Composite:Ml,create:function(e,t,i){return e&&e.isAnimationObjectGroup?new El.Composite(e,t,i):new El(e,t,i)},sanitizeNodeName:(Qh=new RegExp("["+_l+"]","g"),function(e){return e.replace(/\s/g,"_").replace(Qh,"")}),parseTrackName:(Vh="[^"+_l+"]",jh="[^"+_l.replace("\\.","")+"]",Wh=/((?:WC+[\/:])*)/.source.replace("WC",Vh),Xh=/(WCOD+)?/.source.replace("WCOD",jh),qh=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Vh),Yh=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Vh),Zh=new RegExp("^"+Wh+Xh+qh+Yh+"$"),Jh=["material","materials","bones"],function(e){var t=Zh.exec(e);if(!t)throw new Error("PropertyBinding: Cannot parse trackName: "+e);var i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},n=i.nodeName&&i.nodeName.lastIndexOf(".");if(void 0!==n&&-1!==n){var r=i.nodeName.substring(n+1);-1!==Jh.indexOf(r)&&(i.nodeName=i.nodeName.substring(0,n),i.objectName=r)}if(null===i.propertyName||0===i.propertyName.length)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}),findNode:function(e,r){if(!r||""===r||"root"===r||"."===r||-1===r||r===e.name||r===e.uuid)return e;if(e.skeleton){var t=e.skeleton.getBoneByName(r);if(void 0!==t)return t}if(e.children){var a=function(e){for(var t=0;t<e.length;t++){var i=e[t];if(i.name===r||i.uuid===r)return i;var n=a(i.children);if(n)return n}return null},i=a(e.children);if(i)return i}return null}}),Object.assign(El.prototype,{_getValue_unavailable:function(){},_setValue_unavailable:function(){},BindingType:{Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Versioning:{None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},GetterByBindingType:[function(e,t){e[t]=this.node[this.propertyName]},function(e,t){for(var i=this.resolvedProperty,n=0,r=i.length;n!==r;++n)e[t++]=i[n]},function(e,t){e[t]=this.resolvedProperty[this.propertyIndex]},function(e,t){this.resolvedProperty.toArray(e,t)}],SetterByBindingTypeAndVersioning:[[function(e,t){this.targetObject[this.propertyName]=e[t]},function(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0},function(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){for(var i=this.resolvedProperty,n=0,r=i.length;n!==r;++n)i[n]=e[t++]},function(e,t){for(var i=this.resolvedProperty,n=0,r=i.length;n!==r;++n)i[n]=e[t++];this.targetObject.needsUpdate=!0},function(e,t){for(var i=this.resolvedProperty,n=0,r=i.length;n!==r;++n)i[n]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){this.resolvedProperty[this.propertyIndex]=e[t]},function(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0},function(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){this.resolvedProperty.fromArray(e,t)},function(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0},function(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}]],getValue:function(e,t){this.bind(),this.getValue(e,t)},setValue:function(e,t){this.bind(),this.setValue(e,t)},bind:function(){var e=this.node,t=this.parsedPath,i=t.objectName,n=t.propertyName,r=t.propertyIndex;if(e||(e=El.findNode(this.rootNode,t.nodeName)||this.rootNode,this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,e){if(i){var a=t.objectIndex;switch(i){case"materials":if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.materials)return void console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);e=e.material.materials;break;case"bones":if(!e.skeleton)return void console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);e=e.skeleton.bones;for(var o=0;o<e.length;o++)if(e[o].name===a){a=o;break}break;default:if(void 0===e[i])return void console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);e=e[i]}if(void 0!==a){if(void 0===e[a])return void console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);e=e[a]}}var s=e[n];if(void 0!==s){var c=this.Versioning.None;void 0!==e.needsUpdate?(c=this.Versioning.NeedsUpdate,this.targetObject=e):void 0!==e.matrixWorldNeedsUpdate&&(c=this.Versioning.MatrixWorldNeedsUpdate,this.targetObject=e);var h=this.BindingType.Direct;if(void 0!==r){if("morphTargetInfluences"===n){if(!e.geometry)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);if(e.geometry.isBufferGeometry){if(!e.geometry.morphAttributes)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);for(o=0;o<this.node.geometry.morphAttributes.position.length;o++)if(e.geometry.morphAttributes.position[o].name===r){r=o;break}}else{if(!e.geometry.morphTargets)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphTargets.",this);for(o=0;o<this.node.geometry.morphTargets.length;o++)if(e.geometry.morphTargets[o].name===r){r=o;break}}}h=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else void 0!==s.fromArray&&void 0!==s.toArray?(h=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(h=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=n;this.getValue=this.GetterByBindingType[h],this.setValue=this.SetterByBindingTypeAndVersioning[h][c]}else{var l=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+l+"."+n+" but it wasn't found.",e)}}else console.error("THREE.PropertyBinding: Trying to update node for track: "+this.path+" but it wasn't found.")},unbind:function(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}),Object.assign(El.prototype,{_getValue_unbound:El.prototype.getValue,_setValue_unbound:El.prototype.setValue}),Object.assign(Tl.prototype,{isAnimationObjectGroup:!0,add:function(){for(var e=this._objects,t=e.length,i=this.nCachedObjects_,n=this._indicesByUUID,r=this._paths,a=this._parsedPaths,o=this._bindings,s=o.length,c=void 0,h=0,l=arguments.length;h!==l;++h){var u=arguments[h],d=u.uuid,p=n[d];if(void 0===p){p=t++,n[d]=p,e.push(u);for(var f=0,m=s;f!==m;++f)o[f].push(new El(u,r[f],a[f]))}else if(p<i){c=e[p];var g=--i,v=e[g];e[n[v.uuid]=p]=v,e[n[d]=g]=u;for(f=0,m=s;f!==m;++f){var y=o[f],x=y[g],w=y[p];y[p]=x,void 0===w&&(w=new El(u,r[f],a[f])),y[g]=w}}else e[p]!==c&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=i},remove:function(){for(var e=this._objects,t=this.nCachedObjects_,i=this._indicesByUUID,n=this._bindings,r=n.length,a=0,o=arguments.length;a!==o;++a){var s=arguments[a],c=s.uuid,h=i[c];if(void 0!==h&&t<=h){var l=t++,u=e[l];e[i[u.uuid]=h]=u,e[i[c]=l]=s;for(var d=0,p=r;d!==p;++d){var f=n[d],m=f[l],g=f[h];f[h]=m,f[l]=g}}}this.nCachedObjects_=t},uncache:function(){for(var e=this._objects,t=e.length,i=this.nCachedObjects_,n=this._indicesByUUID,r=this._bindings,a=r.length,o=0,s=arguments.length;o!==s;++o){var c=arguments[o].uuid,h=n[c];if(void 0!==h)if(delete n[c],h<i){var l=--i,u=e[l],d=e[v=--t];e[n[u.uuid]=h]=u,e[n[d.uuid]=l]=d,e.pop();for(var p=0,f=a;p!==f;++p){var m=(y=r[p])[l],g=y[v];y[h]=m,y[l]=g,y.pop()}}else{var v;e[n[(d=e[v=--t]).uuid]=h]=d,e.pop();for(p=0,f=a;p!==f;++p){var y;(y=r[p])[h]=y[v],y.pop()}}}this.nCachedObjects_=i},subscribe_:function(e,t){var i=this._bindingsIndicesByPath,n=i[e],r=this._bindings;if(void 0!==n)return r[n];var a=this._paths,o=this._parsedPaths,s=this._objects,c=s.length,h=this.nCachedObjects_,l=new Array(c);n=r.length,i[e]=n,a.push(e),o.push(t),r.push(l);for(var u=h,d=s.length;u!==d;++u){var p=s[u];l[u]=new El(p,e,t)}return l},unsubscribe_:function(e){var t=this._bindingsIndicesByPath,i=t[e];if(void 0!==i){var n=this._paths,r=this._parsedPaths,a=this._bindings,o=a.length-1,s=a[o];a[t[e[o]]=i]=s,a.pop(),r[i]=r[o],r.pop(),n[i]=n[o],n.pop()}}}),Object.assign(Sl.prototype,{play:function(){return this._mixer._activateAction(this),this},stop:function(){return this._mixer._deactivateAction(this),this.reset()},reset:function(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()},isRunning:function(){return this.enabled&&!this.paused&&0!==this.timeScale&&null===this._startTime&&this._mixer._isActiveAction(this)},isScheduled:function(){return this._mixer._isActiveAction(this)},startAt:function(e){return this._startTime=e,this},setLoop:function(e,t){return this.loop=e,this.repetitions=t,this},setEffectiveWeight:function(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()},getEffectiveWeight:function(){return this._effectiveWeight},fadeIn:function(e){return this._scheduleFading(e,0,1)},fadeOut:function(e){return this._scheduleFading(e,1,0)},crossFadeFrom:function(e,t,i){if(e.fadeOut(t),this.fadeIn(t),i){var n=this._clip.duration,r=e._clip.duration,a=r/n,o=n/r;e.warp(1,a,t),this.warp(o,1,t)}return this},crossFadeTo:function(e,t,i){return e.crossFadeFrom(this,t,i)},stopFading:function(){var e=this._weightInterpolant;return null!==e&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this},setEffectiveTimeScale:function(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()},getEffectiveTimeScale:function(){return this._effectiveTimeScale},setDuration:function(e){return this.timeScale=this._clip.duration/e,this.stopWarping()},syncWith:function(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()},halt:function(e){return this.warp(this._effectiveTimeScale,0,e)},warp:function(e,t,i){var n=this._mixer,r=n.time,a=this._timeScaleInterpolant,o=this.timeScale;null===a&&(a=n._lendControlInterpolant(),this._timeScaleInterpolant=a);var s=a.parameterPositions,c=a.sampleValues;return s[0]=r,s[1]=r+i,c[0]=e/o,c[1]=t/o,this},stopWarping:function(){var e=this._timeScaleInterpolant;return null!==e&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this},getMixer:function(){return this._mixer},getClip:function(){return this._clip},getRoot:function(){return this._localRoot||this._mixer._root},_update:function(e,t,i,n){if(this.enabled){var r=this._startTime;if(null!==r){var a=(e-r)*i;if(a<0||0===i)return;this._startTime=null,t=i*a}t*=this._updateTimeScale(e);var o=this._updateTime(t),s=this._updateWeight(e);if(0<s)for(var c=this._interpolants,h=this._propertyBindings,l=0,u=c.length;l!==u;++l)c[l].evaluate(o),h[l].accumulate(n,s)}else this._updateWeight(e)},_updateWeight:function(e){var t=0;if(this.enabled){t=this.weight;var i=this._weightInterpolant;if(null!==i){var n=i.evaluate(e)[0];t*=n,e>i.parameterPositions[1]&&(this.stopFading(),0===n&&(this.enabled=!1))}}return this._effectiveWeight=t},_updateTimeScale:function(e){var t=0;if(!this.paused){t=this.timeScale;var i=this._timeScaleInterpolant;if(null!==i)t*=i.evaluate(e)[0],e>i.parameterPositions[1]&&(this.stopWarping(),0===t?this.paused=!0:this.timeScale=t)}return this._effectiveTimeScale=t},_updateTime:function(e){var t=this.time+e;if(0===e)return t;var i=this._clip.duration,n=this.loop,r=this._loopCount;if(2200===n){-1===r&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i<=t)t=i;else{if(!(t<0))break e;t=0}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{var a=2202===n;if(-1===r&&(0<=e?(r=0,this._setEndings(!0,0===this.repetitions,a)):this._setEndings(0===this.repetitions,!0,a)),i<=t||t<0){var o=Math.floor(t/i);t-=i*o,r+=Math.abs(o);var s=this.repetitions-r;if(s<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,t=0<e?i:0,this._mixer.dispatchEvent({type:"finished",action:this,direction:0<e?1:-1});else{if(1===s){var c=e<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}if(a&&1==(1&r))return i-(this.time=t)}return this.time=t},_setEndings:function(e,t,i){var n=this._interpolantSettings;i?(n.endingStart=Et,n.endingEnd=Et):(n.endingStart=e?this.zeroSlopeAtStart?Et:Mt:Tt,n.endingEnd=t?this.zeroSlopeAtEnd?Et:Mt:Tt)},_scheduleFading:function(e,t,i){var n=this._mixer,r=n.time,a=this._weightInterpolant;null===a&&(a=n._lendControlInterpolant(),this._weightInterpolant=a);var o=a.parameterPositions,s=a.sampleValues;return o[0]=r,s[0]=t,o[1]=r+e,s[1]=i,this}}),Al.prototype=Object.assign(Object.create(t.prototype),{constructor:Al,_bindAction:function(e,t){var i=e._localRoot||this._root,n=e._clip.tracks,r=n.length,a=e._propertyBindings,o=e._interpolants,s=i.uuid,c=this._bindingsByRootAndName,h=c[s];void 0===h&&(h={},c[s]=h);for(var l=0;l!==r;++l){var u=n[l],d=u.name,p=h[d];if(void 0!==p)a[l]=p;else{if(void 0!==(p=a[l])){null===p._cacheIndex&&(++p.referenceCount,this._addInactiveBinding(p,s,d));continue}var f=t&&t._propertyBindings[l].binding.parsedPath;++(p=new kh(El.create(i,d,f),u.ValueTypeName,u.getValueSize())).referenceCount,this._addInactiveBinding(p,s,d),a[l]=p}o[l].resultBuffer=p.buffer}},_activateAction:function(e){if(!this._isActiveAction(e)){if(null===e._cacheIndex){var t=(e._localRoot||this._root).uuid,i=e._clip.uuid,n=this._actionsByClip[i];this._bindAction(e,n&&n.knownActions[0]),this._addInactiveAction(e,i,t)}for(var r=e._propertyBindings,a=0,o=r.length;a!==o;++a){var s=r[a];0==s.useCount++&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}},_deactivateAction:function(e){if(this._isActiveAction(e)){for(var t=e._propertyBindings,i=0,n=t.length;i!==n;++i){var r=t[i];0==--r.useCount&&(r.restoreOriginalState(),this._takeBackBinding(r))}this._takeBackAction(e)}},_initMemoryManager:function(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;var e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}},_isActiveAction:function(e){var t=e._cacheIndex;return null!==t&&t<this._nActiveActions},_addInactiveAction:function(e,t,i){var n=this._actions,r=this._actionsByClip,a=r[t];if(void 0===a)a={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,r[t]=a;else{var o=a.knownActions;e._byClipCacheIndex=o.length,o.push(e)}e._cacheIndex=n.length,n.push(e),a.actionByRoot[i]=e},_removeInactiveAction:function(e){var t=this._actions,i=t[t.length-1],n=e._cacheIndex;t[i._cacheIndex=n]=i,t.pop(),e._cacheIndex=null;var r=e._clip.uuid,a=this._actionsByClip,o=a[r],s=o.knownActions,c=s[s.length-1],h=e._byClipCacheIndex;s[c._byClipCacheIndex=h]=c,s.pop(),e._byClipCacheIndex=null,delete o.actionByRoot[(e._localRoot||this._root).uuid],0===s.length&&delete a[r],this._removeInactiveBindingsForAction(e)},_removeInactiveBindingsForAction:function(e){for(var t=e._propertyBindings,i=0,n=t.length;i!==n;++i){var r=t[i];0==--r.referenceCount&&this._removeInactiveBinding(r)}},_lendAction:function(e){var t=this._actions,i=e._cacheIndex,n=this._nActiveActions++,r=t[n];t[e._cacheIndex=n]=e,t[r._cacheIndex=i]=r},_takeBackAction:function(e){var t=this._actions,i=e._cacheIndex,n=--this._nActiveActions,r=t[n];t[e._cacheIndex=n]=e,t[r._cacheIndex=i]=r},_addInactiveBinding:function(e,t,i){var n=this._bindingsByRootAndName,r=n[t],a=this._bindings;void 0===r&&(r={},n[t]=r),(r[i]=e)._cacheIndex=a.length,a.push(e)},_removeInactiveBinding:function(e){var t=this._bindings,i=e.binding,n=i.rootNode.uuid,r=i.path,a=this._bindingsByRootAndName,o=a[n],s=t[t.length-1],c=e._cacheIndex;t[s._cacheIndex=c]=s,t.pop(),delete o[r];e:{for(var h in o)break e;delete a[n]}},_lendBinding:function(e){var t=this._bindings,i=e._cacheIndex,n=this._nActiveBindings++,r=t[n];t[e._cacheIndex=n]=e,t[r._cacheIndex=i]=r},_takeBackBinding:function(e){var t=this._bindings,i=e._cacheIndex,n=--this._nActiveBindings,r=t[n];t[e._cacheIndex=n]=e,t[r._cacheIndex=i]=r},_lendControlInterpolant:function(){var e=this._controlInterpolants,t=this._nActiveControlInterpolants++,i=e[t];return void 0===i&&(e[(i=new qc(new Float32Array(2),new Float32Array(2),1,this._controlInterpolantsResultBuffer)).__cacheIndex=t]=i),i},_takeBackControlInterpolant:function(e){var t=this._controlInterpolants,i=e.__cacheIndex,n=--this._nActiveControlInterpolants,r=t[n];t[e.__cacheIndex=n]=e,t[r.__cacheIndex=i]=r},_controlInterpolantsResultBuffer:new Float32Array(1),clipAction:function(e,t){var i=t||this._root,n=i.uuid,r="string"==typeof e?Kc.findByName(i,e):e,a=null!==r?r.uuid:e,o=this._actionsByClip[a],s=null;if(void 0!==o){var c=o.actionByRoot[n];if(void 0!==c)return c;s=o.knownActions[0],null===r&&(r=s._clip)}if(null===r)return null;var h=new Sl(this,r,t);return this._bindAction(h,s),this._addInactiveAction(h,a,n),h},existingAction:function(e,t){var i=t||this._root,n=i.uuid,r="string"==typeof e?Kc.findByName(i,e):e,a=r?r.uuid:e,o=this._actionsByClip[a];return void 0!==o&&o.actionByRoot[n]||null},stopAllAction:function(){var e=this._actions,t=this._nActiveActions,i=this._bindings,n=this._nActiveBindings;this._nActiveActions=0;for(var r=this._nActiveBindings=0;r!==t;++r)e[r].reset();for(r=0;r!==n;++r)i[r].useCount=0;return this},update:function(e){e*=this.timeScale;for(var t=this._actions,i=this._nActiveActions,n=this.time+=e,r=Math.sign(e),a=this._accuIndex^=1,o=0;o!==i;++o){t[o]._update(n,e,r,a)}var s=this._bindings,c=this._nActiveBindings;for(o=0;o!==c;++o)s[o].apply(a);return this},getRoot:function(){return this._root},uncacheClip:function(e){var t=this._actions,i=e.uuid,n=this._actionsByClip,r=n[i];if(void 0!==r){for(var a=r.knownActions,o=0,s=a.length;o!==s;++o){var c=a[o];this._deactivateAction(c);var h=c._cacheIndex,l=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,t[l._cacheIndex=h]=l,t.pop(),this._removeInactiveBindingsForAction(c)}delete n[i]}},uncacheRoot:function(e){var t=e.uuid,i=this._actionsByClip;for(var n in i){var r=i[n].actionByRoot[t];void 0!==r&&(this._deactivateAction(r),this._removeInactiveAction(r))}var a=this._bindingsByRootAndName[t];if(void 0!==a)for(var o in a){var s=a[o];s.restoreOriginalState(),this._removeInactiveBinding(s)}},uncacheAction:function(e,t){var i=this.existingAction(e,t);null!==i&&(this._deactivateAction(i),this._removeInactiveAction(i))}}),Ll.prototype.clone=function(){return new Ll(void 0===this.value.clone?this.value:this.value.clone())},Rl.prototype=Object.assign(Object.create(Ln.prototype),{constructor:Rl,isInstancedBufferGeometry:!0,copy:function(e){return Ln.prototype.copy.call(this,e),this.maxInstancedCount=e.maxInstancedCount,this},clone:function(){return(new this.constructor).copy(this)}}),Object.defineProperties(Cl.prototype,{count:{get:function(){return this.data.count}},array:{get:function(){return this.data.array}}}),Object.assign(Cl.prototype,{isInterleavedBufferAttribute:!0,setX:function(e,t){return this.data.array[e*this.data.stride+this.offset]=t,this},setY:function(e,t){return this.data.array[e*this.data.stride+this.offset+1]=t,this},setZ:function(e,t){return this.data.array[e*this.data.stride+this.offset+2]=t,this},setW:function(e,t){return this.data.array[e*this.data.stride+this.offset+3]=t,this},getX:function(e){return this.data.array[e*this.data.stride+this.offset]},getY:function(e){return this.data.array[e*this.data.stride+this.offset+1]},getZ:function(e){return this.data.array[e*this.data.stride+this.offset+2]},getW:function(e){return this.data.array[e*this.data.stride+this.offset+3]},setXY:function(e,t,i){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=i,this},setXYZ:function(e,t,i,n){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=n,this},setXYZW:function(e,t,i,n,r){return e=e*this.data.stride+this.offset,this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=n,this.data.array[e+3]=r,this}}),Object.defineProperty(Pl.prototype,"needsUpdate",{set:function(e){!0===e&&this.version++}}),Object.assign(Pl.prototype,{isInterleavedBuffer:!0,onUploadCallback:function(){},setArray:function(e){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");return this.count=void 0!==e?e.length/this.stride:0,this.array=e,this},setDynamic:function(e){return this.dynamic=e,this},copy:function(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.dynamic=e.dynamic,this},copyAt:function(e,t,i){e*=this.stride,i*=t.stride;for(var n=0,r=this.stride;n<r;n++)this.array[e+n]=t.array[i+n];return this},set:function(e,t){return void 0===t&&(t=0),this.array.set(e,t),this},clone:function(){return(new this.constructor).copy(this)},onUpload:function(e){return this.onUploadCallback=e,this}}),Ol.prototype=Object.assign(Object.create(Pl.prototype),{constructor:Ol,isInstancedInterleavedBuffer:!0,copy:function(e){return Pl.prototype.copy.call(this,e),this.meshPerAttribute=e.meshPerAttribute,this}}),Il.prototype=Object.assign(Object.create(an.prototype),{constructor:Il,isInstancedBufferAttribute:!0,copy:function(e){return an.prototype.copy.call(this,e),this.meshPerAttribute=e.meshPerAttribute,this}}),Object.assign(Nl.prototype,{linePrecision:1,set:function(e,t){this.ray.set(e,t)},setFromCamera:function(e,t){t&&t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize()):t&&t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld)):console.error("THREE.Raycaster: Unsupported camera type.")},intersectObject:function(e,t,i){var n=i||[];return Ul(e,this,n,t),n.sort(Bl),n},intersectObjects:function(e,t,i){var n=i||[];if(!1===Array.isArray(e))return console.warn("THREE.Raycaster.intersectObjects: objects is not an Array."),n;for(var r=0,a=e.length;r<a;r++)Ul(e[r],this,n,t);return n.sort(Bl),n}}),Object.assign(Dl.prototype,{start:function(){this.startTime=("undefined"==typeof performance?Date:performance).now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0},stop:function(){this.getElapsedTime(),this.running=!1,this.autoStart=!1},getElapsedTime:function(){return this.getDelta(),this.elapsedTime},getDelta:function(){var e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){var t=("undefined"==typeof performance?Date:performance).now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}),Object.assign(Fl.prototype,{set:function(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this},makeSafe:function(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this},setFromVector3:function(e){return this.radius=e.length(),0===this.radius?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e.x,e.z),this.phi=Math.acos(Ut.clamp(e.y/this.radius,-1,1))),this}}),Object.assign(Hl.prototype,{set:function(e,t,i){return this.radius=e,this.theta=t,this.y=i,this},clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.radius=e.radius,this.theta=e.theta,this.y=e.y,this},setFromVector3:function(e){return this.radius=Math.sqrt(e.x*e.x+e.z*e.z),this.theta=Math.atan2(e.x,e.z),this.y=e.y,this}}),Object.assign(zl.prototype,{set:function(e,t){return this.min.copy(e),this.max.copy(t),this},setFromPoints:function(e){this.makeEmpty();for(var t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this},setFromCenterAndSize:($h=new Dt,function(e,t){var i=$h.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}),clone:function(){return(new this.constructor).copy(this)},copy:function(e){return this.min.copy(e.min),this.max.copy(e.max),this},makeEmpty:function(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this},isEmpty:function(){return this.max.x<this.min.x||this.max.y<this.min.y},getCenter:function(e){return void 0===e&&(console.warn("THREE.Box2: .getCenter() target is now required"),e=new Dt),this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)},getSize:function(e){return void 0===e&&(console.warn("THREE.Box2: .getSize() target is now required"),e=new Dt),this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)},expandByPoint:function(e){return this.min.min(e),this.max.max(e),this},expandByVector:function(e){return this.min.sub(e),this.max.add(e),this},expandByScalar:function(e){return this.min.addScalar(-e),this.max.addScalar(e),this},containsPoint:function(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y)},containsBox:function(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y},getParameter:function(e,t){return void 0===t&&(console.warn("THREE.Box2: .getParameter() target is now required"),t=new Dt),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))},intersectsBox:function(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y)},clampPoint:function(e,t){return void 0===t&&(console.warn("THREE.Box2: .clampPoint() target is now required"),t=new Dt),t.copy(e).clamp(this.min,this.max)},distanceToPoint:(Kh=new Dt,function(e){return Kh.copy(e).clamp(this.min,this.max).sub(e).length()}),intersect:function(e){return this.min.max(e.min),this.max.min(e.max),this},union:function(e){return this.min.min(e.min),this.max.max(e.max),this},translate:function(e){return this.min.add(e),this.max.add(e),this},equals:function(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}),((Gl.prototype=Object.create(Wi.prototype)).constructor=Gl).prototype.isImmediateRenderObject=!0,((kl.prototype=Object.create(bo.prototype)).constructor=kl).prototype.update=(el=new zt,tl=new zt,il=new Gt,function(){var e=["a","b","c"];this.object.updateMatrixWorld(!0),il.getNormalMatrix(this.object.matrixWorld);var t=this.object.matrixWorld,i=this.geometry.attributes.position,n=this.object.geometry;if(n&&n.isGeometry)for(var r=n.vertices,a=n.faces,o=0,s=0,c=a.length;s<c;s++)for(var h=a[s],l=0,u=h.vertexNormals.length;l<u;l++){var d=r[h[e[l]]],p=h.vertexNormals[l];el.copy(d).applyMatrix4(t),tl.copy(p).applyMatrix3(il).normalize().multiplyScalar(this.size).add(el),i.setXYZ(o,el.x,el.y,el.z),o+=1,i.setXYZ(o,tl.x,tl.y,tl.z),o+=1}else if(n&&n.isBufferGeometry){var f=n.attributes.position,m=n.attributes.normal;for(l=o=0,u=f.count;l<u;l++)el.set(f.getX(l),f.getY(l),f.getZ(l)).applyMatrix4(t),tl.set(m.getX(l),m.getY(l),m.getZ(l)),tl.applyMatrix3(il).normalize().multiplyScalar(this.size).add(el),i.setXYZ(o,el.x,el.y,el.z),o+=1,i.setXYZ(o,tl.x,tl.y,tl.z),o+=1}i.needsUpdate=!0}),((Vl.prototype=Object.create(Wi.prototype)).constructor=Vl).prototype.dispose=function(){this.cone.geometry.dispose(),this.cone.material.dispose()},Vl.prototype.update=(nl=new zt,rl=new zt,function(){this.light.updateMatrixWorld();var e=this.light.distance?this.light.distance:1e3,t=e*Math.tan(this.light.angle);this.cone.scale.set(t,t,e),nl.setFromMatrixPosition(this.light.matrixWorld),rl.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(rl.sub(nl)),void 0!==this.color?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}),((jl.prototype=Object.create(bo.prototype)).constructor=jl).prototype.updateMatrixWorld=(al=new zt,ol=new Ft,sl=new Ft,function(e){var t=this.bones,i=this.geometry,n=i.getAttribute("position");sl.getInverse(this.root.matrixWorld);for(var r=0,a=0;r<t.length;r++){var o=t[r];o.parent&&o.parent.isBone&&(ol.multiplyMatrices(sl,o.matrixWorld),al.setFromMatrixPosition(ol),n.setXYZ(a,al.x,al.y,al.z),ol.multiplyMatrices(sl,o.parent.matrixWorld),al.setFromMatrixPosition(ol),n.setXYZ(a+1,al.x,al.y,al.z),a+=2)}i.getAttribute("position").needsUpdate=!0,Wi.prototype.updateMatrixWorld.call(this,e)}),((Wl.prototype=Object.create(lr.prototype)).constructor=Wl).prototype.dispose=function(){this.geometry.dispose(),this.material.dispose()},Wl.prototype.update=function(){void 0!==this.color?this.material.color.set(this.color):this.material.color.copy(this.light.color)},((Xl.prototype=Object.create(Wi.prototype)).constructor=Xl).prototype.dispose=function(){this.children[0].geometry.dispose(),this.children[0].material.dispose()},Xl.prototype.update=function(){var e=.5*this.light.width,t=.5*this.light.height,i=this.line.geometry.attributes.position,n=i.array;n[0]=e,n[1]=-t,n[2]=0,n[3]=e,n[4]=t,n[5]=0,n[6]=-e,n[7]=t,n[8]=0,n[9]=-e,n[10]=-t,n[11]=0,n[12]=e,n[13]=-t,n[14]=0,i.needsUpdate=!0,void 0!==this.color?this.line.material.color.set(this.color):this.line.material.color.copy(this.light.color)},((ql.prototype=Object.create(Wi.prototype)).constructor=ql).prototype.dispose=function(){this.children[0].geometry.dispose(),this.children[0].material.dispose()},ql.prototype.update=(cl=new zt,hl=new yi,ll=new yi,function(){var e=this.children[0];if(void 0!==this.color)this.material.color.set(this.color);else{var t=e.geometry.getAttribute("color");hl.copy(this.light.color),ll.copy(this.light.groundColor);for(var i=0,n=t.count;i<n;i++){var r=i<n/2?hl:ll;t.setXYZ(i,r.r,r.g,r.b)}t.needsUpdate=!0}e.lookAt(cl.setFromMatrixPosition(this.light.matrixWorld).negate())}),(Yl.prototype=Object.create(bo.prototype)).constructor=Yl,(Zl.prototype=Object.create(bo.prototype)).constructor=Zl,((Jl.prototype=Object.create(bo.prototype)).constructor=Jl).prototype.update=(ul=new zt,dl=new zt,pl=new Gt,function(){this.object.updateMatrixWorld(!0),pl.getNormalMatrix(this.object.matrixWorld);for(var e=this.object.matrixWorld,t=this.geometry.attributes.position,i=this.object.geometry,n=i.vertices,r=i.faces,a=0,o=0,s=r.length;o<s;o++){var c=r[o],h=c.normal;ul.copy(n[c.a]).add(n[c.b]).add(n[c.c]).divideScalar(3).applyMatrix4(e),dl.copy(h).applyMatrix3(pl).normalize().multiplyScalar(this.size).add(ul),t.setXYZ(a,ul.x,ul.y,ul.z),a+=1,t.setXYZ(a,dl.x,dl.y,dl.z),a+=1}t.needsUpdate=!0}),((Ql.prototype=Object.create(Wi.prototype)).constructor=Ql).prototype.dispose=function(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()},Ql.prototype.update=(fl=new zt,ml=new zt,gl=new zt,function(){fl.setFromMatrixPosition(this.light.matrixWorld),ml.setFromMatrixPosition(this.light.target.matrixWorld),gl.subVectors(ml,fl),this.lightPlane.lookAt(gl),void 0!==this.color?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(gl),this.targetLine.scale.z=gl.length()}),((Kl.prototype=Object.create(bo.prototype)).constructor=Kl).prototype.update=function(){var c,h,l=new zt,u=new Xi;function e(e,t,i,n){l.set(t,i,n).unproject(u);var r=h[e];if(void 0!==r)for(var a=c.getAttribute("position"),o=0,s=r.length;o<s;o++)a.setXYZ(r[o],l.x,l.y,l.z)}return function(){c=this.geometry,h=this.pointMap;u.projectionMatrix.copy(this.camera.projectionMatrix),e("c",0,0,-1),e("t",0,0,1),e("n1",-1,-1,-1),e("n2",1,-1,-1),e("n3",-1,1,-1),e("n4",1,1,-1),e("f1",-1,-1,1),e("f2",1,-1,1),e("f3",-1,1,1),e("f4",1,1,1),e("u1",.7,1.1,-1),e("u2",-.7,1.1,-1),e("u3",0,2,-1),e("cf1",-1,0,1),e("cf2",1,0,1),e("cf3",0,-1,1),e("cf4",0,1,1),e("cn1",-1,0,-1),e("cn2",1,0,-1),e("cn3",0,-1,-1),e("cn4",0,1,-1),c.getAttribute("position").needsUpdate=!0}}(),(($l.prototype=Object.create(bo.prototype)).constructor=$l).prototype.update=(vl=new li,function(e){if(void 0!==e&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),void 0!==this.object&&vl.setFromObject(this.object),!vl.isEmpty()){var t=vl.min,i=vl.max,n=this.geometry.attributes.position,r=n.array;r[0]=i.x,r[1]=i.y,r[2]=i.z,r[3]=t.x,r[4]=i.y,r[5]=i.z,r[6]=t.x,r[7]=t.y,r[8]=i.z,r[9]=i.x,r[10]=t.y,r[11]=i.z,r[12]=i.x,r[13]=i.y,r[14]=t.z,r[15]=t.x,r[16]=i.y,r[17]=t.z,r[18]=t.x,r[19]=t.y,r[20]=t.z,r[21]=i.x,r[22]=t.y,r[23]=t.z,n.needsUpdate=!0,this.geometry.computeBoundingSphere()}}),$l.prototype.setFromObject=function(e){return this.object=e,this.update(),this},((eu.prototype=Object.create(bo.prototype)).constructor=eu).prototype.updateMatrixWorld=function(e){var t=this.box;t.isEmpty()||(t.getCenter(this.position),t.getSize(this.scale),this.scale.multiplyScalar(.5),Wi.prototype.updateMatrixWorld.call(this,e))},((tu.prototype=Object.create(wo.prototype)).constructor=tu).prototype.updateMatrixWorld=function(e){var t=-this.plane.constant;Math.abs(t)<1e-8&&(t=1e-8),this.scale.set(.5*this.size,.5*this.size,t),this.children[0].material.side=t<0?Ae:B,this.lookAt(this.plane.normal),Wi.prototype.updateMatrixWorld.call(this,e)},((iu.prototype=Object.create(Wi.prototype)).constructor=iu).prototype.setDirection=(bl=new zt,function(e){.99999<e.y?this.quaternion.set(0,0,0,1):e.y<-.99999?this.quaternion.set(1,0,0,0):(bl.set(e.z,0,-e.x).normalize(),wl=Math.acos(e.y),this.quaternion.setFromAxisAngle(bl,wl))}),iu.prototype.setLength=function(e,t,i){void 0===t&&(t=.2*e),void 0===i&&(i=.2*t),this.line.scale.set(1,Math.max(0,e-t),1),this.line.updateMatrix(),this.cone.scale.set(i,t,i),this.cone.position.y=e,this.cone.updateMatrix()},iu.prototype.setColor=function(e){this.line.material.color.copy(e),this.cone.material.color.copy(e)},(nu.prototype=Object.create(bo.prototype)).constructor=nu;var ru;function au(e){console.warn("THREE.ClosedSplineCurve3 has been deprecated. Use THREE.CatmullRomCurve3 instead."),fc.call(this,e),this.type="catmullrom",this.closed=!0}function ou(e){console.warn("THREE.SplineCurve3 has been deprecated. Use THREE.CatmullRomCurve3 instead."),fc.call(this,e),this.type="catmullrom"}function su(e){console.warn("THREE.Spline has been removed. Use THREE.CatmullRomCurve3 instead."),fc.call(this,e),this.type="catmullrom"}oc.create=function(e,t){return console.log("THREE.Curve.create() has been deprecated"),e.prototype=Object.create(oc.prototype),(e.prototype.constructor=e).prototype.getPoint=t,e},Object.assign(Sc.prototype,{createPointsGeometry:function(e){console.warn("THREE.CurvePath: .createPointsGeometry() has been removed. Use new THREE.Geometry().setFromPoints( points ) instead.");var t=this.getPoints(e);return this.createGeometry(t)},createSpacedPointsGeometry:function(e){console.warn("THREE.CurvePath: .createSpacedPointsGeometry() has been removed. Use new THREE.Geometry().setFromPoints( points ) instead.");var t=this.getSpacedPoints(e);return this.createGeometry(t)},createGeometry:function(e){console.warn("THREE.CurvePath: .createGeometry() has been removed. Use new THREE.Geometry().setFromPoints( points ) instead.");for(var t=new rn,i=0,n=e.length;i<n;i++){var r=e[i];t.vertices.push(new zt(r.x,r.y,r.z||0))}return t}}),Object.assign(Ac.prototype,{fromPoints:function(e){console.warn("THREE.Path: .fromPoints() has been renamed to .setFromPoints()."),this.setFromPoints(e)}}),au.prototype=Object.create(fc.prototype),ou.prototype=Object.create(fc.prototype),su.prototype=Object.create(fc.prototype),Object.assign(su.prototype,{initFromArray:function(){console.error("THREE.Spline: .initFromArray() has been removed.")},getControlPointsArray:function(){console.error("THREE.Spline: .getControlPointsArray() has been removed.")},reparametrizeByArcLength:function(){console.error("THREE.Spline: .reparametrizeByArcLength() has been removed.")}}),Yl.prototype.setColors=function(){console.error("THREE.GridHelper: setColors() has been deprecated, pass them in the constructor instead.")},jl.prototype.update=function(){console.error("THREE.SkeletonHelper: update() no longer needs to be called.")},Object.assign(oh.prototype,{extractUrlBase:function(e){return console.warn("THREE.Loader: .extractUrlBase() has been deprecated. Use THREE.LoaderUtils.extractUrlBase() instead."),sh.extractUrlBase(e)}}),Object.assign(zl.prototype,{center:function(e){return console.warn("THREE.Box2: .center() has been renamed to .getCenter()."),this.getCenter(e)},empty:function(){return console.warn("THREE.Box2: .empty() has been renamed to .isEmpty()."),this.isEmpty()},isIntersectionBox:function(e){return console.warn("THREE.Box2: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(e)},size:function(e){return console.warn("THREE.Box2: .size() has been renamed to .getSize()."),this.getSize(e)}}),Object.assign(li.prototype,{center:function(e){return console.warn("THREE.Box3: .center() has been renamed to .getCenter()."),this.getCenter(e)},empty:function(){return console.warn("THREE.Box3: .empty() has been renamed to .isEmpty()."),this.isEmpty()},isIntersectionBox:function(e){return console.warn("THREE.Box3: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(e)},isIntersectionSphere:function(e){return console.warn("THREE.Box3: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(e)},size:function(e){return console.warn("THREE.Box3: .size() has been renamed to .getSize()."),this.getSize(e)}}),cr.prototype.center=function(e){return console.warn("THREE.Line3: .center() has been renamed to .getCenter()."),this.getCenter(e)},Object.assign(Ut,{random16:function(){return console.warn("THREE.Math: .random16() has been deprecated. Use Math.random() instead."),Math.random()},nearestPowerOfTwo:function(e){return console.warn("THREE.Math: .nearestPowerOfTwo() has been renamed to .floorPowerOfTwo()."),Ut.floorPowerOfTwo(e)},nextPowerOfTwo:function(e){return console.warn("THREE.Math: .nextPowerOfTwo() has been renamed to .ceilPowerOfTwo()."),Ut.ceilPowerOfTwo(e)}}),Object.assign(Gt.prototype,{flattenToArrayOffset:function(e,t){return console.warn("THREE.Matrix3: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(e,t)},multiplyVector3:function(e){return console.warn("THREE.Matrix3: .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead."),e.applyMatrix3(this)},multiplyVector3Array:function(){console.error("THREE.Matrix3: .multiplyVector3Array() has been removed.")},applyToBuffer:function(e){return console.warn("THREE.Matrix3: .applyToBuffer() has been removed. Use matrix.applyToBufferAttribute( attribute ) instead."),this.applyToBufferAttribute(e)},applyToVector3Array:function(){console.error("THREE.Matrix3: .applyToVector3Array() has been removed.")}}),Object.assign(Ft.prototype,{extractPosition:function(e){return console.warn("THREE.Matrix4: .extractPosition() has been renamed to .copyPosition()."),this.copyPosition(e)},flattenToArrayOffset:function(e,t){return console.warn("THREE.Matrix4: .flattenToArrayOffset() has been deprecated. Use .toArray() instead."),this.toArray(e,t)},getPosition:function(){return void 0===ru&&(ru=new zt),console.warn("THREE.Matrix4: .getPosition() has been removed. Use Vector3.setFromMatrixPosition( matrix ) instead."),ru.setFromMatrixColumn(this,3)},setRotationFromQuaternion:function(e){return console.warn("THREE.Matrix4: .setRotationFromQuaternion() has been renamed to .makeRotationFromQuaternion()."),this.makeRotationFromQuaternion(e)},multiplyToArray:function(){console.warn("THREE.Matrix4: .multiplyToArray() has been removed.")},multiplyVector3:function(e){return console.warn("THREE.Matrix4: .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) instead."),e.applyMatrix4(this)},multiplyVector4:function(e){return console.warn("THREE.Matrix4: .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead."),e.applyMatrix4(this)},multiplyVector3Array:function(){console.error("THREE.Matrix4: .multiplyVector3Array() has been removed.")},rotateAxis:function(e){console.warn("THREE.Matrix4: .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead."),e.transformDirection(this)},crossVector:function(e){return console.warn("THREE.Matrix4: .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead."),e.applyMatrix4(this)},translate:function(){console.error("THREE.Matrix4: .translate() has been removed.")},rotateX:function(){console.error("THREE.Matrix4: .rotateX() has been removed.")},rotateY:function(){console.error("THREE.Matrix4: .rotateY() has been removed.")},rotateZ:function(){console.error("THREE.Matrix4: .rotateZ() has been removed.")},rotateByAxis:function(){console.error("THREE.Matrix4: .rotateByAxis() has been removed.")},applyToBuffer:function(e){return console.warn("THREE.Matrix4: .applyToBuffer() has been removed. Use matrix.applyToBufferAttribute( attribute ) instead."),this.applyToBufferAttribute(e)},applyToVector3Array:function(){console.error("THREE.Matrix4: .applyToVector3Array() has been removed.")},makeFrustum:function(e,t,i,n,r,a){return console.warn("THREE.Matrix4: .makeFrustum() has been removed. Use .makePerspective( left, right, top, bottom, near, far ) instead."),this.makePerspective(e,t,n,i,r,a)}}),di.prototype.isIntersectionLine=function(e){return console.warn("THREE.Plane: .isIntersectionLine() has been renamed to .intersectsLine()."),this.intersectsLine(e)},Ht.prototype.multiplyVector3=function(e){return console.warn("THREE.Quaternion: .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead."),e.applyQuaternion(this)},Object.assign(sr.prototype,{isIntersectionBox:function(e){return console.warn("THREE.Ray: .isIntersectionBox() has been renamed to .intersectsBox()."),this.intersectsBox(e)},isIntersectionPlane:function(e){return console.warn("THREE.Ray: .isIntersectionPlane() has been renamed to .intersectsPlane()."),this.intersectsPlane(e)},isIntersectionSphere:function(e){return console.warn("THREE.Ray: .isIntersectionSphere() has been renamed to .intersectsSphere()."),this.intersectsSphere(e)}}),Object.assign(hr.prototype,{area:function(){return console.warn("THREE.Triangle: .area() has been renamed to .getArea()."),this.getArea()},barycoordFromPoint:function(e,t){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),this.getBarycoord(e,t)},midpoint:function(e){return console.warn("THREE.Triangle: .midpoint() has been renamed to .getMidpoint()."),this.getMidpoint(e)},normal:function(e){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),this.getNormal(e)},plane:function(e){return console.warn("THREE.Triangle: .plane() has been renamed to .getPlane()."),this.getPlane(e)}}),Object.assign(hr,{barycoordFromPoint:function(e,t,i,n,r){return console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord()."),hr.getBarycoord(e,t,i,n,r)},normal:function(e,t,i,n){return console.warn("THREE.Triangle: .normal() has been renamed to .getNormal()."),hr.getNormal(e,t,i,n)}}),Object.assign(Lc.prototype,{extractAllPoints:function(e){return console.warn("THREE.Shape: .extractAllPoints() has been removed. Use .extractPoints() instead."),this.extractPoints(e)},extrude:function(e){return console.warn("THREE.Shape: .extrude() has been removed. Use ExtrudeGeometry() instead."),new ys(this,e)},makeGeometry:function(e){return console.warn("THREE.Shape: .makeGeometry() has been removed. Use ShapeGeometry() instead."),new Rs(this,e)}}),Object.assign(Dt.prototype,{fromAttribute:function(e,t,i){return console.warn("THREE.Vector2: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(e,t,i)},distanceToManhattan:function(e){return console.warn("THREE.Vector2: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(e)},lengthManhattan:function(){return console.warn("THREE.Vector2: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()}}),Object.assign(zt.prototype,{setEulerFromRotationMatrix:function(){console.error("THREE.Vector3: .setEulerFromRotationMatrix() has been removed. Use Euler.setFromRotationMatrix() instead.")},setEulerFromQuaternion:function(){console.error("THREE.Vector3: .setEulerFromQuaternion() has been removed. Use Euler.setFromQuaternion() instead.")},getPositionFromMatrix:function(e){return console.warn("THREE.Vector3: .getPositionFromMatrix() has been renamed to .setFromMatrixPosition()."),this.setFromMatrixPosition(e)},getScaleFromMatrix:function(e){return console.warn("THREE.Vector3: .getScaleFromMatrix() has been renamed to .setFromMatrixScale()."),this.setFromMatrixScale(e)},getColumnFromMatrix:function(e,t){return console.warn("THREE.Vector3: .getColumnFromMatrix() has been renamed to .setFromMatrixColumn()."),this.setFromMatrixColumn(t,e)},applyProjection:function(e){return console.warn("THREE.Vector3: .applyProjection() has been removed. Use .applyMatrix4( m ) instead."),this.applyMatrix4(e)},fromAttribute:function(e,t,i){return console.warn("THREE.Vector3: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(e,t,i)},distanceToManhattan:function(e){return console.warn("THREE.Vector3: .distanceToManhattan() has been renamed to .manhattanDistanceTo()."),this.manhattanDistanceTo(e)},lengthManhattan:function(){return console.warn("THREE.Vector3: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()}}),Object.assign(oi.prototype,{fromAttribute:function(e,t,i){return console.warn("THREE.Vector4: .fromAttribute() has been renamed to .fromBufferAttribute()."),this.fromBufferAttribute(e,t,i)},lengthManhattan:function(){return console.warn("THREE.Vector4: .lengthManhattan() has been renamed to .manhattanLength()."),this.manhattanLength()}}),Object.assign(rn.prototype,{computeTangents:function(){console.error("THREE.Geometry: .computeTangents() has been removed.")},computeLineDistances:function(){console.error("THREE.Geometry: .computeLineDistances() has been removed. Use THREE.Line.computeLineDistances() instead.")}}),Object.assign(Wi.prototype,{getChildByName:function(e){return console.warn("THREE.Object3D: .getChildByName() has been renamed to .getObjectByName()."),this.getObjectByName(e)},renderDepth:function(){console.warn("THREE.Object3D: .renderDepth has been removed. Use .renderOrder, instead.")},translate:function(e,t){return console.warn("THREE.Object3D: .translate() has been removed. Use .translateOnAxis( axis, distance ) instead."),this.translateOnAxis(t,e)},getWorldRotation:function(){console.error("THREE.Object3D: .getWorldRotation() has been removed. Use THREE.Object3D.getWorldQuaternion( target ) instead.")}}),Object.defineProperties(Wi.prototype,{eulerOrder:{get:function(){return console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order},set:function(e){console.warn("THREE.Object3D: .eulerOrder is now .rotation.order."),this.rotation.order=e}},useQuaternion:{get:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")},set:function(){console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.")}}}),Object.defineProperties(mo.prototype,{objects:{get:function(){return console.warn("THREE.LOD: .objects has been renamed to .levels."),this.levels}}}),Object.defineProperty(go.prototype,"useVertexTexture",{get:function(){console.warn("THREE.Skeleton: useVertexTexture has been removed.")},set:function(){console.warn("THREE.Skeleton: useVertexTexture has been removed.")}}),Object.defineProperty(oc.prototype,"__arcLengthDivisions",{get:function(){return console.warn("THREE.Curve: .__arcLengthDivisions is now .arcLengthDivisions."),this.arcLengthDivisions},set:function(e){console.warn("THREE.Curve: .__arcLengthDivisions is now .arcLengthDivisions."),this.arcLengthDivisions=e}}),ro.prototype.setLens=function(e,t){console.warn("THREE.PerspectiveCamera.setLens is deprecated. Use .setFocalLength and .filmGauge for a photographic setup."),void 0!==t&&(this.filmGauge=t),this.setFocalLength(e)},Object.defineProperties(Rc.prototype,{onlyShadow:{set:function(){console.warn("THREE.Light: .onlyShadow has been removed.")}},shadowCameraFov:{set:function(e){console.warn("THREE.Light: .shadowCameraFov is now .shadow.camera.fov."),this.shadow.camera.fov=e}},shadowCameraLeft:{set:function(e){console.warn("THREE.Light: .shadowCameraLeft is now .shadow.camera.left."),this.shadow.camera.left=e}},shadowCameraRight:{set:function(e){console.warn("THREE.Light: .shadowCameraRight is now .shadow.camera.right."),this.shadow.camera.right=e}},shadowCameraTop:{set:function(e){console.warn("THREE.Light: .shadowCameraTop is now .shadow.camera.top."),this.shadow.camera.top=e}},shadowCameraBottom:{set:function(e){console.warn("THREE.Light: .shadowCameraBottom is now .shadow.camera.bottom."),this.shadow.camera.bottom=e}},shadowCameraNear:{set:function(e){console.warn("THREE.Light: .shadowCameraNear is now .shadow.camera.near."),this.shadow.camera.near=e}},shadowCameraFar:{set:function(e){console.warn("THREE.Light: .shadowCameraFar is now .shadow.camera.far."),this.shadow.camera.far=e}},shadowCameraVisible:{set:function(){console.warn("THREE.Light: .shadowCameraVisible has been removed. Use new THREE.CameraHelper( light.shadow.camera ) instead.")}},shadowBias:{set:function(e){console.warn("THREE.Light: .shadowBias is now .shadow.bias."),this.shadow.bias=e}},shadowDarkness:{set:function(){console.warn("THREE.Light: .shadowDarkness has been removed.")}},shadowMapWidth:{set:function(e){console.warn("THREE.Light: .shadowMapWidth is now .shadow.mapSize.width."),this.shadow.mapSize.width=e}},shadowMapHeight:{set:function(e){console.warn("THREE.Light: .shadowMapHeight is now .shadow.mapSize.height."),this.shadow.mapSize.height=e}}}),Object.defineProperties(an.prototype,{length:{get:function(){return console.warn("THREE.BufferAttribute: .length has been deprecated. Use .count instead."),this.array.length}},copyIndicesArray:function(){console.error("THREE.BufferAttribute: .copyIndicesArray() has been removed.")}}),Object.assign(Ln.prototype,{addIndex:function(e){console.warn("THREE.BufferGeometry: .addIndex() has been renamed to .setIndex()."),this.setIndex(e)},addDrawCall:function(e,t,i){void 0!==i&&console.warn("THREE.BufferGeometry: .addDrawCall() no longer supports indexOffset."),console.warn("THREE.BufferGeometry: .addDrawCall() is now .addGroup()."),this.addGroup(e,t)},clearDrawCalls:function(){console.warn("THREE.BufferGeometry: .clearDrawCalls() is now .clearGroups()."),this.clearGroups()},computeTangents:function(){console.warn("THREE.BufferGeometry: .computeTangents() has been removed.")},computeOffsets:function(){console.warn("THREE.BufferGeometry: .computeOffsets() has been removed.")}}),Object.defineProperties(Ln.prototype,{drawcalls:{get:function(){return console.error("THREE.BufferGeometry: .drawcalls has been renamed to .groups."),this.groups}},offsets:{get:function(){return console.warn("THREE.BufferGeometry: .offsets has been renamed to .groups."),this.groups}}}),Object.assign(xs.prototype,{getArrays:function(){console.error("THREE.ExtrudeBufferGeometry: .getArrays() has been removed.")},addShapeList:function(){console.error("THREE.ExtrudeBufferGeometry: .addShapeList() has been removed.")},addShape:function(){console.error("THREE.ExtrudeBufferGeometry: .addShape() has been removed.")}}),Object.defineProperties(Ll.prototype,{dynamic:{set:function(){console.warn("THREE.Uniform: .dynamic has been removed. Use object.onBeforeRender() instead.")}},onUpdate:{value:function(){return console.warn("THREE.Uniform: .onUpdate() has been removed. Use object.onBeforeRender() instead."),this}}}),Object.defineProperties(rr.prototype,{wrapAround:{get:function(){console.warn("THREE.Material: .wrapAround has been removed.")},set:function(){console.warn("THREE.Material: .wrapAround has been removed.")}},wrapRGB:{get:function(){return console.warn("THREE.Material: .wrapRGB has been removed."),new yi}},shading:{get:function(){console.error("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead.")},set:function(e){console.warn("THREE."+this.type+": .shading has been removed. Use the boolean .flatShading instead."),this.flatShading=1===e}}}),Object.defineProperties(js.prototype,{metal:{get:function(){return console.warn("THREE.MeshPhongMaterial: .metal has been removed. Use THREE.MeshStandardMaterial instead."),!1},set:function(){console.warn("THREE.MeshPhongMaterial: .metal has been removed. Use THREE.MeshStandardMaterial instead")}}}),Object.defineProperties(or.prototype,{derivatives:{get:function(){return console.warn("THREE.ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives},set:function(e){console.warn("THREE. ShaderMaterial: .derivatives has been moved to .extensions.derivatives."),this.extensions.derivatives=e}}}),Object.assign(co.prototype,{getCurrentRenderTarget:function(){return console.warn("THREE.WebGLRenderer: .getCurrentRenderTarget() is now .getRenderTarget()."),this.getRenderTarget()},getMaxAnisotropy:function(){return console.warn("THREE.WebGLRenderer: .getMaxAnisotropy() is now .capabilities.getMaxAnisotropy()."),this.capabilities.getMaxAnisotropy()},getPrecision:function(){return console.warn("THREE.WebGLRenderer: .getPrecision() is now .capabilities.precision."),this.capabilities.precision},resetGLState:function(){return console.warn("THREE.WebGLRenderer: .resetGLState() is now .state.reset()."),this.state.reset()},supportsFloatTextures:function(){return console.warn("THREE.WebGLRenderer: .supportsFloatTextures() is now .extensions.get( 'OES_texture_float' )."),this.extensions.get("OES_texture_float")},supportsHalfFloatTextures:function(){return console.warn("THREE.WebGLRenderer: .supportsHalfFloatTextures() is now .extensions.get( 'OES_texture_half_float' )."),this.extensions.get("OES_texture_half_float")},supportsStandardDerivatives:function(){return console.warn("THREE.WebGLRenderer: .supportsStandardDerivatives() is now .extensions.get( 'OES_standard_derivatives' )."),this.extensions.get("OES_standard_derivatives")},supportsCompressedTextureS3TC:function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTextureS3TC() is now .extensions.get( 'WEBGL_compressed_texture_s3tc' )."),this.extensions.get("WEBGL_compressed_texture_s3tc")},supportsCompressedTexturePVRTC:function(){return console.warn("THREE.WebGLRenderer: .supportsCompressedTexturePVRTC() is now .extensions.get( 'WEBGL_compressed_texture_pvrtc' )."),this.extensions.get("WEBGL_compressed_texture_pvrtc")},supportsBlendMinMax:function(){return console.warn("THREE.WebGLRenderer: .supportsBlendMinMax() is now .extensions.get( 'EXT_blend_minmax' )."),this.extensions.get("EXT_blend_minmax")},supportsVertexTextures:function(){return console.warn("THREE.WebGLRenderer: .supportsVertexTextures() is now .capabilities.vertexTextures."),this.capabilities.vertexTextures},supportsInstancedArrays:function(){return console.warn("THREE.WebGLRenderer: .supportsInstancedArrays() is now .extensions.get( 'ANGLE_instanced_arrays' )."),this.extensions.get("ANGLE_instanced_arrays")},enableScissorTest:function(e){console.warn("THREE.WebGLRenderer: .enableScissorTest() is now .setScissorTest()."),this.setScissorTest(e)},initMaterial:function(){console.warn("THREE.WebGLRenderer: .initMaterial() has been removed.")},addPrePlugin:function(){console.warn("THREE.WebGLRenderer: .addPrePlugin() has been removed.")},addPostPlugin:function(){console.warn("THREE.WebGLRenderer: .addPostPlugin() has been removed.")},updateShadowMap:function(){console.warn("THREE.WebGLRenderer: .updateShadowMap() has been removed.")},setFaceCulling:function(){console.warn("THREE.WebGLRenderer: .setFaceCulling() has been removed.")}}),Object.defineProperties(co.prototype,{shadowMapEnabled:{get:function(){return this.shadowMap.enabled},set:function(e){console.warn("THREE.WebGLRenderer: .shadowMapEnabled is now .shadowMap.enabled."),this.shadowMap.enabled=e}},shadowMapType:{get:function(){return this.shadowMap.type},set:function(e){console.warn("THREE.WebGLRenderer: .shadowMapType is now .shadowMap.type."),this.shadowMap.type=e}},shadowMapCullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.")}}}),Object.defineProperties(Ka.prototype,{cullFace:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.")}},renderReverseSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.")}},renderSingleSided:{get:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")},set:function(){console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.")}}}),Object.defineProperties(si.prototype,{wrapS:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS},set:function(e){console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS."),this.texture.wrapS=e}},wrapT:{get:function(){return console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT},set:function(e){console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT."),this.texture.wrapT=e}},magFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter},set:function(e){console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter."),this.texture.magFilter=e}},minFilter:{get:function(){return console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter},set:function(e){console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter."),this.texture.minFilter=e}},anisotropy:{get:function(){return console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy},set:function(e){console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy."),this.texture.anisotropy=e}},offset:{get:function(){return console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset},set:function(e){console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset."),this.texture.offset=e}},repeat:{get:function(){return console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat},set:function(e){console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat."),this.texture.repeat=e}},format:{get:function(){return console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format},set:function(e){console.warn("THREE.WebGLRenderTarget: .format is now .texture.format."),this.texture.format=e}},type:{get:function(){return console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type},set:function(e){console.warn("THREE.WebGLRenderTarget: .type is now .texture.type."),this.texture.type=e}},generateMipmaps:{get:function(){return console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps},set:function(e){console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps."),this.texture.generateMipmaps=e}}}),Object.defineProperties(oo.prototype,{standing:{set:function(){console.warn("THREE.WebVRManager: .standing has been removed.")}}}),Hh.prototype.load=function(e){console.warn("THREE.Audio: .load has been deprecated. Use THREE.AudioLoader instead.");var t=this;return(new Bh).load(e,function(e){t.setBuffer(e)}),this},Gh.prototype.getData=function(){return console.warn("THREE.AudioAnalyser: .getData() is now .getFrequencyData()."),this.getFrequencyData()},Dh.prototype.updateCubeMap=function(e,t){return console.warn("THREE.CubeCamera: .updateCubeMap() is now .update()."),this.update(e,t)};var cu={merge:function(e,t,i){var n;console.warn("THREE.GeometryUtils: .merge() has been moved to Geometry. Use geometry.merge( geometry2, matrix, materialIndexOffset ) instead."),t.isMesh&&(t.matrixAutoUpdate&&t.updateMatrix(),n=t.matrix,t=t.geometry),e.merge(t,n,i)},center:function(e){return console.warn("THREE.GeometryUtils: .center() has been moved to Geometry. Use geometry.center() instead."),e.center()}},hu={crossOrigin:void 0,loadTexture:function(e,t,i,n){console.warn("THREE.ImageUtils.loadTexture has been deprecated. Use THREE.TextureLoader() instead.");var r=new ac;r.setCrossOrigin(this.crossOrigin);var a=r.load(e,i,void 0,n);return t&&(a.mapping=t),a},loadTextureCube:function(e,t,i,n){console.warn("THREE.ImageUtils.loadTextureCube has been deprecated. Use THREE.CubeTextureLoader() instead.");var r=new rc;r.setCrossOrigin(this.crossOrigin);var a=r.load(e,i,void 0,n);return t&&(a.mapping=t),a},loadCompressedTexture:function(){console.error("THREE.ImageUtils.loadCompressedTexture has been removed. Use THREE.DDSLoader instead.")},loadCompressedTextureCube:function(){console.error("THREE.ImageUtils.loadCompressedTextureCube has been removed. Use THREE.DDSLoader instead.")}};var lu={createMultiMaterialObject:function(){console.error("THREE.SceneUtils has been moved to /examples/js/utils/SceneUtils.js")},detach:function(){console.error("THREE.SceneUtils has been moved to /examples/js/utils/SceneUtils.js")},attach:function(){console.error("THREE.SceneUtils has been moved to /examples/js/utils/SceneUtils.js")}};e.WebGLRenderTargetCube=ci,e.WebGLRenderTarget=si,e.WebGLRenderer=co,e.ShaderLib=_i,e.UniformsLib=bi,e.UniformsUtils=gi,e.ShaderChunk=mi,e.FogExp2=ho,e.Fog=lo,e.Scene=uo,e.Sprite=fo,e.LOD=mo,e.SkinnedMesh=yo,e.Skeleton=go,e.Bone=vo,e.Mesh=lr,e.LineSegments=bo,e.LineLoop=_o,e.Line=wo,e.Points=Eo,e.Group=To,e.VideoTexture=So,e.DataTexture=hi,e.CompressedTexture=Ao,e.CubeTexture=_r,e.CanvasTexture=$a,e.DepthTexture=Lo,e.Texture=ai,e.CompressedTextureLoader=tc,e.DataTextureLoader=ic,e.CubeTextureLoader=rc,e.TextureLoader=ac,e.ObjectLoader=hh,e.MaterialLoader=$c,e.BufferGeometryLoader=eh,e.DefaultLoadingManager=Ks,e.LoadingManager=Qs,e.JSONLoader=ch,e.ImageLoader=nc,e.ImageBitmapLoader=fh,e.FontLoader=yh,e.FileLoader=ec,e.Loader=oh,e.LoaderUtils=sh,e.Cache=Js,e.AudioLoader=Bh,e.SpotLightShadow=Oc,e.SpotLight=Ic,e.PointLight=Nc,e.RectAreaLight=Fc,e.HemisphereLight=Cc,e.DirectionalLightShadow=Bc,e.DirectionalLight=Uc,e.AmbientLight=Dc,e.LightShadow=Pc,e.Light=Rc,e.StereoCamera=Uh,e.PerspectiveCamera=ro,e.OrthographicCamera=qi,e.CubeCamera=Dh,e.ArrayCamera=ao,e.Camera=Xi,e.AudioListener=Fh,e.PositionalAudio=zh,e.AudioContext=Nh,e.AudioAnalyser=Gh,e.Audio=Hh,e.VectorKeyframeTrack=Qc,e.StringKeyframeTrack=Hc,e.QuaternionKeyframeTrack=Vc,e.NumberKeyframeTrack=Wc,e.ColorKeyframeTrack=jc,e.BooleanKeyframeTrack=zc,e.PropertyMixer=kh,e.PropertyBinding=El,e.KeyframeTrack=Jc,e.AnimationUtils=Zc,e.AnimationObjectGroup=Tl,e.AnimationMixer=Al,e.AnimationClip=Kc,e.Uniform=Ll,e.InstancedBufferGeometry=Rl,e.BufferGeometry=Ln,e.Geometry=rn,e.InterleavedBufferAttribute=Cl,e.InstancedInterleavedBuffer=Ol,e.InterleavedBuffer=Pl,e.InstancedBufferAttribute=Il,e.Face3=Yi,e.Object3D=Wi,e.Raycaster=Nl,e.Layers=Ti,e.EventDispatcher=t,e.Clock=Dl,e.QuaternionLinearInterpolant=kc,e.LinearInterpolant=qc,e.DiscreteInterpolant=Yc,e.CubicInterpolant=Xc,e.Interpolant=Gc,e.Triangle=hr,e.Math=Ut,e.Spherical=Fl,e.Cylindrical=Hl,e.Plane=di,e.Frustum=pi,e.Sphere=ui,e.Ray=sr,e.Matrix4=Ft,e.Matrix3=Gt,e.Box3=li,e.Box2=zl,e.Line3=cr,e.Euler=Ei,e.Vector4=oi,e.Vector3=zt,e.Vector2=Dt,e.Quaternion=Ht,e.Color=yi,e.ImmediateRenderObject=Gl,e.VertexNormalsHelper=kl,e.SpotLightHelper=Vl,e.SkeletonHelper=jl,e.PointLightHelper=Wl,e.RectAreaLightHelper=Xl,e.HemisphereLightHelper=ql,e.GridHelper=Yl,e.PolarGridHelper=Zl,e.FaceNormalsHelper=Jl,e.DirectionalLightHelper=Ql,e.CameraHelper=Kl,e.BoxHelper=$l,e.Box3Helper=eu,e.PlaneHelper=tu,e.ArrowHelper=iu,e.AxesHelper=nu,e.Shape=Lc,e.Path=Ac,e.ShapePath=mh,e.Font=gh,e.CurvePath=Sc,e.Curve=oc,e.ShapeUtils=ms,e.WebGLUtils=no,e.WireframeGeometry=Ro,e.ParametricGeometry=Co,e.ParametricBufferGeometry=Po,e.TetrahedronGeometry=No,e.TetrahedronBufferGeometry=Bo,e.OctahedronGeometry=Uo,e.OctahedronBufferGeometry=Do,e.IcosahedronGeometry=Fo,e.IcosahedronBufferGeometry=Ho,e.DodecahedronGeometry=zo,e.DodecahedronBufferGeometry=Go,e.PolyhedronGeometry=Oo,e.PolyhedronBufferGeometry=Io,e.TubeGeometry=ko,e.TubeBufferGeometry=Vo,e.TorusKnotGeometry=jo,e.TorusKnotBufferGeometry=Wo,e.TorusGeometry=Xo,e.TorusBufferGeometry=qo,e.TextGeometry=bs,e.TextBufferGeometry=_s,e.SphereGeometry=Ms,e.SphereBufferGeometry=Es,e.RingGeometry=Ts,e.RingBufferGeometry=Ss,e.PlaneGeometry=Pn,e.PlaneBufferGeometry=On,e.LatheGeometry=As,e.LatheBufferGeometry=Ls,e.ShapeGeometry=Rs,e.ShapeBufferGeometry=Cs,e.ExtrudeGeometry=ys,e.ExtrudeBufferGeometry=xs,e.EdgesGeometry=Os,e.ConeGeometry=Bs,e.ConeBufferGeometry=Us,e.CylinderGeometry=Is,e.CylinderBufferGeometry=Ns,e.CircleGeometry=Ds,e.CircleBufferGeometry=Fs,e.BoxGeometry=Rn,e.BoxBufferGeometry=Cn,e.ShadowMaterial=zs,e.SpriteMaterial=po,e.RawShaderMaterial=Gs,e.ShaderMaterial=or,e.PointsMaterial=Mo,e.MeshPhysicalMaterial=Vs,e.MeshStandardMaterial=ks,e.MeshPhongMaterial=js,e.MeshToonMaterial=Ws,e.MeshNormalMaterial=Xs,e.MeshLambertMaterial=qs,e.MeshDepthMaterial=Ja,e.MeshDistanceMaterial=Qa,e.MeshBasicMaterial=ar,e.LineDashedMaterial=Ys,e.LineBasicMaterial=xo,e.Material=rr,e.Float64BufferAttribute=fn,e.Float32BufferAttribute=pn,e.Uint32BufferAttribute=dn,e.Int32BufferAttribute=un,e.Uint16BufferAttribute=ln,e.Int16BufferAttribute=hn,e.Uint8ClampedBufferAttribute=cn,e.Uint8BufferAttribute=sn,e.Int8BufferAttribute=on,e.BufferAttribute=an,e.ArcCurve=cc,e.CatmullRomCurve3=fc,e.CubicBezierCurve=yc,e.CubicBezierCurve3=xc,e.EllipseCurve=sc,e.LineCurve=wc,e.LineCurve3=bc,e.QuadraticBezierCurve=_c,e.QuadraticBezierCurve3=Mc,e.SplineCurve=Ec,e.REVISION="93dev",e.MOUSE={LEFT:0,MIDDLE:1,RIGHT:2},e.CullFaceNone=j,e.CullFaceBack=W,e.CullFaceFront=X,e.CullFaceFrontBack=3,e.FrontFaceDirectionCW=0,e.FrontFaceDirectionCCW=1,e.BasicShadowMap=0,e.PCFShadowMap=D,e.PCFSoftShadowMap=F,e.FrontSide=B,e.BackSide=Ae,e.DoubleSide=Z,e.FlatShading=1,e.SmoothShading=2,e.NoColors=Le,e.FaceColors=1,e.VertexColors=_,e.NoBlending=q,e.NormalBlending=Y,e.AdditiveBlending=J,e.SubtractiveBlending=Q,e.MultiplyBlending=K,e.CustomBlending=$,e.AddEquation=M,e.SubtractEquation=E,e.ReverseSubtractEquation=T,e.MinEquation=S,e.MaxEquation=A,e.ZeroFactor=L,e.OneFactor=R,e.SrcColorFactor=C,e.OneMinusSrcColorFactor=P,e.SrcAlphaFactor=O,e.OneMinusSrcAlphaFactor=I,e.DstAlphaFactor=N,e.OneMinusDstAlphaFactor=U,e.DstColorFactor=H,e.OneMinusDstColorFactor=z,e.SrcAlphaSaturateFactor=G,e.NeverDepth=ee,e.AlwaysDepth=te,e.LessDepth=ie,e.LessEqualDepth=ne,e.EqualDepth=re,e.GreaterEqualDepth=ae,e.GreaterDepth=oe,e.NotEqualDepth=se,e.MultiplyOperation=k,e.MixOperation=V,e.AddOperation=ce,e.NoToneMapping=he,e.LinearToneMapping=Re,e.ReinhardToneMapping=le,e.Uncharted2ToneMapping=ue,e.CineonToneMapping=de,e.UVMapping=300,e.CubeReflectionMapping=pe,e.CubeRefractionMapping=fe,e.EquirectangularReflectionMapping=me,e.EquirectangularRefractionMapping=ge,e.SphericalReflectionMapping=ve,e.CubeUVReflectionMapping=ye,e.CubeUVRefractionMapping=xe,e.RepeatWrapping=we,e.ClampToEdgeWrapping=be,e.MirroredRepeatWrapping=_e,e.NearestFilter=Me,e.NearestMipMapNearestFilter=Ee,e.NearestMipMapLinearFilter=Te,e.LinearFilter=Se,e.LinearMipMapNearestFilter=Ce,e.LinearMipMapLinearFilter=Pe,e.UnsignedByteType=Oe,e.ByteType=Ie,e.ShortType=Ne,e.UnsignedShortType=Be,e.IntType=Ue,e.UnsignedIntType=De,e.FloatType=Fe,e.HalfFloatType=He,e.UnsignedShort4444Type=ze,e.UnsignedShort5551Type=Ge,e.UnsignedShort565Type=ke,e.UnsignedInt248Type=Ve,e.AlphaFormat=je,e.RGBFormat=We,e.RGBAFormat=Xe,e.LuminanceFormat=qe,e.LuminanceAlphaFormat=Ye,e.RGBEFormat=Ze,e.DepthFormat=Je,e.DepthStencilFormat=Qe,e.RGB_S3TC_DXT1_Format=Ke,e.RGBA_S3TC_DXT1_Format=$e,e.RGBA_S3TC_DXT3_Format=et,e.RGBA_S3TC_DXT5_Format=tt,e.RGB_PVRTC_4BPPV1_Format=it,e.RGB_PVRTC_2BPPV1_Format=nt,e.RGBA_PVRTC_4BPPV1_Format=rt,e.RGBA_PVRTC_2BPPV1_Format=at,e.RGB_ETC1_Format=ot,e.RGBA_ASTC_4x4_Format=st,e.RGBA_ASTC_5x4_Format=ct,e.RGBA_ASTC_5x5_Format=ht,e.RGBA_ASTC_6x5_Format=lt,e.RGBA_ASTC_6x6_Format=ut,e.RGBA_ASTC_8x5_Format=dt,e.RGBA_ASTC_8x6_Format=pt,e.RGBA_ASTC_8x8_Format=ft,e.RGBA_ASTC_10x5_Format=mt,e.RGBA_ASTC_10x6_Format=gt,e.RGBA_ASTC_10x8_Format=vt,e.RGBA_ASTC_10x10_Format=yt,e.RGBA_ASTC_12x10_Format=xt,e.RGBA_ASTC_12x12_Format=wt,e.LoopOnce=2200,e.LoopRepeat=2201,e.LoopPingPong=2202,e.InterpolateDiscrete=bt,e.InterpolateLinear=_t,e.InterpolateSmooth=2302,e.ZeroCurvatureEnding=Mt,e.ZeroSlopeEnding=Et,e.WrapAroundEnding=Tt,e.TrianglesDrawMode=St,e.TriangleStripDrawMode=1,e.TriangleFanDrawMode=2,e.LinearEncoding=At,e.sRGBEncoding=Lt,e.GammaEncoding=Rt,e.RGBEEncoding=Ct,e.LogLuvEncoding=3003,e.RGBM7Encoding=Pt,e.RGBM16Encoding=Ot,e.RGBDEncoding=It,e.BasicDepthPacking=Nt,e.RGBADepthPacking=Bt,e.CubeGeometry=Rn,e.Face4=function(e,t,i,n,r,a,o){return console.warn("THREE.Face4 has been removed. A THREE.Face3 will be created instead."),new Yi(e,t,i,r,a,o)},e.LineStrip=0,e.LinePieces=1,e.MeshFaceMaterial=function(e){return console.warn("THREE.MeshFaceMaterial has been removed. Use an Array instead."),e},e.MultiMaterial=function(e){return void 0===e&&(e=[]),console.warn("THREE.MultiMaterial has been removed. Use an Array instead."),e.isMultiMaterial=!0,(e.materials=e).clone=function(){return e.slice()},e},e.PointCloud=function(e,t){return console.warn("THREE.PointCloud has been renamed to THREE.Points."),new Eo(e,t)},e.Particle=function(e){return console.warn("THREE.Particle has been renamed to THREE.Sprite."),new fo(e)},e.ParticleSystem=function(e,t){return console.warn("THREE.ParticleSystem has been renamed to THREE.Points."),new Eo(e,t)},e.PointCloudMaterial=function(e){return console.warn("THREE.PointCloudMaterial has been renamed to THREE.PointsMaterial."),new Mo(e)},e.ParticleBasicMaterial=function(e){return console.warn("THREE.ParticleBasicMaterial has been renamed to THREE.PointsMaterial."),new Mo(e)},e.ParticleSystemMaterial=function(e){return console.warn("THREE.ParticleSystemMaterial has been renamed to THREE.PointsMaterial."),new Mo(e)},e.Vertex=function(e,t,i){return console.warn("THREE.Vertex has been removed. Use THREE.Vector3 instead."),new zt(e,t,i)},e.DynamicBufferAttribute=function(e,t){return console.warn("THREE.DynamicBufferAttribute has been removed. Use new THREE.BufferAttribute().setDynamic( true ) instead."),new an(e,t).setDynamic(!0)},e.Int8Attribute=function(e,t){return console.warn("THREE.Int8Attribute has been removed. Use new THREE.Int8BufferAttribute() instead."),new on(e,t)},e.Uint8Attribute=function(e,t){return console.warn("THREE.Uint8Attribute has been removed. Use new THREE.Uint8BufferAttribute() instead."),new sn(e,t)},e.Uint8ClampedAttribute=function(e,t){return console.warn("THREE.Uint8ClampedAttribute has been removed. Use new THREE.Uint8ClampedBufferAttribute() instead."),new cn(e,t)},e.Int16Attribute=function(e,t){return console.warn("THREE.Int16Attribute has been removed. Use new THREE.Int16BufferAttribute() instead."),new hn(e,t)},e.Uint16Attribute=function(e,t){return console.warn("THREE.Uint16Attribute has been removed. Use new THREE.Uint16BufferAttribute() instead."),new ln(e,t)},e.Int32Attribute=function(e,t){return console.warn("THREE.Int32Attribute has been removed. Use new THREE.Int32BufferAttribute() instead."),new un(e,t)},e.Uint32Attribute=function(e,t){return console.warn("THREE.Uint32Attribute has been removed. Use new THREE.Uint32BufferAttribute() instead."),new dn(e,t)},e.Float32Attribute=function(e,t){return console.warn("THREE.Float32Attribute has been removed. Use new THREE.Float32BufferAttribute() instead."),new pn(e,t)},e.Float64Attribute=function(e,t){return console.warn("THREE.Float64Attribute has been removed. Use new THREE.Float64BufferAttribute() instead."),new fn(e,t)},e.ClosedSplineCurve3=au,e.SplineCurve3=ou,e.Spline=su,e.AxisHelper=function(e){return console.warn("THREE.AxisHelper has been renamed to THREE.AxesHelper."),new nu(e)},e.BoundingBoxHelper=function(e,t){return console.warn("THREE.BoundingBoxHelper has been deprecated. Creating a THREE.BoxHelper instead."),new $l(e,t)},e.EdgesHelper=function(e,t){return console.warn("THREE.EdgesHelper has been removed. Use THREE.EdgesGeometry instead."),new bo(new Os(e.geometry),new xo({color:void 0!==t?t:16777215}))},e.WireframeHelper=function(e,t){return console.warn("THREE.WireframeHelper has been removed. Use THREE.WireframeGeometry instead."),new bo(new Ro(e.geometry),new xo({color:void 0!==t?t:16777215}))},e.XHRLoader=function(e){return console.warn("THREE.XHRLoader has been renamed to THREE.FileLoader."),new ec(e)},e.BinaryTextureLoader=function(e){return console.warn("THREE.BinaryTextureLoader has been renamed to THREE.DataTextureLoader."),new ic(e)},e.GeometryUtils=cu,e.ImageUtils=hu,e.Projector=function(){console.error("THREE.Projector has been moved to /examples/js/renderers/Projector.js."),this.projectVector=function(e,t){console.warn("THREE.Projector: .projectVector() is now vector.project()."),e.project(t)},this.unprojectVector=function(e,t){console.warn("THREE.Projector: .unprojectVector() is now vector.unproject()."),e.unproject(t)},this.pickingRay=function(){console.error("THREE.Projector: .pickingRay() is now raycaster.setFromCamera().")}},e.CanvasRenderer=function(){console.error("THREE.CanvasRenderer has been moved to /examples/js/renderers/CanvasRenderer.js"),this.domElement=document.createElementNS("http://www.w3.org/1999/xhtml","canvas"),this.clear=function(){},this.render=function(){},this.setClearColor=function(){},this.setSize=function(){}},e.SceneUtils=lu,e.LensFlare=function(){console.error("THREE.LensFlare has been moved to /examples/js/objects/Lensflare.js")},Object.defineProperty(e,"__esModule",{value:!0})});
var StateLoaderLightweight = function(state){
  this.state = state;
}

StateLoaderLightweight.prototype.loadCamera = function(){
  camera = new THREE.PerspectiveCamera( this.state.camera.fov, this.state.camera.aspect, 1, 10000 );
  camera.position.set(this.state.camera.position.x, this.state.camera.position.y, this.state.camera.position.z);
  camera.quaternion.set(this.state.camera.quaternion.x, this.state.camera.quaternion.y, this.state.camera.quaternion.z, this.state.camera.quaternion.w);
}

StateLoaderLightweight.prototype.loadRenderer = function(){
  renderer = {
    viewport: new THREE.Vector4(this.state.viewport.x, this.state.viewport.y, this.state.viewport.z, this.state.viewport.w),
    getCurrentViewport: function(){
      return this.viewport;
    }
  }
  screenResolution = this.state.screenResolution;
}

StateLoaderLightweight.prototype.loadWorldLimits = function(){
  var octreeLimit = this.state.octreeLimit;
  LIMIT_BOUNDING_BOX.min.set(octreeLimit.minX, octreeLimit.minY, octreeLimit.minZ);
  LIMIT_BOUNDING_BOX.max.set(octreeLimit.maxX, octreeLimit.maxY, octreeLimit.maxZ);
  BIN_SIZE = this.state.binSize;
  RAYCASTER_STEP_AMOUNT = this.state.raycasterStepAmount;
}

StateLoaderLightweight.prototype.loadBoundingBoxes = function(){
  var gridSystemExports = this.state.gridSystems;
  var addedObjectExports = this.state.addedObjects;
  var childAddedObjectExports = this.state.childAddedObjects;
  var objectGroupExports = this.state.objectGroups;
  var addedTextExports = this.state.addedTexts3D;
  for (var gsName in gridSystemExports){
    var gridSystem = new GridSystem();
    gridSystem.name = gsName;
    gridSystem.boundingBox = new THREE.Box3(gridSystemExports[gsName].bbMin, gridSystemExports[gsName].bbMax);
    gridSystem.triangles = [];
    gridSystem.trianglePlanes = [];
    for (var i = 0; i<gridSystemExports[gsName].triangles.length; i++){
      var curExp = gridSystemExports[gsName].triangles[i];
      var aVec = new THREE.Vector3(curExp.a.x, curExp.a.y, curExp.a.z);
      var bVec = new THREE.Vector3(curExp.b.x, curExp.b.y, curExp.b.z);
      var cVec = new THREE.Vector3(curExp.c.x, curExp.c.y, curExp.c.z);
      var triangle = new THREE.Triangle(aVec, bVec, cVec);
      var plane = new THREE.Plane();
      triangle.getPlane(plane);
      gridSystem.triangles.push(triangle);
      gridSystem.trianglePlanes.push(plane);
    }
    gridSystems[gsName] = gridSystem;
  }
  var totalAddedObjectExports = new Object();
  for (var objName in addedObjectExports){
    totalAddedObjectExports[objName] = addedObjectExports[objName];
  }
  for (var objName in childAddedObjectExports){
    totalAddedObjectExports[objName] = childAddedObjectExports[objName];
  }
  for (var objName in totalAddedObjectExports){
    var curExport = totalAddedObjectExports[objName];
    var addedObject = new AddedObject();
    addedObject.isChangeable = curExport.isChangeable;
    addedObject.isIntersectable = curExport.isIntersectable;
    addedObject.parentBoundingBoxIndex = curExport.parentBoundingBoxIndex;
    addedObject.lastUpdatePosition = new THREE.Vector3();
    addedObject.lastUpdateQuaternion = new THREE.Quaternion();
    addedObject.reusableVec3 = new THREE.Vector3();
    addedObject.vertices = [];
    addedObject.transformedVertices = [];
    addedObject.triangles = [];
    addedObject.trianglePlanes = [];
    addedObject.pseudoFaces = [];
    addedObject.mesh = new THREE.Object3D();
    addedObject.mesh.matrixWorld.fromArray(curExport.matrixWorld);
    addedObject.mesh.matrixWorld.decompose(addedObject.mesh.position, addedObject.mesh.quaternion, addedObject.mesh.scale);
    addedObject.mesh.position = new THREE.Vector3(curExport.position.x, curExport.position.y, curExport.position.z);
    addedObject.mesh.quaternion = new THREE.Quaternion(curExport.quaternion.x, curExport.quaternion.y, curExport.quaternion.z, curExport.quaternion.w);
    if (childAddedObjectExports[objName]){
      addedObject.mesh.matrixWorld.decompose(addedObject.mesh.position, addedObject.mesh.quaternion, addedObject.mesh.scale);
    }
    addedObject.name = objName;
    var bb = new THREE.Box3();
    bb.roygbivObjectName = objName;
    addedObject.boundingBoxes = [bb];
    for (var i = 0; i<curExport.vertices.length; i++){
      var curVertex = curExport.vertices[i];
      var vect = new THREE.Vector3(curVertex.x, curVertex.y, curVertex.z)
      addedObject.vertices.push(vect.clone());
      addedObject.transformedVertices.push(vect);
      bb.expandByPoint(vect);
    }
    for (var i = 0; i<curExport.triangles.length; i++){
      var curExp = curExport.triangles[i];
      var aVec = new THREE.Vector3(curExp.a.x, curExp.a.y, curExp.a.z);
      var bVec = new THREE.Vector3(curExp.b.x, curExp.b.y, curExp.b.z);
      var cVec = new THREE.Vector3(curExp.c.x, curExp.c.y, curExp.c.z);
      var triangle = new THREE.Triangle(aVec, bVec, cVec);
      var plane = new THREE.Plane();
      triangle.getPlane(plane);
      addedObject.triangles.push(triangle);
      addedObject.trianglePlanes.push(plane);
    }
    for (var i = 0; i<curExport.pseudoFaces.length; i++){
      var curExp = curExport.pseudoFaces[i];
      var a = curExp.a;
      var b = curExp.b;
      var c = curExp.c;
      var materialIndex = curExp.materialIndex;
      var normal = new THREE.Vector3(curExp.normal.x, curExp.normal.y, curExp.normal.z);
      addedObject.pseudoFaces.push(new THREE.Face3(a, b, c, normal));
    }
    addedObject.updateBoundingBoxes();
    addedObjects[objName] = addedObject;
  }
  for (var objName in objectGroupExports){
    var curExport = objectGroupExports[objName];
    var objectGroup = new ObjectGroup();
    objectGroup.isIntersectable = curExport.isIntersectable;
    objectGroup.isChangeable = curExport.isChangeable;
    objectGroup.lastUpdatePosition = new THREE.Vector3();
    objectGroup.lastUpdateQuaternion = new THREE.Quaternion();
    objectGroup.boundingBoxes = [];
    objectGroup.name = objName;
    objectGroup.mesh = new THREE.Object3D();
    objectGroup.group = new Object();
    objectGroup.mesh.matrixWorld.fromArray(curExport.matrixWorld);
    objectGroup.mesh.position.set(curExport.position.x, curExport.position.y, curExport.position.z);
    objectGroup.mesh.quaternion.set(curExport.quaternion._x, curExport.quaternion._y, curExport.quaternion._z, curExport.quaternion._w);
    objectGroup.center = new THREE.Vector3(curExport.center.x, curExport.center.y, curExport.center.z);
    objectGroup.mesh.updateMatrixWorld();
    objectGroup.graphicsGroup = objectGroup.mesh;
    objectGroup.childsByChildWorkerId = new Object();
    for (var i = 0; i<curExport.childNames.length; i++){
      var childObj = addedObjects[curExport.childNames[i]];
      childObj.mesh.updateMatrixWorld();
      objectGroup.group[childObj.name] = childObj;
      childObj.mesh.position.sub(objectGroup.center);
      objectGroup.graphicsGroup.add(childObj.mesh);
      objectGroup.graphicsGroup.updateMatrixWorld();
      childObj.mesh.updateMatrixWorld();
      delete addedObjects[childObj.name];
      objectGroup.childsByChildWorkerId[curExport.childWorkerIndices[i]] = childObj;
    }
    for (var i = 0; i<curExport.boundingBoxes.length; i++){
      var curBBExport = curExport.boundingBoxes[i].boundingBox;
      var min = new THREE.Vector3(curBBExport.min.x, curBBExport.min.y, curBBExport.min.z);
      var max = new THREE.Vector3(curBBExport.max.x, curBBExport.max.y, curBBExport.max.z);
      var bb = new THREE.Box3(min.clone(), max.clone());
      bb.roygbivObjectName = curBBExport.roygbivObjectName;
      objectGroup.boundingBoxes.push(bb);
    }
    objectGroup.updateBoundingBoxes();
    objectGroups[objName] = objectGroup;
  }
  for (var textName in addedTextExports){
    var curExport = addedTextExports[textName];
    var addedText = new AddedText();
    addedText.name = curExport.name;
    addedText.bottomLeft = new THREE.Vector3(curExport.bottomLeft.x, curExport.bottomLeft.y, curExport.bottomLeft.z);
    addedText.bottomRight = new THREE.Vector3(curExport.bottomRight.x, curExport.bottomRight.y, curExport.bottomRight.z);
    addedText.topLeft = new THREE.Vector3(curExport.topLeft.x, curExport.topLeft.y, curExport.topLeft.z);
    addedText.topRight = new THREE.Vector3(curExport.topRight.x, curExport.topRight.y, curExport.topRight.z);
    addedText.characterSize = curExport.charSize;
    addedText.mesh = new THREE.Object3D();
    addedText.mesh.position.set(curExport.position.x, curExport.position.y, curExport.position.z);
    addedText.position = new THREE.Vector3(curExport.initPosition.x, curExport.initPosition.y, curExport.initPosition.z);
    addedText.tmpObj = new Object();
    addedText.lastUpdateQuaternion = new THREE.Quaternion();
    addedText.lastUpdatePosition = new THREE.Vector3();
    addedText.lastUpdateCameraPosition = new THREE.Vector3();
    addedText.isClickable = curExport.isClickable;
    addedText.handleBoundingBox();
    addedTexts[textName] = addedText;
  }
}

StateLoaderLightweight.prototype.reset = function(){
  addedObjects = new Object();
  objectGroups = new Object();
  gridSystems = new Object();
  addedTexts = new Object();
}
/*
  note from the future:
  this is the first engine obj class of the engine so I was motivated about
  writing comments and stuff like below.

  CONSTRUCTOR PARAMETERS
    name -> name of this grid system, must be unique.
    sizeX -> size along the x axis
    sizeZ -> size along the z axis
    centerX -> x coordinate of the center point
    centerY -> y coordinate of the center point
    centerZ -> z coordinate of the center point
    color -> color of this grid system (lowercase X11 color name)
    outlineColor -> color of the outline of each grid (lowercase X11 color name)
    cellSize -> size of each grid of this grid system
    axis -> axis (XZ / XY / YZ)

*/
var GridSystem = function(name, sizeX, sizeZ, centerX, centerY, centerZ,
                                              outlineColor, cellSize, axis){

  this.isGridSystem = true;
  if (IS_WORKER_CONTEXT){
    return this;
  }

  // size negativity/zero check
  if (sizeX<=0 || sizeZ <=0){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_1);
    }
    return;
  }

  // size mismatch check
  if (sizeX%cellSize != 0){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_2);
    }
    return;
  }
  if (sizeZ%cellSize != 0){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_3);
    }
    return;
  }

  // check if name is unique
  if (gridSystems[name]){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_4);
    }
    return;
  }

  // LIMITATIONS
  if (cellSize < MIN_CELLSIZE_ALLOWED){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_5);
    }
    return;
  }
  var totalGridCount = (sizeX * sizeZ) / (cellSize * cellSize);
  if (gridCounter + totalGridCount > MAX_GRIDS_ALLOWED){
    if (!isDeployment){
      terminal.printError(Text.GS_CREATION_ERROR_6);
    }
    return;
  }

  this.totalGridCount = totalGridCount;
  this.name = name;
  this.sizeX = sizeX;
  this.sizeZ = sizeZ;
  this.centerX = centerX;
  this.centerY = centerY;
  this.centerZ = centerZ;
  this.outlineColor = outlineColor;
  this.cellSize = cellSize;
  this.cellCount = 0;
  this.axis = axis;

  this.grids = new Object();
  this.gridsByColRow = new Object();
  this.slicedGrids = new Object();

  if (this.axis == "XZ"){

    var initX = centerX - (sizeX / 2);
    var finalX = centerX + (sizeX / 2);
    var initZ = centerZ + (sizeZ / 2);
    var finalZ = centerZ - (sizeZ / 2);

    this.initX = initX;
    this.finalX = finalX;
    this.initZ = initZ;
    this.finalZ = finalZ;

    var gridNumber = 1;

    for (var x = initX; x < finalX; x+=cellSize){
      for (var z = initZ; z > finalZ; z-= cellSize){
        var grid = new Grid(name+"_grid_"+gridNumber, name, x,
                  centerY, z, cellSize, this.outlineColor,
                                  x/cellSize, z/cellSize, this.axis);
        grid.gridNumber = gridNumber;
        this.grids[gridNumber] = grid;
        this.gridsByColRow[grid.colNumber+"_"+grid.rowNumber] = grid;
        this.cellCount++;
        gridNumber ++;
      }
    }

  }else if (this.axis == "XY"){

    var initX = centerX - (sizeX / 2);
    var finalX = centerX + (sizeX / 2);
    var initY = centerY + (sizeZ / 2);
    var finalY = centerY - (sizeZ / 2);

    this.initX = initX;
    this.finalX = finalX;
    this.initY= initY;
    this.finalY = finalY;

    var gridNumber = 1;

    for (var x = initX; x<finalX; x+=cellSize){
      for (var y = initY; y>finalY; y-=cellSize){
        var grid = new Grid(name+"_grid_"+gridNumber, name, x, y,
                          centerZ, cellSize, this.outlineColor,
                                      x/cellSize, y/cellSize, this.axis);
        grid.gridNumber = gridNumber;
        this.grids[gridNumber] = grid;
        this.gridsByColRow[grid.colNumber+"_"+grid.rowNumber] = grid;
        this.cellCount++;
        gridNumber++;
      }
    }

  }else if (this.axis = "YZ"){

    var initY = centerY + (sizeX / 2);
    var finalY = centerY - (sizeX / 2);
    var initZ = centerZ - (sizeZ / 2);
    var finalZ = centerZ + (sizeZ / 2);

    this.initY = initY;
    this.finalY = finalY;
    this.initZ = initZ;
    this.finalZ = finalZ;

    var gridNumber = 1;

    for (var z = initZ; z<finalZ; z+= cellSize){
      for (var y = initY; y>finalY; y-= cellSize){
        var grid = new Grid(name+"_grid_"+gridNumber, name, centerX, y, z,
                                  cellSize, this.outlineColor,
                                      z/cellSize, y/cellSize, this.axis);
        grid.gridNumber = gridNumber;
        this.grids[gridNumber] = grid;
        this.gridsByColRow[grid.colNumber+"_"+grid.rowNumber] = grid;
        this.cellCount++;
        gridNumber++;
      }
    }

  }

  this.draw();

  this.boundingBox = new THREE.Box3().setFromObject(this.boundingPlane);
  if (!LIMIT_BOUNDING_BOX.containsBox(this.boundingBox)){
    this.destroy();
    if (!isDeployment){
      terminal.printError(Text.GRID_SYSTEM_IS_OUT_OF);
    }
    return;
  }

  gridSystems[name] = this;

  gridCounter = gridCounter + totalGridCount;

  if (!isDeployment){
    terminal.printInfo(Text.GS_CREATED);
  }
}

GridSystem.prototype.draw = function(){
  var geometry = new THREE.Geometry();
  var color = this.outlineColor;
  var material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    linewidth: 4,
    opacity: 0.5,
    depthWrite: false
  });

  for (var i = 0; i<= this.sizeX; i+= this.cellSize){
    geometry.vertices.push(
      new THREE.Vector3(i, 0, 0),
      new THREE.Vector3(i, 0, this.sizeZ)
    );
  }
  for (var i = 0; i<= this.sizeZ; i+= this.cellSize){
    geometry.vertices.push(
      new THREE.Vector3(0, 0, i),
      new THREE.Vector3(this.sizeX, 0, i)
    );
  }

  var boundingPlaneGeometry;
  if (this.axis == "XZ" || this.axis == "XY"){
    var geomKey = (
      "PlaneBufferGeometry" + PIPE +
      this.sizeX + PIPE + this.sizeZ + PIPE +
      "1" + PIPE + "1"
    );
    boundingPlaneGeometry = geometryCache[geomKey];
    if (!boundingPlaneGeometry){
      boundingPlaneGeometry = new THREE.PlaneBufferGeometry(
        this.sizeX, this.sizeZ
      );
      geometryCache[geomKey] = boundingPlaneGeometry;
    }
  }else if (this.axis == "YZ"){
    var geomKey = (
      "PlaneBufferGeometry" + PIPE +
      this.sizeZ + PIPE + this.sizeX + PIPE +
      "1" + PIPE + "1"
    );
    boundingPlaneGeometry = geometryCache[geomKey];
    if (!boundingPlaneGeometry){
      boundingPlaneGeometry = new THREE.PlaneBufferGeometry(
        this.sizeZ, this.sizeX
      );
      geometryCache[geomKey] = boundingPlaneGeometry;
    }
  }

  var boundingPlaneMaterial = new THREE.MeshBasicMaterial({
    color: 'black',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 4.0
  });
  var boundingPlane = new THREE.Mesh(
    boundingPlaneGeometry, boundingPlaneMaterial
  );
  boundingPlane.renderOrder = 10;

  geometry.center();
  var gridSystemRepresentation = new THREE.LineSegments(
    geometry, material
  );
  gridSystemRepresentation.renderOrder = 10;

  gridSystemRepresentation.position.set(
    this.centerX,
    this.centerY,
    this.centerZ
  );

  boundingPlane.position.set(
    this.centerX,
    this.centerY,
    this.centerZ
  );

  if (this.axis == "XZ"){
    boundingPlane.rotateX(Math.PI/2);
  }
  if (this.axis == "XY"){
    gridSystemRepresentation.rotateX(Math.PI / 2);
  }
  if (this.axis == "YZ"){
    gridSystemRepresentation.rotateZ(Math.PI / 2);
    boundingPlane.rotateY(Math.PI/2);
  }

  this.gridSystemRepresentation = gridSystemRepresentation;
  this.boundingPlane = boundingPlane;
  this.boundingPlane.gridSystemName = this.name;
  this.gridSystemRepresentation.gridSystemName = this.name;

  this.boundingBox = new THREE.Box3().setFromObject(this.boundingPlane);
  this.trianglePlanes = [];
  this.triangles = [];
  var pseudoGeom = new THREE.Geometry().fromBufferGeometry(boundingPlaneGeometry);
  var transformedVertices = [];
  for (var i = 0; i<pseudoGeom.vertices.length; i++){
    var vertex = pseudoGeom.vertices[i].clone();
    vertex.applyMatrix4(this.boundingPlane.matrixWorld);
    transformedVertices.push(vertex);
  }
  for (var i = 0; i<pseudoGeom.faces.length; i++){
    var face = pseudoGeom.faces[i];
    var a = face.a;
    var b = face.b;
    var c = face.c;
    var triangle = new THREE.Triangle(
      transformedVertices[a], transformedVertices[b], transformedVertices[c]
    );
    this.triangles.push(triangle);
    var plane = new THREE.Plane();
    triangle.getPlane(plane);
    this.trianglePlanes.push(plane);
  }

  scene.add(this.gridSystemRepresentation);
  scene.add(this.boundingPlane);

}

GridSystem.prototype.intersectsLine = function(line){
  for (var i = 0; i< this.trianglePlanes.length; i+=2){
    var plane = this.trianglePlanes[i];
    if (plane.intersectLine(line, REUSABLE_VECTOR)){
      var triangle1 = this.triangles[i];
      var triangle2 = this.triangles[i+1];
      if (triangle1.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }else if (triangle2.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }
    }
  }
  return false;
}

GridSystem.prototype.getDistanceBetweenPointAndGrid = function(grid, point){
  var xDif = grid.centerX - point.x;
  var yDif = grid.centerY - point.y;
  var zDif = grid.centerZ - point.z;
  return Math.sqrt(
    (xDif * xDif) +
    (yDif * yDif) +
    (zDif * zDif)
  );
}

GridSystem.prototype.getGridFromPoint = function(point){
    if (this.axis == "XZ"){
      var xSegment, zSegment;
      var xStart = this.centerX  - (this.sizeX / 2);
      var xEnd = this.centerX + (this.sizeX / 2);
      var zStart = this.centerZ + (this.sizeZ / 2);
      var zEnd = this.centerZ - (this.sizeZ / 2);
      if (point.x >= xStart && point.x <= xEnd){
        var xDiff = point.x - xStart;
        var xSegment = Math.floor(xDiff / this.cellSize) + 1;
        if (point.z <= zStart && point.z >= zEnd){
          var zDiff = zStart - point.z;
          var zSegment = Math.floor(zDiff / this.cellSize) +1;
        }
      }
      if (xSegment && zSegment){
        var count = (xSegment - 1)*(this.sizeZ / this.cellSize);
        count += zSegment;
        return this.grids[count];
      }
    }else if (this.axis == "YZ"){
      var ySegment, zSegment;
      var yStart = this.centerY + (this.sizeX / 2);
      var yEnd = this.centerY - (this.sizeX / 2);
      var zStart = this.centerZ - (this.sizeZ / 2);
      var zEnd = this.centerZ + (this.sizeZ / 2);
      if (point.y <= yStart && point.y >= yEnd){
        var yDiff = yStart - point.y;
        var ySegment = Math.floor(yDiff / this.cellSize) + 1;
        if (point.z >= zStart && point.z <= zEnd){
          var zDiff = point.z - zStart;
          var zSegment = Math.floor(zDiff / this.cellSize) +1;
        }
      }
      if (ySegment && zSegment){
        var count = (zSegment - 1)*(this.sizeX / this.cellSize);
        count += ySegment;
        return this.grids[count];
      }
    }else if (this.axis == "XY"){
      var xSegment, ySegment;
      var xStart = this.centerX  - (this.sizeX / 2);
      var xEnd = this.centerX + (this.sizeX / 2);
      var yStart = this.centerY + (this.sizeZ / 2);
      var yEnd = this.centerY - (this.sizeZ / 2);
      if (point.x >= xStart && point.x <= xEnd){
        var xDiff = point.x - xStart;
        var xSegment = Math.floor(xDiff / this.cellSize) + 1;
        if (point.y <= yStart && point.y >= yEnd){
          var yDiff = yStart - point.y;
          var ySegment = Math.floor(yDiff / this.cellSize) +1;
        }
      }
      if (xSegment && ySegment){
        var count = (xSegment - 1)*(this.sizeZ / this.cellSize);
        count += ySegment;
        return this.grids[count];
      }
    }
}

GridSystem.prototype.exportLightweight = function(){
  var exportObject = new Object();
  exportObject.name = this.name;
  exportObject.bbMin = this.boundingBox.min;
  exportObject.bbMax = this.boundingBox.max;
  exportObject.triangles = [];
  for (var i = 0; i<this.triangles.length; i++){
    exportObject.triangles.push({
      a: this.triangles[i].a, b: this.triangles[i].b, c: this.triangles[i].c
    })
  }
  return exportObject;
}

GridSystem.prototype.export = function(){
  var exportObject = new Object();
  exportObject.name = this.name;
  exportObject.sizeX = this.sizeX;
  exportObject.sizeZ = this.sizeZ;
  exportObject.centerX = this.centerX;
  exportObject.centerY = this.centerY;
  exportObject.centerZ = this.centerZ;
  exportObject.outlineColor = this.outlineColor;
  exportObject.cellSize = this.cellSize;
  exportObject.axis = this.axis;
  exportObject.isSuperposed = this.isSuperposed;
  var selectedGridsExport = [];
  var slicedGridsExport = [];
  var slicedGridSystemNamesExport = [];
  for (var selectedGridName in gridSelections){
    var grid = gridSelections[selectedGridName];
    if (grid.parentName == this.name){
      selectedGridsExport.push(grid.gridNumber);
    }
  }
  for (var gridName in this.slicedGrids){
    var grid = this.slicedGrids[gridName];
    slicedGridsExport.push(grid.gridNumber);
    slicedGridSystemNamesExport.push(grid.slicedGridSystemName);
  }
  exportObject.selectedGridsExport = selectedGridsExport;
  exportObject.slicedGridsExport = slicedGridsExport;
  exportObject.slicedGridSystemNamesExport = slicedGridSystemNamesExport;
  if (this.markedPointNames){
    exportObject.markedPointNames = [];
    for (var i = 0; i<this.markedPointNames.length; i++){
      exportObject.markedPointNames.push(this.markedPointNames[i]);
    }
  }
  return exportObject;
}

GridSystem.prototype.getGridByColRow = function(col, row){
  return this.gridsByColRow[col+"_"+row];
}

GridSystem.prototype.printInfo = function(){
  terminal.printHeader(this.name);
  terminal.printInfo(
    Text.TREE_NAME.replace(Text.PARAM1, this.name),
    true
  );
  terminal.printInfo(
    Text.TREE_SIZEX.replace(Text.PARAM1, this.sizeX),
    true
  );
  terminal.printInfo(
    Text.TREE_SIZEZ.replace(Text.PARAM1, this.sizeZ),
    true
  );
  terminal.printInfo(
    Text.TREE_CENTERX.replace(Text.PARAM1, this.centerX),
    true
  );
  terminal.printInfo(
    Text.TREE_CENTERY.replace(Text.PARAM1, this.centerY),
    true
  );
  terminal.printInfo(
    Text.TREE_CENTERZ.replace(Text.PARAM1, this.centerZ),
    true
  );
  terminal.printInfo(
    Text.TREE_COLOR.replace(Text.PARAM1, this.outlineColor),
    true
  );
  terminal.printInfo(
    Text.TREE_CELL_SIZE.replace(Text.PARAM1, this.cellSize),
    true
  );
  terminal.printInfo(
    Text.TREE_CELL_COUNT.replace(Text.PARAM1, this.cellCount),
    true
  );
  terminal.printInfo(
    Text.TREE_AXIS.replace(Text.PARAM1, this.axis)
  );
}

GridSystem.prototype.destroy = function(){

  if (this.slicedGrid){
    this.slicedGrid.sliced = false;
    this.slicedGrid.slicedGridSystemName = 0;
  }

  scene.remove(this.gridSystemRepresentation);
  scene.remove(this.boundingPlane);

  this.gridSystemRepresentation.geometry.dispose();
  this.gridSystemRepresentation.material.dispose();
  this.boundingPlane.geometry.dispose();
  this.boundingPlane.material.dispose();

  for (var i in this.grids){
    this.grids[i].parentDestroyed = true;
    if (this.grids[i].selected){
      this.grids[i].toggleSelect();
    }
  }
  delete gridSystems[this.name];
  gridCounter = gridCounter - this.totalGridCount;

  if (this.markedPointNames){
    for (var i = 0; i<this.markedPointNames.length; i++){
      var markedPoint = markedPoints[this.markedPointNames[i]];
      if (markedPoint){
        markedPoint.gridDestroyed = true;
        scene.remove(markedPoint.line);
        delete markedPoint.line;
      }
    }
  }

  for (var objName in addedObjects){
    var obj = addedObjects[objName];
    if (obj.metaData.gridSystemName == this.name){
      obj.destroyedGrids = new Object();
    }
  }
  for (var objName in objectGroups){
    var obj = objectGroups[objName];
    for (var childName in obj.group){
      if (obj.group[childName].metaData.gridSystemName == this.name){
        obj.group[childName].destroyedGrids = new Object();
      }
    }
  }
  for (var textName in addedTexts){
    var obj = addedTexts[textName];
    if (obj.gsName == this.name){
      obj.destroyedGrids = new Object();
    }
  }

  rayCaster.refresh();

}

GridSystem.prototype.selectAllGrids = function(){
  for (var i in this.grids){
    if (!this.grids[i].selected){
      this.grids[i].toggleSelect();
    }
  }
}

GridSystem.prototype.crop = function(grid1, grid2){
  var centerX = (grid1.centerX + grid2.centerX)/2;
  var centerY = (grid1.centerY + grid2.centerY)/2;
  var centerZ = (grid1.centerZ + grid2.centerZ)/2;

  if (this.axis =="XZ"){

    var croppedSizeX = this.cellSize * (Math.abs(grid1.colNumber - grid2.colNumber) + 1);
    var croppedSizeZ = this.cellSize * (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1);

    croppedGridSystemBuffer = new CroppedGridSystem(croppedSizeX, croppedSizeZ, centerX, centerY, centerZ, this.axis);

  } else if (this.axis == "XY"){

    var croppedSizeX = this.cellSize * (Math.abs(grid1.colNumber - grid2.colNumber) + 1);
    var croppedSizeZ = this.cellSize * (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1);

    croppedGridSystemBuffer = new CroppedGridSystem(croppedSizeX, croppedSizeZ, centerX, centerY, centerZ, this.axis);

  }else if (this.axis == "YZ"){

    var croppedSizeX = this.cellSize * (Math.abs(grid1.colNumber - grid2.colNumber) + 1);
    var croppedSizeZ = this.cellSize * (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1);

    croppedGridSystemBuffer = new CroppedGridSystem(croppedSizeZ, croppedSizeX, centerX, centerY, centerZ, this.axis);

  }

  if (!isDeployment){
    terminal.printInfo(Text.GS_CROPPED);
  }
}

GridSystem.prototype.newArea = function(name, height, selections){
  var boxCenterX, boxCenterY, boxCenterZ, boxSizeX, boxSizeY, boxSizeZ;
  if (selections.length == 1){
    var grid = selections[0];
    boxCenterX = grid.centerX;
    boxCenterZ = grid.centerZ;
    boxSizeX = this.cellSize;
    boxSizeZ = this.cellSize;
  }else{
    var grid1 = selections[0];
    var grid2 = selections[1];
    boxCenterX = (grid1.centerX + grid2.centerX) / 2;
    boxCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    boxSizeX = (Math.abs(grid1.colNumber - grid2.colNumber) + 1) * this.cellSize;
    boxSizeZ = (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1) * this.cellSize;
  }

  boxCenterY = this.centerY + (height / 2);
  boxSizeY = Math.abs(height);

  if (this.axis == "XY"){
    var tmp = boxSizeY;
    boxSizeY = boxSizeZ;
    boxSizeZ = tmp;
    boxCenterZ = this.centerZ + (height / 2);
    if (selections.length == 1){
        var grid = selections[0];
        boxCenterY = grid.centerY;
    }else{
      var grid1 = selections[0];
      var grid2 = selections[1];
      boxCenterY = (grid1.centerY + grid2.centerY) / 2;
    }
  }else if (this.axis == "YZ"){
    var oldX = boxSizeX;
    var oldY = boxSizeY;
    var oldZ = boxSizeZ;
    boxSizeZ = oldX;
    boxSizeX = oldY;
    boxSizeY = oldZ;
    if (selections.length == 1){
      var grid = selections[0];
      boxCenterY = grid.centerY;
      boxCenterZ = grid.centerZ;
      boxCenterX = grid.centerX + (height / 2);
    }else{
      var grid1 = selections[0];
      var grid2 = selections[1];
      boxCenterY = (grid1.centerY + grid2.centerY) / 2;
      boxCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
      boxCenterX = grid1.centerX + (height / 2);
    }
  }

  if (this.isSuperposed){
    boxCenterY = boxCenterY - superposeYOffset;
  }

  var boundingBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(boxCenterX, boxCenterY, boxCenterZ),
    new THREE.Vector3(boxSizeX, boxSizeY, boxSizeZ)
  );

  areas[name] = new Area(name, boundingBox, this.outlineColor, selections[0].size);
  if (areasVisible){
    areas[name].renderToScreen();
  }

  for (var i = 0; i<selections.length; i++){
    selections[i].toggleSelect(false, false, false, true);
  }

  areaBinHandler.insert(boundingBox, name);

}

GridSystem.prototype.newSurface = function(name, grid1, grid2, material){
  if (!grid2){
    grid2 = grid1;
  }
  var height = (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1) * this.cellSize;
  var width = (Math.abs(grid1.colNumber - grid2.colNumber ) + 1) * this.cellSize;
  var geomKey = (
    "PlaneBufferGeometry" + PIPE +
    width + PIPE + height + PIPE +
    "1" + PIPE + "1"
  );
  var geometry;
  if (geometryCache[geomKey]){
    geometry = geometryCache[geomKey];
  }else{
    geometry = new THREE.PlaneBufferGeometry(width, height);
    geometryCache[geomKey] = geometry;
  }
  var surface = new MeshGenerator(geometry, material).generateMesh();
  if (this.axis == "XZ"){

    surface.position.x = (grid1.centerX + grid2.centerX) / 2;
    surface.position.y = this.centerY;
    surface.position.z = (grid1.centerZ + grid2.centerZ) / 2;
    surface.rotation.x = Math.PI / 2;

    if (this.isSuperposed){
      surface.position.y = surface.position.y - superposeYOffset;
    }

  } else if (this.axis == "XY"){

    surface.position.x = (grid1.centerX + grid2.centerX) / 2;
    surface.position.y = (grid1.centerY + grid2.centerY) / 2;
    surface.position.z = this.centerZ;

  }else if (this.axis == "YZ"){

    surface.position.x = this.centerX;
    surface.position.y = (grid1.centerY + grid2.centerY) / 2;
    surface.position.z = (grid1.centerZ + grid2.centerZ) / 2;
    surface.rotation.y = Math.PI / 2;

  }

  grid1.toggleSelect(false, false, false, true);
  if (grid1.name != grid2.name){
    grid2.toggleSelect(false, false, false, true);
  }

  delete gridSelections[grid1.name];
  delete gridSelections[grid2.name];

  var startRow, finalRow, startCol, finalCol;

  var destroyedGrids = new Object();

  startRow = grid1.rowNumber;
  if (grid2.rowNumber < grid1.rowNumber){
    startRow = grid2.rowNumber;
  }
  startCol = grid1.colNumber;
  if (grid2.colNumber < grid1.colNumber){
    startCol = grid2.colNumber;
  }
  finalRow = grid1.rowNumber;
  if (grid2.rowNumber > grid1.rowNumber){
    finalRow = grid2.rowNumber;
  }
  finalCol = grid1.colNumber;
  if (grid2.colNumber > grid1.colNumber){
    finalCol = grid2.colNumber;
  }
  for (var row = startRow; row <= finalRow; row++){
    for (var col = startCol; col <= finalCol; col++ ){
      var grid = this.getGridByColRow(col, row);
      if (grid){
        destroyedGrids[grid.name] = grid;
      }
    }
  }

  scene.add(surface);

  var surfacePhysicsShape;
  var physicsShapeParameters = new Object();

  if (this.axis == "XZ"){
    physicsShapeParameters["x"] = width/2;
    physicsShapeParameters["y"] = surfacePhysicalThickness;
    physicsShapeParameters["z"] = height/2;
  }else if (this.axis == "XY"){
    physicsShapeParameters["x"] = width/2;
    physicsShapeParameters["z"] = surfacePhysicalThickness;
    physicsShapeParameters["y"] = height/2;
  }else if (this.axis == "YZ"){
    physicsShapeParameters["z"] = width/2;
    physicsShapeParameters["x"] = surfacePhysicalThickness;
    physicsShapeParameters["y"] = height/2;
  }
  var physicsShapeKey = "BOX" + PIPE + physicsShapeParameters["x"] + PIPE +
                                       physicsShapeParameters["y"] + PIPE +
                                       physicsShapeParameters["z"];
  surfacePhysicsShape = physicsShapeCache[physicsShapeKey];
  if (!surfacePhysicsShape){
    surfacePhysicsShape = new CANNON.Box(new CANNON.Vec3(
      physicsShapeParameters["x"],
      physicsShapeParameters["y"],
      physicsShapeParameters["z"]
    ));
    physicsShapeCache[physicsShapeKey] = surfacePhysicsShape;
  }
  var physicsMaterial = new CANNON.Material();
  var surfacePhysicsBody = new CANNON.Body({
    mass: 0,
    shape: surfacePhysicsShape,
    material: physicsMaterial
  });
  surfacePhysicsBody.position.set(
    surface.position.x,
    surface.position.y,
    surface.position.z
  );
  physicsWorld.add(surfacePhysicsBody);

  var metaData = new Object();
  metaData["grid1Name"] = grid1.name;
  metaData["grid2Name"] = grid2.name;
  metaData["height"] = height;
  metaData["width"] = width;
  metaData["gridSystemName"] = this.name;
  metaData["gridSystemAxis"] = this.axis;
  metaData["positionX"] = surface.position.x;
  metaData["positionY"] = surface.position.y;
  metaData["positionZ"] = surface.position.z;
  metaData["quaternionX"] = surface.quaternion.x;
  metaData["quaternionY"] = surface.quaternion.y;
  metaData["quaternionZ"] = surface.quaternion.z;
  metaData["quaternionW"] = surface.quaternion.w;
  metaData["physicsShapeParameterX"] = physicsShapeParameters["x"];
  metaData["physicsShapeParameterY"] = physicsShapeParameters["y"];
  metaData["physicsShapeParameterZ"] = physicsShapeParameters["z"];

  var addedObjectInstance = new AddedObject(name, "surface", metaData, material,
                                    surface, surfacePhysicsBody, destroyedGrids);
  addedObjects[name] = addedObjectInstance;

  surface.addedObject = addedObjectInstance;
  addedObjectInstance.updateMVMatrix();
}

GridSystem.prototype.newRamp = function(anchorGrid, otherGrid, axis, height, material, name){

  var rampWidth, rampHeight;
  var centerX, centerY, centerZ;
  var colDif, rowDif;

  if (this.axis == "XZ"){
    centerX = (anchorGrid.centerX + otherGrid.centerX) / 2;
    centerZ = (anchorGrid.centerZ + otherGrid.centerZ) / 2;
    if (this.isSuperposed){
        anchorGrid.centerY = anchorGrid.centerY - superposeYOffset;
        otherGrid.centerY = otherGrid.centerY - superposeYOffset;
    }
    centerY = (anchorGrid.centerY + (otherGrid.centerY + height)) / 2;
  }else if (this.axis == "XY"){
    centerX = (anchorGrid.centerX + otherGrid.centerX) / 2;
    centerY = (anchorGrid.centerY + otherGrid.centerY) / 2;
    centerZ = (anchorGrid.centerZ + (otherGrid.centerZ + height)) / 2;
  }else if (this.axis == "YZ"){
    centerX = (anchorGrid.centerX + (otherGrid.centerX + height)) / 2;
    centerY = (anchorGrid.centerY + otherGrid.centerY) / 2;
    centerZ = (anchorGrid.centerZ + otherGrid.centerZ) / 2;
  }

  if (axis == "x"){
    rampHeight = (Math.abs(anchorGrid.rowNumber - otherGrid.rowNumber) + 1) * this.cellSize;
    colDif = (Math.abs(anchorGrid.colNumber - otherGrid.colNumber) + 1) * this.cellSize;
    rampWidth = Math.sqrt((colDif * colDif) + (height * height));
  }else if (axis == "z") {
    if (this.axis == "YZ"){
      rampHeight = (Math.abs(anchorGrid.rowNumber - otherGrid.rowNumber) + 1) * this.cellSize;
      colDif = (Math.abs(anchorGrid.colNumber - otherGrid.colNumber) + 1) * this.cellSize;
      rampWidth = Math.sqrt((colDif * colDif) + (height * height));
    }else{
      rampWidth = (Math.abs(anchorGrid.colNumber - otherGrid.colNumber) + 1) * this.cellSize;
      rowDif = (Math.abs(anchorGrid.rowNumber - otherGrid.rowNumber) + 1) * this.cellSize;
      rampHeight = Math.sqrt((rowDif * rowDif) + (height * height));
    }
  }else if (axis == "y"){
    rampWidth = (Math.abs(anchorGrid.colNumber - otherGrid.colNumber) + 1) * this.cellSize;
    rowDif = (Math.abs(anchorGrid.rowNumber - otherGrid.rowNumber) + 1) * this.cellSize;
    rampHeight = Math.sqrt((rowDif * rowDif) + (height * height));
  }
  var geometry;
  var geomKey = (
    "PlaneBufferGeometry" + PIPE +
    rampWidth + PIPE + rampHeight + PIPE +
    "1" + PIPE + "1"
  );
  geometry = geometryCache[geomKey];
  if (!geometry){
    geometry = new THREE.PlaneBufferGeometry(rampWidth, rampHeight);
    geometryCache[geomKey] = geometry;
  }
  var ramp = new MeshGenerator(geometry, material).generateMesh();

  ramp.position.x = centerX;
  ramp.position.y = centerY;
  ramp.position.z = centerZ;
  if (this.axis == "XZ"){
    ramp.rotation.x = Math.PI / 2;
  }
  if (this.axis == "YZ"){
    if (axis == "z"){
      ramp.rotation.y = Math.PI / 2;
    }else{
      ramp.rotation.y = Math.PI / 2;
    }
  }

  if (axis == "x"){
    var coef = 1;
    if (this.axis == "XY"){
      coef = -1;
    }
    var alpha = Math.acos(colDif / rampWidth);
    if (anchorGrid.centerX > otherGrid.centerX){
      if (height >= 0 ){
        ramp.rotateY(-1 * alpha * coef);
      }else {
        ramp.rotateY(alpha * coef);
      }
    }else{
      if (height >= 0){
        ramp.rotateY(alpha * coef);
      }else{
        ramp.rotateY(-1 * alpha * coef);
      }
    }
  }else if (axis == "z"){
    var alpha = Math.acos(rowDif / rampHeight);
    if (this.axis == "YZ"){
      alpha = Math.asin(height / rampWidth);
      if (anchorGrid.centerZ > otherGrid.centerZ){
        ramp.rotateY(-1 * alpha);
      }else{
        ramp.rotateY(alpha);
      }
    }else{
      if (anchorGrid.centerZ > otherGrid.centerZ){
        if (height >= 0){
          ramp.rotateX(alpha);
        }else{
          ramp.rotateX(-1 * alpha);
        }
      }else{
        if (height >= 0){
          ramp.rotateX(-1 * alpha);
        }else{
          ramp.rotateX(alpha);
        }
      }
    }
  }else if (axis == "y"){
    var alpha = Math.acos(rowDif / rampHeight);
    if (anchorGrid.centerY < otherGrid.centerY){
      if (height >= 0){
        ramp.rotateX(alpha);
      }else{
        ramp.rotateX(-1 * alpha);
      }
    }else{
      if (height >= 0){
        ramp.rotateX(-1 * alpha);
      }else{
        ramp.rotateX(alpha);
      }
    }
  }

  scene.add(ramp);

  var rampPhysicsShape;
  var physicsShapeKey = "BOX" + PIPE + (rampWidth/2) + PIPE +
                                       (surfacePhysicalThickness) + PIPE +
                                       (rampHeight/2);
  rampPhysicsShape = physicsShapeCache[physicsShapeKey];
  if (!rampPhysicsShape){
    rampPhysicsShape = new CANNON.Box(new CANNON.Vec3(
      rampWidth/2,
      surfacePhysicalThickness,
      rampHeight/2
    ));
    physicsShapeCache[physicsShapeKey] = rampPhysicsShape;
  }

  var physicsMaterial = new CANNON.Material();

  var rampPhysicsBody = new CANNON.Body({
    mass: 0,
    shape: rampPhysicsShape,
    material: physicsMaterial
  });
  rampPhysicsBody.position.set(
    ramp.position.x,
    ramp.position.y,
    ramp.position.z
  );

  var fromEuler = new Object();

  fromEuler["x"] = 0;
  fromEuler["y"] = 0;
  fromEuler["z"] = 0;

  if (axis == "x"){
    if (this.axis == "XZ"){
      fromEuler["x"] = 0;
      fromEuler["y"] = 0;
      fromEuler["z"] = ramp.rotation.y;
    }else if (this.axis == "XY"){
      fromEuler["x"] = Math.PI / 2;
      fromEuler["y"] = 0;
      fromEuler["z"] = -1 * ramp.rotation.y;
    }
  }else if (axis == "z"){
    if (this.axis == "YZ"){
      var coef = 1;
      if (otherGrid.centerZ > anchorGrid.centerZ){
        coef = -1;
      }

      if (height < 0){
          coef = coef * -1;
      }
      fromEuler["x"] = Math.PI / 2 ;
      fromEuler["y"] = 0;
      fromEuler["z"] = (-1 * ramp.rotation.y * coef);
    }else{
      fromEuler["x"] = ramp.rotation.x - (Math.PI / 2);
      fromEuler["y"] = 0;
      fromEuler["z"] = 0;
    }
  }else if (axis == "y"){
    if (this.axis == "YZ"){
      fromEuler["x"] = ramp.rotation.x;
      fromEuler["y"] = ramp.rotation.y + (Math.PI / 2);
      fromEuler["z"] = Math.PI / 2;
    }else{
      fromEuler["x"] = (Math.PI / 2) + ramp.rotation.x;
      fromEuler["y"] = 0;
      fromEuler["z"] = 0;
    }
  }

  rampPhysicsBody.quaternion.setFromEuler(
    fromEuler["x"],
    fromEuler["y"],
    fromEuler["z"]
  );
  physicsWorld.add(rampPhysicsBody);

  var metaData = new Object();
  metaData["anchorGridName"] = anchorGrid.name;
  metaData["otherGridName"] = otherGrid.name;
  metaData["rampHeight"] = rampHeight;
  metaData["rampWidth"] = rampWidth;
  metaData["gridSystemName"] = this.name;
  metaData["axis"] = axis;
  metaData["gridSystemAxis"] = this.axis;
  metaData["height"] = height;
  metaData["quaternionX"] = ramp.quaternion.x;
  metaData["quaternionY"] = ramp.quaternion.y;
  metaData["quaternionZ"] = ramp.quaternion.z;
  metaData["quaternionW"] = ramp.quaternion.w;
  metaData["centerX"] = ramp.position.x;
  metaData["centerY"] = ramp.position.y;
  metaData["centerZ"] = ramp.position.z;
  metaData["fromEulerX"] = fromEuler["x"];
  metaData["fromEulerY"] = fromEuler["y"];
  metaData["fromEulerZ"] = fromEuler["z"];

  var addedObjectInstance = new AddedObject(name, "ramp", metaData, material,
                                    ramp, rampPhysicsBody, new Object());
  addedObjects[name] = addedObjectInstance;

  ramp.addedObject = addedObjectInstance;
  addedObjectInstance.updateMVMatrix();
  anchorGrid.toggleSelect(false, false, false, true);
  if (otherGrid.selected){
    otherGrid.toggleSelect(false, false, false, true);
  }
  delete gridSelections[anchorGrid.name];
  delete gridSelections[otherGrid.name];

}

GridSystem.prototype.newBox = function(selections, height, material, name){
  var boxCenterX, boxCenterY, boxCenterZ;
  var boxSizeX, boxSizeY, boxSizeZ;

  if (selections.length == 1){
    var grid = selections[0];
    boxCenterX = grid.centerX;
    boxCenterZ = grid.centerZ;
    boxSizeX = this.cellSize;
    boxSizeZ = this.cellSize;
  }else{
    var grid1 = selections[0];
    var grid2 = selections[1];
    boxCenterX = (grid1.centerX + grid2.centerX) / 2;
    boxCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    boxSizeX = (Math.abs(grid1.colNumber - grid2.colNumber) + 1) * this.cellSize;
    boxSizeZ = (Math.abs(grid1.rowNumber - grid2.rowNumber) + 1) * this.cellSize;
  }

  boxCenterY = this.centerY + (height / 2);
  boxSizeY = Math.abs(height);

  if (this.axis == "XY"){
    var tmp = boxSizeY;
    boxSizeY = boxSizeZ;
    boxSizeZ = tmp;
    boxCenterZ = this.centerZ + (height / 2);
    if (selections.length == 1){
        var grid = selections[0];
        boxCenterY = grid.centerY;
    }else{
      var grid1 = selections[0];
      var grid2 = selections[1];
      boxCenterY = (grid1.centerY + grid2.centerY) / 2;
    }
  }else if (this.axis == "YZ"){
    var oldX = boxSizeX;
    var oldY = boxSizeY;
    var oldZ = boxSizeZ;
    boxSizeZ = oldX;
    boxSizeX = oldY;
    boxSizeY = oldZ;
    if (selections.length == 1){
      var grid = selections[0];
      boxCenterY = grid.centerY;
      boxCenterZ = grid.centerZ;
      boxCenterX = grid.centerX + (height / 2);
    }else{
      var grid1 = selections[0];
      var grid2 = selections[1];
      boxCenterY = (grid1.centerY + grid2.centerY) / 2;
      boxCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
      boxCenterX = grid1.centerX + (height / 2);
    }
  }

  if (this.isSuperposed){
    boxCenterY = boxCenterY - superposeYOffset;
  }

  var geomKey = (
    "BoxBufferGeometry" + PIPE +
    boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
    "1" + PIPE + "1" + PIPE + "1"
  );
  var boxGeometry = geometryCache[geomKey];
  if (!boxGeometry){
    boxGeometry = new THREE.BoxBufferGeometry(boxSizeX, boxSizeY, boxSizeZ);
    geometryCache[geomKey] = boxGeometry;
  }
  var boxMesh = new MeshGenerator(boxGeometry, material).generateMesh();

  boxMesh.position.x = boxCenterX;
  boxMesh.position.y = boxCenterY;
  boxMesh.position.z = boxCenterZ;

  scene.add(boxMesh);

  var boxPhysicsShape;
  var physicsShapeKey = "BOX" + PIPE + (boxSizeX / 2) + PIPE +
                                       (boxSizeY / 2) + PIPE +
                                       (boxSizeZ / 2);
  boxPhysicsShape = physicsShapeCache[physicsShapeKey];
  if (!boxPhysicsShape){
    boxPhysicsShape = new CANNON.Box(new CANNON.Vec3(
      boxSizeX / 2,
      boxSizeY / 2,
      boxSizeZ / 2
    ));
    physicsShapeCache[physicsShapeKey] = boxPhysicsShape;
  }

  var physicsMaterial = new CANNON.Material();

  var boxPhysicsBody = new CANNON.Body({
    mass: 0,
    shape: boxPhysicsShape,
    material: physicsMaterial
  });
  boxPhysicsBody.position.set(
    boxMesh.position.x,
    boxMesh.position.y,
    boxMesh.position.z
  );

  physicsWorld.add(boxPhysicsBody);

  for (var i = 0; i<selections.length; i++){
    selections[i].toggleSelect(false, false, false, true);
    delete gridSelections[selections[i].name];
  }

  var destroyedGrids = new Object();

  if(selections.length == 1){
    destroyedGrids[selections[0].name] = selections[0];
  }else{
    var grid1 = selections[0];
    var grid2 = selections[1];
    startRow = grid1.rowNumber;
    if (grid2.rowNumber < grid1.rowNumber){
      startRow = grid2.rowNumber;
    }
    startCol = grid1.colNumber;
    if (grid2.colNumber < grid1.colNumber){
      startCol = grid2.colNumber;
    }
    finalRow = grid1.rowNumber;
    if (grid2.rowNumber > grid1.rowNumber){
      finalRow = grid2.rowNumber;
    }
    finalCol = grid1.colNumber;
    if (grid2.colNumber > grid1.colNumber){
      finalCol = grid2.colNumber;
    }
    for (var row = startRow; row <= finalRow; row++){
      for (var col = startCol; col <= finalCol; col++ ){
        var grid = this.getGridByColRow(col, row);
        if (grid){
          destroyedGrids[grid.name] = grid;
        }
      }
    }
  }

  var metaData = new Object();
  metaData["height"] = height;
  metaData["gridCount"] = selections.length;
  metaData["grid1Name"] = selections[0].name;
  if (selections.length == 2){
    metaData["grid2Name"] = selections[1].name;
  }
  metaData["gridSystemName"] = this.name;
  metaData["boxSizeX"] = boxSizeX;
  metaData["boxSizeY"] = boxSizeY;
  metaData["boxSizeZ"] = boxSizeZ;
  metaData["centerX"] = boxCenterX;
  metaData["centerY"] = boxCenterY;
  metaData["centerZ"] = boxCenterZ;
  metaData["gridSystemAxis"] = this.axis;

  var addedObjectInstance = new AddedObject(name, "box", metaData, material,
                                    boxMesh, boxPhysicsBody, destroyedGrids);
  addedObjects[name] = addedObjectInstance;

  boxMesh.addedObject = addedObjectInstance;
  addedObjectInstance.updateMVMatrix();
}

GridSystem.prototype.newSphere = function(sphereName, material, radius, selections){

  var sphereCenterX, sphereCenterY, sphereCenterZ;

  if (this.axis == "XZ"){
    if (selections.length == 1){
      var grid = selections[0];
      sphereCenterX = grid.centerX;
      sphereCenterY = grid.centerY + radius;
      sphereCenterZ = grid.centerZ;
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      sphereCenterX = (grid1.centerX + grid2.centerX) / 2;
      sphereCenterY = ((grid1.centerY + grid2.centerY) / 2) + radius;
      sphereCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    }
  }else if (this.axis == "XY"){
    if (selections.length == 1){
      var grid = selections[0];
      sphereCenterX = grid.centerX;
      sphereCenterY = grid.centerY;
      sphereCenterZ = grid.centerZ + radius;
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      sphereCenterX = (grid1.centerX + grid2.centerX) / 2;
      sphereCenterY = (grid1.centerY + grid2.centerY) / 2;
      sphereCenterZ = ((grid1.centerZ + grid2.centerZ) / 2) + radius;
    }
  }else if (this.axis == "YZ"){
    if (selections.length == 1){
      var grid = selections[0];
      sphereCenterX = grid.centerX + radius;
      sphereCenterY = grid.centerY;
      sphereCenterZ = grid.centerZ;
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      sphereCenterX = ((grid1.centerX + grid2.centerX) / 2) + radius;
      sphereCenterY = (grid1.centerY + grid2.centerY) / 2;
      sphereCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    }
  }

  if (this.isSuperposed){
    sphereCenterY = sphereCenterY - superposeYOffset;
  }
  var geomKey = (
    "SphereBufferGeometry" + PIPE +
    Math.abs(radius)+ PIPE +
    "8" + PIPE + "6"
  );
  var sphereGeometry = geometryCache[geomKey];
  if (!sphereGeometry){
    sphereGeometry = new THREE.SphereBufferGeometry(Math.abs(radius));
    geometryCache[geomKey] = sphereGeometry;
  }
  var sphereMesh = new MeshGenerator(sphereGeometry, material).generateMesh();
  sphereMesh.position.set(sphereCenterX, sphereCenterY, sphereCenterZ);
  scene.add(sphereMesh);

  var spherePhysicsShape;
  var physicsShapeKey = "SPHERE" + PIPE + radius;
  spherePhysicsShape = physicsShapeCache[physicsShapeKey];
  if (!spherePhysicsShape){
    spherePhysicsShape = new CANNON.Sphere(Math.abs(radius));
    physicsShapeCache[physicsShapeKey] = spherePhysicsShape;
  }
  var physicsMaterial = new CANNON.Material();

  var spherePhysicsBody = new CANNON.Body({
    mass: 0,
    shape: spherePhysicsShape,
    material: physicsMaterial
  });
  spherePhysicsBody.position.set(
    sphereMesh.position.x,
    sphereMesh.position.y,
    sphereMesh.position.z
  );

  physicsWorld.add(spherePhysicsBody);

  for (var i = 0; i<selections.length; i++){
    selections[i].toggleSelect(false, false, false, true);
    delete gridSelections[selections[i].name];
  }

  var destroyedGrids = new Object();

  if(selections.length == 1){
    destroyedGrids[selections[0].name] = selections[0];
  }else{
    var grid1 = selections[0];
    var grid2 = selections[1];
    startRow = grid1.rowNumber;
    if (grid2.rowNumber < grid1.rowNumber){
      startRow = grid2.rowNumber;
    }
    startCol = grid1.colNumber;
    if (grid2.colNumber < grid1.colNumber){
      startCol = grid2.colNumber;
    }
    finalRow = grid1.rowNumber;
    if (grid2.rowNumber > grid1.rowNumber){
      finalRow = grid2.rowNumber;
    }
    finalCol = grid1.colNumber;
    if (grid2.colNumber > grid1.colNumber){
      finalCol = grid2.colNumber;
    }
    for (var row = startRow; row <= finalRow; row++){
      for (var col = startCol; col <= finalCol; col++ ){
        var grid = this.getGridByColRow(col, row);
        if (grid){
          destroyedGrids[grid.name] = grid;
        }
      }
    }
  }

  var metaData = new Object();
  metaData["radius"] = radius;
  metaData["gridCount"] = selections.length;
  metaData["grid1Name"] = selections[0].name;
  if (selections.length == 2){
    metaData["grid2Name"] = selections[1].name;
  }
  metaData["gridSystemName"] = this.name;
  metaData["centerX"] = sphereMesh.position.x;
  metaData["centerY"] = sphereMesh.position.y;
  metaData["centerZ"] = sphereMesh.position.z;
  metaData["gridSystemAxis"] = this.axis;

  var addedObjectInstance = new AddedObject(sphereName, "sphere", metaData, material,
                                    sphereMesh, spherePhysicsBody, destroyedGrids);
  addedObjects[sphereName] = addedObjectInstance;

  sphereMesh.addedObject = addedObjectInstance;
  addedObjectInstance.updateMVMatrix();
}

GridSystem.prototype.newCylinder = function(cylinderName, material, topRadius, bottomRadius, height, isOpenEnded, selections){
  var cylinderCenterX, cylinderCenterY, cylinderCenterZ;
  if (this.axis == "XZ"){
    if (selections.length == 1){
      var grid = selections[0];
      cylinderCenterX = grid.centerX;
      cylinderCenterY = grid.centerY + (height/2);
      cylinderCenterZ = grid.centerZ;
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      cylinderCenterX = (grid1.centerX + grid2.centerX) / 2;
      cylinderCenterY = ((grid1.centerY + grid2.centerY) / 2) + (height/2);
      cylinderCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    }
  }else if (this.axis == "XY"){
    if (selections.length == 1){
      var grid = selections[0];
      cylinderCenterX = grid.centerX;
      cylinderCenterY = grid.centerY;
      cylinderCenterZ = grid.centerZ + (height/2);
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      cylinderCenterX = (grid1.centerX + grid2.centerX) / 2;
      cylinderCenterY = (grid1.centerY + grid2.centerY) / 2;
      cylinderCenterZ = ((grid1.centerZ + grid2.centerZ) / 2) + (height/2);
    }
  }else if (this.axis == "YZ"){
    if (selections.length == 1){
      var grid = selections[0];
      cylinderCenterX = grid.centerX + (height/2);
      cylinderCenterY = grid.centerY;
      cylinderCenterZ = grid.centerZ;
    }else if (selections.length == 2){
      var grid1 = selections[0];
      var grid2 = selections[1];
      cylinderCenterX = ((grid1.centerX + grid2.centerX) / 2) + (height/2);
      cylinderCenterY = (grid1.centerY + grid2.centerY) / 2;
      cylinderCenterZ = (grid1.centerZ + grid2.centerZ) / 2;
    }
  }
  if (this.isSuperposed){
    cylinderCenterY = cylinderCenterY - superposeYOffset;
  }
  var geomKey = "CylinderBufferGeometry" + PIPE + height + PIPE + topRadius + PIPE +
                                         bottomRadius + PIPE + 8 + PIPE + 1 + PIPE + isOpenEnded;
  var cylinderGeometry = geometryCache[geomKey];
  if (!cylinderGeometry){
    cylinderGeometry = new THREE.CylinderBufferGeometry(topRadius, bottomRadius, height, 8, 1, isOpenEnded);
    geometryCache[geomKey] = cylinderGeometry;
  }
  var cylinderMesh = new MeshGenerator(cylinderGeometry, material).generateMesh();
  cylinderMesh.position.set(cylinderCenterX, cylinderCenterY, cylinderCenterZ);
  scene.add(cylinderMesh);
  var cylinderPhysicsShape;
  var physicsShapeKey = "CYLINDER" + PIPE + topRadius + PIPE + bottomRadius + PIPE +
                                            Math.abs(height) + PIPE + 8 + PIPE +
                                            this.axis;
  cylinderPhysicsShape = physicsShapeCache[physicsShapeKey];
  var cached = false;
  if (!cylinderPhysicsShape){
      cylinderPhysicsShape = new CANNON.Cylinder(topRadius, bottomRadius, Math.abs(height), 8);
      physicsShapeCache[physicsShapeKey] = cylinderPhysicsShape;
  }else{
    cached = true;
  }
  cylinderPhysicsShape.topRadius = topRadius;
  cylinderPhysicsShape.bottomRadius = bottomRadius;
  cylinderPhysicsShape.height = Math.abs(height);
  if (this.axis == "XZ"){
    if (!cached){
      var quat = new CANNON.Quaternion();
      var coef = 1;
      if (height < 0){
        coef = -1;
      }
      quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2 * coef);
      var translation = new CANNON.Vec3(0, 0, 0);
      cylinderPhysicsShape.transformAllPoints(translation,quat);
    }
  }else if (this.axis == "XY"){
    cylinderMesh.rotateX(Math.PI/2);
    if (!cached){
      if (height < 0){
        var quat = new CANNON.Quaternion();
        quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI);
        var translation = new CANNON.Vec3(0, 0, 0);
        cylinderPhysicsShape.transformAllPoints(translation,quat);
      }
    }
  }else if (this.axis == "YZ"){
    cylinderMesh.rotateZ(-Math.PI/2);
    if (!cached){
      var quat = new CANNON.Quaternion();
      var coef = 1;
      if (height < 0){
        coef = -1;
      }
      quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), coef * Math.PI/2);
      var translation = new CANNON.Vec3(0, 0, 0);
      cylinderPhysicsShape.transformAllPoints(translation,quat);
    }
  }
  var physicsMaterial = new CANNON.Material();
  var cylinderPhysicsBody = new CANNON.Body({
    mass: 0,
    shape: cylinderPhysicsShape,
    material: physicsMaterial
  });
  cylinderPhysicsBody.position.set(
    cylinderMesh.position.x,
    cylinderMesh.position.y,
    cylinderMesh.position.z
  );
  physicsWorld.add(cylinderPhysicsBody);
  for (var i = 0; i<selections.length; i++){
    selections[i].toggleSelect(false, false, false, true);
    delete gridSelections[selections[i].name];
  }
  var destroyedGrids = new Object();
  if(selections.length == 1){
    destroyedGrids[selections[0].name] = selections[0];
  }else{
    var grid1 = selections[0];
    var grid2 = selections[1];
    startRow = grid1.rowNumber;
    if (grid2.rowNumber < grid1.rowNumber){
      startRow = grid2.rowNumber;
    }
    startCol = grid1.colNumber;
    if (grid2.colNumber < grid1.colNumber){
      startCol = grid2.colNumber;
    }
    finalRow = grid1.rowNumber;
    if (grid2.rowNumber > grid1.rowNumber){
      finalRow = grid2.rowNumber;
    }
    finalCol = grid1.colNumber;
    if (grid2.colNumber > grid1.colNumber){
      finalCol = grid2.colNumber;
    }
    for (var row = startRow; row <= finalRow; row++){
      for (var col = startCol; col <= finalCol; col++ ){
        var grid = this.getGridByColRow(col, row);
        if (grid){
          destroyedGrids[grid.name] = grid;
        }
      }
    }
  }
  var metaData = new Object();
  metaData["height"] = height;
  metaData["topRadius"] = topRadius;
  metaData["bottomRadius"] = bottomRadius;
  metaData["isOpenEnded"] = isOpenEnded;
  metaData["gridCount"] = selections.length;
  metaData["grid1Name"] = selections[0].name;
  if (selections.length == 2){
    metaData["grid2Name"] = selections[1].name;
  }
  metaData["gridSystemName"] = this.name;
  metaData["centerX"] = cylinderMesh.position.x;
  metaData["centerY"] = cylinderMesh.position.y;
  metaData["centerZ"] = cylinderMesh.position.z;
  metaData["gridSystemAxis"] = this.axis;

  var addedObjectInstance = new AddedObject(cylinderName, "cylinder", metaData, material,
                                    cylinderMesh, cylinderPhysicsBody, destroyedGrids);
  addedObjects[cylinderName] = addedObjectInstance;

  cylinderMesh.addedObject = addedObjectInstance;
  addedObjectInstance.updateMVMatrix();
}
var AddedObject = function(name, type, metaData, material, mesh, physicsBody, destroyedGrids){
  this.isAddedObject = true;
  if (IS_WORKER_CONTEXT){
    return this;
  }
  this.name = name;
  this.type = type;
  this.metaData = metaData;
  this.material = material;
  this.mesh = mesh;
  this.physicsBody = physicsBody;
  this.destroyedGrids = destroyedGrids;

  this.physicsBody.addedObject = this;

  if (mesh.material instanceof BasicMaterial){
    this.hasBasicMaterial = true;
  }

  if (this.destroyedGrids){
    for (var gridName in this.destroyedGrids){
      this.destroyedGrids[gridName].destroyedAddedObject = this.name;
    }
  }

  var baseGridSystemName = this.metaData["gridSystemName"];
  var baseGridSystem = gridSystems[baseGridSystemName];
  if (baseGridSystem && !(this.metaData["baseGridSystemAxis"])){
    this.metaData["baseGridSystemAxis"] = baseGridSystem.axis.toUpperCase();
  }

  this.metaData["widthSegments"] = 1;
  this.metaData["heightSegments"] = 1;
  if (type == "box"){
    this.metaData["depthSegments"] = 1;
  }else if (type == "sphere"){
    this.metaData["widthSegments"] = 8;
    this.metaData["heightSegments"] = 6;
  }else if (type == "cylinder"){
    this.metaData["widthSegments"] = 8;
  }

  this.metaData["textureRepeatU"] = 1;
  this.metaData["textureRepeatV"] = 1;

  this.associatedTexturePack = 0;

  this.rotationX = 0;
  this.rotationY = 0;
  this.rotationZ = 0;

  this.initQuaternion = this.mesh.quaternion.clone();

  this.collisionCallbackFunction = function(collisionEvent){
    if (!collisionEvent.body.addedObject || (!this.isVisibleOnThePreviewScene() && !this.physicsKeptWhenHidden)){
      return;
    }
    var targetObjectName = collisionEvent.body.addedObject.name;
    var contact = collisionEvent.contact;
    var collisionPosition = new Object();
    var collisionImpact = contact.getImpactVelocityAlongNormal();
    collisionPosition.x = contact.bi.position.x + contact.ri.x;
    collisionPosition.y = contact.bi.position.y + contact.ri.y;
    collisionPosition.z = contact.bi.position.z + contact.ri.z;
    var quatX = this.mesh.quaternion.x;
    var quatY = this.mesh.quaternion.y;
    var quatZ = this.mesh.quaternion.z;
    var quatW = this.mesh.quaternion.w;
    var collisionInfo = reusableCollisionInfo.set(
      targetObjectName,
      collisionPosition.x,
      collisionPosition.y,
      collisionPosition.z,
      collisionImpact,
      quatX,
      quatY,
      quatZ,
      quatW
    );
    var curCollisionCallbackRequest = collisionCallbackRequests[this.name];
    if (curCollisionCallbackRequest){
      curCollisionCallbackRequest(collisionInfo);
    }
  };

  this.physicsBody.addEventListener(
    "collide",
    this.collisionCallbackFunction.bind(this)
  );

  this.reusableVec3 = new THREE.Vector3();
  this.reusableVec3_2 = new THREE.Vector3();
  this.reusableVec3_3 = new THREE.Vector3();

  this.isIntersectable = true;

  this.lastUpdatePosition = new THREE.Vector3();
  this.lastUpdateQuaternion = new THREE.Quaternion();

  webglCallbackHandler.registerEngineObject(this);

}

AddedObject.prototype.exportLightweight = function(){
  if (!this.boundingBoxes){
    this.generateBoundingBoxes();
  }
  this.mesh.updateMatrixWorld();
  var exportObject = new Object();
  exportObject.isChangeable = this.isChangeable;
  exportObject.isIntersectable = this.isIntersectable;
  if (!this.parentObjectName){
    exportObject.position = this.mesh.position.clone();
    exportObject.quaternion = this.mesh.quaternion.clone();
  }else{
    exportObject.position = new THREE.Vector3(this.positionXWhenAttached, this.positionYWhenAttached, this.positionZWhenAttached);
    exportObject.quaternion = new THREE.Quaternion(this.qxWhenAttached, this.qyWhenAttached, this.qzWhenAttached, this.qwWhenAttached);
  }
  exportObject.vertices = [];
  exportObject.triangles = [];
  exportObject.pseudoFaces = [];
  exportObject.parentBoundingBoxIndex = this.parentBoundingBoxIndex;
  exportObject.matrixWorld = this.mesh.matrixWorld.elements;
  for (var i = 0; i<this.vertices.length; i++){
    exportObject.vertices.push({x: this.vertices[i].x, y: this.vertices[i].y, z: this.vertices[i].z})
  }
  for (var i = 0; i<this.triangles.length; i++){
    exportObject.triangles.push({a: this.triangles[i].a, b: this.triangles[i].b, c: this.triangles[i].c})
  }
  for (var i = 0; i<this.pseudoFaces.length; i++){
    exportObject.pseudoFaces.push(this.pseudoFaces[i]);
  }
  return exportObject;
}

AddedObject.prototype.export = function(){
  var exportObject = new Object();
  exportObject["type"] = this.type;
  exportObject["roygbivMaterialName"] = this.material.roygbivMaterialName;
  var exportDestroyedGrids = new Object();
  for (var gridName in this.destroyedGrids){
    exportDestroyedGrids[gridName] = this.destroyedGrids[gridName].export();
  }
  exportObject["destroyedGrids"] = exportDestroyedGrids;
  exportObject["metaData"] = Object.assign({}, this.metaData);
  exportObject["associatedTexturePack"] = this.associatedTexturePack;

  if (this.mass){
    exportObject["mass"] = this.mass;
  }
  if (this.isDynamicObject){
    exportObject["isDynamicObject"] = this.isDynamicObject;
  }

  exportObject["isIntersectable"] = this.isIntersectable;

  exportObject["opacity"] = this.mesh.material.uniforms.alpha.value;
  if (this.hasAOMap()){
    exportObject["aoMapIntensity"] = this.mesh.material.uniforms.aoIntensity.value;
  }else{
    exportObject["aoMapIntensity"] = this.material.aoMapIntensity;
  }
  if (this.hasEmissiveMap()){
    exportObject["emissiveIntensity"] = this.mesh.material.uniforms.emissiveIntensity.value;
    exportObject["emissiveColor"] = "#"+this.mesh.material.uniforms.emissiveColor.value.getHexString();
  }else{
    exportObject["emissiveIntensity"] = this.material.emissiveIntensity;
    exportObject["emissiveColor"] = this.material.emissiveColor;
  }

  exportObject["textureOffsetX"] = this.getTextureOffsetX();
  exportObject["textureOffsetY"] = this.getTextureOffsetY();
  exportObject["textureRepeatU"] = this.getTextureRepeatX();
  exportObject["textureRepeatV"] = this.getTextureRepeatY();

  if (this.hasDiffuseMap()){
    var diffuseMap = this.mesh.material.uniforms.diffuseMap.value;
    exportObject["diffuseRoygbivTexturePackName"] = diffuseMap.roygbivTexturePackName;
    exportObject["diffuseRoygbivTextureName"] =  diffuseMap.roygbivTextureName;
  }
  if (this.hasAlphaMap()){
    var alphaMap = this.mesh.material.uniforms.alphaMap.value;
    exportObject["alphaRoygbivTexturePackName"] = alphaMap.roygbivTexturePackName;
    exportObject["alphaRoygbivTextureName"] = alphaMap.roygbivTextureName;
  }
  if (this.hasAOMap()){
    var aoMap = this.mesh.material.uniforms.aoMap.value;
    exportObject["aoRoygbivTexturePackName"] = aoMap.roygbivTexturePackName;
    exportObject["aoRoygbivTextureName"] = aoMap.roygbivTextureName;
  }
  if (this.hasEmissiveMap()){
    var emissiveMap = this.mesh.material.uniforms.emissiveMap.value;
    exportObject["emissiveRoygbivTexturePackName"] = emissiveMap.roygbivTexturePackName;
    exportObject["emissiveRoygbivTextureName"] = emissiveMap.roygbivTextureName;
  }
  if (this.hasDisplacementMap()){
    var displacementMap = this.mesh.material.uniforms.displacementMap.value;
    exportObject["displacementRoygbivTexturePackName"] = displacementMap.roygbivTexturePackName;
    exportObject["displacementRoygbivTextureName"] = displacementMap.roygbivTextureName;
    exportObject["displacementScale"] = this.mesh.material.uniforms.displacementInfo.value.x;
    exportObject["displacementBias"] = this.mesh.material.uniforms.displacementInfo.value.y;
  }

  exportObject.rotationX = this.rotationX;
  exportObject.rotationY = this.rotationY;
  exportObject.rotationZ = this.rotationZ;

  if (!this.parentObjectName){
    exportObject.quaternionX = this.mesh.quaternion.x;
    exportObject.quaternionY = this.mesh.quaternion.y;
    exportObject.quaternionZ = this.mesh.quaternion.z;
    exportObject.quaternionW = this.mesh.quaternion.w;
    exportObject.pQuaternionX = this.physicsBody.quaternion.x;
    exportObject.pQuaternionY = this.physicsBody.quaternion.y;
    exportObject.pQuaternionZ = this.physicsBody.quaternion.z;
    exportObject.pQuaternionW = this.physicsBody.quaternion.w;
  }else{
    exportObject.quaternionX = this.qxWhenAttached;
    exportObject.quaternionY = this.qyWhenAttached;
    exportObject.quaternionZ = this.qzWhenAttached;
    exportObject.quaternionW = this.qwWhenAttached;
    exportObject.pQuaternionX = this.pqxWhenAttached;
    exportObject.pQuaternionY = this.pqyWhenAttached;
    exportObject.pQuaternionZ = this.pqzWhenAttached;
    exportObject.pQuaternionW = this.pqwWhenAttached;
    exportObject.positionXWhenAttached = this.positionXWhenAttached;
    exportObject.positionYWhenAttached = this.positionYWhenAttached;
    exportObject.positionZWhenAttached = this.positionZWhenAttached;
  }

  var blendingModeInt = this.mesh.material.blending;
  if (blendingModeInt == NO_BLENDING){
    exportObject.blendingMode = "NO_BLENDING";
  }else if (blendingModeInt == NORMAL_BLENDING){
    exportObject.blendingMode = "NORMAL_BLENDING";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    exportObject.blendingMode = "ADDITIVE_BLENDING";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    exportObject.blendingMode = "SUBTRACTIVE_BLENDING";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    exportObject.blendingMode = "MULTIPLY_BLENDING";
  }

  if (this.metaData.isSlippery){
    exportObject.isSlippery = true;
  }else{
    exportObject.isSlippery = false;
  }

  if (this.isChangeable){
    exportObject.isChangeable = true;
  }else{
    exportObject.isChangeable = false;
  }
  if (this.isColorizable){
    exportObject.isColorizable = true;
  }else{
    exportObject.isColorizable = false;
  }

  if (this.noMass){
    exportObject.noMass = true;
  }else{
    exportObject.noMass = false;
  }

  if (this.areaVisibilityConfigurations){
    exportObject.areaVisibilityConfigurations = this.areaVisibilityConfigurations;
  }
  if (this.areaSideConfigurations){
    exportObject.areaSideConfigurations = this.areaSideConfigurations;
  }

  if (this.pivotObject){
    exportObject.hasPivot = true;
    exportObject.pivotOffsetX = this.pivotOffsetX;
    exportObject.pivotOffsetY = this.pivotOffsetY;
    exportObject.pivotOffsetZ = this.pivotOffsetZ;
    exportObject.positionX = this.mesh.position.x;
    exportObject.positionY = this.mesh.position.y;
    exportObject.positionZ = this.mesh.position.z;
    exportObject.pivotQX = this.pivotObject.quaternion.x;
    exportObject.pivotQY = this.pivotObject.quaternion.y;
    exportObject.pivotQZ = this.pivotObject.quaternion.z;
    exportObject.pivotQW = this.pivotObject.quaternion.w;
    exportObject.insidePivotQX = this.pivotObject.children[0].quaternion.x;
    exportObject.insidePivotQY = this.pivotObject.children[0].quaternion.y;
    exportObject.insidePivotQZ = this.pivotObject.children[0].quaternion.z;
    exportObject.insidePivotQW = this.pivotObject.children[0].quaternion.w;
    if (this.parentObjectName){
      var objGroup = objectGroups[this.parentObjectName];
      if (objGroup){
        exportObject.positionX = this.physicsBody.position.x;
        exportObject.positionY = this.physicsBody.position.y;
        exportObject.positionZ = this.physicsBody.position.z;
      }
    }
  }else if (this.pivotRemoved){
    exportObject.pivotRemoved = true;
    exportObject.positionX = this.mesh.position.x;
    exportObject.positionY = this.mesh.position.y;
    exportObject.positionZ = this.mesh.position.z;
    if (this.parentObjectName){
      var objGroup = objectGroups[this.parentObjectName];
      if (objGroup){
        exportObject.positionX = this.physicsBody.position.x;
        exportObject.positionY = this.physicsBody.position.y;
        exportObject.positionZ = this.physicsBody.position.z;
      }
    }
  }

  if (this.softCopyParentName){
    exportObject.softCopyParentName = this.softCopyParentName;
  }

  if (this.hasTexture()){
    exportObject.txtMatrix = this.mesh.material.uniforms.textureMatrix.value.elements;
  }

  return exportObject;
}

AddedObject.prototype.forceColor = function(r, g, b, a){
  if (!this.isColorizable){
    return;
  }
  if (a < 0){
    a = 0;
  }
  if (a > 1){
    a = 1;
  }
  this.mesh.material.uniforms.forcedColor.value.set(a, r, g, b);
  this.mesh.material.needsUpdate = true;
}

AddedObject.prototype.resetColor = function(){
  if (!this.isColorizable){
    return;
  }
  this.mesh.material.uniforms.forcedColor.value.set(-50, 0, 0, 0);
}

AddedObject.prototype.applyAreaConfiguration = function(areaName){
  if (this.areaVisibilityConfigurations){
    var configurations = this.areaVisibilityConfigurations[areaName];
    if (!(typeof configurations == UNDEFINED)){
      this.mesh.visible = configurations;
    }else{
      this.mesh.visible = true;
    }
  }
  if (this.areaSideConfigurations){
    var configurations = this.areaSideConfigurations[areaName];
    if (!(typeof configurations == UNDEFINED)){
      if (configurations == SIDE_BOTH){
        this.mesh.material.side = THREE.DoubleSide;
      }else if (configurations == SIDE_FRONT){
        this.mesh.material.side = THREE.FrontSide;
      }else if (configurations == SIDE_BACK){
        this.mesh.material.side = THREE.BackSide;
      }
    }else{
      if (this.defaultSide){
        if (this.defaultSide == SIDE_BOTH){
          this.mesh.material.side = THREE.DoubleSide;
        }else if (this.defaultSide == SIDE_FRONT){
          this.mesh.material.side = THREE.FrontSide;
        }else if (this.defaultSide == SIDE_BACK){
          this.mesh.material.side = THREE.BackSide;
        }
      }else{
        this.mesh.material.side = THREE.DoubleSide;
      }
    }
  }
}

AddedObject.prototype.getSideInArea = function(areaName){
  if (this.areaSideConfigurations){
    if (!(typeof this.areaSideConfigurations[areaName] == UNDEFINED)){
      return this.areaSideConfigurations[areaName];
    }
  }
  if (this.defaultSide){
    return this.defaultSide;
  }
  return SIDE_BOTH;
}

AddedObject.prototype.setSideInArea = function(areaName, side){
  if (!this.areaSideConfigurations){
    this.areaSideConfigurations = new Object();
  }
  this.areaSideConfigurations[areaName] = side;
}

AddedObject.prototype.getVisibilityInArea = function(areaName){
  if (this.areaVisibilityConfigurations){
    if (!(typeof this.areaVisibilityConfigurations[areaName] == UNDEFINED)){
      return this.areaVisibilityConfigurations[areaName];
    }
  }
  return true;
}

AddedObject.prototype.setVisibilityInArea = function(areaName, isVisible){
  if (!this.areaVisibilityConfigurations){
    this.areaVisibilityConfigurations = new Object();
  }
  this.areaVisibilityConfigurations[areaName] = isVisible;
}

AddedObject.prototype.loadState = function(){
  this.physicsBody.position.set(
    this.state.physicsPX, this.state.physicsPY, this.state.physicsPZ
  );
  this.physicsBody.quaternion.set(
    this.state.physicsQX, this.state.physicsQY, this.state.physicsQZ, this.state.physicsQW
  );
  this.physicsBody.angularVelocity.set(
    this.state.physicsAVX, this.state.physicsAVY, this.state.physicsAVZ
  );
  this.physicsBody.velocity.set(
    this.state.physicsVX, this.state.physicsVY, this.state.physicsVZ
  );
  this.mesh.position.set(
    this.state.positionX, this.state.positionY, this.state.positionZ
  );
  this.mesh.quaternion.set(
    this.state.quaternionX, this.state.quaternionY, this.state.quaternionZ, this.state.quaternionW
  );
  if (this.pivotObject){
    delete this.pivotObject;
    delete this.pivotOffsetX;
    delete this.pivotOffsetY;
    delete this.pivotOffsetZ;
  }
  if (this.originalPivotObject){
    this.pivotObject = this.originalPivotObject;
    this.pivotOffsetX = this.originalPivotOffsetX;
    this.pivotOffsetY = this.originalPivotOffsetY;
    this.pivotOffsetZ = this.originalPivotOffsetZ;
  }
}

AddedObject.prototype.saveState = function(){
  this.state = new Object();
  this.state.physicsPX = this.physicsBody.position.x;
  this.state.physicsPY = this.physicsBody.position.y;
  this.state.physicsPZ = this.physicsBody.position.z;
  this.state.physicsQX = this.physicsBody.quaternion.x;
  this.state.physicsQY = this.physicsBody.quaternion.y;
  this.state.physicsQZ = this.physicsBody.quaternion.z;
  this.state.physicsQW = this.physicsBody.quaternion.w;
  this.state.physicsAVX = this.physicsBody.angularVelocity.x;
  this.state.physicsAVY = this.physicsBody.angularVelocity.y;
  this.state.physicsAVZ = this.physicsBody.angularVelocity.z;
  this.state.physicsVX = this.physicsBody.velocity.x;
  this.state.physicsVY = this.physicsBody.velocity.y;
  this.state.physicsVZ = this.physicsBody.velocity.z;
  this.state.positionX = this.mesh.position.x;
  this.state.positionY = this.mesh.position.y;
  this.state.positionZ = this.mesh.position.z;
  this.state.quaternionX = this.mesh.quaternion.x;
  this.state.quaternionY = this.mesh.quaternion.y;
  this.state.quaternionZ = this.mesh.quaternion.z;
  this.state.quaternionW = this.mesh.quaternion.w;
  if (this.pivotObject){
    this.originalPivotObject = this.pivotObject;
    this.originalPivotOffsetX = this.pivotOffsetX;
    this.originalPivotOffsetY = this.pivotOffsetY;
    this.originalPivotOffsetZ = this.pivotOffsetZ;
  }
}

AddedObject.prototype.handleRenderSide = function(val){
  this.metaData["renderSide"] = val;
  if (val == 0){
    this.mesh.material.side = THREE.DoubleSide;
    this.defaultSide = SIDE_BOTH;
  }else if (val == 1){
    this.mesh.material.side = THREE.FrontSide;
    this.defaultSide = SIDE_FRONT;
  }else if (val == 2){
    this.mesh.material.side = THREE.BackSide;
    this.defaultSide = SIDE_BACK;
  }
}

AddedObject.prototype.isSlicable = function(){
  if (this.type == "sphere"){
    return true;
  }
  if (this.type != "surface"){
    return false;
  }
  if (this.metaData.widthSegments == 1 && this.metaData.heightSegments == 1){
    return true;
  }
  return false;
}

AddedObject.prototype.sliceInHalf = function(type){
  if (!this.isSlicable()){
    return;
  }
  var newGeometry;
  if (this.type == "sphere"){
    if (type == 0 || type == 1 || type == 2 || type == 3){
      var geomKey = (
        "SphereBufferGeometry" + PIPE +
        Math.abs(this.metaData.radius) + PIPE +
        this.metaData.widthSegments + PIPE + this.metaData.heightSegments + PIPE +
        "SLICED" + PIPE + type
      );
      var cachedGeom = geometryCache[geomKey];
      this.metaData.slicedType = type;
      if (!cachedGeom){
        if (type == 0){
          newGeometry = new THREE.SphereBufferGeometry(
            this.metaData.radius, this.metaData.widthSegments,
            this.metaData.heightSegments, 0, 2 * Math.PI, 0, 0.5 * Math.PI);
        }else if (type == 1){
          newGeometry = new THREE.SphereBufferGeometry(
            this.metaData.radius, this.metaData.widthSegments,
            this.metaData.heightSegments, 0, Math.PI, 0, Math.PI);
        }else if (type == 2){
          newGeometry = new THREE.SphereBufferGeometry(
            this.metaData.radius, this.metaData.widthSegments,
            this.metaData.heightSegments, 0, 2 * Math.PI, Math.PI / 2, 0.5 * Math.PI);
        }else if (type == 3){
          newGeometry = new THREE.SphereBufferGeometry(
            this.metaData.radius, this.metaData.widthSegments,
            this.metaData.heightSegments, Math.PI, Math.PI, 0, Math.PI);
        }
        geometryCache[geomKey] = newGeometry;
      }else{
        newGeometry = cachedGeom;
      }
    }else{
      var originalGeomKey = (
        "SphereBufferGeometry" + PIPE +
        Math.abs(this.metaData.radius) + PIPE +
        this.metaData.widthSegments + PIPE + this.metaData.heightSegments
      );
      newGeometry = geometryCache[originalGeomKey];
      delete this.metaData.slicedType;
    }
  }else if (this.type == "surface"){
    var geomKey = (
      "PlaneBufferGeometry" + PIPE +
      this.metaData.width + PIPE + this.metaData.height + PIPE +
      this.metaData.widthSegments + PIPE + this.metaData.heightSegments
    );
    var originalGeometry = geometryCache[geomKey];
    var normals = [], positions = [], uvs = [0, 0, 1, 1, 0, 1];
    var subIndices;
    var indices = originalGeometry.index.array;
    if (type == 0){
      subIndices = [indices[0], indices[1], indices[2]];
    }else if (type == 1){
      subIndices = [indices[3], indices[4], indices[5]];
    }else if (type == 2){
      subIndices = [indices[1], indices[4], indices[0]];
    }else if (type == 3){
      subIndices = [indices[2], indices[4], indices[0]]
    }

    if (type == 0 || type == 1 || type == 2 || type == 3){
      this.metaData.slicedType = type;
      for (var i = 0; i<subIndices.length; i++){
        for (var i2 = 0; i2<3; i2++){
          positions.push(originalGeometry.attributes.position.array[
            (3 * subIndices[i]) + i2
          ]);
          normals.push(originalGeometry.attributes.normal.array[
            (3 * subIndices[i]) + i2
          ]);
        }
      }

      var newGeometryKey = (
        "SlicedPlaneBufferGeometry" + PIPE +
        this.metaData.width + PIPE + this.metaData.height + PIPE + type
      );
      newGeometry = geometryCache[newGeometryKey];
      if (!newGeometry){
        newGeometry = new THREE.BufferGeometry();
        newGeometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        newGeometry.addAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
        newGeometry.addAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
        geometryCache[newGeometryKey] = newGeometry;
      }
    }else{
      delete this.metaData.slicedType;
      newGeometry = originalGeometry;
    }
  }

  scene.remove(this.mesh);
  var newMesh = new THREE.Mesh(newGeometry, this.mesh.material);
  newMesh.position.copy(this.mesh.position);
  newMesh.quaternion.copy(this.mesh.quaternion);
  newMesh.addedObject = this;
  this.mesh = newMesh;
  webglCallbackHandler.registerEngineObject(this);
  scene.add(this.mesh);
  this.generateBoundingBoxes();
}

AddedObject.prototype.syncProperties = function(refObject){
  // TEXTURE OFFSETS
  if (refObject.hasTexture() && this.hasTexture()){
    var m1 = this.mesh.material.uniforms.textureMatrix.value.elements;
    var m2 = refObject.mesh.material.uniforms.textureMatrix.value.elements;
    for (var i = 0; i<m2.length; i++){
      m1[i] = m2[i];
    }
  }
  // OPACITY
  var refOpacity = refObject.mesh.material.uniforms.alpha.value;
  this.updateOpacity(refOpacity);
  this.initOpacitySet = false;
  // AO INTENSITY
  if (refObject.hasAOMap() && this.hasAOMap()){
    var refAOIntensity = refObject.mesh.material.uniforms.aoIntensity.value;
    this.mesh.material.uniforms.aoIntensity.value = refAOIntensity
  }
  // EMISSIVE INTENSITY
  if (refObject.hasEmissiveMap() && this.hasEmissiveMap()){
    var refMaterial = refObject.mesh.material;
    var refEmissiveIntensity = refMaterial.uniforms.emissiveIntensity.value;
    this.mesh.material.uniforms.emissiveIntensity.value = refEmissiveIntensity;
    // EMISSIVE COLOR
    var refEmissiveColor = refMaterial.uniforms.emissiveColor.value;
    this.mesh.material.uniforms.emissiveColor.value.copy(refEmissiveColor);
  }
  // DISPLACEMENT
    if (refObject.hasDisplacementMap() && this.hasDisplacementMap()){
    var refDispX = refObject.mesh.material.uniforms.displacementInfo.value.x;
    var refDispY = refObject.mesh.material.uniforms.displacementInfo.value.y;
    this.mesh.material.uniforms.displacementInfo.value.x = refDispX;
    this.mesh.material.uniforms.displacementInfo.value.y = refDispY;
  }
}

AddedObject.prototype.setAttachedProperties = function(){
  this.qxWhenAttached = this.mesh.quaternion.x;
  this.qyWhenAttached = this.mesh.quaternion.y;
  this.qzWhenAttached = this.mesh.quaternion.z;
  this.qwWhenAttached = this.mesh.quaternion.w;
  this.pqxWhenAttached = this.physicsBody.quaternion.x;
  this.pqyWhenAttached = this.physicsBody.quaternion.y;
  this.pqzWhenAttached = this.physicsBody.quaternion.z;
  this.pqwWhenAttached = this.physicsBody.quaternion.w;
  this.positionXWhenAttached = this.mesh.position.x;
  this.positionYWhenAttached = this.mesh.position.y;
  this.positionZWhenAttached = this.mesh.position.z;
}

AddedObject.prototype.getTextureUniform = function(texture){
  if (textureUniformCache[texture.uuid]){
    return textureUniformCache[texture.uuid];
  }
  var uniform = new THREE.Uniform(texture);
  textureUniformCache[texture.uuid] = uniform;
  return uniform;
}

AddedObject.prototype.hasEmissiveMap = function(){
  return !(typeof this.mesh.material.uniforms.emissiveMap == UNDEFINED);
}

AddedObject.prototype.unMapEmissive = function(){
  if (this.hasEmissiveMap()){
    delete this.mesh.material.uniforms.emissiveMap;
    delete this.mesh.material.uniforms.emissiveIntensity;
    delete this.mesh.material.uniforms.emissiveColor;
    this.removeMacro("HAS_EMISSIVE", false, true);
    if (!this.hasTexture()){
      delete this.mesh.material.uniforms.textureMatrix;
      this.removeMacro("HAS_TEXTURE", true, true);
    }
  }
}

AddedObject.prototype.mapEmissive = function(emissiveMap){
  if (!this.hasTexture()){
    var tMatrix = new THREE.Matrix3();
    tMatrix.setUvTransform(0, 0, 1, 1, 0, 0, 0);
    this.mesh.material.uniforms.textureMatrix = new THREE.Uniform(tMatrix);
    this.injectMacro("HAS_TEXTURE", true, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  if (this.hasEmissiveMap()){
    this.mesh.material.uniforms.emissiveMap.value = emissiveMap;
  }else{
    this.mesh.material.uniforms.emissiveMap = this.getTextureUniform(emissiveMap);
    this.mesh.material.uniforms.emissiveIntensity = new THREE.Uniform(this.material.emissiveIntensity);
    this.mesh.material.uniforms.emissiveColor = new THREE.Uniform(new THREE.Color(this.material.emissiveColor));
    this.injectMacro("HAS_EMISSIVE", false, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  emissiveMap.updateMatrix();
}

AddedObject.prototype.hasDisplacementMap = function(){
  return !(typeof this.mesh.material.uniforms.displacementMap == UNDEFINED);
}

AddedObject.prototype.unMapDisplacement = function(){
  if (!VERTEX_SHADER_TEXTURE_FETCH_SUPPORTED){
    console.error("Displacement mapping is not supported for this device.");
    return;
  }
  if (this.hasDisplacementMap()){
    delete this.mesh.material.uniforms.displacementMap;
    delete this.mesh.material.uniforms.displacementInfo;
    this.removeMacro("HAS_DISPLACEMENT", true, false);
    if (!this.hasTexture()){
      delete this.mesh.material.uniforms.textureMatrix;
      this.removeMacro("HAS_TEXTURE", true, true);
    }
  }
}

AddedObject.prototype.mapDisplacement = function(displacementTexture){
  if (!VERTEX_SHADER_TEXTURE_FETCH_SUPPORTED){
    console.error("Displacement mapping is not supported for this device.");
    return;
  }
  if (!this.hasTexture()){
    var tMatrix = new THREE.Matrix3();
    tMatrix.setUvTransform(0, 0, 1, 1, 0, 0, 0);
    this.mesh.material.uniforms.textureMatrix = new THREE.Uniform(tMatrix);
    this.injectMacro("HAS_TEXTURE", true, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  if (this.hasDisplacementMap()){
    this.mesh.material.uniforms.displacementMap.value = displacementTexture;
  }else{
    this.mesh.material.uniforms.displacementMap = this.getTextureUniform(displacementTexture);
    this.mesh.material.uniforms.displacementInfo = new THREE.Uniform(new THREE.Vector2());
    this.injectMacro("HAS_DISPLACEMENT", true, false);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  displacementTexture.updateMatrix();
}

AddedObject.prototype.hasAOMap = function(){
  return !(typeof this.mesh.material.uniforms.aoMap == UNDEFINED);
}

AddedObject.prototype.unMapAO = function(){
  if (this.hasAOMap()){
    delete this.mesh.material.uniforms.aoMap;
    delete this.mesh.material.uniforms.aoIntensity;
    this.removeMacro("HAS_AO", false, true);
    if (!this.hasTexture()){
      delete this.mesh.material.uniforms.textureMatrix;
      this.removeMacro("HAS_TEXTURE", true, true);
    }
  }
}

AddedObject.prototype.mapAO = function(aoTexture){
  if (!this.hasTexture()){
    var tMatrix = new THREE.Matrix3();
    tMatrix.setUvTransform(0, 0, 1, 1, 0, 0, 0);
    this.mesh.material.uniforms.textureMatrix = new THREE.Uniform(tMatrix);
    this.injectMacro("HAS_TEXTURE", true, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  if (this.hasAOMap()){
    this.mesh.material.uniforms.aoMap.value = aoTexture;
  }else{
    this.mesh.material.uniforms.aoMap = this.getTextureUniform(aoTexture);
    this.mesh.material.uniforms.aoIntensity = new THREE.Uniform(this.material.aoMapIntensity);
    this.injectMacro("HAS_AO", false, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  aoTexture.updateMatrix();
}

AddedObject.prototype.hasAlphaMap = function(){
  return !(typeof this.mesh.material.uniforms.alphaMap == UNDEFINED);
}

AddedObject.prototype.unMapAlpha = function(){
  if (this.hasAlphaMap()){
    delete this.mesh.material.uniforms.alphaMap;
    this.removeMacro("HAS_ALPHA", false, true);
    if (!this.hasTexture()){
      delete this.mesh.material.uniforms.textureMatrix;
      this.removeMacro("HAS_TEXTURE", true, true);
    }
  }
}

AddedObject.prototype.mapAlpha = function(alphaTexture){
  if (!this.hasTexture()){
    var tMatrix = new THREE.Matrix3();
    tMatrix.setUvTransform(0, 0, 1, 1, 0, 0, 0);
    this.mesh.material.uniforms.textureMatrix = new THREE.Uniform(tMatrix);
    this.injectMacro("HAS_TEXTURE", true, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  if (this.hasAlphaMap()){
    this.mesh.material.uniforms.alphaMap.value = alphaTexture;
  }else{
    this.mesh.material.uniforms.alphaMap = this.getTextureUniform(alphaTexture);
    this.injectMacro("HAS_ALPHA", false, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  alphaTexture.updateMatrix();
}

AddedObject.prototype.hasDiffuseMap = function(){
  return !(typeof this.mesh.material.uniforms.diffuseMap == UNDEFINED);
}

AddedObject.prototype.unMapDiffuse = function(){
  if (this.hasDiffuseMap()){
    delete this.mesh.material.uniforms.diffuseMap;
    this.removeMacro("HAS_DIFFUSE", false, true);
    if (!this.hasTexture()){
      delete this.mesh.material.uniforms.textureMatrix;
      this.removeMacro("HAS_TEXTURE", true, true);
    }
  }
}

AddedObject.prototype.mapDiffuse = function(diffuseTexture){
  if (!this.hasTexture()){
    var tMatrix = new THREE.Matrix3();
    tMatrix.setUvTransform(0, 0, 1, 1, 0, 0, 0);
    this.mesh.material.uniforms.textureMatrix = new THREE.Uniform(tMatrix);
    this.injectMacro("HAS_TEXTURE", true, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  if (this.hasDiffuseMap()){
    this.mesh.material.uniforms.diffuseMap.value = diffuseTexture
  }else{
    this.mesh.material.uniforms.diffuseMap = this.getTextureUniform(diffuseTexture);
    this.injectMacro("HAS_DIFFUSE", false, true);
    this.mesh.material.uniformsNeedUpdate = true;
  }
  diffuseTexture.updateMatrix();
}

AddedObject.prototype.incrementOpacity = function(val){
  this.mesh.material.uniforms.alpha.value += val;
}

AddedObject.prototype.updateOpacity = function(val){
  this.mesh.material.uniforms.alpha.value = val;
}

AddedObject.prototype.updateMVMatrix = function(){
  this.mesh.material.uniforms.modelViewMatrix.value = this.mesh.modelViewMatrix;
}

AddedObject.prototype.handleMirror = function(axis, property){
  var texturesStack = this.getTextureStack();
  if (axis == "T"){
    this.metaData["mirrorT"] = property.toUpperCase();
  }
  if (axis == "S"){
    this.metaData["mirrorS"] = property.toUpperCase();
  }
  if (axis == "ST"){
    this.metaData["mirrorT"] = property.toUpperCase();
    this.metaData["mirrorS"] = property.toUpperCase();
  }
  for (var i = 0; i < texturesStack.length; i++){
    var texture = texturesStack[i];
    if (property.toUpperCase() == "ON"){
      if (axis == "T"){
        texture.wrapT = THREE.MirroredRepeatWrapping;
      }else if (axis == "S"){
        texture.wrapS = THREE.MirroredRepeatWrapping;
      }else if (axis == "ST"){
        texture.wrapS = THREE.MirroredRepeatWrapping;
        texture.wrapT = THREE.MirroredRepeatWrapping;
      }
    }else if (property.toUpperCase() == "OFF"){
      if (axis == "T"){
        texture.wrapT = THREE.RepeatWrapping;
      }else if (axis == "S"){
        texture.wrapS = THREE.RepeatWrapping;
      }else if (axis == "ST"){
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      }
    }
    texture.needsUpdate = true;
  }
}

AddedObject.prototype.getTextureStack = function(){
  var texturesStack = [];
  if (this.hasDiffuseMap()){
    texturesStack.push(this.mesh.material.uniforms.diffuseMap.value);
  }
  if (this.hasAlphaMap()){
    texturesStack.push(this.mesh.material.uniforms.alphaMap.value);
  }
  if (this.hasAOMap()){
    texturesStack.push(this.mesh.material.uniforms.aoMap.value);
  }
  if (this.hasEmissiveMap()){
    texturesStack.push(this.mesh.material.uniforms.emissiveMap.value);
  }
  if (this.hasDisplacementMap()){
    texturesStack.push(this.mesh.material.uniforms.displacementMap.value);
  }
  return texturesStack;
}

AddedObject.prototype.getPositionAtAxis = function(axis){
  if (axis.toLowerCase() == "x"){
    if (this.type == "box" || this.type == "ramp" || this.type == "sphere" || this.type == "cylinder"){
      return parseInt(this.metaData["centerX"]);
    }else if (this.type == "surface"){
      return parseInt(this.metaData["positionX"]);
    }
  }else if (axis.toLowerCase() == "y"){
    if (this.type == "box" || this.type == "ramp" || this.type == "sphere" || this.type == "cylinder"){
      return parseInt(this.metaData["centerY"]);
    }else if (this.type == "surface"){
      return parseInt(this.metaData["positionY"]);
    }
  }else if (axis.toLowerCase() == "z"){
    if (this.type == "box" || this.type == "ramp" || this.type == "sphere" || this.type == "cylinder"){
      return parseInt(this.metaData["centerZ"]);
    }else if (this.type == "surface"){
      return parseInt(this.metaData["positionZ"]);
    }
  }
}

AddedObject.prototype.resetPosition = function(){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  if (this.type == "box" || this.type == "ramp" || this.type == "sphere" || this.type == "cylinder"){
    mesh.position.x = this.metaData["centerX"];
    mesh.position.y = this.metaData["centerY"];
    mesh.position.z = this.metaData["centerZ"];
  }else if (this.type == "surface"){
    mesh.position.x = this.metaData["positionX"];
    mesh.position.y = this.metaData["positionY"];
    mesh.position.z = this.metaData["positionZ"];
  }

  physicsBody.position.copy(mesh.position);
}

AddedObject.prototype.translate = function(axis, amount, fromScript){
  var physicsBody = this.physicsBody;
  if (axis == "x"){
    this.mesh.translateX(amount);
  }else if (axis == "y"){
    this.mesh.translateY(amount);
  }else if (axis == "z"){
    this.mesh.translateZ(amount);
  }
  physicsBody.position.copy(this.mesh.position);
  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }
}

AddedObject.prototype.rotate = function(axis, radians, fromScript){

  if (this.type == "surface"){
    this.rotateSurface(axis, radians, fromScript);
  }else if (this.type == "box"){
    this.rotateBox(axis, radians, fromScript);
  }else if (this.type == "ramp"){
    this.rotateRamp(axis, radians, fromScript);
  }else if (this.type == "sphere"){
    this.rotateSphere(axis, radians, fromScript);
  }else if (this.type == "cylinder"){
    this.rotateCylinder(axis, radians, fromScript);
  }

  if (!fromScript){
    if (axis == "x"){
      this.rotationX += radians;
    }else if (axis == "y"){
      this.rotationY += radians;
    }else if (axis == "z"){
      this.rotationZ += radians;
    }
    this.initQuaternion.copy(this.mesh.quaternion);
  }

  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }
}

AddedObject.prototype.setPhysicsAfterRotationAroundPoint = function(axis, radians){
  if (this.type == "surface"){
    this.setSurfacePhysicsAfterRotationAroundPoint(axis, radians);
  }else if (this.type == "box"){
    this.setBoxPhysicsAfterRotationAroundPoint(axis, radians);
  }else if (this.type == "ramp"){
    this.setRampPhysicsAfterRotationAroundPoint(axis, radians);
  }else if (this.type == "sphere"){
    this.setSpherePhysicsAfterRotationAroundPoint(axis, radians);
  }else if (this.type == "cylinder"){
    this.setCylinderPhysicsAfterRotationAroundPoint(axis, radians);
  }
  this.physicsBody.position.copy(this.mesh.position);
}

AddedObject.prototype.setSurfacePhysicsAfterRotationAroundPoint = function(axis, radians){
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;
  if (gridSystemAxis == "XY"){
    physicsBody.quaternion.copy(this.mesh.quaternion);
  }else if (gridSystemAxis == "XZ"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "YZ"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_Y, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }
}

AddedObject.prototype.setCylinderPhysicsAfterRotationAroundPoint = function(axis, radians){
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;
  if (gridSystemAxis == "XZ"){
    physicsBody.quaternion.copy(this.mesh.quaternion);
  }else if (gridSystemAxis == "XY"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, -Math.PI/2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "YZ"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_Z, Math.PI/2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }
}

AddedObject.prototype.setSpherePhysicsAfterRotationAroundPoint = function(axis, radians){
  var physicsBody = this.physicsBody;
  physicsBody.quaternion.copy(this.mesh.quaternion);
}

AddedObject.prototype.setBoxPhysicsAfterRotationAroundPoint = function(axis, radians){
  var physicsBody = this.physicsBody;
  physicsBody.quaternion.copy(this.mesh.quaternion);
}

AddedObject.prototype.setRampPhysicsAfterRotationAroundPoint = function(axis, radians){
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;
  if (gridSystemAxis == "XY"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "XZ"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "YZ"){
    REUSABLE_QUATERNION.copy(this.mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }
}

AddedObject.prototype.rotateSphere = function(axis, radians, fromScript){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  if (axis == "x"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radians
    );
  }else if (axis == "y"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radians
    );
  }else if (axis == "z"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radians
    );
  }
  physicsBody.quaternion.copy(mesh.quaternion);
  if (!fromScript){
    physicsBody.initQuaternion.copy(
      physicsBody.quaternion
    );
  }
}

AddedObject.prototype.rotateCylinder = function(axis, radians, fromScript){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;
  if (axis == "x"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radians
    );
  }else if (axis == "y"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radians
    );
  }else if (axis == "z"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radians
    );
  }
  this.rotatePhysicsBody(axis, radians);
  if (!fromScript){
    physicsBody.initQuaternion.copy(
      physicsBody.quaternion
    );
  }
}

AddedObject.prototype.rotateRamp = function(axis, radians, fromScript){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;
  if (axis == "x"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radians
    );
  }else if (axis == "y"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radians
    );
  }else if (axis == "z"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radians
    );
  }
  if (gridSystemAxis == "XY"){
    REUSABLE_QUATERNION.copy(mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "XZ"){
    REUSABLE_QUATERNION.copy(mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "YZ"){
    REUSABLE_QUATERNION.copy(mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }
  if (!fromScript){
    physicsBody.initQuaternion.copy(
      physicsBody.quaternion
    );
    this.initQuaternion.copy(this.mesh.quaternion);
  }
}

AddedObject.prototype.rotateSurface = function(axis, radians, fromScript){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  var gridSystemAxis = this.metaData.gridSystemAxis;

  if (axis == "x"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radians
    );
  }else if (axis == "y"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radians
    );
  }else if (axis == "z"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radians
    );
  }
  if (gridSystemAxis == "XY"){
    physicsBody.quaternion.copy(mesh.quaternion);
  }else if (gridSystemAxis == "XZ"){
    REUSABLE_QUATERNION.copy(mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_X, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }else if (gridSystemAxis == "YZ"){
    REUSABLE_QUATERNION.copy(mesh.quaternion);
    REUSABLE_QUATERNION2.setFromAxisAngle(THREE_AXIS_VECTOR_Y, Math.PI / 2);
    REUSABLE_QUATERNION.multiply(REUSABLE_QUATERNION2);
    physicsBody.quaternion.copy(REUSABLE_QUATERNION);
  }
  if (!fromScript){
    physicsBody.initQuaternion.copy(
      physicsBody.quaternion
    );
    this.initQuaternion.copy(this.mesh.quaternion);
  }
}

AddedObject.prototype.rotateBox = function(axis, radians, fromScript){
  var mesh = this.mesh;
  var physicsBody = this.physicsBody;
  if (axis == "x"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radians
    );
  }else if (axis == "y"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radians
    );
  }else if (axis == "z"){
    mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radians
    );
  }
  physicsBody.quaternion.copy(mesh.quaternion);
  if (!fromScript){
    physicsBody.initQuaternion.copy(
      physicsBody.quaternion
    );
  }
}

AddedObject.prototype.rotatePhysicsBody = function(axis, radians){
  if (axis.toLowerCase() == "x"){
    REUSABLE_CANNON_QUATERNION.setFromAxisAngle(CANNON_AXIS_VECTOR_X, radians);
  }else if (axis.toLowerCase() == "y"){
    REUSABLE_CANNON_QUATERNION.setFromAxisAngle(CANNON_AXIS_VECTOR_Y, radians);
  }else if (axis.toLowerCase() == "z"){
    REUSABLE_CANNON_QUATERNION.setFromAxisAngle(CANNON_AXIS_VECTOR_Z, radians);
  }
  REUSABLE_CANNON_QUATERNION.mult(this.physicsBody.quaternion, REUSABLE_CANNON_QUATERNION_2);
  this.physicsBody.quaternion.copy(REUSABLE_CANNON_QUATERNION_2);
}

AddedObject.prototype.setCannonQuaternionFromTHREE = function(){
  this.physicsBody.quaternion.copy(this.mesh.quaternion);
  if (this.type == "ramp" || this.type == "surface"){
    if (this.gridSystemAxis == "XZ" || this.gridSystemAxis == "XY" || this.gridSystemAxis == "YZ"){
      if (!(this.type == "surface" && (this.gridSystemAxis == "XY" || this.gridSystemAxis == "YZ"))){
        this.physicsBody.rotation.y += (Math.PI / 2);
      }else{
        if (this.type == "surface" && this.gridSystemAxis == "YZ"){
          this.mesh.rotation.y -= (Math.PI / 2);
        }
      }
    }
  }
}

AddedObject.prototype.setMass = function(mass){
  if (mass != 0){
    this.isDynamicObject = true;
    this.physicsBody.type = CANNON.Body.DYNAMIC;
  }else{
    this.isDynamicObject = false;
    this.physicsBody.type = CANNON.Body.STATIC;
  }
  this.physicsBody.mass = mass;
  this.physicsBody.updateMassProperties();
  this.physicsBody.aabbNeedsUpdate = true;
  this.mass = mass;
}

AddedObject.prototype.destroy = function(skipRaycasterRefresh){
  scene.remove(this.mesh);
  physicsWorld.remove(this.physicsBody);
  if (this.destroyedGrids){
    for (var gridName in this.destroyedGrids){
      this.destroyedGrids[gridName].destroyedAddedObject = 0;
    }
  } 
  this.dispose();
  if (!skipRaycasterRefresh){
    rayCaster.refresh();
  }
}

AddedObject.prototype.dispose = function(){

  if (this.hasDiffuseMap()){
    this.mesh.material.uniforms.diffuseMap.value.dispose();
  }
  if (this.hasAlphaMap()){
    this.mesh.material.uniforms.alphaMap.value.dispose();
  }
  if (this.hasAOMap()){
    this.mesh.material.uniforms.aoMap.value.dispose();
  }
  if (this.hasDisplacementMap()){
    this.mesh.material.uniforms.displacementMap.value.dispose();
  }
  if (this.hasEmissiveMap()){
    this.mesh.material.uniforms.emissiveMap.value.dispose();
  }

  this.mesh.geometry.dispose();
  this.mesh.material.dispose();
}

AddedObject.prototype.mapTexturePack = function(texturePack){
  this.resetMaps();
  if (texturePack.hasDiffuse){
    this.mapDiffuse(texturePack.diffuseTexture);
    this.mesh.material.uniforms.diffuseMap.value.roygbivTexturePackName = texturePack.name;
    this.mesh.material.uniforms.diffuseMap.value.roygbivTextureName = 0;
    this.mesh.material.uniforms.diffuseMap.value.needsUpdate = true;
  }
  if (texturePack.hasAlpha){
    this.mapAlpha(texturePack.alphaTexture);
    this.mesh.material.uniforms.alphaMap.value.roygbivTexturePackName = texturePack.name;
    this.mesh.material.uniforms.alphaMap.value.roygbivTextureName = 0;
    this.mesh.material.uniforms.alphaMap.value.needsUpdate = true;
  }
  if (texturePack.hasAO){
    this.mapAO(texturePack.aoTexture);
    this.mesh.material.uniforms.aoMap.value.roygbivTexturePackName = texturePack.name;
    this.mesh.material.uniforms.aoMap.value.roygbivTextureName = 0;
    this.mesh.material.uniforms.aoMap.value.needsUpdate = true;
  }
  if (texturePack.hasEmissive){
    this.mapEmissive(texturePack.emissiveTexture);
    this.mesh.material.uniforms.emissiveMap.value.roygbivTexturePackName = texturePack.name;
    this.mesh.material.uniforms.emissiveMap.value.roygbivTextureName = 0;
    this.mesh.material.uniforms.emissiveMap.value.needsUpdate = true;
  }
  if (texturePack.hasHeight && VERTEX_SHADER_TEXTURE_FETCH_SUPPORTED){
    this.mapDisplacement(texturePack.heightTexture);
    this.mesh.material.uniforms.displacementMap.value.roygbivTexturePackName = texturePack.name;
    this.mesh.material.uniforms.displacementMap.value.roygbivTextureName = 0;
    this.mesh.material.uniforms.displacementMap.value.needsUpdate = true;
  }
  this.associatedTexturePack = texturePack.name;
}

AddedObject.prototype.resetAssociatedTexturePack = function(){
  this.associatedTexturePack = 0;
}

AddedObject.prototype.segmentGeometry = function(isCustom, count, returnGeometry){
  var newGometry;
  if (this.type == "surface"){
    var width = this.metaData["width"];
    var height = this.metaData["height"];
    if (!isCustom){
      var geomKey = (
        "PlaneBufferGeometry" + PIPE +
        width + PIPE + height + PIPE +
        planeWidthSegments + PIPE + planeHeightSegments
      );
      newGeometry = geometryCache[geomKey];
      if (!newGeometry){
        newGeometry = new THREE.PlaneBufferGeometry(width, height, planeWidthSegments, planeHeightSegments);
        geometryCache[geomKey] = newGeometry;
      }
    }else{
      if (!isNaN(count)){
        if (returnGeometry){
          var geomKey = (
            "PlaneGeometry" + PIPE +
            width + PIPE + height + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneGeometry(width, height, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "PlaneBufferGeometry" + PIPE +
            width + PIPE + height + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneBufferGeometry(width, height, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }else{
        if (returnGeometry){
          var geomKey = (
            "PlaneGeometry" + PIPE +
            width + PIPE + height + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneGeometry(width, height, count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "PlaneBufferGeometry" + PIPE +
            width + PIPE + height + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneBufferGeometry(width, height, count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }
    }
  }else if (this.type == "ramp"){
    var rampWidth = this.metaData["rampWidth"];
    var rampHeight = this.metaData["rampHeight"];
    if (!isCustom){
      var geomKey = (
        "PlaneBufferGeometry" + PIPE +
        rampWidth + PIPE + rampHeight + PIPE +
        planeWidthSegments + PIPE + planeHeightSegments
      );
      newGeometry = geometryCache[geomKey];
      if (!newGeometry){
        newGeometry = new THREE.PlaneBufferGeometry(rampWidth, rampHeight, planeWidthSegments, planeHeightSegments);
        geometryCache[geomKey] = newGeometry;
      }
    }else{
      if (!isNaN(count)){
        if (returnGeometry){
          var geomKey = (
            "PlaneGeometry" + PIPE +
            rampWidth + PIPE + rampHeight + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneGeometry(rampWidth, rampHeight, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "PlaneBufferGeometry" + PIPE +
            rampWidth + PIPE + rampHeight + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneBufferGeometry(rampWidth, rampHeight, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }else{
        if (returnGeometry){
          var geomKey = (
            "PlaneGeometry" + PIPE +
            rampWidth + PIPE + rampHeight + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey]
          if (!newGeometry){
            newGeometry = new THREE.PlaneGeometry(rampWidth, rampHeight, count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "PlaneBufferGeometry" + PIPE +
            rampWidth + PIPE + rampHeight + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.PlaneBufferGeometry(rampWidth, rampHeight, count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }
    }
  }else if (this.type == "box"){
    var boxSizeX = this.metaData["boxSizeX"];
    var boxSizeY = this.metaData["boxSizeY"];
    var boxSizeZ = this.metaData["boxSizeZ"];
    if (!isCustom){
      var geomKey = (
        "BoxBufferGeometry" + PIPE +
        boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
        boxWidthSegments + PIPE + boxHeightSegments + PIPE +boxDepthSegments
      );
      newGeometry = geometryCache[geomKey];
      if (!newGeometry){
        newGeometry = new THREE.BoxBufferGeometry(boxSizeX, boxSizeY, boxSizeZ, boxWidthSegments, boxHeightSegments, boxDepthSegments);
        geometryCache[geomKey] = newGeometry;
      }
    }else{
      if (!isNaN(count)){
        if (returnGeometry){
          var geomKey = (
            "BoxGeometry" + PIPE +
            boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
            count + PIPE + count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.BoxGeometry(boxSizeX, boxSizeY, boxSizeZ, count, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "BoxBufferGeometry" + PIPE +
            boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
            count + PIPE + count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.BoxBufferGeometry(boxSizeX, boxSizeY, boxSizeZ, count, count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }else{
        if (returnGeometry){
          var geomKey = (
            "BoxGeometry" + PIPE +
            boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
            count.width + PIPE + count.height + PIPE + count.depth
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.BoxGeometry(boxSizeX, boxSizeY, boxSizeZ, count.width, count.height, count.depth);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "BoxBufferGeometry" + PIPE +
            boxSizeX + PIPE + boxSizeY + PIPE + boxSizeZ + PIPE +
            count.width + PIPE + count.height + PIPE + count.depth
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.BoxBufferGeometry(boxSizeX, boxSizeY, boxSizeZ, count.width, count.height, count.depth);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }
    }
  }else if (this.type == "sphere"){
    var radius = this.metaData["radius"];
    if (!isCustom){
      var geomKey = (
        "SphereBufferGeometry" + PIPE +
        Math.abs(radius) + PIPE +
        sphereWidthSegments + PIPE + sphereHeightSegments
      );
      newGeometry = geometryCache[geomKey];
      if (!newGeometry){
        newGeometry = new THREE.SphereBufferGeometry(Math.abs(radius), sphereWidthSegments, sphereHeightSegments);
        geometryCache[geomKey] = newGeometry;
      }
    }else{
      if (!isNaN(count)){
        if (count < 8){
          count = 8;
        }
        if (returnGeometry){
          var geomKey = (
            "SphereGeometry" + PIPE +
            Math.abs(radius) + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.SphereGeometry(Math.abs(radius), count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "SphereBufferGeometry" + PIPE +
            Math.abs(radius) + PIPE +
            count + PIPE + count
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.SphereBufferGeometry(Math.abs(radius), count, count);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }else{
        if (count.width < 8){
          count.width = 8;
        }
        if (count.height < 6){
          count.height = 6;
        }
        if (returnGeometry){
          var geomKey = (
            "SphereGeometry" + PIPE +
            Math.abs(radius) + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.SphereGeometry(Math.abs(radius), count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "SphereBufferGeometry" + PIPE +
            Math.abs(radius) + PIPE +
            count.width + PIPE + count.height
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.SphereBufferGeometry(Math.abs(radius), count.width, count.height);
            geometryCache[geomKey] = newGeometry;
          }
        }
      }
    }
  }else if (this.type == "cylinder"){
    var height = this.metaData["height"];
    var topRadius = this.metaData["topRadius"];
    var bottomRadius = this.metaData["bottomRadius"];
    var isOpenEnded = this.metaData["isOpenEnded"];
    if (!isCustom){
      var geomKey = (
        "CylinderBufferGeometry" + PIPE + height + PIPE + topRadius + PIPE + bottomRadius + PIPE +
        cylinderWidthSegments + PIPE + cylinderHeightSegments + PIPE + isOpenEnded
      );
      newGeometry = geometryCache[geomKey];
      if (!newGeometry){
        newGeometry = new THREE.CylinderBufferGeometry(
          topRadius, bottomRadius, height, cylinderWidthSegments, cylinderHeightSegments, isOpenEnded
        );
        geometryCache[geomKey] = newGeometry;
      }
      this.modifyCylinderPhysicsAfterSegmentChange(cylinderWidthSegments);
    }else{
      if (!isNaN(count)){
        if (count < 8){
          count = 8;
        }
        if (returnGeometry){
          var geomKey = (
            "CylinderGeometry" + PIPE + height + PIPE + topRadius + PIPE + bottomRadius + PIPE +
            count + PIPE + count + PIPE + isOpenEnded
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.CylinderGeometry(
              topRadius, bottomRadius, height, count, count, isOpenEnded
            );
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "CylinderBufferGeometry" + PIPE + height + PIPE + topRadius + PIPE + bottomRadius + PIPE +
            count + PIPE + count + PIPE + isOpenEnded
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.CylinderBufferGeometry(
              topRadius, bottomRadius, height, count, count, isOpenEnded
            );
            geometryCache[geomKey] = newGeometry;
          }
          this.modifyCylinderPhysicsAfterSegmentChange(count);
        }
      }else{
        if (count.width < 8){
          count.width = 8;
        }
        if (count.height < 1){
          count.height = 1;
        }
        if (returnGeometry){
          var geomKey = (
            "CylinderGeometry" + PIPE + height + PIPE + topRadius + PIPE + bottomRadius + PIPE +
            count.width + PIPE + count.height + PIPE + isOpenEnded
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.CylinderGeometry(
              topRadius, bottomRadius, height, count.width, count.height, isOpenEnded
            );
            geometryCache[geomKey] = newGeometry;
          }
        }else{
          var geomKey = (
            "CylinderBufferGeometry" + PIPE + height + PIPE + topRadius + PIPE + bottomRadius + PIPE +
            count.width + PIPE + count.height + PIPE + isOpenEnded
          );
          newGeometry = geometryCache[geomKey];
          if (!newGeometry){
            newGeometry = new THREE.CylinderBufferGeometry(
              topRadius, bottomRadius, height, count.width, count.height, isOpenEnded
            );
            geometryCache[geomKey] = newGeometry;
          }
          this.modifyCylinderPhysicsAfterSegmentChange(count.width);
        }
      }
    }
  }

  if (returnGeometry){
    return newGeometry;
  }

  var newMesh = new THREE.Mesh(newGeometry, this.mesh.material);
  newMesh.position.x = this.mesh.position.x;
  newMesh.position.y = this.mesh.position.y;
  newMesh.position.z = this.mesh.position.z;
  newMesh.rotation.x = this.mesh.rotation.x;
  newMesh.rotation.y = this.mesh.rotation.y;
  newMesh.rotation.z = this.mesh.rotation.z;

  scene.remove(this.mesh);
  this.mesh = newMesh;
  webglCallbackHandler.registerEngineObject(this);
  this.mesh.addedObject = this;
  scene.add(this.mesh);

  if (this.type == "surface" || this.type == "ramp"){
    if (!isCustom){
      this.metaData["widthSegments"] = planeWidthSegments;
      this.metaData["heightSegments"] = planeHeightSegments;
    }else{
      if (isNaN(count)){
        this.metaData["widthSegments"] = count.width;
        this.metaData["heightSegments"] = count.height;
      }else{
        this.metaData["widthSegments"] = count;
        this.metaData["heightSegments"] = count;
      }
    }
  }else if(this.type == "box"){
    if (!isCustom){
      this.metaData["widthSegments"] = boxWidthSegments;
      this.metaData["heightSegments"] = boxHeightSegments;
      this.metaData["depthSegments"] = boxDepthSegments;
    }else{
      if (isNaN(count)){
        this.metaData["widthSegments"] = count.width;
        this.metaData["heightSegments"] = count.height;
        this.metaData["depthSegments"] = count.depth;
      }else{
        this.metaData["widthSegments"] = count;
        this.metaData["heightSegments"] = count;
        this.metaData["depthSegments"] = count;
      }
    }
  }else if (this.type == "sphere"){
    if (!isCustom){
      this.metaData["widthSegments"] = sphereWidthSegments;
      this.metaData["heightSegments"] = sphereHeightSegments;
    }else{
      if (isNaN(count)){
        this.metaData["widthSegments"] = count.width;
        this.metaData["heightSegments"] = count.height;
      }else{
        this.metaData["widthSegments"] = count;
        this.metaData["heightSegments"] = count;
      }
    }
  }else if (this.type == "cylinder"){
    if (!isCustom){
      this.metaData["widthSegments"] = cylinderWidthSegments;
      this.metaData["heightSegments"] = cylinderHeightSegments;
    }else{
      if (isNaN(count)){
        this.metaData["widthSegments"] = count.width;
        this.metaData["heightSegments"] = count.height;
      }else{
        this.metaData["widthSegments"] = count;
        this.metaData["heightSegments"] = count;
      }
    }
  }
}

AddedObject.prototype.modifyCylinderPhysicsAfterSegmentChange = function(radialSegments){
  var topRadius = this.metaData.topRadius;
  var bottomRadius = this.metaData.bottomRadius;
  var height = this.metaData.height;
  var oldPosition = this.physicsBody.position.clone();
  var oldQuaternion = this.physicsBody.quaternion.clone();
  if (!this.noMass){
    physicsWorld.remove(this.physicsBody);
  }
  var physicsShapeKey = "CYLINDER" + PIPE + topRadius + PIPE + bottomRadius + PIPE +
                                            Math.abs(height) + PIPE + radialSegments + PIPE +
                                            this.metaData.gridSystemAxis;
  var newPhysicsShape = physicsShapeCache[physicsShapeKey];
  var cached = false;
  if (!newPhysicsShape){
    newPhysicsShape = new CANNON.Cylinder(
      this.metaData.topRadius, this.metaData.bottomRadius, Math.abs(this.metaData.height), parseInt(radialSegments)
    );
    physicsShapeCache[physicsShapeKey] = newPhysicsShape;
  }else{
    cached = true;
  }
  if (!cached){
    if (this.metaData.gridSystemAxis == "XZ"){
      var quat = new CANNON.Quaternion();
      var coef = 1;
      if (height < 0){
        coef = -1;
      }
      quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2 * coef);
      var translation = new CANNON.Vec3(0, 0, 0);
      newPhysicsShape.transformAllPoints(translation,quat);
    }else if (this.metaData.gridSystemAxis == "XY"){
      if (height < 0){
        var quat = new CANNON.Quaternion();
        quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI);
        var translation = new CANNON.Vec3(0, 0, 0);
        newPhysicsShape.transformAllPoints(translation,quat);
      }
    }else if (this.metaData.gridSystemAxis == "YZ"){
      var quat = new CANNON.Quaternion();
      var coef = 1;
      if (height < 0){
        coef = -1;
      }
      quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), coef * Math.PI/2);
      var translation = new CANNON.Vec3(0, 0, 0);
      newPhysicsShape.transformAllPoints(translation,quat);
    }
  }
  var physicsMaterial = this.physicsBody.material;
  var mass = this.physicsBody.mass;
  this.physicsBody = new CANNON.Body({
    mass: mass,
    shape: newPhysicsShape,
    material: physicsMaterial
  });
  this.physicsBody.position.copy(oldPosition);
  this.physicsBody.quaternion.copy(oldQuaternion);
  if (!this.noMass){
    physicsWorld.add(this.physicsBody);
  }
}

AddedObject.prototype.resetMaps = function(resetAssociatedTexturePack){
  this.unMapDiffuse();
  this.unMapAlpha();
  this.unMapAO();
  this.unMapDisplacement();
  this.unMapEmissive();
  if (resetAssociatedTexturePack){
    this.associatedTexturePack = 0;
  }
}

AddedObject.prototype.refreshTextueMatrix = function(){
  if (this.hasDiffuseMap()){
    this.mesh.material.uniforms.diffuseMap.value.updateMatrix();
  }
  if (this.hasAlphaMap()){
    this.mesh.material.uniforms.alphaMap.value.updateMatrix();
  }
  if (this.hasAOMap()){
    this.mesh.material.uniforms.aoMap.value.updateMatrix();
  }
  if (this.hasEmissiveMap()){
    this.mesh.material.uniforms.emissiveMap.value.updateMatrix();
  }
  if (this.hasDisplacementMap()){
    this.mesh.material.uniforms.displacementMap.value.updateMatrix();
  }
}

AddedObject.prototype.adjustTextureRepeat = function(repeatU, repeatV){
  if (repeatU){
    this.metaData["textureRepeatU"] = repeatU;
  }else{
    repeatU = this.metaData["textureRepeatU"];
  }
  if (repeatV){
    this.metaData["textureRepeatV"] = repeatV;
  }else{
    repeatV = this.metaData["textureRepeatV"];
  }
  if (this.hasTexture()){
    this.mesh.material.uniforms.textureMatrix.value.elements[0] = repeatU;
    this.mesh.material.uniforms.textureMatrix.value.elements[4] = repeatV;
  }
}

AddedObject.prototype.isVisibleOnThePreviewScene = function(parentName){
  if (typeof parentName == "undefined"){
    return !(this.isHidden);
  }else{
    return objectGroups[parentName].isVisibleOnThePreviewScene();
  }
}

AddedObject.prototype.isTextureUsed = function(textureName){
  var textureStack = this.getTextureStack();
  for (var i = 0; i<textureStack.length; i++){
    if (!(textureStack[i].roygbivTextureName == "undefined")){
      if (textureStack[i].roygbivTextureName == textureName){
        return true;
      }
    }
  }
}

AddedObject.prototype.isTexturePackUsed = function(texturePackName){
  var textureStack = this.getTextureStack();
  for (var i = 0; i<textureStack.length; i++){
    if (!(textureStack[i].roygbivTexturePackName == "undefined")){
      if (textureStack[i].roygbivTexturePackName == texturePackName){
        return true;
      }
    }
  }
}

AddedObject.prototype.setBlending = function(blendingModeInt){
  this.mesh.material.blending = blendingModeInt;
  if (blendingModeInt == NO_BLENDING){
    this.blendingMode = "NO_BLENDING";
  }else if (blendingModeInt == NORMAL_BLENDING){
    this.blendingMode = "NORMAL_BLENDING";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    this.blendingMode = "ADDITIVE_BLENDING";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    this.blendingMode = "SUBTRACTIVE_BLENDING";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    this.blendingMode = "MULTIPLY_BLENDING";
  }
}

AddedObject.prototype.getBlendingText = function(){
  var blendingModeInt = this.mesh.material.blending;
  if (blendingModeInt == NO_BLENDING){
    return "None";
  }else if (blendingModeInt == NORMAL_BLENDING){
    return "Normal";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    return "Additive";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    return "Subtractive";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    return "Multiply";
  }
}

AddedObject.prototype.intersectsBox = function(box){
  for (var i = 0; i< this.trianglePlanes.length; i+=2){
    var plane = this.trianglePlanes[i];
    if (plane.intersectLine(line, REUSABLE_VECTOR)){
      var triangle1 = this.triangles[i];
      var triangle2 = this.triangles[i+1];
      if (triangle1.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }else if (triangle2.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }
    }
  }
  return false;
}

AddedObject.prototype.intersectsLine = function(line){
  for (var i = 0; i< this.trianglePlanes.length; i+=2){
    var plane = this.trianglePlanes[i];
    if (plane.intersectLine(line, REUSABLE_VECTOR)){
      var triangle1 = this.triangles[i];
      var triangle2 = this.triangles[i+1];
      if (triangle1 && triangle1.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }else if (triangle2 && triangle2.containsPoint(REUSABLE_VECTOR)){
        INTERSECTION_NORMAL.set(plane.normal.x, plane.normal.y, plane.normal.z);
        return REUSABLE_VECTOR;
      }
    }
  }
  return false;
}

AddedObject.prototype.correctBoundingBox = function(bb){
  if (bb.min.x >= bb.max.x){
    bb.max.x += 0.5;
    bb.min.x -= 0.5;
  }
  if (bb.min.y >= bb.max.y){
    bb.max.y += 0.5;
    bb.min.y -= 0.5;
  }
  if (bb.min.z >= bb.max.z){
    bb.max.z += 0.5;
    bb.min.z -= 0.5;
  }
}

AddedObject.prototype.updateBoundingBoxes = function(parentAry){
  var bb = this.boundingBoxes[0];
  bb.makeEmpty();
  for (var i = 0; i<this.vertices.length; i++){
    var vertex = this.vertices[i];
    this.reusableVec3.set(vertex.x, vertex.y, vertex.z);
    this.reusableVec3.applyMatrix4(this.mesh.matrixWorld);
    bb.expandByPoint(this.reusableVec3);
    this.transformedVertices[i].set(
      this.reusableVec3.x, this.reusableVec3.y, this.reusableVec3.z
    );
  }
  for (var i = 0; i<this.pseudoFaces.length; i++){
    var face = this.pseudoFaces[i];
    var a = face.a;
    var b = face.b;
    var c = face.c;
    var triangle = this.triangles[i];
    triangle.set(
      this.transformedVertices[a], this.transformedVertices[b], this.transformedVertices[c]
    );
    var plane = this.trianglePlanes[i];
    triangle.getPlane(plane);
  }
  if (parentAry){
    parentAry[this.parentBoundingBoxIndex] = bb;
  }
  this.lastUpdatePosition.copy(this.mesh.position);
  this.lastUpdateQuaternion.copy(this.mesh.quaternion);
}

AddedObject.prototype.boundingBoxesNeedUpdate = function(){
  return !(Math.abs(this.lastUpdatePosition.x - this.mesh.position.x) < 0.1 &&
            Math.abs(this.lastUpdatePosition.y - this.mesh.position.y) < 0.1 &&
              Math.abs(this.lastUpdatePosition.z - this.mesh.position.z) < 0.1 &&
                Math.abs(this.lastUpdateQuaternion.x - this.mesh.quaternion.x) < 0.0001 &&
                  Math.abs(this.lastUpdateQuaternion.y - this.mesh.quaternion.y) < 0.0001 &&
                    Math.abs(this.lastUpdateQuaternion.z - this.mesh.quaternion.z) < 0.0001 &&
                      Math.abs(this.lastUpdateQuaternion.w - this.mesh.quaternion.w) < 0.0001);
}

AddedObject.prototype.generateBoundingBoxes = function(parentAry){
  var pseudoGeometry;
  if (typeof this.metaData.slicedType == UNDEFINED){
    pseudoGeometry = this.segmentGeometry(true, 1, true);
  }else{
    pseudoGeometry = new THREE.Geometry().fromBufferGeometry(this.mesh.geometry);
  }
  this.vertices = pseudoGeometry.vertices;
  var bb = new THREE.Box3();
  bb.roygbivObjectName = this.name;
  this.boundingBoxes = [bb];
  if (parentAry){
    parentAry.push(bb);
    this.parentBoundingBoxIndex = (parentAry.length - 1);
  }
  this.mesh.updateMatrixWorld();
  this.transformedVertices = [];
  for (var i = 0; i<this.vertices.length; i++){
    var vertex = this.vertices[i].clone();
    vertex.applyMatrix4(this.mesh.matrixWorld);
    bb.expandByPoint(vertex);
    this.transformedVertices.push(vertex);
  }
  this.triangles = [];
  this.trianglePlanes = [];
  for (var i = 0; i<pseudoGeometry.faces.length; i++){
    var face = pseudoGeometry.faces[i];
    var a = face.a;
    var b = face.b;
    var c = face.c;
    var triangle = new THREE.Triangle(
      this.transformedVertices[a], this.transformedVertices[b], this.transformedVertices[c]
    );
    this.triangles.push(triangle);
    var plane = new THREE.Plane();
    triangle.getPlane(plane);
    this.trianglePlanes.push(plane);
  }
  this.pseudoFaces = pseudoGeometry.faces;
}

AddedObject.prototype.visualiseBoundingBoxes = function(){
  if (this.bbHelpers){
    for (var i = 0; i<this.bbHelpers.length; i++){
      scene.remove(this.bbHelpers[i]);
    }
  }
  this.bbHelpers = [];
  for (var i = 0; i<this.boundingBoxes.length; i++){
    this.correctBoundingBox(this.boundingBoxes[i]);
    var bbHelper = new THREE.Box3Helper(this.boundingBoxes[i], LIME_COLOR);
    scene.add(bbHelper);
    this.bbHelpers.push(bbHelper);
  }
}

AddedObject.prototype.removeBoundingBoxesFromScene = function(){
  if (this.bbHelpers){
    for (var i = 0; i<this.bbHelpers.length; i++){
      scene.remove(this.bbHelpers[i]);
    }
  }
  this.bbHelpers = [];
}

AddedObject.prototype.getNormalGeometry = function(){
  if (!(typeof this.metaData.slicedType == UNDEFINED)){
    var geomKey = "SLICED_NORMAL_GEOMETRY_"+this.type+"_"+this.metaData.slicedType;
    if (geometryCache[geomKey]){
      return geometryCache[geomKey];
    }
    var geom = new THREE.Geometry().fromBufferGeometry(this.mesh.geometry);
    geometryCache[geomKey] = geom;
    return geom;
  }
  var count = new Object();
  if (this.type == "surface" || this.type == "ramp" || this.type == "sphere" || this.type == "cylinder"){
    count.width = this.metaData["widthSegments"];
    count.height = this.metaData["heightSegments"];
  }else if (this.type == "box"){
    count.width = this.metaData["widthSegments"];
    count.height = this.metaData["heightSegments"];
    count.depth = this.metaData["depthSegments"];
  }
  return this.segmentGeometry(true, count, true);
}

AddedObject.prototype.setSlippery = function(isSlippery){
  if (isSlippery){
    this.setFriction(0);
    this.metaData["isSlippery"] = true;
  }else{
    this.setFriction(friction);
    this.metaData["isSlippery"] = false;
  }
}

AddedObject.prototype.setFriction = function(val){
  var physicsMaterial = this.physicsBody.material;
  for (var objName in addedObjects){
    if (objName == this.name){
      continue;
    }
    var otherMaterial = addedObjects[objName].physicsBody.material;
    var contact = physicsWorld.getContactMaterial(physicsMaterial, otherMaterial);
    if (contact){
      contact.friction = val;
    }else{
      contact = new CANNON.ContactMaterial(physicsMaterial,otherMaterial, {
        friction: val,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      });
      physicsWorld.addContactMaterial(contact);
    }
  }
  for (var objName in objectGroups){
    var otherMaterial = objectGroups[objName].physicsBody.material;
    var contact = physicsWorld.getContactMaterial(physicsMaterial, otherMaterial);
    if (contact){
      contact.friction = val;
    }else{
      contact = new CANNON.ContactMaterial(physicsMaterial, otherMaterial, {
        friction: val,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      });
      physicsWorld.addContactMaterial(contact);
    }
  }
}

AddedObject.prototype.makePivot = function(offsetX, offsetY, offsetZ){
  var obj = this;
  var pseudoMesh = new THREE.Mesh(obj.mesh.geometry, obj.mesh.material);
  pseudoMesh.position.copy(obj.mesh.position);
  pseudoMesh.quaternion.copy(obj.mesh.quaternion);
  var pivot = new THREE.Object3D();
  pivot.add(pseudoMesh);
  pivot.position.set(
    pseudoMesh.position.x + offsetX,
    pseudoMesh.position.y + offsetY,
    pseudoMesh.position.z + offsetZ
  );
  pseudoMesh.position.x = -offsetX;
  pseudoMesh.position.y = -offsetY;
  pseudoMesh.position.z = -offsetZ;
  pivot.pseudoMesh = pseudoMesh;
  pivot.offsetX = offsetX;
  pivot.offsetY = offsetY;
  pivot.offsetZ = offsetZ;
  pivot.rotation.order = 'YXZ';
  pivot.sourceObject = this;
  return pivot;
}

AddedObject.prototype.rotateAroundPivotObject = function(axis, radians){
  if (!this.pivotObject){
    return;
  }
  this.updatePivot();
  this.pivotObject.updateMatrix();
  this.pivotObject.updateMatrixWorld();
  if (axis == "x"){
    this.pivotObject.rotation.x += radians;
  }else if (axis == "y"){
    this.pivotObject.rotation.y += radians;
  }else if (axis == "z"){
    this.pivotObject.rotation.z += radians;
  }
  this.pivotObject.updateMatrix();
  this.pivotObject.updateMatrixWorld();
  this.pivotObject.pseudoMesh.updateMatrix();
  this.pivotObject.pseudoMesh.updateMatrixWorld();
  this.pivotObject.pseudoMesh.matrixWorld.decompose(REUSABLE_VECTOR, REUSABLE_QUATERNION, REUSABLE_VECTOR_2);
  this.mesh.position.copy(REUSABLE_VECTOR);
  this.mesh.quaternion.copy(REUSABLE_QUATERNION);
  this.setPhysicsAfterRotationAroundPoint(axis, radians);
  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }
}

AddedObject.prototype.updatePivot = function(){
  if (!this.pivotObject){
    return;
  }
  this.pivotObject.position.copy(this.mesh.position);
  this.pivotObject.translateX(this.pivotOffsetX);
  this.pivotObject.translateY(this.pivotOffsetY);
  this.pivotObject.translateZ(this.pivotOffsetZ);
}

AddedObject.prototype.getEndPoint = function(axis){
  var translationAmount = 0;
  if (axis == "+x"){
    REUSABLE_VECTOR_6.set(1, 0, 0);
    if (this.type == "surface"){
      translationAmount = this.metaData.width / 2;
    }else if (this.type == "ramp"){
      translationAmount = this.metaData.rampWidth / 2;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeX / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = (this.metaData.topRadius + this.metaData.bottomRadius) / 2;
    }
  }else if (axis == "-x"){
    REUSABLE_VECTOR_6.set(-1, 0, 0);
    if (this.type == "surface"){
      translationAmount = this.metaData.width / 2;
    }else if (this.type == "ramp"){
      translationAmount = this.metaData.rampWidth / 2;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeX / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = (this.metaData.topRadius + this.metaData.bottomRadius) / 2;
    }
  }else if (axis == "+y"){
    REUSABLE_VECTOR_6.set(0, 1, 0);
    if (this.type == "surface"){
      translationAmount = this.metaData.height / 2;
    }else if (this.type == "ramp"){
      translationAmount = this.metaData.rampHeight / 2;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeY / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = this.metaData.height / 2;
    }
  }else if (axis == "-y"){
    REUSABLE_VECTOR_6.set(0, -1, 0);
    if (this.type == "surface"){
      translationAmount = this.metaData.height / 2;
    }else if (this.type == "ramp"){
      translationAmount = this.metaData.rampHeight / 2;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeY / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = this.metaData.height / 2;
    }
  }else if (axis == "+z"){
    REUSABLE_VECTOR_6.set(0, 0, 1);
    if (this.type == "surface"){
      translationAmount = 0;
    }else if (this.type == "ramp"){
      translationAmount = 0;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeZ / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = (this.metaData.topRadius + this.metaData.bottomRadius) / 2;
    }
  }else if (axis == "-z"){
    REUSABLE_VECTOR_6.set(0, 0, -1);
    if (this.type == "surface"){
      translationAmount = 0;
    }else if (this.type == "ramp"){
      translationAmount = 0;
    }else if (this.type == "box"){
      translationAmount = this.metaData.boxSizeZ / 2;
    }else if (this.type == "sphere"){
      translationAmount = this.metaData.radius;
    }else if (this.type == "cylinder"){
      translationAmount = (this.metaData.topRadius + this.metaData.bottomRadius) / 2;
    }
  }
  var quaternion, position;
  if (this.parentObjectName){
    var parentObject = objectGroups[this.parentObjectName];
    parentObject.graphicsGroup.position.copy(parentObject.mesh.position);
    parentObject.graphicsGroup.quaternion.copy(parentObject.mesh.quaternion);
    parentObject.graphicsGroup.updateMatrix();
    parentObject.graphicsGroup.updateMatrixWorld();
    var child = parentObject.graphicsGroup.children[this.indexInParent];
    child.getWorldPosition(REUSABLE_VECTOR_7);
    child.getWorldQuaternion(REUSABLE_QUATERNION);
    position = REUSABLE_VECTOR_7;
    quaternion = REUSABLE_QUATERNION;
  }else{
    quaternion = this.mesh.quaternion;
    position = REUSABLE_VECTOR_7.copy(this.mesh.position);
  }
  REUSABLE_VECTOR_6.applyQuaternion(quaternion);
  position.add(REUSABLE_VECTOR_6.multiplyScalar(translationAmount));
  return position;
}

AddedObject.prototype.copy = function(name, isHardCopy, copyPosition, gridSystem, fromScript){
  var copyMesh;
  if (isHardCopy){
    copyMesh = new MeshGenerator(this.mesh.geometry, this.material).generateMesh();
  }else{
    copyMesh = new THREE.Mesh(this.mesh.geometry, this.mesh.material);
  }
  var copyPhysicsbody = new CANNON.Body({
    mass: 0,
    shape: this.physicsBody.shapes[0],
    material: new CANNON.Material()
  });
  copyMesh.position.copy(copyPosition);
  copyPhysicsbody.position.copy(copyPosition);
  copyMesh.quaternion.copy(this.mesh.quaternion);
  copyPhysicsbody.quaternion.copy(this.physicsBody.quaternion);
  var copyMetaData = Object.assign({}, this.metaData);

  var destroyedGrids = new Object();
  if (!fromScript && !jobHandlerWorking){
    var startRow, finalRow, startCol, finalCol;
    var grid1 = 0, grid2 = 0;
    for (var gridName in gridSelections){
      if (!grid1){
        grid1 = gridSelections[gridName];
      }else{
        grid2 = gridSelections[gridName];
      }
    }
    if (!grid2){
      grid2 = grid1;
    }
    if (!this.skipToggleGrid){
      grid1.toggleSelect(false, false, false, true);
      if (grid1.name != grid2.name){
        grid2.toggleSelect(false, false, false, true);
      }
      delete gridSelections[grid1.name];
      delete gridSelections[grid2.name];
    }
    startRow = grid1.rowNumber;
    if (grid2.rowNumber < grid1.rowNumber){
      startRow = grid2.rowNumber;
    }
    startCol = grid1.colNumber;
    if (grid2.colNumber < grid1.colNumber){
      startCol = grid2.colNumber;
    }
    finalRow = grid1.rowNumber;
    if (grid2.rowNumber > grid1.rowNumber){
      finalRow = grid2.rowNumber;
    }
    finalCol = grid1.colNumber;
    if (grid2.colNumber > grid1.colNumber){
      finalCol = grid2.colNumber;
    }
    for (var row = startRow; row <= finalRow; row++){
      for (var col = startCol; col <= finalCol; col++ ){
        var grid = gridSystem.getGridByColRow(col, row);
        if (grid){
          destroyedGrids[grid.name] = grid;
        }
      }
    }
  }
  if (jobHandlerWorking){
    destroyedGrids[jobHandlerSelectedGrid.name] = jobHandlerSelectedGrid;
  }
  var copyInstance = new AddedObject(
    name, this.type, copyMetaData, this.material, copyMesh, copyPhysicsbody, destroyedGrids
  );
  copyMesh.addedObject = copyInstance;
  copyInstance.updateMVMatrix();
  copyInstance.isCopied = true;
  copyInstance.copiedWithScript = fromScript;
  if (!fromScript && !jobHandlerWorking){
    copyInstance.metaData["grid1Name"] = grid1.name;
    copyInstance.metaData["grid2Name"] = grid2.name;
  }
  if (jobHandlerWorking){
    copyInstance.metaData["grid1Name"] = jobHandlerSelectedGrid.name;
    copyInstance.metaData["grid2Name"] = jobHandlerSelectedGrid.name;
  }
  copyInstance.metaData["positionX"] = copyMesh.position.x;
  copyInstance.metaData["positionY"] = copyMesh.position.y;
  copyInstance.metaData["positionZ"] = copyMesh.position.z;
  copyInstance.metaData["centerX"] = copyMesh.position.x;
  copyInstance.metaData["centerY"] = copyMesh.position.y;
  copyInstance.metaData["centerZ"] = copyMesh.position.z;
  copyInstance.metaData["quaternionX"] = copyMesh.quaternion.x;
  copyInstance.metaData["quaternionY"] = copyMesh.quaternion.y;
  copyInstance.metaData["quaternionZ"] = copyMesh.quaternion.z;
  copyInstance.metaData["quaternionW"] = copyMesh.quaternion.w;
  copyInstance.metaData["widthSegments"] = this.metaData["widthSegments"];
  copyInstance.metaData["heightSegments"] = this.metaData["heightSegments"];
  copyInstance.metaData["depthSegments"] = this.metaData["depthSegments"];

  copyInstance.rotationX = this.rotationX;
  copyInstance.rotationY = this.rotationY;
  copyInstance.rotationZ = this.rotationZ;
  if (this.physicsBody.mass != 0){
    copyInstance.setMass(this.physicsBody.mass);
  }
  copyInstance.noMass = this.noMass;
  copyInstance.isChangeable = this.isChangeable;
  copyInstance.isIntersectable = this.isIntersectable;
  copyInstance.isColorizable = this.isColorizable;
  if (this.metaData["isSlippery"]){
    copyInstance.setSlippery(true);
  }
  if (!(typeof this.metaData["renderSide"] == UNDEFINED)){
    copyInstance.handleRenderSide(this.metaData["renderSide"]);
  }
  if (!(typeof this.metaData.slicedType == UNDEFINED)){
    copyInstance.sliceInHalf(this.metaData.slicedType);
  }

  if (isHardCopy){
    if (this.material instanceof BasicMaterial){
      if (this.hasDiffuseMap()){
        copyInstance.mapDiffuse(this.mesh.material.uniforms.diffuseMap.value);
      }
      if (this.hasAlphaMap()){
        copyInstance.mapAlpha(this.mesh.material.uniforms.alphaMap.value);
      }
      if (this.hasAOMap()){
        copyInstance.mapAO(this.mesh.material.uniforms.aoMap.value);
        copyInstance.mesh.material.uniforms.aoIntensity.value = this.mesh.material.uniforms.aoIntensity.value;
      }
      if (this.hasDisplacementMap()){
        copyInstance.mapDisplacement(this.mesh.material.uniforms.displacementMap.value);
        copyInstance.mesh.material.uniforms.displacementInfo.value.x = this.mesh.material.uniforms.displacementInfo.value.x;
        copyInstance.mesh.material.uniforms.displacementInfo.value.y = this.mesh.material.uniforms.displacementInfo.value.y;
      }
      if (this.hasEmissiveMap()){
        copyInstance.mapEmissive(this.mesh.material.uniforms.emissiveMap.value);
        copyInstance.mesh.material.uniforms.emissiveIntensity.value = this.mesh.material.uniforms.emissiveIntensity.value;
        copyInstance.mesh.material.uniforms.emissiveColor.value = new THREE.Color().copy(this.mesh.material.uniforms.emissiveColor.value);
      }
    }
    copyInstance.updateOpacity(this.mesh.material.uniforms.alpha.value);
    if (this.hasTexture()){
      for (var ix = 0; ix<this.mesh.material.uniforms.textureMatrix.value.elements.length; ix++){
        copyInstance.mesh.material.uniforms.textureMatrix.value.elements[ix] = this.mesh.material.uniforms.textureMatrix.value.elements[ix];
      }
    }
  }

  if (this.pivotObject){
    var pivot = copyInstance.makePivot(this.pivotOffsetX, this.pivotOffsetY, this.pivotOffsetZ);
    copyInstance.pivotObject = pivot;
    copyInstance.pivotOffsetX = this.pivotOffsetX;
    copyInstance.pivotOffsetY = this.pivotOffsetY;
    copyInstance.pivotOffsetZ = this.pivotOffsetZ;
    copyInstance.pivotRemoved = false;
  }

  copyInstance.setBlending(this.mesh.material.blending);

  if (!isHardCopy){
    copyInstance.softCopyParentName = this.name;
  }

  copyInstance.createdWithScript = fromScript;

  return copyInstance;
}

AddedObject.prototype.hasTexture = function(){
  return (
    this.hasDiffuseMap() || this.hasAOMap() || this.hasAlphaMap() || this.hasEmissiveMap() || this.hasDisplacementMap()
  );
}

AddedObject.prototype.injectMacro = function(macro, insertVertexShader, insertFragmentShader){
  if (insertVertexShader){
    this.mesh.material.vertexShader = this.mesh.material.vertexShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  if (insertFragmentShader){
    this.mesh.material.fragmentShader = this.mesh.material.fragmentShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  this.mesh.material.needsUpdate = true;
}

AddedObject.prototype.removeMacro = function(macro, removeVertexShader, removeFragmentShader){
  if (removeVertexShader){
    this.mesh.material.vertexShader = this.mesh.material.vertexShader.replace("\n#define "+macro, "");
  }
  if (removeFragmentShader){
    this.mesh.material.fragmentShader = this.mesh.material.fragmentShader.replace("\n#define "+macro, "");
  }
  this.mesh.material.needsUpdate = true;
}

AddedObject.prototype.getTextureOffsetX = function(){
  if (this.hasTexture()){
    return this.mesh.material.uniforms.textureMatrix.value.elements[6];
  }
  return 0;
}

AddedObject.prototype.getTextureOffsetY = function(){
  if (this.hasTexture()){
    return this.mesh.material.uniforms.textureMatrix.value.elements[7];
  }
  return 0;
}

AddedObject.prototype.setTextureOffsetX = function(val){
  if (this.hasTexture()){
    this.mesh.material.uniforms.textureMatrix.value.elements[6] = val;
  }
}

AddedObject.prototype.setTextureOffsetY = function(val){
  if (this.hasTexture()){
    this.mesh.material.uniforms.textureMatrix.value.elements[7] = val;
  }
}

AddedObject.prototype.getTextureRepeatX = function(){
  if (this.hasTexture()){
    return this.mesh.material.uniforms.textureMatrix.value.elements[0];
  }
  return 1;
}

AddedObject.prototype.getTextureRepeatY = function(){
  if (this.hasTexture()){
    return this.mesh.material.uniforms.textureMatrix.value.elements[4];
  }
  return 1;
}

AddedObject.prototype.setFog = function(){
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

AddedObject.prototype.removeFog = function(){
  this.removeMacro("HAS_FOG", false, true);
  this.removeMacro("HAS_SKYBOX_FOG", true, true);
  delete this.mesh.material.uniforms.fogInfo;
  delete this.mesh.material.uniforms.cubeTexture;
  delete this.mesh.material.uniforms.worldMatrix;
  delete this.mesh.material.uniforms.cameraPosition;
  this.mesh.material.needsUpdate = true;
}
var ObjectGroup = function(name, group){
  this.isObjectGroup = true;
  if (IS_WORKER_CONTEXT){
    return this;
  }
  this.name = name;
  this.group = group;

  this.rotationX = 0;
  this.rotationY = 0;
  this.rotationZ = 0;

  this.gridSystemNames = [];

  this.childObjectsByName = new Object();

  this.totalVertexCount = 0;
  this.skippedVertexCount = 0;

  this.isTransparent = false;
  for (var objName in this.group){
    var obj = this.group[objName];
    var isObjTransparent = (obj.mesh.material.uniforms.alpha.value < 1);
    if (isObjTransparent){
      this.isTransparent = true;
      break;
    }
  }
  this.isIntersectable = true;
  this.lastUpdatePosition = new THREE.Vector3();
  this.lastUpdateQuaternion = new THREE.Quaternion();
}

ObjectGroup.prototype.forceColor = function(r, g, b, a){
  if (!this.isColorizable){
    return;
  }
  if (a < 0){
    a = 0;
  }
  if (a > 1){
    a = 1;
  }
  this.mesh.material.uniforms.forcedColor.value.set(a, r, g, b);
  if (a < 1){
    this.mesh.material.transparent = true;
  }
}

ObjectGroup.prototype.resetColor = function(){
  if (!this.isColorizable){
    return;
  }
  this.mesh.material.uniforms.forcedColor.value.set(-50, 0, 0, 0);
  this.mesh.material.transparent = this.isTransparent;
}

ObjectGroup.prototype.applyAreaConfiguration = function(areaName){
  if (this.areaVisibilityConfigurations){
    var configurations = this.areaVisibilityConfigurations[areaName];
    if (!(typeof configurations == UNDEFINED)){
      this.mesh.visible = configurations;
    }else{
      this.mesh.visible = true;
    }
  }
  if (this.areaSideConfigurations){
    var configurations = this.areaSideConfigurations[areaName];
    if (!(typeof configurations == UNDEFINED)){
      if (configurations == SIDE_BOTH){
        this.mesh.material.side = THREE.DoubleSide;
      }else if (configurations == SIDE_FRONT){
        this.mesh.material.side = THREE.FrontSide;
      }else if (configurations == SIDE_BACK){
        this.mesh.material.side = THREE.BackSide;
      }
    }else{
      if (this.defaultSide){
        if (this.defaultSide == SIDE_BOTH){
          this.mesh.material.side = THREE.DoubleSide;
        }else if (this.defaultSide == SIDE_FRONT){
          this.mesh.material.side = THREE.FrontSide;
        }else if (this.defaultSide == SIDE_BACK){
          this.mesh.material.side = THREE.BackSide;
        }
      }else{
        this.mesh.material.side = THREE.DoubleSide;
      }
    }
  }
}

ObjectGroup.prototype.getSideInArea = function(areaName){
  if (this.areaSideConfigurations){
    if (!(typeof this.areaSideConfigurations[areaName] == UNDEFINED)){
      return this.areaSideConfigurations[areaName];
    }
  }
  if (this.defaultSide){
    return this.defaultSide;
  }
  return SIDE_BOTH;
}

ObjectGroup.prototype.setSideInArea = function(areaName, side){
  if (!this.areaSideConfigurations){
    this.areaSideConfigurations = new Object();
  }
  this.areaSideConfigurations[areaName] = side;
}

ObjectGroup.prototype.getVisibilityInArea = function(areaName){
  if (this.areaVisibilityConfigurations){
    if (!(typeof this.areaVisibilityConfigurations[areaName] == UNDEFINED)){
      return this.areaVisibilityConfigurations[areaName];
    }
  }
  return true;
}

ObjectGroup.prototype.setVisibilityInArea = function(areaName, isVisible){
  if (!this.areaVisibilityConfigurations){
    this.areaVisibilityConfigurations = new Object();
  }
  this.areaVisibilityConfigurations[areaName] = isVisible;
}

ObjectGroup.prototype.loadState = function(){
  this.physicsBody.position.set(
    this.state.physicsPX, this.state.physicsPY, this.state.physicsPZ
  );
  this.physicsBody.quaternion.set(
    this.state.physicsQX, this.state.physicsQY, this.state.physicsQZ, this.state.physicsQW
  );
  this.physicsBody.angularVelocity.set(
    this.state.physicsAVX, this.state.physicsAVY, this.state.physicsAVZ
  );
  this.physicsBody.velocity.set(
    this.state.physicsVX, this.state.physicsVY, this.state.physicsVZ
  );
  this.mesh.position.set(
    this.state.positionX, this.state.positionY, this.state.positionZ
  );
  this.mesh.quaternion.set(
    this.state.quaternionX, this.state.quaternionY, this.state.quaternionZ, this.state.quaternionW
  );
  if (this.pivotObject){
    delete this.pivotObject;
    delete this.pivotOffsetX;
    delete this.pivotOffsetY;
    delete this.pivotOffsetZ;
  }
  if (this.originalPivotObject){
    this.pivotObject = this.originalPivotObject;
    this.pivotOffsetX = this.originalPivotOffsetX;
    this.pivotOffsetY = this.originalPivotOffsetY;
    this.pivotOffsetZ = this.originalPivotOffsetZ;
  }
}

ObjectGroup.prototype.saveState = function(){
  this.state = new Object();
  this.state.physicsPX = this.physicsBody.position.x;
  this.state.physicsPY = this.physicsBody.position.y;
  this.state.physicsPZ = this.physicsBody.position.z;
  this.state.physicsQX = this.physicsBody.quaternion.x;
  this.state.physicsQY = this.physicsBody.quaternion.y;
  this.state.physicsQZ = this.physicsBody.quaternion.z;
  this.state.physicsQW = this.physicsBody.quaternion.w;
  this.state.physicsAVX = this.physicsBody.angularVelocity.x;
  this.state.physicsAVY = this.physicsBody.angularVelocity.y;
  this.state.physicsAVZ = this.physicsBody.angularVelocity.z;
  this.state.physicsVX = this.physicsBody.velocity.x;
  this.state.physicsVY = this.physicsBody.velocity.y;
  this.state.physicsVZ = this.physicsBody.velocity.z;
  this.state.positionX = this.mesh.position.x;
  this.state.positionY = this.mesh.position.y;
  this.state.positionZ = this.mesh.position.z;
  this.state.quaternionX = this.mesh.quaternion.x;
  this.state.quaternionY = this.mesh.quaternion.y;
  this.state.quaternionZ = this.mesh.quaternion.z;
  this.state.quaternionW = this.mesh.quaternion.w;
  if (this.pivotObject){
    this.originalPivotObject = this.pivotObject;
    this.originalPivotOffsetX = this.pivotOffsetX;
    this.originalPivotOffsetY = this.pivotOffsetY;
    this.originalPivotOffsetZ = this.pivotOffsetZ;
  }
}

ObjectGroup.prototype.areGeometriesIdentical = function(){
  var uuid = 0;
  for (var objName in this.group){
    var obj = this.group[objName];
    if (!uuid){
      uuid = this.group[objName].mesh.geometry.uuid;
    }else{
      if (uuid != this.group[objName].mesh.geometry.uuid){
        return false;
      }
    }
  }
  return true;
}

ObjectGroup.prototype.handleRenderSide = function(val){
  this.renderSide = val;
  if (val == 0){
    this.mesh.material.side = THREE.DoubleSide;
    this.defaultSide = SIDE_BOTH;
  }else if (val == 1){
    this.mesh.material.side = THREE.FrontSide;
    this.defaultSide = SIDE_FRONT;
  }else if (val == 2){
    this.mesh.material.side = THREE.BackSide;
    this.defaultSide = SIDE_BACK;
  }
}

ObjectGroup.prototype.textureCompare = function(txt1, txt2){
  if (txt1.roygbivTextureName != txt2.roygbivTextureName){
    return false;
  }
  if (txt1.roygbivTexturePackName != txt2.roygbivTexturePackName){
    return false;
  }
  if (txt1.offset.x != txt2.offset.x || txt1.offset.y != txt2.offset.y){
    return false;
  }
  if (txt1.repeat.x != txt2.repeat.x || txt1.repeat.y != txt2.repeat.y){
    return false;
  }
  if (txt1.flipX != txt2.flipX || txt1.flipY != txt2.flipY){
    return false;
  }
  if (txt1.wrapS != txt2.wrapS || txt1.wrapT != txt2.wrapT){
    return false;
  }
  return true;
}

ObjectGroup.prototype.handleTextures = function(){
  this.diffuseTexture = 0;
  this.emissiveTexture = 0;
  this.alphaTexture = 0;
  this.aoTexture = 0;
  this.displacementTexture = 0;
  var totalTextureCount = 0;
  for (var objName in this.group){
    var obj = this.group[objName];
    if (obj.hasDiffuseMap()){
      var txt = obj.mesh.material.uniforms.diffuseMap.value;
      if (!this.diffuseTexture){
        this.diffuseTexture = txt;
      }else{
        if (!this.textureCompare(this.diffuseTexture, txt)){
          throw new Error("Cannot merge objects with different texture properties.");
          return;
        }
      }
    }
    if (obj.hasEmissiveMap()){
      var txt = obj.mesh.material.uniforms.emissiveMap.value;
      if (!this.emissiveTexture){
        this.emissiveTexture = txt;
      }else{
        if (!this.textureCompare(this.emissiveTexture, txt)){
          throw new Error("Cannot merge objects with different texture properties.");
          return;
        }
      }
    }
    if (obj.hasAlphaMap()){
      var txt = obj.mesh.material.uniforms.alphaMap.value;
      if (!this.alphaTexture){
        this.alphaTexture = txt;
      }else{
        if (!this.textureCompare(this.alphaTexture, txt)){
          throw new Error("Cannot merge objects with different texture properties.");
          return;
        }
      }
    }
    if (obj.hasAOMap()){
      var txt = obj.mesh.material.uniforms.aoMap.value;
      if (!this.aoTexture){
        this.aoTexture = txt;
      }else{
        if (!this.textureCompare(this.aoTexture, txt)){
          throw new Error("Cannot merge objects with different texture properties.");
          return;
        }
      }
    }
    if (obj.hasDisplacementMap() && VERTEX_SHADER_TEXTURE_FETCH_SUPPORTED){
      var txt = obj.mesh.material.uniforms.displacementMap.value;
      if (!this.displacementTexture){
        this.displacementTexture = txt;
      }else{
        if (!this.textureCompare(this.displacementTexture, txt)){
          throw new Error("Cannot merge objects with different texture properties.");
          return;
        }
      }
    }
  }
  this.hasTexture = (this.diffuseTexture != 0) ||
                    (this.emissiveTexture != 0)  ||
                    (this.alphaTexture != 0) ||
                    (this.aoTexture != 0) ||
                    (this.displacementTexture != 0);
}

ObjectGroup.prototype.push = function(array, value, index, isIndexed){
  if (!isIndexed){
    array.push(value);
  }else{
    array[index] = value;
  }
}

ObjectGroup.prototype.mergeInstanced = function(){
  this.isInstanced = true;
  var refGeometry;
  for (var objName in this.group){
    refGeometry = this.group[objName].mesh.geometry;
    break;
  }
  this.geometry = new THREE.InstancedBufferGeometry();

  this.geometry.setIndex(refGeometry.index);

  var positionOffsets = [], quaternions = [], alphas = [], colors = [], textureInfos = [],
      emissiveIntensities = [], emissiveColors = [], aoIntensities = [], displacementInfos = [],
      textureMatrixInfos = [];
  var count = 0;
  for (var objName in this.group){
    var obj = this.group[objName];
    positionOffsets.push(obj.mesh.position.x);
    positionOffsets.push(obj.mesh.position.y);
    positionOffsets.push(obj.mesh.position.z);
    quaternions.push(obj.mesh.quaternion.x);
    quaternions.push(obj.mesh.quaternion.y);
    quaternions.push(obj.mesh.quaternion.z);
    quaternions.push(obj.mesh.quaternion.w);
    alphas.push(obj.mesh.material.uniforms.alpha.value);
    colors.push(obj.material.color.r);
    colors.push(obj.material.color.g);
    colors.push(obj.material.color.b);
    if (this.emissiveTexture){
      if (obj.hasEmissiveMap()){
        emissiveIntensities.push(obj.mesh.material.uniforms.emissiveIntensity.value);
        emissiveColors.push(obj.mesh.material.uniforms.emissiveColor.value.r);
        emissiveColors.push(obj.mesh.material.uniforms.emissiveColor.value.g);
        emissiveColors.push(obj.mesh.material.uniforms.emissiveColor.value.b);
      }else{
        emissiveIntensities.push(1);
        emissiveColors.push(1);
        emissiveColors.push(1);
        emissiveColors.push(1);
      }
    }
    if (this.aoTexture){
      if (obj.hasAOMap()){
        aoIntensities.push(obj.mesh.material.uniforms.aoIntensity.value);
      }else{
        aoIntensities.push(1);
      }
    }
    if (this.hasTexture){
      if (obj.hasTexture()){
        textureMatrixInfos.push(obj.getTextureOffsetX());
        textureMatrixInfos.push(obj.getTextureOffsetY());
        textureMatrixInfos.push(obj.getTextureRepeatX());
        textureMatrixInfos.push(obj.getTextureRepeatY());
      }else{
        textureMatrixInfos.push(0);
        textureMatrixInfos.push(0);
        textureMatrixInfos.push(0);
        textureMatrixInfos.push(0);
      }
      if (obj.hasDiffuseMap()){
        textureInfos.push(10);
      }else{
        textureInfos.push(-10);
      }
      if (obj.hasEmissiveMap()){
        textureInfos.push(10);
      }else{
        textureInfos.push(-10);
      }
      if (obj.hasAlphaMap()){
        textureInfos.push(10);
      }else{
        textureInfos.push(-10);
      }
      if (obj.hasAOMap()){
        textureInfos.push(10);
      }else{
        textureInfos.push(-10);
      }
      if (obj.hasDisplacementMap()){
        displacementInfos.push(obj.mesh.material.uniforms.displacementInfo.value.x);
        displacementInfos.push(obj.mesh.material.uniforms.displacementInfo.value.y);
      }else{
        displacementInfos.push(-100);
        displacementInfos.push(-100);
      }
    }
    count ++;
  }

  this.geometry.maxInstancedCount = count;

  var positionOffsetBufferAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(positionOffsets), 3
  );
  var quaternionsBufferAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(quaternions), 4
  );
  var alphaBufferAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(alphas), 1
  );
  var colorBufferAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(colors) , 3
  );
  var textureInfoBufferAttribute;
  var textureMatrixInfosBufferAttribute;
  var emissiveIntensityBufferAttribute;
  var emissiveColorBufferAttribute;
  var aoIntensityBufferAttribute;
  var displacementInfoBufferAttribute;
  if (this.hasTexture){
    textureInfoBufferAttribute = new THREE.InstancedBufferAttribute(
      new Int16Array(textureInfos), 4
    );
    textureMatrixInfosBufferAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(textureMatrixInfos), 4
    );
    textureInfoBufferAttribute.setDynamic(false);
    textureMatrixInfosBufferAttribute.setDynamic(false);
    this.geometry.addAttribute("textureInfo", textureInfoBufferAttribute);
    this.geometry.addAttribute("textureMatrixInfo", textureMatrixInfosBufferAttribute);
    this.geometry.addAttribute("uv", refGeometry.attributes.uv);
  }
  if (this.emissiveTexture){
    emissiveIntensityBufferAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(emissiveIntensities), 1
    );
    emissiveColorBufferAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(emissiveColors), 3
    );
    emissiveIntensityBufferAttribute.setDynamic(false);
    emissiveColorBufferAttribute.setDynamic(false);
    this.geometry.addAttribute("emissiveIntensity", emissiveIntensityBufferAttribute);
    this.geometry.addAttribute("emissiveColor", emissiveColorBufferAttribute);
  }
  if (this.aoTexture){
    aoIntensityBufferAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(aoIntensities), 1
    );
    aoIntensityBufferAttribute.setDynamic(false);
    this.geometry.addAttribute("aoIntensity", aoIntensityBufferAttribute);
  }
  if (this.displacementTexture){
    displacementInfoBufferAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(displacementInfos), 2
    );
    displacementInfoBufferAttribute.setDynamic(false);
    this.geometry.addAttribute("displacementInfo", displacementInfoBufferAttribute);
    this.geometry.addAttribute("normal", refGeometry.attributes.normal);
  }

  positionOffsetBufferAttribute.setDynamic(false);
  quaternionsBufferAttribute.setDynamic(false);
  alphaBufferAttribute.setDynamic(false);
  colorBufferAttribute.setDynamic(false);

  this.geometry.addAttribute("positionOffset", positionOffsetBufferAttribute);
  this.geometry.addAttribute("quaternion", quaternionsBufferAttribute);
  this.geometry.addAttribute("alpha", alphaBufferAttribute);
  this.geometry.addAttribute("color", colorBufferAttribute);
  this.geometry.addAttribute("position", refGeometry.attributes.position);

}

ObjectGroup.prototype.merge = function(){

  this.handleTextures();

  if (this.areGeometriesIdentical() && INSTANCING_SUPPORTED){
    this.mergeInstanced();
    return;
  }

  this.geometry = new THREE.BufferGeometry();
  var pseudoGeometry = new THREE.Geometry();

  var isIndexed = true;

  var miMap = new Object();
  var mi = 0;
  for (var childName in this.group){
    var childObj = this.group[childName];
    if (childObj.type == "box" || childObj.type == "sphere" || childObj.type == "cylinder"){
      isIndexed = false;
    }
    var childGeom = childObj.getNormalGeometry();
    miMap[mi] = childObj.name;
    for (var i = 0; i<childGeom.faces.length; i++){
      childGeom.faces[i].materialIndex = mi;
    }
    mi++;
    childObj.mesh.updateMatrix();
    pseudoGeometry.merge(childGeom, childObj.mesh.matrix);
  }

  this.isIndexed = isIndexed;

  var max = 0;
  var indexCache;
  var faces = pseudoGeometry.faces;
  var indexCache;
  if (isIndexed){
    indexCache = new Object();
    for (var i = 0; i<faces.length; i++){
      var face = faces[i];
      var a = face.a;
      var b = face.b;
      var c = face.c;
      if (a > max){
        max = a;
      }
      if (b > max){
        max = b;
      }
      if (c > max){
        max = c;
      }
    }
  }

  var indices = [];
  var vertices = pseudoGeometry.vertices;
  var faceVertexUVs = pseudoGeometry.faceVertexUvs[0];
  var positions, normals, colors, uvs, alphas, emissiveIntensities, emissiveColors, aoIntensities,
            displacementInfos, textureInfos, textureMatrixInfos;
  if (max > 0){
    positions = new Array((max + 1) * 3);
    colors = new Array((max + 1) * 3);
    alphas = new Array(max + 1);
    if (this.displacementTexture){
      normals = new Array((max + 1) * 3);
      displacementInfos = new Array((max + 1) * 2);
    }
    if (this.hasTexture){
      uvs = new Array((max + 1) * 2);
      textureInfos = new Array((max + 1) * 4);
      textureMatrixInfos = new Array((max + 1) * 4);
    }
    if (this.emissiveTexture){
      emissiveIntensities = new Array(max + 1);
      emissiveColors = new Array((max + 1) * 3);
    }
    if (this.aoTexture){
      aoIntensities = new Array(max + 1);
    }
  }else{
    positions = [];
    colors = [];
    alphas = [];
    if (this.displacementTexture){
      normals = [];
      displacementInfos = [];
    }
    if (this.hasTexture){
      uvs = [];
      textureInfos = [];
      textureMatrixInfos = [];
    }
    if (this.emissiveTexture){
      emissiveIntensities = [];
      emissiveColors = [];
    }
    if (this.aoTexture){
      aoIntensities = [];
    }
  }
  for (var i = 0; i<faces.length; i++){
    var face = faces[i];
    var addedObject = addedObjects[miMap[face.materialIndex]];
    var a = face.a;
    var b = face.b;
    var c = face.c;

    var aSkipped = false;
    var bSkipped = false;
    var cSkipped = false;
    if (isIndexed){
      indices.push(a);
      indices.push(b);
      indices.push(c);
      if (indexCache[a]){
        aSkipped = true;
        this.skippedVertexCount ++;
      }else{
        indexCache[a] = true;
      }
      if (indexCache[b]){
        bSkipped = true;
        this.skippedVertexCount ++;
      }else{
        indexCache[b] = true;
      }
      if (indexCache[c]){
        cSkipped = true;
        this.skippedVertexCount ++;
      }else{
        indexCache[c] = true;
      }
    }

    var vertex1 = vertices[a];
    var vertex2 = vertices[b];
    var vertex3 = vertices[c];
    var vertexNormals = face.vertexNormals;
    var vertexNormal1 = vertexNormals[0];
    var vertexNormal2 = vertexNormals[1];
    var vertexNormal3 = vertexNormals[2];
    var color = addedObject.material.color;
    var uv1 = faceVertexUVs[i][0];
    var uv2 = faceVertexUVs[i][1];
    var uv3 = faceVertexUVs[i][2];
    // POSITIONS
    if (!aSkipped){
      this.push(positions, vertex1.x, (3*a), isIndexed);
      this.push(positions, vertex1.y, ((3*a) + 1), isIndexed);
      this.push(positions, vertex1.z, ((3*a) + 2), isIndexed);
    }
    if (!bSkipped){
      this.push(positions, vertex2.x, (3*b), isIndexed);
      this.push(positions, vertex2.y, ((3*b) + 1), isIndexed);
      this.push(positions, vertex2.z, ((3*b) + 2), isIndexed);
    }
    if (!cSkipped){
      this.push(positions, vertex3.x, (3*c), isIndexed);
      this.push(positions, vertex3.y, ((3*c) + 1), isIndexed);
      this.push(positions, vertex3.z, ((3*c) + 2), isIndexed);
    }
    if (this.displacementTexture){
      if (!aSkipped){
        this.push(normals, vertexNormal1.x, (3*a), isIndexed);
        this.push(normals, vertexNormal1.y, ((3*a) + 1), isIndexed);
        this.push(normals, vertexNormal1.z, ((3*a) + 2), isIndexed);
      }
      if (!bSkipped){
        this.push(normals, vertexNormal2.x, (3*b), isIndexed);
        this.push(normals, vertexNormal2.y, ((3*b) + 1), isIndexed);
        this.push(normals, vertexNormal2.z, ((3*b) + 2), isIndexed);
      }
      if (!cSkipped){
        this.push(normals, vertexNormal3.x, (3*c), isIndexed);
        this.push(normals, vertexNormal3.y, ((3*c) + 1), isIndexed);
        this.push(normals, vertexNormal3.z, ((3*c) + 2), isIndexed);
      }
    }
    // COLORS
    if (!aSkipped){
      this.push(colors, color.r, (3*a), isIndexed);
      this.push(colors, color.g, ((3*a) + 1), isIndexed);
      this.push(colors, color.b, ((3*a) + 2), isIndexed);
    }
    if (!bSkipped){
      this.push(colors, color.r, (3*b), isIndexed);
      this.push(colors, color.g, ((3*b) + 1), isIndexed);
      this.push(colors, color.b, ((3*b) + 2), isIndexed);
    }
    if (!cSkipped){
      this.push(colors, color.r, (3*c), isIndexed);
      this.push(colors, color.g, ((3*c) + 1), isIndexed);
      this.push(colors, color.b, ((3*c) + 2), isIndexed);
    }
    // UV
    if (this.hasTexture){
      if (!aSkipped){
        this.push(uvs, uv1.x, (2*a), isIndexed);
        this.push(uvs, uv1.y, ((2*a) + 1), isIndexed);
      }
      if (!bSkipped){
        this.push(uvs, uv2.x, (2*b), isIndexed);
        this.push(uvs, uv2.y, ((2*b) + 1), isIndexed);
      }
      if (!cSkipped){
        this.push(uvs, uv3.x, (2*c), isIndexed);
        this.push(uvs, uv3.y, ((2*c) + 1), isIndexed);
      }
    }
    // DISPLACEMENT INFOS
    if (this.displacementTexture){
      if (!aSkipped){
        if (addedObject.hasDisplacementMap()){
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.x,
            (2*a),
            isIndexed
          );
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.y,
            ((2*a) + 1),
            isIndexed
          );
        }else{
          this.push(displacementInfos, -100, (2*a), isIndexed);
          this.push(displacementInfos, -100, ((2*a) + 1), isIndexed);
        }
      }
      if (!bSkipped){
        if (addedObject.hasDisplacementMap()){
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.x,
            (2*b),
            isIndexed
          );
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.y,
            ((2*b) + 1),
            isIndexed
          );
        }else{
          this.push(displacementInfos, -100, (2*b), isIndexed);
          this.push(displacementInfos, -100, ((2*b) + 1), isIndexed);
        }
      }
      if (!cSkipped){
        if (addedObject.hasDisplacementMap()){
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.x,
            (2*c),
            isIndexed
          );
          this.push(
            displacementInfos,
            addedObject.mesh.material.uniforms.displacementInfo.value.y,
            ((2*c) + 1),
            isIndexed
          );
        }else{
          this.push(displacementInfos, -100, (2*c), isIndexed);
          this.push(displacementInfos, -100, ((2*c) + 1), isIndexed);
        }
      }
    }
    // ALPHA
    var alpha = addedObject.mesh.material.uniforms.alpha.value;
    if (!aSkipped){
      this.push(alphas, alpha, a, isIndexed);
    }
    if (!bSkipped){
      this.push(alphas, alpha, b, isIndexed);
    }
    if (!cSkipped){
      this.push(alphas, alpha, c, isIndexed);
    }
    // EMISSIVE INTENSITY AND EMISSIVE COLOR
    if (this.emissiveTexture){
      var emissiveIntensity;
      if (addedObject.hasEmissiveMap()){
        emissiveIntensity = addedObject.mesh.material.uniforms.emissiveIntensity.value;
      }else{
        emissiveIntensity = 0;
      }
      if (!aSkipped){
        this.push(emissiveIntensities, emissiveIntensity, a, isIndexed);
      }
      if (!bSkipped){
        this.push(emissiveIntensities, emissiveIntensity, b, isIndexed);
      }
      if (!cSkipped){
        this.push(emissiveIntensities, emissiveIntensity, c, isIndexed);
      }
      var emissiveColor;
      if (addedObject.hasEmissiveMap()){
        emissiveColor = addedObject.mesh.material.uniforms.emissiveColor.value;
      }else{
        emissiveColor = WHITE_COLOR;
      }
      if (!aSkipped){
        this.push(emissiveColors, emissiveColor.r, (3*a), isIndexed);
        this.push(emissiveColors, emissiveColor.g, ((3*a) + 1), isIndexed);
        this.push(emissiveColors, emissiveColor.b, ((3*a) + 2), isIndexed);
      }
      if (!bSkipped){
        this.push(emissiveColors, emissiveColor.r, (3*b), isIndexed);
        this.push(emissiveColors, emissiveColor.g, ((3*b) + 1), isIndexed);
        this.push(emissiveColors, emissiveColor.b, ((3*b) + 2), isIndexed);
      }
      if (!cSkipped){
        this.push(emissiveColors, emissiveColor.r, (3*c), isIndexed);
        this.push(emissiveColors, emissiveColor.g, ((3*c) + 1), isIndexed);
        this.push(emissiveColors, emissiveColor.b, ((3*c) + 2), isIndexed);
      }
    }
    // AO INTENSITY
    if (this.aoTexture){
      var aoIntensity;
      if (addedObject.hasAOMap()){
        aoIntensity = addedObject.mesh.material.uniforms.aoIntensity.value;
      }else{
        aoIntensity = 0;
      }
      if (!aSkipped){
        this.push(aoIntensities, aoIntensity, a, isIndexed);
      }
      if (!bSkipped){
        this.push(aoIntensities, aoIntensity, b, isIndexed);
      }
      if (!cSkipped){
        this.push(aoIntensities, aoIntensity, c, isIndexed);
      }
    }
    // TEXTURE INFOS AND TEXTURE MATRIX INFOS
    if (this.hasTexture){
      if (!aSkipped){
        if (addedObject.hasDiffuseMap()){
          this.push(textureInfos, 10, (4*a), isIndexed);
        }else{
          this.push(textureInfos, -10, (4*a), isIndexed);
        }
        if (addedObject.hasEmissiveMap()){
          this.push(textureInfos, 10, ((4*a) + 1), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*a) + 1), isIndexed);
        }
        if (addedObject.hasAlphaMap()){
          this.push(textureInfos, 10, ((4*a) + 2), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*a) + 2), isIndexed);
        }
        if (addedObject.hasAOMap()){
          this.push(textureInfos, 10, ((4*a) + 3), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*a) + 3), isIndexed);
        }
      }
      if (!bSkipped){
        if (addedObject.hasDiffuseMap()){
          this.push(textureInfos, 10, (4*b), isIndexed);
        }else{
          this.push(textureInfos, -10, (4*b), isIndexed);
        }
        if (addedObject.hasEmissiveMap()){
          this.push(textureInfos, 10, ((4*b) + 1), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*b) + 1), isIndexed);
        }
        if (addedObject.hasAlphaMap()){
          this.push(textureInfos, 10, ((4*b) + 2), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*b) + 2), isIndexed);
        }
        if (addedObject.hasAOMap()){
          this.push(textureInfos, 10, ((4*b) + 3), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*b) + 3), isIndexed);
        }
      }
      if (!cSkipped){
        if (addedObject.hasDiffuseMap()){
          this.push(textureInfos, 10, (4*c), isIndexed);
        }else{
          this.push(textureInfos, -10, (4*c), isIndexed);
        }
        if (addedObject.hasEmissiveMap()){
          this.push(textureInfos, 10, ((4*c) + 1), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*c) + 1), isIndexed);
        }
        if (addedObject.hasAlphaMap()){
          this.push(textureInfos, 10, ((4*c) + 2), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*c) + 2), isIndexed);
        }
        if (addedObject.hasAOMap()){
          this.push(textureInfos, 10, ((4*c) + 3), isIndexed);
        }else{
          this.push(textureInfos, -10, ((4*c) + 3), isIndexed);
        }
      }
      if (!aSkipped){
        if (addedObject.hasTexture()){
          this.push(textureMatrixInfos, addedObject.getTextureOffsetX(), (4*a), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureOffsetY(), ((4*a) + 1), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatX(), ((4*a) + 2), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatY(), ((4*a) + 3), isIndexed);
        }else{
          this.push(textureMatrixInfos, 0, (4*a), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*a) + 1), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*a) + 2), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*a) + 3), isIndexed);
        }
      }
      if (!bSkipped){
        if (addedObject.hasTexture()){
          this.push(textureMatrixInfos, addedObject.getTextureOffsetX(), (4*b), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureOffsetY(), ((4*b) + 1), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatX(), ((4*b) + 2), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatY(), ((4*b) + 3), isIndexed);
        }else{
          this.push(textureMatrixInfos, 0, (4*b), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*b) + 1), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*b) + 2), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*b) + 3), isIndexed);
        }
      }
      if (!cSkipped){
        if (addedObject.hasTexture()){
          this.push(textureMatrixInfos, addedObject.getTextureOffsetX(), (4*c), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureOffsetY(), ((4*c) + 1), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatX(), ((4*c) + 2), isIndexed);
          this.push(textureMatrixInfos, addedObject.getTextureRepeatY(), ((4*c) + 3), isIndexed);
        }else{
          this.push(textureMatrixInfos, 0, (4*c), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*c) + 1), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*c) + 2), isIndexed);
          this.push(textureMatrixInfos, 0, ((4*c) + 3), isIndexed);
        }
      }
    }
  }

  var positionsTypedArray = new Float32Array(positions);
  var colorsTypedArray = new Float32Array(colors);
  var alphasTypedArray = new Float32Array(alphas);

  if (this.displacementTexture){
    var normalsTypedArray = new Float32Array(normals);
    var displacementInfosTypedArray = new Float32Array(displacementInfos);
    var normalsBufferAttribute = new THREE.BufferAttribute(normalsTypedArray, 3);
    var displacementInfosBufferAttribute = new THREE.BufferAttribute(displacementInfosTypedArray, 2);
    normalsBufferAttribute.setDynamic(false);
    displacementInfosBufferAttribute.setDynamic(false);
    this.geometry.addAttribute('normal', normalsBufferAttribute);
    this.geometry.addAttribute('displacementInfo', displacementInfosBufferAttribute);
  }
  if (this.hasTexture){
    var uvsTypedArray = new Float32Array(uvs);
    var textureInfosTypedArray = new Int8Array(textureInfos);
    var textureMatrixInfosTypedArray = new Float32Array(textureMatrixInfos);
    var uvsBufferAttribute = new THREE.BufferAttribute(uvsTypedArray, 2);
    var textureInfosBufferAttribute = new THREE.BufferAttribute(textureInfosTypedArray, 4);
    var textureMatrixInfosBufferAttribute = new THREE.BufferAttribute(textureMatrixInfosTypedArray, 4);
    uvsBufferAttribute.setDynamic(false);
    textureInfosBufferAttribute.setDynamic(false);
    textureMatrixInfosBufferAttribute.setDynamic(false);
    this.geometry.addAttribute('uv', uvsBufferAttribute);
    this.geometry.addAttribute('textureInfo', textureInfosBufferAttribute);
    this.geometry.addAttribute('textureMatrixInfo', textureMatrixInfosBufferAttribute);
  }
  if (this.emissiveTexture){
    var emissiveIntensitiesTypedArray = new Float32Array(emissiveIntensities);
    var emissiveColorsTypedArray = new Float32Array(emissiveColors);
    var emissiveIntensitiesBufferAttribute = new THREE.BufferAttribute(emissiveIntensitiesTypedArray, 1);
    var emissiveColorsBufferAttribute = new THREE.BufferAttribute(emissiveColorsTypedArray, 3);
    emissiveIntensitiesBufferAttribute.setDynamic(false);
    emissiveColorsBufferAttribute.setDynamic(false);
    this.geometry.addAttribute('emissiveIntensity', emissiveIntensitiesBufferAttribute);
    this.geometry.addAttribute('emissiveColor', emissiveColorsBufferAttribute);
  }
  if (this.aoTexture){
    var aoIntensitiesTypedArray = new Float32Array(aoIntensities);
    var aoIntensitiesBufferAttribute = new THREE.BufferAttribute(aoIntensitiesTypedArray, 1);
    aoIntensitiesBufferAttribute.setDynamic(false);
    this.geometry.addAttribute('aoIntensity', aoIntensitiesBufferAttribute);
  }

  var positionsBufferAttribute = new THREE.BufferAttribute(positionsTypedArray, 3);
  var colorsBufferAttribute = new THREE.BufferAttribute(colorsTypedArray, 3);
  var alphasBufferAttribute = new THREE.BufferAttribute(alphasTypedArray, 1);

  positionsBufferAttribute.setDynamic(false);
  colorsBufferAttribute.setDynamic(false);
  alphasBufferAttribute.setDynamic(false);

  if (isIndexed){
    var indicesTypedArray = new Uint16Array(indices);
    var indicesBufferAttribute = new THREE.BufferAttribute(indicesTypedArray, 1);
    indicesBufferAttribute.setDynamic(false);
    this.geometry.setIndex(indicesBufferAttribute);
  }

  this.geometry.addAttribute('position', positionsBufferAttribute);
  this.geometry.addAttribute('color', colorsBufferAttribute);
  this.geometry.addAttribute('alpha', alphasBufferAttribute);

  pseudoGeometry = null;
}

ObjectGroup.prototype.glue = function(){
  var group = this.group;
  var physicsMaterial = new CANNON.Material();
  var physicsBody = new CANNON.Body({mass: 0, material: physicsMaterial});
  var centerPosition = this.getInitialCenter();
  var graphicsGroup = new THREE.Group();
  var centerX = centerPosition.x;
  var centerY = centerPosition.y;
  var centerZ = centerPosition.z;
  var referenceVector = new CANNON.Vec3(
    centerX, centerY, centerZ
  );
  var referenceVectorTHREE = new THREE.Vector3(
    centerX, centerY, centerZ
  );

  physicsBody.position = referenceVector;
  graphicsGroup.position.copy(physicsBody.position);

  var gridSystemNamesMap = new Object();

  var hasAnyPhysicsShape = false;
  for (var objectName in group){
    var addedObject = group[objectName];
    addedObject.setAttachedProperties();

    this.totalVertexCount += addedObject.mesh.geometry.attributes.position.count;
    // GLUE PHYSICS ************************************************
    if (!addedObject.noMass){
      var shape = addedObject.physicsBody.shapes[0];
      physicsBody.addShape(shape, addedObject.physicsBody.position.vsub(referenceVector), addedObject.physicsBody.quaternion);
      hasAnyPhysicsShape = true;
    }
    // GLUE GRAPHICS ***********************************************
    addedObject.mesh.position.sub(referenceVectorTHREE);
    graphicsGroup.add(addedObject.mesh);
    // PREPARE GRAPHICS FOR CLICK EVENTS ***************************
    addedObject.mesh.addedObject = 0;
    addedObject.mesh.objectGroupName = this.name;
    // TO MANAGE CLICK EVENTS
    if (addedObject.destroyedGrids){
      for (var gridName in addedObject.destroyedGrids){
        addedObject.destroyedGrids[gridName].destroyedObjectGroup = this.name;
      }
    }
    // THESE ARE USEFUL FOR SCRIPTING
    addedObject.parentObjectName = this.name;
    this.childObjectsByName[addedObject.name] = addedObject;
    // THESE ARE NECESSARY FOR BVHANDLER
    gridSystemNamesMap[addedObject.metaData.gridSystemName] = true;
    addedObjectsInsideGroups[addedObject.name] = addedObject;
    addedObject.indexInParent = graphicsGroup.children.length - 1;

  }

  this.gridSystemNames = Object.keys(gridSystemNamesMap);

  physicsBody.addedObject = this;

  this.merge();
  this.destroyParts();
  var meshGenerator = new MeshGenerator(this.geometry);
  if (!this.isInstanced){
    this.mesh = meshGenerator.generateMergedMesh(graphicsGroup, this);
  }else{
    this.mesh = meshGenerator.generateInstancedMesh(graphicsGroup, this);
    this.mesh.frustumCulled = false;
  }
  webglCallbackHandler.registerEngineObject(this);
  if (this.aoTexture){
    this.injectMacro("HAS_AO", true, true);
  }
  if (this.emissiveTexture){
    this.injectMacro("HAS_EMISSIVE", true, true);
  }
  if (this.diffuseTexture){
    this.injectMacro("HAS_DIFFUSE", true, true);
  }
  if (this.alphaTexture){
    this.injectMacro("HAS_ALPHA", true, true);
  }
  if (this.displacementTexture && VERTEX_SHADER_TEXTURE_FETCH_SUPPORTED){
    this.injectMacro("HAS_DISPLACEMENT", true, false);
  }
  if (this.hasTexture){
    this.injectMacro("HAS_TEXTURE", true, true);
  }

  this.mesh.objectGroupName = this.name;
  scene.add(this.mesh);
  if (hasAnyPhysicsShape){
    physicsWorld.addBody(physicsBody);
  }else{
    this.noMass = true;
    this.cannotSetMass = true;
  }

  this.graphicsGroup = graphicsGroup;

  this.graphicsGroup.position.copy(this.mesh.position);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.updateMatrix();

  this.physicsBody = physicsBody;
  this.initQuaternion = this.graphicsGroup.quaternion.clone();

  this.collisionCallbackFunction = function(collisionEvent){
    if (!collisionEvent.body.addedObject || (!this.isVisibleOnThePreviewScene() && !this.physicsKeptWhenHidden)){
      return;
    }
    var targetObjectName = collisionEvent.target.addedObject.name;
    var contact = collisionEvent.contact;
    var collisionPosition = new Object();
    var collisionImpact = contact.getImpactVelocityAlongNormal();
    collisionPosition.x = contact.bi.position.x + contact.ri.x;
    collisionPosition.y = contact.bi.position.y + contact.ri.y;
    collisionPosition.z = contact.bi.position.z + contact.ri.z;
    var quatX = this.mesh.quaternion.x;
    var quatY = this.mesh.quaternion.y;
    var quatZ = this.mesh.quaternion.z;
    var quatW = this.mesh.quaternion.w;
    var collisionInfo = reusableCollisionInfo.set(
      targetObjectName,
      collisionPosition.x,
      collisionPosition.y,
      collisionPosition.z,
      collisionImpact,
      quatX,
      quatY,
      quatZ,
      quatW
    );
    var curCollisionCallbackRequest = collisionCallbackRequests[this.name];
    if (curCollisionCallbackRequest){
      curCollisionCallbackRequest(collisionInfo);
    }
  };

  this.physicsBody.addEventListener(
    "collide",
    this.collisionCallbackFunction.bind(this)
  );

  this.gridSystemName = this.group[Object.keys(this.group)[0]].metaData.gridSystemName;
}

ObjectGroup.prototype.destroyParts = function(){
  for (var objName in this.group){
    var addedObject = addedObjects[objName];
    if (addedObject){
      addedObject.destroy(true);
      delete addedObjects[objName];
      disabledObjectNames[objName] = 1;
    }
  }
}

ObjectGroup.prototype.detach = function(){
  this.graphicsGroup.position.copy(this.mesh.position);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.updateMatrixWorld();
  var worldQuaternions = new Object();
  var worldPositions = new Object();
  var previewSceneWorldPositions = new Object();
  var previewSceneWorldQuaternions = new Object();
  var physicsQuaternions = new Object();
  for (var objectName in this.group){
    if (mode == 0){
      worldQuaternions[objectName] = this.group[objectName].mesh.getWorldQuaternion(REUSABLE_QUATERNION);
      worldQuaternions[objectName] = REUSABLE_QUATERNION.clone();
      this.group[objectName].mesh.getWorldPosition(REUSABLE_VECTOR);
      worldPositions[objectName] = REUSABLE_VECTOR.clone();
    }else if (mode == 1){
      this.group[objectName].mesh.getWorldQuaternion(REUSABLE_QUATERNION);
      worldQuaternions[objectName] = REUSABLE_QUATERNION.clone();
      this.group[objectName].mesh.getWorldPosition(REUSABLE_VECTOR);
      worldPositions[objectName] = REUSABLE_VECTOR.clone();
    }
    if (this.physicsBody.initQuaternion instanceof THREE.Quaternion){
      this.physicsBody.initQuaternion = new CANNON.Quaternion().copy(this.physicsBody.initQuaternion);
    }
    if (this.physicsBody.initQuaternion.x == 0 && this.physicsBody.initQuaternion.y == 0 &&
              this.physicsBody.initQuaternion.z == 0 && this.physicsBody.initQuaternion.w == 1){
        if (this.group[objectName].type != "ramp"){
          physicsQuaternions[objectName] = this.group[objectName].physicsBody.initQuaternion;
        }else{
          physicsQuaternions[objectName] = this.physicsBody.initQuaternion;
        }
    }else{
      if (this.group[objectName].type != "ramp"){
        var cloneQuaternion = new CANNON.Quaternion().copy(this.physicsBody.initQuaternion);
        physicsQuaternions[objectName] = cloneQuaternion.mult(this.group[objectName].physicsBody.initQuaternion);
      }else{
        physicsQuaternions[objectName] = this.physicsBody.initQuaternion;
      }
    }
  }
  for (var i = this.graphicsGroup.children.length -1; i>=0; i--){
    this.graphicsGroup.remove(this.graphicsGroup.children[i]);
  }

  this.destroy(true);
  for (var objectName in this.group){
    var addedObject = this.group[objectName];

    if (!addedObject.noMass){
      physicsWorld.add(addedObject.physicsBody);
    }
    scene.add(addedObject.mesh);

    addedObject.mesh.objectGroupName = 0;
    addedObject.mesh.addedObject = addedObject;

    addedObjects[objectName] = addedObject;

    if (addedObject.destroyedGrids){
      for (var gridName in addedObject.destroyedGrids){
        addedObject.destroyedGrids[gridName].destroyedAddedObject = addedObject.name;
      }
    }
    delete addedObject.parentObjectName;
    delete addedObjectsInsideGroups[addedObject.name];
    delete addedObject.indexInParent;

    addedObject.mesh.position.set(
      addedObject.positionXWhenAttached,
      addedObject.positionYWhenAttached,
      addedObject.positionZWhenAttached
    );
    addedObject.physicsBody.position.set(
      addedObject.positionXWhenAttached,
      addedObject.positionYWhenAttached,
      addedObject.positionZWhenAttached
    );
    addedObject.physicsBody.initPosition.copy(addedObject.physicsBody.position);
    addedObject.mesh.quaternion.set(
      addedObject.qxWhenAttached,
      addedObject.qyWhenAttached,
      addedObject.qzWhenAttached,
      addedObject.qwWhenAttached
    );
    addedObject.physicsBody.quaternion.set(
      addedObject.pqxWhenAttached,
      addedObject.pqyWhenAttached,
      addedObject.pqzWhenAttached,
      addedObject.pqwWhenAttached
    );
    addedObject.physicsBody.initQuaternion.copy(addedObject.physicsBody.quaternion);

    delete addedObject.positionXWhenAttached;
    delete addedObject.positionYWhenAttached;
    delete addedObject.positionZWhenAttached;
    delete addedObject.qxWhenAttached;
    delete addedObject.qyWhenAttached;
    delete addedObjects.qzWhenAttached;
    delete addedObject.qwWhenAttached;
    delete addedObject.pqxWhenAttached;
    delete addedObject.pqyWhenAttached;
    delete addedObject.pqzWhenAttached;
    delete addedObject.pqwWhenAttached;

  }

}

ObjectGroup.prototype.setQuaternion = function(axis, val){
  if (axis == "x"){
    this.graphicsGroup.quaternion.x = val;
    this.physicsBody.quaternion.x = val;
    this.initQuaternion.x = val;
    this.physicsBody.initQuaternion.x = val;
    this.mesh.quaternion.x = val;
  }else if (axis == "y"){
    this.graphicsGroup.quaternion.y = val;

    this.physicsBody.quaternion.y = val;
    this.initQuaternion.y = val;
    this.physicsBody.initQuaternion.y = val;
    this.mesh.quaternion.y = val;
  }else if (axis == "z"){
    this.graphicsGroup.quaternion.z = val;
    this.physicsBody.quaternion.z = val;
    this.initQuaternion.z = val;
    this.physicsBody.initQuaternion.z = val;
    this.mesh.quaternion.z = val;
  }else if (axis == "w"){
    this.graphicsGroup.quaternion.w = val;
    this.physicsBody.quaternion.w = val;
    this.initQuaternion.w = val;
    this.physicsBody.initQuaternion.w = val;
    this.mesh.quaternion.w = val;
  }
}

ObjectGroup.prototype.rotate = function(axis, radian, fromScript){
  if (axis == "x"){
    this.mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_X,
      radian
    );
  }else if (axis == "y"){
    this.mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Y,
      radian
    );
  }else if (axis == "z"){
    this.mesh.rotateOnWorldAxis(
      THREE_AXIS_VECTOR_Z,
      radian
    );
  }

  this.physicsBody.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);

  if (!fromScript){
    this.initQuaternion = this.mesh.quaternion.clone();
    this.physicsBody.initQuaternion.copy(
      this.physicsBody.quaternion
    );
    if (axis == "x"){
      this.rotationX += radian;
    }else if (axis == "y"){
      this.rotationY += radian;
    }else if (axis == "z"){
      this.rotationZ += radian;
    }
  }

  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }

}

ObjectGroup.prototype.translate = function(axis, amount, fromScript){
  var physicsBody = this.physicsBody;
  if (axis == "x"){
    this.mesh.translateX(amount);
  }else if (axis == "y"){
    this.mesh.translateY(amount);
  }else if (axis == "z"){
    this.mesh.translateZ(amount);
  }
  physicsBody.position.copy(this.mesh.position);
  this.graphicsGroup.position.copy(this.mesh.position);
  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }
}

ObjectGroup.prototype.destroy = function(isUndo){
  this.removeBoundingBoxesFromScene();
  scene.remove(this.mesh);
  physicsWorld.remove(this.physicsBody);
  for (var name in this.group){
    var childObj= this.group[name];
    if (childObj.destroyedGrids){
      for (var gridName in childObj.destroyedGrids){
        if (!isUndo){
          delete childObj.destroyedGrids[gridName].destroyedAddedObject;
        }else{
          childObj.destroyedGrids[gridName].destroyedAddedObject = childObj.name;
        }
        delete childObj.destroyedGrids[gridName].destroyedObjectGroup;
      }
    }
    this.group[name].dispose();
    delete disabledObjectNames[name];
  }
  this.mesh.material.dispose();
  this.mesh.geometry.dispose();

  rayCaster.refresh();

}

ObjectGroup.prototype.exportLightweight = function(){
  var exportObj = new Object();
  exportObj.isChangeable = this.isChangeable;
  exportObj.isIntersectable = this.isIntersectable;
  this.graphicsGroup.position.copy(this.mesh.position);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.updateMatrixWorld();
  if (!this.boundingBoxes){
    this.generateBoundingBoxes();
  }
  this.updateBoundingBoxes();
  exportObj.matrixWorld = this.graphicsGroup.matrixWorld.elements;
  exportObj.position = this.graphicsGroup.position;
  exportObj.quaternion = new THREE.Quaternion().copy(this.graphicsGroup.quaternion);
  exportObj.childNames = [];
  exportObj.childWorkerIndices = [];
  exportObj.center = this.getInitialCenter();
  exportObj.boundingBoxes = [];
  this.childWorkerIdsByChildNames = new Object();
  var childWorkerIndexCtr = 0;
  for (var objName in this.group){
    exportObj.childNames.push(objName);
    exportObj.childWorkerIndices.push(childWorkerIndexCtr);
    this.childWorkerIdsByChildNames[objName] = childWorkerIndexCtr ++;
  }
  for (var i = 0; i<this.boundingBoxes.length; i++){
    exportObj.boundingBoxes.push({
      roygbivObjectName: this.boundingBoxes[i].roygbivObjectName,
      boundingBox: this.boundingBoxes[i]
    });
  }
  return exportObj;
}

ObjectGroup.prototype.export = function(){
  var exportObj = new Object();
  exportObj.name = this.name;
  exportObj.group = new Object();
  for (var objectName in this.group){
    exportObj.group[objectName] = this.group[objectName].export();
  }
  exportObj.mass = this.mass;
  if (!this.mass){
    exportObj.mass = 0;
  }

  if (this.isDynamicObject){
    exportObj.isDynamicObject = this.isDynamicObject;
  }

  if (this.isSlippery){
    exportObj.isSlippery = true;
  }else{
    exportObj.isSlippery = false;
  }

  if (this.isChangeable){
    exportObj.isChangeable = true;
  }else{
    exportObj.isChangeable = false;
  }
  if (this.isIntersectable){
    exportObj.isIntersectable = true;
  }else{
    exportObj.isIntersectable = false;
  }
  if (this.isColorizable){
    exportObj.isColorizable = true;
  }else{
    exportObj.isColorizable = false;
  }

  if (this.noMass){
    exportObj.noMass = true;
  }else{
    exportObj.noMass = false;
  }

  exportObj.quaternionX = this.initQuaternion.x;
  exportObj.quaternionY = this.initQuaternion.y;
  exportObj.quaternionZ = this.initQuaternion.z;
  exportObj.quaternionW = this.initQuaternion.w;

  exportObj.isBasicMaterial = this.isBasicMaterial;

  var blendingModeInt = this.mesh.material.blending;
  if (blendingModeInt == NO_BLENDING){
    exportObj.blendingMode = "NO_BLENDING";
  }else if (blendingModeInt == NORMAL_BLENDING){
    exportObj.blendingMode = "NORMAL_BLENDING";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    exportObj.blendingMode = "ADDITIVE_BLENDING";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    exportObj.blendingMode = "SUBTRACTIVE_BLENDING";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    exportObj.blendingMode = "MULTIPLY_BLENDING";
  }

  if (this.renderSide){
    exportObj.renderSide = this.renderSide;
  }

  if (this.areaVisibilityConfigurations){
    exportObj.areaVisibilityConfigurations = this.areaVisibilityConfigurations;
  }
  if (this.areaSideConfigurations){
    exportObj.areaSideConfigurations = this.areaSideConfigurations;
  }

  if (this.pivotObject){
    exportObj.hasPivot = true;
    exportObj.pivotOffsetX = this.pivotOffsetX;
    exportObj.pivotOffsetY = this.pivotOffsetY;
    exportObj.pivotOffsetZ = this.pivotOffsetZ;
    exportObj.positionX = this.mesh.position.x;
    exportObj.positionY = this.mesh.position.y;
    exportObj.positionZ = this.mesh.position.z;
    exportObj.quaternionX = this.mesh.quaternion.x;
    exportObj.quaternionY = this.mesh.quaternion.y;
    exportObj.quaternionZ = this.mesh.quaternion.z;
    exportObj.quaternionW = this.mesh.quaternion.w;
    exportObj.pivotQX = this.pivotObject.quaternion.x;
    exportObj.pivotQY = this.pivotObject.quaternion.y;
    exportObj.pivotQZ = this.pivotObject.quaternion.z;
    exportObj.pivotQW = this.pivotObject.quaternion.w;
    exportObj.insidePivotQX = this.pivotObject.children[0].quaternion.x;
    exportObj.insidePivotQY = this.pivotObject.children[0].quaternion.y;
    exportObj.insidePivotQZ = this.pivotObject.children[0].quaternion.z;
    exportObj.insidePivotQW = this.pivotObject.children[0].quaternion.w;
  }else if (this.pivotRemoved){
    exportObj.pivotRemoved = true;
    exportObj.positionX = this.mesh.position.x;
    exportObj.positionY = this.mesh.position.y;
    exportObj.positionZ = this.mesh.position.z;
    exportObj.quaternionX = this.mesh.quaternion.x;
    exportObj.quaternionY = this.mesh.quaternion.y;
    exportObj.quaternionZ = this.mesh.quaternion.z;
    exportObj.quaternionW = this.mesh.quaternion.w;
  }

  if (this.softCopyParentName){
    exportObj.softCopyParentName = this.softCopyParentName;
  }

  exportObj.totalAlpha = this.mesh.material.uniforms.totalAlpha.value;
  if (this.mesh.material.uniforms.totalAOIntensity){
    exportObj.totalAOIntensity = this.mesh.material.uniforms.totalAOIntensity.value;
  }
  if (this.mesh.material.uniforms.totalEmissiveIntensity){
    exportObj.totalEmissiveIntensity = this.mesh.material.uniforms.totalEmissiveIntensity.value;
  }
  if (this.mesh.material.uniforms.totalEmissiveColor){
    exportObj.totalEmissiveColor = "#"+this.mesh.material.uniforms.totalEmissiveColor.value.getHexString();
  }

  return exportObj;
}

ObjectGroup.prototype.getInitialCenter = function(){
  var group = this.group;
  var centerX = 0;
  var centerY = 0;
  var centerZ = 0;
  var count = 0;
  for (var objectName in group){
    var bodyPosition = group[objectName].physicsBody.position;
    count ++;
    centerX += bodyPosition.x;
    centerY += bodyPosition.y;
    centerZ += bodyPosition.z;
  }
  centerX = centerX / count;
  centerY = centerY / count;
  centerZ = centerZ / count;
  var obj = new Object();
  obj.x = centerX;
  obj.y = centerY;
  obj.z = centerZ;
  return obj;
}

ObjectGroup.prototype.setMass = function(mass){
  if (mass != 0){
    this.isDynamicObject = true;
    this.physicsBody.type = CANNON.Body.DYNAMIC;
  }else{
    this.isDynamicObject = false;
    this.physicsBody.type = CANNON.Body.STATIC;
  }
  this.physicsBody.mass = mass;
  this.physicsBody.updateMassProperties();
  this.physicsBody.aabbNeedsUpdate = true;
  this.mass = mass;
}

ObjectGroup.prototype.isVisibleOnThePreviewScene = function(){
  return !(this.isHidden);
}

ObjectGroup.prototype.setBlending = function(blendingModeInt){
  this.mesh.material.blending = blendingModeInt;
  if (blendingModeInt == NO_BLENDING){
    this.blendingMode = "NO_BLENDING";
  }else if (blendingModeInt == NORMAL_BLENDING){
    this.blendingMode = "NORMAL_BLENDING";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    this.blendingMode = "ADDITIVE_BLENDING";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    this.blendingMode = "SUBTRACTIVE_BLENDING";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    this.blendingMode = "MULTIPLY_BLENDING";
  }
}

ObjectGroup.prototype.getBlendingText = function(){
  var blendingModeInt = this.mesh.material.blending;
  if (blendingModeInt == NO_BLENDING){
    return "None";
  }else if (blendingModeInt == NORMAL_BLENDING){
    return "Normal";
  }else if (blendingModeInt == ADDITIVE_BLENDING){
    return "Additive";
  }else if (blendingModeInt == SUBTRACTIVE_BLENDING){
    return "Subtractive";
  }else if (blendingModeInt == MULTIPLY_BLENDING){
    return "Multiply";
  }
}

ObjectGroup.prototype.updateBoundingBoxes = function(){
  this.graphicsGroup.position.copy(this.mesh.position);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.updateMatrixWorld();
  for (var objName in this.group){
    this.group[objName].updateBoundingBoxes(this.boundingBoxes);
  }
  this.lastUpdatePosition.copy(this.mesh.position);
  this.lastUpdateQuaternion.copy(this.mesh.quaternion);
}

ObjectGroup.prototype.boundingBoxesNeedUpdate = function(){
  return !(Math.abs(this.lastUpdatePosition.x - this.mesh.position.x) < 0.1 &&
            Math.abs(this.lastUpdatePosition.y - this.mesh.position.y) < 0.1 &&
              Math.abs(this.lastUpdatePosition.z - this.mesh.position.z) < 0.1 &&
                Math.abs(this.lastUpdateQuaternion.x - this.mesh.quaternion.x) < 0.0001 &&
                  Math.abs(this.lastUpdateQuaternion.y - this.mesh.quaternion.y) < 0.0001 &&
                    Math.abs(this.lastUpdateQuaternion.z - this.mesh.quaternion.z) < 0.0001 &&
                      Math.abs(this.lastUpdateQuaternion.w - this.mesh.quaternion.w) < 0.0001);
}

ObjectGroup.prototype.generateBoundingBoxes = function(){
  if (!this.mesh){
    return;
  }
  this.boundingBoxes = [];
  this.mesh.updateMatrixWorld();
  this.graphicsGroup.position.copy(this.mesh.position);
  this.graphicsGroup.quaternion.copy(this.mesh.quaternion);
  this.graphicsGroup.updateMatrixWorld();
  for (var objName in this.group){
    this.group[objName].generateBoundingBoxes(this.boundingBoxes);
  }
}

ObjectGroup.prototype.visualiseBoundingBoxes = function(){
  if (this.bbHelper){
    scene.remove(this.bbHelper);
  }
  var box3 = new THREE.Box3();
  for (var objName in this.group){
    var boundingBoxes = this.group[objName].boundingBoxes;
    for (var i = 0; i < boundingBoxes.length; i++){
      box3.expandByPoint(boundingBoxes[i].min);
      box3.expandByPoint(boundingBoxes[i].max);
    }
  }
  this.bbHelper = new THREE.Box3Helper(box3, LIME_COLOR);
  scene.add(this.bbHelper);
}

ObjectGroup.prototype.removeBoundingBoxesFromScene = function(){
  if (this.bbHelper){
    scene.remove(this.bbHelper);
  }
}

ObjectGroup.prototype.setSlippery = function(isSlippery){
  if (isSlippery){
    this.setFriction(0);
    this.isSlippery = true;
  }else{
    this.setFriction(friction);
    this.isSlippery = false;
  }
}

ObjectGroup.prototype.setFriction = function(val){
  var physicsMaterial = this.physicsBody.material;
  for (var objName in addedObjects){
    var otherMaterial = addedObjects[objName].physicsBody.material;
    var contact = physicsWorld.getContactMaterial(physicsMaterial, otherMaterial);
    if (contact){
      contact.friction = val;
    }else{
      contact = new CANNON.ContactMaterial(physicsMaterial,otherMaterial, {
        friction: val,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      });
      physicsWorld.addContactMaterial(contact);
    }
  }
  for (var objName in objectGroups){
    if (objName == this.name){
      continue;
    }
    var otherMaterial = objectGroups[objName].physicsBody.material;
    var contact = physicsWorld.getContactMaterial(physicsMaterial, otherMaterial);
    if (contact){
      contact.friction = val;
    }else{
      contact = new CANNON.ContactMaterial(physicsMaterial, otherMaterial, {
        friction: val,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      });
      physicsWorld.addContactMaterial(contact);
    }
  }
}

ObjectGroup.prototype.makePivot = function(offsetX, offsetY, offsetZ){
  var obj = this;
  var pseudoMesh = new THREE.Mesh(obj.mesh.geometry, obj.mesh.material);
  pseudoMesh.position.copy(obj.mesh.position);
  pseudoMesh.quaternion.copy(obj.mesh.quaternion);
  var pivot = new THREE.Object3D();
  pivot.add(pseudoMesh);
  pivot.position.set(
    pseudoMesh.position.x + offsetX,
    pseudoMesh.position.y + offsetY,
    pseudoMesh.position.z + offsetZ
  );
  pseudoMesh.position.x = -offsetX;
  pseudoMesh.position.y = -offsetY;
  pseudoMesh.position.z = -offsetZ;
  pivot.pseudoMesh = pseudoMesh;
  pivot.offsetX = offsetX;
  pivot.offsetY = offsetY;
  pivot.offsetZ = offsetZ;
  pivot.rotation.order = 'YXZ';
  pivot.sourceObject = this;
  return pivot;
}

ObjectGroup.prototype.rotateAroundPivotObject = function(axis, radians){
  if (!this.pivotObject){
    return;
  }
  this.updatePivot();
  this.pivotObject.updateMatrix();
  this.pivotObject.updateMatrixWorld();
  if (axis == "x"){
    this.pivotObject.rotation.x += radians;
  }else if (axis == "y"){
    this.pivotObject.rotation.y += radians;
  }else if (axis == "z"){
    this.pivotObject.rotation.z += radians;
  }
  this.pivotObject.updateMatrix();
  this.pivotObject.updateMatrixWorld();
  this.pivotObject.pseudoMesh.updateMatrix();
  this.pivotObject.pseudoMesh.updateMatrixWorld();
  this.pivotObject.pseudoMesh.matrixWorld.decompose(REUSABLE_VECTOR, REUSABLE_QUATERNION, REUSABLE_VECTOR_2);
  this.mesh.position.copy(REUSABLE_VECTOR);
  this.mesh.quaternion.copy(REUSABLE_QUATERNION);
  this.physicsBody.quaternion.copy(this.mesh.quaternion);
  this.physicsBody.position.copy(this.mesh.position);
  if (this.mesh.visible){
    rayCaster.updateObject(this);
  }
}

ObjectGroup.prototype.updatePivot = function(){
  if (!this.pivotObject){
    return;
  }
  this.pivotObject.position.copy(this.mesh.position);
  this.pivotObject.translateX(this.pivotOffsetX);
  this.pivotObject.translateY(this.pivotOffsetY);
  this.pivotObject.translateZ(this.pivotOffsetZ);
}

ObjectGroup.prototype.copy = function(name, isHardCopy, copyPosition, gridSystem, fromScript){
  var positionBeforeDetached = this.mesh.position.clone();
  var quaternionBeforeDetached = this.mesh.quaternion.clone();
  var physicsPositionBeforeDetached = this.physicsBody.position.clone();
  var physicsQuaternionBeforeDetached = this.physicsBody.quaternion.clone();
  var initQuaternionBeforeDetached = this.initQuaternion.clone();
  var massWhenDetached = this.physicsBody.mass;
  var noMass = this.noMass;
  var slippery = this.isSlippery;
  var isChangeable = this.isChangeable;
  var isIntersectable = this.isIntersectable;
  var isColorizable = this.isColorizable;
  var renderSide = this.renderSide;
  var blending = this.mesh.material.blending;
  var totalAlphaBeforeDetached = this.mesh.material.uniforms.totalAlpha.value;
  var totalAOIntensityBeforeDetached;
  var totalEmissiveIntensityBeforeDetached;
  var totalEmissiveColorBeforeDetached;
  var oldMaterial = this.mesh.material;
  if (this.mesh.material.uniforms.totalAOIntensity){
    totalAOIntensityBeforeDetached = this.mesh.material.uniforms.totalAOIntensity.value;
  }
  if (this.mesh.material.uniforms.totalEmissiveIntensity){
    totalEmissiveIntensityBeforeDetached = this.mesh.material.uniforms.totalEmissiveIntensity.value;
  }
  if (this.mesh.material.uniforms.totalEmissiveColor){
    totalEmissiveColorBeforeDetached = this.mesh.material.uniforms.totalEmissiveColor.value;
  }
  var isTransparentBeforeDetached = this.mesh.material.transparent;
  this.detach();
  var newGroup = new Object();
  for (var objName in this.group){
    this.group[objName].skipToggleGrid = true;
    var copiedChild = this.group[objName].copy(
      generateUniqueObjectName(), isHardCopy, REUSABLE_VECTOR.set(0, 0, 0), gridSystem, fromScript
    );
    copiedChild.mesh.position.copy(this.group[objName].mesh.position);
    copiedChild.mesh.quaternion.copy(this.group[objName].mesh.quaternion);
    copiedChild.physicsBody.position.copy(this.group[objName].physicsBody.position);
    copiedChild.physicsBody.quaternion.copy(this.group[objName].physicsBody.quaternion);
    copiedChild.metaData["positionX"] = copiedChild.mesh.position.x;
    copiedChild.metaData["positionY"] = copiedChild.mesh.position.y;
    copiedChild.metaData["positionZ"] = copiedChild.mesh.position.z;
    copiedChild.metaData["centerX"] = copiedChild.mesh.position.x;
    copiedChild.metaData["centerY"] = copiedChild.mesh.position.y;
    copiedChild.metaData["centerZ"] = copiedChild.mesh.position.z;
    newGroup[copiedChild.name] = copiedChild;
    addedObjects[copiedChild.name] = copiedChild;
    this.group[objName].skipToggleGrid = false;
  }
  var newObjGroup = new ObjectGroup(name, newGroup);
  newObjGroup.handleTextures();
  newObjGroup.glue();
  newObjGroup.mesh.position.copy(copyPosition);
  newObjGroup.physicsBody.position.copy(copyPosition);
  newObjGroup.mesh.quaternion.copy(quaternionBeforeDetached);
  newObjGroup.physicsBody.quaternion.copy(physicsQuaternionBeforeDetached);
  newObjGroup.graphicsGroup.position.copy(newObjGroup.mesh.position);
  newObjGroup.graphicsGroup.quaternion.copy(newObjGroup.mesh.quaternion);
  this.glue();
  newObjGroup.isBasicMaterial = this.isBasicMaterial;
  this.physicsBody.position.copy(physicsPositionBeforeDetached);
  this.physicsBody.quaternion.copy(physicsQuaternionBeforeDetached);
  this.mesh.position.copy(positionBeforeDetached);
  this.mesh.quaternion.copy(quaternionBeforeDetached);
  var dx = newObjGroup.mesh.position.x - this.mesh.position.x;
  var dy = newObjGroup.mesh.position.y - this.mesh.position.y;
  var dz = newObjGroup.mesh.position.z - this.mesh.position.z;
  for (var objName in newObjGroup.group){
    newObjGroup.group[objName].positionXWhenAttached += dx;
    newObjGroup.group[objName].positionYWhenAttached += dy;
    newObjGroup.group[objName].positionZWhenAttached += dz;
    newObjGroup.group[objName].metaData["positionX"] += dx;
    newObjGroup.group[objName].metaData["positionY"] += dy;
    newObjGroup.group[objName].metaData["positionZ"] += dz;
    newObjGroup.group[objName].metaData["centerX"] += dx;
    newObjGroup.group[objName].metaData["centerY"] += dy;
    newObjGroup.group[objName].metaData["centerZ"] += dz;
  }
  this.isChangeable = isChangeable;
  this.isIntersectable = isIntersectable;
  this.isColorizable = isColorizable;
  newObjGroup.isChangeable = isChangeable;
  newObjGroup.isIntersectable = isIntersectable;
  newObjGroup.isColorizable = isColorizable;
  if (slippery){
    this.setSlippery(slippery);
    newObjGroup.setSlippery(slippery);
  }
  this.noMass = noMass;
  newObjGroup.noMass = noMass;
  if (noMass){
    physicsWorld.remove(this.physicsBody);
    physicsWorld.remove(newObjGroup.physicsBody);
  }
  newObjGroup.graphicsGroup.position.copy(newObjGroup.mesh.position);
  newObjGroup.graphicsGroup.quaternion.copy(newObjGroup.mesh.quaternion);
  this.initQuaternion.copy(initQuaternionBeforeDetached);
  newObjGroup.initQuaternion.copy(initQuaternionBeforeDetached);
  this.setMass(massWhenDetached);
  newObjGroup.cannotSetMass = this.cannotSetMass;
  if (this.physicsBody.mass != 0){
    newObjGroup.setMass(this.physicsBody.mass);
  }
  if (!(typeof renderSide == UNDEFINED)){
    this.handleRenderSide(renderSide);
    newObjGroup.handleRenderSide(renderSide);
  }

  this.setBlending(blending);
  newObjGroup.setBlending(this.mesh.material.blending);

  this.mesh.material.transparent = isTransparentBeforeDetached;
  newObjGroup.mesh.material.transparent = isTransparentBeforeDetached;
  this.mesh.material.uniforms.totalAlpha.value = totalAlphaBeforeDetached;
  if (this.mesh.material.uniforms.totalAOIntensity){
    this.mesh.material.uniforms.totalAOIntensity.value = totalAOIntensityBeforeDetached;
  }
  if (this.mesh.material.uniforms.totalEmissiveIntensity){
    this.mesh.material.uniforms.totalEmissiveIntensity.value = totalEmissiveIntensityBeforeDetached;
  }
  if (this.mesh.material.uniforms.totalEmissiveColor){
    this.mesh.material.uniforms.totalEmissiveColor.value = totalEmissiveColorBeforeDetached;
  }

  this.mesh.material = oldMaterial;

  if (!isHardCopy){
    newObjGroup.mesh.material = this.mesh.material;
    newObjGroup.softCopyParentName = this.name;
  }else{
    newObjGroup.mesh.material.uniforms.totalAlpha.value = this.mesh.material.uniforms.totalAlpha.value;
    if (newObjGroup.mesh.material.uniforms.totalAOIntensity){
      newObjGroup.mesh.material.uniforms.totalAOIntensity.value = this.mesh.material.uniforms.totalAOIntensity.value;
    }
    if (newObjGroup.mesh.material.uniforms.totalEmissiveIntensity){
      newObjGroup.mesh.material.uniforms.totalEmissiveIntensity.value = this.mesh.material.uniforms.totalEmissiveIntensity.value;
    }
    if (newObjGroup.mesh.material.uniforms.totalEmissiveColor){
      newObjGroup.mesh.material.uniforms.totalEmissiveColor.value = new THREE.Color().copy(this.mesh.material.uniforms.totalEmissiveColor.value);
    }
  }

  if (this.pivotObject){
    var pivot = newObjGroup.makePivot(this.pivotOffsetX, this.pivotOffsetY, this.pivotOffsetZ);
    newObjGroup.pivotObject = pivot;
    newObjGroup.pivotOffsetX = this.pivotOffsetX;
    newObjGroup.pivotOffsetY = this.pivotOffsetY;
    newObjGroup.pivotOffsetZ = this.pivotOffsetZ;
    newObjGroup.pivotRemoved = false;
  }

  newObjGroup.createdWithScript = fromScript;

  return newObjGroup;
}

ObjectGroup.prototype.updateOpacity = function(val){
  this.mesh.material.uniforms.totalAlpha.value = val;
  if (val != 1){
    this.mesh.material.transparent = true;
  }else{
    this.mesh.material.transparent = this.isTransparent;
  }
}
ObjectGroup.prototype.incrementOpacity = function(val){
  this.mesh.material.uniforms.totalAlpha.value += val;
  if (this.mesh.material.uniforms.totalAlpha.value != 1){
    this.mesh.material.transparent = true;
  }else{
    this.mesh.material.transparent = this.isTransparent;
  }
}

ObjectGroup.prototype.injectMacro = function(macro, insertVertexShader, insertFragmentShader){
  if (insertVertexShader){
    this.mesh.material.vertexShader = this.mesh.material.vertexShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  if (insertFragmentShader){
    this.mesh.material.fragmentShader = this.mesh.material.fragmentShader.replace(
      "#define INSERTION", "#define INSERTION\n#define "+macro
    )
  };
  this.mesh.material.needsUpdate = true;
}

ObjectGroup.prototype.removeMacro = function(macro, removeVertexShader, removeFragmentShader){
  if (removeVertexShader){
    this.mesh.material.vertexShader = this.mesh.material.vertexShader.replace("\n#define "+macro, "");
  }
  if (removeFragmentShader){
    this.mesh.material.fragmentShader = this.mesh.material.fragmentShader.replace("\n#define "+macro, "");
  }
  this.mesh.material.needsUpdate = true;
}

ObjectGroup.prototype.setFog = function(){
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

ObjectGroup.prototype.removeFog = function(){
  this.removeMacro("HAS_FOG", false, true);
  this.removeMacro("HAS_SKYBOX_FOG", true, true);
  delete this.mesh.material.uniforms.fogInfo;
  delete this.mesh.material.uniforms.cubeTexture;
  delete this.mesh.material.uniforms.worldMatrix;
  delete this.mesh.material.uniforms.cameraPosition;
  this.mesh.material.needsUpdate = true;
}
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
var WorkerMessageHandler = function(worker){
  if (worker){
    this.worker = worker;
  }
  this.buffer = [];
}

WorkerMessageHandler.prototype.push = function(data){
  this.buffer.push(data);
}

WorkerMessageHandler.prototype.flush = function(){
  if (this.buffer.length > 0){
    if (this.worker){
      this.worker.postMessage(this.buffer);
    }else{
      postMessage(this.buffer);
    }
    this.buffer.length = 0;
  }
}
