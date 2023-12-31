const Device = require('../models/Device');
const Data = require('../models/Data');

const { mongooseToObject } = require('../../util/mongoose');

let { PythonShell } = require('python-shell');

// Azure Storage Account
const { BlobServiceClient } = require('@azure/storage-blob');
const { QueueServiceClient } = require("@azure/storage-queue");

// Chuỗi kết nối đến Azure Storage Account
const connectionString = 'DefaultEndpointsProtocol=https;AccountName=qowstorage;AccountKey=lpqA6X57NSTYa1u8Sh79E5CrJ+wP7inKo4IzEcayNqeR13M0GegJrr2wnZuLQQ/PM21bM5OtYFck+ASt2gUE3Q==;EndpointSuffix=core.windows.net';
const queueName = 'sensordata';

const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
const queueClient = queueServiceClient.getQueueClient(queueName);

// Tên container và tên blob cần lấy dữ liệu
const containerName = 'sensor-data';
var blobName = '';

// Khởi tạo client của BlobService
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

// Lấy thông tin về container
const containerClient = blobServiceClient.getContainerClient(containerName);

// Variables of sensor devices
let bat, pH, wt, cond, DO, orp, TDS /*Total Dissolved Solids*/ ;

// async function receiveMessages() {
// 	const response = await queueClient.receiveMessages({ numberOfMessages: 1 });
// 	const messages = response.receivedMessageItems;

// 	if (messages.length > 0) {
// 		for (const message of messages) {
// 			// Chuyển đổi Base64 thành Buffer
// 			const buffer = Buffer.from(message.messageText, 'base64');

// 			// Chuyển đổi Buffer thành chuỗi JSON
// 			const jsonData = buffer.toString('utf8');

// 			// Parse chuỗi JSON thành đối tượng JavaScript
// 			// const jsonObject = JSON.parse(jsonData);

// 			const startStr = jsonData.search('water-quality-iot-hub');
// 			const endStr = jsonData.search("json");

// 			blobName = jsonData.slice(startStr, endStr + 4);

// 			// Xóa message sau khi xử lý
// 			await queueClient.deleteMessage(message.messageId, message.popReceipt);

// 			return readData();
// 		}
// 	}
// 	else return readData();
// }

// Read data from the queue
async function readData() {
    // Lấy thông tin về blob
    const blobClient = containerClient.getBlobClient('water-quality-iot-hub/00/2023/12/14/02/30.json');

    // Tải dữ liệu từ blob
    const downloadResponse = await blobClient.download();
    const downloadedData = await streamToString(downloadResponse.readableStreamBody);

    // Print raw data
    // console.log('Dữ liệu từ blob:', downloadedData);

    const startLocation = downloadedData.length / 2;
    const endLocation = downloadedData.length;

    var data = downloadedData.slice(startLocation, endLocation);

    // Parse chuỗi JSON thành đối tượng JavaScript
    const jsonObject = JSON.parse(data);

    // Get Body of data
    const decodedData = atob(jsonObject.Body);

    // Parse to Json data
    const temp = JSON.parse(decodedData);

    const obj = { data: [] };

    for (let i = 0; i < 6; i++) {
        obj.data[i] = temp.data[i];
        if (obj.data[i].sensor === "WT") {
            wt = parseFloat(obj.data[i].value);
        } else if (obj.data[i].sensor === "DO") {
            DO = parseFloat(obj.data[i].value);
        } else if (obj.data[i].sensor === "COND") {
            cond = parseFloat(obj.data[i].value);
        } else if (obj.data[i].sensor === "ORP") {
            orp = parseFloat(obj.data[i].value);
        } else if (obj.data[i].sensor === "PH") {
            pH = parseFloat(obj.data[i].value);
        } else if (obj.data[i].sensor === "BAT") {
            bat = parseFloat(obj.data[i].value);
        }
    }

    TDS = cond * 1000 / 2;

    const inputData = [pH, TDS, 0, 0, 0, cond, 0, 0, 0]; // Replace with your actual input data

    let options = {
        mode: 'text',
        pythonOptions: ['-u'], // unbuffered output
        scriptPath: 'D://Downloads//Smart-Water-Monitoring-master//src//app//pythonshell', // Replace with the actual path
        args: inputData.map(String)
    };

    let status = getStatus(pH, DO, TDS);
    obj.data.push(status);

    // PythonShell.run('python_script.py', options).then(messages => {
    // 	// results is an array consisting of messages collected during execution
    // 	let potability = getPotability(JSON.stringify(messages));
    // 	obj.data.push(potability);
    // 	console.log(obj);
    // });

    //console.log(obj.data);
    return obj.data;
}

// Hàm chuyển đổi readable stream thành string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data.toString());
        });
        readableStream.on('end', () => {
            resolve(chunks.join(''));
        });
        readableStream.on('error', reject);
    });
}

function updateData() {
    let data = {};
    data.battery = bat;
    data.pH = pH;
    data.temperature = wt;
    data.conductivity = cond;
    data.do = DO;
    data.orp = orp;
    data.TDS = TDS;
    return data;
}

// Predict quality from trained model
function getStatus(pH, DO, TDS) {
    if (pH < 6 || pH > 8.5 || orp >= -0.5 || DO >= 0.0004 || cond < 50 || cond > 1500) {
        let obj = { status: 'Unsafe' };
        return obj;
    }
    let obj = { status: 'Safe' };
    return obj;
}

function saveData() {
    let data = {};
    data.pH = pH;
    data.temperature = wt;
    data.conductivity = cond;
    data.do = DO;
    data.orp = orp;
    data.tds = TDS;
    return data;
}

// Predict quality from trained model
function getPotability(message) {
    if (message === '["[1]"]') {
        let obj = { potability: 'Drinkable' };
        return obj;
    }
    let obj = { status: 'Undrinkable' };
    return obj;
}

class DeviceController {
    // [GET] /devices/:slug
    show(req, res, next) {
        readData().then((devices) => {
            res.render('devices/show', { devices });
        }).catch(next);

        Device.updateOne({ slug: req.params.slug }, updateData(), {
            deletedAt: req.params.deletedAt,
        }).catch(next);
    }

    // [GET] /devices/create
    create(req, res, next) {
        res.render('devices/create');
    }

    // [POST] /devices/store
    store(req, res, next) {
        const device = new Device(req.body);
        device
            .save()
            .then(() => res.redirect('/me/stored/devices'))
            .catch(next);
    }

    // [GET] /devices/:id/edit
    edit(req, res, next) {
        Device.findById(req.params.id)
            .then((device) =>
                res.render('devices/edit', {
                    device: mongooseToObject(device),
                }),
            )
            .catch(next);
    }

    // [PUT] /devices/:id
    update(req, res, next) {
        Device.updateOne({ _id: req.params.id }, req.body, {
                deletedAt: req.params.deletedAt,
            })
            .then(() => res.redirect('/me/stored/devices'))
            .catch(next);
    }

    // [DELETE] /devices/:id
    delete(req, res, next) {
        Device.delete({ _id: req.params.id })
            .then(() => res.redirect('back'))
            .catch(next);
    }

    // [DELETE] /devices/:id/force
    forceDelete(req, res, next) {
        Device.deleteOne({ _id: req.params.id })
            .then(() => res.redirect('back'))
            .catch(next);
    }

    // [PATCH] /devices/:id/restore
    restore(req, res, next) {
        Device.restore({ _id: req.params.id })
            .then(() => res.redirect('back'))
            .catch(next);
    }

    // [POST] /devices/handle-form-actions
    handleFormActions(req, res, next) {
        switch (req.body.action) {
            case 'delete':
                Device.delete({ _id: { $in: req.body.courseIds } })
                    .then(() => res.redirect('back'))
                    .catch(next);
                break;

            default:
                res.json({ message: 'Unknown action!' });
        }
    }
}

module.exports = new DeviceController();