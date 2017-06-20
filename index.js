class IOCore {
  constructor (ioFunc) {
    this.then = cb => ioFunc((...args) => cb(...args));
  };

  map (transform) {
    let saveThen = this.then;
    this.then = cb => {
      saveThen((...args) => {
        let result = transform(...args);
        if (result !== undefined) {
          if (Array.isArray(result)) {
            cb(...result);
          } else {
            cb(result);
          }
        }
      });
    };
    return this;
  };

  bind (ioFunc) {
    let saveThen = this.then;
    this.then = cb => {
      saveThen((...args) => {
        if (args !== undefined) {
          let _args = ioFunc.length < args.length ? args.slice(0, ioFunc.length) : args;
          let cbReturn = ioFunc(..._args);
          if (cbReturn !== undefined) {
            let cbReturnLen = cbReturn.length;
            let io = cbReturn[cbReturnLen - 1];
            let argsForCb = cbReturn.slice(0, cbReturnLen - 1);
            io.then((...ioargs) => cb(...argsForCb, ...ioargs));
          }
        }
      });
    };
    return this;
  };

  static timer (s) {
    var intervalId;
    var timer = new IOCore(cb => {
      intervalId = setInterval(cb, Math.floor(s * 1000))
    });
    timer.clear = () => clearInterval(intervalId);
    return timer;
  };

  static createIO (ioFunc) {
    return new IOCore(ioFunc);
  };
};
const readline = require('readline');

const rlConfig = {
  input: process.stdin,
  output: process.stdout
}; /* Config for readline interface */

class IO extends IOCore {
  static getLine (str) {
    const rl = readline.createInterface(rlConfig);
    return new IO(cb => rl.question(str, cb))
      .map(data => {
        rl.close();
        return data;
      });
  };

  static putLine (...data) {
    return new IO(cb => process.nextTick(cb, data))
      .map(data => {
        console.log(...data);
        return data
      });
  };
};


global.IO = IO

const slack = require('@slack/client');
const instances = require('./instances');
const secrets = require('./secrets');
const token = secrets.slackToken;
const tableName = secrets.tableName;
const rtmEvents = slack.RTM_EVENTS;
const db = instances.DB;
const dbInit = IO.createIO(cb => db.run('create table logs (channel text, user_id text, date text, message text)', cb)).then(() => []);
const dbSave = (channel, user, timestamp, userMsg) => IO.createIO(cb => db.run('insert into ' + tableName + ' values (?, ?, ?, ?)', channel, user, timestamp, userMsg, cb)).then(() => []);
const dbFetch = (channel, user, timestamp) => IO.createIO(cb => db.all('select message from logs where channel = ?', channel, cb)).map((err, row) => {
  if (err instanceof Error) {
    (IO.putLine('found error: ', err).then(() => null))
    return
  }
  return [row]
});
const rtm = instances.RTM_CLIENT;
Object.defineProperty(rtm, '_token', {
  value: token,
  enumerable: true,
  writable: false,
  configurable: false
});
rtm.start();
console.log('Connected to Slack');
const val = IO.createIO(cb => rtm.on(rtmEvents.MESSAGE, cb)).bind(message => {
  let channel = message.channel;
  let user = message.user;
  let userMsg = message.text;
  let timestamp = message.ts;
  return [
    message,
    channel,
    user,
    userMsg,
    timestamp,
    IO.putLine(channel, user, timestamp, userMsg)
  ]
}).then((message, channel, user, userMsg, timestamp) => {
  dbSave(channel, user, timestamp, userMsg)
})
