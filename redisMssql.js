let sql = require('mssql');
const md5 = require('md5');
const moment = require('moment');
const logger = require('./logger');

const query = sql.Request.prototype.query;

const execute = sql.Request.prototype.execute;

let GetDate = () =>  moment().unix().valueOf();

let UpdateExpiration = ttl => moment().add(ttl,"seconds").unix().valueOf();


module.exports = (redisConn) => {
    let queryMd5;
    //this.mssqlConn = options.mssqlConn;
    if(redisConn){
        queryMd5 = md5(arguments[0]);
        /**
         *
         * @param {object} [options]
         * @param {string} options.key - key for redis
         * @param {string} [options.ttl=10] - cache ttl
         * @param {number} [options.timeToDelete]
         * @return this
         */
        sql.Request.prototype.Cache = function (options){
            if(!options) options = {};
            this.key =  JSON.stringify(options.key);
            this.ttl = options.ttl || 10;
            if(options.timeToDelete) this.timeToDelete = options.timeToDelete;

            this.isCache = true;
            return this;
        };
        sql.Request.prototype._keyMaker = function () {
            Object.keys(this.parameters).forEach( (key,i) => {
                let name = this.parameters[key].name;
                let value = this.parameters[key].value;
                if(!i) this.key = `${name}:${value}`;
                else this.key += `:${name}:${value}`;
            });
            logger.debug(`[Redis] keyMaker ${this.key}`);
            if(!this.key) throw new Error('[Error] The key cannot be null');
            return this;
        };
        sql.Request.prototype.SetToRedis = function(rows) {
            let timeToDelete = this.timeToDelete || this.redisConn.options.timeToDelete;
            this.redisConn.hmset(this.key, "query:" + this.queryMd5, JSON.stringify(rows));
            this.expiration = UpdateExpiration(this.ttl);
            this.redisConn.hmset(this.key, "expiration:" + this.queryMd5, this.expiration);
            if(Number.isInteger(timeToDelete)) this.redisConn.expire(this.key,timeToDelete);
            logger.info(`[Redis] saved in redis ${this.key} ` + this._currentRequest.parameters[0].value);

        };
        sql.Request.prototype.GetFromRedis = async function (IsExpiration){
            let date = GetDate();
            if(!this.key){
                this._keyMaker();
            }
            if(!this.expiration || !IsExpiration)
                this.expiration  = await this.redisConn.hget(this.key,"expiration:"+this.queryMd5);
            if(this.expiration > date || !IsExpiration) {
                let result = await this.redisConn.hget(this.key,"query:" + this.queryMd5);
                let parsedResult = JSON.parse(result);
                if(Array.isArray(parsedResult) && parsedResult.length > 0){
                    logger.info("[Redis] Pull data from redis ");
                    return parsedResult
                }
            }
        };
    }

    sql.Request.prototype.query = async function() {
        if(this.isCache && redisConn.status === 'ready'){
            this.queryMd5 = queryMd5;
            this.redisConn = redisConn;
           let redisResult  = await this.GetFromRedis(true);
            if(redisResult) return redisResult;
        }
        let recordset;
        try {
            let rows = await query.apply(this,arguments);
            logger.info('[MSSQL] Pull data from db');
            recordset = rows.recordset;
            if(!(Array.isArray(recordset) && recordset.length)){

            }else {
                if(this.isCache && redisConn.status === 'ready')
                    this.SetToRedis(rows.recordset);
            }
        } catch (e) {
            logger.error(`[SQL] ${e}`);
            let redisResults;
            if(redisConn.status === 'ready')
                redisResults =  await this.GetFromRedis(false);
                if(redisResults) return redisResults;
            throw new Error(`[Error] ${arguments[0]} ${e}`);
        }
        return recordset
    };

    // sql.Request.prototype.execute = async function() {
    //     let row = await execute.apply(this,arguments);
    //     console.log(row);
    // };
    return sql;
};
