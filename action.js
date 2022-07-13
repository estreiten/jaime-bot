const fs = require('fs');
const os = require('os');
const { spawn } = require("child_process");
const actions = require('./config').actions;
const util = require('./utils.js');

const log = (file, txt) => {
  let line = `${new Date().toUTCString()}\n`
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
    log(logFile, `The "${action.name}" action script is starting`)
    const isWin = os.platform() === "win32"
    const spawnParams = isWin ? { shell: true } : {}
    if (action.root) {
      spawnParams.cwd = action.root
    }
    const process = spawn(scriptFile, spawnParams)
    process.stdout.on('data', data => {
      log(logFile, data)
    })
    process.stderr.on('data', data => {
      log(logFile, `== Stderr == \r\n${data}`)
    })
    process.on('close', code => {
      log(logFile, `==== The "${action.name}" action script ${code === 0 ? 'succeded' : code === 10 ? 'succeded, re-run requested' : 'failed'} ====`)
      fs.renameSync(logFile, `${logName}-${code === null ? 1 : code}.log`)
      if (code === 10) {
        runScript(action, path)
      } else {
        fs.unlinkSync(lock)
      }
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

const toggle = (actionKey) => {
  const action = actions.find(action => action.key === actionKey)
  if (action) {
    const path = `${__dirname}/actions/${action.key}`
    const pause = `${path}/.pause`
    if (fs.existsSync(pause)) {
      fs.unlinkSync(pause)
    } else {
      fs.closeSync(fs.openSync(pause, 'w'))
    }
  } else {
    console.log(`No action found with the key "${actionKey}"`)
  }
}

const isPaused = (actionKey) => {
  const action = actions.find(action => action.key === actionKey)
  if (action && !!action.cron) {
    const path = `${__dirname}/actions/${action.key}`
    const pause = `${path}/.pause`
    return fs.existsSync(pause)
  } else {
    console.log(`No cron action found with the key "${actionKey}"`)
    return false
  }
}

const getLogs = (actionKey) => {
  let logs = []
  const logsPath = `${__dirname}/actions/${actionKey}/logs`
  const logFiles = fs.readdirSync(logsPath)
  for (let index = 0; index < logFiles.length; index++) {
    const logFile = logFiles[index];
    const separator = logFile.indexOf('-');
    const ext = logFile.indexOf('.log');
    logs.push({
      date: separator > -1 ? logFile.substring(0, separator) : logFile.substring(0, ext),
      status: separator > -1 ? logFile.substring(separator + 1, ext) : -1
    })
  }
  return logs.sort((logA, logB) => logB.date - logA.date)
}

module.exports = {
  getActions: () => {
    return actions ? actions.map(action => {
      action.logs = getLogs(action.key)
      if (!!action.cron) {
        action.isPaused = isPaused(action.key)
      }
      return action
    }) : []
  },
  execute,
  toggle,
  getLogPath: (actionKey, date) => {
    const logsPath = `${__dirname}/actions/${actionKey}/logs`
    const logFiles = fs.readdirSync(logsPath)
    const logFile = logFiles.find(logFile => logFile.startsWith(date))
    return `actions/${actionKey}/logs/${logFile}`
  },
  isPaused
}