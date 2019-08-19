const logger = require('./logger');
const sql = require('mssql');

class Connection {
    constructor(mssqlString){
        this.mssqlString = mssqlString;
        this.mssqlString.reconnectTimeOut = mssqlString.reconnectTimeOut || 5000;
    }
    connect(){
        this.pool = new sql.ConnectionPool(this.mssqlString);
        return this.pool.connect().then(pool => {
            logger.info('[SQL] connected to ' + this.pool.config.server);
            return pool
        }).catch(err => {
            logger.error(`[SQL] ${this.pool.config.server} - ${err}`);
            this.reconnect();
            return this.pool;
        })
    }
    reconnect() {
        if(!this.isReconnecting && !this.pool.connected){
            this.isReconnecting = true;
            this._reconnect();
        }
    }
    _reconnect() {
        setTimeout(() => {
            this.pool.connect().then(() => {
                logger.info('[SQL] reconnected ' + this.pool.config.server);
                this.isReconnecting = false;
            }).catch((err) => {
                logger.error(`[SQL] ${this.pool.config.server} - ${err}`);
                if(err.code === 'EALREADYCONNECTED'){
                    this.isReconnecting = false;
                    return;
                }
                this._reconnect();
            })
        }, this.pool.config.reconnectTimeOut)
    }
}

module.exports = Connection