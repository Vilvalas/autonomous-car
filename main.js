const net = require('net');

const courseLength = 1000;
// Deceleration: 22km/h per sec
const decelerationSpeed = 22;
const decelerationNoBrake = decelerationSpeed / 100;
const maxSpeed = 70;

let speed;
let distance;
let time;
let currentLimit;
let distanceToNextLimit;
let nextLimit;
let distanceToTl;
let tlState;
let tlRemainingTime;

let didBrakeForSign;
let didBrakeForTl = 0;

let client = new net.Socket();
client.connect(7000, '127.0.0.1', function () {
    console.log('Connected');
});

client.on('data', function (data) {
    data = data.toString();
    data = data.split('\r\n');
    // console.log(data);
    for (let i = 0; i < data.length; i++) {
        if (data[i].includes('distance')) {
            distance = parseFloat(data[i].replace('distance ', ''));
        } else if (data[i].includes('time')) {
            time = parseFloat(data[i].replace('time ', ''));
        } else if (data[i].includes('speedlimit')) {
            let slValues = data[i].split(' ');
            currentLimit = parseFloat(slValues[1]);
            distanceToNextLimit = parseFloat(slValues[2]);
            nextLimit = parseFloat(slValues[3]);
        } else if (data[i].includes('speed')) {
            speed = parseFloat(data[i].replace('speed ', ''));
        } else if (data[i].includes('trafficlight')) {
            let tlValues = data[i].split(' ');
            distanceToTl = parseFloat(tlValues[1]);
            if (distanceToTl !== 0) {
                tlState = tlValues[2];
                tlRemainingTime = parseFloat(tlValues[3]);
            }
        } else if (data[i].includes('update')) {
            // console.log("Update requested, current values: " + " Speed: " + speed + " Distance: " + distance + " Time: " + time);
            calculateUpdate(speed, distance, time, currentLimit, distanceToNextLimit, nextLimit, distanceToTl, tlState, tlRemainingTime);
        }
    }
});

function calculateUpdate(speed, distance, time, currentLimit, distanceToNextLimit, nextLimit, distanceToTl, tlState, tlRemainingTime) {
    let throttle = 100;
    let brake = 0;

    let metersPerSecond = speed / 3.6;

    // Check if we have to brake for a speed limit
    if (distanceToNextLimit !== 0 && nextLimit !== 0) {
        let nextDanger = nextLimit + ((distanceToNextLimit * decelerationSpeed) / 50);
        if (speed > nextDanger) {
            didBrakeForSign = nextLimit;
            throttle = 0;
            brake = 100;
        }
    }

    // Check if there is a traffic light coming up
    if (distanceToTl !== 0) {
        if(distanceToTl > didBrakeForTl) {
            didBrakeForTl = 0;
        }

        // Only consider close enough traffic lights
        if (distanceToTl < 50) {
            let timeToTl = distanceToTl / metersPerSecond;
            if (tlState === "Green") {
                if (timeToTl < tlRemainingTime) {
                    // We'll make it in time
                } else {
                    didBrakeForTl = distanceToTl;
                    throttle = 0;
                    brake = 100;
                }
            } else {
                if (tlRemainingTime < timeToTl) {
                    // TL will be green when we arrive, do nothing
                } else {
                    didBrakeForTl = distanceToTl;
                    throttle = 0;
                    brake = 100;
                }
            }
        }
    }

    // If we did already brake for the next traffic light, don't increase throttle
    if (distanceToTl < didBrakeForTl && tlState !== "Green") {
        throttle = 0;
    }

    // Check if we have to stop accelerating
    if (speed > maxSpeed || speed > currentLimit - 2) {
        throttle = 0;
    }

    // If we did already brake for the next speed limit, don't increase throttle
    if (nextLimit === didBrakeForSign) {
        throttle = 0;
    }

    // Stop at the end of the road
    if (distance > courseLength) {
        throttle = 0;
        brake = 100;
    }

    sendUpdate(throttle, brake);
}

function sendUpdate(throttle, brake) {
    let output = 'throttle ' + throttle + '\r\n' + 'brake ' + brake + '\r\n' + '\r\n';
    client.write(output);
}

client.on('close', function () {
    console.log('Connection closed');
});