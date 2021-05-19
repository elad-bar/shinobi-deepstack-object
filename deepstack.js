const request = require("request");
var fs = require('fs');
var config = require('./conf.json')

var deepStackApiKey = null;
var objectDetectionUrl = null;
var faceListUrl = null;
var faceRecognitionUrl = null;

const loadConfiguration = (config) => {
    var deepStackHost = config.deepStack["host"];
    var deepStackPort = config.deepStack["port"];
    var deepStackIsSSL = config.deepStack["isSSL"];
    var deepStackProtocol = deepStackIsSSL ? "https" : "http";

    var baseUrl = `${deepStackProtocol}://${deepStackHost}:${deepStackPort}/v1`;
    
    deepStackApiKey = config.deepStack["apiKey"];
    objectDetectionUrl = `${baseUrl}/vision/detection`;
    faceListUrl = `${baseUrl}/vision/face/list`;
    faceRecognitionUrl = `${baseUrl}/vision/face/recognize`;

    console.log(`Host: ${deepStackHost}`);
    console.log(`Port: ${deepStackPort}`);
    console.log(`Protocol: ${deepStackProtocol}`);
    console.log(`API Key: ${deepStackApiKey}`);

    console.log("DeepStack URL");
    console.log(`Face List: ${faceListUrl}`);
    console.log(`Face Recognition: ${faceRecognitionUrl}`);
    console.log(`Object Detection: ${objectDetectionUrl}`);

    if(config.plug === "DeepStack-Face") {
        startUp();
    }
};

const getFormData = (url, additionalParameters) => {
    var formData = {};

    if(deepStackApiKey) {
        formData["api_key"] = deepStackApiKey;
    }

    if(additionalParameters !== undefined && additionalParameters !== null) {
        var keys = Object.keys(additionalParameters);

        keys.forEach(k => formData[k] = additionalParameters[k]);
    }

    var requestData = {
        url: url,
        formData: formData
    };

    return requestData;
};

const getRequestDuration = (timeStart) => {
    var responseDate = new Date();

	var responseTime = (responseDate.getTime() - timeStart.getTime());

	return responseTime;
};

const getDeepStackObject = (prediction, tagName) => {
    var label = prediction[tagName];
    var confidence = prediction["confidence"];
    var y_min = prediction["y_min"];
    var x_min = prediction["x_min"];
    var y_max = prediction["y_max"];
    var x_max = prediction["x_max"];
    var width = x_max - x_min;
    var height = y_max - y_min;
    
    var obj = {
        x: x_min,
        y: y_min,
        width: width,
        height: height,
        tag: label,
        confidence: confidence,
    };

    return obj;
};

const publishEvent = (d, reason, duration, matrices, tx) => {
    var isObjectDetectionSeparate = d.mon.detector_pam === '1' && d.mon.detector_use_detect_object === '1'
    var width = parseFloat(isObjectDetectionSeparate  && d.mon.detector_scale_y_object ? d.mon.detector_scale_y_object : d.mon.detector_scale_y)
    var height = parseFloat(isObjectDetectionSeparate  && d.mon.detector_scale_x_object ? d.mon.detector_scale_x_object : d.mon.detector_scale_x)

    var eventData = {
        f:'trigger',
        id:d.id,
        ke:d.ke,
        details: {
            plug: config.plug,
            name: d.id,
            reason: reason,
            matrices: matrices,
            imgHeight: width,
            imgWidth: height,
            time: duration
        }
    };
    
    tx(eventData);
};

const onFaceListResult = (err, res, body, timeStart) => {
    var duration = getRequestDuration(timeStart);

    try {
        var response = JSON.parse(body);

        var success = response["success"];
        var facesArr = response["faces"];
        var faceStr = facesArr.join(",");

        if(success) {
            console.log(`DeepStack loaded with the following faces: ${faceStr}, Response time: ${duration} ms`);
        } else {
            console.log(`Failed to connect to DeepStack server, Error: ${err}, Response time: ${duration} ms`);
        }
    } catch(ex) {
        console.log(`Error while connecting to DeepStack server, Error: ${ex}, Response time: ${duration} ms`);
    }
};

const onFaceRecognitionResult = (err, res, body, timeStart, d, tx) => {
    var duration = getRequestDuration(timeStart);
    
    try {
        if(err) {
            throw err;
        }
        
        var response = JSON.parse(body);

        var success = response["success"];

        if(success) {
            var predictions = response["predictions"];
            var faces = [];

            if(predictions !== null && predictions.length > 0) {
                faces = predictions.map(p => getDeepStackObject(p, "userid"));
            }

            var unknownFacesCount = faces.filter(p => p.tag === "unknown").length;
            var identifiedFaces = faces.filter(p => p.tag !== "unknown");

            if(unknownFacesCount > 0) {
                console.log(`${unknownFacesCount} unknown faces detected by ${d.id}, Response time: ${duration} ms`);
            }

            if(identifiedFaces.length > 0) {
                var identifiedFacesStrArr = identifiedFaces.map(f => `${f.tag}: ${f.confidence}`);
                var identifiedFacesStr = identifiedFacesStrArr.join(",");

                console.log(`${d.id} identified faces: ${identifiedFacesStr}, Response time: ${duration} ms`);
            }

            var shouldTrigger = faces !== null && faces.length > 0;

            if (shouldTrigger) {
                publishEvent(d, "face", duration, faces, tx);
            }
        }
    } catch(ex) {
        console.log(`${config.plug} Error while processing image, Error: ${ex}, Response time: ${duration} ms, Body: ${body}`);
    }
};

const onObjectDetetctionResult = (err, res, body, timeStart, d, tx) => {
    var duration = getRequestDuration(timeStart);
    
    try {
        if(err) {
            throw err;
        }
        
        var response = JSON.parse(body);

        var success = response["success"];

        if(success) {
            var predictions = response["predictions"];
            var objects = [];

            if(predictions !== null && predictions.length > 0) {
                objects = predictions.map(p => getDeepStackObject(p, "label"));
            }

            if(objects.length > 0) {
                var detectedObjectsStrArr = objects.map(f => `${f.tag}: ${f.confidence}`);
                var detectedObjectsStr = detectedObjectsStrArr.join(",");

                console.log(`${d.id} detected objects: ${detectedObjectsStr}, Response time: ${duration} ms`);
                
                publishEvent(d, "object", duration, objects, tx);
            }
        }
    } catch(ex) {
        console.log(`${config.plug} Error while processing image, Error: ${ex}, Response time: ${duration} ms, Body: ${body}`);
    }
};

const faceRecognition = (d, frame, tx, callback) => {
    try{
        image_stream = fs.createReadStream(frame);
        
        var form = {
            "image": image_stream
        };
        
        var requestData = getFormData(faceRecognitionUrl, form);
        var timeStart = new Date();

        request.post(requestData, function(err, res, body){
            onFaceRecognitionResult(err, res, body, timeStart, d, tx);
        });
    }catch(ex){
        console.log(`Detector error, Error: ${ex}`);
    }

    callback();
};

const objectDetection = (d, frame, tx, callback) => {
    try{
        image_stream = fs.createReadStream(frame);
        
        var form = {
            "image": image_stream
        };
        
        var requestData = getFormData(objectDetectionUrl, form);
        var timeStart = new Date();

        request.post(requestData, function(err, res, body){
            onObjectDetetctionResult(err, res, body, timeStart, d, tx);
        });
    }catch(ex){
        console.log(`Detector error, Error: ${ex}`);
    }

    callback();
};

const detectFrame = (buffer, frameLocation, detectorAction, d, s) => {
    if(frameLocation){
		detectorAction(frameLocation);

	} else {
		d.tmpFile = s.gid(5) + '.jpg';

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
				detectorAction(d.dir+d.tmpFile)
			} catch(ex) {
				console.error(`Detector failed to parse frame, Error: ${buffer}`);
			}
		})
	}
};

const startUp = () => {
    var requestData = getFormData(faceListUrl, {});
    var timeStart = new Date();

    request.post(requestData, function (err,res,body) {
        onFaceListResult(err, res, body, timeStart);
    });
};

module.exports = {
    loadConfiguration: loadConfiguration,
    faceRecognition: faceRecognition,
    objectDetection: objectDetection,
    detectFrame: detectFrame
}
