const request = require("request");
const fs = require('fs');
const config = require('./conf.json');

let detectorSettings = null;

const DETECTOR_TYPE_FACE = 'face';
const DETECTOR_TYPE_OBJECT = 'object';

const FACE_UNKNOWN = 'unknown';
const DEEPSTACK_API_KEY = 'api_key';

const DETECTOR_CONFIGUTATION = {
    face: {
        detectEndpoint: '/vision/face/recognize',
        startupEndpoint: '/vision/face/list',
        key: 'userid'
    },
    object: {
        detectEndpoint: '/vision/detection',
        key: 'label'
    }
}

const PROTOCOLS = {
    true: "https",
    false: "http"
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
    const deepStackProtocol = PROTOCOLS[config.deepStack.isSSL];
    
    baseUrl = `${deepStackProtocol}://${config.deepStack.host}:${config.deepStack.port}/v1`;
    
    const detectionType = config.plug.split("-")[1].toLowerCase();
    const detectorConfig = DETECTOR_CONFIGUTATION[detectionType];
    const detectorConfigKeys = Object.keys(detectorConfig);

    detectorSettings = {
        type: detectionType,
        active: false,
        baseUrl: baseUrl,
        apiKey: config.deepStack.apiKey
    };

    detectorConfigKeys.forEach(k => detectorSettings[k] = detectorConfig[k]);

    const testRequestData = getFormData(detectorSettings.detectEndpoint);
    
    request.post(testRequestData, (err, res, body) => {
        try {
            if(err) {
                throw err;
            }
            
            const response = JSON.parse(body);
                
            detectorSettings.active = !response.error.endsWith('endpoint not activated');

            const detectorSettingsKeys = Object.keys(detectorSettings);

            logInfo("----------------------------------------------------");
            logInfo(`DeepStack ${detectionType}`);
            logInfo("----------------------------------------------------");
            
            detectorSettingsKeys.forEach(k => logInfo(`    ${k}: ${detectorSettings[k]}`));

            if(!detectorSettings.active) {
                lofError(`${detetctorType} is not supported by DeepStack server`);
            }

            logInfo("----------------------------------------------------");

            if(detectorSettings.active && detectionType === DETECTOR_TYPE_FACE) {
                const requestData = getFormData(detectorSettings.startupEndpoint);
                
                request.post(requestData, (errStartup, resStartup, bodyStartup) => {
                    onFaceListResult(errStartup, resStartup, bodyStartup);
                });
            }
        } catch(ex) {
            logError(`Failed to load configuration for ${detectionType}, Error: ${ex}`)
        }
    });
};

const onFaceListResult = (err, res, body) => {
    const duration = res.elapsedTime;

    try {
        const response = JSON.parse(body);

        const success = response.success;
        const facesArr = response.faces;
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
    if(!detectorSettings.active) {
        return;
    }

    if(frameLocation){
		detectorAction(frameLocation);

	} else {
        const dirCreationOptions = {
            recursive: true
        };

		d.dir = `${s.dir.streams}${d.ke}/${d.id}/`;
        d.tmpFile = `${s.gid(5)}.jpg`;

        const fullPath = `${d.dir}${d.tmpFile}`;

        if(!fs.existsSync(d.dir)) {
			fs.mkdirSync(d.dir, dirCreationOptions);
		}
		
        fs.writeFile(fullPath, buffer, function(err) {
			if(err) {
                return s.systemLog(err);
            }
		
			try {
				detectorAction(fullPath);

			} catch(ex) {
				logError(`Detector failed to parse frame, Error: ${ex}`);
			}
		})
	}
};

const detect = (d, tx, framePath, callback) => {
    try{
        image_stream = fs.createReadStream(framePath);
        
        const form = {
            image: image_stream
        };
        
        const requestData = getFormData(detectorSettings.detectEndpoint, form);
        
        request.post(requestData, (err, res, body) => {
            handleDeepStackResponse(d, tx, err, res, body, framePath);
        });
    }catch(ex){
        logError(`Detector error, Error: ${ex}`);
    }

    callback();
};

const handleDeepStackResponse = (d, tx, err, res, body, framePath) => {
    const duration = res.elapsedTime;
    let objects = [];
    
    try {
        if(err) {
            throw err;
        }
        
        const response = JSON.parse(body);

        const success = response.success;

        if(success) {
            const predictions = response.predictions;
    
            if(predictions !== null && predictions.length > 0) {
                objects = predictions.map(p => getDeepStackObject(p, framePath));

                if(objects.length > 0) {
                    const identified = objects.filter(p => p.tag !== FACE_UNKNOWN);
                    const unknownCount = objects.length - identified.length;
                    
                    if(unknownCount > 0) {
                        logInfo(`${d.id} detected ${unknownCount} unknown ${detectorSettings.type}s, Response time: ${duration} ms`);
                    }

                    if(identified.length > 0) {
                        const detectedObjectsStrArr = identified.map(f => `${f.tag} [${f.confidence.toFixed(4)}]`);
                        const detectedObjectsStr = detectedObjectsStrArr.join(",");

                        logInfo(`${d.id} detected ${detectorSettings.type}s: ${detectedObjectsStr}, Response time: ${duration} ms`);
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
                            reason: detectorSettings.type,
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

const getFormData = (endpoint, additionalParameters) => {
    const formData = {};

    if(detectorSettings.apiKey) {
        formData[DEEPSTACK_API_KEY] = detectorSettings.apiKey;
    }

    if(additionalParameters !== undefined && additionalParameters !== null) {
        const keys = Object.keys(additionalParameters);

        keys.forEach(k => formData[k] = additionalParameters[k]);
    }

    const requestData = {
        url: `${detectorSettings.baseUrl}${endpoint}`,
        time: true,
        formData: formData
    };

    return requestData;
};

const getDeepStackObject = (prediction, framePath) => {
    const tag = prediction[detectorSettings.key];
    const confidence = prediction.confidence;
    const y_min = prediction.y_min;
    const x_min = prediction.x_min;
    const y_max = prediction.y_max;
    const x_max = prediction.x_max;
    const width = x_max - x_min;
    const height = y_max - y_min;
    
    const obj = {
        x: x_min,
        y: y_min,
        width: width,
        height: height,
        tag: tag,
        confidence: confidence,
        path: framePath
    };

    return obj;
};

module.exports = {
    loadConfiguration: loadConfiguration,
    detect: detect,
    detectFrame: detectFrame
};
