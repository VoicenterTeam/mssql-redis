
class DalError extends Error {
    constructor(message,statusCode,query) {
        super(message);
        Error.captureStackTrace(this, DalError);
        this.statusCode = statusCode;
        this.queury = query;
    }
}

module.exports = DalError;
