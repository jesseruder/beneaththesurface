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
const waterpercentage = 0.7;
const waterheight = 4;
const boatwidth = 0.5;
const boatheight = 0.5;
const MAX_FISHES = 8;
const MESH_ID_FISH = 'fish';
const MESH_ID_SPECIAL_FISH = 'specialFish';

export default class Game extends React.Component {
  state = {
    isRunning: false,
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
    this.width = 4;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    this.height = (screenHeight / screenWidth) * this.width;
    this.camera = new THREE.OrthographicCamera(
      -this.width / 2, this.width / 2,
      this.height / 2, -this.height / 2,
      1, 10000,
    );
    this.camera.position.z = 1000;
    this.leftScreen = -this.width/2;
    this.rightScreen = this.width/2;
    this.topScreen = this.height/2;
    this.bottomScreen = -this.height/2;


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
    this.fixedTopOfWaterY = this.height * waterpercentage + this.bottomScreen;
    this.waterMesh.position.y = this.fixedTopOfWaterY - waterheight/2.0;
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

    this.boatx = 0.5;
    this.boatMesh = new THREE.Mesh(this.boatGeometry, this.boatMaterial);
    this.boatMesh.position.x = this.boatMesh.position.y = 0.5;
    this.boatMesh.position.z = 20;     // This puts this sprite behind our previous one.
    this.boatMesh.rotation.z = Math.PI;
    this.scene.add(this.boatMesh);



    ////////// FISHING LINE
    this.lineHeight = 1.0;
    this.lineGeometry = new THREE.PlaneBufferGeometry(0.02, 1.0);
    this.lineMaterial = new THREE.MeshBasicMaterial({
      color: 0x777777,
    });
    this.lineMesh = new THREE.Mesh(this.lineGeometry, this.lineMaterial);
    this.lineMesh.position.y = 0.5;
    this.scene.add(this.lineMesh);


    //////// FISH
    this.fishGeometry = new THREE.PlaneBufferGeometry(1.0, 1.0);
    this.fishTexture = THREEView.textureFromAsset(Assets['goodfish']);
    this.fishTexture.minFilter = this.fishTexture.magFilter = THREE.NearestFilter;
    this.fishTexture.needsUpdate = true;
    this.fishMaterial = new THREE.MeshBasicMaterial({
      map: this.fishTexture,
      transparent: true,  // Use the image's alpha channel for alpha.
    });
    this.fishMaterial.side = THREE.DoubleSide;
    this.meshPool = {};
    this.meshPool[MESH_ID_FISH] = [];
    for (let i = 0; i < MAX_FISHES + 2; i++) {
      this.meshPool[MESH_ID_FISH].push(new THREE.Mesh(this.fishGeometry, this.fishMaterial));
    }



    this.specialFishMaterial = new THREE.MeshBasicMaterial({
      map: this.fishTexture,
      color: 0x990000,
      transparent: true,  // Use the image's alpha channel for alpha.
    });
    this.specialFishMaterial.side = THREE.DoubleSide;
    this.meshPool[MESH_ID_SPECIAL_FISH] = [];
    for (let i = 0; i < MAX_FISHES + 2; i++) {
      this.meshPool[MESH_ID_SPECIAL_FISH].push(new THREE.Mesh(this.fishGeometry, this.specialFishMaterial));
    }



    //// Events

    // This function is called every frame, with `dt` being the time in seconds
    // elapsed since the last call.

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

  randomHeightInWater = () => {
    return this.bottomScreen + Math.random() * (this.fixedTopOfWaterY - this.bottomScreen) * 0.7;
  }

  randomHeightInWaterPercent = (percent) => {
    return this.bottomScreen + Math.random() * (this.fixedTopOfWaterY - this.bottomScreen) * 0.7 * percent;
  }

  computeFishY = (fish, time) => {
    fish.y = fish.yBeforeTransformation + Math.sin(fish.randomseed * 2 * Math.PI + time * fish.speed * 5.0) * fish.yTravel;
  }

  rotatefish = (fish, time) => {
    if (fish.caught) {
      fish.mesh.scale.y = fish.size;
      fish.mesh.rotation.z = -Math.PI / 2.0 + Math.sin(fish.randomseed + time * 20 * fish.randomseed) * 0.1;
    } else if (fish.dx < 0) {
      fish.mesh.scale.y = -fish.size;
      fish.mesh.rotation.z = 0;
    } else {
      fish.mesh.scale.y = fish.size;
      fish.mesh.rotation.z = Math.PI;
    }
  }

  newfish = (time, options, meshFn) => {
    let meshObj = meshFn ? meshFn() : {
      mesh: this.meshPool.fish.pop(),
      meshId: MESH_ID_FISH,
    };

    let dx = Math.random() > 0.5 ? 1.0 : -1.0;
    let fish = {
      caught: false,
      speed: 0.3,
      mesh: meshObj.mesh,
      meshId: meshObj.meshId,
      dx,
      x: dx > 0 ? this.leftScreen - 0.1 : this.rightScreen + 0.1,
      y: 10000, // this will get set later
      yBeforeTransformation: this.randomHeightInWater(),
      yTravel: Math.random() * 0.3 + 0.05,
      randomseed: Math.random(),
      size: 0.3,
      points: 10,
      tickFn: null,
    };
    if (options) {
      fish = Object.assign(fish, options);
    }
    fish.mesh.scale.x = fish.size;
    fish.mesh.scale.y = fish.size;
    fish.mesh.position.y = 10000;
    this.rotatefish(fish, time);
    this.scene.add(fish.mesh);
    return fish;
  }

  destroyfish = (fish) => {
    this.scene.remove(fish.mesh);
    this.meshPool[fish.meshId].push(fish.mesh);
  }

  addfish = (time) => {
    if (Math.random() < 0.1) {
      this.addspecialfish(time);
    } else {
      this.fishes.push(this.newfish(time));
    }
  }

  addspecialfish = (time) => {
    let fish = this.newfish(time, {
      speed: 1.0,
      points: 40,
      yBeforeTransformation: this.randomHeightInWaterPercent(0.6),
      yTravel: Math.random() * 0.8 + 0.1,
      tickFn: (fish, dt, time) => {
        if (fish.x < this.leftScreen - 0.15 || fish.x > this.rightScreen + 0.15) {
          return true;
        }

        return false;
      },
    }, () => {
      return {
        mesh: new THREE.Mesh(this.fishGeometry, this.specialFishMaterial),
        meshId: MESH_ID_SPECIAL_FISH,
      };
    });
    this.fishes.push(fish);
  }

  moveFish = (fish, dt, time) => {
    fish.x += fish.dx * dt * fish.speed;
    this.computeFishY(fish, time);
    if (Math.random() < dt / 5.0) { // approx every 5 seconds
      fish.dx = -fish.dx;
    }

    if (fish.x < this.leftScreen - 0.2) {
      fish.dx = Math.abs(fish.dx);
    } else if (fish.x > this.rightScreen + 0.2) {
      fish.dx = -Math.abs(fish.dx);
    }
  }

  // return true if should destroy
  fishTick = (fish, dt, time, lineX, lineY) => {
    let returnValue = false;
    if (fish.caught) {
      fish.x = lineX + fish.randomseed * 0.1 - 0.05;
      fish.y = lineY;
      this.rotatefish(fish, time);
    } else {
      let initialDx = fish.dx;

      this.moveFish(fish, dt, time);

      if (fish.dx !== initialDx) {
        this.rotatefish(fish, time);
      }

      let dist = Math.sqrt(Math.pow(lineX - fish.x, 2) + Math.pow(lineY - fish.y, 2));
      if (dist < 0.1) {
        fish.caught = true;
      } else if (fish.tickFn) {
        returnValue = fish.tickFn(fish, dt, time);
      }
    }

    fish.mesh.position.x = fish.x;
    fish.mesh.position.y = fish.y;

    return returnValue;
  }

  updateScore = (d) => {
    this.props.updateScore(d);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.dx !== this.state.dx || nextProps.dy !== this.state.dy) {
      this.setState({
        dx: nextProps.dx,
        dy: nextProps.dy,
      })
    }

    if (nextProps.isRunning !== this.state.isRunning) {
      if (nextProps.isRunning) {
        let time = this.time();
        this.fishes = [];
        this.addfish();
        this.addfish();
        this.addfish();
      } else {
        for (let i = 0; i < this.fishes.length; i++) {
          this.destroyfish(this.fishes[i]);
        }
        this.fishes = [];
      }

      this.setState({
        isRunning: nextProps.isRunning,
      });
    }
  }

  time = () => {
    return .0005 * (Date.now() - startTime);
  }

  tick = (dt) => {
    if (this.state.isRunning) {
      this.boatx += dt * this.state.dx;
      if (this.boatx < -2) {
        this.boatx = -2;
      } else if (this.boatx > 2) {
        this.boatx = 2;
      }

      this.lineHeight += dt * this.state.dy;
      if (this.lineHeight < 0.01) {
        this.lineHeight = 0.01;
      } else if (this.lineHeight > 2.0) {
        this.lineHeight = 2.0;
      }
    }

    this.boatMesh.position.x = this.boatx;
    this.lineMesh.position.x = this.boatx;

    this.lineMesh.scale.y = this.lineHeight; // can't be 0

    let time = this.time();
    this.waterMaterial.uniforms[ 'time' ].value = time;
    let topOfWaterY = getDisplacement(this.boatMesh.position.x, time) + this.fixedTopOfWaterY;
    this.boatMesh.position.y = topOfWaterY + boatheight / 2.0 - 0.1;
    this.lineMesh.position.y = topOfWaterY - this.lineHeight/2.0;
    this.boatMesh.rotation.z = Math.PI + Math.atan2(getDisplacement(this.boatMesh.position.x + boatwidth/2.0, time) - getDisplacement(this.boatMesh.position.x -+ boatwidth/2.0, time), boatwidth);

    let lineX = this.boatx;
    let lineY = topOfWaterY - this.lineHeight;

    if (this.state.isRunning) {
      for (let i = this.fishes.length - 1; i >= 0; i--) {
        let fish = this.fishes[i];
        let shouldDestroy = this.fishTick(fish, dt, time, lineX, lineY);
        if (shouldDestroy) {
          this.destroyfish(fish);
          this.fishes.splice(i, 1);
        } else if (this.lineHeight < 0.1 && fish.caught) {
          this.updateScore(fish.points);
          this.destroyfish(fish);
          this.fishes.splice(i, 1);
        }
      }

      if (this.fishes.length < MAX_FISHES && Math.random() < dt / 7.0) {
        this.addfish(time);
      }

      if (this.fishes.length === 0) {
        this.addfish(time);
      }
    }

    this.props.tick();
    this.props.onGameLoaded();
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
