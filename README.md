# Shinobi Video plugin for DeepStack Object Detection
Wrapper plugin for object detection using DeepStack AI

## How to install

- Clone into plugin folder
- Copy `conf.sample.json` to `conf.json`
- Edit configuration (details below)
- Start using `pm2 start shinobi-deepstack-object.js`
- Save `pm2 save`
- Restart `pm2 restart all`

## Prerequisites

### DeepStack server 

#### Docker way
Docker - [Get docker](https://docs.docker.com/get-docker/)

DeepStack - [Getting started](https://docs.deepstack.cc/getting-started/index.html#setting-up-deepstack)

Run DeepStack CPU docker image:
```
sudo docker run -e VISION-FACE=True -e VISION-DETECTION=True -v localstorage:/datastore -p 80:5000 deepquestai/deepstack
```

GPU [installation guide](https://docs.deepstack.cc/using-deepstack-with-nvidia-gpus/#step-1-install-docker)

#### More installation options 
[Windows (CPU / GPU support)](https://docs.deepstack.cc/windows/index.html)

[nVidia Jetson](https://docs.deepstack.cc/nvidia-jetson/index.html#using-deepstack-with-nvidia-jetson)

[Raspberry PI](https://docs.deepstack.cc/raspberry-pi/index.html#using-deepstack-on-raspberry-pi-alpha)

## Plugin configuration
Change `deepStack` section as configured

```json
{
   "plug": "DeepStack-Object",
   "host": "localhost",
   "tfjsBuild": "cpu",
   "port": 8080,
   "hostPort": 58083,
   "key": "DeepStack-Object",
   "mode": "client",
   "type": "detector",
   "deepStack": {
	"host": "127.0.0.1",
	"port": 5000,
	"isSSL": false,
	"apiKey": "api key as defined in DeepStack"
   }
}
```
