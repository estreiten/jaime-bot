const config = require('./config');
const envManager = require('./env.js');
const actionManager = require('./action.js');

const express = require('express');
const app = express();

app.use(express.json({extended: true}))
app.use(express.urlencoded({extended: true}))

const authorized = (req) => {
  const token = req.query.token
  return !config.token || token === config.token
}

app.get('/', async (req, res) => {
  try {
    if (authorized(req)) {
      let info = {
        env: envManager.getEnvironments(),
        actions: actionManager.getActions()
      }
      if (!!config.name) {
        info.name = config.name
      }
      res.send(info).status(200)
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.post('/update', async (req, res) => {
  try {
    console.log('update trigger received for', req.body.env)
    if (authorized(req)) {
      if (!!req.body.env && Object.keys(config.env).indexOf(req.body.env) > -1) {
        if (!!req.body.branch) {
          envManager.updateByBranch(req.body.env, req.body.branch)
        } else {
          envManager.updateByEnvName(req.body.env)
        }
        res.sendStatus(200)
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.get('/log', async (req, res) => {
  try {
    if (authorized(req)) {
      if ((!!req.query.env || !!req.query.action) && !!req.query.date) {
        const manager = !!req.query.env ? envManager : actionManager
          const key = !!req.query.env ? req.query.env : req.query.action
          res.sendFile(manager.getLogPath(key, req.query.date), {root: '.'})
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.get('/logs', async (req, res) => {
  try {
    if (authorized(req)) {
      if (!!req.query.env || !!req.query.action) {
        const manager = !!req.query.env ? envManager : actionManager
        const key = !!req.query.env ? req.query.env : req.query.action
        const list = manager.getLogList(key)
        res.send(list)
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.post('/action', (req, res) => {
  try {
    console.log('action trigger received for', req.body.key)
    if (authorized(req)) {
      if (!!req.body.key && config.actions.some(action => action.key === req.body.key)) {
        if (req.body.retries !== undefined) {
          actionManager.execute(req.body.key, req.body.retries)
        } else {
          actionManager.execute(req.body.key)
        }
        res.sendStatus(200)
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.post('/toggle', (req, res) => {
  try {
    console.log('toggle action received for', req.body.key)
    if (authorized(req)) {
      if (!!req.body.key && config.actions.some(action => action.key === req.body.key && !!action.cron)) {
        actionManager.toggle(req.body.key)
        res.sendStatus(200)
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

app.get('/paused', (req, res) => {
  try {
    console.log('action paused query received for', req.body.key)
    if (authorized(req)) {
      if (!!req.body.key && config.actions.some(action => action.key === req.body.key && !!action.cron)) {
        res.send(actionManager.isPaused(req.body.key))
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(403)
    }
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
})

const port = config.port || 80
app.listen(port, () => {
  console.log(`Jaime bot listening on ${port}`)
})