const fs = require('fs');
const { spawnSync } = require("child_process");
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

const runScript = (step, {env, branch, logFile}) => {
  const name = step === 'post' ? 'post-build' : step
  const scriptFile = step === 'update' ? `${__dirname}/update.sh` : `${__dirname}/env/${env.name}/${step}.sh`
  const params = branch ? [branch, logFile] : [logFile]
  if (fs.existsSync(scriptFile)) {
    log(logFile, `===== ${env.name} environment ${name} started =====`)
    const process = spawnSync(scriptFile, params, {cwd: env.path})
    if (process.stdout && process.stdout.length > 0) {
      log(logFile, `${process.stdout}`)
    }
    if (process.stderr && process.stderr.length > 0) {
      log(logFile, `== Stderr == \r\n${process.stderr}`)
    }
    if (process.error) {
      log(logFile, `error ${process.error.name}: ${process.error.message}`)
    }
    log(logFile, `The ${env.name} environment ${name} process ${process.status === 0 ? 'succeded' : 'failed'}`)
    return process.status
  } else {
    log(logFile, `No ${env.name} environment ${name} script was found`)
    return 0
  }
}

const log = (file, txt) => {
  let line = `${util.formatDate(new Date())}  `
  line += txt ? txt + '\n' : '\n'
  fs.writeFileSync(file, line, {
    flag: 'a+'
  });
}

const update = (env, branch) => {
  if (env) {
    const logName = `${__dirname}/env/${env.name}/logs/${(new Date()).getTime()}`
    const logFile = `${logName}.log`
    let status = runScript('update', {env, branch, logFile})
    if (status === 0) {
      status = runScript('build', {env, branch, logFile})
    }
    if (status === 0) {
      status = runScript('post', {env, branch, logFile})
    }
    if (status === 0) {
      log(logFile, `===== The ${env.name} environment has been updated =====`)
    } else {
      log(logFile, `===== The ${env.name} environment update failed =====`)
    }
    fs.renameSync(logFile, `${logName}-${status === null ? 1 : status}.log`)
    return status
  } else {
    console.log(`No environment is connected to the ${branch} branch`)
    return 1
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
    return update(env)
  },
  updateByBranch: (envName, branch) => {
    const env = getEnvByName(envName)
    return update(env, branch)
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