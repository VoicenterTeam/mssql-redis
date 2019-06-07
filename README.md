
## Getting Started

```
npm i mssql-redis
```
### config
```
    mssql: {
            user: 'username',
            password: 'password',
            server: 'host',
            database: 'db',
            requestTimeout: 300000,
            options: {
            encrypt: false
            },
            pool: {
            max : maxConnections,
            min: minConnections 
            },
            options: {
                            appName: "name"
            }
    },
    redisConfig: {
    host: 'host',
    port: 'port',
    timeToDelete: 60  //seconds to delete key Refresh every insert. 
    }
}
```

### How to use :
```
const MssqlRedis = require('mssql-redis');

let mssqlRedis = new MssqlRedis.Redis(redisConfig)
pool = await mssqlRedis.Connect(mssql)

Cache options: 
ttl : time for use cache - defualt 10 seconds
key: key for Cache (no must if you using input the key will be generated)
timeToDelete //seconds to delete key Refresh every insert. will overwrite global value 

pool().input('id',dal.sql.NVarChar,2).query('selete * from table where @id').Cache(options).then( console.log ) 


# mssql-redis using mssql request pool for more available used: 
https://www.npmjs.com/package/mssql#request



```
