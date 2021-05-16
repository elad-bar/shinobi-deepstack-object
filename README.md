# Shinobi Video plugin for DeepStack Object Detection

Go to the Shinobi directory. **/home/Shinobi** is the default directory.

Clone the plugin
```bash
git clone https://github.com/elad-bar/shinobi-deepstack-object /home/Shinobi/plugin/deepstack-object
```

Go to plugin directory
```
cd /home/Shinobi/plugin/deepstack-object
```

Copy the config file.

- To run the installation script interactively:
```
sh INSTALL.sh
```

Start the plugin.
```
pm2 start shinobi-deepstack-object.js
```

Doing this will reveal options in the monitor configuration. Shinobi does not need to be restarted when a plugin is initiated or stopped.

## Run the plugin as a Host
> The main app (Shinobi) will be the client and the plugin will be the host. The purpose of allowing this method is so that you can use one plugin for multiple Shinobi instances. Allowing you to easily manage connections without starting multiple processes.

Edit your plugins configuration file. Set the `hostPort` **to be different** than the `listening port for camera.js`.

```
nano conf.json
```

Here is a sample of a Host configuration for the plugin.
 - `plug` is the name of the plugin corresponding in the main configuration file.
 - `https` choose if you want to use SSL or not. Default is `false`.
 - `hostPort` can be any available port number. **Don't make this the same port number as Shinobi.** Default is `8082`.
 - `type` tells the main application (Shinobi) what kind of plugin it is. In this case it is a detector.

```json
{
   "plug": "DeepStack-Object",
   "host": "localhost",
   "tfjsBuild": "cpu",
   "port": 8080,
   "hostPort": 58084,
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

Now modify the **main configuration file** located in the main directory of Shinobi.

```
nano conf.json
```

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

