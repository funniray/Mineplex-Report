/**
 * This script uploads a video (specifically `video.mp4` from the current
 * directory) to YouTube,
 *
 * To run this script you have to create OAuth2 credentials and download them
 * as JSON and replace the `credentials.json` file. Then install the
 * dependencies:
 *
 * npm i r-json lien opn bug-killer
 *
 * Don't forget to run an `npm i` to install the `youtube-api` dependencies.
 * */
"use strict";
var video = "nothing yet"
setTimeout(function(){
const Youtube = require("youtube-api")
    , fs = require("fs")
    , readJson = require("r-json")
    , Lien = require("lien")
    , Logger = require("bug-killer")
    , opn = require("opn")
    , prettyBytes = require("pretty-bytes")
	, http = require("http")
    ;
//var vdir = __dirname+"\\public";
function getNewestFile(dir, files, callback) {
    if (!callback) return;
    if (!files || (files && files.length === 0)) {
        callback();
    }
    if (files.length === 1) {
        callback(files[0]);
    }
	if (files[0]!="index.html"){
		var newest = { file: files[0] };
	}else{
		var newest = { file: files[0] };
	}
    var checked = 0;
    fs.stat(dir + newest.file, function(err, stats) {
        newest.mtime = fs.statSync(dir+newest.file).mtime;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            (function(file) {
                fs.stat(file, function(err, stats) {
                    ++checked;
                    if (stats.mtime.getTime() > newest.mtime.getTime()) {
						if (file != "index.html"){
							newest = { file : file, mtime : stats.mtime };
						}
                    }
                    if (checked == files.length) {
                        callback(newest.file);
                    }
                });
            })(dir + file);
        }
    });
 }
getNewestFile("C:\\youtube\\public\\",fs.readdirSync("C:/youtube/public"),function(newest){
	console.log(newest)
	video = newest.split("\\")[newest.split("\\").length-1]
})
var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: 8080});
wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        //console.log('received: %s', message);
		if (JSON.parse(message).type == "upload"){
			upload(video,ws,JSON.parse(message).data)
		}
		if (JSON.parse(message).type == "getVideo"){
			video = video
			ws.send(JSON.stringify({type:"video",data:video}))
		}
		if (JSON.parse(message).type == "cancel"){
			process.exit()
		}
		ws.send(JSON.stringify({type:"info",data:"Recived Message"}));
    });
});

// I downloaded the file from OAuth2 -> Download JSON
const CREDENTIALS = readJson(`${__dirname}/credentials.json`);

var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname+"/public")).listen(80, function(){
	opn("http://localhost")
});

function upload(video,ws,name){
	// Init lien server
	let server = new Lien({
		host: "localhost"
	  , port: 5000
	});

	// Authenticate
	// You can access the Youtube resources via OAuth2 only.
	// https://developers.google.com/youtube/v3/guides/moving_to_oauth#service_accounts
	let oauth = Youtube.authenticate({
		type: "oauth"
	  , client_id: CREDENTIALS.web.client_id
	  , client_secret: CREDENTIALS.web.client_secret
	  , redirect_url: CREDENTIALS.web.redirect_uris[0]
	});

	ws.send(JSON.stringify({type:"open",data:(oauth.generateAuthUrl({
		access_type: "offline"
	  , scope: ["https://www.googleapis.com/auth/youtube.upload"]
	}))}));

	// Handle oauth2 callback
	server.addPage("/oauth2callback", lien => {
		//Logger.log("Trying to get the token using the following code: " + lien.query.code);
		oauth.getToken(lien.query.code, (err, tokens) => {

			if (err) {
				lien.lien(err, 400);
				return //Logger.log(err);
			}

			//console.log("Got the tokens.");

			oauth.setCredentials(tokens);
			lien.end("<script>window.close();</script>");
			console.log(name.time)
			if (name.time!=0){
				var childProc = require('child_process');
				var spawn = childProc.spawn;
				var args =[
					'-i', __dirname+"\\public\\"+video,
					'-ss', name.time,
					'-c:v', 'libx264',
					'-ar', '22050', 
					'-crf', '28',
					'-async', '1',
					'-strict', 'experimental',
					'-y','output.mp4'
				]
				console.log(args)
				spawn("ffmpeg" , args).stderr.on('data', (data) => {
					if (`${data}`.split('time=')[1]){
						var time = `${data}`.split('time=')[1].split(' bitrate')[0].split(":");
						var times = time[0]*60*60
						times = Number(times)+time[1]*60
						times = Number(times)+Number(time[2])
						ws.send(JSON.stringify({type:"progress",data:{progress:times/(name.size-name.time)*100,bar:"ffmpeg"}}));
					}else{
						console.log(`${data}`)
						ws.send(JSON.stringify({type:"progress",data:{progress:0,bar:"ffmpeg"}}));
					}
				}).on("close",function(){ulstart("output.mp4")});
			}else{
				ulstart(__dirname+"\\public\\"+video)
			}
			function ulstart(video){
				var req = Youtube.videos.insert({
					resource: {
						// Video title and description
						snippet:name
						// I don't want to spam my subscribers
					  , status: {
							privacyStatus: "unlisted"
						}
					}
					// This is for the callback function
				  , part: "snippet,status"

					// Create the readable stream to upload the video
				  , media: {
						body:fs.createReadStream(video)
					}
				}, (err, data) => {
					ws.send(JSON.stringify({type:"uploadFinish",data:data}))
					setTimeout(function(){process.exit()},100)
				});
				//console.log(req)
				setInterval(function () {
				   ws.send(JSON.stringify({type:"progress",data:{progress:req.req.connection._bytesDispatched/fs.statSync(video).size*100,bar:"main"}}));
				},500);
			};
		});
	});
}},10000);