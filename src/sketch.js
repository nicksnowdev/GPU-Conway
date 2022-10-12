/// <reference path="C:/Users/nicsn/projects/resources/p5_definitions/global.d.ts" />

// parameters to be controlled
const controls = {
  iterations: 1,
  brushSize: 20,
  trails: true
}
let paused = false;
let fpsGraph;

let graphics1; // stage 1
let graphics2; // stage 2
let theShader;
let trailsShader;
let noiseShader;

let halfWidth;
let halfHeight;
let lastBrushX = 0;
let lastBrushY = 0;
let zoom = 1;
let panX = 0;
let panY = 0;




function preload() {
  theShader = loadShader("vert.glsl", "frag.glsl"); // conway shader
  trailsShader = loadShader("vert.glsl", "trails_frag.glsl");
  noiseShader = loadShader("vert.glsl", "noise_frag.glsl"); // white -> noise
}




// THIS PREVENT CONTEXT MENU WHEN RIGHT-CLICKING ON THE CANVAS
document.oncontextmenu = function() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height)
    return false;
}

function windowResized() {
  resizeCanvas(floor(windowHeight * .8 * .5) * 2, floor(windowHeight * .8 * .5) * 2);
  graphics1.resizeCanvas(width, height);
  graphics2.resizeCanvas(width, height);
  halfWidth = width * .5;
  halfHeight = height * .5;
}

// this function kind of got away from me, but it works. the whole zoomcheck thing is messy but whatever.
function zoomControl(event) {
  let zoomCheck = zoom;
  if(event.deltaY < 0) {
    zoom = min(16, zoom * 2);
    if(zoomCheck != zoom) { // only center the zoom if a zoom adjustment actually occurred
      panX -= (mouseX - halfWidth) / zoom;
      panY -= (mouseY - halfHeight) / zoom;
    }
  } else {
    zoom = max(1, zoom * .5);
    if(zoomCheck != zoom) { // only center the zoom if a zoom adjustment actually occurred
      panX += (mouseX - halfWidth) / zoom * .5;
      panY += (mouseY - halfHeight) / zoom * .5;
    }
  }
  if(zoomCheck != zoom) {
    panX = min(max(-halfWidth / zoom * (zoom - 1), panX), halfWidth / zoom * (zoom - 1)); // auto-adjust panning when zooming out
    panY = min(max(-halfHeight / zoom * (zoom - 1), panY), halfHeight / zoom * (zoom - 1));
  }
}

// this is a built-in function
function mouseDragged(event) {
  if(mouseButton == CENTER) {
    panX = min(max(-halfWidth / zoom * (zoom - 1), panX + event.movementX / zoom), halfWidth / zoom * (zoom - 1));
    panY = min(max(-halfHeight / zoom * (zoom - 1), panY + event.movementY / zoom), halfHeight / zoom * (zoom - 1));
  }
  return true;
}




function setup() {
  pixelDensity(1); // account for high-density displays
  let canvas = createCanvas(floor(windowHeight * .8 * .5) * 2, floor(windowHeight * .8 * .5) * 2, WEBGL); // 3D mode to allow shaders, also 707^2 is about 500,000 pixels
  canvas.position(0, 10, "relative");
  canvas.style("border-style", "solid");
  canvas.style("border-color", "gray");
  background(0); // initialize
  halfWidth = width * .5;
  halfHeight = height * .5;
  graphics1 = createGraphics(width, height); // create a 2D graphics buffer
  graphics1.background(0); // initialize
  graphics2 = createGraphics(width, height, WEBGL); // create a 3D graphics buffer
  graphics2.background(0); // initialize

  // set up zoom controls
  canvas.mouseWheel(zoomControl);

  // set up gui
  // define where the control panel should go
  const controlsContainer = createDiv();
  controlsContainer.id("controlsContainer");
  controlsContainer.style("position", "fixed"); // always visible, even when scrolling
  controlsContainer.style("top", "10px");
  controlsContainer.style("right", "10px"); // left or right
  controlsContainer.style("width", "275px");
  // create a pane as a child of the previously created div
  const pane = new Tweakpane.Pane({container: document.getElementById("controlsContainer"), title: "controls", expanded: true});
  pane.registerPlugin(TweakpaneEssentialsPlugin); // add plugin for fpsgraph
  pane.addSeparator();
  const pauseBtn = pane.addButton({title: "pause"}); // create pause button
  pauseBtn.on("click", () => { // alternatively, use () => yourFunc(anArg, anotherArg) to call any function with arguments
    if(!paused) {
      paused = true;
      pauseBtn.title = "resume";
    } else {
      paused = false;
      pauseBtn.title = "pause";
    }
  });
  pane.addSeparator();

  pane.addButton({title: "clear canvas"}).on("click", () => {
    graphics1.background(0);
    pauseBtn.title = "pause";
    paused = false;
  });
  pane.addButton({title: "fill canvas"}).on("click", () => {
    graphics1.loadPixels();
    for(let y = 0; y < height; y++) {
      for(let x = 0; x < width; x++) {
        index = (x + y * width) * 4;
        val = random(1).toFixed(0) * 255;
        graphics1.pixels[index + 0] = val;
        graphics1.pixels[index + 1] = controls.trails ? 0 : val;
        graphics1.pixels[index + 2] = controls.trails ? 0 : val;
      }
    }
    graphics1.updatePixels();
    pauseBtn.title = "pause";
    paused = false;
  });

  pane.addInput(controls, "iterations", {min: 1, max: 100, step: 1});
  pane.addInput(controls, "brushSize", {label: "brush size", min: 1, max: 100, step: 1});
  pane.addInput(controls, "trails", {label: "show trails"});

  pane.addSeparator();
  const stats = pane.addFolder({title: "stats", expanded: false});
  fpsGraph = stats.addBlade({view: "fpsgraph", label: "fps"});

  // fill canvas at start
  graphics1.loadPixels();
  for(let y = 0; y < height; y++) {
    for(let x = 0; x < width; x++) {
      index = (x + y * width) * 4;
      val = random(1).toFixed(0) * 255;
      graphics1.pixels[index + 0] = val;
      graphics1.pixels[index + 1] = controls.trails ? 0 : val;
      graphics1.pixels[index + 2] = controls.trails ? 0 : val;
    }
  }
  graphics1.updatePixels();
  pauseBtn.title = "pause";
  paused = false;
}

function draw() {
  fpsGraph.begin();
  if(!paused) {
    // multiple iterations per frame
    for(let i = 0; i < controls.iterations; i++) {
      // draw graphics1 to graphics2 through the shader
      graphics2.push();
      graphics2.fill(255);
      graphics2.noStroke();
      if(controls.trails) {
        graphics2.shader(trailsShader); // set the shader
        trailsShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
        trailsShader.setUniform("u_texel", [1 / width, 1 / height]);
        trailsShader.setUniform("u_gMax", 1.0);
        trailsShader.setUniform("u_bMax", 0.5);
        trailsShader.setUniform("u_gGrow", 0.0025);
        trailsShader.setUniform("u_bGrow", 0.0025);
        trailsShader.setUniform("u_gDecay", 0.0);
        trailsShader.setUniform("u_bDecay", 0.0);
      } else {
        graphics2.shader(theShader); // set the shader
        theShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
        theShader.setUniform("u_texel", [1 / width, 1 / height]);
      }
      graphics2.rect(-halfWidth, -halfHeight, width, height); // a container (the size of graphics1) to draw through the shader
      graphics2.pop(); // this resets the shader, otherwise need to call resetShader()

      // paint!
      // this has to go on graphics1 because it's 2D. painting on the 3D one is a disaster.
      graphics1.clear();
      let paintX = (mouseX - halfWidth) / zoom + halfWidth - panX; // the half vars cancel out at zoom = 1
      let paintY = (mouseY - halfHeight) / zoom + halfHeight - panY;
      let breaker = 0;
      if(!breaker && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        breaker = 1; // prevent running this section 100 times a frame
        // paint the lines
        let painted = 0;
        if(mouseIsPressed && (mouseButton == LEFT || mouseButton == RIGHT)) {
          painted = 1;
          graphics1.push();
          graphics1.fill(255 * (mouseButton == LEFT)); // white on LMB, black on RMB
          graphics1.noStroke();
          graphics1.ellipse(paintX, paintY, controls.brushSize);
          graphics1.stroke(255 * (mouseButton == LEFT));
          graphics1.strokeWeight(controls.brushSize)
          graphics1.line(lastBrushX, lastBrushY, paintX, paintY);
          graphics1.pop();
        }
        lastBrushX = paintX;
        lastBrushY = paintY;
        // only run this extra shader pass if something was painted
        if(painted) {
          // draw the paint from graphics1 to graphics2 through the noise shader
          graphics2.push();
          graphics2.fill(255);
          graphics2.noStroke();
          graphics2.shader(noiseShader); // set the shader
          noiseShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
          noiseShader.setUniform("u_targetTexture", graphics2) // pass in graphics2 for blending
          noiseShader.setUniform("u_time", millis() * .001); // randomize the noise, lol
          noiseShader.setUniform("u_blend", controls.trails ? [1, 0, 0] : [1, 1, 1]); // make alive pixels red if trails is on
          graphics2.rect(-halfWidth, -halfHeight, width, height); // a container (the size of graphics1) to draw through the shader
          graphics2.pop(); // this resets the shader, otherwise need to call resetShader()
        } else { // also hide the brush outline while painting
          // draw the brush shape
          push();
          noFill();
          stroke(255);
          strokeWeight(2);
          // i haven't wrapped my head around this calculation, all i know is i have to multiply zoom back in here for
          // the ellipse to draw in the right location.
          ellipse((paintX - halfWidth + panX) * zoom, (paintY - halfHeight + panY) * zoom, controls.brushSize * zoom);
          pop();
        }
      }
      // draw final state of the automaton back to graphics1 as an image
      graphics1.image(graphics2, 0, 0);
    }
  }
  // draw graphics2 to the canvas with desired zoom
  // having this outside the pause check lets you zoom and pan while paused
  texture(graphics2);
  rect((-halfWidth + panX) * zoom, (-halfHeight + panY) * zoom, width * zoom, height * zoom);
  fpsGraph.end();
}