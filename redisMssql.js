const sql = require('mssql');
const md5 = require('md5');
const moment = require('moment');
const logger = require('./logger');
const yj  = require('yieldable-json');
const promisify = require('util').promisify;
const _ = require('lodash/fp');
const stringifyAsync = promisify(yj.stringifyAsync);
const DalError = require('./errorHandler');


let GetDate = () =>  moment().unix().valueOf();

let UpdateExpiration = ttl => moment().add(ttl,"seconds").unix().valueOf();


module.exports = function (Request,self) {

    const query = Request.prototype.query;
    const execute = Request.prototype.execute;
    const redisConn = self.redisConn

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
    Request.prototype.type = function() {
        return this._type || 0;
    }
    Request.prototype.SetToRedis = function(rows) {
        let timeToDelete = this.timeToDelete || this.redisConn.options.timeToDelete;
        // stringifyAsync(rows).then( stringifyRow =>
        //     this.redisConn.hmset(this.key, "query:" + this.queryMd5, stringifyRow)
        // );
        this.redisConn.hmset(this.key, "query:" + this.queryMd5, JSON.stringify(rows))

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
        let forceSave = options.forceSave;
        let type = options.type === 'recordsets' ? 'recordsets' : 'recordset'

        if(cache) {
            if(cache === 'disable')
                this.isCache = false;
            else if(typeof cache === 'object')
                this.Cache(cache)
        }
        if(!command) throw new Error('command cant be null');
        this.queryMd5 = md5(command);
        if(!refresh && this.isCache && this.redisConn.status === 'ready'){
            let redisResult;
            try{
                redisResult  = await this.GetFromRedis(true);
                if(redisResult){
                    self.emit('redis',null,redisResult);
                    this._type = 2;
                    return redisResult;
                }
            }catch (e) {
                logger.error('[Redis]' ,e.message)
                self.emit('redis', new DalError(e.message,503, arguments[0]));
                //redisConn.status = 'offline'
            }
            if(redisResult === '' && forceSave){
                throw new DalError(this.key || '' + 'Redis Result is empty',404,arguments[0]);
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
            self.emit('mssql',null,recordset);
        } catch (e) {
            logger.error(`[SQL] ${e} ${arguments[0]}`);
            self.emit('mssql',new DalError(e,503,arguments[0]));
            let redisResults;
            if(this.isCache && redisConn.status === 'ready' && e.code !== 'EREQUEST')
                redisResults =  await this.GetFromRedis(false);
            if(redisResults){
                this._type = 2;
                return redisResults;
            }
            throw new DalError('Got a error from DB and cache is empty',500,arguments[0]);
        }
        if((Array.isArray(recordset) && recordset.length) || forceSave){
            if(this.isCache && this.redisConn.status === 'ready')
                this.SetToRedis(_.cloneDeep(recordset));
            this._type = 1;
            if(forceSave && !(Array.isArray(recordset) && recordset.length))
                throw new DalError(this.key || '' + 'DB Result is empty',404,arguments[0]);
            return recordset
        }else {
            throw new DalError(this.key || '' + 'DB Result is empty',404,arguments[0]);
        }

    };
};
