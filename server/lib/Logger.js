const winston = require("winston");

const level = process.env.LOG_LEVEL || 'debug';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	defaultMeta: { service: 'Singaling-Service' },
	transports: [
	  //
	  // - Write to all logs with level `info` and below to `combined.log` 
	  // - Write all logs error (and below) to `error.log`.
	  new winston.transports.Console({level: level,timestamp: function () {
			return (new Date()).toISOString();
		}
		}),
	//   new winston.transports.File({ filename: 'error.log', level: 'error' }),
	//   new winston.transports.File({ filename: 'combined.log' })
	]
  });


  
module.exports = logger