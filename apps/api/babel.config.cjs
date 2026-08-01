// Solo para Jest: transforma a CommonJS los .mjs de node_modules que Jest no
// puede requerir tal cual (better-auth y su familia de dependencias son ESM
// puro, sin build CJS alternativo — jest.config.js). El build real de la app
// (nest build) no usa Babel — TypeScript/tsc sigue siendo el compilador.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
