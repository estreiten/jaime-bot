const config = require('./config');
const envManager = require('./env.js');

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
      res.send(envManager.getEnvironments()).status(200)
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
          res.sendStatus(envManager.updateByBranch(req.body.env, req.body.branch) === 0 ? 200 : 500)
        } else {
          res.sendStatus(envManager.updateByEnvName(req.body.env) === 0 ? 200 : 500)
        }
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
      if (!!req.query.env && !!req.query.date) {
        res.sendFile(envManager.getLogPath(req.query.env, req.query.date), {root: '.'})
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