let winston  = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            name: 'console.info',
            silent:true
        })
    ]
});




module.exports = logger;