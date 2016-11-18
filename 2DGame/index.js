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
require('./GPUParticleSystem');


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
uniform sampler2D texture;
uniform float time;
varying vec2 vUv;

void main() {
    vec2 disp = vec2((sin(time / 4.5)/2.0 + sin(vUv.y * 5.3 + time / 5.0) + sin(vUv.x * 8.3 + time / 12.0)) / 4.0, (sin(time * 3.4 + time / 3.0)/2.0 + sin(vUv.x * 4.8 + time / 7.0) + sin(vUv.y * 7.5)) / 4.0);
    vec2 pos = vec2(mod(disp.x + vUv.x * 4.0, 1.0), mod(disp.y + vUv.y * 4.0, 1.0));
    float amt = texture2D(texture, pos).r * 0.7;
    float whiteAmount = 0.0;
    if (vUv.y > 0.98) {
      whiteAmount = (vUv.y - 0.98) / (1.0 - 0.985);
    }
    gl_FragColor = vec4(amt*vUv.y + whiteAmount,amt*vUv.y + whiteAmount,0.7*vUv.y + amt*vUv.y + whiteAmount, 1.0 );
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
const MAX_SHARKS = 2;
const MAX_CLOUDS = 5;
const SHARK_EAT_DIST = 0.3;
const MESH_ID_FISH = 'fish';
const MESH_ID_SPECIAL_FISH = 'specialFish';
const MESH_ID_SHARK = 'shark';
const MESH_ID_BOMB = 'bomb';
const MAX_BOMBS = 20;
const BOMB_INITIAL_RADIUS = 0.1;
const BOMB_RADIUS = 0.3;

export default class Game extends React.Component {
  state = {
    isRunning: false,
    loaded: false,
    dx: 0,
    dy: 0,
    isPlacingBomb: false,
  }

  screenToGLCoords = (x, y) => {
    return {
      x: (x / this.screenWidth) * this.width - this.width / 2.0,
      y: (1.0 - (y / this.screenHeight)) * this.height - this.height / 2.0,
    };
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
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
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

    this.accumulateScore = 0;
    this.accumulateScoreTimeout = null;


    //// Scene, sprites

    // We just use a regular `THREE.Scene`
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0x87CEFA );


    this.meshPool = {};


    /////// CLOUDS
    this.cloudGeometry = new THREE.PlaneBufferGeometry(1, 0.579);
    this.cloudTexture = THREEView.textureFromAsset(Assets['cloud']);
    this.cloudTexture.minFilter = this.cloudTexture.magFilter = THREE.NearestFilter;
    this.cloudTexture.needsUpdate = true;
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: true,
    });
    this.clouds = [];
    for (let i = 0; i < MAX_CLOUDS; i++) {
      let mesh = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
      let cloud = {
        mesh,
        x: Math.random() * this.width * 2 - this.width * 1.5,
        y: this.topScreen - Math.random() * this.height * 0.3,
        speed: Math.random() * 0.1 + 0.1,
      };
      this.clouds.push(cloud);
      mesh.position.x = cloud.x;
      mesh.position.y = cloud.y;
      mesh.position.z = 0.5;
      mesh.scale.x = Math.random() * 0.3 + 0.6;
      mesh.scale.y = Math.random() * 0.3 + 0.6;
      mesh.rotation.z = Math.PI;
      this.scene.add(mesh);
    }


    /////// WATER
    this.waterGeometry = new THREE.PlaneBufferGeometry(4, waterheight, 100);
    this.waterTexture = THREEView.textureFromAsset(Assets['water']);
    this.waterTexture.minFilter = this.waterTexture.magFilter = THREE.NearestFilter;
    this.waterTexture.needsUpdate = true;
    this.waterMaterial = new THREE.ShaderMaterial( {
      uniforms: {
          time: { // float initialized to 0
              type: "f",
              value: 0.0
          },
          texture: {
            type: 't',
            value: this.waterTexture,
          },
      },
      vertexShader: waterVertShader,
      fragmentShader: waterFragShader,
    });
    this.waterMesh = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    this.fixedTopOfWaterY = this.height * waterpercentage + this.bottomScreen;
    this.waterMesh.position.y = this.fixedTopOfWaterY - waterheight/2.0;
    this.waterMesh.position.z = 1.0;
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
    this.lineMesh.position.z = 10;
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
    this.meshPool[MESH_ID_FISH] = [];
    for (let i = 0; i < MAX_FISHES + 2; i++) {
      this.meshPool[MESH_ID_FISH].push(new THREE.Mesh(this.fishGeometry, this.fishMaterial));
    }


    ///// SPECIAL FISH
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


    //// SHARK!!!!!!
    this.sharkTexture = THREEView.textureFromAsset(Assets['shark']);
    this.sharkTexture.minFilter = this.sharkTexture.magFilter = THREE.NearestFilter;
    this.sharkTexture.needsUpdate = true;
    this.sharkMaterial = new THREE.MeshBasicMaterial({
      map: this.sharkTexture,
      transparent: true,  // Use the image's alpha channel for alpha.
    });
    this.sharkMaterial.side = THREE.DoubleSide;
    this.meshPool[MESH_ID_SHARK] = [];
    for (let i = 0; i < MAX_SHARKS + 2; i++) {
      this.meshPool[MESH_ID_SHARK].push(new THREE.Mesh(this.fishGeometry, this.sharkMaterial));
    }



    //// BOMB
    this.bombGeometry = new THREE.PlaneBufferGeometry(0.2, 0.2);
    this.bombTexture = THREEView.textureFromAsset(Assets['bomb']);
    this.bombTexture.minFilter = this.bombTexture.magFilter = THREE.NearestFilter;
    this.bombTexture.needsUpdate = true;
    this.bombMaterial = new THREE.MeshBasicMaterial({
      map: this.bombTexture,
      transparent: true,  // Use the image's alpha channel for alpha.
    });
    this.meshPool[MESH_ID_BOMB] = [];
    for (let i = 0; i < MAX_BOMBS + 2; i++) {
      this.meshPool[MESH_ID_BOMB].push(new THREE.Mesh(this.bombGeometry, this.bombMaterial));
    }
    this.bombs = [];



    ////// PARTICLES
    this.particleSystem = new THREE.GPUParticleSystem({
			maxParticles: 25000,
      particleNoiseTex: THREEView.textureFromAsset(Assets['perlin-512']),
      particleSpriteTex: THREEView.textureFromAsset(Assets['particle2']),
		});
    // not working :/
    this.particleSystem.renderOrder = 100;
    this.particleSystem.depthTest = false;
    this.scene.add(this.particleSystem);
    this.particleOptions = {
      position: new THREE.Vector3(),
			positionRandomness: .1,
			velocity: new THREE.Vector3(),
			velocityRandomness: .1,
			color: 0xFF8800,
			colorRandomness: .2,
			turbulence: .001,
			lifetime: 0.2,
			size: 300,
			sizeRandomness: 100,
		};
		this.particleSpawnerOptions = {
			spawnRate: 350,
			horizontalSpeed: 0.001,
			verticalSpeed: 0.001,
			timeScale: 1
		};
    this.particleTick = 0;
    this.explosions = [];



    //// Events

    // This function is called every frame, with `dt` being the time in seconds
    // elapsed since the last call.

    // These functions are called on touch and release of the view respectively.
    this.touch = (_, gesture) => {
      if (this.state.isPlacingBomb) {
        this.props.placedBomb();
        let coords = this.screenToGLCoords(gesture.x0, gesture.y0);
        let bomb = {
          isExploding: false,
          x: coords.x,
          y: coords.y,
          mesh: this.meshPool[MESH_ID_BOMB].pop(),
        };
        this.bombs.push(bomb);
        bomb.mesh.position.x = bomb.x;
        bomb.mesh.position.y = bomb.y;
        bomb.mesh.position.z = 40;
        bomb.mesh.rotation.z = Math.PI;
        this.scene.add(bomb.mesh);
      } else {
        this.setState({
          dx: 0,
          dy: 0,
        });
      }
    };
    this.release = (_, gesture) => {
      this.setState({
        dx: 0,
        dy: 0,
      });
    }
    this.moveTouch = (_, gesture) => {
      let dx = 0;
      if (gesture.dx > 20) {
        dx = 1;
      } else if (gesture.dx < -20) {
        dx = -1;
      }

      let dy = 0;
      if (gesture.dy > 20) {
        dy = 1;
      } else if (gesture.dy < -20) {
        dy = -1;
      }

      if (dx !== this.state.dx || dy !== this.state.dy) {
        this.setState({
          dx,
          dy,
        });
      }
    };

    // We bind our `touch` and `release` callbacks using a `PanResponder`. The
    // `THREEView` takes our `scene` and `camera` and renders them every frame.
    // It also takes our `tick` callbacks and calls it every frame.
    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: this.touch,
      onPanResponderRelease: this.release,
      onPanResponderTerminate: this.release,
      onPanResponderMove: this.moveTouch,
      onShouldBlockNativeResponder: () => false,
    });

    this.setState({
      loaded: true,
    });
  }

  addMessage = (message, options = {}) => {
    this.props.addMessage(message, options);
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
      mesh: this.meshPool[MESH_ID_FISH].pop(),
      meshId: MESH_ID_FISH,
    };

    let dx = Math.random() > 0.5 ? 1.0 : -1.0;
    let fish = {
      isFish: true,
      caught: false,
      canBeEaten: true,
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
      bombPoints: 0,
      tickFn: null,
      width: 1,
      height: 1,
      hitbox: 0.1,
    };
    if (options) {
      fish = Object.assign(fish, options);
    }
    fish.mesh.scale.x = fish.size * fish.width;
    fish.mesh.scale.y = fish.size * fish.height;
    fish.mesh.position.y = 10000;
    fish.mesh.position.z = 30;
    //fish.mesh.renderOrder = 1;
    this.rotatefish(fish, time);
    this.scene.add(fish.mesh);
    this.putParticleSystemInFront();
    return fish;
  }

  destroyfish = (fish) => {
    this.scene.remove(fish.mesh);
    this.meshPool[fish.meshId].push(fish.mesh);
  }

  destroybomb = (bomb) => {
    this.scene.remove(bomb.mesh);
    this.meshPool[MESH_ID_BOMB].push(bomb.mesh);
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
      bombPoints: -10,
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
        mesh: this.meshPool[MESH_ID_SPECIAL_FISH].pop(),
        meshId: MESH_ID_SPECIAL_FISH,
      };
    });
    this.fishes.push(fish);
  }

  addshark = (time) => {
    let fish = this.newfish(time, {
      isFish: false,
      isShark: true,
      canBeEaten: false,
      points: -30,
      bombPoints: 20,
      width: 2.45,
      hitbox: 0.3,
      tickFn: (fish, dt, time) => {
        for (let i = this.fishes.length - 1; i >= 0; i--) {
          let otherfish = this.fishes[i];
          if (otherfish.canBeEaten) {
            let dist = Math.sqrt(Math.pow(fish.x - otherfish.x, 2) + Math.pow(fish.y - otherfish.y, 2));
            if (dist < SHARK_EAT_DIST) {
              otherfish.shouldDestroy = true;
              this.addExplosion(otherfish.x, otherfish.y);
            }
          }
        }
      },
    }, () => {
      return {
        mesh: this.meshPool[MESH_ID_SHARK].pop(),
        meshId: MESH_ID_SHARK,
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
      if (dist < fish.hitbox) {
        fish.caught = true;
      }
    }

    if (fish.tickFn) {
      returnValue = fish.tickFn(fish, dt, time);
    }
    fish.mesh.position.x = fish.x;
    fish.mesh.position.y = fish.y;

    for (let i = 0; i < this.bombs.length; i++) {
      let bomb = this.bombs[i];
      let dist = Math.sqrt(Math.pow(bomb.x - fish.x, 2) + Math.pow(bomb.y - fish.y, 2));
      if (dist < fish.hitbox + BOMB_INITIAL_RADIUS) {
        bomb.isExploding = true;
      }
    }

    return returnValue;
  }

  addExplosion = (x, y, size = 1) => {
    this.explosions.push({
      x,
      y,
      size,
      endTime: Date.now() + 200,
    });
  }

  putParticleSystemInFront = () => {
    // not working :/
    //this.scene.remove(this.particleSystem);
    //this.scene.add(this.particleSystem);
  }

  updateScore = (d) => {
    this.accumulateScore += d;
    this.accumulateScoreTimeout = setTimeout(() => {
      if (this.accumulateScore > 0) {
        this.addMessage('+' + this.accumulateScore + '!', {color: 'green'});
      } else if (this.accumulateScore < 0) {
        this.addMessage(this.accumulateScore + '!', {color: 'red'});
      }
      this.accumulateScore = 0;
      this.accumulateScoreTimeout = null;
    }, 50);
    this.props.updateScore(d);
  }

  componentWillReceiveProps(nextProps) {
    /*if (nextProps.dx !== this.state.dx || nextProps.dy !== this.state.dy) {
      this.setState({
        dx: nextProps.dx,
        dy: nextProps.dy,
      })
    }*/

    if (nextProps.isPlacingBomb !== this.state.isPlacingBomb) {
      this.setState({
        isPlacingBomb: nextProps.isPlacingBomb,
      });
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

        for (let i = 0; i < this.bombs.length; i++) {
          this.destroybomb(this.bombs[i]);
        }
        this.bombs = [];
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
    this.boatMesh.position.y = topOfWaterY + boatheight / 2.0 - 0.05;//0.1
    this.lineMesh.position.y = topOfWaterY - this.lineHeight/2.0;
    this.boatMesh.rotation.z = Math.PI + Math.atan2(getDisplacement(this.boatMesh.position.x + boatwidth/2.0, time) - getDisplacement(this.boatMesh.position.x -+ boatwidth/2.0, time), boatwidth);

    let lineX = this.boatx;
    let lineY = topOfWaterY - this.lineHeight;

    if (this.state.isRunning) {
      for (let i = this.fishes.length - 1; i >= 0; i--) {
        let fish = this.fishes[i];
        let shouldDestroy = this.fishTick(fish, dt, time, lineX, lineY) || fish.shouldDestroy;
        if (shouldDestroy) {
          this.destroyfish(fish);
          this.fishes.splice(i, 1);
        } else if (this.lineHeight < 0.1 && fish.caught) {
          this.updateScore(fish.points);
          this.destroyfish(fish);
          this.fishes.splice(i, 1);
        }
      }

      let numFishes = this.countFishesWithFn((fish) => fish.isFish);
      if (numFishes < MAX_FISHES && Math.random() < dt / 5.0) {
        this.addfish(time);
      }

      if (numFishes === 0) {
        this.addfish(time);
      }

      let numSharks = this.countFishesWithFn((fish) => fish.isShark);
      if (numSharks < MAX_SHARKS && numFishes > 2 && Math.random() < dt / 10.0) {
        this.addshark(time);
      }

      for (let i = this.bombs.length - 1; i >= 0; i--) {
        let bomb = this.bombs[i];
        if (bomb.isExploding) {
          this.destroybomb(bomb);
          this.bombs.splice(i, 1);
          this.addExplosion(bomb.x, bomb.y, 2.3);

          for (let j = this.fishes.length - 1; j >= 0; j--) {
            let fish = this.fishes[j];
            let dist = Math.sqrt(Math.pow(bomb.x - fish.x, 2) + Math.pow(bomb.y - fish.y, 2));
            if (dist < fish.hitbox + BOMB_RADIUS) {
              this.updateScore(fish.bombPoints);
              this.destroyfish(fish);
              this.fishes.splice(j, 1);
              this.addExplosion(fish.x, fish.y);
            }
          }
        }
      }
    }



    // PARTICLES
    let particleDelta = dt * this.particleSpawnerOptions.timeScale;
    this.particleTick += particleDelta;
		if (this.particleTick < 0) this.particleTick = 0;
		if (particleDelta > 0) {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        let explosion = this.explosions[i];
  			this.particleOptions.position.x = explosion.x + Math.sin(this.particleTick * this.particleSpawnerOptions.horizontalSpeed) * .3 * explosion.size;
  			this.particleOptions.position.y = explosion.y + Math.sin(this.particleTick * this.particleSpawnerOptions.verticalSpeed) * .3 * explosion.size;
  			this.particleOptions.position.z = 50;
  			for (var x = 0; x < this.particleSpawnerOptions.spawnRate * particleDelta * explosion.size; x++) {
          let angle = Math.random() * Math.PI * 2;
          this.particleOptions.velocity.x = Math.cos(angle) * 0.3 * explosion.size;
          this.particleOptions.velocity.y = Math.sin(angle) * 0.3 * explosion.size;
  				this.particleSystem.spawnParticle(this.particleOptions);
  			}

        if (Date.now() > explosion.endTime) {
          this.explosions.splice(i, 1);
        }
      }
		}
    this.particleSystem.update(this.particleTick);



    /// CLOUDS
    for (let i = 0; i < this.clouds.length; i++) {
      let cloud = this.clouds[i];
      cloud.x += dt * cloud.speed;
      cloud.mesh.position.x = cloud.x;
      if (cloud.x > this.width * 1.5) {
        cloud.x = -this.width * 1.5;
      }
    }


    this.props.tick();
    this.props.onGameLoaded();
  }

  countFishesWithFn(fn) {
    let count = 0;
    for (let i = 0; i < this.fishes.length; i++) {
      if (fn(this.fishes[i])) {
        count++;
      }
    }
    return count;
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
