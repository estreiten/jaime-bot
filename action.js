const fs = require('fs');
const { spawnSync } = require("child_process");
const actions = require('./config').actions;

module.exports = {
  getActions: () => {
    return actions ? actions.map(action => action.name) : []
  },
  execute: (actionName) => {
    const action = actions.find(action => action.name === actionName)
    if (action) {
      const scriptFile = `${__dirname}/actions/${action.script}`
      if (fs.existsSync(scriptFile)) {
        const process = spawnSync(scriptFile)
        return process.status
      } else {
        return 0
      }
    } else {
      return -1
    }
  }
}