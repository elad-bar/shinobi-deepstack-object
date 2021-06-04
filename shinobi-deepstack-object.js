//
// Shinobi - DeepStack Object Detection Plugin
// Copyright (C) 2021 Elad Bar
//
// Base Init >>
const { spawn } = require('child_process');
const fs = require('fs');
const request = require("request");
const moment = require('moment');
const config = require('./conf.json');

let s = null;

const {
		workerData
	} = require('worker_threads');

if(workerData && workerData.ok === true) {

	try {
		s = require('../pluginWorkerBase.js')(__dirname, config);

	} catch(err) {
		console.log(err);

		try {
			s = require('./pluginWorkerBase.js')(__dirname, config);

		} catch(err) {
			console.log(err);
			
            return console.log(config.plug, 'WORKER : Plugin start has failed. pluginBase.js was not found.');
		}
	}
} else {
	try {
		s = require('../pluginBase.js')(__dirname, config);
	} catch(err) {
		console.log(err);

		try {
			s = require('./pluginBase.js')(__dirname, config);

		} catch(err) {
			console.log(err);
			
            return console.log(config.plug, 'Plugin start has failed. pluginBase.js was not found.');
		}
	}

	const {
		haltMessage,
		checkStartTime,
		setStartTime,
	} = require('../pluginCheck.js');

	if(!checkStartTime()) {
		console.log(haltMessage, new Date());
		s.disconnectWebSocket();
		return;
	}

	setStartTime();
}
// Base Init />>

let detectorSettings = null;

const CLEANUP_MINUTES = 60;
const INITIAL_CLEANUP_INTERVAL = 30 * 1000;
const CLEANUP_INTERVAL = CLEANUP_MINUTES * 60 * 1000;

const CLEANUP_PATTERN = `${config.plug}-*.jpg`;

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

const log = (logger, message) => {
    logger(`${moment()} [${config.plug}] ${message}`);
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

const postMessage = (data) => {
    const message = JSON.stringify(data);

	logInfo(message);
};

const initialize = () => {
    const deepStackProtocol = PROTOCOLS[config.deepStack.isSSL];
    
    baseUrl = `${deepStackProtocol}://${config.deepStack.host}:${config.deepStack.port}/v1`;
    
    const detectionType = config.plug.split("-")[1].toLowerCase();
    const detectorConfig = DETECTOR_CONFIGUTATION[detectionType];
    const detectorConfigKeys = Object.keys(detectorConfig);
    const cleanupScriptPath = `${process.cwd()}/plugins/deepstack-${detectionType}/CLEANUP.sh`;

    detectorSettings = {
        type: detectionType,
        active: false,
        baseUrl: baseUrl,
        apiKey: config.deepStack.apiKey,
		cleanupScriptPath: cleanupScriptPath
    };

	if (!fs.existsSync(cleanupScriptPath)) {
		fs.writeFileSync(
			cleanupScriptPath,
			`find "${s.dir.streams}" -type f -name "${CLEANUP_PATTERN}" -mmin +${CLEANUP_MINUTES - 1}  -exec rm -f {} \\;`
		);
	}
    
    setTimeout(cleanup, INITIAL_CLEANUP_INTERVAL);
    setInterval(cleanup, CLEANUP_INTERVAL);

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
			
			const pluginMessage = {
				f: `pluginLoaded`,
				msg: `${config.plug} loaded`,
				time: moment()
			};

			detectorSettingsKeys.forEach(k => pluginMessage[k] = detectorSettings[k]);

			postMessage(pluginMessage);

            if (detectorSettings.active) {
                s.detectObject = detectObject;

                if(detectionType === DETECTOR_TYPE_FACE) {
                    const requestData = getFormData(detectorSettings.startupEndpoint);
                    
                    request.post(requestData, (errStartup, resStartup, bodyStartup) => {
                        onFaceListResult(errStartup, resStartup, bodyStartup);
                    });
                }
            }            
        } catch(ex) {
            logError(`Failed to initialize ${config.plug} plugin, Error: ${ex}`)
        }
    });
};

const detectObject = (buffer, d, tx, frameLocation, callback) => {
	if(!detectorSettings.active) {
        return;
    }

    if(frameLocation){
		processImage(d, tx, fullPath, callback);

	} else {
        const dirCreationOptions = {
            recursive: true
        };

        d.dir = `${s.dir.streams}${d.ke}/${d.id}/`;
        d.tmpFile = detectorSettings.filePattern.replace("*", moment().format());

        const fullPath = `${d.dir}${d.tmpFile}`;

        if(!fs.existsSync(d.dir)) {
			fs.mkdirSync(d.dir, dirCreationOptions);
		}
		
        fs.writeFile(fullPath, buffer, function(err) {
			if(err) {
                return s.systemLog(err);
            }
		
			try {
				processImage(d, tx, fullPath, callback);

			} catch(ex) {
				logError(`Detector failed to parse frame, Error: ${ex}`);
			}
		});
	}
};

const processImage = async (d, tx, framePath, callback) => {
	try{
		image_stream = fs.createReadStream(framePath);
		
		const form = {
			image: image_stream
		};
		
		const requestData = getFormData(detectorSettings.detectEndpoint, form);
		
		request.post(requestData, (err, res, body) => {
			onImageProcessed(d, tx, err, res, body, framePath);
		});
	}catch(ex){
		logError(`Failed to process image, Error: ${ex}`);
	}

	callback();
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

const onImageProcessed = (d, tx, err, res, body, framePath) => {
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

const cleanup = function(){
    try {
        let listing = spawn('sh', [detectorSettings.cleanupScriptPath]);

        listing.stderr.on('data', d => logError(d.toString()));

        listing.on('close', (code) => {
            setTimeout(() => {
                listing.kill('SIGTERM');
                
                postMessage({
                    f: 'cleanupJobCompleted',
                    msg: `${config.plug} Cleanup completed`,
                    time: moment(),
                });

            }, 100);
        });

    } catch(err) {
        logError(`Cleanup failed, Error: ${err}`);
    }
}

initialize();