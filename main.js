const net = require('net');

// Deceleration: 22km/h per sec
const decelerationSpeed = 22;
const decelerationNoBrake = decelerationSpeed / 100;
const maxSpeed = 70;

let speed;
let distance;
let time;
let currentLimit;
let distanceToNext;
let nextLimit;

let didBrakeForSign;

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
            distanceToNext = parseFloat(slValues[2]);
            nextLimit = parseFloat(slValues[3]);
        } else if (data[i].includes('speed')) {
            speed = parseFloat(data[i].replace('speed ', ''));
        } else if (data[i].includes('update')) {
            // console.log("Update requested, current values: " + " Speed: " + speed + " Distance: " + distance + " Time: " + time);
            calculateUpdate(speed, distance, time, currentLimit, distanceToNext, nextLimit);
        }
    }
});

function calculateUpdate(speed, distance, time, currentLimit, distanceToNext, nextLimit) {
    let throttle = 100;
    let brake = 0;

    // Check if we have to brake
    if (distanceToNext !== 0 && nextLimit !== 0) {
        let nextDanger = nextLimit + ((distanceToNext * decelerationSpeed) / 50);
        if (speed > nextDanger) {
            didBrakeForSign = nextLimit;

            throttle = 0;
            brake = 100;
        }
    }

    // Check if we have to stop accelerating
    if (speed > maxSpeed || speed > currentLimit - 2) {
        throttle = 0;
    }

    // If we did already brake for the next sign, don't increase throttle
    if (nextLimit === didBrakeForSign) {
        throttle = 0;
    }

    // Stop at end of the road
    if (distance > 1500) {
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