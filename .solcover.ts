module.exports = {
  skipFiles: ['test', 'interfaces'],
  istanbulReporter: ['text', 'text-summary'],
  modifierWhitelist: ['initializer', 'onlyInitializing'],
  mocha: {
    grep: "gas",
    invert: true
  }
};