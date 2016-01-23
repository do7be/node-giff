#!/usr/bin/env node

'use strict';

let path    = require('path'),
    fs      = require('fs'),
    util    = require('util'),
    spawn   = require('child_process').spawn,
    exec    = require('child_process').exec,
    program = require('commander');

// set program info
program.version('0.0.1').usage('[options] [<commit>] [--] [<path>...]').parse(process.argv);

var giff = spawn('git', ['diff'].concat(program.args));

giff.stdout.on('data', function (data) {
  // git diff result encode to base64
  let realPath = path.dirname(fs.realpathSync(__filename));
  let base64Diff = new Buffer(data).toString('Base64');
  let outputJsText = 'var lineDiffExample=window.atob("' + base64Diff + '");';
  fs.writeFile(`${realPath}/dest/diff.js`, outputJsText, function (err) {
    exec(`open ${realPath}/index.html`);
  });
});

giff.stderr.on('data', function (data) {
  console.log('stderr: ' + data);
});

giff.on('exit', function (code) {
});
