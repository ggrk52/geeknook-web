import{A as e,C as t,D as n,E as r,O as i,S as a,T as o,_ as s,a as c,b as l,c as u,d,f,h as p,i as m,k as h,l as g,m as _,n as v,o as y,p as b,r as x,s as S,t as C,u as w,v as T,w as E,x as D,y as O}from"./Mouse.ZrlRGzn3.js";import{t as k}from"./gsap.Bi_c5vh2.js";var A=e(x(),1),j=(e,t,n,r,i)=>(e-t)*(i-r)/(n-t)+r,M=class e{constructor(e,t){this.scene=e,this.renderer=e.renderer,this.gl=this.gl,this.camera=e.camera,this.textures=t,this.lastTime=0,this.everRendered=!1,this.mousePos=new n(0,0),this.cursorPos=new n(0,0),this.colorScheme=e.theme===`dark`?0:1,this.particleScale=this.scene.renderer.domElement.width/this.scene.pixelRatio/2e3*this.scene.particlesScale}static async create(t,n){let r=new e(t,n);return r.createPoints(),await r.createPointsFromImage(),r.init(),r}async getImageData(e){return new Promise((t,n)=>{let r=new Image;r.src=e,r.onload=()=>{let e=document.createElement(`canvas`);e.width=500,e.height=500;let n=e.getContext(`2d`);n.drawImage(r,0,0,500,500),t(n.getImageData(0,0,500,500))},r.onerror=n})}createPoints(){let e=new A.default({shape:[500,500],minDistance:j(this.scene.density,0,300,10,2),maxDistance:j(this.scene.density,0,300,11,3),tries:20}).fill();this.pointsBaseData=e,this.pointsData=[];for(let t=0;t<e.length;t++)this.pointsData.push(e[t][0]-250,e[t][1]-250);this.count=this.pointsData.length/2}async createPointsFromImage(){let e=[];for(let t=0;t<this.textures.length;t++){let n=await this.getImageData(this.textures[t]);e.push(n)}this.nearestPointsData=[];let t=[];for(let n=0;n<this.textures.length;n++)t.push(this.createPointsDistanceDataWorker(e[n],this.pointsBaseData,n));let n=await Promise.all(t);n.sort((e,t)=>e.index-t.index),n.forEach(e=>{this.nearestPointsData.push(e.nearestPoints)})}createPointsDistanceDataWorker(e,t,n){return new Promise((r,i)=>{let a=new Blob([`
                self.onmessage = function(e) {
                    (function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.PoissonDiskSampling=f()}})((function(){var define,module,exports;return function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,(function(r){var n=e[i][1][r];return o(n||r)}),p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r}()({1:[function(require,module,exports){module.exports=function moore(range,dimensions){range=range||1;dimensions=dimensions||2;var size=range*2+1;var length=Math.pow(size,dimensions)-1;var neighbors=new Array(length);for(var i=0;i<length;i++){var neighbor=neighbors[i]=new Array(dimensions);var index=i<length/2?i:i+1;for(var dimension=1;dimension<=dimensions;dimension++){var value=index%Math.pow(size,dimension);neighbor[dimension-1]=value/Math.pow(size,dimension-1)-range;index-=value}}return neighbors}},{}],2:[function(require,module,exports){"use strict";var tinyNDArray=require("./../tiny-ndarray").integer,sphereRandom=require("./../sphere-random"),getNeighbourhood=require("./../neighbourhood");function squaredEuclideanDistance(point1,point2){var result=0,i=0;for(;i<point1.length;i++){result+=Math.pow(point1[i]-point2[i],2)}return result}function FixedDensityPDS(options,rng){if(typeof options.distanceFunction==="function"){throw new Error("PoissonDiskSampling: Tried to instantiate the fixed density implementation with a distanceFunction")}this.shape=options.shape;this.minDistance=options.minDistance;this.maxDistance=options.maxDistance||options.minDistance*2;this.maxTries=Math.ceil(Math.max(1,options.tries||30));this.rng=rng||Math.random;var maxShape=0;for(var i=0;i<this.shape.length;i++){maxShape=Math.max(maxShape,this.shape[i])}var floatPrecisionMitigation=Math.max(1,maxShape/128|0);var epsilonDistance=1e-14*floatPrecisionMitigation;this.dimension=this.shape.length;this.squaredMinDistance=this.minDistance*this.minDistance;this.minDistancePlusEpsilon=this.minDistance+epsilonDistance;this.deltaDistance=Math.max(0,this.maxDistance-this.minDistancePlusEpsilon);this.cellSize=this.minDistance/Math.sqrt(this.dimension);this.neighbourhood=getNeighbourhood(this.dimension);this.currentPoint=null;this.processList=[];this.samplePoints=[];this.gridShape=[];for(var i=0;i<this.dimension;i++){this.gridShape.push(Math.ceil(this.shape[i]/this.cellSize))}this.grid=tinyNDArray(this.gridShape)}FixedDensityPDS.prototype.shape=null;FixedDensityPDS.prototype.dimension=null;FixedDensityPDS.prototype.minDistance=null;FixedDensityPDS.prototype.maxDistance=null;FixedDensityPDS.prototype.minDistancePlusEpsilon=null;FixedDensityPDS.prototype.squaredMinDistance=null;FixedDensityPDS.prototype.deltaDistance=null;FixedDensityPDS.prototype.cellSize=null;FixedDensityPDS.prototype.maxTries=null;FixedDensityPDS.prototype.rng=null;FixedDensityPDS.prototype.neighbourhood=null;FixedDensityPDS.prototype.currentPoint=null;FixedDensityPDS.prototype.processList=null;FixedDensityPDS.prototype.samplePoints=null;FixedDensityPDS.prototype.gridShape=null;FixedDensityPDS.prototype.grid=null;FixedDensityPDS.prototype.addRandomPoint=function(){var point=new Array(this.dimension);for(var i=0;i<this.dimension;i++){point[i]=this.rng()*this.shape[i]}return this.directAddPoint(point)};FixedDensityPDS.prototype.addPoint=function(point){var dimension,valid=true;if(point.length===this.dimension){for(dimension=0;dimension<this.dimension&&valid;dimension++){valid=point[dimension]>=0&&point[dimension]<this.shape[dimension]}}else{valid=false}return valid?this.directAddPoint(point):null};FixedDensityPDS.prototype.directAddPoint=function(point){var internalArrayIndex=0,stride=this.grid.stride,dimension;this.processList.push(point);this.samplePoints.push(point);for(dimension=0;dimension<this.dimension;dimension++){internalArrayIndex+=(point[dimension]/this.cellSize|0)*stride[dimension]}this.grid.data[internalArrayIndex]=this.samplePoints.length;return point};FixedDensityPDS.prototype.inNeighbourhood=function(point){var dimensionNumber=this.dimension,stride=this.grid.stride,neighbourIndex,internalArrayIndex,dimension,currentDimensionValue,existingPoint;for(neighbourIndex=0;neighbourIndex<this.neighbourhood.length;neighbourIndex++){internalArrayIndex=0;for(dimension=0;dimension<dimensionNumber;dimension++){currentDimensionValue=(point[dimension]/this.cellSize|0)+this.neighbourhood[neighbourIndex][dimension];if(currentDimensionValue<0||currentDimensionValue>=this.gridShape[dimension]){internalArrayIndex=-1;break}internalArrayIndex+=currentDimensionValue*stride[dimension]}if(internalArrayIndex!==-1&&this.grid.data[internalArrayIndex]!==0){existingPoint=this.samplePoints[this.grid.data[internalArrayIndex]-1];if(squaredEuclideanDistance(point,existingPoint)<this.squaredMinDistance){return true}}}return false};FixedDensityPDS.prototype.next=function(){var tries,angle,distance,currentPoint,newPoint,inShape,i;while(this.processList.length>0){if(this.currentPoint===null){this.currentPoint=this.processList.shift()}currentPoint=this.currentPoint;for(tries=0;tries<this.maxTries;tries++){inShape=true;distance=this.minDistancePlusEpsilon+this.deltaDistance*this.rng();if(this.dimension===2){angle=this.rng()*Math.PI*2;newPoint=[Math.cos(angle),Math.sin(angle)]}else{newPoint=sphereRandom(this.dimension,this.rng)}for(i=0;inShape&&i<this.dimension;i++){newPoint[i]=currentPoint[i]+newPoint[i]*distance;inShape=newPoint[i]>=0&&newPoint[i]<this.shape[i]}if(inShape&&!this.inNeighbourhood(newPoint)){return this.directAddPoint(newPoint)}}if(tries===this.maxTries){this.currentPoint=null}}return null};FixedDensityPDS.prototype.fill=function(){if(this.samplePoints.length===0){this.addRandomPoint()}while(this.next()){}return this.samplePoints};FixedDensityPDS.prototype.getAllPoints=function(){return this.samplePoints};FixedDensityPDS.prototype.getAllPointsWithDistance=function(){throw new Error("PoissonDiskSampling: getAllPointsWithDistance() is not available in fixed-density implementation")};FixedDensityPDS.prototype.reset=function(){var gridData=this.grid.data,i=0;for(i=0;i<gridData.length;i++){gridData[i]=0}this.samplePoints=[];this.currentPoint=null;this.processList.length=0};module.exports=FixedDensityPDS},{"./../neighbourhood":4,"./../sphere-random":6,"./../tiny-ndarray":7}],3:[function(require,module,exports){"use strict";var tinyNDArray=require("./../tiny-ndarray").array,sphereRandom=require("./../sphere-random"),getNeighbourhood=require("./../neighbourhood");function euclideanDistance(point1,point2){var result=0,i=0;for(;i<point1.length;i++){result+=Math.pow(point1[i]-point2[i],2)}return Math.sqrt(result)}function VariableDensityPDS(options,rng){if(typeof options.distanceFunction!=="function"){throw new Error("PoissonDiskSampling: Tried to instantiate the variable density implementation without a distanceFunction")}this.shape=options.shape;this.minDistance=options.minDistance;this.maxDistance=options.maxDistance||options.minDistance*2;this.maxTries=Math.ceil(Math.max(1,options.tries||30));this.distanceFunction=options.distanceFunction;this.bias=Math.max(0,Math.min(1,options.bias||0));this.rng=rng||Math.random;var maxShape=0;for(var i=0;i<this.shape.length;i++){maxShape=Math.max(maxShape,this.shape[i])}var floatPrecisionMitigation=Math.max(1,maxShape/128|0);var epsilonDistance=1e-14*floatPrecisionMitigation;this.dimension=this.shape.length;this.minDistancePlusEpsilon=this.minDistance+epsilonDistance;this.deltaDistance=Math.max(0,this.maxDistance-this.minDistancePlusEpsilon);this.cellSize=this.maxDistance/Math.sqrt(this.dimension);this.neighbourhood=getNeighbourhood(this.dimension);this.currentPoint=null;this.currentDistance=0;this.processList=[];this.samplePoints=[];this.sampleDistance=[];this.gridShape=[];for(var i=0;i<this.dimension;i++){this.gridShape.push(Math.ceil(this.shape[i]/this.cellSize))}this.grid=tinyNDArray(this.gridShape)}VariableDensityPDS.prototype.shape=null;VariableDensityPDS.prototype.dimension=null;VariableDensityPDS.prototype.minDistance=null;VariableDensityPDS.prototype.maxDistance=null;VariableDensityPDS.prototype.minDistancePlusEpsilon=null;VariableDensityPDS.prototype.deltaDistance=null;VariableDensityPDS.prototype.cellSize=null;VariableDensityPDS.prototype.maxTries=null;VariableDensityPDS.prototype.distanceFunction=null;VariableDensityPDS.prototype.bias=null;VariableDensityPDS.prototype.rng=null;VariableDensityPDS.prototype.neighbourhood=null;VariableDensityPDS.prototype.currentPoint=null;VariableDensityPDS.prototype.currentDistance=null;VariableDensityPDS.prototype.processList=null;VariableDensityPDS.prototype.samplePoints=null;VariableDensityPDS.prototype.sampleDistance=null;VariableDensityPDS.prototype.gridShape=null;VariableDensityPDS.prototype.grid=null;VariableDensityPDS.prototype.addRandomPoint=function(){var point=new Array(this.dimension);for(var i=0;i<this.dimension;i++){point[i]=this.rng()*this.shape[i]}return this.directAddPoint(point)};VariableDensityPDS.prototype.addPoint=function(point){var dimension,valid=true;if(point.length===this.dimension){for(dimension=0;dimension<this.dimension&&valid;dimension++){valid=point[dimension]>=0&&point[dimension]<this.shape[dimension]}}else{valid=false}return valid?this.directAddPoint(point):null};VariableDensityPDS.prototype.directAddPoint=function(point){var internalArrayIndex=0,stride=this.grid.stride,pointIndex=this.samplePoints.length,dimension;this.processList.push(pointIndex);this.samplePoints.push(point);this.sampleDistance.push(this.distanceFunction(point));for(dimension=0;dimension<this.dimension;dimension++){internalArrayIndex+=(point[dimension]/this.cellSize|0)*stride[dimension]}this.grid.data[internalArrayIndex].push(pointIndex);return point};VariableDensityPDS.prototype.inNeighbourhood=function(point){var dimensionNumber=this.dimension,stride=this.grid.stride,neighbourIndex,internalArrayIndex,dimension,currentDimensionValue,existingPoint,existingPointDistance;var pointDistance=this.distanceFunction(point);for(neighbourIndex=0;neighbourIndex<this.neighbourhood.length;neighbourIndex++){internalArrayIndex=0;for(dimension=0;dimension<dimensionNumber;dimension++){currentDimensionValue=(point[dimension]/this.cellSize|0)+this.neighbourhood[neighbourIndex][dimension];if(currentDimensionValue<0||currentDimensionValue>=this.gridShape[dimension]){internalArrayIndex=-1;break}internalArrayIndex+=currentDimensionValue*stride[dimension]}if(internalArrayIndex!==-1&&this.grid.data[internalArrayIndex].length>0){for(var i=0;i<this.grid.data[internalArrayIndex].length;i++){existingPoint=this.samplePoints[this.grid.data[internalArrayIndex][i]];existingPointDistance=this.sampleDistance[this.grid.data[internalArrayIndex][i]];var minDistance=Math.min(existingPointDistance,pointDistance);var maxDistance=Math.max(existingPointDistance,pointDistance);var dist=minDistance+(maxDistance-minDistance)*this.bias;if(euclideanDistance(point,existingPoint)<this.minDistance+this.deltaDistance*dist){return true}}}}return false};VariableDensityPDS.prototype.next=function(){var tries,angle,distance,currentPoint,currentDistance,newPoint,inShape,i;while(this.processList.length>0){if(this.currentPoint===null){var sampleIndex=this.processList.shift();this.currentPoint=this.samplePoints[sampleIndex];this.currentDistance=this.sampleDistance[sampleIndex]}currentPoint=this.currentPoint;currentDistance=this.currentDistance;for(tries=0;tries<this.maxTries;tries++){inShape=true;distance=this.minDistancePlusEpsilon+this.deltaDistance*(currentDistance+(1-currentDistance)*this.bias);if(this.dimension===2){angle=this.rng()*Math.PI*2;newPoint=[Math.cos(angle),Math.sin(angle)]}else{newPoint=sphereRandom(this.dimension,this.rng)}for(i=0;inShape&&i<this.dimension;i++){newPoint[i]=currentPoint[i]+newPoint[i]*distance;inShape=newPoint[i]>=0&&newPoint[i]<this.shape[i]}if(inShape&&!this.inNeighbourhood(newPoint)){return this.directAddPoint(newPoint)}}if(tries===this.maxTries){this.currentPoint=null}}return null};VariableDensityPDS.prototype.fill=function(){if(this.samplePoints.length===0){this.addRandomPoint()}while(this.next()){}return this.samplePoints};VariableDensityPDS.prototype.getAllPoints=function(){return this.samplePoints};VariableDensityPDS.prototype.getAllPointsWithDistance=function(){var result=new Array(this.samplePoints.length),i=0,dimension=0,point;for(i=0;i<this.samplePoints.length;i++){point=new Array(this.dimension+1);for(dimension=0;dimension<this.dimension;dimension++){point[dimension]=this.samplePoints[i][dimension]}point[this.dimension]=this.sampleDistance[i];result[i]=point}return result};VariableDensityPDS.prototype.reset=function(){var gridData=this.grid.data,i=0;for(i=0;i<gridData.length;i++){gridData[i]=[]}this.samplePoints=[];this.currentPoint=null;this.processList.length=0};module.exports=VariableDensityPDS},{"./../neighbourhood":4,"./../sphere-random":6,"./../tiny-ndarray":7}],4:[function(require,module,exports){"use strict";var moore=require("moore");function getNeighbourhood(dimensionNumber){var neighbourhood=moore(2,dimensionNumber),origin=[],dimension;neighbourhood=neighbourhood.filter((function(n){var dist=0;for(var d=0;d<dimensionNumber;d++){dist+=Math.pow(Math.max(0,Math.abs(n[d])-1),2)}return dist<dimensionNumber}));for(dimension=0;dimension<dimensionNumber;dimension++){origin.push(0)}neighbourhood.push(origin);neighbourhood.sort((function(n1,n2){var squareDist1=0,squareDist2=0,dimension;for(dimension=0;dimension<dimensionNumber;dimension++){squareDist1+=Math.pow(n1[dimension],2);squareDist2+=Math.pow(n2[dimension],2)}if(squareDist1<squareDist2){return-1}else if(squareDist1>squareDist2){return 1}else{return 0}}));return neighbourhood}var neighbourhoodCache={};function getNeighbourhoodMemoized(dimensionNumber){if(!neighbourhoodCache[dimensionNumber]){neighbourhoodCache[dimensionNumber]=getNeighbourhood(dimensionNumber)}return neighbourhoodCache[dimensionNumber]}module.exports=getNeighbourhoodMemoized},{moore:1}],5:[function(require,module,exports){"use strict";var FixedDensityPDS=require("./implementations/fixed-density");var VariableDensityPDS=require("./implementations/variable-density");function PoissonDiskSampling(options,rng){this.shape=options.shape;if(typeof options.distanceFunction==="function"){this.implementation=new VariableDensityPDS(options,rng)}else{this.implementation=new FixedDensityPDS(options,rng)}}PoissonDiskSampling.prototype.implementation=null;PoissonDiskSampling.prototype.addRandomPoint=function(){return this.implementation.addRandomPoint()};PoissonDiskSampling.prototype.addPoint=function(point){return this.implementation.addPoint(point)};PoissonDiskSampling.prototype.next=function(){return this.implementation.next()};PoissonDiskSampling.prototype.fill=function(){return this.implementation.fill()};PoissonDiskSampling.prototype.getAllPoints=function(){return this.implementation.getAllPoints()};PoissonDiskSampling.prototype.getAllPointsWithDistance=function(){return this.implementation.getAllPointsWithDistance()};PoissonDiskSampling.prototype.reset=function(){this.implementation.reset()};module.exports=PoissonDiskSampling},{"./implementations/fixed-density":2,"./implementations/variable-density":3}],6:[function(require,module,exports){"use strict";module.exports=sampleSphere;function sampleSphere(d,rng){var v=new Array(d),d2=Math.floor(d/2)<<1,r2=0,rr,r,theta,h,i;for(i=0;i<d2;i+=2){rr=-2*Math.log(rng());r=Math.sqrt(rr);theta=2*Math.PI*rng();r2+=rr;v[i]=r*Math.cos(theta);v[i+1]=r*Math.sin(theta)}if(d%2){var x=Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());v[d-1]=x;r2+=Math.pow(x,2)}h=1/Math.sqrt(r2);for(i=0;i<d;++i){v[i]*=h}return v}},{}],7:[function(require,module,exports){"use strict";function tinyNDArrayOfInteger(gridShape){var dimensions=gridShape.length,totalLength=1,stride=new Array(dimensions),dimension;for(dimension=dimensions;dimension>0;dimension--){stride[dimension-1]=totalLength;totalLength=totalLength*gridShape[dimension-1]}return{stride:stride,data:new Uint32Array(totalLength)}}function tinyNDArrayOfArray(gridShape){var dimensions=gridShape.length,totalLength=1,stride=new Array(dimensions),data=[],dimension,index;for(dimension=dimensions;dimension>0;dimension--){stride[dimension-1]=totalLength;totalLength=totalLength*gridShape[dimension-1]}for(index=0;index<totalLength;index++){data.push([])}return{stride:stride,data:data}}module.exports={integer:tinyNDArrayOfInteger,array:tinyNDArrayOfArray}},{}]},{},[5])(5)}));

                    const { imageData, pointsBase, index, density } = e.data;

                    const distanceFunction = function (point, imageData) {
                        const pixelRedIndex = (Math.round(point[0]) + Math.round(point[1]) * imageData.width) * 4;
                        const pixel = imageData.data[pixelRedIndex] / 255;
                        return pixel * pixel * pixel;
                    }

                    const linearMap = (x, a, b, c, d) => {
                        return ((x - a) * (d - c)) / (b - a) + c
                    }

                    const maxDistance = linearMap(density, 0, 300, 10, 50);
                    const poissonDisk = new PoissonDiskSampling({
                        shape: [500, 500],
                        minDistance: 1,
                        maxDistance: maxDistance,
                        tries: 20,
                        distanceFunction: function (point) {
                            return distanceFunction(point, imageData);
                        }
                    });
                    const points = poissonDisk.fill();

                    const nearestPoints = []
                    for (let i = 0; i < pointsBase.length; i++) {
                        let nearestPoint = null;
                        let nearestDistance = Infinity;
                        for (let j = 0; j < points.length; j++) {
                            if( Math.random() < .75) { continue; }
                            const distance = Math.sqrt(Math.pow(points[j][0] - pointsBase[i][0], 2) + Math.pow(points[j][1] - pointsBase[i][1], 2));
                            const pixelRedValue = distanceFunction(points[j], imageData);
                            // if (distance < nearestDistance) {
                            if (pixelRedValue < 1 && distance < nearestDistance) {
                                nearestDistance = distance;
                                nearestPoint = points[j];
                            }
                        }
                        nearestPoints.push(
                            nearestPoint[0] - 250,
                            nearestPoint[1] - 250
                        );
                    }

                    self.postMessage({ nearestPoints, index });
                };
            `],{type:`application/javascript`}),o=URL.createObjectURL(a),s=new Worker(o);s.onmessage=function(e){let{nearestPoints:t,index:n}=e.data;s.terminate(),URL.revokeObjectURL(o),r({nearestPoints:t,index:n})},s.onerror=function(e){console.error(`Worker error:`,e),s.terminate(),URL.revokeObjectURL(o),i(e)},s.postMessage({imageData:e,pointsBase:t,index:n,density:this.scene.density})})}createDataTexturePosition(e){let t=new Float32Array(this.length*4);for(let n=0;n<this.count;n++){let r=n*4;t[r+0]=e[n*2+0]*(1/250),t[r+1]=e[n*2+1]*(1/250),t[r+2]=0,t[r+3]=0}let n=new f(t,this.size,this.size,a,b);return n.needsUpdate=!0,n}createRenderTarget(){return new h(this.size,this.size,{wrapS:E,wrapT:E,minFilter:s,magFilter:s,texture:this.posTex,format:a,type:_,depthBuffer:!1,stencilBuffer:!1})}setPointsTextureFromIndex(e){this.posNearestTex=this.createDataTexturePosition(this.nearestPointsData[e]),this.posNearestTex.needsUpdate=!0,this.simMaterial.uniforms.uPosNearest=this.posNearestTex}init(){this.size=256,this.length=this.size*this.size,this.posTex=this.createDataTexturePosition(this.pointsData),this.posNearestTex=this.createDataTexturePosition(this.nearestPointsData[0]),this.rt1=this.createRenderTarget(),this.rt2=this.createRenderTarget(),this.renderer.setRenderTarget(this.rt1),this.renderer.setClearColor(0,0),this.renderer.clear(),this.renderer.setRenderTarget(this.rt2),this.renderer.setClearColor(0,0),this.renderer.clear(),this.renderer.setRenderTarget(null),this.noise=new v,this.simScene=new o,this.simCamera=new T(-1,1,1,-1,0,1),this.simMaterial=new r({uniforms:{uPosition:{value:this.posTex},uPosRefs:{value:this.posTex},uPosNearest:{value:this.posNearestTex},uMousePos:{value:new n(0,0)},uRingRadius:{value:.2},uDeltaTime:{value:0},uRingWidth:{value:.05},uRingWidth2:{value:.015},uIsHovering:{value:0},uRingDisplacement:{value:this.scene.ringDisplacement},uTime:{value:0}},vertexShader:`
                void main() {
                    gl_Position = vec4(position, 1.0);
                }
            `,fragmentShader:`
                precision highp float;
                uniform sampler2D uPosition;
                uniform sampler2D uPosRefs;
                uniform sampler2D uPosNearest;

                uniform vec2 uMousePos;
                uniform float uTime;
                uniform float uDeltaTime;
                uniform float uIsHovering;

                vec2 hash( vec2 p ){
                    p = vec2( dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)) );
                    return fract(sin(p)*43758.5453);
                }

                void main() {

                    vec2 simTexCoords = gl_FragCoord.xy / vec2(${this.size.toFixed(1)}, ${this.size.toFixed(1)});
                    vec4 pFrame = texture2D(uPosition, simTexCoords);

                    float scale = pFrame.z;
                    float velocity = pFrame.w;
                    vec2 refPos = texture2D(uPosRefs, simTexCoords).xy;
                    vec2 nearestPos = texture2D(uPosNearest, simTexCoords).xy;
                    float seed = hash(simTexCoords).x;
                    float seed2 = hash(simTexCoords).y;

                    float time = uTime * .5;
                    float lifeEnd = 3. + sin(seed2 * 100.) * 1.;
                    float lifeTime = mod((seed * 100.) + time, lifeEnd);

                    vec2 disp = vec2(0., 0.);
                    vec2 pos = pFrame.xy;

                    float distRadius = 0.15;

                    vec2 targetPos = refPos;
                    targetPos = mix(targetPos, nearestPos, uIsHovering * uIsHovering);

                    vec2 direction = normalize(targetPos - pos);
                    direction *= .01;

                    float dist = length(targetPos - pos);
                    float distStrength = smoothstep(distRadius, 0., dist);

                    if(dist > 0.005){
                        pos += direction * distStrength;
                    }

                    if(lifeTime < .01){
                        pos = refPos;
                        pFrame.xy = refPos;
                        scale = 0.;
                    }

                    // Add scale
                    float targetScale = smoothstep(.01, 0.5, lifeTime) - smoothstep(0.5, 1., lifeTime/lifeEnd);
                    targetScale += smoothstep(0.1, 0., smoothstep(0.001, .1, dist)) * 1.5 * uIsHovering;
                    // targetScale *= distStrength;

                    float scaleDiff = targetScale - scale;
                    scaleDiff *= .1;
                    scale += scaleDiff;

                    // Final position
                    vec2 finalPos = pos + (disp * smoothstep(0.001, distRadius, dist));
                    vec2 diff = finalPos - pFrame.xy;
                    diff *= .2;

                    velocity = smoothstep(distRadius, .001, dist) * uIsHovering;

                    vec4 frame = vec4(pFrame.xy + diff, scale, velocity);

                    gl_FragColor = frame;

                }
            `});let e=new p(new l(2,2),this.simMaterial);this.simScene.add(e);let t=new u,i=new Float32Array(this.count*2),a=new Float32Array(this.count*3),s=new Float32Array(this.count*4);for(let e=0;e<this.count;e++){let t=e%this.size,n=Math.floor(e/this.size);i[e*2]=t/this.size,i[e*2+1]=n/this.size}for(let e=0;e<this.count;e++)s[e*4]=Math.random(),s[e*4+1]=Math.random(),s[e*4+2]=Math.random(),s[e*4+3]=Math.random();t.setAttribute(`position`,new S(a,3)),t.setAttribute(`uv`,new S(i,2)),t.setAttribute(`seeds`,new S(s,4)),this.renderMaterial=new r({uniforms:{uPosition:{value:this.posTex},uTime:{value:0},uColor1:{value:new w(this.scene.colorControls.color1)},uColor2:{value:new w(this.scene.colorControls.color2)},uColor3:{value:new w(this.scene.colorControls.color3)},uAlpha:{value:1},uIsHovering:{value:0},uPulseProgress:{value:0},uMousePos:{value:new n(0,0)},uRez:{value:new n(this.scene.renderer.domElement.width,this.scene.renderer.domElement.height)},uParticleScale:{value:this.particleScale},uPixelRatio:{value:this.scene.pixelRatio},uColorScheme:{value:this.colorScheme}},vertexShader:`
                precision highp float;
                attribute vec4 seeds;

                uniform sampler2D uPosition;
                uniform float uTime;
                uniform float uParticleScale;
                uniform float uPixelRatio;
                uniform int uColorScheme;
                uniform float uIsHovering;
                uniform float uPulseProgress;

                varying vec4 vSeeds;
                varying float vVelocity;
                varying vec2 vLocalPos;
                varying vec2 vScreenPos;
                varying float vScale;

                ${m.noise}

                void main() {

                    vec4 pos = texture2D(uPosition, uv);
                    vSeeds = seeds;

                    float noiseX = snoise(vec3( vec2(pos.xy * 10.), uTime * .2 + 100.));
                    float noiseY = snoise(vec3( vec2(pos.xy * 10.), uTime * .2));

                    float noiseX2 = snoise(vec3( vec2(pos.xy * .5), uTime * .15 + 45.));
                    float noiseY2 = snoise(vec3( vec2(pos.xy * .5), uTime * .15 + 87.));

                    // make a smooth disc
                    float cDist = length(pos.xy) * 1.;
                    float progress = uPulseProgress;
                    float t = smoothstep(progress - .25, progress, cDist) - smoothstep(progress, progress + .25, cDist);
                    t *= smoothstep(1., .0, cDist);
                    pos.xy *= 1. + (t * .02);

                    float dist = smoothstep(0., 0.9, pos.w);
                    dist = mix(0., dist, uIsHovering);

                    pos.y += noiseY * 0.005 * dist;
                    pos.x += noiseX * 0.005 * dist;
                    pos.y += noiseY2 * 0.02;
                    pos.x += noiseX2 * 0.02;

                    vVelocity = pos.w;
                    vScale = pos.z;
                    vLocalPos = pos.xy;
                    vec4 viewSpace  = modelViewMatrix * vec4(vec3(pos.xy, 0.), 1.0);

                    gl_Position = projectionMatrix * viewSpace;
                    vScreenPos = gl_Position.xy;

                    float minScale = .25;
                    minScale += float(uColorScheme) * .75;

                    gl_PointSize = ((vScale * 7.) * (uPixelRatio * 0.5) * uParticleScale) + (minScale * uPixelRatio);

                }
            `,fragmentShader:`
                precision highp float;

                varying vec4 vSeeds;
                varying vec2 vScreenPos;
                varying vec2 vLocalPos;
                varying float vScale;
                varying float vVelocity;

                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;

                uniform vec2 uMousePos;
                uniform vec2 uRez;

                uniform float uAlpha;
                uniform float uTime;

                uniform int uColorScheme;

                ${m.noise}

                #define PI 3.1415926535897932384626433832795

                float sdRoundBox( in vec2 p, in vec2 b, in vec4 r )
                {
                    r.xy = (p.x>0.0)?r.xy : r.zw;
                    r.x  = (p.y>0.0)?r.x  : r.y;
                    vec2 q = abs(p)-b+r.x;
                    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
                }

                // rotate uv by angle
                vec2 rotate(vec2 v, float a) {
                    float s = sin(a);
                    float c = cos(a);
                    mat2 m = mat2(c, s, -s, c);
                    return m * v;
                }

                void main() {

                    float uBorderSize = 0.2;
                    vec2 center = vec2(.48, .4);
                    float ratio = uRez.x / uRez.y;

                    // get angle between
                    float angle = atan(vLocalPos.y - uMousePos.y, vLocalPos.x - uMousePos.x);

                    vec2 uv = gl_PointCoord.xy;
                    uv -= vec2(0.5);
                    uv.y *= -1.;

                    vec2 tuv = vScreenPos;
                    tuv = rotate(tuv, uTime * 1.);
                    tuv.y *= 1./ratio;
                    tuv += .5;

                    float h = 0.8; // adjust position of middleColor
                    float progress = vVelocity;
                    vec3 col = mix(mix(uColor1, uColor2, progress/h), mix(uColor2, uColor3, (progress - h)/(1.0 - h)), step(h, progress));
                    vec3 color = col;

                    float dist = sqrt(dot(uv, uv));

                    float dr = .5;
                    float t = smoothstep(dr+(uBorderSize + .0001), dr-uBorderSize, dist);
                    t = clamp(t, 0., 1.);

                    float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(.25));
                    rounded = smoothstep(.1, 0., rounded);

                    float disc = smoothstep(.5, .45, length(uv));

                    float a = uAlpha * disc * smoothstep(0.1, 0.2, vScale);

                    if(a < 0.01){
                        discard;
                    }

                    color = clamp(color, 0., 1.);
                    color = mix(color, color * clamp(vVelocity, 0., 1.), float(uColorScheme));

                    gl_FragColor = vec4(color, clamp(a, 0., 1.));

                    #ifdef SRGB_TRANSFER
                        gl_FragColor = sRGBTransferOETF( gl_FragColor );
                    #endif

                }
            `,transparent:!0,depthTest:!1,depthWrite:!1}),this.mesh=new D(t,this.renderMaterial),this.mesh.position.set(0,0,0),this.mesh.scale.set(5,-5,5),this.scene.scene.add(this.mesh)}resize(){this.renderMaterial.uniforms.uRez.value=new n(this.scene.renderer.domElement.width,this.scene.renderer.domElement.height),this.renderMaterial.uniforms.uPixelRatio.value=this.scene.pixelRatio,this.renderMaterial.needsUpdate=!0}update(){let e=this.scene.clock.getElapsedTime()-this.lastTime;this.lastTime=this.scene.clock.getElapsedTime(),this.scene.isIntersecting,this.mousePos.set(this.scene.intersectionPoint.x*.175,this.scene.intersectionPoint.y*.175),this.particleScale=this.scene.renderer.domElement.width/this.scene.pixelRatio/2e3*this.scene.particlesScale,this.simMaterial.uniforms.uPosition.value=this.everRendered?this.rt1.texture:this.posTex,this.simMaterial.uniforms.uTime.value=this.scene.clock.getElapsedTime(),this.simMaterial.uniforms.uDeltaTime.value=e,this.simMaterial.uniforms.uRingRadius.value=.175+Math.sin(this.scene.time*1)*.03+Math.cos(this.scene.time*3)*.02,this.simMaterial.uniforms.uMousePos.value=this.mousePos,this.simMaterial.uniforms.uRingWidth.value=this.scene.ringWidth,this.simMaterial.uniforms.uRingWidth2.value=this.scene.ringWidth2,this.simMaterial.uniforms.uRingDisplacement.value=this.scene.ringDisplacement,this.simMaterial.uniforms.uIsHovering.value=this.scene.hoverProgress,this.simMaterial.uniforms.uPosNearest.value=this.posNearestTex,this.renderer.setRenderTarget(this.rt2),this.renderer.render(this.simScene,this.simCamera),this.renderer.setRenderTarget(null),this.renderMaterial.uniforms.uPosition.value=this.everRendered?this.rt2.texture:this.posTex,this.renderMaterial.uniforms.uTime.value=this.scene.clock.getElapsedTime(),this.renderMaterial.uniforms.uMousePos.value=this.mousePos,this.renderMaterial.uniforms.uParticleScale.value=this.particleScale,this.renderMaterial.uniforms.uIsHovering.value=this.scene.hoverProgress,this.renderMaterial.uniforms.uPulseProgress.value=this.scene.pushProgress}postRender(){let e=this.rt1;this.rt1=this.rt2,this.rt2=e,this.everRendered=!0}kill(){this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.rt1.dispose(),this.rt2.dispose(),this.posTex.dispose(),this.simMaterial.dispose(),this.renderMaterial.dispose()}},N=class{constructor(e){this.loaded=!1,this.textures=e.textures||[`/assets/textures/icons/icon_cube.png`],this.color1=e.color1||`#aecbfa`,this.color2=e.color2||`#aecbfa`,this.color3=e.color3||`#93bbfc`,this.options=e,this.theme=e.theme||`dark`,this.interactive=!1,this.options.background=this.theme===`dark`?new w(1184535):new w(16777215),this.pixelRatio=e.pixelRatio||window.devicePixelRatio,this.particlesScale=e.particlesScale||.5,this.density=e.density||150,this.cameraZoom=e.cameraZoom||3.5,this.verbose=e.verbose||!1,this.onLoadedCallback=e.onLoaded||null,this.isHovering=!1,this.hoverProgress=0,this.pushProgress=0,this.scene=new o,this.scene.background=this.options.background,this.canvas=document.createElement(`canvas`),this.options.container.appendChild(this.canvas),this.canvas.width=this.options.container.offsetWidth,this.canvas.height=this.options.container.offsetHeight,d.enabled=!1,this.renderer=new y({canvas:this.canvas,antialias:!0,alpha:!0,powerPreference:`high-performance`,preserveDrawingBuffer:!0,stencil:!1,precision:`highp`}),this.gl=this.renderer.getContext(),this.renderer.extensions.get(`EXT_color_buffer_float`),this.renderer.setSize(this.canvas.width,this.canvas.height),this.renderer.setPixelRatio(this.pixelRatio),this.onWindowResize=this.onWindowResize.bind(this),this.initCamera(),this.initScene(),this.initEvents(),this.clock=new g,this.time=0,this.lastTime=0,this.dt=0,this.skipFrame=!1,this.isPaused=!1,this.raycaster=new t,this.mouse=new n,this.intersectionPoint=new i,this.isIntersecting=!1,this.mouseIsOver=!1}initEvents(){window.addEventListener(`resize`,e=>{this.onWindowResize()})}onWindowResize(){this.canvas.width=this.options.container.offsetWidth,this.canvas.height=this.options.container.offsetHeight,this.renderer.setSize(this.canvas.width,this.canvas.height),this.camera.aspect=this.canvas.width/this.canvas.height,this.camera.updateProjectionMatrix(),this.particles&&this.particles.resize()}onHoverStart(){k.to(this,{hoverProgress:1,duration:.5,ease:`power3.out`}),k.fromTo(this,{pushProgress:0},{pushProgress:1,duration:2,delay:.1,ease:`power2.out`})}onHoverEnd(){k.to(this,{hoverProgress:0,duration:.5,ease:`power3.out`}),k.fromTo(this,{pushProgress:0},{pushProgress:1,duration:2,delay:0,ease:`power2.out`})}setPointsTextureFromIndex(e){k.delayedCall(.1,()=>{this.particles&&this.particles.setPointsTextureFromIndex(e)}),k.fromTo(this,{pushProgress:0},{pushProgress:1,duration:2,ease:`power2.out`})}initCamera(){this.camera=new O(40,this.gl.drawingBufferWidth/this.gl.drawingBufferHeight,.1,1e3),this.camera.position.z=this.cameraZoom}async initScene(){this.colorControls={color1:this.theme===`dark`?`#318bf7`:this.color1,color2:this.theme===`dark`?`#bada4c`:this.color2,color3:this.theme===`dark`?`#e35058`:this.color3},await this.initParticles(),this.options.gui&&this.initGUI(),this.onLoaded()}async initParticles(){this.particles=await M.create(this,this.textures)}initGUI(){this.gui=new c({autoPlace:!1}),this.options.container.appendChild(this.gui.domElement),this.gui.domElement.style.position=`absolute`,this.gui.domElement.style.top=`0`,this.gui.domElement.style.right=`0`,this.gui.domElement.style.zIndex=`1000`;let e=this.gui.addFolder(`Colors`);e.addColor(this.colorControls,`color1`).name(`Color 1`).onChange(e=>{this.particles.renderMaterial.uniforms.uColor1.value.set(new w(e))}),e.addColor(this.colorControls,`color2`).name(`Color 2`).onChange(e=>{this.particles.renderMaterial.uniforms.uColor2.value.set(new w(e))}),e.addColor(this.colorControls,`color3`).name(`Color 3`).onChange(e=>{this.particles.renderMaterial.uniforms.uColor3.value.set(new w(e))}),e.add(this,`particlesScale`).name(`Particles Scale`).min(.1).max(4).step(.01).onChange(e=>{this.particlesScale=e}),e.add(this,`density`).name(`Density`).min(50).max(250).step(10).onChange(async e=>{this.density=e,this.verbose,this.killParticles(),await this.initParticles()}),e.open()}stop(){this.isPaused=!0,this.clock.stop(),this.verbose}resume(){this.isPaused=!1,this.clock.start(),this.verbose}killParticles(){this.scene.remove(this.particles.mesh),this.particles.kill()}kill(){this.stop(),window.removeEventListener(`resize`,this.onWindowResize),this.raycastPlane&&(this.scene.remove(this.raycastPlane),this.raycastPlane.geometry.dispose(),this.raycastPlane.material.dispose()),this.renderer&&this.renderer.dispose(),this.canvas&&this.canvas.parentElement&&this.canvas.parentElement.removeChild(this.canvas)}onLoaded(){this.loaded=!0,this.onLoadedCallback&&typeof this.onLoadedCallback==`function`&&this.onLoadedCallback(this)}preRender(){if(this.dt=this.clock.getElapsedTime()-this.lastTime,this.lastTime=this.clock.getElapsedTime(),this.time+=this.dt,this.particles.update(),this.interactive&&!this.skipFrame){let e=this.canvas.getBoundingClientRect();C.cursor,this.mouse.x=(C.cursor.x-e.left)*(C.screenWidth/e.width),this.mouse.y=(C.cursor.y-e.top)*(C.screenHeight/e.height),this.mouse.x=this.mouse.x/C.screenWidth*2-1,this.mouse.y=-(this.mouse.y/C.screenHeight)*2+1,this.mouse.x<-1||this.mouse.x>1||this.mouse.y<-1||this.mouse.y>1?this.mouseIsOver=!1:this.mouseIsOver=!0}if(this.skipFrame=!this.skipFrame,!this.skipFrame&&this.raycastPlane){this.raycaster.setFromCamera(this.mouse,this.camera);let e=this.raycaster.intersectObject(this.raycastPlane);e.length>0&&this.mouseIsOver?(this.intersectionPoint.copy(e[0].point),this.isIntersecting=!0):this.isIntersecting=!1}}render(){!this.loaded||this.isPaused||(this.preRender(),this.renderer.setRenderTarget(null),this.renderer.autoClear=!1,this.renderer.clear(),this.renderer.render(this.scene,this.camera),this.postRender())}postRender(){this.particles.postRender()}};document.addEventListener(`DOMContentLoaded`,()=>{document.querySelectorAll(`[data-morphing-particles-component]`).forEach(e=>{let t=e.querySelector(`[data-container]`);if(!t)return;let n=e.getAttribute(`data-theme`)||`dark`,r=parseInt(e.getAttribute(`data-density`)||`100`),i=new N({container:t,theme:n,particlesScale:parseFloat(e.getAttribute(`data-particles-scale`)||`1`),cameraZoom:parseFloat(e.getAttribute(`data-camera-zoom`)||`3.5`),density:r,textures:JSON.parse(e.getAttribute(`data-textures`)||`[]`),color1:e.getAttribute(`data-color1`)||void 0,color2:e.getAttribute(`data-color2`)||void 0,color3:e.getAttribute(`data-color3`)||void 0,interactive:!0,gui:new URLSearchParams(window.location.search).get(`gui`)===`true`,verbose:!1,onLoaded:()=>{e.dispatchEvent(new CustomEvent(`loaded`))}}),a=!1,o=null,s=new IntersectionObserver(e=>{e.forEach(e=>{a=e.isIntersecting,e.isIntersecting?i.resume():i.stop()})},{root:null,rootMargin:`0px`,threshold:0});s.observe(t);let c=()=>{o=requestAnimationFrame(c),a&&i.render()};c(),e.helper={onHover:()=>i.onHoverStart(),onLeave:()=>i.onHoverEnd(),setPointsTextureFromIndex:e=>i.setPointsTextureFromIndex(e),kill:()=>i.kill()},window.addEventListener(`beforeunload`,()=>{s.disconnect(),o!==null&&cancelAnimationFrame(o),i.kill()})})});