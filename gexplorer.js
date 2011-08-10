//"GExplorer to explore "Places"
//written by: Paul van Dinther
//            Dinther Product Design
//            Software development and specialists in simulation
//            email: vandinther@gmail.com
//GExplorer is a 3D navigation solution to smoothly explore 3D space.
//Copy right 2009 Dinther Product Design Ltd
    
var PIA_metersToLocalLat = 0.0000089992800575953923686105111591073; //multiply a meter with this to get a delta latitude (1/60 of a degree is 1852 meters)
var PIA_degreesToRad = 0.017453292519943; //multiply with this to get angle in radians

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

function PIA_gexplorer(latitude, longitude, altitude, heading, pitch, speedFactor){
	this.URL = '';
	this.cosLatitude = 0.0;
	this.radLatitude = 0.0;
	this.metersToLocalLon = 0.0;
	this.defaultSpeedFactor = speedFactor;
	this.targetSpeedFactor = speedFactor;
	this.cospitch = 0;
	//inputs
	this.heading = new PIA_smoothValueAnimation(heading,heading,220,0.0,30,1.5);
	this.altitude = new PIA_smoothValueAnimation(altitude,altitude,600000,0.0,500,1);
	this.speedFactor = new PIA_smoothValueAnimation(0,0,0.5,0.0,0.5,0.5);
	this.strafeFactor = new PIA_smoothValueAnimation(0,0,4,0.0,2,0.5);
	this.targetHeadTilt = new PIA_smoothValueAnimation(pitch,pitch,1000,0.0,512,1);
	//outputs
	this.speed = 0;
	this.commandedAltitude = 0;
	this.strafeSpeed = 0;
	this.elevation = 0;
	this.groundAltitude = 0;
	this.latitude = latitude;
	this.longitude = longitude;
	this.deltaHeading = 0.0;
	this.deltaAltitude = 0.0;
	this.roll = 0;
};
               
PIA_gexplorer.prototype.freeze = function(){
	this.speedFactor.set(0);
	this.strafeFactor.set(0);
	this.heading.freeze();
	this.altitude.freeze();
	this.targetHeadTilt.freeze();             
};
       
PIA_gexplorer.prototype.update = function(deltaTime){
	this.radLatitude = this.latitude * PIA_degreesToRad;
	this.cosLatitude = Math.cos(this.radLatitude);
	this.metersToLocalLon = PIA_metersToLocalLat/this.cosLatitude;
	this.simulateStep(deltaTime);
	this.heading.update(deltaTime);
	this.altitude.update(deltaTime);
	this.targetHeadTilt.update(deltaTime); 
	this.speedFactor.update(deltaTime);      
	this.strafeFactor.update(deltaTime);
};
    
PIA_gexplorer.prototype.simulateStep = function (deltaTime){
	this.speed = this.speedFactor.current * this.elevation;
	this.strafeSpeed = this.strafeFactor.current * this.elevation;            
	var radheading = PIA_degreesToRad * this.heading.current;
	this.latstep  = (Math.cos(radheading) * deltaTime * this.speed * PIA_metersToLocalLat) - (Math.sin(radheading) * deltaTime * this.strafeSpeed * PIA_metersToLocalLat);
	this.longstep = (Math.sin(radheading) * deltaTime * this.speed * this.metersToLocalLon) + (Math.cos(radheading) * deltaTime * this.strafeSpeed * this.metersToLocalLon);
	this.longitude += this.longstep;
	this.latitude += this.latstep;
	this.groundAltitude = ge.getGlobe().getGroundAltitude(this.latitude, this.longitude);
	this.elevation = this.altitude.current - this.groundAltitude;         
	if (this.altitude.target < this.groundAltitude) {
		this.altitude.target = this.groundAltitude;
	}
	this.cospitch = Math.cos(this.targetHeadTilt.current * PIA_degreesToRad);
	this.roll = (-(this.heading.rate / 3 * Math.min(this.speedFactor.current, 1)) - this.strafeFactor.current*10) * this.cospitch;
};