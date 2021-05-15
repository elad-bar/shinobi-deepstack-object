# Shinobi Video plugin for DeepStack Object Detection

## How to install

- Clone into plugin folder
- Copy `conf.sample.json` to `conf.json`
- Edit configuration (details below)
- Start using `pm2 start shinobi-deepstack-object.js`
- Save `pm2 save`
- Restart `pm2 restart all`

## Configuration
Change `deepStack` section as configured

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
