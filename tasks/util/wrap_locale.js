var fs = require('fs');
var path = require('path');

var minify = require('minify-stream');
var intoStream = require('into-stream');

var prefix = 'Plotly.register(';
var suffix = ');';

var moduleMarker = 'module.exports = ';

/** Wrap a locale json file into a standalone js file
 *
 * @param {string} pathToInput path to the locale json file
 * @param {string} pathToOutput path to destination file
 *
 * Logs basename of bundle when completed.
 */
module.exports = function wrap_locale(pathToInput, pathToOutput) {
    fs.readFile(pathToInput, 'utf8', function(err, data) {
        var moduleStart = data.indexOf(moduleMarker) + moduleMarker.length;
        var moduleEnd = data.indexOf(';', moduleStart);

        var rawOut = prefix + data.substr(moduleStart, moduleEnd - moduleStart) + suffix;

        var uglifyOptions = {
            ecma: 5,
            mangle: true,
            compress: true,
            output: {
                beautify: false,
                ascii_only: true
            },
            sourceMap: false
        };

        intoStream(rawOut)
            .pipe(minify(uglifyOptions))
            .pipe(fs.createWriteStream(pathToOutput))
            .on('finish', function() {
                logger(pathToOutput);
            });
    });
};

function logger(pathToOutput) {
    var log = 'ok ' + path.basename(pathToOutput);

    console.log(log);
}
