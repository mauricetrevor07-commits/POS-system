const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const globalErrorHandler = (err, req, res, next) => {
    console.error('server error:', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'An unexpected internal server error occurred.'
    });
};

module.exports = { asyncHandler, globalErrorHandler};