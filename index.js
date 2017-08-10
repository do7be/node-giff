#!/usr/bin/env node
// @ts-check

'use strict';

const
  path    = require('path'),
  fs      = require('fs'),
  util    = require('util'),
  spawn   = require('child_process').spawn,
  exec    = require('child_process').exec,
  program = require('commander');

// set program info
program
  .version('0.0.5')
  .usage('[options] [<commit>] [--] [<path>...]')
  .option('--cached', 'show diff of staging files')
  .parse(process.argv);

// judge options
const options = ['--patience'];
if (program.cached) {
  options.push('--cached');
}

// init output file
const realPath = fs.realpathSync(__dirname);
const outputFd = fs.openSync(`${realPath}/dest/diff.js`, 'w');
fs.writeSync(outputFd, 'var lineDiffExample="');

// git diff
const giff = spawn('git', ['diff'].concat(program.args).concat(options));
giff.stdout.on('data', function (data) {
  // encode to JSON to get escaping
  const encoded = JSON.stringify(data.toString());
  // extract the encoded string's contents
  const contents = encoded.slice(1, -1);
  fs.writeSync(outputFd, contents);
});

giff.stderr.on('data', function (data) {
  console.log('stderr: ' + data);
});

giff.on('exit', function (code) {
  fs.writeSync(outputFd, '";');
  fs.closeSync(outputFd);

  console.log(`${realPath}/index.html`);
  exec(`which open && open ${realPath}/index.html`);
});
