const path = require('path');
const express = require('express');
const morgan = require('morgan');
const methodOverride = require('method-override');
const { engine } = require('express-handlebars');
require('dotenv').config();
const session = require('express-session');
const msal = require('@azure/msal-node');

const Device = require('./app/models/Device.js');
const { multipleMongooseToObject } = require('./util/mongoose.js');

const SortMiddleware = require('./app/middlewares/SortMiddleware');
const LoginStateMiddleware = require('./app/middlewares/LoginStateMiddleware');

const route = require('./routes/index');
const db = require('./config/db');

// Connect to DB
db.connect();

// // Azure Storage Account
// const { BlobServiceClient } = require('@azure/storage-blob');
// const { QueueServiceClient } = require("@azure/storage-queue");

// // Chuỗi kết nối đến Azure Storage Account
// const connectionString = 'DefaultEndpointsProtocol=https;AccountName=qowateriot;AccountKey=FakFnr8inhmVK+m7L5+z1ZaABYjXFW6CgMN4nzY8CIz3azizbKymKKtQfoghAYjSwwG+7xwHjNnA+AStxxKhpQ==;EndpointSuffix=core.windows.net';
// const queueName = 'sensordata';

// const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
// const queueClient = queueServiceClient.getQueueClient(queueName);

// // Tên container và tên blob cần lấy dữ liệu
// const containerName = 'swstorage';
// var blobName = '';

// // Khởi tạo client của BlobService
// const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

// // Lấy thông tin về container
// const containerClient = blobServiceClient.getContainerClient(containerName);

// // Variables of sensor devices
// let bat, pH, wt, cond, DO, orp, TDS /*Total Dissolved Solids*/;

/**
 * Confidential Client Application Configuration
 */
const confidentialClientConfig = {
	auth: {
		clientId: process.env.APP_CLIENT_ID,
		authority: process.env.SIGN_UP_SIGN_IN_POLICY_AUTHORITY,
		clientSecret: process.env.APP_CLIENT_SECRET,
		knownAuthorities: [process.env.AUTHORITY_DOMAIN], //This must be an array
		redirectUri: process.env.APP_REDIRECT_URI,
		validateAuthority: false
	},
	system: {
		loggerOptions: {
			loggerCallback(loglevel, message, containsPii) {
				console.log(message);
			},
			piiLoggingEnabled: false,
			logLevel: msal.LogLevel.Verbose,
		}
	}
};

// Initialize MSAL Node
const confidentialClientApplication = new msal.ConfidentialClientApplication(confidentialClientConfig);

const APP_STATES = {
	LOGIN: 'login',
	LOGOUT: 'logout',
	PASSWORD_RESET: 'password_reset',
	EDIT_PROFILE: 'update_profile'
}

/** 
 * Request Configuration
 * We manipulate these two request objects below 
 * to acquire a token with the appropriate claims.
 */
const authCodeRequest = {
	redirectUri: confidentialClientConfig.auth.redirectUri,
};

const tokenRequest = {
	redirectUri: confidentialClientConfig.auth.redirectUri,
};

/**
 * Using express-session middleware. Be sure to familiarize yourself with available options
 * and set them as desired. Visit: https://www.npmjs.com/package/express-session
 */
const sessionConfig = {
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true,
	cookie: {
		secure: false, // set this to true on production
	}
}

// Create an express instance
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.use(
	express.urlencoded({
		extended: true,
	}),
);
app.use(express.json());

app.use(methodOverride('_method'));

// Custom middlewares
app.use(SortMiddleware);

// HTTP Logger
app.use(morgan('combined'));

// Template engine
app.engine(
	'hbs',
	engine({
		extname: '.hbs',
		helpers: {
			sum: (a, b) => a + b,
			sortable: (field, sort) => {
				const sortType = field === sort.column ? sort.type : 'default';

				const icons = {
					default: 'oi oi-elevator',
					asc: 'oi oi-sort-ascending',
					desc: 'oi oi-sort-descending',
				};
				const types = {
					default: 'desc',
					asc: 'desc',
					desc: 'asc',
				};
				const type = types[sortType];
				const icon = icons[sortType];

				return `<a href="?_sort&column=${field}&type=${type}"><span class="${icon}"></span></a>`;
			},
		},
	}),
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'resources', 'views'));

//usse session configuration 
app.use(session(sessionConfig));

var hbs = require('handlebars');
hbs.registerHelper("compareStrings", function (p, q, options) {
	return p == q ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper("isOr", function (cond1, cond2, options) {
	return cond1 || cond2 ? options.fn(this) : options.inverse(this);
});

/**
 * This method is used to generate an auth code request
 * @param {string} authority: the authority to request the auth code from 
 * @param {array} scopes: scopes to request the auth code for 
 * @param {string} state: state of the application
 * @param {Object} res: express middleware response object
 */
const getAuthCode = (authority, scopes, state, res) => {

	// prepare the request
	console.log("Fetching Authorization code")
	authCodeRequest.authority = authority;
	authCodeRequest.scopes = scopes;
	authCodeRequest.state = state;

	//Each time you fetch Authorization code, update the relevant authority in the tokenRequest configuration
	tokenRequest.authority = authority;

	// request an authorization code to exchange for a token
	return confidentialClientApplication.getAuthCodeUrl(authCodeRequest)
		.then((response) => {
			console.log("\nAuthCodeURL: \n" + response);
			//redirect to the auth code URL/send code to 
			res.redirect(response);
		})
		.catch((error) => {
			res.status(500).send(error);
		});
}

//<ms_docref_app_endpoints>
app.get('/', (req, res, next) => {
	Device.find({})
		.then((devices) =>
			res.render('home', {
				devices: multipleMongooseToObject(devices),
				showSignInButton: true,
			}),
		)
		.catch(next);
});

app.get('/signin', (req, res) => {
	//Initiate a Auth Code Flow >> for sign in
	//no scopes passed. openid, profile and offline_access will be used by default.
	getAuthCode(process.env.SIGN_UP_SIGN_IN_POLICY_AUTHORITY, [], APP_STATES.LOGIN, res);
});

/**
 * Change password end point
*/
app.get('/password', (req, res) => {
	getAuthCode(process.env.RESET_PASSWORD_POLICY_AUTHORITY, [], APP_STATES.PASSWORD_RESET, res);
});

/**
 * Edit profile end point
*/
app.get('/profile', (req, res) => {
	getAuthCode(process.env.EDIT_PROFILE_POLICY_AUTHORITY, [], APP_STATES.EDIT_PROFILE, res);
});

/**
 * Sign out end point
*/
app.get('/signout', async (req, res) => {
	logoutUri = process.env.LOGOUT_ENDPOINT;
	req.session.destroy(() => {
		//When session destruction succeeds, notify B2C service using the logout uri.
		res.redirect(logoutUri);
	});
});

app.get('/redirect', (req, res) => {

	//determine the reason why the request was sent by checking the state
	if (req.query.state === APP_STATES.LOGIN) {
		//prepare the request for authentication        
		tokenRequest.code = req.query.code;
		confidentialClientApplication.acquireTokenByCode(tokenRequest).then((response) => {

			req.session.sessionParams = { user: response.account, idToken: response.idToken };
			console.log("\nAuthToken: \n" + JSON.stringify(response));
			localStorage.setItem('authToken', JSON.stringify(response));
			Device.find({}).then((devices) =>
				res.render('home', {
					devices: multipleMongooseToObject(devices),
					showSignInButton: false,
					givenName: response.account.idTokenClaims.given_name,
				}),
			);
			var userName = response.account.idTokenClaims.given_name;
			app.set('Username', userName);
			route(app);
		}).catch((error) => {
			console.log("\nErrorAtLogin: \n" + error);
		});
	} else if (req.query.state === APP_STATES.PASSWORD_RESET) {
		//If the query string has a error param
		if (req.query.error) {
			//and if the error_description contains AADB2C90091 error code
			//Means user selected the Cancel button on the password reset experience 
			if (JSON.stringify(req.query.error_description).includes('AADB2C90091')) {
				//Send the user home with some message
				//But always check if your session still exists
				Device.find({}).then((devices) =>
					res.render('home', {
						devices: multipleMongooseToObject(devices),
						showSignInButton: false,
						givenName: req.session.sessionParams.user.idTokenClaims.given_name,
						message: 'User has cancelled the operation',
					}),
				);
				route(app);
			}
		} else {

			Device.find({}).then((devices) =>
				res.render('home', {
					devices: multipleMongooseToObject(devices),
					showSignInButton: false,
					givenName: req.session.sessionParams.user.idTokenClaims.given_name,
				}),
			);
			route(app);
		}

	} else if (req.query.state === APP_STATES.EDIT_PROFILE) {

		tokenRequest.scopes = [];
		tokenRequest.code = req.query.code;

		//Request token with claims, including the name that was updated.
		confidentialClientApplication.acquireTokenByCode(tokenRequest).then((response) => {
			req.session.sessionParams = { user: response.account, idToken: response.idToken };
			console.log("\AuthToken: \n" + JSON.stringify(response));
			Device.find({}).then((devices) =>
				res.render('home', {
					devices: multipleMongooseToObject(devices),
					showSignInButton: false,
					givenName: response.account.idTokenClaims.given_name,
				}),
			);
			route(app);
		}).catch((error) => {
			//Handle error
		});
	} else {
		res.status(500).send('We do not recognize this response!');
	}

});

app.use(LoginStateMiddleware);

// async function receiveMessages() {
// 	while (true) {
// 		const response = await queueClient.receiveMessages({ numberOfMessages: 1 });
// 		const messages = response.receivedMessageItems;

// 		for (const message of messages) {
// 			// Chuyển đổi Base64 thành Buffer
// 			const buffer = Buffer.from(message.messageText, 'base64');

// 			// Chuyển đổi Buffer thành chuỗi JSON
// 			const jsonData = buffer.toString('utf8');

// 			// Parse chuỗi JSON thành đối tượng JavaScript
// 			// const jsonObject = JSON.parse(jsonData);

// 			const startStr = jsonData.search('water-test-iot-hub');
// 			const endStr = jsonData.search("json");

// 			blobName = jsonData.slice(startStr, endStr + 4);

// 			console.log(blobName);

// 			return readData();
// 		}
// 	}
// }

// // Hàm chuyển đổi readable stream thành string
// async function streamToString(readableStream) {
// 	return new Promise((resolve, reject) => {
// 		const chunks = [];
// 		readableStream.on('data', (data) => {
// 			chunks.push(data.toString());
// 		});
// 		readableStream.on('end', () => {
// 			resolve(chunks.join(''));
// 		});
// 		readableStream.on('error', reject);
// 	});
// }

// // Read data from the queue
// async function readData() {
// 	// Lấy thông tin về blob
// 	const blobClient = containerClient.getBlobClient(blobName);

// 	// Tải dữ liệu từ blob
// 	const downloadResponse = await blobClient.download();
// 	const downloadedData = await streamToString(downloadResponse.readableStreamBody);

// 	// Print raw data
// 	// console.log('Dữ liệu từ blob:', downloadedData);

// 	const startLocation = downloadedData.length / 2;
// 	const endLocation = downloadedData.length;

// 	var data = downloadedData.slice(startLocation, endLocation);

// 	// Parse chuỗi JSON thành đối tượng JavaScript
// 	const jsonObject = JSON.parse(data);

// 	// Get Body of data
// 	const decodedData = atob(jsonObject.Body);

// 	// Parse to Json data
// 	const temp = JSON.parse(decodedData);

// 	const obj = { data: [] };

// 	for (let i = 0; i < 6; i++) {
// 		obj.data[i] = temp.data[i];
// 		if (obj.data[i].sensor === "WT") {
// 			wt = parseFloat(obj.data[i].value);
// 		} else if (obj.data[i].sensor === "DO") {
// 			DO = parseFloat(obj.data[i].value);
// 		} else if (obj.data[i].sensor === "COND") {
// 			cond = parseFloat(obj.data[i].value);
// 		} else if (obj.data[i].sensor === "ORP") {
// 			orp = parseFloat(obj.data[i].value);
// 		} else if (obj.data[i].sensor === "PH") {
// 			pH = parseFloat(obj.data[i].value);
// 		} else if (obj.data[i].sensor === "BAT") {
// 			bat = parseFloat(obj.data[i].value);
// 		}
// 	}

// 	return AICalculate();
// }

// // AI Training
// async function AICalculate() {

// }

// receiveMessages();

// Route init
route(app);

app.listen(process.env.SERVER_PORT, () => {
	console.log(`App listening on port ${process.env.SERVER_PORT}`);
});