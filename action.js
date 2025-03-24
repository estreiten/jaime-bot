const fs = require('fs');
const os = require('os');
const { spawn } = require("child_process");
const actions = require('./config').actions;
const notifierService = require('./notifier');
const util = require('./utils.js');

const log = (file, txt) => {
  let line = `${new Date().toUTCString()}\n`
  line += txt ? txt + '\n' : '\n'
  fs.writeFileSync(file, line, {
    flag: 'a+'
  });
}

const afterScript = (code, logFile, logName, action, path, lock) => {
  const result = code === 0 ? 'succeded' : code === 10 ? 'succeded, re-run requested' : code === 3 ? 'succeded with warnings' : 'failed'
  log(logFile, `==== The "${action.name}" action script ${result} ====`)
  const newLog = `${logName}-${code === null ? 1 : code}.log`
  fs.renameSync(logFile, newLog)
  if (code === 10) {
    runScript(action, path)
  } else {
    fs.unlinkSync(lock)
    notifierService.notifyAction(code === 0 ? 'ok' : code === 3 ? 'warn' : 'fail', action, newLog)
  }
}

const errorHandler = (err, logFile) => {
  console.error(err)
  log(logFile, `== Error == \r\n${err.name}: ${err.message}`)
}

const runScript = async (action, path) => {
  const lock = `${path}/.lock`
  const scriptFile = `${path}/run.sh`
  const logName = `${path}/logs/${(new Date()).getTime()}`
  const logFile = `${logName}.log`
  if (fs.existsSync(scriptFile)) {
    log(logFile, `The "${action.name}" action script is starting`)
    const isWin = os.platform() === "win32"
    const spawnParams = isWin ? { shell: true } : {}
    let hasWarning = false
    if (action.root) {
      spawnParams.cwd = action.root
    }
    const process = spawn(scriptFile, spawnParams)
    process.stdout.on('data', data => {
      log(logFile, data)
    })
    process.stderr.on('data', data => {
      const errorRx = /error|fatal|failed|exception|critical/i
      const warnRx = /warning|deprecated|caution|notice/i
      let title = 'Stderr output'
      if (errorRx.test(data)) {
        title = 'Error'
        process.exitCode = 1
      } else if (warnRx.test(data)) {
        title = 'Warning'
        hasWarning = true
      }
      log(logFile, `== ${title} == \r\n${data}`)
      if (process.exitCode === 1) {
        process.kill()
      }
    })
    process.on('uncaughtException', (err) => {
      errorHandler(err, logFile, logName, lock, action)
      process.exitCode = 1
      process.kill()
    })
    process.on('unhandledRejection', (reason, promise) => {
      errorHandler(err, logFile, logName, lock, action)
      process.exitCode = 1
      process.kill()
    })
    process.on('close', code => {
      afterScript(hasWarning ? 3 : code, logFile, logName, action, path, lock)
    })
    process.on('error', err => {
      errorHandler(err, logFile, logName, lock, action)
      process.exitCode = 1
      process.kill()
    })
  } else {
    const nodeFile = `${path}/run.js`
    if (fs.existsSync(nodeFile)) {
      const run = require(nodeFile)
      const code = await run(log, logFile, [])
      afterScript(code, logFile, logName, action, path, lock)
    } else {
      log(logFile, `No ${action.name} script was found`)
      fs.renameSync(logFile, `${logName}-0.log`)
      fs.unlinkSync(lock)
    }
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
  getLogList: (actionKey) => {
    const logsPath = `${__dirname}/actions/${actionKey}/logs`
    const logFiles = fs.readdirSync(logsPath)
    return logFiles.map(logFile => logFile.substring(0, logFile.length - 4)) //remove file extension
  },
  isPaused
}