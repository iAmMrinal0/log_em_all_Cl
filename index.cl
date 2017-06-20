include node-core

slack = require '@slack/client'
instances = require './instances'
secrets = require './secrets'

token = secrets.slackToken
tableName = secrets.tableName

rtmEvents = slack.RTM_EVENTS
db = instances.DB

dbInit = do
   _ <- IO (db.run 'create table logs (channel text, user_id text, date text, message text)')


dbSave channel user timestamp userMsg = do
    _ <- IO (db.run ('insert into '+ tableName +' values (?, ?, ?, ?)') channel user timestamp userMsg)


dbFetch channel user timestamp = do
    err row <- IO (db.all ('select message from logs where channel = ?') channel)
    maybeErr err (putLine 'found error: ' err)
    return row


rtm = instances.RTM_CLIENT

defineProp rtm '_token' token

rtm.start ()

print 'Connected to Slack'


val = do
    message <- IO (rtm.on rtmEvents.MESSAGE)
    let channel = message.channel
    let user = message.user
    let userMsg = message.text
    let timestamp = message.ts
    putLine channel user timestamp userMsg
    dbSave channel user timestamp userMsg
