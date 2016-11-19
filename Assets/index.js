import Exponent from 'exponent';

// We will refer to assets by a 'friendly name' such as 'splash-sound' or
// 'player-sprite', offering an additional level of indirection over the
// actual file paths.

// Map of asset names to modules. List your assets here.
const modules = {
  'boat': require('./boatsmall.png'),
  'goodfish': require('./goodfish.png'),
  'shark': require('./smallshark.png'),
  'perlin-512': require('./perlin-512.png'),
  'particle2': require('./particle2.png'),
  'water': require('./water.png'),
  'cloud': require('./cloud.png'),
  'bomb': require('./bomb.png'),
  'hook': require('./hooksmall.png'),
  'scubadiver': require('./scubadiver.png'),
}

// Export map of asset names to `Exponent.Asset` objects.
export default Object.assign({}, ...Object.keys(modules).map((name) =>
  ({ [name]: Exponent.Asset.fromModule(modules[name]) })));
