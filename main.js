var fs = require('fs');
var handlebars = require('handlebars');
var kml_extractor = require('./lib/kml_extractor');
var path = require('path');
var pngparse = require("pngparse");
var Q = require('q');
var util = require('util');
var xml2js = require('xml2js');
var $_ = require('underscore');

var src_kml;

var placemark = {
    name: null,
    description: null,
    bounds: null
};

function init () {
    if (process.argv.length < 3 || process.argv[2].search(/kml/ig) === -1) {
        console.log('You must supply the path to a KML file to begin.\n\nUsage: node main.js path_to_kml_file\n');
        process.exit(1);
    }
    src_kml = path.resolve(__dirname, process.argv[2]);

    return kml_extractor.parse_file(src_kml);
}

function test_pixel (x, y, img_data) {
    var black = 0x000000FF;
    var px, r, g, b, a, idx;
    idx = ((img_data.width * y) + x) * 4;
    px = (img_data.data[idx] << 24) + (img_data.data[idx + 1] << 16) + (img_data.data[idx + 2] << 8) + img_data.data[idx + 3];
    r = (px & 0xFF000000) >>> 24;
    g = (px & 0x00FF0000) >>> 16;
    b = (px & 0x0000FF00) >>> 8;
    a = (px & 0x000000FF);
    return (black === (px | black));
}

init().then(function () {
    var spawn = require('child_process').spawn;
    var commands = [];
    var placemarks = kml_extractor.extract_placemarks();
    console.log('converting map');

    $_.each(placemarks, function (placemark) {
        var deferred = Q.defer();
        var src = path.resolve(path.dirname(src_kml), placemark.file);
        var dest = src.slice(0, -4) + '.png';
        var cmd;
        console.log(placemark.file, src, dest);
        if (fs.existsSync(src)) {
            console.log('source PDF found. converting...');
            cmd = spawn('convert', ['-density', '300', src, dest]);
            cmd.on('error', deferred.reject);
            cmd.on('close', function () {
                deferred.resolve(dest);
            });
        } else {
            deferred.reject(new Error('source PDF NOT FOUND'));
        }
        commands.push(deferred.promise);
    });

    return Q.all(commands);
}).then(function (maps) {
    var deferred = Q.defer();
    console.log('Find the map square!', maps);
    pngparse.parseFile(__dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo.png', function(err, data) {
        var png_data = data;
        var cut_lines = {
            n: -1,
            s: -1,
            e: -1,
            w: -1
        };
        var cut_candidates = {
            n: {y: -1, score: -1},
            s: {y: -1, score: -1},
            e: {x: -1, score: -1},
            w: {x: -1, score: -1}
        };

        if (err) {
            deferred.reject(err);
        }

        $_.each($_.range(20), function (attempts) {
            var test_points = $_.range(0, png_data.width, 100);
            var x = Math.floor(Math.random() * png_data.width);
            var y, test_score;
            for (y = 0; y < png_data.height * 0.25; y++) {
                if (test_pixel(x, y, png_data)) {
                    test_score = 0;
                    $_.each(test_points, function (test_x) {
                        if (test_pixel(test_x, y, png_data)) {
                            test_score += 1;
                        }
                    });
                    if (cut_candidates.n.score < test_score) {
                        console.log('test score', test_score);
                        cut_candidates.n.score = test_score;
                        cut_candidates.n.y = y;
                        break;
                    }
                }
            }
            for (y = png_data.height - 1; y > png_data.height * 0.75; y--) {
                if (test_pixel(x, y, png_data)) {
                    test_score = 0;
                    $_.each(test_points, function (test_x) {
                        if (test_pixel(test_x, y, png_data)) {
                            test_score += 1;
                        }
                    });
                    if (cut_candidates.s.score < test_score) {
                        console.log('test score', test_score);
                        cut_candidates.s.score = test_score;
                        cut_candidates.s.y = y;
                        break;
                    }
                }
            }
        });
        $_.each($_.range(20), function (attempts) {
            var test_points = $_.range(0, png_data.height, 100);
            var y = Math.floor(Math.random() * png_data.height);
            var x, test_score;
            for (x = 0; x < png_data.width * 0.25; x++) {
                if (test_pixel(x, y, png_data)) {
                    test_score = 0;
                    $_.each(test_points, function (test_y) {
                        if (test_pixel(x, test_y, png_data)) {
                            test_score += 1;
                        }
                    });
                    if (cut_candidates.w.score < test_score) {
                        console.log('test score', test_score);
                        cut_candidates.w.score = test_score;
                        cut_candidates.w.x = x;
                        break;
                    }
                }
            }
            for (x = png_data.width - 1; x > png_data.width * 0.75; x--) {
                if (test_pixel(x, y, png_data)) {
                    test_score = 0;
                    $_.each(test_points, function (test_y) {
                        if (test_pixel(x, test_y, png_data)) {
                            test_score += 1;
                        }
                    });
                    if (cut_candidates.e.score < test_score) {
                        console.log('test score', test_score);
                        cut_candidates.e.score = test_score;
                        cut_candidates.e.x = x;
                        break;
                    }
                }
            }
        });
        deferred.resolve(cut_candidates);
    });
    return deferred.promise;
}).then(function (cut) {
    var deferred = Q.defer();
    var src = __dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo-njs.png';
    var dest = __dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo-njs-cropped.png';
    var spawn = require('child_process').spawn;
    var cmd;
    var x = cut.w.x;
    var y = cut.n.y;
    var w = cut.e.x - x;
    var h = cut.s.y - y;
    console.log('cropping map');
    cmd = spawn('convert', ['-crop', w + 'x' + h + '+' + x + '+' + y, src, dest]);
    cmd.on('error', deferred.reject);
    cmd.on('close', deferred.resolve);

    return deferred.promise;
}).then(function () {
    return kml_extractor.extract_placemarks();
}).fail(function (err) {
    console.error(err);
}).done();