const fs = require('fs');
const os = require('os');
const { spawn } = require("child_process");
const util = require('./utils.js');
const environments = require('./config').env;

const getEnvByName = (name) => {
  for (const envName in environments) {
    if (Object.hasOwnProperty.call(environments, envName)) {
      if (name === envName) {
        let env = environments[envName];
        env.name = envName
        return env
      }
    }
  }
  return false
}

const runScript = (step, {env, branch, logName, lock}, next) => {
  const name = step === 'post' ? 'post-build' : step
  const scriptFile = step === 'update' ? `${__dirname}/update.sh` : `${__dirname}/env/${env.name}/${step}.sh`
  const logFile = `${logName}.log`
  const params = branch ? [branch, logFile] : [logFile]
  if (fs.existsSync(scriptFile)) {
    log(logFile, `===== ${env.name} environment ${name} started =====`)
    const isWin = os.platform() === "win32"
    const spawnParams = isWin ? { shell: true } : {}
    if (env.path) {
      spawnParams.cwd = env.path
    }
    const process = spawn(scriptFile, params, spawnParams)
    process.stdout.on('data', data => {
      log(logFile, data)
    })
    process.stderr.on('data', data => {
      log(logFile, `== Stderr == \r\n${data}`)
    })
    process.on('close', code => {
      log(logFile, `The ${env.name} environment ${name} process ${code === 0 ? 'succeded' : 'failed'}`)
      if (code === 0) {
        if (next && next.length > 0) {
          runScript(next.shift(), {env, branch, logName, lock}, next)
        } else {
          log(logFile, `===== The ${env.name} environment has been updated =====`)
          fs.renameSync(logFile, `${logName}-${code === null ? 1 : code}.log`)
          if (branch) {
            console.log(`${branch} branch processing finished`)
          }
          fs.unlinkSync(lock)
        }
      } else {
        log(logFile, `===== The ${env.name} environment update failed =====`)
        fs.renameSync(logFile, `${logName}-${code === null ? 1 : code}.log`)
        fs.unlinkSync(lock)
      }
    })
    process.on('error', err => {
      log(logFile, `error ${err.name}: ${err.message}`)
      fs.renameSync(logFile, `${logName}-1.log`)
      fs.unlinkSync(lock)
    })
  } else {
    log(logFile, `No ${env.name} environment ${name} script was found`)
    fs.renameSync(logFile, `${logName}-0.log`)
    fs.unlinkSync(lock)
  }
}

const log = (file, txt) => {
  let line = `${new Date().toUTCString()}  `
  line += txt ? txt + '\n' : '\n'
  fs.writeFileSync(file, line, {
    flag: 'a+'
  });
}

const update = (env, branch, tries = 3) => {
  if (env) {
    const path = `${__dirname}/env/${env.name}`
    const lock = `${path}/.lock`
    if (fs.existsSync(lock)) {
      if (tries > 0) {
        setTimeout(() => {
          update(env, branch, --tries)
        }, 1000 * 60 * 10)
      } else {
        console.error(`Run aborted. The ${env.name} environment has been running a previous script for more than 30 minutes`)
      }
    } else {
      fs.closeSync(fs.openSync(lock, 'w'))
      const logName = `${__dirname}/env/${env.name}/logs/${(new Date()).getTime()}`
      runScript('update', {env, branch, logName, lock}, ['build','post'])
    }
  } else {
    console.log(`No environment is connected to the ${branch} branch`)
  }
}

const getEnvLogs = (envName) => {
  let logs = []
  const logsPath = `${__dirname}/env/${envName}/logs`
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
  updateByEnvName: (envName) => {
    const env = getEnvByName(envName)
    update(env)
  },
  updateByBranch: (envName, branch) => {
    const env = getEnvByName(envName)
    update(env, branch)
  },
  getEnvironments: () => {
    let envs = []
    for (const envName in environments) {
      if (Object.hasOwnProperty.call(environments, envName)) {
        let env = environments[envName];
        env.name = envName
        env.logs = getEnvLogs(envName)
        envs.push(env)
      }
    }
    return envs
  },
  getLogPath: (env, date) => {
    const logsPath = `${__dirname}/env/${env}/logs`
    const logFiles = fs.readdirSync(logsPath)
    const logFile = logFiles.find(logFile => logFile.startsWith(date))
    return `env/${env}/logs/${logFile}`
  }
}