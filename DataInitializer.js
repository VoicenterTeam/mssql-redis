const IoRedis = require('ioredis');
const logger = require('./logger');
const winston = require('winston');
const sql = require('mssql');
const RedisMssql = require('./redisMssql');
const Connection = require('./connection');
const EventEmitter = require('events');




class DataInitializer extends EventEmitter{
    /**
     *
     * @param {object} [options]
     * @param {object} [options.logs] - logs
     * @param {string} [options.logs.level] - Level of messages that this transport should log (default: level set on parent logger).
     * @param {string} [options.logs.filename] - The filename of the logfile to write output to.
     * @param {winston.stream} [options.logs.stream] - The WriteableStream to write output to.
     * @constructor
     */
    constructor(options = {}) {
        super();
       if(options.logs) logger.add(new winston.transports.Console(options.logs));

       this.sql = sql
    }
    /**
     *
     * @param {object} [redisString]
     * @param {string} [redisString.host] redisString.host - Host of the Redis server,
     * @param {number} [redisString.port] - Port of the Redis server
     * @param {number} [redisString.maxRetriesPerRequest]
     * @param {number} [redisString.timeToDelete]
     * @function
     */
    Redis(redisString){
        this.redisString = redisString || {
            port: 6379,
            host:'127.0.0.1'
        };

        if(!this.redisString.retryStrategy) this.redisString.retryStrategy = () => 5000;
        if(Array.isArray(this.redisString.Cluster)){
            let cluster = this.redisString.Cluster;
            delete this.redisString.Cluster;
            this.redisConn = new IoRedis.Cluster(cluster,this.redisString);
        }else {
            this.redisConn = new IoRedis(this.redisString);
        }
        this.redisConn.on('connect',(message) => {
            if(this.redisString.Cluster)
                logger.info('[Redis] Cluster started',this.redisString.Cluster)
            else
                logger.info(`[Redis] connected to ${this.redisString.host}`)
        });

        this.redisConn.on('error',(err) => {
            logger.error(`[Redis] ${err.message}`)
        });

        RedisMssql(sql.Request, this);

        return this;
    }
    /**
     *
     * @param {object} mssqlString
     * @param {string} mssqlString.user - Host of the Redis server,
     * @param {string} mssqlString.password - Port of the Redis server
     * @param {string} mssqlString.server
     * @param {string} mssqlString.database
     * @param {number} [mssqlString.reconnectTimeOut] - default 5000
     * @param {object} [mssqlString.options]
     * @param {boolean} [mssqlString.options.encrypt] - Use this if you're on Windows Azure
     * @param {object} [mssqlString.pool]
     * @param {number} [mssqlString.pool.max] The maximum number of connections there can be in the pool (default: 10).
     * @param {number} [mssqlString.pool.min]  The minimum of connections there can be in the pool (default: 0).
     * @param {number} [mssqlString.pool.idleTimeoutMillis] The Number of milliseconds before closing an unused connection (default: 30000)
     * @return pool
     */
     Connect(mssqlString){
        return new Connection(mssqlString).connect()
    }


}


module.exports = DataInitializer;
