const mobileConfig = require("./lighthouserc.cjs");

module.exports = {
  ci: {
    ...mobileConfig.ci,
    collect: {
      ...mobileConfig.ci.collect,
      additive: true,
      settings: {
        preset: "desktop",
      },
    },
  },
};
