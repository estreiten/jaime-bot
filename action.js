const fs = require('fs');
const { spawnSync } = require("child_process");
const actions = require('./config').actions;

module.exports = {
  getActions: () => {
    return actions ? actions : []
  },
  execute: (actionKey) => {
    const action = actions.find(action => action.key === actionKey)
    if (action) {
      const scriptFile = `${__dirname}/actions/${action.key}/run.sh`
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