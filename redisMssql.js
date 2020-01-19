const sql = require('mssql');
const md5 = require('md5');
const moment = require('moment');
const logger = require('./logger');
const yj  = require('yieldable-json');
const promisify = require('util').promisify;
const _ = require('lodash/fp');
const stringifyAsync = promisify(yj.stringifyAsync);


let GetDate = () =>  moment().unix().valueOf();

let UpdateExpiration = ttl => moment().add(ttl,"seconds").unix().valueOf();


module.exports = (Request, redisConn) => {

    const query = Request.prototype.query;
    const execute = Request.prototype.execute;

    /**
     *
     * @param {object} [options]
     * @param {string} options.key - key for redis
     * @param {string} [options.ttl=10] - cache ttl
     * @param {number} [options.timeToDelete]
     * @return this
     */
    Request.prototype.Cache = function (options = {}){
        this.redisConn = redisConn;
        this.key =  options.key.replace(/\s/g, '');
        this.ttl = options.ttl || 10;
        if(options.timeToDelete) this.timeToDelete = options.timeToDelete;
        if(!this.redisConn)
            logger.error('[Redis] Not supply redis connection string but try using cache');
        else
            this.isCache = true;
        return this;
    };
    Request.prototype._keyMaker = function () {
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
    Request.prototype.SetToRedis = function(rows) {
        let timeToDelete = this.timeToDelete || this.redisConn.options.timeToDelete;
        stringifyAsync(rows).then( stringifyRow =>
            this.redisConn.hmset(this.key, "query:" + this.queryMd5, stringifyRow)
        );

        this.expiration = UpdateExpiration(this.ttl);
        this.redisConn.hmset(this.key, "expiration:" + this.queryMd5, this.expiration);
        if(Number.isInteger(timeToDelete)) this.redisConn.expire(this.key,timeToDelete);
        logger.debug(`[Redis] saved in redis`, {command:this._currentRequest.parameters[0].value ,
            key:this.key,
            Md5:this.queryMd5
        });

    };
    Request.prototype.GetFromRedis = async function (checkExpiration){
        let date = GetDate();
        if(!this.key){
            this._keyMaker();
        }
        if(!this.expiration && checkExpiration) {
            this.expiration = await this.redisConn.hget(this.key, "expiration:" + this.queryMd5)
        }
        if( !checkExpiration || this.expiration > date) {
            let result = await this.redisConn.hget(this.key,"query:" + this.queryMd5);
            if(!result) return result;
            let parsedResult = JSON.parse(result);
            if(Array.isArray(parsedResult) && parsedResult.length > 0){
                logger.debug("[Redis] Pull data from redis",parsedResult);
                return parsedResult
            }
        }
    };

    /**
     * @param {string} command
     * @param {Cache} cache
     * @return this
     */
    Request.prototype.query = async function(command,options = {}) {
        let cache = options.cache;
        let refresh = options.refresh;
        let type = options.type === 'recordsets' ? 'recordsets' : 'recordset'

        if(cache) {
            if(cache === 'disable')
                this.isCache = false;
            else if(typeof cache === 'object')
                this.Cache(cache)
        }
        if(!command) throw new Error('command cant be null');
        this.queryMd5 = md5(command);
        if(!refresh && this.isCache && redisConn.status === 'ready'){
            try{
                let redisResult  = await this.GetFromRedis(true);
                if(redisResult) return redisResult;
            }catch (e) {
                logger.error('[Redis]' ,e.message)
                //redisConn.status = 'offline'
            }
        }
        let recordset =  null;
        try {
            let rows = await query.apply(this,arguments);
            recordset = rows[type];
            logger.debug('[MSSQL] Pull data from db',{
                command,
                recordset
            });
        } catch (e) {
            logger.error(`[SQL] ${e}`);
            let redisResults;
            if(this.isCache && redisConn.status === 'ready' && e.code !== 'EREQUEST')
                redisResults =  await this.GetFromRedis(false);
            if(redisResults) return redisResults;
            throw new Error(`[Error] ${arguments[0]}  ${e}`);
        }
        if((Array.isArray(recordset) && recordset.length)){
            if(this.isCache && redisConn.status === 'ready')
                this.SetToRedis(_.cloneDeep(recordset));
            return recordset
        }else {
            throw Error('not found')
        }

    };
};
