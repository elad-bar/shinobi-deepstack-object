#!/bin/bash
DIR=$(dirname $0)
echo "Removing existing Node.js modules..."
rm -rf $DIR/node_modules

nonInteractiveFlag=false

if [ ! -e "$DIR/conf.json" ]; then
	dontCreateKeyFlag=false
    echo "Creating conf.json"
    sudo cp $DIR/conf.sample.json $DIR/conf.json
else
    echo "conf.json already exists..."
fi

if [ "$dontCreateKeyFlag" = false ]; then
	echo "Adding Random Plugin Key to Main Configuration"
	node $DIR/../../tools/modifyConfigurationForPlugin.js deepstack-object key=$(head -c 64 < /dev/urandom | sha256sum | awk '{print substr($1,1,60)}')
fi
