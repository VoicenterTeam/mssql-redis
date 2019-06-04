
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
    ttl: 'global ttl'
    }
}
```

### How to use :
```
const DAL = require('mssql-redis');

let dal = new dal.Redis(redisConfig)
pool = await dal.Connect(mssql)

pool().query('queryString').Cashe({ttl,key}).then( console.log ) 

https://www.npmjs.com/package/mssql#request



```
