const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const config = require('./config')

const isWin = os.platform() === 'win32'
const bashPath = config.bash || 'C:\\Program Files\\Git\\bin\\bash.exe'

// Windows: Git Bash runs each command through an intermediate process that exits right away,
// so the commands are orphans for Windows and taskkill /T can't reach them. Git Bash does keep
// them in the script's process group, so the wrapper writes the bash PID (MSYS numbering) to a
// file and then becomes the script (exec keeps the PID); killScript kills that whole group.
const WIN_WRAPPER = 'printf "%s" "$$" > "$JAIME_PIDFILE"; exec /usr/bin/bash "$0" "$@"'
const WIN_KILL_GROUP = 'pgid=$(cat "/proc/$0/pgid" 2>/dev/null) && kill -9 -- "-$pgid" 2>/dev/null; kill -9 "$0" 2>/dev/null; true'

// Runs a .sh script without an intermediate shell, so its arguments are never interpreted.
// Windows: handed to Git Bash. Linux: run directly (needs its shebang and execute permission).
const spawnScript = (scriptFile, args = [], cwd) => {
  const options = cwd ? { cwd } : {}
  if (!isWin) {
    return spawn(scriptFile, args, options)
  }
  const pidFile = path.join(os.tmpdir(), `jaime-${crypto.randomUUID()}.pid`).replace(/\\/g, '/')
  options.env = { ...process.env, JAIME_PIDFILE: pidFile }
  const child = spawn(bashPath, ['-c', WIN_WRAPPER, scriptFile.replace(/\\/g, '/'), ...args], options)
  child.pidFile = pidFile
  child.on('close', () => fs.rm(pidFile, { force: true }, () => {}))
  return child
}

const taskkill = (child) => {
  spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    .on('error', () => {})
}

// Windows: kill the script's whole process group through Git Bash, then taskkill /T
// for anything left on the Windows side (or as a fallback if the PID file isn't there).
const killScript = (child) => {
  if (!isWin || !child.pid) {
    return child.kill()
  }
  let msysPid = ''
  try {
    msysPid = fs.readFileSync(child.pidFile, 'utf8').trim()
  } catch (e) {}
  if (!/^\d+$/.test(msysPid)) {
    return taskkill(child)
  }
  let done = false
  const finish = () => {
    if (!done) {
      done = true
      taskkill(child)
    }
  }
  const killer = spawn(bashPath, ['-c', WIN_KILL_GROUP, msysPid], { windowsHide: true })
  killer.on('error', finish)
  killer.on('close', finish)
}

module.exports = { spawnScript, killScript }