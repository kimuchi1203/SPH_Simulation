var SPH_H = 50;
var DT = 10;
var P_RHO = 100;
var X_WIDTH=500;
var Y_WIDTH=500;
var Y_OFFSET=300;
var EPSILON = 0.1;//0.05;
var ABSORB = 0.9;
var GRAVITY = 0.001*DT;
var model = { "particle":{ "x":[], "y":[], "vx":[], "vy":[], "rho":[] }, 
              "boundary":{ "x":[], "y":[], "vx":[], "vy":[], "rho":[] },
              "time":0
            };
// control
function init(){
  initModel(model);
  var canvas = document.getElementById('canvas');
  canvas.addEventListener("click", onClick, false);
}

function step(){
  calc(model);
  view(model);
  //console.log(model["time"]);
  model["time"] += DT;
  return false;
}

function start(){
  setInterval(function(){
    step();
  }, 0);
}

function onClick(e){
  var position = {};
  getMousePosition(e, position);
  addParticle(position);
}

function getMousePosition(e, position){
  var x;
  var y;
  if (e.pageX || e.pageY) { 
    x = e.pageX;
    y = e.pageY;
  } else { 
    x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; 
    y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop; 
  }
  x -= document.getElementById('canvas').offsetLeft;
  y -= document.getElementById('canvas').offsetTop;
  position["x"] = x;
  position["y"] = y;
}

// model
function initModel(model){
  var d = SPH_H/2;

  for(var i=0;i<X_WIDTH-d;i+=d){
    for(var j=0;j<Y_WIDTH-d-Y_OFFSET;j+=d){
      model["particle"]["x"].push(i+d);
      model["particle"]["y"].push(j+d+Y_OFFSET);
      model["particle"]["vx"].push(0);
      model["particle"]["vy"].push(0);
      model["particle"]["rho"].push(0);
    }
  }

  setBorder(model["boundary"]);
}

function addParticle(position){
  model["particle"]["x"].push(position["x"]);
  model["particle"]["y"].push(position["y"]);
  model["particle"]["vx"].push(0);
  model["particle"]["vy"].push(0);
  model["particle"]["rho"].push(0);
}

function setBorder(boundary){
  var d=SPH_H/2;
  for(i=0;i<=X_WIDTH;i+=d){
    boundary["x"].push(i);
    boundary["y"].push(0);
    boundary["vx"].push(0);
    boundary["vy"].push(0);
    boundary["x"].push(i);
    boundary["y"].push(X_WIDTH);
    boundary["vx"].push(0);
    boundary["vy"].push(0);
    boundary["x"].push(0);
    boundary["y"].push(i);
    boundary["vx"].push(0);
    boundary["vy"].push(0);
    boundary["x"].push(X_WIDTH);
    boundary["y"].push(i);
    boundary["vx"].push(0);
    boundary["vy"].push(0);
  }
}

function calc(model){
  var accel = {"x":new Array(model["particle"]["x"].length), "y":new Array(model["particle"]["x"].length)};
  for(var i=0;i<model["particle"]["x"].length;++i){
    accel["x"][i] = 0;
    accel["y"][i] = 0;
    model["particle"]["rho"][i] = kernel(0);;
  }
  for(var i=0;i<model["boundary"]["x"].length;++i){
    model["boundary"]["rho"][i] = kernel(0);
  }
  var pair = [];
  makePair(model["particle"], pair);
  calcRho(model["particle"], pair);
  calcBoundRho(model);
  calcAccel(model["particle"], pair, accel);
  calcBound(model, accel);
  calcArtVisc(model, pair);
  integration(model["particle"], accel);
}

function makePair(particle, pair){
  for(var i=0;i<particle["x"].length;++i){
    for(var j=i+1;j<particle["x"].length;++j){
      pair.push(i);
      pair.push(j);
    }
  }
}

function calcRho(particle, pair){
  var dx;
  var dy;
  var range2;
  for(var i=0;i<pair.length/2;++i){
    dx = particle["x"][pair[i*2]] - particle["x"][pair[i*2+1]];
    dy = particle["y"][pair[i*2]] - particle["y"][pair[i*2+1]];
    range2 = (dx*dx)+(dy*dy);
    particle["rho"][pair[i*2]] += density(range2);
    particle["rho"][pair[i*2+1]] += density(range2);
  }
}

function calcBoundRho(model){
  var dx;
  var dy;
  var range2;
  for(var i=0;i<model["particle"]["x"].length;++i){
    for(var j=0;j<model["boundary"]["x"].length;++j){
      dx = model["particle"]["x"][i] - model["boundary"]["x"][j];
      dy = model["particle"]["y"][i] - model["boundary"]["y"][j];
      range2 = dx*dx+dy*dy;
      model["particle"]["rho"][i] += density(range2);
      model["boundary"]["rho"][j] += density(range2);
    }
  }
}

function density(range2){
  return kernel(range2);
}

function calcAccel(particle, pair, accel){
  var dx;
  var dy;
  var range2;
  for(var i=0;i<pair.length/2;++i){
    dx = particle["x"][pair[i*2]] - particle["x"][pair[i*2+1]];
    dy = particle["y"][pair[i*2]] - particle["y"][pair[i*2+1]];
    range2 = dx*dx+dy*dy;
    accel["x"][pair[i*2]] -= force(dx, range2, particle["rho"], pair[i*2], pair[i*2+1]);
    accel["y"][pair[i*2]] -= force(dy, range2, particle["rho"], pair[i*2], pair[i*2+1]);
    accel["x"][pair[i*2+1]] += force(dx, range2, particle["rho"], pair[i*2+1], pair[i*2]);
    accel["y"][pair[i*2+1]] += force(dy, range2, particle["rho"], pair[i*2+1], pair[i*2]);
  }
}

function calcBound(model, accel){
  var dx;
  var dy;
  var range2;
  for(var j=0;j<model["boundary"]["x"].length;++j){
    for(var i=0;i<model["particle"]["x"].length;++i){
      dx = model["particle"]["x"][i] - model["boundary"]["x"][j];
      dy = model["particle"]["y"][i] - model["boundary"]["y"][j];
      range2 = dx*dx+dy*dy;
      accel["x"][i] -= force(dx, range2, model["particle"]["rho"], i, j);
      accel["y"][i] -= force(dy, range2, model["particle"]["rho"], i, j);
    }
  }
}

function force(dr, range2, rho, i, j){
  return (pressure(rho[i])+pressure(rho[j]))/(2*rho[j])*dkernel(range2)*dr;
}

function pressure(rho){
  return P_RHO*rho;
}

function kernel(range2){
  var alpha = 4/(Math.PI*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H);
  if(range2<SPH_H*SPH_H){
    return alpha*(SPH_H*SPH_H - range2)*(SPH_H*SPH_H - range2)*(SPH_H*SPH_H - range2);
  }else{
    return 0;
  }
}

function dkernel(range2){
  /*
  // Poly6
  var alpha = -24/(Math.PI*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H);
  if(range2<SPH_H*SPH_H){
    return alpha*(SPH_H*SPH_H - range2)*(SPH_H*SPH_H - range2);
  }else{
    return 0;
  }
  */
  // Spiky
  var alpha = -30/(Math.PI*SPH_H*SPH_H*SPH_H*SPH_H*SPH_H);
  if(range2<SPH_H*SPH_H){
    return alpha*(SPH_H - Math.sqrt(range2))*(SPH_H - Math.sqrt(range2))/Math.sqrt(range2);
  }else{
    return 0;
  }
}

function calcArtVisc(model, pair){
  // XSPH Artificail Viscosity
  var dx;
  var dy;
  var range2;
  var dvx;
  var dvy;
  var eps = EPSILON;
  for(var i=0;i<pair.length/2;++i){
    dx = model["particle"]["x"][pair[i*2]] - model["particle"]["x"][pair[i*2+1]];
    dy = model["particle"]["y"][pair[i*2]] - model["particle"]["y"][pair[i*2+1]];
    range2 = dx*dx+dy*dy;
    dvx = model["particle"]["vx"][pair[i*2]] - model["particle"]["vx"][pair[i*2+1]];
    dvy = model["particle"]["vy"][pair[i*2]] - model["particle"]["vy"][pair[i*2+1]];
    model["particle"]["vx"][pair[i*2]] -= eps/model["particle"]["rho"][pair[i*2+1]]*dvx*kernel(range2);
    model["particle"]["vy"][pair[i*2]] -= eps/model["particle"]["rho"][pair[i*2+1]]*dvy*kernel(range2);
    model["particle"]["vx"][pair[i*2+1]] += eps/model["particle"]["rho"][pair[i*2+1]]*dvx*kernel(range2);
    model["particle"]["vy"][pair[i*2+1]] += eps/model["particle"]["rho"][pair[i*2+1]]*dvy*kernel(range2);
  }
}

function integration(particle, accel){
  var dt = DT;
  var abs = ABSORB;
  for(var i=0;i<particle["x"].length;++i){
    particle["x"][i] += particle["vx"][i]*dt;
    particle["y"][i] += particle["vy"][i]*dt;
    particle["vx"][i] += accel["x"][i]*dt;
    particle["vy"][i] += accel["y"][i]*dt + gravity();

    if(particle["x"][i]>X_WIDTH){
      particle["x"][i] = X_WIDTH*2-particle["x"][i];
      particle["vx"][i] = -particle["vx"][i]*abs;
    }else if(particle["x"][i]<0){
      particle["x"][i] = -particle["x"][i];
      particle["vx"][i] = -particle["vx"][i]*abs;
    }
    if(particle["y"][i]>Y_WIDTH){
      particle["y"][i] = Y_WIDTH*2-particle["y"][i];
      particle["vy"][i] = -particle["vy"][i]*abs;
    }else if(particle["y"][i]<0){
      particle["y"][i] = -particle["y"][i];
      particle["vy"][i] = -particle["vy"][i]*abs;
    }
  }
}

function gravity(){
  return GRAVITY;
}

// view
function view(model) {
  var canvas = document.getElementById('canvas');
  var cc = canvas.getContext('2d');
  cc.save();
  cc.clearRect(0, 0, canvas.width, canvas.height);
  plotData(model["particle"]["x"], model["particle"]["y"]);
  plotData(model["boundary"]["x"], model["boundary"]["y"]);//border
  cc.restore();
}

function plotData(x, y){
  var cc = document.getElementById('canvas').getContext('2d');
  for(var i=0;i<x.length;++i){
    plot(cc, x[i], y[i], 'rgb(128, 128, 255)');
  }
}

function plot(cc, x, y, style) {
  r = 5;
  cc.beginPath();
  cc.fillStyle = style;
  cc.arc(x, y, r, 0, Math.PI*2, false);
  cc.fill();
}
