const hexCodeVariables = require('../lib/variables');

const HEADER = "5AA5";

const longPressTime = 3.0;
const shortPressTime = 0.1;
var SerialPort = require('serialport');
var sleep = require('sleep');
var serial_param = {port:'/dev/ttyUSB0',
                    optional_param:{baudRate: 9600, dataBits:8, stopBits:1, parity:"none", parser:SerialPort.parsers.raw}
                   }

class serialCom {
    constructor() {
        // SerialPort.list().then(
        //     ports => ports.forEach(console.log),
        //     err =>console.error(err)
        // )
        this.serialCon=null;
    }   

    connect(param = null) {
        if(param) {
            serial_param = param
        }
        this.serialCon = new SerialPort(serial_param.port, serial_param.optional_param);
        return this.serialCon  
    }

    disconnect(){
        this.serialCon.close(function(err){
            console.log('port closed', err);
        });
    }
    
    hexToBytes(hex) {
        hex = hex.split(' ').join('');
        for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    }

    async sendShortPress(pressPacket, releasePacketpress = hexCodeVariables.controlRelease) {
        await this.serialCon.write(this.hexToBytes(pressPacket));
        sleep.msleep(shortPressTime*1000)
        this.serialCon.write(this.hexToBytes(releasePacketpress));
    }
    
    async sendLongPress(pressPacket, releasePacketpress = hexCodeVariables.controlRelease) {
        await this.serialCon.write(hexToBytes(pressPacket));
        sleep.msleep(longPressTime*1000)
        this.serialCon.write(hexToBytes(releasePacketpress));
    }

    activeSerialPortList() {
        return new Promise(function(resolve, reject) {
            let child = require('child_process').execFile('ls', ['/dev/tty*'], (error, stdout, stderr) => {
                if (error) {
                    console.error('stderr', stderr);
                    throw error;
                }

                let info = stdout;
                console.log(info);
                let source = {}
                resolve(info);
            });
        });
    }

    declareDataEvent(serialCon) {
        serialCon.on('open', function() {
            //
            // this.sendShortPress(hexCodeVariables.packetcomunication, hexCodeVariables.packetRequestSensorData);
            //
            var full_packet = [];
            var counter = 0;
            var packet_size = null;
            serialCon.on('data', function (data) {
                counter++;
                var arr = Array.prototype.slice.call(data, 0)
                var packet = ("0"+(Number(arr[0]).toString(16))).slice(-2).toUpperCase();
                
                if(counter !== packet_size) {
                    full_packet.push(packet);
                } else{
                    full_packet.push(packet);
                    counter = 0;
                    console.log("Full Data received: " + full_packet);
                    // this.extractDeviceStatus(full_packet);
                    full_packet = [];
                    packet_size = null;
                }

                if(counter == 2 && full_packet.join('') !== HEADER) {
                    console.log("Invalid Packet");
                    full_packet = [];
                    counter = 0;
                    packet_size = null;
                } else if(counter == 3) {
                    packet_size = parseInt(packet, 16); // -3 is not diducted becasue counter is already 3.
                }
                
                setTimeout(function(){ 
                    full_packet = [];
                    counter = 0;
                    packet_size = null;
                }, 1000);
            });
        });

        serialCon.on('error', function(err) {
            console.log('Error: ', err.message);
        })
    }


    extractDeviceStatus(packets)
    {
        // excluded header(2 bytes), packet Size(1 byte), SA(1 byte), DA(1 byte), 
        // ACK(1 byte), Checksum(2 bytes),unknown 2 bytes before Checksum = total 10 bytes
        var packetSize = parseInt(packets[2], 16) - 10;

        // ID starts from 6th byte
        var packetIndex = 6;
        var packetCount = 0;
        while (packetCount < packetSize)
        {
            var ID = parseInt(packets[packetIndex], 16);
            var elementName = elementProtocolMap[ID].data['Element_Name'];
            var elementSize = parseInt(parseInt(elementProtocolMap[ID].data['Size'])/8);
            var returnType = elementProtocolMap[ID].data['returnType'];
            var elementValue = getElementValue(packets,packetIndex,elementSize);
            var extensionSize = elementProtocolMap[ID].child.length;

            if(elementProtocolMap[ID].data['Type'] == "Array")
            {
                console.log("- " + elementName+ " : \"Skipped because of type Array\"");
            }
            else
            {
                if (extensionSize == 0)
                {
                    var mValue = calculateValue(returnType, elementValue, elementProtocolMap[ID]);
                    console.log("- " + elementName+ " : " + mValue + " " + elementProtocolMap[ID].data['Unit']);
                }
                else
                {
                    console.log(elementName);
                    elementProtocolMap[ID].child.forEach(function(childElement) {
                        var mValue = calculateValue(returnType, elementValue, childElement);
                        var childElementName = childElement.data['Element_Name'];
                        var childElementUnit = childElement.data['Unit'];
                        console.log("- " + childElementName+ " : " + mValue + " " + childElementUnit);
                    });
                }
            }
            
            packetIndex += (elementSize + 1);
            packetCount += (elementSize + 1);
        }
        return 0
    }

}

module.exports = serialCom;

// parser: SerialPort.parsers.readline('\n')
// parser: new SerialPort.parsers.Readline('/\r?\n/')
// parser: new SerialPort.parsers.Readline()