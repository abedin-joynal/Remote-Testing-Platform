var portscanner = require('portscanner')
var WebSocket = require('ws')
var RECORD_STREAM = false
var httpsServer
// var video_src = "/dev/video0"

class streamfeed {
    constructor(http) {
        httpsServer = http;
    }

    getFreePort() {
        return new Promise(function(resolve, reject) {
            try {
                portscanner.findAPortNotInUse(8081, 8100, '127.0.0.1', function(error, port) {
                    resolve(port)
                })
            } catch(err) {
                console.log("exception: " + err)
            }
        });  
    }

    createSocketServer(WEBSOCKET_PORT) {
        console.log('WPORTS:'+ WEBSOCKET_PORT)

        let socketServer = new WebSocket.Server({
            server: httpsServer, 
            port: WEBSOCKET_PORT,
            perMessageDeflate: false
        });
         socketServer.connectionCount = 0;
         socketServer.on('connection', function(socket, upgradeReq) {
             socketServer.connectionCount++;
            //  console.log('New WebSocket Connection: ', (upgradeReq || socket.upgradeReq).socket.remoteAddress, (upgradeReq || socket.upgradeReq).headers['user-agent'], '('+socketServer.connectionCount+' total)');
             socket.on('close', function(code, message){
                 socketServer.connectionCount--;
                 console.log(
                     'Disconnected WebSocket ('+socketServer.connectionCount+' total)'
                 );
             });
         });
         socketServer.broadcast = function(data) {
             socketServer.clients.forEach(function each(client) {
                 if (client.readyState === WebSocket.OPEN) {
                     client.send(data);
                 }
             });
         };
         return socketServer;
    }

    createStreamServer(STREAM_PORT, socketServer) {
        console.log('SPORTS:'+ STREAM_PORT)
        // HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
        let streamServer = require('http').createServer(function(request, response) {
            var params = request.url.substr(1).split('/');
            response.connection.setTimeout(0);
            console.log( 'Stream Connected: ' + request.socket.remoteAddress + ':' + request.socket.remotePort );
            request.on('data', function(data) {
                socketServer.broadcast(data);
                // if (request.socket.recording) {
                //     request.socket.recording.write(data);
                // }
            });
            request.on('end',function() {
                console.log('Stream server at '+request.socket.remotePort+' were closed');
                if (request.socket.recording) {
                    request.socket.recording.close();
                }
            });

            // Record the stream to a local file?
            // if (RECORD_STREAM) {
            //     var path = 'recordings/' + Date.now() + '.ts';
            //     request.socket.recording = fs.createWriteStream(path);
            // }
        }).listen(STREAM_PORT)
        return streamServer
        // console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/<secret>');
        // console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');
    }

    async initiateFFMPEGStreaming(cam) {
        let res
        let WEBSOCKET_PORT = await this.getFreePort()
        let socketServer = await this.createSocketServer(WEBSOCKET_PORT)
        let STREAM_PORT = await this.getFreePort()
        let streamServer = await this.createStreamServer(STREAM_PORT, socketServer)
        
        // console.log('Initiated Streaming for: '+ cam)
        // var ffmpegStringVideo = '-hide_banner -loglevel panic -f v4l2 -framerate 25 -i '+cam+' -f mpegts -codec:v mpeg1video -vf scale=860:560,setsar=4:3 -b:v 1000k -bf 0 -muxdelay 0.001 http://localhost:8081/supersecret'
        let ffmpegStringVideo = '-hide_banner -loglevel panic -f v4l2 -framerate 25 -i '+cam+' -f mpegts -codec:v mpeg1video -b:v 1000k -bf 0 -muxdelay 0.001 http://localhost:'+STREAM_PORT+'/supersecret'
        let ffmpegVid = require('child_process').spawn('ffmpeg', ffmpegStringVideo.split(' '),{stdio:['pipe','pipe','pipe','pipe','pipe']});
        let ffmpegStringAudio = '-hide_banner -loglevel panic -f alsa -i default -f mpegts -codec:a mp2 -b:a 128k -muxdelay 0.001 http://localhost:'+STREAM_PORT+'/supersecret'
        let ffmpegAud = require('child_process').spawn('ffmpeg', ffmpegStringAudio.split(' '),{stdio:['pipe','pipe','pipe','pipe','pipe']});
        
        ffmpegVid.on('error', function (data) { 
            console.log("FFMPEG ERROR: ", data);
        });

        ffmpegVid.on('close', function (buffer) {
            console.log('ffmpeg Video were Closed');
        });

        ffmpegVid.stdio[1].on('data', function (buffer) {
            console.log("yes");
        });

        ffmpegVid.stderr.on('data', function (buffer) {
            console.log("FFMPEG DATA", cam)
            console.log(buffer.toString())
        });

        ffmpegAud.on('close', function (buffer) {
            console.log('ffmpeg Audio were closed');
        });
        ffmpegAud.stdio[1].on('data', function (buffer) {
            console.log("yes");
        });
        
        ffmpegAud.stderr.on('data', function (buffer) {
            // console.log(buffer.toString())
        });

        res = {vid_obj: ffmpegVid, aud_obj: ffmpegAud, socket_obj: socketServer, stream_obj: streamServer, ws_port: WEBSOCKET_PORT}
        return res
    }

    sourceInfo(video_src) {
        return new Promise(function(resolve, reject) {
            try {
                let source = {};
                let child = require('child_process').execFile('ffprobe', ['-hide_banner', video_src, '-show_format', '-show_streams', '-print_format', 'json'], (error, stdout, stderr) => {
                    if (error) {
                        console.error(stderr);
                        resolve(source);
                        return;
                    }
                    let info = JSON.parse(stdout);
                    let stream = info.streams[0];
                    
                    source.width = stream.width;
                    source.height = stream.height;
                    resolve(source);
                })
                child.stderr.on('data', (data) => {
                    // console.error(`child stderr:\n${data}`);
                });
            } catch(err) {
                console.log("exception: " + err)
            }
        });
    }
}

module.exports = streamfeed;
