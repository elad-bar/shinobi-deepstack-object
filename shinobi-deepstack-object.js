//
// Shinobi - DeepStack Object Detection Plugin
// Copyright (C) 2021 Elad Bar
//
// Base Init >>
const config = require('./conf.json');
const ds = require('./deepstack.js');

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

s.detectObject = function(buffer, d, tx, frameLocation, callback) {
	const detectorAction = async function(frame) {
		ds.detect(d, tx, frame, callback);
	};

	ds.detectFrame(d, s, buffer, frameLocation, detectorAction);
}

ds.loadConfiguration(config);