const { spawn } = require('child_process');

// Never let git wait for credentials: without a terminal it would hang forever
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }

const versionCompare = (v1, v2) => {
  const v1Arr = v1.split('.')
  const v2Arr = v2.split('.')
  if (Number(v1Arr[0] || 0) < Number(v2Arr[0] || 0)) return -1
  else if (Number(v1Arr[0] || 0) > Number(v2Arr[0] || 0)) return 1
  else if (Number(v1Arr[1] || 0) < Number(v2Arr[1] || 0)) return -1
  else if (Number(v1Arr[1] || 0) > Number(v2Arr[1] || 0)) return 1
  else if (Number(v1Arr[2] || 0) < Number(v2Arr[2] || 0)) return -1
  else if (Number(v1Arr[2] || 0) > Number(v2Arr[2] || 0)) return 1
  else return 0
}

const getEnvReleases = async (path, versioning) => {
  return new Promise((resolve, reject) => {
    const fetch = spawn('git', ['fetch'], { cwd: path, env: gitEnv })
    fetch.on('close', () => {
      const child = spawn('git', ['branch','--all', '--list'], { cwd: path, env: gitEnv })
      let err = ''
      let out = ''
      child.stdout.on('data', data => {
        out += data.toString()
      })
      child.stderr.on('data', data => {
        err += data.toString()
      })
      child.on('close', code => {
        let releases = {
          list: [],
          current: null
        }
        if (code === 0) {
          let branches = out.split(/\r?\n/).map((branch, index) => {
            let out = branch.trim()
            if (out.startsWith('* ')) {
              out = out.substring(2)
              releases.current = out
            }
            if (out.startsWith('remotes/origin/')) {
              out = out.substring(15)
            }
            return out
          })
          branches = [...new Set(branches)] //remove duplicates
          const ignore = versioning.omit ? versioning.omit.map(release => versioning.pre + release) : []
          releases.list = branches.filter((branch) => {
            const isRelease = ignore.indexOf(branch) === -1 && branch.startsWith(versioning.pre) // && validVersion(branch.substring(versioning.pre))
            if (branch === releases.current && !isRelease) {
              releases.current = null
            }
            const isPostSince = !versioning.since || (versionCompare(versioning.since, branch.substring(versioning.pre.length)) < 1)
            return isRelease && isPostSince
          }).map(release => release.substring(versioning.pre.length)).sort(versionCompare).reverse()
          if (releases.current) {
            releases.current = releases.current.substring(versioning.pre.length)
          }
          resolve(releases)
        } else {
          reject(`getEnvReleases:: "Git branch" command failed: ${err.trim()}`)
        }
      })
    })
  })
}

module.exports = { getEnvReleases }