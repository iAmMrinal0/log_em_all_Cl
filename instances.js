const slack = require('@slack/client')
const sqlite3 = require('sqlite3')
const dbName = require('./secrets').dbName

const RTM_CLIENT = new slack.RtmClient()
const DB = new sqlite3.Database(dbName)

module.exports = {RTM_CLIENT, DB}
