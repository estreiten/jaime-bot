const fs = require('fs');
const os = require('os');
const { spawnScript } = require('./runner');
const util = require('./utils.js');
const notifierService = require('./notifier');
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

const endScript = (env, logName, lock, code, branch, error) => {
  const logFile = `${logName}.log`
  const endMsg = `===== The ${env.name} environment ${code === 0 ? 'has been updated' : 'update failed'} =====`
  if (error) {
    log(logFile, `error ${error.name}: ${error.message}`)
  }
  log(logFile, endMsg)
  const newLog = `${logName}-${code === null ? 1 : code}.log`
  fs.renameSync(logFile, newLog)
  if (branch) {
    console.log(`${branch} branch processing finished`)
  }
  fs.unlinkSync(lock)
  notifierService.notifyEnv(code === 0 ? 'ok' : 'fail', env, branch, newLog)
}

const runScript = (step, {env, branch, logName, lock}, next) => {
  const name = step === 'post' ? 'post-build' : step
  const scriptFile = step === 'update' ? `${__dirname}/update.sh` : `${__dirname}/env/${env.name}/${step}.sh`
  const logFile = `${logName}.log`
  const params = branch ? [branch, logFile] : [logFile]
  if (fs.existsSync(scriptFile)) {
    log(logFile, `===== ${env.name} environment ${name} started =====`)
    const child = spawnScript(scriptFile, params, env.path)
    child.stdout.on('data', data => {
      log(logFile, data)
    })
    child.stderr.on('data', data => {
      log(logFile, `== Stderr == \r\n${data}`)
    })
    child.on('close', code => {
      log(logFile, `The ${env.name} environment ${name} process ${code === 0 ? 'succeded' : 'failed'}`)
      if (code === 0) {
        if (next && next.length > 0) {
          runScript(next.shift(), {env, branch, logName, lock}, next)
        } else {
          endScript(env, logName, lock, code, branch)
        }
      } else {
        endScript(env, logName, lock, code)
      }
    })
    child.on('error', err => {
      endScript(env, logName, lock, null, branch, err)
    })
  } else {
    log(logFile, `No ${env.name} environment ${name} script was found`)
    endScript(env, logName, lock, 0, branch)
  }
}

const log = (file, txt) => {
  let line = `${new Date().toUTCString()}\n`
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
  },
  getLogList: (env) => {
    const logsPath = `${__dirname}/env/${env}/logs`
    const logFiles = fs.readdirSync(logsPath)
    return logFiles.map(logFile => logFile.substring(0, logFile.length - 4)) //remove file extension
  }
}