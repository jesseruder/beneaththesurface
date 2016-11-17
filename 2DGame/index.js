import Exponent from 'exponent';
import React from 'react';
import { Alert, Dimensions, PanResponder } from 'react-native';

// Can't use `import ...` form because THREE uses oldskool module stuff.
const THREE = require('three');

// `THREEView` wraps a `GLView` and creates a THREE renderer that uses
// that `GLView`. The class needs to be constructed with a factory so that
// the `THREE` module can be injected without exponent-sdk depending on the
// `'three'` npm package.
const THREEView = Exponent.createTHREEViewClass(THREE);

import Assets from '../Assets';


//// Game

// Render the game as a `View` component.

const waterVertShader = `
varying vec2 vUv;
uniform float time;

void main() {

    vUv = uv;

    float x = time + position.x;
    float displacement = (sin(x) + sin(2.2*x+5.52)) / 2.0;

    vec3 newPosition = position + vec3(0.0, 1.0, 0.0) * displacement * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
}`;

const waterFragShader = `
varying vec2 vUv;

void main() {
    gl_FragColor = vec4( 0.0,0.0,1.0, 1.0 );

}`;

function getDisplacement(posx, time) {
  let x = time + posx;
  let displacement = (Math.sin(x) + Math.sin(2.2*x+5.52)) / 2.0;
  return displacement * 0.1;
}

const startTime = Date.now();
const waterdy = -0.5;
const waterheight = 2;
const boatwidth = 0.5;
const boatheight = 0.5;

export default (viewProps) => {
  //// Camera

  // An orthographic projection from 3d to 2d can be viewed as simply dropping
  // one of the 3d dimensions (say 'Z'), after some rotation and scaling. The
  // scaling here is specified by the width and height of the camera's view,
  // which ends up defining the boundaries of the viewport through which the
  // 2d world is visualized.
  //
  // Let `p`, `q` be two distinct points that are sent to the same point in 2d
  // space. The direction of `p - q` (henceforth 'Z') then serves simply to
  // specify depth (ordering of overlap) between the 2d elements of this world.
  //
  // The width of the view will be 4 world-space units. The height is set based
  // on the phone screen's aspect ratio.
  const width = 4;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const height = (screenHeight / screenWidth) * width;
  const camera = new THREE.OrthographicCamera(
    -width / 2, width / 2,
    height / 2, -height / 2,
    1, 10000,
  );
  camera.position.z = 1000;


  //// Scene, sprites

  // We just use a regular `THREE.Scene`
  const scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x87CEFA );

  /////// WATER
  const waterGeometry = new THREE.PlaneBufferGeometry(4, waterheight, 100);
  const waterMaterial = new THREE.ShaderMaterial( {
    uniforms: {
        time: { // float initialized to 0
            type: "f",
            value: 0.0
        }
    },
    vertexShader: waterVertShader,
    fragmentShader: waterFragShader,
  });
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.position.y = waterdy;
  scene.add(waterMesh);


  //////// BOAT
  const boatGeometry = new THREE.PlaneBufferGeometry(boatwidth, boatheight);
  const boatTexture = THREEView.textureFromAsset(Assets['boat']);
  boatTexture.minFilter = boatTexture.magFilter = THREE.NearestFilter;
  boatTexture.needsUpdate = true;
  const boatMaterial = new THREE.MeshBasicMaterial({
    map: boatTexture,
    //color: 0xff0000,    // Sprites can be tinted with a color.
    transparent: true,  // Use the image's alpha channel for alpha.
  });

  const boatMesh = new THREE.Mesh(boatGeometry, boatMaterial);
  boatMesh.position.x = boatMesh.position.y = 0.5;
  boatMesh.position.z = 20;     // This puts this sprite behind our previous one.
  boatMesh.rotation.z = Math.PI;
  scene.add(boatMesh);





  //// Events

  // This function is called every frame, with `dt` being the time in seconds
  // elapsed since the last call.
  const tick = (dt) => {
    let time = .0005 * (Date.now() - startTime);
    waterMaterial.uniforms[ 'time' ].value = time;
    boatMesh.position.y = getDisplacement(boatMesh.position.x, time) + waterdy + waterheight / 2.0 + boatheight / 2.0 - 0.1;
    boatMesh.rotation.z = Math.PI + Math.atan2(getDisplacement(boatMesh.position.x + boatwidth/2.0, time) - getDisplacement(boatMesh.position.x -+ boatwidth/2.0, time), boatwidth);
  }

  // These functions are called on touch and release of the view respectively.
  const touch = (_, gesture) => {
    //material.color.setHex(0x00ff00);
  };
  const release = (_, gesture) => {
    //material.color.setHex(0xff0000);
  }


  //// React component

  // We bind our `touch` and `release` callbacks using a `PanResponder`. The
  // `THREEView` takes our `scene` and `camera` and renders them every frame.
  // It also takes our `tick` callbacks and calls it every frame.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: touch,
    onPanResponderRelease: release,
    onPanResponderTerminate: release,
    onShouldBlockNativeResponder: () => false,
  });
  return (
    <THREEView
      {...viewProps}
      {...panResponder.panHandlers}
      scene={scene}
      camera={camera}
      tick={tick}
    />
  );
};
