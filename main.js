var fs = require('fs');
var handlebars = require('handlebars');
var image_handler = require('./lib/image_handler');
var kml_extractor = require('./lib/kml_extractor');
var path = require('path');
var pngparse = require("pngparse");
var Q = require('q');
var util = require('util');
var xml2js = require('xml2js');
var $_ = require('underscore');

var src_kml;

function init () {
    if (process.argv.length < 3 || process.argv[2].search(/kml/ig) === -1) {
        console.log('You must supply the path to a KML file to begin.\n\nUsage: node main.js path_to_kml_file\n');
        process.exit(1);
    }
    src_kml = path.resolve(__dirname, process.argv[2]);

    return kml_extractor.parse_file(src_kml);
}

init().then(function (kml_docs) {
    var spawn = require('child_process').spawn;
    var commands = [];

    kml_extractor.extract_placemarks();
    console.log('converting map');

    $_.each(kml_docs, function (kml_doc) {
        $_.each(kml_doc.get_placemarks(), function (placemark) {
            var src = path.resolve(path.dirname(src_kml), placemark.file);
            commands.push(image_handler.pdf_to_png(src));
        });
    });

    return Q.all(commands);
}).then(function (maps) {
    return image_handler.get_map_image_borders(maps[0]);
}).then(function (res) {
    return image_handler.cut_map_image(res);
}).then(function (res) {
    return image_handler.tile_map_image(res);
}).fail(function (err) {
    throw err;
}).done();