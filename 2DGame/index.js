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

export default class Game extends React.Component {
  state = {
    loaded: false,
    dx: 0,
    dy: 0,
  }

  componentDidMount() {
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
    this.camera = new THREE.OrthographicCamera(
      -width / 2, width / 2,
      height / 2, -height / 2,
      1, 10000,
    );
    this.camera.position.z = 1000;


    //// Scene, sprites

    // We just use a regular `THREE.Scene`
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0x87CEFA );

    /////// WATER
    this.waterGeometry = new THREE.PlaneBufferGeometry(4, waterheight, 100);
    this.waterMaterial = new THREE.ShaderMaterial( {
      uniforms: {
          time: { // float initialized to 0
              type: "f",
              value: 0.0
          }
      },
      vertexShader: waterVertShader,
      fragmentShader: waterFragShader,
    });
    this.waterMesh = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    this.waterMesh.position.y = waterdy;
    this.scene.add(this.waterMesh);


    //////// BOAT
    this.boatGeometry = new THREE.PlaneBufferGeometry(boatwidth, boatheight);
    this.boatTexture = THREEView.textureFromAsset(Assets['boat']);
    this.boatTexture.minFilter = this.boatTexture.magFilter = THREE.NearestFilter;
    this.boatTexture.needsUpdate = true;
    this.boatMaterial = new THREE.MeshBasicMaterial({
      map: this.boatTexture,
      //color: 0xff0000,    // Sprites can be tinted with a color.
      transparent: true,  // Use the image's alpha channel for alpha.
    });

    this.boatMesh = new THREE.Mesh(this.boatGeometry, this.boatMaterial);
    this.boatMesh.position.x = this.boatMesh.position.y = 0.5;
    this.boatMesh.position.z = 20;     // This puts this sprite behind our previous one.
    this.boatMesh.rotation.z = Math.PI;
    this.scene.add(this.boatMesh);


    //// Events

    // This function is called every frame, with `dt` being the time in seconds
    // elapsed since the last call.
    this.tick = (dt) => {
      let time = .0005 * (Date.now() - startTime);
      this.waterMaterial.uniforms[ 'time' ].value = time;
      this.boatMesh.position.y = getDisplacement(this.boatMesh.position.x, time) + waterdy + waterheight / 2.0 + boatheight / 2.0 - 0.1;
      this.boatMesh.rotation.z = Math.PI + Math.atan2(getDisplacement(this.boatMesh.position.x + boatwidth/2.0, time) - getDisplacement(this.boatMesh.position.x -+ boatwidth/2.0, time), boatwidth);
    }

    // These functions are called on touch and release of the view respectively.
    this.touch = (_, gesture) => {
      //material.color.setHex(0x00ff00);
    };
    this.release = (_, gesture) => {
      //material.color.setHex(0xff0000);
    }

    // We bind our `touch` and `release` callbacks using a `PanResponder`. The
    // `THREEView` takes our `scene` and `camera` and renders them every frame.
    // It also takes our `tick` callbacks and calls it every frame.
    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: this.touch,
      onPanResponderRelease: this.release,
      onPanResponderTerminate: this.release,
      onShouldBlockNativeResponder: () => false,
    });

    this.setState({
      loaded: true,
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.dx !== this.state.dx || nextProps.dy !== this.state.dy) {
      this.setState({
        dx: nextProps.dx,
        dy: nextProps.dy,
      })
    }
  }

  render() {
    if (!this.state.loaded) return null;

    return (
      <THREEView
        style={{ flex: 1 }}
        {...this.panResponder.panHandlers}
        scene={this.scene}
        camera={this.camera}
        tick={this.tick}
      />
    );
  }
};
