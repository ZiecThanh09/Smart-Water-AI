// middleware.js
module.exports = function LoginStateMiddleware(req, res, next) {
    // Access data from index.js
    const userName = req.app.get('userName');

    // Do something with the data (e.g., logging)
    console.log('Username: ', userName);

    // You can also modify the request object or perform other tasks

    next();
};
