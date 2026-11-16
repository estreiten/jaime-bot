const os = require('os')
const { spawn } = require('child_process')
const config = require('./config')

const isWin = os.platform() === 'win32'
const bashPath = config.bash || 'C:\\Program Files\\Git\\bin\\bash.exe'

// Runs a .sh script without an intermediate shell, so its arguments are never interpreted.
// Windows: handed to Git Bash. Linux: run directly (needs its shebang and execute permission).
const spawnScript = (scriptFile, args = [], cwd) => {
  const options = cwd ? { cwd } : {}
  if (isWin) {
    return spawn(bashPath, [scriptFile.replace(/\\/g, '/'), ...args], options)
  }
  return spawn(scriptFile, args, options)
}

// Windows: kill() only ends bash.exe; taskkill /T also ends whatever the script launched.
const killScript = (child) => {
  if (isWin && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
  } else {
    child.kill()
  }
}

module.exports = { spawnScript, killScript }