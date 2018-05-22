const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
//util has a function called Promisify, which takes any function that accepts callback and it makes it return a Promise
client.hget = util.promisify(client.hget); //we are passing a refernce to Promisify function

const exec = mongoose.Query.prototype.exec;
//console.log('exec from cahce.js ', exec);

//Adding custom function to the prototype chain, so that every query  instance can make use of it
mongoose.Query.prototype.cache = function (options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');

    //to make this function chainnable function call we return this
    return this;
};



//This function runs when any time any query is run from our application, we are over riding the mongoose 'exec' function
mongoose.Query.prototype.exec = async function () {
    //console.log(this.getQuery()); //returns current query executed
    //console.log(this.mongooseCollection.name); //returns collection name in which query is being executed

    if (!this.useCache) {
        return exec.apply(this, arguments);
    }
    //creating unique key, to store in Redis
    const key = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }));

    //check if we have value for 'key' in redis,
    const cacheValue = await client.hget(this.hashKey, key);

    //if yes, return the value
    if (cacheValue) {
        const doc = JSON.parse(cacheValue);
        return Array.isArray(doc) ? doc.map(d => new this.model(d)) : new this.model(doc);
    }

    //otherwise, issue the query and store the result in redis 
    const result = await exec.apply(this, arguments); //return value from exec is actual document,stored in 'result' variable, try 'result.validate' 
    //convert result to JSON before storing in redis,
    client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);

    return result;
};

module.exports = {
  clearHash(hashKey){
      client.del(JSON.stringify(hashKey));
  }
}


/*
NOTE:
'exec' function expects values to be returned as 'Mongoose Model', so when value fetched from the redis i.e 'cacheValue', we 
need to convert into mongoose model.
To do so we use constructor function called 'new this.model()'.   
*/