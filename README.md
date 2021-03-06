# node-giff

![ScreenShot](https://raw.github.com/wiki/do7be/node-giff/image/4cf1ee481479cb44af9d2914b51df9f2.gif)

## Installation

```
$ npm install -g node-giff
```

## Usage

```
Usage: giff [options] [<commit>] [--] [<path>...]

Options:

  -h, --help     output usage information
  -V, --version  output the version number
  --cached       show diff of staging files
```

Open your browser and show result of "git diff".

## Example

```
$ giff HEAD^
$ giff hoge.js
```

## Thanks

* https://github.com/rtfpessoa/diff2html by [rtfpessoa](https://github.com/rtfpessoa)

* [https://highlightjs.org/](https://highlightjs.org/)

## MIT LICENSE

Copyright © 2016 do7be licensed under [MIT](http://opensource.org/licenses/MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
