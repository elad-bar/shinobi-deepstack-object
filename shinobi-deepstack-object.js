//
// Shinobi - DeepStack Face Recognition Plugin
// Copyright (C) 2021 Elad Bar
//
// Base Init >>
var config = require('./conf.json')
var s
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

var ds = require('./deepstack.js');

s.detectObject = function(buffer, d, tx, frameLocation, callback) {
	var detectorAction = async function(frame) {
		ds.objectDetection(d, frame, tx, callback);
	};

	ds.detectFrame(buffer, frameLocation, detectorAction, d, s);
}

ds.loadConfiguration(config);