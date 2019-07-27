let DAL = require('./DataInitializer');


let dal = new DAL({logs:{
        level: 'info'
    }});
dal.Redis();
let mssql = {
    user: 'sa',
    password: 'password',
    server: '127.0.0.1',
    database: 'test',
    requestTimeout: 300000,
    options: {
        encrypt: false,
        appName: "name"
    },
    pool: {
        max: 10,
        min: 1
    },
};

let StartInterval = async (useCache, interval) => {
    let pool =  await dal.Connect(mssql);
    if(useCache) pool.request();

    let timeout = () => setTimeout( () =>{

        // pool.request().query()
        pool.request().query('SELECT GETUTCDATE();',{
            key:'date'
        }).then( row => {
             console.log(row);
                timeout();
        }).catch( e => {
                // console.log(e.message)
            }
        );
        pool.request().query('SELECT GETUTCDATE();',{
            key:'date',
            ttl: 500
        })
        // pool.query('SELECT GETUTCDATE();').then( row => {
        //      console.log('2' ,row);
        //     timeout();
        // }).catch( e => {
        //         // console.log(e.message)
        //     }
        // )
    },interval);

    timeout();
};

StartInterval(true,1000);