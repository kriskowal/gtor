"use strict";

var PromiseBuffer = require("./promise-buffer");

module.exports = PromiseMachine;
function PromiseMachine(callback, thisp, limit) {
    var input = new PromiseBuffer();
    var output = new PromiseBuffer();
    this.in = input.in;
    this.out = output.out;
    this.done = input.out.map(callback, thisp).forEach(output.in.yield, output.in, limit);
}

