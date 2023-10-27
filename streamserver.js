'use strict';
var bodyParser = require('body-parser')
const express = require('express');
const app = express();
const port = 5001;
const http = require('http').Server(app);
const io = require('socket.io')(http/*, {origins: allowedOrigins} */);
var sleep = require('sleep');
var SerialPort = require('serialport');
var datetime = require('node-datetime');
var clc = require("cli-color");
var mapping = {
    log: clc.blue,
    info: clc.yellow,
    error: clc.red
};
var socketConnectionDic = {};
var serialConnectionDic = {};
var serialComData = null;
var ipPort = {};
["log", "info", "error"].forEach(function(method) {
    var oldMethod = console[method].bind(console);
    console[method] = function() {
        oldMethod.apply(
            console,
            [mapping[method]('['+datetime.create().format('m/d/Y H:M:S')+']')].concat(arguments[0])
        );
    };
});

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', __dirname + "/public");

process.on("SIGINT", function () {
    console.log('Closing nodejs server...')
    let timeout = 1;
    Object.keys(socketConnectionDic).forEach(function(item){
        socketConnectionDic[item].emit('forceDisconnect')
        timeout = 5;
        // socketConnectionDic[item].disconnect();
        // delete socketConnectionDic[item];
    })
    setTimeout(function(){process.exit(0);}, timeout * 1000); 

});

/* User defined Libraries */
const stream = require('./lib/streamfeed');
const hexCodeVariables = require('./lib/variables');
// const sc = require('./lib/serial-com');
var storage = require('./lib/db');
var serialCom=null;
/* User defined Libraries */

var streamer = new stream(http)
var activeCamIns = {} /* All ffmpeg Cam Audio & Video Instances */
// const video_source = '/dev/video0';
var serial_param = {
    port:'/dev/ttyUSB0',
    optional_param:{baudRate: 9600, dataBits:8, stopBits:1, parity:"none", parser:SerialPort.parsers.raw}
}
const longPressTime = 3.0;
const shortPressTime = 0.1;

async function initiateBroadcast(cam) {
    let cam_str = cam.replace('/dev/', "")
    // console.log('Cam:'+ cam)
    // console.log('Cam Str:'+ cam_str)
    let info = await streamer.sourceInfo(cam)
    let ins_streamer = await streamer.initiateFFMPEGStreaming(cam)
    activeCamIns[cam_str] = ins_streamer
    // console.log('Active INS:'+ Object.keys(activeCamIns))
    return JSON.stringify({'wsport': activeCamIns[cam_str].ws_port, 'srcinfo': info})
}

async function initialData() {
    await csvDataRead()
    await updateCurrentValue()
    await resetConnectionStatus();
    let elementDict = await getElementTree()
    // let obj = {source_info: info, element_tree: elementDict}
    let obj = { element_tree: elementDict}
    return obj
}

function saveConnection(data) {
    // serial_param = data
    // console.log('---------------');
    // console.log(data)
    return new Promise(function (resolve, reject) {
      var con_id;  
      let res = {}
      res.status = true
      serialCom = new serialConnection();
      serialCom.connect(data).then(async function(scon){
        // console.log("SCON", scon)
        if (scon.status == false) {
            // console.log("Serial COn Ended....")
            resolve(scon)
            return;
        }
        serialConnectionDic[data.port] = scon.obj
        // console.log(serialConnectionDic)
        let cam_data = await db.getCamByPort(data.port)
        // console.log(typeof cam_data.cam)
        if(fs.existsSync(cam_data.cam)){
            // console.log('file exists');
            let retJson = await initiateBroadcast(cam_data.cam)
            retJson = JSON.parse(retJson)
            res.cam_ws_port = retJson.wsport
            res.cam_src_info = retJson.srcinfo
            console.log('Initiating broadcast from :'+ cam_data.cam)
        }else{
            console.error(data.port+' associated webcam '+ cam_data.cam + ' does not exist');
        }
        let con_info = {connection_id:data.connection_id, connection_name:data.connection_name, ip:data.ip, port:data.port, baudrate:data.optional_param.baudRate, parity:data.optional_param.parity, stopbits:data.optional_param.stopBits, databits:data.optional_param.dataBits}
        if(data.connection_id == false || data.connection_id == 'false') {
            db.addNewConnection(con_info).then((new_connection_id) => {
            con_id = new_connection_id 
            db.getConnectionInfoByID(new_connection_id).then((new_con_info) => {
                res.con_info = new_con_info[0]
                db.addNewConnectionLog(con_id).then((con_log_id) => {
                    resolve(res)
                })
            })
            })
            console.log("New connection")
        } else {
            con_id = con_info.connection_id
            res.new_con = false
            let update = db.updateConnection(con_info)
            con_info['id'] = con_info.connection_id
            res.con_info = con_info
            db.addNewConnectionLog(con_id).then((con_log_id) => {
                resolve(res)
            })
                //   resolve(res)
            console.log("Update Connection")
        }
        })
    })
}

// SerialPort.list(function(err, ports){
//     ports.forEach(function (port) {
//         console.log(port);
//     });
// });
io.on('connection', (socket) => {
    var clientIp = socket.request.connection.remoteAddress
    // console.log(socket)
    console.log('A user connected => (IP: '+clientIp+')')
    socket.on('client_port', (data) => {
        // console.log(data.port)
        socketConnectionDic[data.port] = socket;
        ipPort[data.port] = socket.conn.id
    })

    socket.on('client_event', (data) => {
        if((data.key != "Send"))
        {
            writeToConsole(data.key + " button clicked", socket.conn.id);
        }
        switch (data.key) {
          case "Left":
          case "Right":
          case "Standard":
          case "Dry":
          case "Fine-dust":
          case "Rapidity":
          case "Special":
          case "Sterilization":
          case "Silent":
          case "Reservation":
          case "Smart Control 1":
          case "Pause":
            serialCom.sendShortPress(hexCodeVariables.packetValue[data.key], socket.conn.id);
            break
          case "Child Protection":
          case "Clean Storage":
          case "Smart Control 2":
          case "Run":
            serialCom.sendLongPress(hexCodeVariables.packetValue[data.key], socket.conn.id);
            break
          case "Power On/Off":
            serialCom.sendShortPress(hexCodeVariables.packetValue[data.key], socket.conn.id, hexCodeVariables.powerRelease);
            break
          case "Send":
            serialCom.writeData(hexToBytes(data.hexValue), socket.conn.id)
            break
          case "Connect":
            if(serialCom)
                serialCom.sendShortPress(hexCodeVariables.packetcomunication, socket.conn.id, hexCodeVariables.packetRequestSensorData);
            break
        }
    });

    socket.on('update_event', (data) => {
        sendValueToSerialPort(data.elementValue, data.elementID, socket.conn.id);
    });

    socket.on('disconnect', async () => {
        var clientIp = socket.request.connection.remoteAddress
        var port = (Object.entries(ipPort).filter(i => i[1] === socket.conn.id))[0][0]
        // console.log(port)
        console.log("A user is disconnected => (IP: "+clientIp+")");
        await db.disableConnectionsLog(clientIp, port);
        if(serialCom)
            serialCom.disconnect(port);
            let cam_data = await db.getCamByPort(port)
            let cam_name = cam_data.cam
            if (fs.existsSync(cam_name)){
                cam_name = cam_name.replace('/dev/', "")
                console.log('Disconnect Cam Name:'+ cam_name)
                if(activeCamIns[cam_name]) {
                    activeCamIns[cam_name].vid_obj.kill('SIGINT')
                    activeCamIns[cam_name].aud_obj.kill('SIGINT')  
                    activeCamIns[cam_name].socket_obj.close()
                    activeCamIns[cam_name].stream_obj.close()              
                    delete activeCamIns[cam_name]
                }
            }
            delete socketConnectionDic[port];
    });

    // socket.on('forceDisconnect', function() {
    //     socket.disconnect();
    // });
});


class serialConnection {
    constructor() {
        // SerialPort.list().then(
        //     ports => ports.forEach(console.log),
        //     err =>console.error(err)
        // )
        this.serialCon=null;
    }   

    connect(param = null) {
        var self = this
        let res = null;
        return new Promise(function(resolve, reject) {
            if(param) {
                serial_param = param
            }
            var status = true
            var err = null
            var obj = null
            self.serialCon = new SerialPort(serial_param.port, serial_param.optional_param, function(err) {
                if(null !== err) {
                    status = false
                    err = err.toString().substr("Error: ".length)
                    res = {status: status, err: err, obj: obj}
                    resolve(res);
                }
                
                obj = self.serialCon
                
                // console.log(socketConnectionDic)
                // ipPort[serial_param.ip] =  serial_param.port;
                var ByteLength = SerialPort.parsers.ByteLength
                var parser = self.serialCon.pipe(new ByteLength({length: 1}));

                self.serialCon.on('open', function() {
                    
                });
                var full_packet = [];
                var counter = 0;
                var packet_size = null;
                var timer = null;
                // this.serialCon.on('data', console.log);
                parser.on('data', function (data) {
                    // console.log(data)
                    // var self = this;
                    counter++;
                    if(counter == 1){
                        timer = setTimeout(function(){ 
                            full_packet = [];
                            counter = 0;
                            packet_size = null;
                        }, 1000);
                    }
                    var arr = Array.prototype.slice.call(data, 0)
                    var packet = ("0"+(Number(arr[0]).toString(16))).slice(-2).toUpperCase();
                    
                    if(counter !== packet_size) {
                        full_packet.push(packet);
                    } else{
                        full_packet.push(packet);
                        counter = 0;
                        // console.log("Full Data received: " + full_packet);
                        extractDeviceStatus(full_packet, self.serialCon.path);
                        // socketConnectionDic[self.serialCon.path].emit('extract_info', full_packet);
                        writeToConsole( "Received: " + full_packet.join(' '), ipPort[self.serialCon.path]);
                        full_packet = [];
                        packet_size = null;
                        clearTimeout(timer);
                    }

                    if(counter == 2 && full_packet.join('') !== HEADER) {
                        console.error("Invalid Packet");
                        full_packet = [];
                        counter = 0;
                        packet_size = null;
                    } else if(counter == 3) {
                        packet_size = parseInt(packet, 16); // -3 is not diducted becasue counter is already 3.
                    }
                    else if(counter == 4 && packet == '7F'){
                        packet_size = packet_size + 3;
                    }
                });

                // this.serialCon.on('error', function(err) {
                //     console.log('Error: ', err.message);
                // })
                res = {status: status, err: err, obj: obj}
                resolve(res);

            });
        });
            
        // return this.serialCon  
    }

    disconnect(clientSocketPort){
        if(serialConnectionDic[clientSocketPort].isOpen){
            serialConnectionDic[clientSocketPort].close(function(err){
                if (err){
                    console.error("Console Error: "+err);
                    return false;
                }
            });
            console.log(clientSocketPort + ' port closed');
	    delete serialConnectionDic[clientSocketPort];
            delete ipPort[clientSocketPort];
            return true;
        }
    }

    async sendShortPress(pressPacket, clientSocketID, releasePacketpress = hexCodeVariables.controlRelease) {
        await serialConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].write(hexToBytes(pressPacket));
        writeToConsole("Send: " + pressPacket, clientSocketID)
        sleep.msleep(shortPressTime*1000)
        serialConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].write(hexToBytes(releasePacketpress));
        writeToConsole("Send: " + releasePacketpress, clientSocketID)
    }
    
    async sendLongPress(pressPacket, clientSocketID, releasePacketpress = hexCodeVariables.controlRelease) {
        await serialConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].write(hexToBytes(pressPacket));
        writeToConsole("Send: " + pressPacket, clientSocketID)
        sleep.msleep(longPressTime*1000)
        serialConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].write(hexToBytes(releasePacketpress));
        writeToConsole("Send: " + releasePacketpress, clientSocketID)
    }

    writeData(data, clientSocketID) {
        serialConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].write(data)
        writeToConsole("Send: " + byteToHexString(data), clientSocketID)
    }
}

function activeSerialPortList() {
    return new Promise(function(resolve, reject) {
        let cmd = "ls /dev/ttyUSB*";
        let proc = require('child_process')
        let ffmpeg = proc.exec(cmd);
        ffmpeg.on('close', function (buffer) {
            console.info('child process closed');
        });
        ffmpeg.stdio[1].on('data', function (buffer) {
            // console.log("yee");
            let portDict = {};
            buffer.toString().split("\n").forEach(element => {
                if(element){
                    let sudocmd = 'sudo chmod 777 '+element
                    proc.exec(sudocmd);
                    portDict[element] = 0;
                    // console.log(element);
                }
            });
            // resolve(buffer.toString());
            resolve(portDict)
        });

        ffmpeg.stderr.on('data', function (buffer) {
            console.error("Error: "+buffer.toString())
            resolve(null);
        });
    }).then(function(portDict){
        
            return new Promise(function(resolve, reject){
                if(portDict){
                    db.getOccupiedPortList().then((rows) => {  
                        rows = Object.values(rows)
                        // console.log(rows)
                        for (var i = 0; i<rows.length; i++) {
                            let row = rows[i] //{ port: /dev/ttyUSB0 }
                            portDict[row.port] = 1;
                        }
                        // console.log(portDict);
                        resolve(JSON.stringify(portDict))
                    });
                }else{
                    resolve(null);
                }
            });
    });
};

// function disconnectClient(data) {
//     db.disableConnectionsLog(data.connection_id)
// }

function byteToHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).toUpperCase().slice(-2);
    }).join(' ')
  }

function hexToBytes(hex) {
    hex = hex.split(' ').join('');
    for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
    // return hex;
}

function extractDeviceStatus(packets, clientSocketPort)
{
    // excluded header(2 bytes), packet Size(1 byte), SA(1 byte), DA(1 byte), 
    // ACK(1 byte), Checksum(2 bytes),unknown 2 bytes before Checksum = total 10 bytes
    var packetSize = parseInt(packets[2], 16) - 8;

    // ID starts from 6th byte
    var packetIndex = 6;
    var packetCount = 0;
    var update_val = -1;
    while (packetCount < packetSize)
    {
        var ID = parseInt(packets[packetIndex], 16);
        var elementName = '';
        try {
            elementName = elementProtocolMap[ID].data['Element_Name'];
        }
        catch(err) {
            console.error("Error message:" + err.message);
            return;
        }
        var elementName = elementProtocolMap[ID].data['Element_Name'];
        var elementSize = parseInt(parseInt(elementProtocolMap[ID].data['Size'])/8);
        var returnType = elementProtocolMap[ID].data['returnType'];
        var elementValue = getElementValue(packets,packetIndex,elementSize);
        var extensionSize = elementProtocolMap[ID].child.length;
        var mValue = null;
        var size = parseInt(parseInt(elementProtocolMap[ID].data['Size']));

        if(elementProtocolMap[ID].data['Type'] == "Array")
        {
            // console.log("- " + elementName+ " : \"Skipped because of type Array\"");
            if(elementProtocolMap[ID].valueMap[0])
            {
                // elementCurrentValue[elementName] = elementProtocolMap[ID].valueMap[0];
                update_val = elementProtocolMap[ID].valueMap[0];
            }
            else
            {
                // elementCurrentValue[elementName] = '0';
                update_val = '0';

            }
        }
        else
        {
            if (extensionSize == 0)
            {
                mValue = calculateValue(returnType, elementValue, elementProtocolMap[ID], size);
                // console.log("- " + elementName+ " : " + mValue + " " + elementProtocolMap[ID].data['Unit']);
                if(returnType == "Hex")
                {
                    elementCurrentValue[elementName] = '0x' + mValue
                    update_val = '0x' + mValue;
                }
                else
                {
                    if(elementProtocolMap[ID].data['Type'][0] == "S")
                    {
                        // elementCurrentValue[elementName] = signedHexToDecimal(elementValue);
                        update_val = signedHexToDecimal(elementValue);
                        // console.log(update_val);
                    }
                    else
                    {
                        // elementCurrentValue[elementName] = parseInt(elementValue.join(''), 16);
                        update_val = parseInt(elementValue.join(''), 16);
                    }
                    if(elementProtocolMap[ID].data['Calculation'])
                    {
                        // elementCurrentValue[elementName] = processValue(elementCurrentValue[elementName], elementProtocolMap[ID].data['Calculation']);
                        // elementCurrentValue[elementName] = Math.round(elementCurrentValue[elementName] * 10) / 10;
                        update_val = processValue(update_val, elementProtocolMap[ID].data['Calculation']);
                        // console.log(update_val);
                    }
                }
            }
            else
            {
                // console.log(elementName);
                elementProtocolMap[ID].child.forEach(function(childElement) {
                    mValue = calculateValue(returnType, elementValue, childElement, size);
                    var childElementName = childElement.data['Element_Name'];
                    var childElementUnit = childElement.data['Unit'];
                    // console.log("- " + childElementName+ " : " + mValue + " " + childElementUnit);
                });
                // elementCurrentValue[elementName] = toBinary(size, elementValue.join(''), 16)//.split("").reverse().join("");
                update_val = toBinary(size, elementValue.join(''), 16);
            }
        }

        packetIndex += (elementSize + 1);
        packetCount += (elementSize + 1);
        socketConnectionDic[clientSocketPort].emit('extract_info', {elem_name: elementName, elem_val: update_val});
    }
    // console.log(elementCurrentValue);
    // socketConnectionDic[socketPort].emit('elementCurrentValue', elementCurrentValue);
}

/* Serial Communication */
var csv = require('csv-parser');
var fs = require('fs');
/* DB connection */
var db = new storage()

/* Server & Routing */
initialData().then((obj) => {
//   let source_info = JSON.stringify(obj.source_info);
  let element_tree = JSON.stringify(obj.element_tree);
//   console.log(Object.keys(obj.element_tree).length);

  app.get('/', (req, res) => {
    db.getConnectionsByIP(req.ip).then((connections)=> {
      let client_info = {ip:req.ip, agent:req.headers['user-agent']}
    //   res.render('index', {feed_info:source_info, client_info:client_info, connections:connections, elements_info: element_tree})
      res.render('index', {client_info:client_info, connections:connections, elements_info: element_tree})
    });
  });
  
  app.post('/save-connection', (req, res) => {
    let param = JSON.parse(req.body.connection_param)
    saveConnection(param).then((info)=> {
      res.json(JSON.stringify(info))
    })
  });

  app.post('/close-connection', (req, res) => {
    var clientIp = req.body.connection_ip
    var port = req.body.connection_port
    db.disableConnectionsLog(clientIp, port).then((info) => {
        console.info('disable connection log status: '+info)
        res.json(JSON.stringify({status: info}))
    });
  });

  app.post('/get-webcam', (req, res) => {
    let param = JSON.parse(req.body.connection_param)
    saveConnection(param).then((info)=> {
      res.json(JSON.stringify(info))
    })
  });

  app.post('/get-serialport', (req, res) => {
    // let param = JSON.parse(req.body.connection_param)
    activeSerialPortList().then((info)=> {
      res.json(JSON.stringify(info));
    })
  });

//   app.post('/disconnect', (req, res) => {
//     let param = JSON.parse(req.body.connection_param)
//     disconnectClient(param)
//     res.json(JSON.stringify({status: "true"}))
//   });
  
  app.post('/delete-connection', (req, res) => {
    let connection_id = req.body.connection_id
    db.deleteConnectionById(connection_id).then((info) => {
        res.json(JSON.stringify({status: info}))
    })
  });

  app.get('/stream', (req, res) => {
    res.render('view-stream')
  });
  
  http.listen(port, "0.0.0.0", () => {
    console.log('listening on localhost:' + port)
  });
});

/// New Added Code

var results = [];
var elementProtocolMap = {};
var CRC = require('crc-full').CRC;

const SA = "01";
const DA = "F0";
const ACK = "00";
const HEADER = "5AA5";
var elementCurrentValue = {}

class ElementProtocol {   
    constructor(data) {
        this.data = data;
        this.valueMap = {};
        this.child = [];
        this.value = data['value'];
        if (this.value)
        {   
            var parts = this.value.split(';');
            for(var i=0; i<parts.length; i++)
            {
                this.valueMap[parts[i].split('|')[0]] = parts[i].split('|')[1];
            }
        }
    }   
    addChild(data)
    {
        this.child.push(new ElementProtocol(data));
    }  
}

function csvDataRead(){
    return new Promise(resolve => {        
        fs.createReadStream('protocolDoc.csv')
          .pipe(csv())
          .on('data', (data) => {
              results.push(data);
              if (data["ID"])
              {
                  var key = parseInt(data["ID"]);
                  if (key in elementProtocolMap)
                  {
                      elementProtocolMap[key].addChild(data);
                  }
                  else
                  {
                      elementProtocolMap[key] = new ElementProtocol(data);
                  }
              }
              resolve('');
          })
          .on('end', () => {
        });
    });
}

function updateCurrentValue()
{
    for(var key in elementProtocolMap)
    {
        if(elementProtocolMap[key].child.length == 0)
        {
            if(elementProtocolMap[key].data['returnType'] == "Hex")
            {
                elementCurrentValue[elementProtocolMap[key].data['Element_Name']] = '0x'+ toHex(parseInt(elementProtocolMap[key].data['Size']/4), 0, 10);
                // console.log(elementProtocolMap[key].data['Element_Name']);
            }
            else
            {
                elementCurrentValue[elementProtocolMap[key].data['Element_Name']] = '0'
            }
        }                      
        else
        {
            let binaryString = '';
            // if(elementProtocolMap[key].data['returnType'] == "Dec"){
            //     binaryString = toBinary(elementProtocolMap[key].data['Size'], 0, 10);
            // }else{
                elementProtocolMap[key].child.forEach(function(childElement) {
                    let startIndex = childElement.data['startBit'];
                    let endIndex = childElement.data['endBit'];
                    if (Object.keys(childElement.valueMap).length){
                        binaryString += Object.keys(childElement.valueMap)[0];
                    }else{
                        binaryString += '0';
                    }
                    binaryString = binaryString.padEnd(endIndex-startIndex+1, '0');
                });
            // }
            // elementCurrentValue[elementProtocolMap[key].data['Element_Name']] = toBinary(elementProtocolMap[key].data['Size'], 0, 10);
            elementCurrentValue[elementProtocolMap[key].data['Element_Name']] = binaryString.padEnd(elementProtocolMap[key].data['Size'], '0')//.split("").reverse().join("");
        }
    }

    // console.log(elementCurrentValue);
    // console.log(Object.keys(elementCurrentValue).length);
}

function resetConnectionStatus(){
    db.closeExistingConnections();
}

function getElementTree()
{
  var elementDict = {};
//   console.log(elementCurrentValue);
//   console.log(elementProtocolMap);
  for (var key in elementProtocolMap) {
        var index_str = elementProtocolMap[key].data['Element_Name'];
        elementDict[index_str] = {};
        elementDict[index_str]["element_id"] = elementProtocolMap[key].data['ID']
        elementDict[index_str]["element_rw"] = elementProtocolMap[key].data['R/W']
        elementDict[index_str]["element_unit"] = elementProtocolMap[key].data['Unit']
        elementDict[index_str]["element_size"] = elementProtocolMap[key].data['Size']
        elementDict[index_str]["element_return_type"] = elementProtocolMap[key].data['returnType']
        elementDict[index_str]["element_type"] = elementProtocolMap[key].data['Type']
        elementDict[index_str]["element_calculation"] = elementProtocolMap[key].data['Calculation']
        elementDict[index_str]["element_value_map"] = elementProtocolMap[key].valueMap
        elementDict[index_str]["element_isplotting"] = false
        if (Object.keys(elementProtocolMap[key].valueMap).length){
            elementCurrentValue[index_str] = Object.keys(elementProtocolMap[key].valueMap)[0];
        }
        elementDict[index_str]["element_value"] = elementCurrentValue[index_str]?elementCurrentValue[index_str]:0;
        elementDict[index_str]["element_child"] = {};
        if(elementProtocolMap[key].child.length>=0){
            elementDict[index_str]["element_child"]["element_child_name"] = [];
            elementDict[index_str]["element_child"]["element_child_value_map"] = [];
            elementDict[index_str]["element_child"]["element_child_value"] = [];
            elementDict[index_str]["element_child"]["element_child_rw"] = [];
            elementDict[index_str]["element_child"]["element_child_start_bit"] = [];
            elementDict[index_str]["element_child"]["element_child_end_bit"] = [];
            elementProtocolMap[key].child.forEach(function(childElement) {
                elementDict[index_str]["element_child"]["element_child_name"].push(childElement.data['Element_Name']);
                elementDict[index_str]["element_child"]["element_child_rw"].push(childElement.data['R/W']);
                elementDict[index_str]["element_child"]["element_child_value_map"].push(childElement.valueMap);
                elementDict[index_str]["element_child"]["element_child_start_bit"].push(childElement.data['startBit']);
                elementDict[index_str]["element_child"]["element_child_end_bit"].push(childElement.data['endBit']);
                if (Object.keys(childElement.valueMap).length){
                    elementDict[index_str]["element_child"]["element_child_value"].push(Object.keys(childElement.valueMap)[0]);
                    // elementCurrentValue[index_str] += Object.keys(elementProtocolMap[key].valueMap)[0]+'';
                }else{
                    elementDict[index_str]["element_child"]["element_child_value"].push("0");
                }
            });
        }
    }
    // console.log(elementCurrentValue);
    return elementDict;
}

function getElementValue(packets, start, size){
    var packet = [];
    for (var i=0; i<size; i++)
    {
        packet.push(packets[start+i+1]);
    }
    return packet;
}

function getBinaryToReturnType(listValue, returnType)
{
    if(returnType == 'Hex')
    {
        listValue = listValue.join('');
        return parseInt(listValue, 2).toString(16).toUpperCase();
    }
    else if(returnType == 'Dec')
    {
        listValue = listValue.join('');
        return parseInt(listValue, 2);
    }
    else
    {
        return listValue.join('');
    }
}

function getHexToReturnType(listValue, returnType, size)
{
    if(returnType == 'Dec')
    {
        listValue = listValue.join('');
        return parseInt(listValue, 16);
    }
    else if(returnType == 'Bin')
    {
        listValue = listValue.join('');
        return toBinary(size, listValue, 16);
    }
    else
    {
        return listValue.join('');
    }
}

function isFloat(n) {
    return n === +n && n !== (n|0);
}

function toBinary(size, value, numberBase)
{
    var binaryString = parseInt(value, numberBase).toString(2).padStart(size, 0)
    return binaryString;
}

function signedHexToDecimal(elementHexValue)
{
    var st = 0x8 << (4*((2*elementHexValue.length) - 1));
    var sn = 0x10 << (4*((2*elementHexValue.length) - 1));
    var strValue = '';
    var c = elementHexValue.join('')
    var a = parseInt(c, 16);
    
    if ((a & st) > 0) {
        strValue = a - sn;        
    }
    else
    {
        strValue = a;
    }
   
    return strValue;
}


function calculateValue(returnType, elementHexValue, elementProtocol, size)
{
    var protocolLine = elementProtocol.data;
    var startBit = protocolLine['startBit'];
    var strValue = '';
    if(elementProtocol.data['Type'][0] == "S")
    {
        var c = elementHexValue.join('')
        var a = parseInt(c, 16);
        if ((a & 0x8000) > 0) {
            strValue = a - 0x10000;;
            var value = protocolLine['value'];

            if (value)
            {
                var valueMap = elementProtocol.valueMap;
                if (strValue in valueMap)
                {
                    return valueMap[strValue];
                }
                else
                {
                    return strValue+"(not match)";
                }
            }
            else
            {		
                var valuePrint = strValue;
                var calculation = protocolLine['Calculation'];
                if(calculation)
                {
                    valuePrint = processValue(valuePrint, calculation);
                }
                if (isFloat(valuePrint))
                {
                    valuePrint = Math.round(valuePrint * 10) / 10;
                }
                return String(valuePrint);
            }
        }
        
    }

    if(startBit)
    {
        var binaryElementValue = toBinary(size, elementHexValue.join(''), 16);
        var mValue = [];
        var startIndex = parseInt(startBit, 10);
        var endIndex = parseInt(protocolLine['endBit'], 10);
        while(startIndex <= endIndex)
        {
            mValue.push(binaryElementValue[startIndex]);
            startIndex += 1;
        }
        
        strValue = getBinaryToReturnType(mValue, returnType);
    }
    else    
    {
        strValue = getHexToReturnType(elementHexValue, returnType, protocolLine['Size']);
    }    
    var value = protocolLine['value'];

    if (value)
    {
        var valueMap = elementProtocol.valueMap;
        if (strValue in valueMap)
        {
            return valueMap[strValue];
        }
        else
        {
            return strValue+"(not match)";
        }
    }
    else
    {		
        var valuePrint = strValue;

        var calculation = protocolLine['Calculation'];
        if(calculation)
        {
            valuePrint = processValue(valuePrint, calculation)
        }
        if (isFloat(valuePrint))
        {
            valuePrint = Math.round(valuePrint * 10) / 10;
        }
        return String(valuePrint);
    }
}


function createChecksum( packet)
{
    var crc = CRC.default("CRC16_CCITT_FALSE");
    return toHex(4, crc.compute(Buffer.from(packet,"hex")), 10);
}


function processValue(valuePrint, calculation)
{
    var mul = parseFloat(calculation.split('|')[0]);
    var add = parseFloat(calculation.split('|')[1]);
    valuePrint = (valuePrint*mul) + add;
    var precision = mul.toString().split('.')[1].length
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(valuePrint * multiplier) / multiplier;
    // return valuePrint
}

// function decimalToHex(d, padding) {
//     var hex = Number(d).toString(16).toUpperCase();
//     padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

//     while (hex.length < padding) {
//         hex = "0" + hex;
//     }

//     return hex;
// }

function toHex(size, value, numberBase)
{
    var hexString = parseInt(value, numberBase).toString(16).toUpperCase().padStart(size, 0)
    return hexString;
}

function sendValueToSerialPort(elementValue, elementID, clientSocketID)
{
    var mainValue = 0;
    var packet = null;
    var checksum = null;
    var size = elementProtocolMap[elementID].data['Size'];
    var update_val = -1;
    // console.log(elementValue);
    // size = parseInt(parseInt(size) / 8);

    var calculation = elementProtocolMap[elementID].data['Calculation'];
    // elementValue = Math.round(elementValue * 10) / 10;
    // console.log('round elem value: '+elementValue);
    if(calculation)
    {
	    var mul = parseFloat(calculation.split('|')[0]);
        var add = parseFloat(calculation.split('|')[1]);
        var precision = mul.toString().split('.')[1].length
        var multiplier = Math.pow(10, precision || 0);
        elementValue = Math.round(elementValue * multiplier) / multiplier;
        // console.log('round elem value: '+elementValue);
	    elementValue = Math.round(elementValue*(1/mul)) - add;
    }else{
	    elementValue = parseInt(elementValue);
    }
    // console.log('elem value: '+elementValue);

    var packetSize = toHex(2, (parseInt(size/8) + 9), 10);
    var totalHexDigit = size / 4;
    var parentName = elementProtocolMap[elementID].data['Element_Name']
    if(elementProtocolMap[elementID].child.length > 0)
    {
        mainValue = toHex(2, elementValue, 10)
        packet = HEADER + packetSize + SA + DA + ACK + toHex(2, parseInt(elementID), 10) + mainValue;
        checksum = createChecksum(packet)
        try {
            serialCom.writeData(hexToBytes(packet + checksum), clientSocketID);
            // elementCurrentValue[parentName] = toBinary(size, elementValue, 10)//.split("").reverse().join("");
            update_val = toBinary(size, elementValue, 10);
        }
        catch(err) {
            console.error("Error: " + err.message);
        }
    }
    else
    {
        if(elementValue < 0)
        {
            mainValue = (~(-1*elementValue) + 1 >>> 0).toString(16).toUpperCase().substr(totalHexDigit);
        }
        else
        {
            mainValue = toHex(totalHexDigit, parseInt(elementValue, 10));
        }
        packet = HEADER + packetSize + SA + DA + ACK + toHex(2, parseInt(elementID)) + mainValue;
        checksum = createChecksum(packet);
        // console.log('main value: '+mainValue);
        try {
            serialCom.writeData(hexToBytes(packet + checksum), clientSocketID);
            if(elementProtocolMap[elementID].data['retrunType'] == "Hex")
            {
                // elementCurrentValue[parentName] = toHex(parseInt(elementProtocolMap[elementID].data['retrunType']/4), elementValue, 10);
                update_val = toHex(parseInt(elementProtocolMap[elementID].data['retrunType']/4), elementValue, 10)
            }
            else
            {
                if(calculation)
                {
                    // elementCurrentValue[parentName] = processValue(elementValue, calculation);
                    update_val = processValue(elementValue, calculation);
                }
                else
                {
                    // elementCurrentValue[parentName] = elementValue;
                    update_val = elementValue;
                }
                // console.log(elementCurrentValue[parentName]);
            }
        }
        catch(err) {
            console.log("Error: " + err.message);
        }
    }
    // socketConnectionDic[ipPort[clientIpAddress]].emit('elementCurrentValue', elementCurrentValue);
    socketConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].emit('extract_info', {elem_name: parentName, elem_val: update_val});
}

function writeToConsole(data, clientSocketID)
{
    socketConnectionDic[(Object.entries(ipPort).filter(i => i[1] === clientSocketID))[0][0]].emit('consoleData', data);
}
////////////////