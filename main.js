var fs = require('fs');
var handlebars = require('handlebars');
var pngparse = require("pngparse");
var Q = require('q');
var util = require('util');
var xml2js = require('xml2js');
var $_ = require('underscore');

var placemark = {
    name: null,
    description: null,
    bounds: null
};

function init () {
    var parser = new xml2js.Parser();
    var deferred = Q.defer();

    parser.addListener('end', function(result) {
        deferred.resolve(result);
    });

    fs.readFile(__dirname + '/test_data/tmp/doc.kml', function(err, data) {
        if (err) {
            deferred.reject(err);
        }
        parser.parseString(data);
    });
    return deferred.promise;
}

function inspect_document (doc) {
    console.log("Document.name", doc.name);
    $_.each(doc.Folder, inspect_folder);
}

function inspect_folder (doc) {
    console.log("Folder.name", doc.name);
    $_.each(doc, function (v, k) {
        // util.inspect({k: v}, {colors: true});
    });
    $_.each(doc.Placemark, inspect_placemark);
    // $_.each(doc.GroundOverlay, inspect_groundoverlay);
}

function inspect_placemark (doc) {
    placemark.name = doc.name[0];
    placemark.description = doc.description[0];
    $_.each(doc, function (v, k) {
        // console.log('ipm', k, v);
    });
    $_.each(doc.Polygon, function (poly) {
        placemark.bounds = get_latlonbox(clean_coord_string(poly.outerBoundaryIs[0].LinearRing[0].coordinates[0]));
    });
}

function inspect_groundoverlay (doc) {
    // console.log('inspect_groundoverlay', doc);
    $_.each(doc, function (v, k) {
        // console.log('igo', k, v);
    });
}

function clean_coord_string (coord_string) {
    var cleaned = coord_string.replace(/[\n\t]/g, '').split(' ');
    var last = cleaned.pop();
    if (last.length) {
        cleaned.push(last);
    }
    return cleaned;
}

function get_latlonbox (coord_strings) {
    var north = -91, south = 91, east = -181, west = 181;
    var lat, lon;
    $_.each(coord_strings, function (coord) {
        var parts = coord.split(',');
        lon = parseFloat(parts[0]);
        lat = parseFloat(parts[1]);
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lon);
        west = Math.min(west, lon);
    });
    return {
        north: north,
        south: south,
        east: east,
        west: west
    };
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

init().then(function (data) {
    // console.log(data.kml.Document, $_.pluck(data.kml, 'Document'));
    $_.each(data.kml.Document, inspect_document);
    console.log(JSON.stringify(placemark, null, 2));
    return placemark;
}).then(function (pm) {
    var deferred = Q.defer();
    var src = __dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo.pdf';
    var dest = __dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo-njs.png';
    var spawn = require('child_process').spawn;
    var cmd;
    // cmd = spawn('convert', ['-density', '300', src, dest]);
    // cmd.on('error', deferred.reject);
    // cmd.on('close', deferred.resolve);

    deferred.resolve();

    return deferred.promise;
}).then(function () {
    var deferred = Q.defer();
    console.log('Find the map square!');
    pngparse.parseFile(__dirname + '/test_data/tmp/CA_Glendora_20120328_TM_geo-njs.png', function(err, data) {
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

        console.log(data);

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
}).fail(function (err) {
    console.error(err);
}).done();