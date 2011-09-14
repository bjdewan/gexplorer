//   "GExplorer to explore "Places"
//   written by: Paul van Dinther
//            Dinther Product Design
//            Software development and specialists in simulation
//            email: vandinther@gmail.com
//   GExplorer is a 3D navigation solution to smoothly explore 3D space.
//
//   Copyright 2009 Dinther Product Design Ltd
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
//
//   uses pia_globals.js

PIA_earthRadius = 6371000;
PIA_moonRadius =  1737100;
PIA_marsRadius =  3396200;

PIA_globeRadius = PIA_earthRadius;
PIA_globeCircumference = PIA_globeRadius * 2 * Math.PI;



//*****************************************
//These global variables are re-used a lot in various calculations
//that normally happen on a per frame basis
//Globalised and calculated at a lesser interval improves performance
//and only causes a slight inaccuracy that goes un-noticed
//*****************************************
//multiply with this to get angle in radians
var PIA_degreesToRad = Math.PI/180;
//multiply a meter with this to get a delta latitude (1/60 of a degree is 1852 meters)
var PIA_metersToLocalLat = 1/(PIA_globeCircumference/360); 

//returns conversion factor to turn meters east or west into a delta longitude. Use sparingly, better to use globals if possible
function PIA_getMetersToLocalLon(latitude){
    var _metersToLocalLon = PIA_metersToLocalLat/Math.cos(latitude * PIA_degreesToRad);
    return(_metersToLocalLon);
}

function PIA_smoothValueAnimation(scurrent, starget, smaxrate, srate, sgain, sloose){
    this.current = scurrent; //read your current value here
    this.target = starget; //set to what you want value to become
    this.maxRate = smaxrate; //controls max rate of change
    this.rate = srate; //current rate of change
    this.gain = sgain; //defines how acceleration is
    this.loose = sloose; //defines how fast deceleration is
    this.deltaValue = 0.0;
};

PIA_smoothValueAnimation.prototype.freeze = function(){
    this.rate = 0;
    this.deltaValue = 0;
    this.target = this.current;
};

PIA_smoothValueAnimation.prototype.set = function(newValue){
    this.current = newValue;
    this.freeze();
};
    
PIA_smoothValueAnimation.prototype.update = function(deltaTime){
    //measure time lapse till 100ms has passed
    //remove oldest value from ground height total
    //add newest value to ground height total
    //add it to an array with 20 values
    //calc average ground height 



    this.deltaValue = this.target - this.current;
    if (this.deltaValue < 0){
        var r1 = this.deltaValue * this.loose;
        var r2 = this.rate - this.gain * deltaTime;
        var r3 = -this.maxRate;
        this.rate = Math.max(Math.max(r1,r2),r3);   
    }
    else {
        var r1 = this.deltaValue * this.loose;
        var r2 = this.rate + this.gain * deltaTime;
        var r3 = this.maxRate;
        this.rate = Math.min(Math.min(r1,r2),r3);   
    }
    this.current += this.rate * deltaTime;  
};

function PIA_inertObject (){
    this.mass = 500;
    this.dragFriction = 1;
    this.dynamicFriction = 1;
    this.up = [0,0,1];
    this.accelerationvector = [0, 0, 0]; //right, forward, up
    this.speedvector = [0, 0, 0]; //right, forward, up
    this.forcevector = [0, 0, 0]; //right, forward, up
    this.speed = 0;
    this.latitude = 0;
    this.longitude = 0;
    this.altitude = 100;
    this.dynamicfrictionvector = [0,0,0];
    this.staticfrictionvector = [0,0,0];
    this.speedscale = 1;
    this.tilt = new PIA_smoothValueAnimation(90,90,1000,0.0,512,1);
    this.rollfactor = 0.001;
    this.roll = new PIA_smoothValueAnimation(0,0,4000,0.0,512,1);
    this.heading = 0;
    this.moment = 0;
    this.dragmoment = 0;
    this.rotacceleration = 0;
    this.rotspeed = 0;
    this.autotilt = false;
    this.timepassed = 0;
    //init ground altitude array
    this.groundaltitude = ge.getGlobe().getGroundAltitude(this.latitude, this.longitude);
    this.groundaltitudes = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    this.totalgroundaltitude = 0;
    this.averagegroundaltitude = 0;
    this.groundaltitudeid = 0;
    this.autoaltitude = 0; //0 or less means disabled
}

PIA_inertObject.prototype.update = function(deltaTime){
    this.timepassed += deltaTime;
    
    if (this.timepassed > 0.2) {
        //This logic maintains average ground altitude for the last x samples without the need to iterate through the array
        this.groundaltitude = ge.getGlobe().getGroundAltitude(this.latitude, this.longitude);
        this.totalgroundaltitude -= this.groundaltitudes[this.groundaltitudeid];    
        this.groundaltitudes[this.groundaltitudeid] = this.groundaltitude;
        this.totalgroundaltitude += this.groundaltitude;
        this.averagegroundaltitude = this.totalgroundaltitude / this.groundaltitudes.length;
        this.groundaltitudeid += 1;
        if (this.groundaltitudeid > this.groundaltitudes.length-1){
            this.groundaltitudeid = 0;
        }
        this.timepassed = 0;
    }

    //redefine altitude force component if autoaltitude is used
    if (this.autoaltitude > 0) {
        var height = Math.abs(this.altitude - this.groundaltitude);
        var correctionfactor = this.autoaltitude / height - 1;
        var amplifier = 6000;
        if (correctionfactor > 0) { this.forcevector[2] = correctionfactor * amplifier; }
        else { this.forcevector[2] = correctionfactor * 10 * amplifier; }
    }


    //update heading
    var resultantmoment = this.moment - this.dragmoment;
    this.rotacceleration = resultantmoment/this.mass;
    this.rotspeed += this.rotacceleration * deltaTime;
    this.heading += this.rotspeed * deltaTime;
    while (this.heading < 0) { this.heading += 360; }
    while (this.heading > 360) { this.heading -= 360; }

    var resultantforcevector = V3.sub(this.forcevector, this.dynamicfrictionvector);
    
    for (var i=0; i < 3; i++) {
        this.accelerationvector[i] = resultantforcevector[i]/this.mass;
        this.speedvector[i] += this.accelerationvector[i] * deltaTime;
    }
    
    //adjust speed vector with heading
    var speed = V3.rotate(this.speedvector, this.up, -this.heading * 0.0174532);

    //Ensure altitude is above ground
    if (this.altitude < this.groundaltitude + 2){
        this.altitude = this.groundaltitude + 2;
    }
    
    //calculate height above ground
    var averageheight = this.altitude - this.averagegroundaltitude;

    //calculate speed scaling
    this.speedscale = averageheight * 0.005;
    
    //update latitude
    this.latitude += speed[1] * deltaTime * PIA_metersToLocalLat * this.speedscale;
    if (this.latitude > 70){ this.latitude = 70 }
    if (this.latitude < -70){ this.latitude = -70 }
    
    //update longitude
    this.longitude += speed[0] * deltaTime * PIA_getMetersToLocalLon(this.latitude) * this.speedscale;
    if (this.longitude > 180) { this.longitude -= 360;};
    if (this.longitude < -180) { this.longitude += 360;};
    
    //update altitude
    this.altitude += speed[2] * deltaTime * this.speedscale;
    if (this.altitude > 20000000){ this.altitude = 20000000 }
    
    //update tilt
    this.tilt.update(deltaTime);
    if (this.autotilt){
        this.tilt.target = 75 - Math.acos(PIA_globeRadius/(PIA_globeRadius + this.altitude))/0.0174532;
    }
    
    //update roll
    if (this.rollfactor != 0){
        this.roll.target = (-this.speedvector[1] * this.rotspeed * this.rollfactor) + (-this.speedvector[0] * 30 * this.rollfactor);
        this.roll.update(deltaTime);
    } else {
        this.roll.set(0);
    }
    
    this.speed = V3.length(speed);
    //apply lateral friction
    if (this.speed > 0){
        //apply dynamic friction which is opposite the speed vector
        this.dynamicfrictionvector = V3.normalize(this.speedvector);
        this.dynamicfrictionvector = V3.scale(this.dynamicfrictionvector,(this.speed * this.speed * this.dragFriction) + (10000 * this.dynamicFriction));
    } else { this.dynamicfrictionvector = [0,0,0] }

    //apply rotational friction
    if (this.rotspeed > 0){
        this.dragmoment = (this.rotspeed * this.rotspeed * this.dragFriction * 20) + (20000 * this.dynamicFriction);
    } else     if (this.rotspeed < 0){
        this.dragmoment = -((this.rotspeed * this.rotspeed * this.dragFriction * 10) + (10000 * this.dynamicFriction));
    } else this.dragmoment = 0;
};

PIA_inertObject.prototype.init = function(latitude, longitude, altitude, heading, tilt, roll){
    this.latitude = latitude;
    this.longitude = longitude;
    this.altitude = altitude;
    this.tilt.set(tilt);
    this.heading = heading;
    this.roll.set(roll);
    this.stopMotion();
} 

PIA_inertObject.prototype.initFromCurrentView = function(camera){
    var camera = ge.getView().copyAsCamera(ge.ALTITUDE_ABSOLUTE);
    this.init(camera.getLatitude(), camera.getLongitude(), camera.getAltitude(), camera.getHeading(), camera.getTilt(), camera.getRoll());
}

PIA_inertObject.prototype.stopMotion = function(){
    this.accelerationvector = [0, 0, 0];
    this.speedvector = [0, 0, 0];
    this.rotspeed = 0;
};

PIA_inertObject.prototype.initFromLookAtJsonString = function(jsonData){
    if (jsonData != ''){
        var data = eval('('+jsonData+')');
        var currentLookAt = ge.getView().copyAsLookAt(ge.ALTITUDE_ABSOLUTE);
        currentLookAt.setLatitude(data.lat);
        currentLookAt.setLongitude(data.lon);
        currentLookAt.setAltitude(data.alt);
        currentLookAt.setHeading(data.hdg);
        currentLookAt.setTilt(data.tlt);
        currentLookAt.setRange(data.rng);
        var currentCamera = currentLookAt.copyAsCamera();
        this.init(currentCamera.getLatitude(), currentCamera.getLongitude(), currentCamera.getAltitude(), currentCamera.getHeading(), currentCamera.getTilt(), currentCamera.getRoll());
    }
};

PIA_inertObject.prototype.initFromCameraJsonString = function(jsonData){
    if (jsonData != ''){
        var data = eval('('+jsonData+')');
        this.init(data.lat, data.lon, data.alt, data.hdg, data.tlt, data.rll);
    }
};


