(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// See: http://code.google.com/p/google-diff-match-patch/wiki/API
"use strict";

exports.__esModule = true;
exports.convertChangesToDMP = convertChangesToDMP;

function convertChangesToDMP(changes) {
  var ret = [],
      change = undefined,
      operation = undefined;
  for (var i = 0; i < changes.length; i++) {
    change = changes[i];
    if (change.added) {
      operation = 1;
    } else if (change.removed) {
      operation = -1;
    } else {
      operation = 0;
    }

    ret.push([operation, change.value]);
  }
  return ret;
}


},{}],2:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.convertChangesToXML = convertChangesToXML;

function convertChangesToXML(changes) {
  var ret = [];
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    if (change.added) {
      ret.push('<ins>');
    } else if (change.removed) {
      ret.push('<del>');
    }

    ret.push(escapeHTML(change.value));

    if (change.added) {
      ret.push('</ins>');
    } else if (change.removed) {
      ret.push('</del>');
    }
  }
  return ret.join('');
}

function escapeHTML(s) {
  var n = s;
  n = n.replace(/&/g, '&amp;');
  n = n.replace(/</g, '&lt;');
  n = n.replace(/>/g, '&gt;');
  n = n.replace(/"/g, '&quot;');

  return n;
}


},{}],3:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = Diff;

function Diff() {}

Diff.prototype = {
  diff: function diff(oldString, newString) {
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    var callback = options.callback;
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.options = options;

    var self = this;

    function done(value) {
      if (callback) {
        setTimeout(function () {
          callback(undefined, value);
        }, 0);
        return true;
      } else {
        return value;
      }
    }

    // Allow subclasses to massage the input prior to running
    oldString = this.castInput(oldString);
    newString = this.castInput(newString);

    oldString = this.removeEmpty(this.tokenize(oldString));
    newString = this.removeEmpty(this.tokenize(newString));

    var newLen = newString.length,
        oldLen = oldString.length;
    var editLength = 1;
    var maxEditLength = newLen + oldLen;
    var bestPath = [{ newPos: -1, components: [] }];

    // Seed editLength = 0, i.e. the content starts with the same values
    var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);
    if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
      // Identity per the equality and tokenizer
      return done([{ value: newString.join(''), count: newString.length }]);
    }

    // Main worker method. checks all permutations of a given edit length for acceptance.
    function execEditLength() {
      for (var diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
        var basePath = undefined;
        var addPath = bestPath[diagonalPath - 1],
            removePath = bestPath[diagonalPath + 1],
            _oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
        if (addPath) {
          // No one else is going to attempt to use this value, clear it
          bestPath[diagonalPath - 1] = undefined;
        }

        var canAdd = addPath && addPath.newPos + 1 < newLen,
            canRemove = removePath && 0 <= _oldPos && _oldPos < oldLen;
        if (!canAdd && !canRemove) {
          // If this path is a terminal then prune
          bestPath[diagonalPath] = undefined;
          continue;
        }

        // Select the diagonal that we want to branch from. We select the prior
        // path whose position in the new string is the farthest from the origin
        // and does not pass the bounds of the diff graph
        if (!canAdd || canRemove && addPath.newPos < removePath.newPos) {
          basePath = clonePath(removePath);
          self.pushComponent(basePath.components, undefined, true);
        } else {
          basePath = addPath; // No need to clone, we've pulled it from the list
          basePath.newPos++;
          self.pushComponent(basePath.components, true, undefined);
        }

        _oldPos = self.extractCommon(basePath, newString, oldString, diagonalPath);

        // If we have hit the end of both strings, then we are done
        if (basePath.newPos + 1 >= newLen && _oldPos + 1 >= oldLen) {
          return done(buildValues(self, basePath.components, newString, oldString, self.useLongestToken));
        } else {
          // Otherwise track this path as a potential candidate and continue.
          bestPath[diagonalPath] = basePath;
        }
      }

      editLength++;
    }

    // Performs the length of edit iteration. Is a bit fugly as this has to support the
    // sync and async mode which is never fun. Loops over execEditLength until a value
    // is produced.
    if (callback) {
      (function exec() {
        setTimeout(function () {
          // This should not happen, but we want to be safe.
          /* istanbul ignore next */
          if (editLength > maxEditLength) {
            return callback();
          }

          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength) {
        var ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  },

  pushComponent: function pushComponent(components, added, removed) {
    var last = components[components.length - 1];
    if (last && last.added === added && last.removed === removed) {
      // We need to clone here as the component clone operation is just
      // as shallow array clone
      components[components.length - 1] = { count: last.count + 1, added: added, removed: removed };
    } else {
      components.push({ count: 1, added: added, removed: removed });
    }
  },
  extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
    var newLen = newString.length,
        oldLen = oldString.length,
        newPos = basePath.newPos,
        oldPos = newPos - diagonalPath,
        commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
      newPos++;
      oldPos++;
      commonCount++;
    }

    if (commonCount) {
      basePath.components.push({ count: commonCount });
    }

    basePath.newPos = newPos;
    return oldPos;
  },

  equals: function equals(left, right) {
    return left === right;
  },
  removeEmpty: function removeEmpty(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  },
  castInput: function castInput(value) {
    return value;
  },
  tokenize: function tokenize(value) {
    return value.split('');
  }
};

function buildValues(diff, components, newString, oldString, useLongestToken) {
  var componentPos = 0,
      componentLen = components.length,
      newPos = 0,
      oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];
    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = value.map(function (value, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });

        component.value = value.join('');
      } else {
        component.value = newString.slice(newPos, newPos + component.count).join('');
      }
      newPos += component.count;

      // Common case
      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = oldString.slice(oldPos, oldPos + component.count).join('');
      oldPos += component.count;

      // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.
      if (componentPos && components[componentPos - 1].added) {
        var tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  }

  // Special case handle for when one terminal is ignored. For this case we merge the
  // terminal into the prior string and drop the change.
  var lastComponent = components[componentLen - 1];
  if ((lastComponent.added || lastComponent.removed) && diff.equals('', lastComponent.value)) {
    components[componentLen - 2].value += lastComponent.value;
    components.pop();
  }

  return components;
}

function clonePath(path) {
  return { newPos: path.newPos, components: path.components.slice(0) };
}
module.exports = exports['default'];


},{}],4:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffChars = diffChars;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var characterDiff = new _base2['default']();
exports.characterDiff = characterDiff;

function diffChars(oldStr, newStr, callback) {
  return characterDiff.diff(oldStr, newStr, callback);
}


},{"./base":3}],5:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffCss = diffCss;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var cssDiff = new _base2['default']();
exports.cssDiff = cssDiff;
cssDiff.tokenize = function (value) {
  return value.split(/([{}:;,]|\s+)/);
};

function diffCss(oldStr, newStr, callback) {
  return cssDiff.diff(oldStr, newStr, callback);
}


},{"./base":3}],6:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffJson = diffJson;
exports.canonicalize = canonicalize;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var _line = require('./line');

var objectPrototypeToString = Object.prototype.toString;

var jsonDiff = new _base2['default']();
exports.jsonDiff = jsonDiff;
// Discriminate between two lines of pretty-printed, serialized JSON where one of them has a
// dangling comma and the other doesn't. Turns out including the dangling comma yields the nicest output:
jsonDiff.useLongestToken = true;

jsonDiff.tokenize = _line.lineDiff.tokenize;
jsonDiff.castInput = function (value) {
  return typeof value === 'string' ? value : JSON.stringify(canonicalize(value), undefined, '  ');
};
jsonDiff.equals = function (left, right) {
  return _base2['default'].prototype.equals(left.replace(/,([\r\n])/g, '$1'), right.replace(/,([\r\n])/g, '$1'));
};

function diffJson(oldObj, newObj, callback) {
  return jsonDiff.diff(oldObj, newObj, callback);
}

// This function handles the presence of circular references by bailing out when encountering an
// object that is already on the "stack" of items being processed.

function canonicalize(obj, stack, replacementStack) {
  stack = stack || [];
  replacementStack = replacementStack || [];

  var i = undefined;

  for (i = 0; i < stack.length; i += 1) {
    if (stack[i] === obj) {
      return replacementStack[i];
    }
  }

  var canonicalizedObj = undefined;

  if ('[object Array]' === objectPrototypeToString.call(obj)) {
    stack.push(obj);
    canonicalizedObj = new Array(obj.length);
    replacementStack.push(canonicalizedObj);
    for (i = 0; i < obj.length; i += 1) {
      canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack);
    }
    stack.pop();
    replacementStack.pop();
  } else if (typeof obj === 'object' && obj !== null) {
    stack.push(obj);
    canonicalizedObj = {};
    replacementStack.push(canonicalizedObj);
    var sortedKeys = [],
        key = undefined;
    for (key in obj) {
      /* istanbul ignore else */
      if (obj.hasOwnProperty(key)) {
        sortedKeys.push(key);
      }
    }
    sortedKeys.sort();
    for (i = 0; i < sortedKeys.length; i += 1) {
      key = sortedKeys[i];
      canonicalizedObj[key] = canonicalize(obj[key], stack, replacementStack);
    }
    stack.pop();
    replacementStack.pop();
  } else {
    canonicalizedObj = obj;
  }
  return canonicalizedObj;
}


},{"./base":3,"./line":7}],7:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffLines = diffLines;
exports.diffTrimmedLines = diffTrimmedLines;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var _utilParams = require('../util/params');

var lineDiff = new _base2['default']();
exports.lineDiff = lineDiff;
lineDiff.tokenize = function (value) {
  var retLines = [],
      linesAndNewlines = value.split(/(\n|\r\n)/);

  // Ignore the final empty token that occurs if the string ends with a new line
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }

  // Merge the content and line separators into single tokens
  for (var i = 0; i < linesAndNewlines.length; i++) {
    var line = linesAndNewlines[i];

    if (i % 2 && !this.options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      if (this.options.ignoreWhitespace) {
        line = line.trim();
      }
      retLines.push(line);
    }
  }

  return retLines;
};

function diffLines(oldStr, newStr, callback) {
  return lineDiff.diff(oldStr, newStr, callback);
}

function diffTrimmedLines(oldStr, newStr, callback) {
  var options = _utilParams.generateOptions(callback, { ignoreWhitespace: true });
  return lineDiff.diff(oldStr, newStr, options);
}


},{"../util/params":15,"./base":3}],8:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffSentences = diffSentences;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var sentenceDiff = new _base2['default']();
exports.sentenceDiff = sentenceDiff;
sentenceDiff.tokenize = function (value) {
  return value.split(/(\S.+?[.!?])(?=\s+|$)/);
};

function diffSentences(oldStr, newStr, callback) {
  return sentenceDiff.diff(oldStr, newStr, callback);
}


},{"./base":3}],9:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.diffWords = diffWords;
exports.diffWordsWithSpace = diffWordsWithSpace;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('./base');

var _base2 = _interopRequireDefault(_base);

var _utilParams = require('../util/params');

// Based on https://en.wikipedia.org/wiki/Latin_script_in_Unicode
//
// Ranges and exceptions:
// Latin-1 Supplement, 0080–00FF
//  - U+00D7  × Multiplication sign
//  - U+00F7  ÷ Division sign
// Latin Extended-A, 0100–017F
// Latin Extended-B, 0180–024F
// IPA Extensions, 0250–02AF
// Spacing Modifier Letters, 02B0–02FF
//  - U+02C7  ˇ &#711;  Caron
//  - U+02D8  ˘ &#728;  Breve
//  - U+02D9  ˙ &#729;  Dot Above
//  - U+02DA  ˚ &#730;  Ring Above
//  - U+02DB  ˛ &#731;  Ogonek
//  - U+02DC  ˜ &#732;  Small Tilde
//  - U+02DD  ˝ &#733;  Double Acute Accent
// Latin Extended Additional, 1E00–1EFF
var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;

var reWhitespace = /\S/;

var wordDiff = new _base2['default']();
exports.wordDiff = wordDiff;
wordDiff.equals = function (left, right) {
  return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
};
wordDiff.tokenize = function (value) {
  var tokens = value.split(/(\s+|\b)/);

  // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.
  for (var i = 0; i < tokens.length - 1; i++) {
    // If we have an empty string in the next field and we have only word chars before and after, merge
    if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
      tokens[i] += tokens[i + 2];
      tokens.splice(i + 1, 2);
      i--;
    }
  }

  return tokens;
};

function diffWords(oldStr, newStr, callback) {
  var options = _utilParams.generateOptions(callback, { ignoreWhitespace: true });
  return wordDiff.diff(oldStr, newStr, options);
}

function diffWordsWithSpace(oldStr, newStr, callback) {
  return wordDiff.diff(oldStr, newStr, callback);
}


},{"../util/params":15,"./base":3}],10:[function(require,module,exports){
/* See LICENSE file for terms of use */

/*
 * Text diff implementation.
 *
 * This library supports the following APIS:
 * JsDiff.diffChars: Character by character diff
 * JsDiff.diffWords: Word (as defined by \b regex) diff which ignores whitespace
 * JsDiff.diffLines: Line based diff
 *
 * JsDiff.diffCss: Diff targeted at CSS content
 *
 * These methods are based on the implementation proposed in
 * "An O(ND) Difference Algorithm and its Variations" (Myers, 1986).
 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _diffBase = require('./diff/base');

var _diffBase2 = _interopRequireDefault(_diffBase);

var _diffCharacter = require('./diff/character');

var _diffWord = require('./diff/word');

var _diffLine = require('./diff/line');

var _diffSentence = require('./diff/sentence');

var _diffCss = require('./diff/css');

var _diffJson = require('./diff/json');

var _patchApply = require('./patch/apply');

var _patchParse = require('./patch/parse');

var _patchCreate = require('./patch/create');

var _convertDmp = require('./convert/dmp');

var _convertXml = require('./convert/xml');

exports.Diff = _diffBase2['default'];
exports.diffChars = _diffCharacter.diffChars;
exports.diffWords = _diffWord.diffWords;
exports.diffWordsWithSpace = _diffWord.diffWordsWithSpace;
exports.diffLines = _diffLine.diffLines;
exports.diffTrimmedLines = _diffLine.diffTrimmedLines;
exports.diffSentences = _diffSentence.diffSentences;
exports.diffCss = _diffCss.diffCss;
exports.diffJson = _diffJson.diffJson;
exports.structuredPatch = _patchCreate.structuredPatch;
exports.createTwoFilesPatch = _patchCreate.createTwoFilesPatch;
exports.createPatch = _patchCreate.createPatch;
exports.applyPatch = _patchApply.applyPatch;
exports.applyPatches = _patchApply.applyPatches;
exports.parsePatch = _patchParse.parsePatch;
exports.convertChangesToDMP = _convertDmp.convertChangesToDMP;
exports.convertChangesToXML = _convertXml.convertChangesToXML;
exports.canonicalize = _diffJson.canonicalize;


},{"./convert/dmp":1,"./convert/xml":2,"./diff/base":3,"./diff/character":4,"./diff/css":5,"./diff/json":6,"./diff/line":7,"./diff/sentence":8,"./diff/word":9,"./patch/apply":11,"./patch/create":12,"./patch/parse":13}],11:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.applyPatch = applyPatch;
exports.applyPatches = applyPatches;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _parse = require('./parse');

var _utilDistanceIterator = require('../util/distance-iterator');

var _utilDistanceIterator2 = _interopRequireDefault(_utilDistanceIterator);

function applyPatch(source, uniDiff) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  if (typeof uniDiff === 'string') {
    uniDiff = _parse.parsePatch(uniDiff);
  }

  if (Array.isArray(uniDiff)) {
    if (uniDiff.length > 1) {
      throw new Error('applyPatch only works with a single input.');
    }

    uniDiff = uniDiff[0];
  }

  // Apply the diff to the input
  var lines = source.split('\n'),
      hunks = uniDiff.hunks,
      compareLine = options.compareLine || function (lineNumber, line, operation, patchContent) {
    return line === patchContent;
  },
      errorCount = 0,
      fuzzFactor = options.fuzzFactor || 0,
      minLine = 0,
      offset = 0,
      removeEOFNL = undefined,
      addEOFNL = undefined;

  /**
   * Checks if the hunk exactly fits on the provided location
   */
  function hunkFits(hunk, toPos) {
    for (var j = 0; j < hunk.lines.length; j++) {
      var line = hunk.lines[j],
          operation = line[0],
          content = line.substr(1);

      if (operation === ' ' || operation === '-') {
        // Context sanity check
        if (!compareLine(toPos + 1, lines[toPos], operation, content)) {
          errorCount++;

          if (errorCount > fuzzFactor) {
            return false;
          }
        }
        toPos++;
      }
    }

    return true;
  }

  // Search best fit offsets for each hunk based on the previous ones
  for (var i = 0; i < hunks.length; i++) {
    var hunk = hunks[i],
        maxLine = lines.length - hunk.oldLines,
        localOffset = 0,
        toPos = offset + hunk.oldStart - 1;

    var iterator = _utilDistanceIterator2['default'](toPos, minLine, maxLine);

    for (; localOffset !== undefined; localOffset = iterator()) {
      if (hunkFits(hunk, toPos + localOffset)) {
        hunk.offset = offset += localOffset;
        break;
      }
    }

    if (localOffset === undefined) {
      return false;
    }

    // Set lower text limit to end of the current hunk, so next ones don't try
    // to fit over already patched text
    minLine = hunk.offset + hunk.oldStart + hunk.oldLines;
  }

  // Apply patch hunks
  for (var i = 0; i < hunks.length; i++) {
    var hunk = hunks[i],
        toPos = hunk.offset + hunk.newStart - 1;

    for (var j = 0; j < hunk.lines.length; j++) {
      var line = hunk.lines[j],
          operation = line[0],
          content = line.substr(1);

      if (operation === ' ') {
        toPos++;
      } else if (operation === '-') {
        lines.splice(toPos, 1);
        /* istanbul ignore else */
      } else if (operation === '+') {
          lines.splice(toPos, 0, content);
          toPos++;
        } else if (operation === '\\') {
          var previousOperation = hunk.lines[j - 1] ? hunk.lines[j - 1][0] : null;
          if (previousOperation === '+') {
            removeEOFNL = true;
          } else if (previousOperation === '-') {
            addEOFNL = true;
          }
        }
    }
  }

  // Handle EOFNL insertion/removal
  if (removeEOFNL) {
    while (!lines[lines.length - 1]) {
      lines.pop();
    }
  } else if (addEOFNL) {
    lines.push('');
  }
  return lines.join('\n');
}

// Wrapper that supports multiple file patches via callbacks.

function applyPatches(uniDiff, options) {
  if (typeof uniDiff === 'string') {
    uniDiff = _parse.parsePatch(uniDiff);
  }

  var currentIndex = 0;
  function processIndex() {
    var index = uniDiff[currentIndex++];
    if (!index) {
      return options.complete();
    }

    options.loadFile(index, function (err, data) {
      if (err) {
        return options.complete(err);
      }

      var updatedContent = applyPatch(data, index, options);
      options.patched(index, updatedContent);

      setTimeout(processIndex, 0);
    });
  }
  processIndex();
}


},{"../util/distance-iterator":14,"./parse":13}],12:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.structuredPatch = structuredPatch;
exports.createTwoFilesPatch = createTwoFilesPatch;
exports.createPatch = createPatch;
// istanbul ignore next

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

var _diffLine = require('../diff/line');

function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  if (!options) {
    options = { context: 4 };
  }

  var diff = _diffLine.diffLines(oldStr, newStr);
  diff.push({ value: '', lines: [] }); // Append an empty value to make cleanup easier

  function contextLines(lines) {
    return lines.map(function (entry) {
      return ' ' + entry;
    });
  }

  var hunks = [];
  var oldRangeStart = 0,
      newRangeStart = 0,
      curRange = [],
      oldLine = 1,
      newLine = 1;

  var _loop = function (i) {
    var current = diff[i],
        lines = current.lines || current.value.replace(/\n$/, '').split('\n');
    current.lines = lines;

    if (current.added || current.removed) {
      // istanbul ignore next

      var _curRange;

      // If we have previous context, start with that
      if (!oldRangeStart) {
        var prev = diff[i - 1];
        oldRangeStart = oldLine;
        newRangeStart = newLine;

        if (prev) {
          curRange = options.context > 0 ? contextLines(prev.lines.slice(-options.context)) : [];
          oldRangeStart -= curRange.length;
          newRangeStart -= curRange.length;
        }
      }

      // Output our changes
      (_curRange = curRange).push.apply(_curRange, _toConsumableArray(lines.map(function (entry) {
        return (current.added ? '+' : '-') + entry;
      })));

      // Track the updated file position
      if (current.added) {
        newLine += lines.length;
      } else {
        oldLine += lines.length;
      }
    } else {
      // Identical context lines. Track line changes
      if (oldRangeStart) {
        // Close out any changes that have been output (or join overlapping)
        if (lines.length <= options.context * 2 && i < diff.length - 2) {
          // istanbul ignore next

          var _curRange2;

          // Overlapping
          (_curRange2 = curRange).push.apply(_curRange2, _toConsumableArray(contextLines(lines)));
        } else {
          // istanbul ignore next

          var _curRange3;

          // end the range and output
          var contextSize = Math.min(lines.length, options.context);
          (_curRange3 = curRange).push.apply(_curRange3, _toConsumableArray(contextLines(lines.slice(0, contextSize))));

          var hunk = {
            oldStart: oldRangeStart,
            oldLines: oldLine - oldRangeStart + contextSize,
            newStart: newRangeStart,
            newLines: newLine - newRangeStart + contextSize,
            lines: curRange
          };
          if (i >= diff.length - 2 && lines.length <= options.context) {
            // EOF is inside this hunk
            var oldEOFNewline = /\n$/.test(oldStr);
            var newEOFNewline = /\n$/.test(newStr);
            if (lines.length == 0 && !oldEOFNewline) {
              // special case: old has no eol and no trailing context; no-nl can end up before adds
              curRange.splice(hunk.oldLines, 0, '\\ No newline at end of file');
            } else if (!oldEOFNewline || !newEOFNewline) {
              curRange.push('\\ No newline at end of file');
            }
          }
          hunks.push(hunk);

          oldRangeStart = 0;
          newRangeStart = 0;
          curRange = [];
        }
      }
      oldLine += lines.length;
      newLine += lines.length;
    }
  };

  for (var i = 0; i < diff.length; i++) {
    _loop(i);
  }

  return {
    oldFileName: oldFileName, newFileName: newFileName,
    oldHeader: oldHeader, newHeader: newHeader,
    hunks: hunks
  };
}

function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
  var diff = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);

  var ret = [];
  if (oldFileName == newFileName) {
    ret.push('Index: ' + oldFileName);
  }
  ret.push('===================================================================');
  ret.push('--- ' + diff.oldFileName + (typeof diff.oldHeader === 'undefined' ? '' : '\t' + diff.oldHeader));
  ret.push('+++ ' + diff.newFileName + (typeof diff.newHeader === 'undefined' ? '' : '\t' + diff.newHeader));

  for (var i = 0; i < diff.hunks.length; i++) {
    var hunk = diff.hunks[i];
    ret.push('@@ -' + hunk.oldStart + ',' + hunk.oldLines + ' +' + hunk.newStart + ',' + hunk.newLines + ' @@');
    ret.push.apply(ret, hunk.lines);
  }

  return ret.join('\n') + '\n';
}

function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
  return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
}


},{"../diff/line":7}],13:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.parsePatch = parsePatch;

function parsePatch(uniDiff) {
  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var diffstr = uniDiff.split('\n'),
      list = [],
      i = 0;

  function parseIndex() {
    var index = {};
    list.push(index);

    // Parse diff metadata
    while (i < diffstr.length) {
      var line = diffstr[i];

      // File header found, end parsing diff metadata
      if (/^(\-\-\-|\+\+\+|@@)\s/.test(line)) {
        break;
      }

      // Diff index
      var header = /^(?:Index:|diff(?: -r \w+)+)\s+(.+?)\s*$/.exec(line);
      if (header) {
        index.index = header[1];
      }

      i++;
    }

    // Parse file headers if they are defined. Unified diff requires them, but
    // there's no technical issues to have an isolated hunk without file header
    parseFileHeader(index);
    parseFileHeader(index);

    // Parse hunks
    index.hunks = [];

    while (i < diffstr.length) {
      var line = diffstr[i];

      if (/^(Index:|diff|\-\-\-|\+\+\+)\s/.test(line)) {
        break;
      } else if (/^@@/.test(line)) {
        index.hunks.push(parseHunk());
      } else if (line && options.strict) {
        // Ignore unexpected content unless in strict mode
        throw new Error('Unknown line ' + (i + 1) + ' ' + JSON.stringify(line));
      } else {
        i++;
      }
    }
  }

  // Parses the --- and +++ headers, if none are found, no lines
  // are consumed.
  function parseFileHeader(index) {
    var fileHeader = /^(\-\-\-|\+\+\+)\s+(\S+)\s?(.+?)\s*$/.exec(diffstr[i]);
    if (fileHeader) {
      var keyPrefix = fileHeader[1] === '---' ? 'old' : 'new';
      index[keyPrefix + 'FileName'] = fileHeader[2];
      index[keyPrefix + 'Header'] = fileHeader[3];

      i++;
    }
  }

  // Parses a hunk
  // This assumes that we are at the start of a hunk.
  function parseHunk() {
    var chunkHeaderIndex = i,
        chunkHeaderLine = diffstr[i++],
        chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    var hunk = {
      oldStart: +chunkHeader[1],
      oldLines: +chunkHeader[2] || 1,
      newStart: +chunkHeader[3],
      newLines: +chunkHeader[4] || 1,
      lines: []
    };

    var addCount = 0,
        removeCount = 0;
    for (; i < diffstr.length; i++) {
      var operation = diffstr[i][0];

      if (operation === '+' || operation === '-' || operation === ' ' || operation === '\\') {
        hunk.lines.push(diffstr[i]);

        if (operation === '+') {
          addCount++;
        } else if (operation === '-') {
          removeCount++;
        } else if (operation === ' ') {
          addCount++;
          removeCount++;
        }
      } else {
        break;
      }
    }

    // Handle the empty block count case
    if (!addCount && hunk.newLines === 1) {
      hunk.newLines = 0;
    }
    if (!removeCount && hunk.oldLines === 1) {
      hunk.oldLines = 0;
    }

    // Perform optional sanity checking
    if (options.strict) {
      if (addCount !== hunk.newLines) {
        throw new Error('Added line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
      if (removeCount !== hunk.oldLines) {
        throw new Error('Removed line count did not match for hunk at line ' + (chunkHeaderIndex + 1));
      }
    }

    return hunk;
  }

  while (i < diffstr.length) {
    parseIndex();
  }

  return list;
}


},{}],14:[function(require,module,exports){
// Iterator that traverses in the range of [min, max], stepping
// by distance from a given start position. I.e. for [0, 4], with
"use strict";

exports.__esModule = true;

exports["default"] = function (start, minLine, maxLine) {
  var wantForward = true,
      backwardExhausted = false,
      forwardExhausted = false,
      localOffset = 1;

  return function iterator() {
    var _again = true;

    _function: while (_again) {
      _again = false;

      if (wantForward && !forwardExhausted) {
        if (backwardExhausted) {
          localOffset++;
        } else {
          wantForward = false;
        }

        // Check if trying to fit beyond text length, and if not, check it fits
        // after offset location (or desired location on first iteration)
        if (start + localOffset <= maxLine) {
          return localOffset;
        }

        forwardExhausted = true;
      }

      if (!backwardExhausted) {
        if (!forwardExhausted) {
          wantForward = true;
        }

        // Check if trying to fit before text beginning, and if not, check it fits
        // before offset location
        if (minLine <= start - localOffset) {
          return - localOffset++;
        }

        backwardExhausted = true;
        _again = true;
        continue _function;
      }

      // We tried to fit hunk before text beginning and beyond text lenght, then
      // hunk can't fit on the text. Return undefined
    }
  };
};

module.exports = exports["default"];
// start of 2, this will iterate 2, 3, 1, 4, 0.


},{}],15:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.generateOptions = generateOptions;

function generateOptions(options, defaults) {
  if (typeof options === 'function') {
    defaults.callback = options;
  } else if (options) {
    for (var _name in options) {
      /* istanbul ignore else */
      if (options.hasOwnProperty(_name)) {
        defaults[_name] = options[_name];
      }
    }
  }
  return defaults;
}


},{}],16:[function(require,module,exports){
/*
 *
 * Diff Parser (diff-parser.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var utils = require('./utils.js').Utils;

  var LINE_TYPE = {
    INSERTS: 'd2h-ins',
    DELETES: 'd2h-del',
    INSERT_CHANGES: 'd2h-ins d2h-change',
    DELETE_CHANGES: 'd2h-del d2h-change',
    CONTEXT: 'd2h-cntx',
    INFO: 'd2h-info'
  };

  function DiffParser() {
  }

  DiffParser.prototype.LINE_TYPE = LINE_TYPE;

  DiffParser.prototype.generateDiffJson = function(diffInput) {
    var files = [];
    var currentFile = null;
    var currentBlock = null;
    var oldLine = null;
    var newLine = null;

    var saveBlock = function() {
      /* Add previous block(if exists) before start a new file */
      if (currentBlock) {
        currentFile.blocks.push(currentBlock);
        currentBlock = null;
      }
    };

    var saveFile = function() {
      /*
       * Add previous file(if exists) before start a new one
       * if it has name (to avoid binary files errors)
       */
      if (currentFile && currentFile.newName) {
        files.push(currentFile);
        currentFile = null;
      }
    };

    var startFile = function() {
      saveBlock();
      saveFile();

      /* Create file structure */
      currentFile = {};
      currentFile.blocks = [];
      currentFile.deletedLines = 0;
      currentFile.addedLines = 0;
    };

    var startBlock = function(line) {
      saveBlock();

      var values;

      if (values = /^@@ -(\d+),\d+ \+(\d+),\d+ @@.*/.exec(line)) {
        currentFile.isCombined = false;
      } else if (values = /^@@@ -(\d+),\d+ -\d+,\d+ \+(\d+),\d+ @@@.*/.exec(line)) {
        currentFile.isCombined = true;
      } else {
        values = [0, 0];
        currentFile.isCombined = false;
      }

      oldLine = values[1];
      newLine = values[2];

      /* Create block metadata */
      currentBlock = {};
      currentBlock.lines = [];
      currentBlock.oldStartLine = oldLine;
      currentBlock.newStartLine = newLine;
      currentBlock.header = line;
    };

    var createLine = function(line) {
      var currentLine = {};
      currentLine.content = line;

      var newLinePrefixes = !currentFile.isCombined ? ['+'] : ['+', ' +'];
      var delLinePrefixes = !currentFile.isCombined ? ['-'] : ['-', ' -'];

      /* Fill the line data */
      if (utils.startsWith(line, newLinePrefixes)) {
        currentFile.addedLines++;

        currentLine.type = LINE_TYPE.INSERTS;
        currentLine.oldNumber = null;
        currentLine.newNumber = newLine++;

        currentBlock.lines.push(currentLine);

      } else if (utils.startsWith(line, delLinePrefixes)) {
        currentFile.deletedLines++;

        currentLine.type = LINE_TYPE.DELETES;
        currentLine.oldNumber = oldLine++;
        currentLine.newNumber = null;

        currentBlock.lines.push(currentLine);

      } else {
        currentLine.type = LINE_TYPE.CONTEXT;
        currentLine.oldNumber = oldLine++;
        currentLine.newNumber = newLine++;

        currentBlock.lines.push(currentLine);
      }
    };

    var diffLines = diffInput.split('\n');

    /* Diff */
    var oldMode = /^old mode (\d{6})/;
    var newMode = /^new mode (\d{6})/;
    var deletedFileMode = /^deleted file mode (\d{6})/;
    var newFileMode = /^new file mode (\d{6})/;

    var copyFrom = /^copy from (.+)/;
    var copyTo = /^copy to (.+)/;

    var renameFrom = /^rename from (.+)/;
    var renameTo = /^rename to (.+)/;

    var similarityIndex = /^similarity index (\d+)%/;
    var dissimilarityIndex = /^dissimilarity index (\d+)%/;
    var index = /^index ([0-9a-z]+)..([0-9a-z]+) (\d{6})?/;

    /* Combined Diff */
    var combinedIndex = /^index ([0-9a-z]+),([0-9a-z]+)..([0-9a-z]+)/;
    var combinedMode = /^mode (\d{6}),(\d{6})..(\d{6})/;
    var combinedNewFile = /^new file mode (\d{6})/;
    var combinedDeletedFile = /^deleted file mode (\d{6}),(\d{6})/;

    diffLines.forEach(function(line) {
      // Unmerged paths, and possibly other non-diffable files
      // https://github.com/scottgonzalez/pretty-diff/issues/11
      // Also, remove some useless lines
      if (!line || utils.startsWith(line, '*')) {
        return;
      }

      var values = [];
      if (utils.startsWith(line, 'diff')) {
        startFile();
      } else if (currentFile && !currentFile.oldName && (values = /^--- [aiwco]\/(.+)$/.exec(line))) {
        currentFile.oldName = values[1];
        currentFile.language = getExtension(currentFile.oldName, currentFile.language);
      } else if (currentFile && !currentFile.newName && (values = /^\+\+\+ [biwco]?\/(.+)$/.exec(line))) {
        currentFile.newName = values[1];
        currentFile.language = getExtension(currentFile.newName, currentFile.language);
      } else if (currentFile && utils.startsWith(line, '@@')) {
        startBlock(line);
      } else if ((values = oldMode.exec(line))) {
        currentFile.oldMode = values[1];
      } else if ((values = newMode.exec(line))) {
        currentFile.newMode = values[1];
      } else if ((values = deletedFileMode.exec(line))) {
        currentFile.deletedFileMode = values[1];
      } else if ((values = newFileMode.exec(line))) {
        currentFile.newFileMode = values[1];
      } else if ((values = copyFrom.exec(line))) {
        currentFile.oldName = values[1];
        currentFile.isCopy = true;
      } else if ((values = copyTo.exec(line))) {
        currentFile.newName = values[1];
        currentFile.isCopy = true;
      } else if ((values = renameFrom.exec(line))) {
        currentFile.oldName = values[1];
        currentFile.isRename = true;
      } else if ((values = renameTo.exec(line))) {
        currentFile.newName = values[1];
        currentFile.isRename = true;
      } else if ((values = similarityIndex.exec(line))) {
        currentFile.unchangedPercentage = values[1];
      } else if ((values = dissimilarityIndex.exec(line))) {
        currentFile.changedPercentage = values[1];
      } else if ((values = index.exec(line))) {
        currentFile.checksumBefore = values[1];
        currentFile.checksumAfter = values[2];
        values[2] && (currentFile.mode = values[3]);
      } else if ((values = combinedIndex.exec(line))) {
        currentFile.checksumBefore = [values[2], values[3]];
        currentFile.checksumAfter = values[1];
      } else if ((values = combinedMode.exec(line))) {
        currentFile.oldMode = [values[2], values[3]];
        currentFile.newMode = values[1];
      } else if ((values = combinedNewFile.exec(line))) {
        currentFile.newFileMode = values[1];
      } else if ((values = combinedDeletedFile.exec(line))) {
        currentFile.deletedFileMode = values[1];
      } else if (currentBlock) {
        createLine(line);
      }
    });

    saveBlock();
    saveFile();

    return files;
  };

  function getExtension(filename, language) {
    var nameSplit = filename.split('.');
    if (nameSplit.length > 1) {
      return nameSplit[nameSplit.length - 1];
    } else {
      return language;
    }
  }

  module.exports['DiffParser'] = new DiffParser();

})(this);

},{"./utils.js":24}],17:[function(require,module,exports){
(function (global){
/*
 *
 * Diff to HTML (diff2html.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var diffParser = require('./diff-parser.js').DiffParser;
  var fileLister = require('./file-list-printer.js').FileListPrinter;
  var htmlPrinter = require('./html-printer.js').HtmlPrinter;

  function Diff2Html() {
  }

  /*
   * Line diff type configuration
   var config = {
   "wordByWord": true, // (default)
   // OR
   "charByChar": true
   };
   */

  /*
   * Generates json object from string diff input
   */
  Diff2Html.prototype.getJsonFromDiff = function(diffInput) {
    return diffParser.generateDiffJson(diffInput);
  };

  /*
   * Generates the html diff. The config parameter configures the output/input formats and other options
   */
  Diff2Html.prototype.getPrettyHtml = function(diffInput, config) {
    var configOrEmpty = config || {};

    var diffJson = diffInput;
    if(!configOrEmpty.inputFormat || configOrEmpty.inputFormat === 'diff') {
      diffJson = diffParser.generateDiffJson(diffInput);
    }

    var fileList = "";
    if(configOrEmpty.showFiles === true) {
      fileList = fileLister.generateFileList(diffJson, configOrEmpty);
    }

    var diffOutput = "";
    if(configOrEmpty.outputFormat === 'side-by-side') {
      diffOutput = htmlPrinter.generateSideBySideJsonHtml(diffJson, configOrEmpty);
    } else {
      diffOutput = htmlPrinter.generateLineByLineJsonHtml(diffJson, configOrEmpty);
    }

    return fileList + diffOutput
  };


  /*
   * Deprecated methods - The following methods exist only to maintain compatibility with previous versions
   */

  /*
   * Generates pretty html from string diff input
   */
  Diff2Html.prototype.getPrettyHtmlFromDiff = function(diffInput, config) {
    var configOrEmpty = config || {};
    configOrEmpty['inputFormat'] = 'diff';
    configOrEmpty['outputFormat'] = 'line-by-line';
    return this.getPrettyHtml(diffInput, configOrEmpty)
  };

  /*
   * Generates pretty html from a json object
   */
  Diff2Html.prototype.getPrettyHtmlFromJson = function(diffJson, config) {
    var configOrEmpty = config || {};
    configOrEmpty['inputFormat'] = 'json';
    configOrEmpty['outputFormat'] = 'line-by-line';
    return this.getPrettyHtml(diffJson, configOrEmpty)
  };

  /*
   * Generates pretty side by side html from string diff input
   */
  Diff2Html.prototype.getPrettySideBySideHtmlFromDiff = function(diffInput, config) {
    var configOrEmpty = config || {};
    configOrEmpty['inputFormat'] = 'diff';
    configOrEmpty['outputFormat'] = 'side-by-side';
    return this.getPrettyHtml(diffInput, configOrEmpty)
  };

  /*
   * Generates pretty side by side html from a json object
   */
  Diff2Html.prototype.getPrettySideBySideHtmlFromJson = function(diffJson, config) {
    var configOrEmpty = config || {};
    configOrEmpty['inputFormat'] = 'json';
    configOrEmpty['outputFormat'] = 'side-by-side';
    return this.getPrettyHtml(diffJson, configOrEmpty)
  };

  var diffName = 'Diff2Html';
  var diffObject = new Diff2Html();
  module.exports[diffName] = diffObject;
  // Expose diff2html in the browser
  global[diffName] = diffObject;

})(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./diff-parser.js":16,"./file-list-printer.js":18,"./html-printer.js":19}],18:[function(require,module,exports){
/*
 *
 * FileListPrinter (file-list-printer.js)
 * Author: nmatpt
 *
 */

(function (ctx, undefined) {

    var printerUtils = require('./printer-utils.js').PrinterUtils;
    var utils = require('./utils.js').Utils;

    function FileListPrinter() {
    }

    FileListPrinter.prototype.generateFileList = function (diffFiles) {
        var hideId = utils.getRandomId("d2h-hide"); //necessary if there are 2 elements like this in the same page
        var showId = utils.getRandomId("d2h-show");
        return '<div class="d2h-file-list-wrapper">\n' +
            '     <div class="d2h-file-list-header">Files changed (' + diffFiles.length + ')&nbsp&nbsp</div>\n' +
            '     <a id="' + hideId + '" class="d2h-hide" href="#' + hideId + '">+</a>\n' +
            '     <a id="' + showId + 'd2h-show" class="d2h-show" href="#' + showId + '">-</a>\n' +
            '     <div class="d2h-clear"></div>\n' +
            '     <table class="d2h-file-list">\n' +


            diffFiles.map(function (file) {
                return '     <tr class="d2h-file-list-line">\n' +
                    '       <td class="d2h-lines-added">\n' +
                    '         <span>+' + file.addedLines + '</span>\n' +
                    '       </td>\n' +
                    '       <td class="d2h-lines-deleted">\n' +
                    '         <span>-' + file.deletedLines + '</span>\n' +
                    '       </td>\n' +
                    '       <td class="d2h-file-name"><a href="#' + printerUtils.getHtmlId(file) + '">&nbsp;' + printerUtils.getDiffName(file) + '</a></td>\n' +
                    '     </tr>\n'
            }).join('\n') +
            '</table></div>\n';
    };

    module.exports['FileListPrinter'] = new FileListPrinter();

})(this);

},{"./printer-utils.js":21,"./utils.js":24}],19:[function(require,module,exports){
/*
 *
 * HtmlPrinter (html-printer.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var lineByLinePrinter = require('./line-by-line-printer.js').LineByLinePrinter;
  var sideBySidePrinter = require('./side-by-side-printer.js').SideBySidePrinter;

  function HtmlPrinter() {
  }

  HtmlPrinter.prototype.generateLineByLineJsonHtml = lineByLinePrinter.generateLineByLineJsonHtml;

  HtmlPrinter.prototype.generateSideBySideJsonHtml = sideBySidePrinter.generateSideBySideJsonHtml;

  module.exports['HtmlPrinter'] = new HtmlPrinter();

})(this);

},{"./line-by-line-printer.js":20,"./side-by-side-printer.js":23}],20:[function(require,module,exports){
/*
 *
 * LineByLinePrinter (line-by-line-printer.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var diffParser = require('./diff-parser.js').DiffParser;
  var printerUtils = require('./printer-utils.js').PrinterUtils;
  var utils = require('./utils.js').Utils;
  var Rematch = require('./rematch.js').Rematch;

  function LineByLinePrinter() {
  }

  LineByLinePrinter.prototype.generateLineByLineJsonHtml = function(diffFiles, config) {
    return '<div class="d2h-wrapper">\n' +
      diffFiles.map(function(file) {

        var diffs;
        if (file.blocks.length) {
          diffs = generateFileHtml(file, config);
        } else {
          diffs = generateEmptyDiff();
        }

        return '<div id="' + printerUtils.getHtmlId(file) + '" class="d2h-file-wrapper" data-lang="' + file.language + '">\n' +
          '     <div class="d2h-file-header">\n' +
          '       <div class="d2h-file-stats">\n' +
          '         <span class="d2h-lines-added">' +
          '           <span>+' + file.addedLines + '</span>\n' +
          '         </span>\n' +
          '         <span class="d2h-lines-deleted">' +
          '           <span>-' + file.deletedLines + '</span>\n' +
          '         </span>\n' +
          '       </div>\n' +
          '       <div class="d2h-file-name">' + printerUtils.getDiffName(file) + '</div>\n' +
          '     </div>\n' +
          '     <div class="d2h-file-diff">\n' +
          '       <div class="d2h-code-wrapper">\n' +
          '         <table class="d2h-diff-table">\n' +
          '           <tbody class="d2h-diff-tbody">\n' +
          '         ' + diffs +
          '           </tbody>\n' +
          '         </table>\n' +
          '       </div>\n' +
          '     </div>\n' +
          '   </div>\n';
      }).join('\n') +
      '</div>\n';
  };

  var matcher=Rematch.rematch(function(a,b) {
    var amod = a.content.substr(1),
        bmod = b.content.substr(1);
    return Rematch.distance(amod, bmod);
  });

  function generateFileHtml(file, config) {
    return file.blocks.map(function(block) {

      var lines = '<tr>\n' +
        '  <td class="d2h-code-linenumber ' + diffParser.LINE_TYPE.INFO + '"></td>\n' +
        '  <td class="' + diffParser.LINE_TYPE.INFO + '">' +
        '    <div class="d2h-code-line ' + diffParser.LINE_TYPE.INFO + '">' + utils.escape(block.header) + '</div>' +
        '  </td>\n' +
        '</tr>\n';

      var oldLines = [];
      var newLines = [];
      function processChangeBlock() {
        var matches;
        var insertType;
        var deleteType;
        var doMatching = config.matching === "lines" || config.matching === "words";
        if (doMatching) {
          matches = matcher(oldLines, newLines);
          insertType = diffParser.LINE_TYPE.INSERT_CHANGES;
          deleteType = diffParser.LINE_TYPE.DELETE_CHANGES;
        } else {
          matches = [[oldLines,newLines]];
          insertType = diffParser.LINE_TYPE.INSERTS;
          deleteType = diffParser.LINE_TYPE.DELETES;
        }
        matches.forEach(function(match){
          var oldLines = match[0];
          var newLines = match[1];
          var processedOldLines = [];
          var processedNewLines = [];
          var j = 0;
            var oldLine, newLine,
              common = Math.min(oldLines.length, newLines.length),
              max = Math.max(oldLines.length, newLines.length);
            for (j = 0; j < common; j++) {
              oldLine = oldLines[j];
              newLine = newLines[j];

              config.isCombined = file.isCombined;
              var diff = printerUtils.diffHighlight(oldLine.content, newLine.content, config);

              processedOldLines +=
                generateLineHtml(deleteType, oldLine.oldNumber, oldLine.newNumber,
                  diff.first.line, diff.first.prefix);
              processedNewLines +=
                generateLineHtml(insertType, newLine.oldNumber, newLine.newNumber,
                  diff.second.line, diff.second.prefix);
            }

            lines += processedOldLines + processedNewLines;
            lines += processLines(oldLines.slice(common), newLines.slice(common));

            processedOldLines = [];
            processedNewLines = [];
        });
        oldLines = [];
        newLines = [];
      }

      for (var i = 0; i < block.lines.length; i++) {
        var line = block.lines[i];
        var escapedLine = utils.escape(line.content);

        if ( line.type !== diffParser.LINE_TYPE.INSERTS &&
            (newLines.length > 0 || (line.type !== diffParser.LINE_TYPE.DELETES && oldLines.length > 0))) {
          processChangeBlock();
        }
        if (line.type == diffParser.LINE_TYPE.CONTEXT) {
          lines += generateLineHtml(line.type, line.oldNumber, line.newNumber, escapedLine);
        } else if (line.type == diffParser.LINE_TYPE.INSERTS && !oldLines.length) {
          lines += generateLineHtml(line.type, line.oldNumber, line.newNumber, escapedLine);
        } else if (line.type == diffParser.LINE_TYPE.DELETES) {
          oldLines.push(line);
        } else if (line.type == diffParser.LINE_TYPE.INSERTS && !!oldLines.length) {
          newLines.push(line);
        } else {
          console.error('unknown state in html line-by-line generator');
          processChangeBlock();
        }
      }

      processChangeBlock();

      return lines;
    }).join('\n');
  }

  function processLines(oldLines, newLines) {
    var lines = '';

    for (j = 0; j < oldLines.length; j++) {
      var oldLine = oldLines[j];
      var oldEscapedLine = utils.escape(oldLine.content);
      lines += generateLineHtml(oldLine.type, oldLine.oldNumber, oldLine.newNumber, oldEscapedLine);
    }

    for (j = 0; j < newLines.length; j++) {
      var newLine = newLines[j];
      var newEscapedLine = utils.escape(newLine.content);
      lines += generateLineHtml(newLine.type, newLine.oldNumber, newLine.newNumber, newEscapedLine);
    }

    return lines;
  }

  function generateLineHtml(type, oldNumber, newNumber, content, prefix) {
    var htmlPrefix = '';
    if (prefix) {
      htmlPrefix = '<span class="d2h-code-line-prefix">' + prefix + '</span>';
    }

    var htmlContent = '';
    if (content) {
      htmlContent = '<span class="d2h-code-line-ctn">' + content + '</span>';
    }

    return '<tr>\n' +
      '  <td class="d2h-code-linenumber ' + type + '">' +
      '    <div class="line-num1">' + utils.valueOrEmpty(oldNumber) + '</div>' +
      '    <div class="line-num2">' + utils.valueOrEmpty(newNumber) + '</div>' +
      '  </td>\n' +
      '  <td class="' + type + '">' +
      '    <div class="d2h-code-line ' + type + '">' + htmlPrefix + htmlContent + '</div>' +
      '  </td>\n' +
      '</tr>\n';
  }

  function generateEmptyDiff() {
    return '<tr>\n' +
      '  <td class="' + diffParser.LINE_TYPE.INFO + '">' +
      '    <div class="d2h-code-line ' + diffParser.LINE_TYPE.INFO + '">' +
      'File without changes' +
      '    </div>' +
      '  </td>\n' +
      '</tr>\n';
  }

  module.exports['LineByLinePrinter'] = new LineByLinePrinter();

})(this);

},{"./diff-parser.js":16,"./printer-utils.js":21,"./rematch.js":22,"./utils.js":24}],21:[function(require,module,exports){
/*
 *
 * PrinterUtils (printer-utils.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var jsDiff = require('diff');
  var utils = require('./utils.js').Utils;
  var Rematch = require('./rematch.js').Rematch;

  function PrinterUtils() {
  }

  PrinterUtils.prototype.getHtmlId = function(file) {
    var hashCode =  function(text) {
      var hash = 0, i, chr, len;
      if (text.length == 0) return hash;
      for (i = 0, len = text.length; i < len; i++) {
        chr   = text.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }
      return hash;
    };

    return "d2h-" + hashCode(this.getDiffName(file)).toString().slice(-6);
  };

  PrinterUtils.prototype.getDiffName = function(file) {
    var oldFilename = file.oldName;
    var newFilename = file.newName;

    if (oldFilename && newFilename
      && oldFilename !== newFilename
      && !isDeletedName(newFilename)) {
      return oldFilename + ' -> ' + newFilename;
    } else if (newFilename && !isDeletedName(newFilename)) {
      return newFilename;
    } else if (oldFilename) {
      return oldFilename;
    } else {
      return 'Unknown filename';
    }
  };

  PrinterUtils.prototype.diffHighlight = function(diffLine1, diffLine2, config) {
    var lineStart1, lineStart2;

    var prefixSize = 1;

    if (config.isCombined) {
      prefixSize = 2;
    }

    lineStart1 = diffLine1.substr(0, prefixSize);
    lineStart2 = diffLine2.substr(0, prefixSize);

    diffLine1 = diffLine1.substr(prefixSize);
    diffLine2 = diffLine2.substr(prefixSize);

    var diff;
    if (config.charByChar) {
      diff = jsDiff.diffChars(diffLine1, diffLine2);
    } else {
      diff = jsDiff.diffWordsWithSpace(diffLine1, diffLine2);
    }

    var highlightedLine = '';

    var changedWords = [];
    if (!config.charByChar && config.matching === 'words') {
      var treshold = 0.25;
      if (typeof(config.matchWordsThreshold) !== "undefined") {
        treshold = config.matchWordsThreshold;
      }
      var matcher = Rematch.rematch(function(a, b) {
        var amod = a.value,
            bmod = b.value,
            result = Rematch.distance(amod, bmod);
        return result;
      });
      var removed = diff.filter(function isRemoved(element){
        return element.removed;
      });
      var added = diff.filter(function isAdded(element){
        return element.added;
      });
      var chunks = matcher(added, removed);
      chunks = chunks.forEach(function(chunk){
        if(chunk[0].length === 1 && chunk[1].length === 1) {
          var dist = Rematch.distance(chunk[0][0].value, chunk[1][0].value)
          if (dist < treshold) {
            changedWords.push(chunk[0][0]);
            changedWords.push(chunk[1][0]);
          }
        }
      });
    }
    diff.forEach(function(part) {
      var addClass = changedWords.indexOf(part) > -1 ? ' class="d2h-change"' : '';
      var elemType = part.added ? 'ins' : part.removed ? 'del' : null;
      var escapedValue = utils.escape(part.value);

      if (elemType !== null) {
        highlightedLine += '<' + elemType + addClass + '>' + escapedValue + '</' + elemType + '>';
      } else {
        highlightedLine += escapedValue;
      }
    });

    return {
      first: {
        prefix: lineStart1,
        line: removeIns(highlightedLine)
      },
      second: {
        prefix: lineStart2,
        line: removeDel(highlightedLine)
      }
    }
  };

  function isDeletedName(name) {
    return name === 'dev/null';
  }

  function removeIns(line) {
    return line.replace(/(<ins[^>]*>((.|\n)*?)<\/ins>)/g, '');
  }

  function removeDel(line) {
    return line.replace(/(<del[^>]*>((.|\n)*?)<\/del>)/g, '');
  }

  module.exports['PrinterUtils'] = new PrinterUtils();

})(this);

},{"./rematch.js":22,"./utils.js":24,"diff":10}],22:[function(require,module,exports){
/*
 *
 * Rematch (rematch.js)
 * Matching two sequences of objects by similarity
 * Author: W. Illmeyer, Nexxar GmbH
 *
 */

(function(ctx, undefined) {
  var Rematch = {};
  Rematch.arrayToString = function arrayToString(a) {
    if (Object.prototype.toString.apply(a,[]) === "[object Array]") {
      return "[" + a.map(arrayToString).join(", ") + "]";
    } else {
      return a;
    }
  }

  /*
  Copyright (c) 2011 Andrei Mackenzie
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  */
  function levenshtein(a, b){
    if(a.length == 0) return b.length;
    if(b.length == 0) return a.length;

    var matrix = [];

    // increment along the first column of each row
    var i;
    for(i = 0; i <= b.length; i++){
      matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for(j = 0; j <= a.length; j++){
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                      Math.min(matrix[i][j-1] + 1, // insertion
                          matrix[i-1][j] + 1)); // deletion
        }
      }
    }
    return matrix[b.length][a.length];
  }
  Rematch.levenshtein = levenshtein;

  Rematch.distance = function distance(x,y) {
    x=x.trim();
    y=y.trim();
    var lev = levenshtein(x,y),
      score = lev / (x.length + y.length);
    return score;
  }

  Rematch.rematch = function rematch(distanceFunction) {

    function findBestMatch(a, b, cache) {
      var cachecount = 0;

      for(var key in cache) {
        cachecount++;
      }
      var bestMatchDist = Infinity;
      var bestMatch;
      for (var i = 0; i < a.length; ++i) {
        for (var j = 0; j < b.length; ++j) {
          var cacheKey = JSON.stringify([a[i], b[j]]);
          var md;
          if (cache.hasOwnProperty(cacheKey)) {
            md = cache[cacheKey];
          } else {
            md = distanceFunction(a[i], b[j]);
            cache[cacheKey] = md;
          }
          if (md < bestMatchDist) {
            bestMatchDist = md;
            bestMatch = { indexA: i, indexB: j, score: bestMatchDist };
          }
        }
      }
      return bestMatch;
    }
    function group(a, b, level, cache) {

      if (typeof(cache)==="undefined") {
        cache = {};
      }
      var minLength = Math.min(a.length, b.length);
      var bm = findBestMatch(a,b, cache);
      if (!level) {
        level = 0;
      }
      if (!bm || (a.length + b.length < 3)) {
        return [[a, b]];
      }
      var a1 = a.slice(0, bm.indexA),
        b1 = b.slice(0, bm.indexB),
        aMatch = [a[bm.indexA]],
        bMatch = [b[bm.indexB]],
        tailA = bm.indexA + 1,
        tailB = bm.indexB + 1,
        a2 = a.slice(tailA),
        b2 = b.slice(tailB);

      var group1 = group(a1, b1, level+1, cache);
      var groupMatch = group(aMatch, bMatch, level+1, cache);
      var group2 = group(a2, b2, level+1, cache);
      var result = groupMatch;
      if (bm.indexA > 0 || bm.indexB > 0) {
        result = group1.concat(result);
      }
      if (a.length > tailA || b.length > tailB ) {
        result = result.concat(group2);
      }
      return result;
    }
    return group;
  }

  module.exports['Rematch'] = Rematch;

})(this);

},{}],23:[function(require,module,exports){
/*
 *
 * HtmlPrinter (html-printer.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  var diffParser = require('./diff-parser.js').DiffParser;
  var printerUtils = require('./printer-utils.js').PrinterUtils;
  var utils = require('./utils.js').Utils;
  var Rematch = require('./rematch.js').Rematch;

  function SideBySidePrinter() {
  }

  SideBySidePrinter.prototype.generateSideBySideJsonHtml = function(diffFiles, config) {
    return '<div class="d2h-wrapper">\n' +
      diffFiles.map(function(file) {

        var diffs;
        if (file.blocks.length) {
          diffs = generateSideBySideFileHtml(file, config);
        } else {
          diffs = generateEmptyDiff();
        }

        return '<div id="' + printerUtils.getHtmlId(file) + '" class="d2h-file-wrapper" data-lang="' + file.language + '">\n' +
          '     <div class="d2h-file-header">\n' +
          '       <div class="d2h-file-stats">\n' +
          '         <span class="d2h-lines-added">' +
          '           <span>+' + file.addedLines + '</span>\n' +
          '         </span>\n' +
          '         <span class="d2h-lines-deleted">' +
          '           <span>-' + file.deletedLines + '</span>\n' +
          '         </span>\n' +
          '       </div>\n' +
          '       <div class="d2h-file-name">' + printerUtils.getDiffName(file) + '</div>\n' +
          '     </div>\n' +
          '     <div class="d2h-files-diff">\n' +
          '       <div class="d2h-file-side-diff">\n' +
          '         <div class="d2h-code-wrapper">\n' +
          '           <table class="d2h-diff-table">\n' +
          '             <tbody class="d2h-diff-tbody">\n' +
          '           ' + diffs.left +
          '             </tbody>\n' +
          '           </table>\n' +
          '         </div>\n' +
          '       </div>\n' +
          '       <div class="d2h-file-side-diff">\n' +
          '         <div class="d2h-code-wrapper">\n' +
          '           <table class="d2h-diff-table">\n' +
          '             <tbody class="d2h-diff-tbody">\n' +
          '           ' + diffs.right +
          '             </tbody>\n' +
          '           </table>\n' +
          '         </div>\n' +
          '       </div>\n' +
          '     </div>\n' +
          '   </div>\n';
      }).join('\n') +
      '</div>\n';
  };

  var matcher=Rematch.rematch(function(a,b) {
    var amod = a.content.substr(1),
        bmod = b.content.substr(1);
    return Rematch.distance(amod, bmod);
  });

  function generateSideBySideFileHtml(file, config) {
    var fileHtml = {};
    fileHtml.left = '';
    fileHtml.right = '';

    file.blocks.forEach(function(block) {

      fileHtml.left += '<tr>\n' +
        '  <td class="d2h-code-side-linenumber ' + diffParser.LINE_TYPE.INFO + '"></td>\n' +
        '  <td class="' + diffParser.LINE_TYPE.INFO + '">' +
        '    <div class="d2h-code-side-line ' + diffParser.LINE_TYPE.INFO + '">' +
        '      ' + utils.escape(block.header) +
        '    </div>' +
        '  </td>\n' +
        '</tr>\n';

      fileHtml.right += '<tr>\n' +
        '  <td class="d2h-code-side-linenumber ' + diffParser.LINE_TYPE.INFO + '"></td>\n' +
        '  <td class="' + diffParser.LINE_TYPE.INFO + '">' +
        '    <div class="d2h-code-side-line ' + diffParser.LINE_TYPE.INFO + '"></div>' +
        '  </td>\n' +
        '</tr>\n';

      var oldLines = [];
      var newLines = [];
      function processChangeBlock() {
        var matches;
        var insertType;
        var deleteType;
        var doMatching = config.matching === "lines" || config.matching === "words";
        if (doMatching) {
          matches = matcher(oldLines, newLines);
          insertType = diffParser.LINE_TYPE.INSERT_CHANGES;
          deleteType = diffParser.LINE_TYPE.DELETE_CHANGES;
        } else {
          matches = [[oldLines,newLines]];
          insertType = diffParser.LINE_TYPE.INSERTS;
          deleteType = diffParser.LINE_TYPE.DELETES;
        }
        matches.forEach(function(match){
          var oldLines = match[0];
          var newLines = match[1];
          var tmpHtml;
          var j = 0;
          var oldLine, newLine,
              common = Math.min(oldLines.length, newLines.length),
              max = Math.max(oldLines.length, newLines.length);
          for (j = 0; j < common; j++) {
            oldLine = oldLines[j];
            newLine = newLines[j];

            config.isCombined = file.isCombined;

            var diff = printerUtils.diffHighlight(oldLine.content, newLine.content, config);

            fileHtml.left +=
              generateSingleLineHtml(deleteType, oldLine.oldNumber,
                diff.first.line, diff.first.prefix);
            fileHtml.right +=
              generateSingleLineHtml(insertType, newLine.newNumber,
                diff.second.line, diff.second.prefix);
            }
            if (max > common) {
              var oldSlice = oldLines.slice(common),
                  newSlice = newLines.slice(common);
              tmpHtml = processLines(oldLines.slice(common), newLines.slice(common));
              fileHtml.left += tmpHtml.left;
              fileHtml.right += tmpHtml.right;
            }
        });
        oldLines = [];
        newLines = [];
      }
      for (var i = 0; i < block.lines.length; i++) {
        var line = block.lines[i];
        var prefix = line[0];
        var escapedLine = utils.escape(line.content.substr(1));

        if ( line.type !== diffParser.LINE_TYPE.INSERTS &&
            (newLines.length > 0 || (line.type !== diffParser.LINE_TYPE.DELETES && oldLines.length > 0))) {
          processChangeBlock();
        }
        if (line.type == diffParser.LINE_TYPE.CONTEXT) {
          fileHtml.left += generateSingleLineHtml(line.type, line.oldNumber, escapedLine, prefix);
          fileHtml.right += generateSingleLineHtml(line.type, line.newNumber, escapedLine, prefix);
        } else if (line.type == diffParser.LINE_TYPE.INSERTS && !oldLines.length) {
          fileHtml.left += generateSingleLineHtml(diffParser.LINE_TYPE.CONTEXT, '', '', '');
          fileHtml.right += generateSingleLineHtml(line.type, line.newNumber, escapedLine, prefix);
        } else if (line.type == diffParser.LINE_TYPE.DELETES) {
          oldLines.push(line);
        } else if (line.type == diffParser.LINE_TYPE.INSERTS && !!oldLines.length) {
          newLines.push(line);
        } else {
          console.error('unknown state in html side-by-side generator');
          processChangeBlock();
        }
      }

      processChangeBlock();
    });

    return fileHtml;
  }

  function processLines(oldLines, newLines) {
    var fileHtml = {};
    fileHtml.left = '';
    fileHtml.right = '';

    var maxLinesNumber = Math.max(oldLines.length, newLines.length);
    for (j = 0; j < maxLinesNumber; j++) {
      var oldLine = oldLines[j];
      var newLine = newLines[j];
      var oldContent;
      var newContent;
      var oldPrefix;
      var newPrefix;
      if (oldLine) {
        oldContent = utils.escape(oldLine.content.substr(1));
        oldPrefix = oldLine.content[0];
      }
      if (newLine) {
        newContent = utils.escape(newLine.content.substr(1));
        newPrefix = newLine.content[0];
      }
      if (oldLine && newLine) {
        fileHtml.left += generateSingleLineHtml(oldLine.type, oldLine.oldNumber, oldContent, oldPrefix);
        fileHtml.right += generateSingleLineHtml(newLine.type, newLine.newNumber, newContent, newPrefix);
      } else if (oldLine) {
        fileHtml.left += generateSingleLineHtml(oldLine.type, oldLine.oldNumber, oldContent, oldPrefix);
        fileHtml.right += generateSingleLineHtml(diffParser.LINE_TYPE.CONTEXT, '', '', '');
      } else if (newLine) {
        fileHtml.left += generateSingleLineHtml(diffParser.LINE_TYPE.CONTEXT, '', '', '');
        fileHtml.right += generateSingleLineHtml(newLine.type, newLine.newNumber, newContent, newPrefix);
      } else {
        console.error('How did it get here?');
      }
    }

    return fileHtml;
  }

  function generateSingleLineHtml(type, number, content, prefix) {
    var htmlPrefix = '';
    if (prefix) {
      htmlPrefix = '<span class="d2h-code-line-prefix">' + prefix + '</span>';
    }

    var htmlContent = '';
    if (content) {
      htmlContent = '<span class="d2h-code-line-ctn">' + content + '</span>';
    }

    return '<tr>\n' +
      '    <td class="d2h-code-side-linenumber ' + type + '">' + number + '</td>\n' +
      '    <td class="' + type + '">' +
      '      <div class="d2h-code-side-line ' + type + '">' + htmlPrefix + htmlContent + '</div>' +
      '    </td>\n' +
      '  </tr>\n';
  }

  function generateEmptyDiff() {
    var fileHtml = {};
    fileHtml.right = '';

    fileHtml.left = '<tr>\n' +
      '  <td class="' + diffParser.LINE_TYPE.INFO + '">' +
      '    <div class="d2h-code-side-line ' + diffParser.LINE_TYPE.INFO + '">' +
      'File without changes' +
      '    </div>' +
      '  </td>\n' +
      '</tr>\n';

    return fileHtml;
  }

  module.exports['SideBySidePrinter'] = new SideBySidePrinter();

})(this);

},{"./diff-parser.js":16,"./printer-utils.js":21,"./rematch.js":22,"./utils.js":24}],24:[function(require,module,exports){
/*
 *
 * Utils (utils.js)
 * Author: rtfpessoa
 *
 */

(function(ctx, undefined) {

  function Utils() {
  }

  Utils.prototype.escape = function(str) {
    return str.slice(0)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\t/g, '    ');
  };

  Utils.prototype.getRandomId = function(prefix) {
      return prefix + "-" + Math.random().toString(36).slice(-3);
  };

  Utils.prototype.startsWith = function(str, start) {
    if (typeof start === 'object') {
      var result = false;
      start.forEach(function(s) {
        if (str.indexOf(s) === 0) {
          result = true;
        }
      });

      return result;
    }

    return str.indexOf(start) === 0;
  };

  Utils.prototype.valueOrEmpty = function(value) {
    return value ? value : '';
  };

  module.exports['Utils'] = new Utils();

})(this);

},{}],25:[function(require,module,exports){
require('diff2html');

document.addEventListener("DOMContentLoaded", function() {
    var diffJson = Diff2Html.getJsonFromDiff(lineDiffExample);
    var allFileLanguages = diffJson.map(function(line) {
        return line.language;
    });

    var distinctLanguages = allFileLanguages.filter(function(v, i) {
        return allFileLanguages.indexOf(v) == i;
    });

    hljs.configure({languages: distinctLanguages});

    document.getElementById("line-by-line").innerHTML = Diff2Html.getPrettyHtml(diffJson, { inputFormat: 'json', showFiles: true, matching: 'lines' });
    document.getElementById("side-by-side").innerHTML = Diff2Html.getPrettyHtml(diffJson, { inputFormat: 'json', showFiles: true, matching: 'lines', outputFormat: 'side-by-side' });

    var codeLines = document.getElementsByClassName("d2h-code-line-ctn");
    [].forEach.call(codeLines, function(line) {
        hljs.highlightBlock(line);
    });
});

},{"diff2html":17}]},{},[25]);
