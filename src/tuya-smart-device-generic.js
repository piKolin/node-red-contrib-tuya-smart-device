const TuyaDevice = require("tuyapi");

module.exports = function (RED) {
    function TuyaSmartDeviceSelfNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        this.operations = []
        node.on('input', function (msg) {
            let operation = msg.payload.operation || 'SET';
            delete msg.payload.operation;
            let requestID = new Date().getTime();
            node.log(`[${requestID}] recieved data on input : ${JSON.stringify(msg)}`);
            // Initiate the device connection and then send the payload
            node.operations.push(1);
            const tuyaProtocolVersion = (msg.payload.version == null || typeof  msg.payload.version  == "undefined" ||  msg.payload.version.trim() == "" || isNaN(msg.payload.version))? '3.1' : msg.payload.version.trim() ;
            const connectionParams = {
                id: msg.payload.deviceVirtualId,
                key: msg.payload.deviceKey,
                ip: msg.payload.deviceIp,
                issueGetOnConnect: false,
                nullPayloadOnJSONError: false,
                version: tuyaProtocolVersion
            };
            node.log(`Connecting to tuya with params : ${JSON.stringify(connectionParams)}`);
            let tuyaDevice = new TuyaDevice(connectionParams);

            tuyaDevice.on('disconnected', () => {
                node.log(`[${requestID}]  Disconnected from tuyaDevice.`);
                node.operations.pop();
                if (node.operations.length === 0) {
                    // Show the disconnected status if there is no more active connections.
                    setStatusDisconnected();
                }
            });

            tuyaDevice.on('error', error => {
                node.operations.pop();
                setStatusOnError(error, requestID);
            });
            tuyaDevice.on('connected', () => {
                node.log(`[${requestID}]  Connected to device! ${msg.payload.deviceVirtualId}`);
                setStatusConnected();
                switch (operation) {
                    case "SET":
                        node.log(`[${requestID}]  sending command SET : ${JSON.stringify(msg.payload.payload)}`)
                        tuyaDevice.set(msg.payload.payload);
                        break;
                    default:
                        node.log(`[${requestID}] Invalid operation ${operation}`);
                }
                setTimeout(() => {

                }, 2000)
            });
            tuyaDevice.on('data', data => {
                node.log(`[${requestID}] Data from device: ${JSON.stringify(data)}`);
                tuyaDevice.disconnect();
                node.send({
                    payload: {
                        data: data,
                        deviceVirtualId: msg.payload.deviceVirtualId,
                        deviceKey: msg.payload.deviceKey,
                        deviceName: msg.payload.deviceName,
                    }
                });
            });
            let findDevice = () => {
                setStatusConnecting();
                node.log(`[${requestID}] initiating the find command`);
                tuyaDevice.find().then(() => {
                    // Connect to device
                    tuyaDevice.connect();
                }).catch((e) => {
                    // We need to retry 
                    setStatusOnError(e, requestID, "Can't find device");
                    node.log(`[${requestID}] Cannot find the device, re-trying...`);
                    //setTimeout(findDevice, 1000);
                });
            }
            findDevice();

        });
        let setStatusConnecting = function () { return node.status({ fill: "yellow", shape: "ring", text: "connecting" }); };
        let setStatusConnected = function () { return node.status({ fill: "green", shape: "ring", text: "connected" }); };
        let setStatusDisconnected = function () { return node.status({ fill: "red", shape: "ring", text: "disconnected" }); };
        var setStatusOnError = function (e, requestID, message = "error") {
            node.error(`[${requestID}] An error had occured ${e} ${JSON.stringify(e)}`);
            return node.status({ fill: "red", shape: "ring", text: message });
        };

        node.on('close', function () {
            // tidy up any state
            // clearInterval(int);
            //shouldTryReconnect = false;
            //tuyaDevice.disconnect();

        });

    }
    RED.nodes.registerType("tuya-smart-device-generic", TuyaSmartDeviceSelfNode);
}