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
  .version('0.0.7')
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
const output = fs.createWriteStream(`${realPath}/dest/diff.js`)
output.write('var lineDiffExample="');

// git diff
const giff = spawn(
  'git',
  ['diff']
    .concat(options)
    .concat(['--'])
    .concat(program.args)
);

giff.stdout.on('data', function (data) {
  // encode to JSON to get escaping
  const encoded = JSON.stringify(data.toString());
  // extract the encoded string's contents
  const contents = encoded.slice(1, -1);
  output.write(contents);
});

giff.stderr.on('data', function (data) {
  console.log('stderr: ' + data);
});

giff.on('exit', function (code) {
  output.end('";', function () {
    console.log(`${realPath}/index.html`);
    exec(`which open && open ${realPath}/index.html`);
  });
});
