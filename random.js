// Get the canvas element
var canvas = document.getElementById("universe");
var ctx = canvas.getContext("2d");

// Adjust the canvas size to the window size
window.addEventListener("resize", function() {
  canvas.height = window.innerHeight*0.96;
  canvas.width = window.innerWidth*0.97;
});
window.dispatchEvent(new Event("resize"));

// Particle object
function Particle(x, y, vx, vy, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
}

// Initialize the particle system
var particleCount = 550;
var particles = [];
var colorNames = ["red", "orange", "yellow", "green", "blue", "purple"];

// Ineraction parameters
var I = [];
for (var i = 0; i < colorNames.length; i++) {
    I[i] = [];
    for (var j = 0; j < colorNames.length; j++) {
        I[i][j] = Math.random() * 2 - 1;
    }
}


for (var i = 0; i < particleCount; i++) {
  var x = Math.random() * canvas.width;
  var y = Math.random() * canvas.height;
  var vx = Math.random() * 2 - 1;
  var vy = Math.random() * 2 - 1;
  var color = colorNames[Math.floor(Math.random() * colorNames.length)];
  particles.push(new Particle(x, y, vx, vy, color));
}

// Render the particle system
function render() {
    // Black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < particleCount; i++) {
      var particle = particles[i];
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
}

function F(d, p) {
    var C = 0.8;
    var a = 50;
    var b = 140;
    var c = 200;
    if (d <= a) {
        return (1-d/a)*C;
    }
    if (d > a && d < b) {
        return (p/(b-a)*(d-a))*C;
    }
    if (d > b && d <= c) {
        return (p/(b-c)*(d-c))*C;
    }
    if (d > c) {
        return 0;
    }
}

function update() {
    for (var i=0; i<particleCount; i++) {
        var particle1 = particles[i];
            for (var j=i+1; j<particleCount; j++) {
                var particle2 = particles[j];

                var dx = particle1.x - particle2.x;
                var dy = particle1.y - particle2.y;

                //PBC for dx
                if (dx > canvas.width/2) {
                    dx = dx - canvas.width;
                }
                if (dx < -canvas.width/2) {
                    dx = dx + canvas.width;
                }
                //PBC for dy
                if (dy > canvas.height/2) {
                    dy = dy - canvas.height;
                }
                if (dy < -canvas.height/2) {
                    dy = dy + canvas.height;
                }

                var d = Math.sqrt(dx*dx+dy*dy);
                var theta = Math.atan2(dy,dx);

                // same color interaction
                if (particle1.color == particle2.color) {
                    particle1.vx += F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.cos(theta);
                    particle1.vy += F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.sin(theta);
                    particle2.vx -= F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.cos(theta);
                    particle2.vy -= F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.sin(theta);
                }
                // different color interaction
                if (particle1.color != particle2.color) {
                    particle1.vx += F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.cos(theta);
                    particle1.vy += F(d,I[colorNames.indexOf(particle1.color)][colorNames.indexOf(particle2.color)])*Math.sin(theta);
                    particle2.vx -= F(d,I[colorNames.indexOf(particle2.color)][colorNames.indexOf(particle1.color)])*Math.cos(theta);
                    particle2.vy -= F(d,I[colorNames.indexOf(particle2.color)][colorNames.indexOf(particle1.color)])*Math.sin(theta);
                }
            }
    }

    for (var i=0; i<particleCount; i++) {
        var particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx = 0;
        particle.vy = 0;

        // Periodic boundary conditions
        if (particle.x > canvas.width) {
            particle.x = 0;
        }
        if (particle.x < 0) {
            particle.x = canvas.width;
        }
        if (particle.y > canvas.height) {
            particle.y = 0;
        }
        if (particle.y < 0) {
            particle.y = canvas.height;
        }
    }
}



    

// Start the animation loop
setInterval(function() {
  render();
  update();
}, 10);
