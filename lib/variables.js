var packetValue = {
    "Left" : "5A A5 0D F0 01 00 65 00 00 00 01 59 E6",
    "Right" : "5A A5 0D F0 01 00 65 00 00 00 02 69 85",
    "Standard" : "5A A5 0D F0 01 00 65 00 00 00 04 09 43",
    "Dry" : "5A A5 0D F0 01 00 65 00 00 00 40 01 03",
    "Fine-dust" : "5A A5 0D F0 01 00 65 00 00 00 08 C8 CF",
    "Rapidity" : "5A A5 0D F0 01 00 65 00 00 00 10 5B F6",
    "Special" : "5A A5 0D F0 01 00 65 00 00 00 80 D8 4F",
    "Sterilization" : "5A A5 0D F0 01 00 65 00 00 00 20 6D A5",    
    "Silent" : "5A A5 0D F0 01 00 65 00 00 01 00 7A F6",
    "Reservation" : "5A A5 0D F0 01 00 65 00 00 02 00 2F A5",
    "Smart Control 1" : "5A A5 0D F0 01 00 65 00 00 04 00 85 03",
    "Child Protection" : "5A A5 0D F0 01 00 65 00 00 01 00 7A F6",
    "Clean Storage" : "5A A5 0D F0 01 00 65 00 00 02 00 2F A5",
    "Smart Control 2" : "5A A5 0D F0 01 00 65 00 00 04 00 85 03",
    "Power On/Off" : "5A A5 0A F0 01 00 67 01 9A F2",
    "Run" : "5A A5 0D F0 01 00 65 00 00 08 00 C0 6E",
    "Pause" : "5A A5 0D F0 01 00 65 00 00 08 00 C0 6E"    
};

var powerRelease = "5A A5 0A F0 01 00 67 00 8A D3";
var controlRelease = "5A A5 0D F0 01 00 65 00 00 00 00 49 C7";
var packetcomunication = "5A A5 06 7F 03 00 00 00 85";
var packetRequestSensorData = "5A A5 0A F0 01 00 FB 02 F7 17";

module.exports = { packetValue, powerRelease, controlRelease, packetcomunication, packetRequestSensorData};