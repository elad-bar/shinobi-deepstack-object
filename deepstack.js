const request = require("request");
const fs = require('fs');
const config = require('./conf.json')

let deepStackApiKey = null;
let objectDetectionUrl = null;
let faceListUrl = null;
let faceRecognitionUrl = null;
let detectionType = null;

const detectionTypes = {
    "face": "userid",
    "object": "label"
};

const now = () => {
    const d = new Date();

    return d.toISOString();
}

const log = (logger, message) => {
    logger(`${now()} [${config.plug}] ${message}`);
}

const logError = (message) => {
    log(console.error, message);
};

const logWarn = (message) => {
    log(console.warn, message);
};

const logInfo = (message) => {
    log(console.info, message);
};

const logDebug = (message) => {
    log(console.debug, message);
};

const loadConfiguration = (config) => {
    const deepStackHost = config.deepStack["host"];
    const deepStackPort = config.deepStack["port"];
    const deepStackIsSSL = config.deepStack["isSSL"];
    const deepStackProtocol = deepStackIsSSL ? "https" : "http";

    const baseUrl = `${deepStackProtocol}://${deepStackHost}:${deepStackPort}/v1`;
    
    deepStackApiKey = config.deepStack["apiKey"];
    objectDetectionUrl = `${baseUrl}/vision/detection`;
    faceListUrl = `${baseUrl}/vision/face/list`;
    faceRecognitionUrl = `${baseUrl}/vision/face/recognize`;

    detectionType = config.plug.split("-")[1].toLowerCase();

    logInfo(`Host: ${deepStackHost}`);
    logInfo(`Port: ${deepStackPort}`);
    logInfo(`Protocol: ${deepStackProtocol}`);
    logInfo(`API Key: ${deepStackApiKey}`);

    const startupAction = startupActions[detectionType];

    if(startupAction !== null) {
        startupAction();
    }
};

const objectDetectionStartup = () => {
    logInfo("DeepStack URL");
    logInfo(`Object Detection: ${objectDetectionUrl}`);
};

const faceDetectionStartup = () => {
    logInfo("DeepStack URL");
    logInfo(`Face List: ${faceListUrl}`);
    logInfo(`Face Recognition: ${faceRecognitionUrl}`);
    
    const requestData = getFormData(faceListUrl, {});
    const timeStart = new Date();

    request.post(requestData, function (err,res,body) {
        onFaceListResult(err, res, body, timeStart);
    });
};

const onFaceListResult = (err, res, body, timeStart) => {
    const duration = getRequestDuration(timeStart);

    try {
        const response = JSON.parse(body);

        const success = response["success"];
        const facesArr = response["faces"];
        const faceStr = facesArr.join(",");

        if(success) {
            logInfo(`DeepStack loaded with the following faces: ${faceStr}, Response time: ${duration} ms`);
        } else {
            logWarn(`Failed to connect to DeepStack server, Error: ${err}, Response time: ${duration} ms`);
        }
    } catch(ex) {
        logError(`Error while connecting to DeepStack server, Error: ${ex}, Response time: ${duration} ms`);
    }
};

const detectFrame = (d, s, buffer, frameLocation, detectorAction) => {
    if(frameLocation){
		detectorAction(frameLocation);

	} else {
		d.tmpFile = `${s.gid(5)}.jpg`;

		if(!fs.existsSync(s.dir.streams)) {
			fs.mkdirSync(s.dir.streams);
		}
		
        d.dir = `${s.dir.streams}${d.ke}/`;

		if(!fs.existsSync(d.dir)) {
			fs.mkdirSync(d.dir);
		}
	
		d.dir = `${d.dir}${d.id}/`;
        
		if(!fs.existsSync(d.dir)) {
			fs.mkdirSync(d.dir);
		}
	
		fs.writeFile(`${d.dir}${d.tmpFile}`, buffer, function(err) {
			if(err) {
                return s.systemLog(err);
            }
		
			try {
				detectorAction(d.dir+d.tmpFile);

			} catch(ex) {
				logError(`Detector failed to parse frame, Error: ${ex}`);
			}
		})
	}
};

const detect = (d, tx, frame, callback) => {
    try{
        image_stream = fs.createReadStream(frame);
        
        const form = {
            "image": image_stream
        };
        
        const url = getDetectionUrl();
        const requestData = getFormData(url, form);
        const timeStart = new Date();

        request.post(requestData, function(err, res, body){
            handleDeepStackResponse(d, tx, err, res, body, timeStart);
        });
    }catch(ex){
        logError(`Detector error, Error: ${ex}`);
    }

    callback();
};

const handleDeepStackResponse = (d, tx, err, res, body, timeStart) => {
    const duration = res.elapsedTime;
    let objects = [];
    
    try {
        if(err) {
            throw err;
        }
        
        const response = JSON.parse(body);

        const success = response["success"];

        if(success) {
            const predictions = response["predictions"];
    
            if(predictions !== null && predictions.length > 0) {
                objects = predictions.map(p => getDeepStackObject(p));

                if(objects.length > 0) {
                    const identified = objects.filter(p => p.tag !== "unknown");
                    const unknownCount = objects.length - identified.length;
                    
                    if(unknownCount > 0) {
                        logInfo(`${d.id} detected ${unknownCount} unknown ${detectionType}s, Response time: ${duration} ms`);
                    }

                    if(identified.length > 0) {
                        const detectedObjectsStrArr = identified.map(f => `${f.tag} [${f.confidence.toFixed(4)}]`);
                        const detectedObjectsStr = detectedObjectsStrArr.join(",");

                        logInfo(`${d.id} detected ${detectionType}s: ${detectedObjectsStr}, Response time: ${duration} ms`);
                    }

                    const isObjectDetectionSeparate = d.mon.detector_pam === '1' && d.mon.detector_use_detect_object === '1';
                    const width = parseFloat(isObjectDetectionSeparate && d.mon.detector_scale_y_object ? d.mon.detector_scale_y_object : d.mon.detector_scale_y);
                    const height = parseFloat(isObjectDetectionSeparate && d.mon.detector_scale_x_object ? d.mon.detector_scale_x_object : d.mon.detector_scale_x);

                    const eventData = {
                        f: 'trigger',
                        id: d.id,
                        ke: d.ke,
                        details: {
                            plug: config.plug,
                            name: d.id,
                            reason: detectionType,
                            matrices: objects,
                            imgHeight: width,
                            imgWidth: height,
                            time: duration
                        }
                    };
                    
                    tx(eventData);
                }
            }
        }
    } catch(ex) {
        logError(`Error while processing image, Error: ${ex}, Response time: ${duration} ms, Body: ${body}`);
    }

    return objects
};

const getFormData = (url, additionalParameters) => {
    const formData = {};

    if(deepStackApiKey) {
        formData["api_key"] = deepStackApiKey;
    }

    if(additionalParameters !== undefined && additionalParameters !== null) {
        const keys = Object.keys(additionalParameters);

        keys.forEach(k => formData[k] = additionalParameters[k]);
    }

    const requestData = {
        url: url,
        time: true,
        formData: formData
    };

    return requestData;
};

const getRequestDuration = (timeStart) => {
    const responseDate = new Date();

	const responseTime = (responseDate.getTime() - timeStart.getTime());

	return responseTime;
};

const getDeepStackObject = (prediction) => {
    const key = detectionTypes[detectionType];

    const tag = prediction[key];
    const confidence = prediction["confidence"];
    const y_min = prediction["y_min"];
    const x_min = prediction["x_min"];
    const y_max = prediction["y_max"];
    const x_max = prediction["x_max"];
    const width = x_max - x_min;
    const height = y_max - y_min;
    
    const obj = {
        x: x_min,
        y: y_min,
        width: width,
        height: height,
        tag: tag,
        confidence: confidence,
    };

    return obj;
};

const startupActions = {
    "face": faceDetectionStartup,
    "object": objectDetectionStartup
};

const getDetectionUrl = () => {
    const detectionUrls = {
        "face": faceRecognitionUrl,
        "object": objectDetectionUrl
    };

    const url = detectionUrls[detectionType];

    return url;
};

module.exports = {
    loadConfiguration: loadConfiguration,
    detect: detect,
    detectFrame: detectFrame
}
