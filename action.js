const fs = require('fs');
const { spawn } = require("child_process");
const actions = require('./config').actions;
const util = require('./utils.js');

const log = (file, txt) => {
  let line = `${util.formatDate(new Date())}  `
  line += txt ? txt + '\n' : '\n'
  fs.writeFileSync(file, line, {
    flag: 'a+'
  });
}

const runScript = (action, path) => {
  const lock = `${path}/.lock`
  const scriptFile = `${path}/run.sh`
  const logName = `${path}/logs/${(new Date()).getTime()}`
  const logFile = `${logName}.log`
  if (fs.existsSync(scriptFile)) {
    const process = spawn(scriptFile, { cwd: action.root })
    process.stdout.on('data', data => {
      log(logFile, data)
    })
    process.stderr.on('data', data => {
      log(logFile, `== Stderr == \r\n${data}`)
    })
    process.on('close', code => {
      log(logFile, `==== The "${action.name}" action script ${code === 0 ? 'succeded' : 'failed'} ====`)
      fs.renameSync(logFile, `${logName}-${code === null ? 1 : code}.log`)
      fs.unlinkSync(lock)
    })
    process.on('error', err => {
      log(logFile, `error ${err.name}: ${err.message}`)
      fs.renameSync(logFile, `${logName}-1.log`)
      fs.unlinkSync(lock)
    })
  } else {
    log(logFile, `No ${action.name} script was found`)
    fs.renameSync(logFile, `${logName}-0.log`)
    fs.unlinkSync(lock)
  }
}

const execute = (actionKey, tries = 3) => {
  const action = actions.find(action => action.key === actionKey)
  if (action) {
    const path = `${__dirname}/actions/${action.key}`
    const lock = `${path}/.lock`
    if (fs.existsSync(lock)) {
      if (tries > 0) {
        setTimeout(() => {
          execute(action, --tries)
        }, 1000 * 60 * 10)
      } else {
        console.error(`Run aborted. The "${action.name}" action has been running a previous script for more than 30 minutes`)
      }
    } else {
      fs.closeSync(fs.openSync(lock, 'w'))
      runScript(action, path)
    }
  } else {
    console.log(`No action found with the key "${actionKey}"`)
  }
}

module.exports = {
  getActions: () => {
    return actions ? actions : []
  },
  execute
}