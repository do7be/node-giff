#!/usr/bin/env node

'use strict';

let path    = require('path'),
    fs      = require('fs'),
    util    = require('util'),
    spawn   = require('child_process').spawn,
    exec    = require('child_process').exec,
    program = require('commander');

// set program info
program
  .version('0.0.2')
  .usage('[options] [<commit>] [--] [<path>...]')
  .option('--cached', 'show diff of staging files')
  .parse(process.argv);

// judge options
let options=[];
if (program.cached) {
  options.push('--cached');
}

// init output file
let realPath = path.dirname(fs.realpathSync(__filename));
outputJs(realPath, '');

// git diff
var giff = spawn('git', ['diff'].concat(program.args).concat(options));
giff.stdout.on('data', function (data) {
  // git diff result encode to base64
  let base64Diff = data.toString('Base64');
  outputJs(realPath, base64Diff);
});

giff.stderr.on('data', function (data) {
  console.log('stderr: ' + data);
});

giff.on('exit', function (code) {
});

console.log(`${realPath}/index.html`);
exec(`which open && open ${realPath}/index.html`);

function outputJs(dirPath, data) {
  let outputJsText = 'var lineDiffExample=window.atob("' + data + '");';
  fs.writeFileSync(`${dirPath}/dest/diff.js`, outputJsText);
}
